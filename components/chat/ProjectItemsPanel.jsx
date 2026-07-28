"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { useProjectItems } from "@/hooks/useProjectItems";
import { HandoffDialog } from "./HandoffDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Check,
  Gavel,
  Layers,
  Lightbulb,
  Loader2,
  ListPlus,
  ListTodo,
  Siren,
  X,
} from "lucide-react";

const STATUS_STYLE = {
  open: "bg-white/10 text-gray-300",
  in_review: "bg-blue-500/20 text-blue-300",
  accepted: "bg-green-500/20 text-green-400",
  rejected: "bg-red-500/20 text-red-300",
  resolved: "bg-green-500/20 text-green-400",
  closed: "bg-gray-500/20 text-gray-400",
};

// Same color language as MessageBubble's FLAG_META — this is the same set of
// kinds, just viewed as a standalone log instead of inline in the thread.
const KIND_META = {
  idea: { color: "bg-purple-600", icon: Lightbulb, label: "Idea" },
  problem: { color: "bg-orange-600", icon: AlertTriangle, label: "Problem" },
  incident: { color: "bg-red-600", icon: Siren, label: "Incident" },
  decision: { color: "bg-green-600", icon: Gavel, label: "Decision" },
};

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "idea", label: "Ideas" },
  { value: "problem", label: "Problems" },
  { value: "incident", label: "Incidents" },
  { value: "decision", label: "Decisions" },
];

/**
 * Read-only log of everything "Convert to…" has produced for a project:
 * ideas, problems, incidents, decisions — each with its human-readable ref
 * (D-041) and a link back to the chat message it came from. Creating new
 * items happens through the chat composer's dropdown, not from here.
 */
export function ProjectItemsPanel({
  projectId,
  open,
  onOpenChange,
  canApprove = false,
  canPromote = false,
}) {
  const [kind, setKind] = useState("all");
  const [handoffItem, setHandoffItem] = useState(null);
  const { items, isLoading, decideItem, promoteToTask, handOffAsWork } =
    useProjectItems(projectId, {
      kind: kind === "all" ? undefined : kind,
    });

  const decide = async (itemId, status) => {
    try {
      await decideItem.mutateAsync({ itemId, status });
      toast.success(status === "accepted" ? "Accepted" : `Marked ${status}`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update the item");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1a1b] border-white/10 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListTodo className="w-4 h-4" /> Decisions &amp; items
          </DialogTitle>
        </DialogHeader>

        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="w-[160px] h-8 bg-white/5 border-white/10 text-white text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">
            Nothing converted yet.
          </p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {items.map((item) => {
              const meta = KIND_META[item.kind];
              const Icon = meta?.icon;
              return (
                <div
                  key={item._id}
                  className="bg-white/5 rounded-lg px-3 py-2 space-y-1"
                >
                  <div className="flex items-center gap-2">
                    {meta && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${meta.color}`}
                      >
                        {Icon && <Icon className="h-3 w-3" />}
                        {item.ref || meta.label}
                      </span>
                    )}
                    <p className="text-sm text-white truncate flex-1">
                      {item.title}
                    </p>
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-medium ${
                        STATUS_STYLE[item.status] || STATUS_STYLE.open
                      }`}
                    >
                      {item.status.replace("_", " ")}
                    </span>
                  </div>
                  {item.body && (
                    <p className="text-xs text-gray-400 line-clamp-2">
                      {item.body}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-500">
                    {item.createdByName}
                    {item.confirmedBy?.length > 0 &&
                      ` · confirmed by ${item.confirmedBy.map((c) => c.name).join(", ")}`}
                  </p>

                  {/* Where this item ended up. Before this, a handed-off item
                      looked identical to one nobody had touched. */}
                  {item.milestoneId && (
                    <p className="flex items-center gap-1 text-[10px] text-green-400">
                      <ListPlus className="w-3 h-3 shrink-0" />
                      Added to a milestone
                    </p>
                  )}
                  {item.handoffProposalId && !item.milestoneId && (
                    <p className="flex items-center gap-1 text-[10px] text-[#FFB633]">
                      <Layers className="w-3 h-3 shrink-0" />
                      Proposed as new work — see Pending work in Client Projects
                    </p>
                  )}

                  {(canApprove || canPromote) && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {canApprove && item.status !== "accepted" && (
                        <button
                          type="button"
                          onClick={() => decide(item._id, "accepted")}
                          disabled={decideItem.isPending}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-green-500/50 text-green-400 text-[10px] hover:bg-green-500/10 disabled:opacity-50"
                        >
                          <Check className="w-3 h-3" /> Accept
                        </button>
                      )}
                      {canApprove && item.status !== "rejected" && (
                        <button
                          type="button"
                          onClick={() => decide(item._id, "rejected")}
                          disabled={decideItem.isPending}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-red-500/50 text-red-400 text-[10px] hover:bg-red-500/10 disabled:opacity-50"
                        >
                          <X className="w-3 h-3" /> Reject
                        </button>
                      )}
                      {/* One entry point instead of three competing controls;
                          the dialog explains what each target actually costs. */}
                      {!item.milestoneId && !item.handoffProposalId && (
                        <button
                          type="button"
                          onClick={() => setHandoffItem(item)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-[#FFB633]/60 text-[#FFB633] text-[10px] hover:bg-[#FFB633]/10"
                        >
                          <Layers className="w-3 h-3" /> Hand off…
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
      </Dialog>
      <HandoffDialog
        item={handoffItem}
        projectId={projectId}
        canPromote={canPromote}
        canProposeWork={canApprove}
        onPromoteToTask={(vars) => promoteToTask.mutateAsync(vars)}
        onHandOffAsWork={(vars) => handOffAsWork.mutateAsync(vars)}
        open={!!handoffItem}
        onOpenChange={(o) => !o && setHandoffItem(null)}
      />
    </>
  );
}

export default ProjectItemsPanel;
