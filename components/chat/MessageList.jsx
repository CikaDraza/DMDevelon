"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useChatMessages } from "@/hooks/useProjectChat";
import { useNotifications } from "@/hooks/useNotifications";
import { MessageBubble } from "./MessageBubble";
import { ArrowDown, Loader2 } from "lucide-react";

// How close to the bottom still counts as "following the conversation".
const NEAR_BOTTOM_PX = 100;
// Scroll position that triggers loading the previous page.
const LOAD_MORE_AT_PX = 80;
// How long after a real input event the reader still counts as the one
// driving the scroll.
const USER_GESTURE_MS = 700;
// How long a pin-to-bottom keeps re-asserting itself. Long enough to cover
// everything that grows the thread just after the scroll lands: an image
// decoding, the web font swapping in, the conversation pane getting a size
// for the first time on a phone, and the refetch that delivers the message
// the reader has just sent.
const PIN_SETTLE_MS = 800;
// A send has to outlast a network round trip: the pin runs the moment the
// POST resolves, but the message itself only appears when the refetch behind
// it lands, which on a phone is well past the window above.
const PIN_SETTLE_SEND_MS = 2500;
// Hard cap on waiting for a smooth scroll to come to rest, in case it is
// interrupted in a way that never produces a stable position.
const AUTO_SCROLL_MAX_MS = 2500;
// Keys that scroll a focused container. Needed because a keyboard scroll
// produces no wheel or touch event.
const SCROLL_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  " ",
]);
// Safety cap for the jump-to-message history walk: 20 pages × 50 = 1000
// messages back. Past that, ask the reader to scroll rather than hammering
// the API.
const MAX_JUMP_PAGES = 20;

/**
 * Scrolling thread with backward pagination.
 *
 * The scroll model is "stick to bottom until the reader says otherwise",
 * not "scroll to the bottom once on load". The one-shot version had a race
 * that put people in the middle of a long conversation, every time:
 *
 *   1. first paint consumes the one-shot flag and queues a scroll for the
 *      next frame;
 *   2. in that gap a scroll event fires with scrollTop still 0;
 *   3. `scrollTop < 80` + `hasMoreHistory` reads as "reader scrolled up to
 *      read history" and loads the previous page;
 *   4. the prepend restores the position of the OLD top — the middle of the
 *      thread — and the one-shot flag is already spent, so nothing pulls it
 *      back down.
 *
 * It only bit channels with a full first page (50+ messages), which is why it
 * looked intermittent. Two rules kill it: history never loads until the view
 * has actually settled at the bottom, and only a scroll the READER performed
 * can end stick-to-bottom mode.
 *
 * Who performed a scroll is the hard part, and guessing it from a timer is
 * what made "it never shows me the last message" reproducible rather than
 * rare. A `scroll` event carries no attribution, so the old code declared a
 * 400ms window after each programmatic scroll and treated anything later as
 * the reader. A smooth scroll across a long thread outlives that window —
 * so its own mid-flight events came back as "the reader scrolled to the
 * top", which switched stick-to-bottom off AND tripped the load-older-history
 * branch, whose position restore then cancelled the very animation that was
 * still running. Opening a channel, following a send, and jumping to a
 * notification's message all failed the same way, for that one reason.
 *
 * So intent is read from events only a person can produce — wheel, touch,
 * scroll keys, and a pointer held down on the scrollbar — and a pin to the
 * bottom re-asserts itself every frame for a moment instead of being written
 * once and hoped for.
 */
