"use client";

import { useState } from "react";
import { useChatMessages, useChatPinned } from "@/hooks/useProjectChat";
import { FLAG_META } from "./MessageBubble";
import { ConvertMessageDialog } from "./ConvertMessageDialog";
import { ArrowRightCircle, ChevronDown, ChevronUp, Pin } from "lucide-react";

/** Pinned messages as a collapsible TODO-style list right under the header. */
export function PinnedBar({
  channelId,
  // Passed through only so this component's own useChatMessages call lands on
  // the SAME query key as MessageList's — otherwise it would open a second,
  // differently-filtered 4s poll for the same channel.
  flag,
  search,
  canConvertToItem = false,
  canConvertToFormal = false,
  onJumpToMessage,
}) {
  const { pinned } = useChatPinned(channelId);
  const { convertMessage } = useChatMessages(channelId, { flag, q: search });
  const [collapsed, setCollapsed] = useState(false);
  const [convertTarget, setConvertTarget] = useState(null);

  const canConvert = canConvertToItem || canConvertToFormal;

  if (pinned.length === 0) return null;

  return (
    <div className="border-b border-white/10 bg-[#FFB633]/5 shrink-0">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-2 px-4 py-2 text-xs text-[#FFB633]"
      >
        <Pin className="w-3.5 h-3.5" />
        <span className="font-medium">
          {pinned.length} pinned {pinned.length === 1 ? "message" : "messages"}
        </span>
        {collapsed ? (
          <ChevronDown className="w-3.5 h-3.5 ml-auto" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5 ml-auto" />
        )}
      </button>
      {!collapsed && (
        <div className="px-4 pb-2 space-y-1 max-h-40 overflow-y-auto">
          {pinned.map((m) => {
            const flagMeta =
              m.flag && m.flag !== "none" ? FLAG_META[m.flag] : null;
            const FlagIcon = flagMeta?.icon;
            return (
              <div
                key={m._id}
                className="flex items-center gap-2 text-xs text-gray-300 bg-white/5 rounded-lg px-3 py-2"
              >
                {/* The whole quote is the anchor — jumps to the message in
                    the thread rather than making someone scroll for it. */}
                <button
                  type="button"
                  onClick={() => onJumpToMessage?.(m._id)}
                  title="Go to this message"
                  className="flex min-w-0 flex-1 items-center gap-2 text-left hover:text-white transition-colors"
                >
                  <span className="text-gray-500 shrink-0">{m.authorName}:</span>
                  {flagMeta && (
                    <span
                      className={`shrink-0 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-white ${flagMeta.color}`}
                    >
                      {FlagIcon && <FlagIcon className="h-2.5 w-2.5" />}
                      {flagMeta.label}
                    </span>
                  )}
                  <span className="truncate">
                    {m.body || "(attachment)"}
                  </span>
                </button>

                {/* Converting straight from here saves hunting the message
                    down in the thread first. Only offered for a flagged
                    message, since the flag is what says it is actionable. */}
                {canConvert && flagMeta && !m.convertedTo?.length && (
                  <button
                    type="button"
                    onClick={() => setConvertTarget(m)}
                    title="Convert to…"
                    className="shrink-0 flex items-center gap-1 rounded-full border border-[#FFB633]/60 px-2 py-0.5 text-[10px] text-[#FFB633] hover:bg-[#FFB633]/10"
                  >
                    <ArrowRightCircle className="w-3 h-3" /> Convert
                  </button>
                )}
                {m.convertedTo?.length > 0 && (
                  <span className="shrink-0 text-[10px] italic text-gray-500">
                    {m.convertedTo[0].ref || "converted"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {convertTarget && (
        <ConvertMessageDialog
          message={convertTarget}
          canConvertToItem={canConvertToItem}
          canConvertToFormal={canConvertToFormal}
          onConvert={(vars) => convertMessage.mutateAsync(vars)}
          open={!!convertTarget}
          onOpenChange={(open) => !open && setConvertTarget(null)}
        />
      )}
    </div>
  );
}

export default PinnedBar;
