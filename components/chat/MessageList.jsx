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
// How long after a programmatic scroll to ignore scroll events for intent
// detection. Smooth scrolling emits events for a while after the call, and
// treating those as "the user scrolled" is what breaks stick-to-bottom.
const PROGRAMMATIC_SCROLL_MS = 400;
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
 * can end stick-to-bottom mode (`programmaticUntilRef`).
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
  // Scroll events before this timestamp came from us, not from the reader.
  const programmaticUntilRef = useRef(0);

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
    programmaticUntilRef.current = 0;
    setShowScrollButton(false);
    setJumpBackId(null);
    prevLengthRef.current = 0;
    prevLastMessageIdRef.current = null;
  }, [channelId, flag, search]);

  // ── pin to bottom ──────────────────────────────────────────────────
  const pinToBottom = useCallback((smooth = false) => {
    // A smooth scroll keeps emitting scroll events for a few hundred ms after
    // the call returns; reading intent out of those would flip stick-to-bottom
    // off mid-animation. An INSTANT scroll lands in one go, so it needs no
    // window at all — and must not have one, or a reader who scrolls up right
    // after opening the channel would be ignored.
    if (smooth) {
      programmaticUntilRef.current = Date.now() + PROGRAMMATIC_SCROLL_MS;
    }
    // Double rAF: the first waits for React's commit, the second for the
    // browser to finish layout. A single rAF often fires before the DOM is
    // laid out, landing the scroll somewhere mid-thread.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = containerRef.current;
        if (!el) return;
        if (smooth) {
          programmaticUntilRef.current = Date.now() + PROGRAMMATIC_SCROLL_MS;
          el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        } else {
          el.scrollTop = el.scrollHeight;
          programmaticUntilRef.current = 0;
        }
        // Only now is history loading allowed: the view is where it belongs.
        settledRef.current = true;
      });
    });
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
        pinToBottom(false);
      }
    } else if (lengthIncreased && isNewAtBottom) {
      if (stickToBottomRef.current || lastIsMine) {
        stickToBottomRef.current = true;
        setShowScrollButton(false);
        pinToBottom(true);
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
    pinToBottom(true);
  }, [scrollRequest, pinToBottom]);

  // Late layout: attachments, images and embedded previews resolve AFTER the
  // first paint and grow the thread underneath the viewport, which is what
  // made "open a channel with images" land halfway up. Keep the end in view
  // while the reader is still following; the moment they scroll up,
  // stickToBottomRef goes false and this stops touching their position.
  useEffect(() => {
    const el = containerRef.current;
    const content = contentRef.current;
    if (!el || !content || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (!stickToBottomRef.current) return;
      // Instant, so no guard window: the echo event this causes lands at the
      // bottom and simply re-confirms stick-to-bottom.
      el.scrollTop = el.scrollHeight;
    });
    // One observation on the content wrapper, not one per message row: the
    // wrapper's identity is stable, so this hooks up once per mount instead of
    // re-registering 50 observations every time a message arrives.
    observer.observe(content);
    return () => observer.disconnect();
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

    // Our own scrolling, echoing back. Reading intent out of it is exactly how
    // stick-to-bottom used to be lost mid-animation.
    if (Date.now() < programmaticUntilRef.current) {
      if (nearBottom) setShowScrollButton(false);
      return;
    }

    stickToBottomRef.current = nearBottom;
    if (nearBottom) {
      setShowScrollButton(false); // reader caught up → dismiss pill
    }

    // ── infinite scroll upward ────────────────────────────────────
    // Never before the view has settled at the bottom: on open, scrollTop is
    // legitimately 0 for a frame or two, and treating that as "show me older
    // messages" is what dropped people into the middle of the conversation.
    if (
      settledRef.current &&
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
          programmaticUntilRef.current = Date.now() + PROGRAMMATIC_SCROLL_MS;
          node.scrollTop = node.scrollHeight - prevHeight + prevTop;
        });
      });
    }
  }, [hasMoreHistory, isLoadingMoreHistory, loadMoreHistory]);

  // Scrolls to a message already rendered in the current page of history.
  const scrollToMessage = useCallback((id) => {
    const el = containerRef.current?.querySelector(`[data-message-id="${id}"]`);
    if (!el) return false;
    programmaticUntilRef.current = Date.now() + PROGRAMMATIC_SCROLL_MS;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Jumping away from the end means the reader is no longer following live;
    // without this the ResizeObserver would drag them back down.
    stickToBottomRef.current = false;
    settledRef.current = true;
    setHighlightedId(id);
    setTimeout(() => {
      setHighlightedId((current) => (current === id ? null : current));
    }, 1500);
    return true;
  }, []);

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
    pinToBottom(true);
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
