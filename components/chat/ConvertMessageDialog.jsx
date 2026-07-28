"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useClientProject } from "@/hooks/useClientProjects";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const ITEM_KIND_OPTIONS = [
  { value: "idea", label: "Idea" },
  { value: "problem", label: "Problem" },
  { value: "incident", label: "Incident" },
  { value: "decision", label: "Decision" },
];
const SEVERITY_OPTIONS = ["low", "medium", "high", "critical"];

// A first sentence/line, capped — same default-title derivation the server
// already uses when converting a ContactMessage into a ProjectRequest, kept
// consistent here for the chat-message equivalent.
function deriveTitle(body) {
  return (body || "").split(/[.\n]/)[0].slice(0, 80).trim();
}

/**
 * "Convert to…" — one dialog, target chosen first (item is open to whoever
 * captured the message; request/task/milestone comment need convertToFormal,
 * i.e. owner or admin). `onConvert` is the caller's already-scoped
 * convertMessage.mutateAsync — this component never talks to the API
 * directly, so it never risks opening a second, differently-keyed query for
 * the same channel.
 */
export function ConvertMessageDialog({
  message,
  canConvertToItem,
  canConvertToFormal,
  onConvert,
  open,
  onOpenChange,
}) {
  const targetOptions = [
    canConvertToItem && { value: "item", label: "Idea / Problem / Incident / Decision" },
    canConvertToFormal && { value: "request", label: "Project request" },
    canConvertToFormal && { value: "task", label: "Milestone task" },
    canConvertToFormal && { value: "milestone_comment", label: "Milestone comment" },
  ].filter(Boolean);

  const [target, setTarget] = useState(targetOptions[0]?.value || "item");
  const [kind, setKind] = useState("idea");
  const [severity, setSeverity] = useState("low");
  const [title, setTitle] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const needsMilestone = target === "task" || target === "milestone_comment";
  const showSeverity = target === "item" && (kind === "problem" || kind === "incident");

  // Only fetched while actually needed — a plain "save as idea" never loads
  // the project's milestone list.
  const { data: project } = useClientProject(
    needsMilestone && open ? message?.projectId : null,
  );
  const milestones = project?.milestones || [];

  useEffect(() => {
    if (!open) return;
    setTarget(targetOptions[0]?.value || "item");
    setKind("idea");
    setSeverity("low");
    setBodyText(message?.body || "");
    setTitle(deriveTitle(message?.body));
    setMilestoneId("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, message?._id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { messageId: message._id, target, body: bodyText };
      if (target === "item") {
        payload.kind = kind;
        payload.severity = severity;
        payload.title = title;
      } else if (target === "request") {
        payload.title = title;
      } else if (target === "task") {
        payload.milestoneId = milestoneId;
        payload.title = title;
      } else {
        payload.milestoneId = milestoneId;
      }
      const result = await onConvert(payload);
      const label =
        target === "item"
          ? `Saved as ${result?.created?.ref || "an item"}`
          : target === "request"
            ? "Converted to a project request"
            : target === "task"
              ? "Converted to a milestone task"
              : "Added to the milestone thread";
      toast.success(label);
      onOpenChange(false);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to convert message");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1a1b] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle>Convert message</DialogTitle>
          <DialogDescription className="text-gray-400">
            Turn this message into a formal record. It stays linked back to
            the original conversation.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-white">Convert to</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {targetOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {target === "item" && (
            <div>
              <Label className="text-white">Kind</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_KIND_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showSeverity && (
            <div>
              <Label className="text-white">Severity</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITY_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {needsMilestone && (
            <div>
              <Label className="text-white">Milestone</Label>
              <Select value={milestoneId} onValueChange={setMilestoneId}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                  <SelectValue placeholder="Select a milestone" />
                </SelectTrigger>
                <SelectContent>
                  {milestones.map((m) => (
                    <SelectItem key={m._id} value={m._id}>
                      {m.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {target !== "milestone_comment" && (
            <div>
              <Label className="text-white">Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
          )}

          <div>
            <Label className="text-white">
              {target === "milestone_comment" ? "Comment" : "Details"}
            </Label>
            <Textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              rows={4}
              className="bg-white/5 border-white/10 text-white mt-1"
            />
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={submitting || (needsMilestone && !milestoneId)}
              className="bg-[#FFB633] text-black hover:bg-[#e5a32e]"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Convert"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ConvertMessageDialog;
