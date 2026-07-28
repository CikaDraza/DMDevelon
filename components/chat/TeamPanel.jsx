"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useProjectMembers } from "@/hooks/useProjectMembers";
import { InviteMemberDialog } from "./InviteMemberDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Loader2,
  LogOut,
  Mail,
  RotateCw,
  UserPlus,
  XCircle,
} from "lucide-react";

/**
 * Active members (email visible only to owner/admin — the server already
 * withholds it otherwise, this just renders whatever comes back) + pending
 * invitations with Resend/Revoke + a Leave action for the viewer's own row.
 */
export function TeamPanel({ projectId, open, onOpenChange }) {
  const { user } = useAuth();
  const {
    members,
    invitations,
    isLoading,
    resendInvitation,
    revokeInvitation,
    removeMember,
    leaveProject,
  } = useProjectMembers(projectId);
  const [inviteOpen, setInviteOpen] = useState(false);

  const isSelf = (userId) => userId === user?._id;

  const handleResend = async (id) => {
    try {
      await resendInvitation.mutateAsync(id);
      toast.success("Invitation resent");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to resend invitation");
    }
  };

  const handleRevoke = async (id) => {
    try {
      await revokeInvitation.mutateAsync(id);
      toast.success("Invitation revoked");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to revoke invitation");
    }
  };

  const handleRemove = async (memberId) => {
    if (!window.confirm("Remove this person from the project?")) return;
    try {
      await removeMember.mutateAsync(memberId);
      toast.success("Member removed");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to remove member");
    }
  };

  const handleLeave = async () => {
    if (!window.confirm("Leave this project? You'll lose access to its chat."))
      return;
    try {
      await leaveProject.mutateAsync();
      toast.success("You left the project");
      onOpenChange(false);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to leave the project");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-[#1a1a1b] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Team</DialogTitle>
          </DialogHeader>

          <Button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="bg-[#FFB633] text-black hover:bg-[#e5a32e] w-fit"
          >
            <UserPlus className="w-4 h-4 mr-2" /> Invite team member
          </Button>

          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  Active members
                </p>
                <div className="space-y-2">
                  {members.map((m) => {
                    // The owner and every global admin are listed here too
                    // (so a client can DM them directly), but neither is a
                    // real, removable ProjectMember row — there's nothing
                    // for Remove/Leave to act on.
                    const manageable = m.role !== "owner" && m.role !== "admin";
                    return (
                      <div
                        key={m.userId}
                        className="flex items-center justify-between gap-2 bg-white/5 rounded-lg px-3 py-2"
                      >
                        <div className="min-w-0 flex items-center gap-1.5">
                          <span
                            className={cn(
                              "w-2 h-2 rounded-full shrink-0",
                              m.isOnline ? "bg-green-500" : "bg-gray-600",
                            )}
                            title={m.isOnline ? "Online" : "Offline"}
                          />
                          <div className="min-w-0">
                            <p className="text-sm text-white truncate">
                              {m.name}
                              {isSelf(m.userId) ? " (you)" : ""}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {m.roleLabel}
                              {m.email ? ` · ${m.email}` : ""}
                            </p>
                          </div>
                        </div>
                        {manageable && isSelf(m.userId) && (
                          <button
                            type="button"
                            onClick={handleLeave}
                            className="text-xs text-red-400 hover:underline shrink-0 flex items-center gap-1"
                          >
                            <LogOut className="w-3.5 h-3.5" /> Leave
                          </button>
                        )}
                        {manageable && !isSelf(m.userId) && (
                          <button
                            type="button"
                            onClick={() => handleRemove(m._id)}
                            className="text-xs text-gray-500 hover:text-red-400 shrink-0"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {invitations.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                    Pending invitations
                  </p>
                  <div className="space-y-2">
                    {invitations.map((inv) => (
                      <div
                        key={inv._id}
                        className="flex items-center justify-between gap-2 bg-white/5 rounded-lg px-3 py-2"
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm text-white truncate">
                              {inv.email}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {inv.intendedRoleLabel} · invited by{" "}
                              {inv.invitedByName}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleResend(inv._id)}
                            title="Resend"
                            className="text-gray-500 hover:text-[#FFB633]"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRevoke(inv._id)}
                            title="Revoke"
                            className="text-gray-500 hover:text-red-400"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <InviteMemberDialog
        projectId={projectId}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
      />
    </>
  );
}

export default TeamPanel;
