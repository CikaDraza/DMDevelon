"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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
import MarkdownContent from "@/components/ui/markdown-content";
import { Textarea } from "@/components/ui/textarea";
import {
  MilestonePlanEditor,
  normalizeMilestonePlan,
  validateMilestonePlan,
} from "@/components/admin/MilestonePlanEditor";

function makeDraft(proposal = {}) {
  const source = proposal && typeof proposal === "object" ? proposal : {};

  return {
    ...source,
    kind: source.kind || "phase",
    phaseNumber: Number(source.phaseNumber || 1),
    phaseLabel: source.phaseLabel || "",
    title: source.title || "",
    scope: source.scope || "",
    timeline: source.timeline || "",
    budget: source.budget || "",
    milestonePlan: normalizeMilestonePlan(
      source.milestonePlan || source.milestones || [],
    ),
  };
}

/**
 * Reusable admin dialog for both master and later phase proposal drafts.
 * The parent owns persistence and decides whether the submit means save or send.
 */
export function ProposalEditorDialog({
  open,
  onOpenChange,
  proposal,
  onSubmit,
  isSubmitting = false,
  readOnly = false,
  showPhaseFields = true,
  allowPhaseNumberEdit = false,
  dialogTitle,
  dialogDescription = "Define the scope, commercial terms, and milestone plan for this phase.",
  submitLabel = "Save proposal",
}) {
  const [draft, setDraft] = useState(() => makeDraft(proposal));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setDraft(makeDraft(proposal));
    setError("");
    // Re-seed only when a dialog opens or the selected persisted proposal changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, proposal?._id, proposal?.version, proposal?.phaseNumber]);

  const update = (patch) => setDraft((current) => ({ ...current, ...patch }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (readOnly || isSubmitting) return;

    if (!draft.title.trim()) {
      setError("Proposal title is required.");
      return;
    }
    if (showPhaseFields && !draft.phaseLabel.trim()) {
      setError("Phase label is required.");
      return;
    }

    const validation = validateMilestonePlan(draft.milestonePlan);
    if (!validation.valid) {
      setError(validation.errors[0]?.message || "Check the milestone plan.");
      return;
    }

    setError("");
    await onSubmit?.({
      ...draft,
      phaseNumber: Number(draft.phaseNumber || 1),
      milestonePlan: normalizeMilestonePlan(draft.milestonePlan),
    });
  };

  const title =
    dialogTitle ||
    (readOnly
      ? draft.phaseLabel || draft.title || "Proposal"
      : draft._id
        ? "Edit proposal"
        : "Add proposal");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto border-white/10 bg-[#1a1a1b] text-white">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-gray-400">
            {dialogDescription}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-5">
          {showPhaseFields && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[140px_1fr]">
              <div>
                <Label className="text-white">Phase number</Label>
                <Input
                  type="number"
                  min={1}
                  value={draft.phaseNumber}
                  onChange={(event) =>
                    update({ phaseNumber: Number(event.target.value || 1) })
                  }
                  disabled={readOnly || !allowPhaseNumberEdit}
                  className="mt-1 border-white/10 bg-white/5 text-white"
                />
              </div>
              <div>
                <Label className="text-white">Phase label</Label>
                <Input
                  value={draft.phaseLabel}
                  onChange={(event) =>
                    update({ phaseLabel: event.target.value })
                  }
                  disabled={readOnly}
                  placeholder={
                    draft.phaseNumber === 1
                      ? "Master Proposal"
                      : `Faza ${draft.phaseNumber}`
                  }
                  className="mt-1 border-white/10 bg-white/5 text-white"
                />
              </div>
            </div>
          )}

          <div>
            <Label className="text-white">Title</Label>
            <Input
              value={draft.title}
              onChange={(event) => update({ title: event.target.value })}
              disabled={readOnly}
              className="mt-1 border-white/10 bg-white/5 text-white"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <Label className="text-white">Scope</Label>
              <span className="text-[11px] text-gray-500">
                Markdown supported
              </span>
            </div>
            <Textarea
              value={draft.scope}
              onChange={(event) => update({ scope: event.target.value })}
              disabled={readOnly}
              rows={7}
              placeholder={"What we'll build…\n\n**Deliverables**\n- Feature one\n- Feature two"}
              className="mt-1 border-white/10 bg-white/5 font-mono text-sm text-white"
            />
            {!!draft.scope.trim() && (
              <div className="mt-2 rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="mb-1 text-[11px] uppercase tracking-wide text-gray-500">
                  Preview
                </p>
                <MarkdownContent content={draft.scope} className="text-sm" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-white">Timeline</Label>
              <Input
                value={draft.timeline}
                onChange={(event) => update({ timeline: event.target.value })}
                disabled={readOnly}
                placeholder="10 weeks"
                className="mt-1 border-white/10 bg-white/5 text-white"
              />
            </div>
            <div>
              <Label className="text-white">Budget</Label>
              <Input
                value={draft.budget}
                onChange={(event) => update({ budget: event.target.value })}
                disabled={readOnly}
                placeholder="$4,000"
                className="mt-1 border-white/10 bg-white/5 text-white"
              />
            </div>
          </div>

          <MilestonePlanEditor
            value={draft.milestonePlan}
            onChange={(milestonePlan) => update({ milestonePlan })}
            mode="plan"
            readOnly={readOnly}
          />

          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}

          {!readOnly && (
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
                disabled={isSubmitting}
                className="bg-[#FFB633] text-black hover:bg-[#e5a32e]"
              >
                {isSubmitting ? "Saving…" : submitLabel}
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ProposalEditorDialog;
