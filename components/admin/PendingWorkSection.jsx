"use client";

import toast from "react-hot-toast";
import { useProjectProposals } from "@/hooks/useProjectProposals";
import { Button } from "@/components/ui/button";
import {
  Clock,
  Loader2,
  Pencil,
  Send,
  Trash2,
  Undo2,
  XCircle,
} from "lucide-react";

// Only work that has NOT yet become part of the plan. An accepted proposal
// already shows up as milestones in the tree below, so repeating it here
// would just be noise.
const PENDING_STATUSES = ["draft", "sent", "changes_requested", "rejected"];

const STATUS_COPY = {
  draft: { label: "Draft — not sent yet", cls: "bg-gray-500/20 text-gray-300" },
  sent: { label: "Awaiting client", cls: "bg-blue-500/20 text-blue-300" },
  changes_requested: {
    label: "Client asked for changes",
    cls: "bg-amber-500/20 text-amber-300",
  },
  rejected: { label: "Rejected by client", cls: "bg-red-500/20 text-red-300" },
};

function sinceLabel(date) {
  if (!date) return "";
  const ms = Date.now() - new Date(date).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/**
 * Everything waiting on the client, in one place.
 *
 * Before this existed, a handed-off decision produced a draft proposal that
 * was visible nowhere obvious — you could not tell what had been sent, what
 * was refused, or what was still sitting unsent. Accepted work is
 * deliberately excluded: that lives in the milestone tree.
 */
export function PendingWorkSection({ projectId, onEdit }) {
  const {
    proposals,
    isLoading,
    sendProposal,
    withdrawProposal,
    deleteProposal,
  } = useProjectProposals(projectId);

  const pending = (proposals || [])
    .filter((p) => PENDING_STATUSES.includes(p.status))
    .sort((a, b) => (a.phaseNumber || 0) - (b.phaseNumber || 0));

  if (isLoading || pending.length === 0) return null;

  const run = async (fn, vars, okMessage) => {
    try {
      await fn.mutateAsync(vars);
      toast.success(okMessage);
    } catch (err) {
      toast.error(err.response?.data?.error || "Action failed");
    }
  };

  const handleDelete = (proposal) => {
    if (
      !window.confirm(
        `Delete ${proposal.phaseLabel}? This cannot be undone — no work has been created from it.`,
      )
    ) {
      return;
    }
    run(deleteProposal, { proposalId: proposal._id }, "Deleted");
  };

  return (
    <section className="bg-[#FFB633]/5 border border-[#FFB633]/20 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-[#FFB633]" />
        <h4 className="text-sm font-semibold text-white">
          Pending work ({pending.length})
        </h4>
        <span className="text-xs text-gray-500">
          not in the plan until the client accepts
        </span>
      </div>

      <div className="space-y-2">
        {pending.map((p) => {
          const status = STATUS_COPY[p.status] || STATUS_COPY.draft;
          const since =
            p.status === "sent" ? sinceLabel(p.sentAt) : sinceLabel(p.updatedAt);
          // Whose move is it? `sent` is parked with the client and needs
          // nothing from the operator, so it stays calm — glowing everything
          // would make the glow mean nothing.
          const needsYou = p.status !== "sent";
          return (
            <div
              key={p._id}
              className={`bg-[#1a1a1b] border rounded-lg p-3 space-y-2 ${
                needsYou
                  ? "border-[#FFB633]/60 animate-attention-glow"
                  : "border-white/10"
              }`}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white truncate">
                      {p.phaseLabel}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${status.cls}`}
                    >
                      {status.label}
                      {since ? ` · ${since}` : ""}
                    </span>
                    {p.sourceItemRef && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/10 text-gray-300">
                        from {p.sourceItemRef}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {p.title}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {(p.milestonePlan || []).length} milestone
                    {(p.milestonePlan || []).length === 1 ? "" : "s"}
                    {p.budget ? ` · ${p.budget}` : ""}
                    {p.timeline ? ` · ${p.timeline}` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {["draft", "changes_requested", "rejected"].includes(
                    p.status,
                  ) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEdit?.(p)}
                      className="h-7 px-2 border-white/20 text-gray-300 hover:text-white"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {p.status === "draft" && (
                    <Button
                      size="sm"
                      disabled={sendProposal.isPending}
                      onClick={() =>
                        run(
                          sendProposal,
                          { proposalId: p._id },
                          "Sent — the client has been notified",
                        )
                      }
                      className="h-7 px-2 bg-[#FFB633] text-black hover:bg-[#e5a32e]"
                    >
                      {sendProposal.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5 mr-1" /> Send
                        </>
                      )}
                    </Button>
                  )}
                  {p.status === "sent" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={withdrawProposal.isPending}
                      title="Pull it back to draft so you can change it"
                      onClick={() =>
                        run(
                          withdrawProposal,
                          { proposalId: p._id },
                          "Withdrawn — back to draft",
                        )
                      }
                      className="h-7 px-2 border-white/20 text-gray-300 hover:text-white"
                    >
                      <Undo2 className="w-3.5 h-3.5 mr-1" /> Withdraw
                    </Button>
                  )}
                  {["draft", "rejected"].includes(p.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={deleteProposal.isPending}
                      onClick={() => handleDelete(p)}
                      className="h-7 px-2 border-red-500/40 text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {p.status === "rejected" && (
                <p className="flex items-start gap-1.5 text-[11px] text-gray-400">
                  <XCircle className="w-3 h-3 mt-0.5 shrink-0 text-red-400" />
                  Agree a new approach in chat, then edit and send again — or
                  delete this and hand the item off afresh.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default PendingWorkSection;
