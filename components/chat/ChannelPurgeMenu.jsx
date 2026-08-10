"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { usePurgeChannel } from "@/hooks/useProjectChat";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CalendarClock, Loader2, MoreVertical, Trash2 } from "lucide-react";

// Must match PURGE_DEFAULT_DAYS in lib/chat-domain.mjs — the server validates
// whatever this sends, so a mismatch would be a button that promises one window
// and deletes another.
const OLDER_THAN_DAYS = 30;

// The two purges, so the dropdown item, the confirmation copy and the request
// body all come from one place instead of three parallel branches.
const ACTIONS = {
  older_than: {
    label: `Delete messages older than ${OLDER_THAN_DAYS} days`,
    title: `Delete messages older than ${OLDER_THAN_DAYS} days?`,
    confirm: "Delete older messages",
    payload: { scope: "older_than", days: OLDER_THAN_DAYS },
    describe: (name) =>
      `Every message in ${name} sent more than ${OLDER_THAN_DAYS} days ago is permanently removed — for everyone, including their attachments' entries and pins. The last ${OLDER_THAN_DAYS} days stay.`,
  },
  all: {
    label: "Delete all messages",
    title: "Delete the entire conversation history?",
    confirm: "Delete everything",
    payload: { scope: "all" },
    describe: (name) =>
      `Every message ever sent in ${name} is permanently removed — for everyone, not just for you. This is not the same as clearing your own view.`,
  },
};

/**
 * Operator-only "…" menu in the channel header: hard-delete this channel's
 * history, either entirely or everything past a 30-day window.
 *
 * This is a real `deleteMany` on the server, which is why each item goes
 * through an AlertDialog rather than the `window.confirm` used for the
 * reversible actions elsewhere in the chat. Works the same on a group channel
 * and on a DM — the server decides who may do it (`messagesModerate`); the
 * `canModerate` flag on the channel only decides whether to draw the button.
 */
export function ChannelPurgeMenu({ channel }) {
  // Which confirmation is open, keyed by ACTIONS — null when none is.
  const [pending, setPending] = useState(null);
  const purge = usePurgeChannel(channel?._id);

  if (!channel?.canModerate) return null;

  const channelName =
    channel.kind === "dm"
      ? "this direct message"
      : `#${channel.name || "this channel"}`;
  const action = pending ? ACTIONS[pending] : null;

  const runPurge = async () => {
    try {
      const result = await purge.mutateAsync(action.payload);
      if (result.deletedCount === 0) {
        toast.success("Nothing to delete");
      } else {
        toast.success(result.message);
      }
      // Converting a message into a request or a decision leaves that record
      // pointing back at the message; a purge is the one delete that breaks
      // the link, so say so instead of letting it be discovered later.
      if (result.convertedCount > 0) {
        toast(
          `${result.convertedCount} of them had been converted into a formal record — those records remain, but no longer link back to a message.`,
          { duration: 8000 },
        );
      }
    } catch (err) {
      toast.error(
        err.response?.data?.error || "Failed to delete the conversation",
      );
    } finally {
      setPending(null);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          title="Conversation actions"
          className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
        >
          <MoreVertical className="w-4 h-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="bg-[#1a1a1b] border-white/10 text-gray-200"
        >
          <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Delete history
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-white/10" />
          <DropdownMenuItem
            onClick={() => setPending("older_than")}
            className="gap-2 cursor-pointer"
          >
            <CalendarClock className="w-3.5 h-3.5" />
            {ACTIONS.older_than.label}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setPending("all")}
            className="gap-2 cursor-pointer text-red-400 focus:text-red-400"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {ACTIONS.all.label}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={!!pending}
        // Radix reports both a cancel and an outside click here; while the
        // request is in flight neither should drop the dialog out from under
        // the spinner.
        onOpenChange={(open) => {
          if (!open && !purge.isPending) setPending(null);
        }}
      >
        <AlertDialogContent className="bg-[#1a1a1b] border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{action?.title}</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {action?.describe(channelName)} This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={purge.isPending}
              className="bg-transparent border-white/10 text-white hover:bg-white/5 hover:text-white"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={purge.isPending}
              // Radix closes on Action by default; the dialog has to stay up
              // while the delete runs so the spinner is visible and a failure
              // can be reported against the thing that failed.
              onClick={(event) => {
                event.preventDefault();
                runPurge();
              }}
              className="bg-red-600 text-white hover:bg-red-500 gap-2"
            >
              {purge.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {action?.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default ChannelPurgeMenu;
