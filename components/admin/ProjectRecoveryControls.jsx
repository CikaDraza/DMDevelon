"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { AlertTriangle, RotateCcw, UserRoundCog } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

const STATUS_LABELS = {
  planning: "Planning",
  on_hold: "On hold",
  in_progress: "In progress",
};

function formatDate(value) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function ProjectRecoveryControls({
  project,
  users,
  restoreProject,
  assignProjectOwner,
}) {
  const { getAuthHeaders } = useAuth();
  const [mode, setMode] = useState(null);
  const [status, setStatus] = useState("in_progress");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [activeCollaborators, setActiveCollaborators] = useState([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const ownerless = Boolean(project.ownerAccountDeletedAt);
  const isDeleted = project.status === "deleted";
  const isSecondaryTransfer = !isDeleted && !ownerless;
  const assignableUsers = useMemo(
    () => (users || []).filter((user) => user.isAdmin !== true),
    [users],
  );
  const activeCollaboratorIds = useMemo(
    () => new Set(activeCollaborators.map((member) => String(member.userId))),
    [activeCollaborators],
  );

  useEffect(() => {
    if (!mode) return;
    let active = true;
    setStatus("in_progress");
    setOwnerUserId(ownerless ? "" : String(project.clientUserId || ""));
    setIsLoadingMembers(true);
    axios
      .get(`/api/client-projects/${project._id}/members`, {
        headers: getAuthHeaders(),
      })
      .then((response) => {
        if (!active) return;
        setActiveCollaborators(
          (response.data?.members || []).filter(
            (member) =>
              member.status === "active" &&
              !["admin", "owner"].includes(member.role),
          ),
        );
      })
      .catch(() => {
        if (active) setActiveCollaborators([]);
      })
      .finally(() => {
        if (active) setIsLoadingMembers(false);
      });
    return () => {
      active = false;
    };
  }, [getAuthHeaders, mode, ownerless, project._id, project.clientUserId]);

  const isSubmitting =
    restoreProject.isPending || assignProjectOwner.isPending;
  const requiresOwner = ownerless || mode === "ownership";

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (requiresOwner && !ownerUserId) {
      toast.error("Choose the new client owner.");
      return;
    }
    try {
      if (mode === "restore") {
        await restoreProject.mutateAsync({
          id: project._id,
          status,
          ownerUserId: ownerUserId || undefined,
        });
        toast.success("Project restored");
      } else {
        await assignProjectOwner.mutateAsync({
          id: project._id,
          ownerUserId,
        });
        toast.success("Project owner updated");
      }
      setMode(null);
    } catch (error) {
      toast.error(
        error.response?.data?.error || "Project recovery could not be completed",
      );
    }
  };

  return (
    <div
      className={`mt-4 ${
        isSecondaryTransfer
          ? "flex justify-end"
          : ownerless
          ? "border border-amber-400/30 bg-amber-400/10"
          : "border border-white/10 bg-white/[0.03]"
      } ${isSecondaryTransfer ? "" : "rounded-lg p-4"}`}
    >
      {ownerless && (
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
          <div>
            <p className="font-medium text-amber-200">
              This project has no active owner
            </p>
            <p className="mt-1 text-sm text-gray-300">
              Last owner: {project.clientName || "Unknown"}
              {project.clientEmail ? ` / ${project.clientEmail}` : ""}
            </p>
            <p className="text-sm text-gray-400">
              Account removed: {formatDate(project.ownerAccountDeletedAt)}
            </p>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {isDeleted && (
          <Button
            type="button"
            size="sm"
            onClick={() => setMode("restore")}
            className="bg-[#FFB633] text-black hover:bg-[#e5a32e]"
          >
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Restore project
          </Button>
        )}
        {!isDeleted && ownerless && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setMode("ownership")}
            className="border-amber-300/40 bg-transparent text-amber-200 hover:bg-amber-300/10"
          >
            <UserRoundCog className="mr-1.5 h-4 w-4" />
            Assign new owner
          </Button>
        )}
        {isSecondaryTransfer && (
          <details className="group text-right">
            <summary className="cursor-pointer list-none text-xs text-gray-500 transition-colors hover:text-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60">
              Transfer owner?
            </summary>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setMode("ownership")}
              className="mt-2 border-amber-300/40 bg-transparent text-amber-200 hover:bg-amber-300/10"
            >
              <UserRoundCog className="mr-1.5 h-4 w-4" />
              Transfer owner
            </Button>
          </details>
        )}
      </div>

      <Dialog open={Boolean(mode)} onOpenChange={(open) => !open && setMode(null)}>
        <DialogContent className="border-white/10 bg-[#1a1a1b] text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {mode === "restore" ? "Restore project" : "Assign new owner"}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Existing milestones, tasks and completed-work history will remain
              unchanged. Future scope changes continue through the reviewed
              project-change flow.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === "restore" && (
              <div>
                <Label htmlFor={`restore-status-${project._id}`}>
                  Active status after restore
                </Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger
                    id={`restore-status-${project._id}`}
                    className="mt-1 border-white/10 bg-white/5"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor={`new-owner-${project._id}`}>New client owner</Label>
              <Select value={ownerUserId} onValueChange={setOwnerUserId}>
                <SelectTrigger
                  id={`new-owner-${project._id}`}
                  className="mt-1 border-white/10 bg-white/5"
                >
                  <SelectValue
                    placeholder={
                      ownerless ? "Choose an existing client" : "Keep current owner"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {assignableUsers.map((user) => (
                    <SelectItem key={user._id} value={user._id}>
                      {user.name} — {user.email}
                      {activeCollaboratorIds.has(String(user._id))
                        ? " (active collaborator)"
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-2 text-xs text-gray-500">
                A new client must register or accept an invitation before they
                can be selected here. Global admins cannot be client owners.
              </p>
            </div>

            <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
              <p className="text-sm font-medium text-white">
                Active collaborators
              </p>
              {isLoadingMembers ? (
                <p className="mt-1 text-sm text-gray-500">Loading…</p>
              ) : activeCollaborators.length ? (
                <ul className="mt-2 space-y-1 text-sm text-gray-300">
                  {activeCollaborators.map((member) => (
                    <li key={member._id}>
                      {member.name || member.email || "Project collaborator"} —{" "}
                      {member.roleLabel || member.role}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-gray-500">
                  No active collaborators.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setMode(null)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#FFB633] text-black hover:bg-[#e5a32e]"
              >
                {isSubmitting
                  ? "Saving…"
                  : mode === "restore"
                    ? "Restore project"
                    : "Assign owner"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
