"use client";

import { useState } from "react";
import { cn, downloadFileToDevice } from "@/lib/utils";
import { ConvertMessageDialog } from "./ConvertMessageDialog";
import { AttachmentPreview } from "./AttachmentPreview";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertTriangle,
  ArrowRightCircle,
  Download,
  FileText,
  Gavel,
  Lightbulb,
  ListChecks,
  MoreVertical,
  Pencil,
  Pin,
  PinOff,
  Reply,
  Siren,
  Trash2,
} from "lucide-react";

const CONVERT_TARGET_LABEL = {
  item: "an item",
  request: "a request",
  task: "a milestone task",
  milestone_comment: "the milestone thread",
};

// Same visual language as the milestone chat's messageType badges
// (components/dashboard/MilestoneChat.jsx) — this is the wider flag set from
// the plan's color map, not a replacement for that one. Exported so PinnedBar
// renders the exact same badge instead of a second, drifting copy.
export const FLAG_META = {
  request: { color: "bg-amber-600", icon: FileText, label: "Request" },
  task: { color: "bg-indigo-600", icon: ListChecks, label: "Task" },
  idea: { color: "bg-purple-600", icon: Lightbulb, label: "Idea" },
  problem: { color: "bg-orange-600", icon: AlertTriangle, label: "Problem" },
  incident: { color: "bg-red-600", icon: Siren, label: "Incident" },
  decision: { color: "bg-green-600", icon: Gavel, label: "Decision" },
};

/**
 * One chat message. `canModerate` is a coarse client-side signal (admin
 * dashboard vs client dashboard) — the server is the actual authority
 * (canModerateMessage) and will reject a delete this component wrongly
 * thought was allowed. `canPin`, unlike that one, comes straight from the
 * server's own resolved permissions (ChatChannel summary's `canPin`) — a
 * coarse dashboard-based guess isn't good enough for it, since an
 * owner/collaborator/viewer are all "client dashboard" but only the first two
 * actually have the `pin` permission.
 *
 * `canConvertToItem`/`canConvertToFormal` are the same kind of server-sourced
 * booleans as `canPin` — a collaborator can save an idea/decision but only
 * owner/admin can turn a message into a request, task, or milestone comment.
 */
