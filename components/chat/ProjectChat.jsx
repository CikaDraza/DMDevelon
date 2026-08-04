"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useChatChannels } from "@/hooks/useProjectChat";
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
  // Carries a jump from the pinned bar down into the thread. The nonce makes
  // clicking the same pinned message twice in a row work.
  const [jumpRequest, setJumpRequest] = useState(null);
  // Below md: only one pane shows at a time (sidebar or conversation), full
  // width. At md and up both panes show side by side regardless of this —
  // see the "md:flex"/"md:w-64" overrides on each pane below.
  const [mobileView, setMobileView] = useState("list");

  // Default to the deep-linked channel (a notification's ?channel=) if it's
  // one this viewer actually has, else the first channel in the list. Only
  // runs while nothing is selected yet, so it never overrides a channel the
  // user has since clicked — the poll refreshing `channels` every 15s must
  // not keep snapping selection back to the deep link.
  useEffect(() => {
    if (activeChannelId || channels.length === 0) return;
    const deepLinked =
      initialChannelId && channels.some((c) => c._id === initialChannelId);
    setActiveChannelId(deepLinked ? initialChannelId : channels[0]._id);
  }, [channels, activeChannelId, initialChannelId]);

  // Sync the active channel to the URL so the user can see which channel
  // they're in and share / bookmark the link. Admin page manages its own
  // tab-based URL, so this only runs on the dedicated /dashboard/chat page.
  useEffect(() => {
    if (pathname === "/dashboard/chat" && activeChannelId) {
      router.replace(`/dashboard/chat?channel=${activeChannelId}`, {
        scroll: false,
      });
    }
  }, [activeChannelId, pathname, router]);

  // Switching conversations abandons any in-progress reply — replying across
  // channels makes no sense (the quoted message wouldn't even be there).
  useEffect(() => {
    setReplyTo(null);
  }, [activeChannelId]);

  const activeChannel = channels.find((c) => c._id === activeChannelId) || null;

  const handleSelectChannel = (id) => {
    setActiveChannelId(id);
    setMobileView("chat");
  };

  const handleStartDirectMessage = async ({ projectId, userId }) => {
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
  };

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
    <div className="flex h-full min-h-[500px] bg-[#1a1a1b] border border-white/10 rounded-xl overflow-hidden">
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
          "flex-1 flex-col min-w-0",
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
              onOpenItems={() => setItemsPanelOpen(true)}
              onBack={() => setMobileView("list")}
            />
            <PinnedBar
              channelId={activeChannel._id}
              flag={flagFilter}
              search={search}
              canConvertToItem={activeChannel.canConvertToItem}
              canConvertToFormal={activeChannel.canConvertToFormal}
              onJumpToMessage={(messageId) =>
                setJumpRequest({ messageId, nonce: Date.now() })
              }
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
            />
            <MessageComposer
              channelId={activeChannel._id}
              projectId={activeChannel.projectId}
              flag={flagFilter}
              search={search}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
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
