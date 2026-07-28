"use client";

import { useEffect, useId, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
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

const STATUS_EXPLAINER = {
  draft: "It was never sent, so the client has never seen it.",
  rejected: "The client refused it, so nothing was ever built from it.",
  archived:
    "Its phase was already removed from active work, so no milestones depend on it.",
};

/**
 * Irreversible removal of a proposal row.
 *
 * A real dialog rather than window.prompt: browsers offer "prevent this page
 * from creating additional dialogs" after the first native prompt, and once
 * that is on, prompt() returns null instantly without ever showing — which
 * made the button look simply broken on the second use.
 */
export default function DeleteProposalForeverDialog({
  open,
  onOpenChange,
  proposal,
  onConfirm,
  isSubmitting = false,
}) {
  const descriptionId = useId();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");

  const label = proposal?.phaseLabel || proposal?.title || "";

  useEffect(() => {
    if (!open) return;
    setTyped("");
    setError("");
  }, [open, proposal?._id]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (typed.trim() !== label.trim()) {
      setError("The name does not match. Nothing has been deleted.");
      return;
    }
    setError("");
    await onConfirm?.(proposal);
  };

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
            Delete “{label}” forever?
          </DialogTitle>
          <DialogDescription id={descriptionId} className="text-gray-400">
            This erases the proposal and its snapshot from the database. Unlike
            “Delete phase”, nothing is kept for audit — there is no undo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <p className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-gray-400">
            {STATUS_EXPLAINER[proposal?.status] ||
              "This proposal has no live work attached to it."}
          </p>

          <div>
            <Label htmlFor="delete-proposal-name" className="text-white">
              Type <span className="text-[#FFB633]">{label}</span> to confirm
            </Label>
            <Input
              id="delete-proposal-name"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoFocus
              autoComplete="off"
              className="mt-1 border-white/10 bg-white/5 text-white"
            />
          </div>

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
              disabled={isSubmitting || typed.trim() !== label.trim()}
            >
              <Trash2 className="h-4 w-4" />
              {isSubmitting ? "Deleting…" : "Delete forever"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