export function MessageBubble({
  message,
  isMine,
  canModerate = false,
  canPin = false,
  canConvertToItem = false,
  canConvertToFormal = false,
  highlighted = false,
  onReply,
  onJumpToReply,
  onTogglePin,
  onEdit,
  onDelete,
  onConvert,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.body);
  const [convertOpen, setConvertOpen] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const canConvert = canConvertToItem || canConvertToFormal;

  if (message.kind === "system") {
    return (
      <div className="flex items-center gap-3 my-2">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-xs text-gray-500">{message.body}</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>
    );
  }

  const flagMeta =
    message.flag && message.flag !== "none" ? FLAG_META[message.flag] : null;
  const FlagIcon = flagMeta?.icon;
  const canEdit = isMine && !message.deleted;
  const canDelete = (isMine || canModerate) && !message.deleted;

  const submitEdit = () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === message.body) {
      setEditing(false);
      setDraft(message.body);
      return;
    }
    onEdit?.({ messageId: message._id, body: trimmed });
    setEditing(false);
  };

  return (
    <div
      data-message-id={message._id}
      className={cn(
        "flex group scroll-mt-4",
        isMine ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-2 relative transition-shadow",
          isMine ? "bg-[#FFB633] text-black" : "bg-white/10 text-gray-100",
          highlighted &&
            "ring-2 ring-[#FFB633] ring-offset-2 ring-offset-[#0f0f10]",
        )}
      >
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className="text-[10px] opacity-70">{message.authorName}</p>
          {message.pinned && <Pin className="h-2.5 w-2.5 opacity-70" />}
        </div>

        {flagMeta && (
          <span
            className={cn(
              "mb-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white",
              flagMeta.color,
            )}
          >
            <FlagIcon className="h-3 w-3" />
            {flagMeta.label}
          </span>
        )}

        {message.replyToPreview && (
          <button
            type="button"
            onClick={() => onJumpToReply?.(message.replyToMessageId)}
            className={cn(
              "mb-1.5 border-l-2 pl-2 text-[11px] opacity-70 block w-full text-left hover:opacity-100 transition-opacity",
              isMine ? "border-black/30" : "border-white/30",
            )}
          >
            <p className="font-medium">
              Reply to {message.replyToPreview.authorName}
            </p>
            <p className="truncate">{message.replyToPreview.body}</p>
          </button>
        )}

        {message.deleted ? (
          <p className="text-sm italic opacity-60">Message deleted</p>
        ) : editing ? (
          <div className="space-y-1.5">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              autoFocus
              className="w-full bg-black/10 rounded-lg px-2 py-1 text-sm resize-none focus:outline-none"
            />
            <div className="flex gap-3 text-xs">
              <button
                type="button"
                onClick={submitEdit}
                className="font-medium underline"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setDraft(message.body);
                }}
                className="opacity-70"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {message.body && (
              <p className="text-sm whitespace-pre-wrap break-words">
                {message.body}
              </p>
            )}
            {message.editedAt && (
              <span className="text-[10px] opacity-60 ml-1">(edited)</span>
            )}
          </>
        )}

        {message.convertedTo?.length > 0 && (
          <div className="mt-1.5 space-y-0.5">
            {message.convertedTo.map((c, idx) => (
              <p
                key={idx}
                className="flex items-center gap-1 text-[10px] italic opacity-80"
              >
                <ArrowRightCircle className="h-2.5 w-2.5 shrink-0" />
                Converted to{" "}
                {c.ref || CONVERT_TARGET_LABEL[c.target] || c.target}
              </p>
            ))}
          </div>
        )}

        {!message.deleted && message.attachments?.length > 0 && (
          <div className="mt-2 space-y-2">
            {message.attachments.map((a, idx) =>
              a.type === "image" ? (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPreviewAttachment(a)}
                  className="block"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.url}
                    alt={a.name || "attachment"}
                    className="rounded-lg max-h-40 object-cover"
                  />
                </button>
              ) : (
                // Documents download straight away instead of opening the
                // preview: an embedded PDF renders as a broken-file icon on
                // mobile, and downloading is what people wanted from it anyway.
                <button
                  key={idx}
                  type="button"
                  onClick={() => downloadFileToDevice(a.url, a.name)}
                  title="Download this document"
                  className={cn(
                    "flex items-center gap-2 text-xs underline",
                    isMine ? "text-black" : "text-[#FFB633]",
                  )}
                >
                  <Download className="w-4 h-4" />
                  {a.name || "Document.pdf"}
                </button>
              ),
            )}
          </div>
        )}

        {!message.deleted && (
          <div
            className={cn(
              "absolute top-1 transition-opacity md:opacity-0 md:group-hover:opacity-100",
              isMine ? "-left-8" : "-right-8",
            )}
          >
            <DropdownMenu>
              <DropdownMenuTrigger className="p-1 rounded-full hover:bg-white/10 text-gray-400 hover:text-white">
                <MoreVertical className="w-4 h-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align={isMine ? "end" : "start"}
                className="bg-[#1a1a1b] border-white/10 text-gray-200"
              >
                <DropdownMenuItem
                  onClick={() => onReply?.(message)}
                  className="gap-2 cursor-pointer"
                >
                  <Reply className="w-3.5 h-3.5" /> Reply
                </DropdownMenuItem>
                {canPin && (
                  <DropdownMenuItem
                    onClick={() =>
                      onTogglePin?.({
                        messageId: message._id,
                        pinned: !message.pinned,
                      })
                    }
                    className="gap-2 cursor-pointer"
                  >
                    {message.pinned ? (
                      <PinOff className="w-3.5 h-3.5" />
                    ) : (
                      <Pin className="w-3.5 h-3.5" />
                    )}
                    {message.pinned ? "Unpin" : "Pin"}
                  </DropdownMenuItem>
                )}
                {canConvert && (
                  <DropdownMenuItem
                    onClick={() => setConvertOpen(true)}
                    className="gap-2 cursor-pointer"
                  >
                    <ArrowRightCircle className="w-3.5 h-3.5" /> Convert to…
                  </DropdownMenuItem>
                )}
                {canEdit && (
                  <DropdownMenuItem
                    onClick={() => setEditing(true)}
                    className="gap-2 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDelete?.(message._id)}
                      className="gap-2 cursor-pointer text-red-400 focus:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
      {canConvert && (
        <ConvertMessageDialog
          message={message}
          canConvertToItem={canConvertToItem}
          canConvertToFormal={canConvertToFormal}
          onConvert={onConvert}
          open={convertOpen}
          onOpenChange={setConvertOpen}
        />
      )}
      <AttachmentPreview
        attachment={previewAttachment}
        open={!!previewAttachment}
        onOpenChange={(open) => !open && setPreviewAttachment(null)}
      />
    </div>
  );
}

export default MessageBubble;
