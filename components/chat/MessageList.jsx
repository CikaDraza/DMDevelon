"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { useChatMessages } from "@/hooks/useProjectChat";
import { useNotifications } from "@/hooks/useNotifications";
import { MessageBubble } from "./MessageBubble";
import { ArrowDown, Loader2 } from "lucide-react";

/**
 * Scrolling thread with backward pagination: scrolling near the top loads
 * older history (useChatMessages' `before` cursor) and the scroll position is
 * preserved across that prepend, instead of jumping.
 *
 * Smart scroll behaviour (like real chat apps):
 *  - First load / channel switch → instant scroll to bottom.
 *  - New message arrives while you're near the bottom → smooth follow.
 *  - New message arrives while you're reading history → "New messages"
 *    button appears instead of yanking you down.
 *  - Manually scroll back to the bottom → button disappears, auto-follow
 *    resumes.
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
  const endRef = useRef(null);
  const prevLengthRef = useRef(0);
  const prevLastMessageIdRef = useRef(null);
  const isInitialLoadRef = useRef(true);
  const isNearBottomRef = useRef(true);
  const [highlightedId, setHighlightedId] = useState(null);
  // Message to return to after jumping up to a quoted reply — cleared once
  // the user actually jumps back (or switches channels/reply targets again).
  const [jumpBackId, setJumpBackId] = useState(null);
  // "New messages" pill — shown when the user scrolled up and new content
  // arrived at the bottom.
  const [showScrollButton, setShowScrollButton] = useState(false);

  // ── channel switch → reset everything ──────────────────────────────
  useEffect(() => {
    isInitialLoadRef.current = true;
    isNearBottomRef.current = true;
    setShowScrollButton(false);
    setJumpBackId(null);
    prevLastMessageIdRef.current = null;
  }, [channelId]);

  // ── scroll-to-bottom helper ────────────────────────────────────────
  const scrollToBottom = useCallback((smooth = false) => {
    // Wrap in rAF so scrollHeight reflects the just-rendered DOM.
    requestAnimationFrame(() => {
      const el = containerRef.current;
      if (!el) return;
      if (smooth) {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      } else {
        el.scrollTop = el.scrollHeight;
      }
    });
  }, []);

  // ── smart auto‑scroll ──────────────────────────────────────────────
  // Compares both message count AND the last message id so we don't
  // mistake a history prepend (more messages at the top, same last id)
  // for a new message arriving at the bottom.
  useEffect(() => {
    if (messages.length === 0) return;

    const lastId = messages[messages.length - 1]?._id;
    const lengthIncreased = messages.length > prevLengthRef.current;
    const isNewAtBottom = lastId !== prevLastMessageIdRef.current;

    if (isInitialLoadRef.current) {
      // First paint for this channel — instant jump to latest.
      scrollToBottom(false);
      isInitialLoadRef.current = false;
    } else if (lengthIncreased && isNewAtBottom) {
      if (isNearBottomRef.current) {
        scrollToBottom(true);
      } else {
        setShowScrollButton(true);
      }
    }

    prevLengthRef.current = messages.length;
    prevLastMessageIdRef.current = lastId;
  }, [messages.length, scrollToBottom]);

  // Viewing the thread marks it read. Simple and matches the existing
  // milestone-chat convention of marking read on open rather than tracking
  // per-message visibility. Two separate systems both get cleared here:
  // ChatRead (drives the per-channel unreadCount in ChannelSidebar) and the
  // bell's own Notification records (drives the "Chat" category in
  // NotificationBell) — they track different things and neither implies
  // the other.
  useEffect(() => {
    if (channelId && messages.length > 0) {
      markRead.mutate(undefined);
      markNotificationsRead.mutate({ channelId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, messages.length]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;

    // ── near‑bottom detection ────────────────────────────────────
    const threshold = 100; // px from the absolute bottom
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = dist < threshold;
    isNearBottomRef.current = nearBottom;

    if (nearBottom) {
      setShowScrollButton(false); // user caught up → dismiss pill
    }

    // ── infinite scroll upward ────────────────────────────────────
    if (!isLoadingMoreHistory && hasMoreHistory && el.scrollTop < 80) {
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
  };

  // Scrolls to a message already rendered in the current page of history.
  // A quote pointing at an older, not-yet-paginated-in message simply does
  // nothing here — a known limitation, not a crash.
  const scrollToMessage = (id) => {
    const el = containerRef.current?.querySelector(`[data-message-id="${id}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedId(id);
    setTimeout(() => {
      setHighlightedId((current) => (current === id ? null : current));
    }, 1500);
  };

  const handleJumpToReply = (fromMessageId, targetMessageId) => {
    setJumpBackId(fromMessageId);
    scrollToMessage(targetMessageId);
  };

  // Jump requested from outside the thread (the pinned bar). Same limitation
  // as a reply quote: a message far enough back that it has not been
  // paginated in yet cannot be scrolled to, so say so rather than doing
  // nothing silently.
  useEffect(() => {
    if (!jumpRequest?.messageId) return;
    const el = containerRef.current?.querySelector(
      `[data-message-id="${jumpRequest.messageId}"]`,
    );
    if (el) {
      scrollToMessage(jumpRequest.messageId);
    } else {
      toast("That message is further back — scroll up to load older history", {
        icon: "↑",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpRequest?.nonce]);

  const handleJumpBack = () => {
    if (!jumpBackId) return;
    const target = jumpBackId;
    setJumpBackId(null);
    scrollToMessage(target);
  };

  const handleScrollToBottom = () => {
    scrollToBottom(true);
    setShowScrollButton(false);
  };

  return (
    <div className="relative flex-1 min-h-[200px] flex flex-col">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
      >
        {isLoadingMoreHistory && (
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
              onJumpToReply={(targetId) => handleJumpToReply(m._id, targetId)}
              onTogglePin={(vars) => togglePin.mutate(vars)}
              onEdit={(vars) => editMessage.mutate(vars)}
              onDelete={(id) => deleteMessage.mutate(id)}
              onConvert={(vars) => convertMessage.mutateAsync(vars)}
            />
          ))
        )}
        <div ref={endRef} />
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
