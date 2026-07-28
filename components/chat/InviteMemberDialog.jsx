"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { useProjectMembers } from "@/hooks/useProjectMembers";
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

const EMPTY_FORM = {
  email: "",
  intendedRole: "collaborator",
  roleLabel: "",
  personalMessage: "",
};

/**
 * Only Collaborator and Viewer are offered — client_lead/project_admin are
 * reserved roles the server accepts from nowhere in the UI yet (Phase 2).
 */
export function InviteMemberDialog({ projectId, open, onOpenChange }) {
  const { invite } = useProjectMembers(projectId);
  const [form, setForm] = useState(EMPTY_FORM);

  const set = (field) => (value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email.trim()) {
      toast.error("Email is required");
      return;
    }
    try {
      await invite.mutateAsync({
        email: form.email.trim(),
        intendedRole: form.intendedRole,
        roleLabel: form.roleLabel.trim(),
        personalMessage: form.personalMessage.trim(),
      });
      toast.success("Invitation sent");
      setForm(EMPTY_FORM);
      onOpenChange(false);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to send invitation");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1a1b] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle>Invite a team member</DialogTitle>
          <DialogDescription className="text-gray-400">
            They'll get an email with a link to join this project's chat and
            follow its progress.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-white">Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email")(e.target.value)}
              required
              className="bg-white/5 border-white/10 text-white mt-1"
            />
          </div>
          <div>
            <Label className="text-white">Role</Label>
            <Select
              value={form.intendedRole}
              onValueChange={set("intendedRole")}
            >
              <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="collaborator">
                  Collaborator — can chat, comment, upload
                </SelectItem>
                <SelectItem value="viewer">Viewer — read-only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-white">Role label (optional)</Label>
            <Input
              value={form.roleLabel}
              onChange={(e) => set("roleLabel")(e.target.value)}
              placeholder="e.g. Designer, Consultant"
              className="bg-white/5 border-white/10 text-white mt-1"
            />
          </div>
          <div>
            <Label className="text-white">Personal message (optional)</Label>
            <Textarea
              value={form.personalMessage}
              onChange={(e) => set("personalMessage")(e.target.value)}
              rows={3}
              className="bg-white/5 border-white/10 text-white mt-1"
            />
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={invite.isPending}
              className="bg-[#FFB633] text-black hover:bg-[#e5a32e]"
            >
              {invite.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Send invitation"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default InviteMemberDialog;