export function MessageList({
  channelId,
  flag,
  search,
  viewerRole,
  canPin = false,
  canConvertToItem = false,
  canConvertToFormal = false,
  currentUserId,
  onReply,
  // { messageId, nonce } — the nonce lets the same message be jumped to
  // repeatedly, which a plain id could not trigger twice in a row.
  jumpRequest = null,
  // Incrementing counter bumped by the composer after a successful send.
  scrollRequest = 0,
}) {
  const {
    messages,
    isLoading,
    hasMoreHistory,
    isLoadingMoreHistory,
    loadMoreHistory,
    togglePin,
    editMessage,
    deleteMessage,
    markRead,
    convertMessage,
  } = useChatMessages(channelId, { flag, q: search });
  const { markRead: markNotificationsRead } = useNotifications();

  const containerRef = useRef(null);
  // Wrapper around the rows; the ResizeObserver below watches this one node
  // so content growth (an image finishing) is detected without re-observing
  // every row on every render.
  const contentRef = useRef(null);
  const endRef = useRef(null);
  const prevLengthRef = useRef(0);
  const prevLastMessageIdRef = useRef(null);
  // The reader is following the live end of the conversation. True until they
  // scroll up themselves; nothing the component does to the scroll position
  // may flip it.
  const stickToBottomRef = useRef(true);
  // False until the view has actually been pinned to the bottom at least once
  // for this thread. Gates history loading — see the class comment.
  const settledRef = useRef(false);
  // True while WE are moving the scroll position. Nothing that infers reader
  // intent may act while it is set — above all the load-older-history branch,
  // whose position restore used to cancel a scroll still in flight.
  const autoScrollingRef = useRef(false);
  // When the reader last did something that only a person can do. This, not a
  // timer around our own calls, is what attributes a scroll event.
  const lastGestureAtRef = useRef(0);
  // A scrollbar drag emits no wheel or touch event at all, so the button being
  // held counts as a gesture for its whole duration.
  const pointerDownRef = useRef(false);

  const [highlightedId, setHighlightedId] = useState(null);
  // Message to return to after jumping up to a quoted reply — cleared once
  // the user actually jumps back (or switches channels/reply targets again).
  const [jumpBackId, setJumpBackId] = useState(null);
  // "New messages" pill — shown when the user scrolled up and new content
  // arrived at the bottom.
  const [showScrollButton, setShowScrollButton] = useState(false);
  // True while the jump handler is paging backwards looking for a message.
  const [isSeeking, setIsSeeking] = useState(false);

  // Jump bookkeeping, computed during render so the auto-scroll effect (which
  // runs BEFORE the jump effect in the same commit) can see that a jump is
  // about to happen and stand aside.
  const handledJumpNonceRef = useRef(null);
  const pendingJumpRef = useRef(false);
  pendingJumpRef.current =
    !!jumpRequest?.nonce && jumpRequest.nonce !== handledJumpNonceRef.current;

  // ── channel / filter switch → back to following the end ────────────
  // The filter and the search term count as a switch: each is a different
  // query, i.e. a different thread, and must open at its own bottom.
  useEffect(() => {
    stickToBottomRef.current = true;
    settledRef.current = false;
    autoScrollingRef.current = false;
    lastGestureAtRef.current = 0;
    setShowScrollButton(false);
    setJumpBackId(null);
    prevLengthRef.current = 0;
    prevLastMessageIdRef.current = null;
  }, [channelId, flag, search]);

  // ── who is scrolling ───────────────────────────────────────────────
  // Every event below is one a person has to perform. `scroll` is deliberately
  // NOT among them: the browser fires it identically for a flick of the wrist
  // and for an assignment to scrollTop, and telling those apart is the whole
  // problem this component had.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const note = () => {
      lastGestureAtRef.current = Date.now();
    };
    const onPointerDown = () => {
      pointerDownRef.current = true;
      note();
    };
    const onPointerUp = () => {
      // Only the release of a press that STARTED in the thread. Listening on
      // the window is what lets a scrollbar drag ending off-target still
      // count — but taken unconditionally it also made every tap on Send, on
      // a channel, on any button anywhere read as "the reader is scrolling",
      // which then called off the very pin that tap had just asked for.
      if (!pointerDownRef.current) return;
      pointerDownRef.current = false;
      note();
    };
    const onKeyDown = (event) => {
      if (SCROLL_KEYS.has(event.key)) note();
    };

    el.addEventListener("wheel", note, { passive: true });
    el.addEventListener("touchstart", note, { passive: true });
    el.addEventListener("touchmove", note, { passive: true });
    el.addEventListener("pointerdown", onPointerDown, { passive: true });
    el.addEventListener("keydown", onKeyDown);
    // The release of a scrollbar drag routinely lands outside the thread, so
    // it is watched on the window rather than on the container.
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });
    return () => {
      el.removeEventListener("wheel", note);
      el.removeEventListener("touchstart", note);
      el.removeEventListener("touchmove", note);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  const readerIsDriving = useCallback(
    () =>
      pointerDownRef.current ||
      Date.now() - lastGestureAtRef.current < USER_GESTURE_MS,
    [],
  );

  // ── pin to bottom ──────────────────────────────────────────────────
  //
  // `force` is for scrolls the reader explicitly asked for — sending a
  // message, tapping "New messages", opening a channel. Those must land even
  // if the reader was scrolling a moment ago; only a gesture made AFTER the
  // pin started calls them off.
  const pinToBottom = useCallback(
    ({ force = false, durationMs = PIN_SETTLE_MS } = {}) => {
      const startedAt = Date.now();
      const abortOnGestureAfter = force
        ? startedAt
        : startedAt - USER_GESTURE_MS;
      const deadline = startedAt + durationMs;
      autoScrollingRef.current = true;

      // Re-asserted every frame rather than written once. The thread keeps
      // growing after the scroll lands — an image decodes, the font swaps, the
      // refetch delivers the message just sent — and a single write leaves the
      // reader exactly that far short of the end. Writing a scrollTop that is
      // already correct costs nothing.
      const step = () => {
        const el = containerRef.current;
        if (!el) {
          autoScrollingRef.current = false;
          return;
        }
        // The reader took over. Never fight a person's own scroll.
        if (
          pointerDownRef.current ||
          lastGestureAtRef.current > abortOnGestureAfter
        ) {
          autoScrollingRef.current = false;
          return;
        }
        // A pane that is still display:none — the phone layout opens on the
        // channel list, with the conversation hidden beside it — reports zero
        // height, and "scroll to the end" of a box with no height is a no-op.
        // Keep waiting rather than declare the thread settled at a position it
        // never actually took.
        if (el.clientHeight > 0) {
          el.scrollTop = el.scrollHeight;
          // "Settled" has to mean the thread genuinely reached its end, not that
          // a write was attempted. Content still arriving clamps the write short
          // of the bottom, and calling that settled is how a channel came up
          // parked in the middle of its own history with nothing left to pull it
          // down. It also gates history loading.
          if (el.scrollHeight - el.scrollTop - el.clientHeight < 2) {
            settledRef.current = true;
          }
        }
        if (Date.now() < deadline) {
          requestAnimationFrame(step);
        } else {
          autoScrollingRef.current = false;
        }
      };
      // The first frame waits for React's commit, the rest for layout.
      requestAnimationFrame(step);
    },
    [],
  );

  // Hold `autoScrollingRef` until a smooth scroll actually comes to rest.
  // The old code guessed 400ms. A smooth scroll across a long thread takes
  // longer, and the moment the guess expired its own in-flight events were
  // read as "the reader jumped to the top" — which loaded older history and
  // yanked the view off the message it was travelling to.
  const holdUntilScrollSettles = useCallback(() => {
    const startedAt = Date.now();
    autoScrollingRef.current = true;
    let previousTop = null;
    let stableFrames = 0;
    const tick = () => {
      const el = containerRef.current;
      if (
        !el ||
        pointerDownRef.current ||
        lastGestureAtRef.current > startedAt ||
        Date.now() - startedAt > AUTO_SCROLL_MAX_MS
      ) {
        autoScrollingRef.current = false;
        return;
      }
      stableFrames = el.scrollTop === previousTop ? stableFrames + 1 : 0;
      previousTop = el.scrollTop;
      // Three identical frames means the animation has finished rather than
      // merely paused between steps.
      if (stableFrames >= 3) {
        autoScrollingRef.current = false;
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, []);

  // ── follow the conversation ────────────────────────────────────────
  useEffect(() => {
    if (messages.length === 0) return;
    // Don't act while the query is still resolving — scrollHeight would
    // reflect a half-rendered thread.
    if (isLoading) return;

    const lastMessage = messages[messages.length - 1];
    const lastId = lastMessage?._id;
    const lengthIncreased = messages.length > prevLengthRef.current;
    const isNewAtBottom = lastId !== prevLastMessageIdRef.current;
    const isFirstPaint = !settledRef.current;

    // Whether the newest message is the reader's own. Sending always wins over
    // "don't yank someone who is reading history": they just acted, so showing
    // them the result is what they asked for. Covers a second device too.
    const lastIsMine =
      !!currentUserId &&
      String(lastMessage?.authorUserId) === String(currentUserId);

    if (isFirstPaint) {
      // …unless a jump is queued for this commit. Clearing the header filters
      // to reach a pinned/deep-linked message changes the query key, which
      // counts as a fresh thread here; without this the two would race and the
      // reader would land at the bottom instead of on the message they clicked.
      if (pendingJumpRef.current) {
        settledRef.current = true;
      } else {
        stickToBottomRef.current = true;
        // Forced: opening a thread must land at its end even if the reader
        // was still scrolling the channel list a moment ago.
        pinToBottom({ force: true });
      }
    } else if (lengthIncreased && isNewAtBottom) {
      if (stickToBottomRef.current || lastIsMine) {
        stickToBottomRef.current = true;
        setShowScrollButton(false);
        pinToBottom({
          force: lastIsMine,
          durationMs: lastIsMine ? PIN_SETTLE_SEND_MS : PIN_SETTLE_MS,
        });
      } else {
        setShowScrollButton(true);
      }
    }

    prevLengthRef.current = messages.length;
    prevLastMessageIdRef.current = lastId;
  }, [messages, isLoading, currentUserId, pinToBottom]);

  // Explicit request from the composer. The effect above already covers the
  // usual case, but this fires the instant the mutation resolves rather than
  // waiting for the refetch, so the thread never appears to ignore a send.
  useEffect(() => {
    if (!scrollRequest) return;
    stickToBottomRef.current = true;
    setShowScrollButton(false);
    pinToBottom({ force: true, durationMs: PIN_SETTLE_SEND_MS });
  }, [scrollRequest, pinToBottom]);

  // Late layout, in both directions.
  //
  // Content growing: attachments, images and embedded previews resolve AFTER
  // the first paint and push the end of the thread below the viewport — that
  // is what made "open a channel with images" land halfway up.
  //
  // The viewport SHRINKING does the same damage and was the half this missed.
  // The composer is `shrink-0`, so every line the textarea gains, every
  // attachment chip, every reply banner takes its height out of the thread
  // below it. The content is anchored at scrollTop, so the last message slides
  // out of sight behind the input — "the message I just sent stays under the
  // input field". Nothing about the CONTENT changed there, which is why
  // watching only the rows never noticed.
  //
  // Watching the scroll box itself also covers the phone layout, where the
  // conversation is display:none beside the channel list until it is tapped:
  // a box with no height cannot be scrolled, so whatever the thread did while
  // hidden did nothing, and this is the moment it gets a size.
  useEffect(() => {
    const el = containerRef.current;
    const content = contentRef.current;
    if (!el || !content || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const node = containerRef.current;
      if (!node) return;
      // The thread has never actually reached its end for this channel. Try
      // again now that something has a size — this is the safety net that
      // makes "opens on the last message" unconditional rather than dependent
      // on one frame having landed at the right moment.
      if (!settledRef.current) {
        pinToBottom({ force: true });
        return;
      }
      if (!stickToBottomRef.current) return;
      // Not mid-drag: pinning under a finger that is actively scrolling fights
      // the person holding it. A gesture that has already ended is fine — they
      // let go at the bottom, so keeping them there is what they asked for.
      if (pointerDownRef.current) return;
      // Instant, so no guard window: the echo event this causes lands at the
      // bottom and simply re-confirms stick-to-bottom.
      node.scrollTop = node.scrollHeight;
    });
    // One observation on the content wrapper, not one per message row: the
    // wrapper's identity is stable, so this hooks up once per mount instead of
    // re-registering 50 observations every time a message arrives.
    observer.observe(content);
    observer.observe(el);
    return () => observer.disconnect();
  }, [pinToBottom]);

  // The on-screen keyboard does not resize anything the observer above can
  // see: on iOS the layout viewport keeps its full height and the keyboard is
  // simply drawn over the bottom of it, thread and composer included. The
  // visual viewport is the only thing that reports it.
  useEffect(() => {
    const viewport =
      typeof window !== "undefined" ? window.visualViewport : null;
    if (!viewport) return;
    const onResize = () => {
      const el = containerRef.current;
      if (!el || !stickToBottomRef.current || pointerDownRef.current) return;
      el.scrollTop = el.scrollHeight;
    };
    viewport.addEventListener("resize", onResize);
    return () => viewport.removeEventListener("resize", onResize);
  }, []);

  // Viewing the thread marks it read. Two separate systems get cleared here:
  // ChatRead (drives the per-channel unreadCount in ChannelSidebar) and the
  // bell's own Notification records (drives the "Chat" category in
  // NotificationBell) — they track different things and neither implies the
  // other.
  //
  // Keyed on the newest message id, not on messages.length: length also
  // changes when older history is paged in, and each of those prepends was
  // firing two writes plus two cache invalidations for a thread that had not
  // received anything new.
  const lastReadIdRef = useRef(null);
  const markThreadRead = useCallback(() => {
    if (!channelId || messages.length === 0) return;
    // A backgrounded tab must not clear someone's unread badge — they have not
    // actually seen anything.
    if (typeof document !== "undefined" && document.hidden) return;
    const lastId = messages[messages.length - 1]?._id;
    if (!lastId || lastReadIdRef.current === lastId) return;
    lastReadIdRef.current = lastId;
    markRead.mutate(undefined);
    markNotificationsRead.mutate({ channelId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, messages]);

  useEffect(() => {
    markThreadRead();
  }, [markThreadRead]);

  // Coming back to the tab counts as seeing the thread. Without this, messages
  // that arrived while the tab was hidden would stay marked unread until the
  // NEXT one landed — the guard above would keep declining, and nothing else
  // re-runs when visibility alone changes.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisible = () => {
      if (!document.hidden) markThreadRead();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [markThreadRead]);

  useEffect(() => {
    lastReadIdRef.current = null;
  }, [channelId]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = dist < NEAR_BOTTOM_PX;

    if (nearBottom) {
      // Arriving at the end always means "following", whoever caused it.
      stickToBottomRef.current = true;
      setShowScrollButton(false); // reader caught up → dismiss pill
    } else if (readerIsDriving()) {
      // Only a scroll the READER performed ends stick-to-bottom. Our own —
      // a pin, a jump, the anchor restore after a prepend — must not, however
      // long it takes to finish.
      stickToBottomRef.current = false;
    }

    // ── infinite scroll upward ────────────────────────────────────
    // Three conditions, each of which was a bug on its own:
    //  - settled: on open scrollTop is legitimately 0 for a frame or two, and
    //    treating that as "show me older messages" dropped people into the
    //    middle of the conversation;
    //  - not auto-scrolling: a scroll of ours still travelling past the top is
    //    not a request for history, and the position restore below would
    //    cancel it;
    //  - reader driving: history is loaded because a person scrolled up to
    //    look for it, never because a number happened to be small.
    if (
      settledRef.current &&
      !autoScrollingRef.current &&
      readerIsDriving() &&
      !isLoadingMoreHistory &&
      hasMoreHistory &&
      el.scrollTop < LOAD_MORE_AT_PX
    ) {
      const prevHeight = el.scrollHeight;
      const prevTop = el.scrollTop;
      loadMoreHistory().then(() => {
        requestAnimationFrame(() => {
          const node = containerRef.current;
          if (!node) return;
          // Keep whatever the reader was looking at exactly where it was:
          // the content grew above them by (new - old), so their offset moves
          // by the same amount. Anchoring to 0 instead of prevTop drifted the
          // view a little further up with every page.
          autoScrollingRef.current = true;
          node.scrollTop = node.scrollHeight - prevHeight + prevTop;
          // The scroll event this causes is dispatched before the next frame's
          // callbacks, so one frame of cover is exactly enough.
          requestAnimationFrame(() => {
            autoScrollingRef.current = false;
          });
        });
      });
    }
  }, [hasMoreHistory, isLoadingMoreHistory, loadMoreHistory, readerIsDriving]);

  // Scrolls to a message already rendered in the current page of history.
  const scrollToMessage = useCallback(
    (id) => {
      const el = containerRef.current?.querySelector(
        `[data-message-id="${id}"]`,
      );
      if (!el) return false;
      // Jumping away from the end means the reader is no longer following live;
      // without this the ResizeObserver would drag them back down.
      stickToBottomRef.current = false;
      settledRef.current = true;
      // Held for as long as the animation actually runs. This is the guard a
      // notification deep-link was missing: the jump travels a long way, and
      // the old fixed window expired mid-flight, at which point the thread
      // loaded older history and threw the reader off the target.
      holdUntilScrollSettles();
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedId(id);
      setTimeout(() => {
        setHighlightedId((current) => (current === id ? null : current));
      }, 1500);
      return true;
    },
    [holdUntilScrollSettles],
  );

  const handleJumpToReply = useCallback(
    (targetMessageId, fromMessageId) => {
      setJumpBackId(fromMessageId);
      scrollToMessage(targetMessageId);
    },
    [scrollToMessage],
  );

  // Refs so the async walker below always sees current values instead of the
  // booleans captured when the effect first ran.
  const hasMoreHistoryRef = useRef(hasMoreHistory);
  hasMoreHistoryRef.current = hasMoreHistory;
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;
  const messageCountRef = useRef(messages.length);
  messageCountRef.current = messages.length;

  // Jump requested from outside the thread: the pinned bar, or a notification
  // deep-link (`?channel=…&m=…`). If the target is not in the DOM yet, page
  // backwards until it appears or history runs out — a pinned message from
  // last week used to produce nothing but a toast.
  useEffect(() => {
    if (!jumpRequest?.messageId) return;
    const targetId = jumpRequest.messageId;
    // Claim the nonce immediately: from here on the follow effect is free to
    // behave normally again (a prepend never pins to the bottom anyway).
    handledJumpNonceRef.current = jumpRequest.nonce;
    let cancelled = false;

    const tick = () => new Promise((r) => setTimeout(r, 80));

    const run = async () => {
      // The request can arrive before the first page has resolved (a
      // notification click opens the channel and asks for the message in the
      // same breath). Wait for the thread to exist before deciding it is
      // missing, otherwise every deep link would toast "further back".
      for (let i = 0; i < 40 && !cancelled; i++) {
        if (!isLoadingRef.current && messageCountRef.current > 0) break;
        await tick();
      }
      if (cancelled) return;
      if (scrollToMessage(targetId)) return;

      setIsSeeking(true);
      try {
        stickToBottomRef.current = false;
        settledRef.current = true;

        let pages = 0;
        while (
          hasMoreHistoryRef.current &&
          !cancelled &&
          pages < MAX_JUMP_PAGES
        ) {
          pages++;
          await loadMoreHistory();
          await tick(); // let React commit the new page
          if (cancelled) return;
          if (scrollToMessage(targetId)) return;
        }
        if (!cancelled) {
          toast("That message isn't in this conversation's history", {
            icon: "↑",
          });
        }
      } finally {
        if (!cancelled) setIsSeeking(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpRequest?.nonce]);

  const handleJumpBack = useCallback(() => {
    if (!jumpBackId) return;
    const target = jumpBackId;
    setJumpBackId(null);
    scrollToMessage(target);
  }, [jumpBackId, scrollToMessage]);

  const handleScrollToBottom = useCallback(() => {
    stickToBottomRef.current = true;
    pinToBottom({ force: true });
    setShowScrollButton(false);
  }, [pinToBottom]);

  // Stable handler identities — MessageBubble is memoized and a fresh closure
  // per row would defeat it. Each takes the message id as an argument instead
  // of closing over it.
  const handleTogglePin = useCallback(
    (vars) => togglePin.mutate(vars),
    [togglePin],
  );
  const handleEdit = useCallback(
    (vars) => editMessage.mutate(vars),
    [editMessage],
  );
  const handleDelete = useCallback(
    (id) => deleteMessage.mutate(id),
    [deleteMessage],
  );
  const handleConvert = useCallback(
    (vars) => convertMessage.mutateAsync(vars),
    [convertMessage],
  );

  return (
    // min-h-0 (not a px floor) so this pane can actually shrink inside its
    // flex column. With a floor, a growing composer pushed the column past the
    // viewport and the input slid off the bottom of the screen on a phone.
    <div className="relative flex-1 min-h-0 flex flex-col">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overscroll-contain"
      >
        <div ref={contentRef} className="px-4 py-4 space-y-3">
          {(isLoadingMoreHistory || isSeeking) && (
            <div className="flex justify-center py-2">
              <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
            </div>
          )}
          {isLoading ? (
            <p className="text-gray-500 text-sm text-center py-8">Loading…</p>
          ) : messages.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">
              No messages yet. Say hello!
            </p>
          ) : (
            messages.map((m) => (
              <MessageBubble
                key={m._id}
                message={m}
                isMine={m.authorUserId === currentUserId}
                canModerate={viewerRole === "admin"}
                canPin={canPin}
                canConvertToItem={canConvertToItem}
                canConvertToFormal={canConvertToFormal}
                highlighted={highlightedId === m._id}
                onReply={onReply}
                onJumpToReply={handleJumpToReply}
                onTogglePin={handleTogglePin}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onConvert={handleConvert}
              />
            ))
          )}
          <div ref={endRef} />
        </div>
      </div>

      {/* "New messages" pill — only when user scrolled up & new content arrived */}
      {showScrollButton && (
        <button
          type="button"
          onClick={handleScrollToBottom}
          className="absolute bottom-3 right-4 z-10 flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#FFB633] text-black text-xs font-medium shadow-lg hover:bg-[#e5a32e] transition-all animate-bounce"
        >
          <ArrowDown className="w-3.5 h-3.5" />
          New messages
        </button>
      )}

      {/* Jump-back pill — don't overlap with the "New messages" pill */}
      {jumpBackId && !showScrollButton && (
        <button
          type="button"
          onClick={handleJumpBack}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#FFB633] text-black text-xs font-medium shadow-lg hover:bg-[#e5a32e] transition-colors"
        >
          <ArrowDown className="w-3.5 h-3.5" /> Back to reply
        </button>
      )}
    </div>
  );
}

export default MessageList;
