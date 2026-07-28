"use client";

import { useEffect, useId, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
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

const FORCE_PHRASE = "DELETE STARTED WORK";

export default function DeletePhaseDialog({
  open,
  onOpenChange,
  proposal,
  affectedMilestoneCount = 0,
  // True when this phase has milestones/tasks already started or audited.
  // The server refuses a normal archive in that case, so the dialog switches
  // into the deliberate operator-override mode instead of being unusable.
  workHasStarted = false,
  onConfirm,
  isSubmitting = false,
}) {
  const descriptionId = useId();
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [forcePhrase, setForcePhrase] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setReason("");
    setConfirmed(false);
    setForcePhrase("");
    setError("");
  }, [open, proposal?._id]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (!reason.trim()) {
      setError("Enter the reason agreed with the client.");
      return;
    }
    if (!confirmed) {
      setError("Confirm that this phase should be removed from active work.");
      return;
    }
    if (workHasStarted && forcePhrase.trim() !== FORCE_PHRASE) {
      setError(`Type “${FORCE_PHRASE}” to discard work that has already started.`);
      return;
    }

    setError("");
    await onConfirm?.({
      reason: reason.trim(),
      confirmation: "DELETE",
      ...(workHasStarted
        ? { force: true, forceConfirmation: FORCE_PHRASE }
        : {}),
    });
  };

  const phaseLabel = proposal?.phaseLabel || "this phase";
  const milestoneLabel = `${affectedMilestoneCount} live milestone${
    affectedMilestoneCount === 1 ? "" : "s"
  }`;

  const handleOpenChange = (nextOpen) => {
    if (!nextOpen && isSubmitting) return;
    onOpenChange?.(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        aria-describedby={descriptionId}
        className="border-white/10 bg-[#1a1a1b] text-white"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            Delete {phaseLabel}?
          </DialogTitle>
          <DialogDescription id={descriptionId} className="text-gray-400">
            This removes {milestoneLabel} and their tasks from the active
            project. The accepted proposal snapshot and conversation history
            remain archived for audit.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="delete-phase-reason" className="text-white">
              Reason for deleting this phase{" "}
              <span className="text-red-400">*</span>
            </Label>
            <Textarea
              id="delete-phase-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              maxLength={5000}
              placeholder="Example: Scope was cancelled by mutual agreement with the client."
              className="mt-1 border-white/10 bg-white/5 text-white"
              autoFocus
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
            <Checkbox
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked === true)}
              className="mt-0.5 border-red-400 data-[state=checked]:bg-red-500 data-[state=checked]:text-white"
            />
            <span className="text-sm text-gray-300">
              {workHasStarted
                ? `I confirm that ${phaseLabel} should be removed from the live project even though work on it has already started. This action cannot be undone.`
                : `I confirm that ${phaseLabel} has not started and should be removed from the live project. This action cannot be undone.`}
            </span>
          </label>

          {workHasStarted ? (
            <div className="space-y-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3">
              <p className="flex items-start gap-2 text-sm font-medium text-red-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                This phase has work that already started
              </p>
              <p className="text-xs text-gray-300">
                Removing it discards that progress from the client&apos;s plan.
                No client approval is required — but the reason above is stored
                on the archived phase, and the project activity feed will record
                that started work was discarded.
              </p>
              <div>
                <Label htmlFor="force-phrase" className="text-white">
                  Type <span className="text-red-300">{FORCE_PHRASE}</span> to
                  proceed
                </Label>
                <Input
                  id="force-phrase"
                  value={forcePhrase}
                  onChange={(event) => setForcePhrase(event.target.value)}
                  autoComplete="off"
                  className="mt-1 border-white/10 bg-white/5 text-white"
                />
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-500">
              Nothing in this phase has started yet, so no progress is lost.
            </p>
          )}

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
              variant="destructive"
              disabled={
                isSubmitting ||
                !reason.trim() ||
                !confirmed ||
                (workHasStarted && forcePhrase.trim() !== FORCE_PHRASE)
              }
            >
              <Trash2 className="h-4 w-4" />
              {isSubmitting
                ? "Deleting…"
                : workHasStarted
                  ? "Force delete phase"
                  : "Delete phase"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
