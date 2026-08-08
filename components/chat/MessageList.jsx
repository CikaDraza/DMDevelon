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
// Safety cap for the jump-to-message history walk: 20 pages × 50 = 1000
// messages back. Past that, ask the reader to scroll rather than hammering
// the API.
const MAX_JUMP_PAGES = 20;

/**
 * Scrolling thread with backward pagination: scrolling near the top loads
 * older history (useChatMessages' `before` cursor) and the scroll position is
 * preserved across that prepend, instead of jumping.
 *
 * Scroll contract (this is the part users actually notice):
 *  - Opening a channel lands on the LAST message, every time — including when
 *    the page was served from cache and when attachments finish loading after
 *    the first paint.
 *  - Sending a message always scrolls to the bottom, even if you had scrolled
 *    up to re-read something before typing.
 *  - Someone else's message while you are reading history does NOT yank you
 *    down; it raises the "New messages" pill instead.
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
  const isInitialLoadRef = useRef(true);
  // While true, late layout changes (an image finishing, a font swapping) keep
  // the view pinned to the newest message.
  const isNearBottomRef = useRef(true);
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

  // ── channel / filter switch → reset everything ─────────────────────
  // The filter and the search term are part of this: each produces a
  // different React Query key, i.e. a different thread of messages, and the
  // view must land at its bottom just like a channel switch does. Resetting
  // prevLengthRef matters too — leaving a previous channel's 50 behind made
  // the first genuinely-new message in a short channel look like a prepend.
  useEffect(() => {
    isInitialLoadRef.current = true;
    isNearBottomRef.current = true;
    setShowScrollButton(false);
    setJumpBackId(null);
    prevLengthRef.current = 0;
    prevLastMessageIdRef.current = null;
  }, [channelId, flag, search]);

  // ── scroll-to-bottom helper ────────────────────────────────────────
  const scrollToBottom = useCallback((smooth = false) => {
    // Double rAF: the first waits for React's commit, the second for the
    // browser to finish layout. A single rAF often fires before the DOM is
    // laid out, landing the "initial" scroll somewhere mid-thread.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = containerRef.current;
        if (!el) return;
        if (smooth) {
          el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        } else {
          el.scrollTop = el.scrollHeight;
        }
      });
    });
  }, []);

  // ── smart auto-scroll ──────────────────────────────────────────────
  // Compares both message count AND the last message id so a history prepend
  // (more messages at the top, same last id) is not mistaken for a new
  // message arriving at the bottom.
  useEffect(() => {
    if (messages.length === 0) return;

    // Don't consume the one-shot initial scroll while the query is still
    // resolving — scrollHeight would reflect a half-rendered thread.
    if (isLoading) return;

    const lastMessage = messages[messages.length - 1];
    const lastId = lastMessage?._id;
    const lengthIncreased = messages.length > prevLengthRef.current;
    const isNewAtBottom = lastId !== prevLastMessageIdRef.current;
    const isFirstPaint = isInitialLoadRef.current;

    // Whether the newest message is the viewer's own. Sending must always win
    // over the "don't yank someone who is reading history" rule: they just
    // acted, so showing them the result is what they asked for. This also
    // covers sending from a second device.
    const lastIsMine =
      !!currentUserId &&
      String(lastMessage?.authorUserId) === String(currentUserId);

    if (isFirstPaint) {
      // …unless a jump is already queued for this commit. Clearing the header
      // filters to reach a pinned/deep-linked message changes the query key,
      // which counts as a fresh thread here — without this guard the two would
      // race and the reader would be dropped at the bottom instead of on the
      // message they clicked.
      if (!pendingJumpRef.current) {
        scrollToBottom(false);
        isNearBottomRef.current = true;
      }
      isInitialLoadRef.current = false;
    } else if (lengthIncreased && isNewAtBottom) {
      if (isNearBottomRef.current || lastIsMine) {
        isNearBottomRef.current = true;
        setShowScrollButton(false);
        scrollToBottom(true);
      } else {
        setShowScrollButton(true);
      }
    }

    prevLengthRef.current = messages.length;
    prevLastMessageIdRef.current = lastId;
  }, [messages, isLoading, currentUserId, scrollToBottom]);

  // Explicit request from the composer. The effect above already handles the
  // usual case, but this fires the instant the mutation resolves rather than
  // waiting for the refetch, so the thread never appears to ignore a send.
  useEffect(() => {
    if (!scrollRequest) return;
    isNearBottomRef.current = true;
    setShowScrollButton(false);
    scrollToBottom(true);
  }, [scrollRequest, scrollToBottom]);

  // Late layout: attachments, images and embedded previews resolve AFTER the
  // first paint and grow the thread underneath the viewport, which is what
  // made "open a channel with images" land halfway up. Re-pin to the bottom
  // while the reader is still following along; the moment they scroll up,
  // isNearBottomRef goes false and this stops touching their position.
  useEffect(() => {
    const el = containerRef.current;
    const content = contentRef.current;
    if (!el || !content || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (isNearBottomRef.current) {
        el.scrollTop = el.scrollHeight;
      }
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

    // ── near-bottom detection ────────────────────────────────────
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = dist < NEAR_BOTTOM_PX;
    isNearBottomRef.current = nearBottom;

    if (nearBottom) {
      setShowScrollButton(false); // user caught up → dismiss pill
    }

    // ── infinite scroll upward ────────────────────────────────────
    if (
      !isLoadingMoreHistory &&
      hasMoreHistory &&
      el.scrollTop < LOAD_MORE_AT_PX
    ) {
      const prevHeight = el.scrollHeight;
      loadMoreHistory().then(() => {
        requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.scrollTop =
              containerRef.current.scrollHeight - prevHeight;
          }
        });
      });
    }
  }, [hasMoreHistory, isLoadingMoreHistory, loadMoreHistory]);

  // Scrolls to a message already rendered in the current page of history.
  const scrollToMessage = useCallback((id) => {
    const el = containerRef.current?.querySelector(`[data-message-id="${id}"]`);
    if (!el) return false;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Jumping away from the bottom means the reader is no longer following
    // live; without this the ResizeObserver above would drag them back down.
    isNearBottomRef.current = false;
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
    // Claim the nonce immediately: from here on the auto-scroll effect is free
    // to behave normally again (a prepend never scrolls to the bottom anyway).
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
        // Sit at the top so the loader below is the only thing moving the
        // scroll position while we page back.
        if (containerRef.current) containerRef.current.scrollTop = 0;

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
    isNearBottomRef.current = true;
    scrollToBottom(true);
    setShowScrollButton(false);
  }, [scrollToBottom]);

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
    <div className="relative flex-1 min-h-[200px] flex flex-col">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
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
