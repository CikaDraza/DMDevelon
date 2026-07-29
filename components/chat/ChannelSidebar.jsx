"use client";

import { useProjectMembers } from "@/hooks/useProjectMembers";
import { cn } from "@/lib/utils";
import { Hash, MessageCircle, Plus } from "lucide-react";

function UnreadBadge({ count }) {
  if (!count) return null;
  return (
    <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function PresenceDot({ online }) {
  return (
    <span
      className={cn(
        "w-2 h-2 rounded-full shrink-0",
        online ? "bg-green-500" : "bg-gray-600",
      )}
      title={online ? "Online" : "Offline"}
    />
  );
}

/**
 * Left column: the project's group channel(s), its member roster (click a
 * name to open/start a DM with them), and existing direct-message threads.
 *
 * The roster shown is scoped to whichever channel is currently active — for
 * a client this is always their one project; for admin, switching between
 * projects' group channels switches whose team is listed.
 */
export function ChannelSidebar({
  channels,
  activeChannelId,
  onSelectChannel,
  onStartDirectMessage,
  onOpenTeamPanel,
  currentUserId,
  mobileHidden = false,
}) {
  const groupChannels = channels.filter((c) => c.kind === "group");
  const activeChannel = channels.find((c) => c._id === activeChannelId);
  const rosterProjectId =
    activeChannel?.projectId || groupChannels[0]?.projectId || null;
  // Only DMs that belong to the currently active project's roster — showing
  // every DM the admin has ever opened across all projects floods the Direct
  // list with unresolvable "Direct message" placeholders (the members array
  // is scoped to rosterProjectId, so a DM from a different project can never
  // look up its partner's name).
  const dmChannels = channels.filter(
    (c) =>
      c.kind === "dm" && (!rosterProjectId || c.projectId === rosterProjectId),
  );
  const { members } = useProjectMembers(rosterProjectId);

  const otherDmMember = (channel) => {
    const otherUserId = (channel.memberUserIds || []).find(
      (id) => id !== currentUserId,
    );
    return members.find((m) => m.userId === otherUserId) || null;
  };

  return (
    <div
      className={cn(
        "w-full md:w-64 shrink-0 border-r border-white/10 flex-col overflow-y-auto",
        mobileHidden ? "hidden md:flex" : "flex",
      )}
    >
      <div className="p-3">
        <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
          Channels
        </p>
        {groupChannels.map((channel) => (
          <button
            key={channel._id}
            type="button"
            onClick={() => onSelectChannel(channel._id)}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors text-left",
              channel._id === activeChannelId
                ? "bg-[#FFB633] text-black"
                : "text-gray-300 hover:bg-white/5",
            )}
          >
            <Hash className="w-4 h-4 shrink-0" />
            <span className="truncate flex-1">
              {channel.name || "Project Group"}
            </span>
            <UnreadBadge count={channel.unreadCount} />
          </button>
        ))}
      </div>

      {rosterProjectId && (
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center justify-between px-2 mb-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Members
            </p>
            {onOpenTeamPanel && (
              <button
                type="button"
                onClick={() => onOpenTeamPanel(rosterProjectId)}
                className="flex items-center gap-0.5 px-2 py-0.5 rounded-full border border-[#FFB633] text-[#FFB633] text-[10px] font-medium hover:bg-[#FFB633]/10 transition-colors"
                title="Add team member"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            )}
          </div>
          {members.map((m) => {
            const isSelf = m.userId === currentUserId;
            return (
              <button
                key={m.userId}
                type="button"
                onClick={() =>
                  !isSelf &&
                  onStartDirectMessage?.({
                    projectId: rosterProjectId,
                    userId: m.userId,
                  })
                }
                disabled={isSelf}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-gray-300 hover:bg-white/5 disabled:opacity-50 disabled:cursor-default text-left"
              >
                <PresenceDot online={m.isOnline} />
                <span className="truncate flex-1">
                  {m.name}
                  {isSelf ? " (you)" : ""}
                </span>
                <span className="text-[10px] text-gray-500 shrink-0">
                  {m.roleLabel}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="p-3 border-t border-white/10">
        <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
          Direct
        </p>
        {dmChannels.length === 0 ? (
          <p className="px-2 text-xs text-gray-600">No direct messages yet</p>
        ) : (
          dmChannels.map((channel) => {
            const other = otherDmMember(channel);
            return (
              <button
                key={channel._id}
                type="button"
                onClick={() => onSelectChannel(channel._id)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors text-left",
                  channel._id === activeChannelId
                    ? "bg-[#FFB633] text-black"
                    : "text-gray-300 hover:bg-white/5",
                )}
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
                <PresenceDot online={other?.isOnline} />
                <span className="truncate flex-1">
                  {other?.name || "Direct message"}
                </span>
                <UnreadBadge count={channel.unreadCount} />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export default ChannelSidebar;
