"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useClientProject } from "@/hooks/useClientProjects";
import { getMilestonePhase } from "@/components/ui/project-timeline";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

/**
 * Move an approved chat item into actual project work.
 *
 * Two targets, and the difference between them is commercial, not technical:
 *
 *  - a TASK inside an already-accepted milestone is work the client has
 *    already agreed to and paid for, so it applies immediately;
 *  - anything NEW costs hours and money, so it can only ever be *proposed*.
 *    It becomes a draft phase proposal the operator prices and sends, and
 *    nothing appears in the client's plan until they accept.
 *
 * New work is always a new PHASE rather than a milestone bolted onto an
 * existing one, because `{projectId, phaseNumber}` is unique — one proposal
 * per phase, so an accepted phase can never gain another milestone.
 */
export function HandoffDialog({
  item,
  projectId,
  canPromote = false,
  canProposeWork = false,
  onPromoteToTask,
  onHandOffAsWork,
  open,
  onOpenChange,
}) {
  const targets = [
    canPromote && { value: "task", label: "Task in an existing milestone" },
    canProposeWork && { value: "work", label: "Propose new work (new phase)" },
  ].filter(Boolean);

  const [target, setTarget] = useState(targets[0]?.value || "task");
  const [milestoneId, setMilestoneId] = useState("");
  const [phaseLabel, setPhaseLabel] = useState("");
  const [title, setTitle] = useState("");
  const [scope, setScope] = useState("");
  const [timeline, setTimeline] = useState("");
  const [budget, setBudget] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: project } = useClientProject(open ? projectId : null);

  // Grouped by phase so the picker reads the way the plan does, instead of a
  // flat list where two phases' milestones sit next to each other unlabelled.
  const milestonesByPhase = useMemo(() => {
    const groups = new Map();
    for (const m of project?.milestones || []) {
      const { phaseNumber, phaseLabel: label } = getMilestonePhase(m);
      if (!groups.has(phaseNumber)) {
        groups.set(phaseNumber, { phaseNumber, label, milestones: [] });
      }
      groups.get(phaseNumber).milestones.push(m);
    }
    return Array.from(groups.values()).sort(
      (a, b) => a.phaseNumber - b.phaseNumber,
    );
  }, [project]);

  useEffect(() => {
    if (!open) return;
    setTarget(targets[0]?.value || "task");
    setMilestoneId("");
    setPhaseLabel("");
    setTitle(item?.title || "");
    setScope(item?.body || "");
    setTimeline("");
    setBudget("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?._id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (target === "task") {
        await onPromoteToTask({ itemId: item._id, milestoneId });
        toast.success("Added to the milestone — it is live now");
      } else {
        const res = await onHandOffAsWork({
          itemId: item._id,
          title,
          scope,
          timeline,
          budget,
          phaseLabel: phaseLabel || undefined,
        });
        toast.success(
          `Draft ${res?.proposal?.phaseLabel || "phase"} created — price it and Send it from Pending work in Client Projects`,
          { duration: 7000 },
        );
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err.response?.data?.error || "Handoff failed");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    target === "task" ? !!milestoneId : !!title.trim() && !submitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1a1b] border-white/10 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Hand off {item?.ref ? `${item.ref} — ` : ""}
            {item?.title}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Turn this into project work. It stays linked back to the
            conversation it came from.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            {targets.map((t) => (
              <label
                key={t.value}
                className="flex items-start gap-2 cursor-pointer"
              >
                <input
                  type="radio"
                  name="handoff-target"
                  value={t.value}
                  checked={target === t.value}
                  onChange={() => setTarget(t.value)}
                  className="mt-1"
                />
                <span>
                  <span className="text-sm text-white">{t.label}</span>
                  <span className="block text-[11px] text-gray-500">
                    {t.value === "task"
                      ? "Within scope the client already accepted — applies immediately."
                      : "New hours and price — becomes a draft you send for the client to accept."}
                  </span>
                </span>
              </label>
            ))}
          </div>

          {target === "task" ? (
            <div>
              <Label className="text-white">Milestone</Label>
              <select
                value={milestoneId}
                onChange={(e) => setMilestoneId(e.target.value)}
                required
                className="w-full mt-1 bg-white/5 border border-white/10 rounded-md text-sm text-white px-3 py-2"
              >
                <option value="">Select a milestone…</option>
                {milestonesByPhase.map((group) => (
                  <optgroup key={group.phaseNumber} label={group.label}>
                    {group.milestones.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.title}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {milestonesByPhase.length === 0 && (
                <p className="text-[11px] text-amber-400 mt-1">
                  This project has no milestones yet — propose new work instead.
                </p>
              )}
            </div>
          ) : (
            <>
              <div>
                <Label className="text-white">Phase name (optional)</Label>
                <Input
                  value={phaseLabel}
                  onChange={(e) => setPhaseLabel(e.target.value)}
                  placeholder="Defaults to the next Faza number"
                  className="bg-white/5 border-white/10 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-white">Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="bg-white/5 border-white/10 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-white">Scope</Label>
                <Textarea
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  rows={4}
                  className="bg-white/5 border-white/10 text-white mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-white">Timeline</Label>
                  <Input
                    value={timeline}
                    onChange={(e) => setTimeline(e.target.value)}
                    placeholder="e.g. 2 weeks"
                    className="bg-white/5 border-white/10 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-white">Budget</Label>
                  <Input
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="e.g. 800 EUR"
                    className="bg-white/5 border-white/10 text-white mt-1"
                  />
                </div>
              </div>
              <p className="text-[11px] text-gray-500">
                You can refine the milestone plan, price and timeline before
                sending — this only creates the draft.
              </p>
            </>
          )}

          <DialogFooter>
            <Button
              type="submit"
              disabled={!canSubmit || submitting}
              className="bg-[#FFB633] text-black hover:bg-[#e5a32e]"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : target === "task" ? (
                "Add to milestone"
              ) : (
                "Create draft proposal"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default HandoffDialog;
