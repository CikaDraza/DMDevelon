"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import {
  useChatChannels,
  usePrefetchChannelMessages,
} from "@/hooks/useProjectChat";
import { ChannelSidebar } from "./ChannelSidebar";
import { ChatHeader } from "./ChatHeader";
import { PinnedBar } from "./PinnedBar";
import { MessageList } from "./MessageList";
import { MessageComposer } from "./MessageComposer";
import { TeamPanel } from "./TeamPanel";
import { ProjectItemsPanel } from "./ProjectItemsPanel";
import { Loader2, MessageSquare } from "lucide-react";

/**
 * Shell for the whole Communication Hub — shared between the client
 * dashboard and the admin dashboard, distinguished only by `viewerRole`
 * (drives bubble alignment/moderation client-side; the server is the actual
 * authority on every permission).
 */
export function ProjectChat({
  viewerRole = "client",
  initialChannelId = null,
  // A notification links at one MESSAGE, not just its channel. Latched below
  // rather than read straight from props — see `deepLinkMessageId`.
  initialMessageId = null,
}) {
  const { user } = useAuth();
  const { channels, isLoading, startDirectMessage } = useChatChannels();
  const router = useRouter();
  const pathname = usePathname();
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [flagFilter, setFlagFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [teamPanelProjectId, setTeamPanelProjectId] = useState(null);
  const [itemsPanelOpen, setItemsPanelOpen] = useState(false);
  // Carries a jump from the pinned bar (or a notification) down into the
  // thread. The nonce makes clicking the same message twice in a row work.
  const [jumpRequest, setJumpRequest] = useState(null);
  // Bumped whenever the viewer sends a message, so the thread scrolls to the
  // bottom even if they had scrolled up to read history first.
  const [scrollRequest, setScrollRequest] = useState(0);
  // Below md: only one pane shows at a time (sidebar or conversation), full
  // width. At md and up both panes show side by side regardless of this —
  // see the "md:flex"/"md:w-64" overrides on each pane below.
  const [mobileView, setMobileView] = useState("list");

  // Opening a channel populates its latest page in the background, so the
  // FIRST click on any other channel paints from cache instead of a spinner.
  usePrefetchChannelMessages(channels);

  // Tracks the last seen initialChannelId so we can detect when an external
  // navigation (notification click, deep link) changes it and force-switch
  // even when a channel is already selected.
  const prevInitialRef = useRef(initialChannelId);

  // The deep-linked message id is LATCHED, never read live from props. The URL
  // sync effect below rewrites the address bar to `?channel=…` (dropping `m`),
  // which re-renders this component with `initialMessageId: null` — the same
  // class of bug that made the invite page reject a valid token when it
  // cleaned its own URL. Adopt a new id, never let one be taken away.
  const [deepLinkMessageId, setDeepLinkMessageId] = useState(initialMessageId);
  useEffect(() => {
    if (initialMessageId && initialMessageId !== deepLinkMessageId) {
      setDeepLinkMessageId(initialMessageId);
    }
  }, [initialMessageId, deepLinkMessageId]);

  // Default to the deep-linked channel (a notification's ?channel=) if it's
  // one this viewer actually has, else the first channel in the list.
  //
  // Two entry paths:
  // 1. First mount / fresh channel list → pick deep-linked or first channel.
  // 2. External navigation (notification click while chat is already open)
  //    → force-switch to the new deep link, because the user's intent is
  //    clear — they clicked a link — and the old selection is stale.
  // The poll refreshing `channels` every 15s must NOT keep snapping
  // selection back to the deep link (covered by path 1's early return when
  // activeChannelId is already set AND initialChannelId hasn't changed).
  useEffect(() => {
    if (channels.length === 0) return;

    // Path 2 — the deep link changed from what it was last render. This
    // means the user clicked a notification (or navigated externally) while
    // already viewing the chat. Force-switch to the new channel.
    if (initialChannelId && initialChannelId !== prevInitialRef.current) {
      prevInitialRef.current = initialChannelId;
      const exists = channels.some((c) => c._id === initialChannelId);
      if (exists) {
        setActiveChannelId(initialChannelId);
        return;
      }
    }

    // Path 1 — nothing selected yet; pick deep-linked or first channel.
    if (activeChannelId) return;
    const deepLinked =
      initialChannelId && channels.some((c) => c._id === initialChannelId);
    setActiveChannelId(deepLinked ? initialChannelId : channels[0]._id);
  }, [channels, activeChannelId, initialChannelId]);

  // Hand the latched message id down to the thread once its channel is the
  // one on screen. A filter or a search left over from another channel would
  // hide the target message from the very query that has to find it, so both
  // are cleared first — a deep link must land on its message, not on an
  // "0 results" view of it.
  const consumedDeepLinkRef = useRef(null);
  useEffect(() => {
    if (!deepLinkMessageId || !activeChannelId) return;
    if (consumedDeepLinkRef.current === deepLinkMessageId) return;
    if (initialChannelId && initialChannelId !== activeChannelId) return;
    consumedDeepLinkRef.current = deepLinkMessageId;
    setFlagFilter("all");
    setSearch("");
    setJumpRequest({ messageId: deepLinkMessageId, nonce: Date.now() });
  }, [deepLinkMessageId, activeChannelId, initialChannelId]);

  // Sync the active channel to the URL so the user can see which channel
  // they're in and share / bookmark the link. Admin page manages its own
  // tab-based URL, so this only runs on the dedicated /dashboard/chat page.
  //
  // Guarded by a ref: `router.replace` re-renders this component, and an
  // unguarded effect would then replace again on the identical URL, which is
  // a wasted render on every poll tick.
  const syncedUrlRef = useRef(null);
  useEffect(() => {
    if (pathname !== "/dashboard/chat" || !activeChannelId) return;
    const next = `/dashboard/chat?channel=${activeChannelId}`;
    if (syncedUrlRef.current === next) return;
    syncedUrlRef.current = next;
    router.replace(next, { scroll: false });
  }, [activeChannelId, pathname, router]);

  // Switching conversations abandons any in-progress reply — replying across
  // channels makes no sense (the quoted message wouldn't even be there) — and
  // resets the header filters. A "Problem"-only filter or a stale search term
  // carried into the next channel is the difference between "this channel is
  // empty" and "you are looking at a filtered view of it"; several reports of
  // messages "not loading" were exactly that.
  useEffect(() => {
    setReplyTo(null);
    setFlagFilter("all");
    setSearch("");
  }, [activeChannelId]);

  const activeChannel = useMemo(
    () => channels.find((c) => c._id === activeChannelId) || null,
    [channels, activeChannelId],
  );

  // Every handler below is memoized: they are passed to the sidebar, header,
  // thread and composer, and a fresh function identity on each 15s channel
  // poll would re-render all of them for nothing.
  const handleSelectChannel = useCallback((id) => {
    setActiveChannelId(id);
    setMobileView("chat");
  }, []);

  const handleStartDirectMessage = useCallback(
    async ({ projectId, userId }) => {
      try {
        const channel = await startDirectMessage.mutateAsync({
          projectId,
          userId,
        });
        setActiveChannelId(channel._id);
        setMobileView("chat");
      } catch {
        // useChatChannels' mutation surfaces its own error state; nothing
        // further to do here than not switch channels.
      }
    },
    [startDirectMessage],
  );

  // Jumping to a pinned message clears the header filters first, for the same
  // reason the notification deep-link does: with "Problem" or a search term
  // active, the thread query simply does not contain the target, so the
  // history walk would page all the way back and still find nothing.
  const handleJumpToMessage = useCallback((messageId) => {
    setFlagFilter("all");
    setSearch("");
    setJumpRequest({ messageId, nonce: Date.now() });
  }, []);

  const handleBackToList = useCallback(() => setMobileView("list"), []);
  const handleCancelReply = useCallback(() => setReplyTo(null), []);
  const handleOpenItems = useCallback(() => setItemsPanelOpen(true), []);
  const handleSent = useCallback(() => setScrollRequest((n) => n + 1), []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[500px] text-gray-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading chat…
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] text-center text-gray-400 gap-2">
        <MessageSquare className="w-10 h-10 text-gray-600" />
        <p>No project chat yet.</p>
      </div>
    );
  }

  return (
    // `min-h-0` below md, not a 500px floor. On a phone with the on-screen
    // keyboard open the visible height drops to ~350px, and a hard floor made
    // this box taller than the viewport — so the composer at its bottom sat
    // below the fold and a growing textarea appeared to expand DOWNWARD off
    // the screen. It never grew the wrong way; the whole column was overflowing.
    <div className="flex h-full min-h-0 md:min-h-[500px] bg-[#1a1a1b] border border-white/10 rounded-xl overflow-hidden">
      <ChannelSidebar
        channels={channels}
        activeChannelId={activeChannelId}
        onSelectChannel={handleSelectChannel}
        onStartDirectMessage={handleStartDirectMessage}
        onOpenTeamPanel={setTeamPanelProjectId}
        currentUserId={user?._id}
        mobileHidden={mobileView === "chat"}
      />
      <div
        className={cn(
          // `min-h-0` lets the thread pane give way when the composer grows,
          // instead of the column pushing past its container.
          "flex-1 flex-col min-w-0 min-h-0",
          mobileView === "list" ? "hidden md:flex" : "flex",
        )}
      >
        {activeChannel ? (
          <>
            <ChatHeader
              channel={activeChannel}
              flag={flagFilter}
              onFlagChange={setFlagFilter}
              search={search}
              onSearchChange={setSearch}
              onOpenItems={handleOpenItems}
              onBack={handleBackToList}
            />
            <PinnedBar
              channelId={activeChannel._id}
              flag={flagFilter}
              search={search}
              canPin={activeChannel.canPin}
              canConvertToItem={activeChannel.canConvertToItem}
              canConvertToFormal={activeChannel.canConvertToFormal}
              onJumpToMessage={handleJumpToMessage}
            />
            <MessageList
              channelId={activeChannel._id}
              flag={flagFilter}
              search={search}
              viewerRole={viewerRole}
              canPin={activeChannel.canPin}
              canConvertToItem={activeChannel.canConvertToItem}
              canConvertToFormal={activeChannel.canConvertToFormal}
              currentUserId={user?._id}
              onReply={setReplyTo}
              jumpRequest={jumpRequest}
              scrollRequest={scrollRequest}
            />
            <MessageComposer
              channelId={activeChannel._id}
              projectId={activeChannel.projectId}
              flag={flagFilter}
              search={search}
              replyTo={replyTo}
              onCancelReply={handleCancelReply}
              onSent={handleSent}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a conversation
          </div>
        )}
      </div>
      {teamPanelProjectId && (
        <TeamPanel
          projectId={teamPanelProjectId}
          open={!!teamPanelProjectId}
          onOpenChange={(open) => !open && setTeamPanelProjectId(null)}
        />
      )}
      {activeChannel && (
        <ProjectItemsPanel
          projectId={activeChannel.projectId}
          open={itemsPanelOpen}
          onOpenChange={setItemsPanelOpen}
          canApprove={activeChannel.canApproveItems}
          canPromote={activeChannel.canConvertToFormal}
        />
      )}
    </div>
  );
}

export default ProjectChat;
