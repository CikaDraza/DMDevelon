"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MilestonePlanEditor,
  normalizeMilestonePlan,
  validateMilestonePlan,
} from "@/components/admin/MilestonePlanEditor";

function makeMilestoneDraft(milestone = {}) {
  const source = milestone && typeof milestone === "object" ? milestone : {};
  const normalized = normalizeMilestonePlan([source])[0];
  const originalTasks = Array.isArray(source.tasks) ? source.tasks : [];

  return {
    ...normalized,
    // Editing one milestone must not move it within the project.
    order: Number.isFinite(Number(source.order))
      ? Number(source.order)
      : 0,
    tasks: normalized.tasks.map((task, index) => ({
      ...task,
      order: Number.isFinite(Number(originalTasks[index]?.order))
        ? Number(originalTasks[index].order)
        : index,
    })),
  };
}

/**
 * Admin-only agreed-change dialog. The parent supplies authorization/persistence;
 * this component enforces the UX contract and returns a narrow mutation payload.
 */
export function MilestoneEditorDialog({
  open,
  onOpenChange,
  milestone,
  onSubmit,
  isSubmitting = false,
  sourceMessages = [],
  dialogTitle = "Edit milestone",
}) {
  const sourceListId = useId();
  const [draft, setDraft] = useState(() => makeMilestoneDraft(milestone));
  const [changeSummary, setChangeSummary] = useState("");
  const [sourceMessageId, setSourceMessageId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setDraft(makeMilestoneDraft(milestone));
    setChangeSummary("");
    setSourceMessageId("");
    setConfirmed(false);
    setError("");
    // Avoid overwriting an in-progress edit when a project query refetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, milestone?._id]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    const validation = validateMilestonePlan([draft]);
    if (!validation.valid) {
      setError(validation.errors[0]?.message || "Check the milestone and tasks.");
      return;
    }
    if (!changeSummary.trim()) {
      setError("Describe the agreed change before saving.");
      return;
    }
    if (!confirmed) {
      setError("Confirm that this is the agreed client change.");
      return;
    }

    const normalized = normalizeMilestonePlan([draft])[0];
    setError("");
    await onSubmit?.({
      milestone: {
        ...normalized,
        _id: draft._id,
        order: draft.order,
      },
      changeSummary: changeSummary.trim(),
      sourceMessageId: sourceMessageId.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto border-white/10 bg-[#1a1a1b] text-white">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription className="text-gray-400">
            Update the live milestone only after the change has been agreed. The
            accepted proposal snapshot remains unchanged.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-5">
          <MilestonePlanEditor
            value={[draft]}
            onChange={(milestones) => {
              if (milestones[0]) setDraft(milestones[0]);
            }}
            mode="operational"
            allowAddMilestones={false}
            allowRemoveMilestones={false}
            heading="Milestone & tasks"
            description="Existing milestone and task IDs are preserved when this change is saved."
          />

          <div>
            <Label className="text-white">
              Agreed change summary <span className="text-red-400">*</span>
            </Label>
            <Textarea
              value={changeSummary}
              onChange={(event) => setChangeSummary(event.target.value)}
              rows={3}
              placeholder="Describe what was agreed and what changed…"
              className="mt-1 border-white/10 bg-white/5 text-white"
            />
          </div>

          <div>
            <Label className="text-white">Source message ID (optional)</Label>
            <Input
              list={sourceMessages.length > 0 ? sourceListId : undefined}
              value={sourceMessageId}
              onChange={(event) => setSourceMessageId(event.target.value)}
              placeholder="Message that initiated this change"
              className="mt-1 border-white/10 bg-white/5 text-white"
            />
            {sourceMessages.length > 0 && (
              <datalist id={sourceListId}>
                {sourceMessages.map((message) => (
                  <option key={message._id} value={message._id}>
                    {message.body || message._id}
                  </option>
                ))}
              </datalist>
            )}
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#FFB633]/20 bg-[#FFB633]/5 p-3">
            <Checkbox
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked === true)}
              className="mt-0.5 border-[#FFB633] data-[state=checked]:bg-[#FFB633] data-[state=checked]:text-black"
            />
            <span className="text-sm text-gray-300">
              I confirm this is the agreed change and should update the live
              project milestone.
            </span>
          </label>

          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange?.(false)}
              disabled={isSubmitting}
              className="border-white/20 text-gray-300 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !confirmed || !changeSummary.trim()}
              className="bg-[#FFB633] text-black hover:bg-[#e5a32e]"
            >
              {isSubmitting ? "Saving…" : "Save agreed change"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default MilestoneEditorDialog;
