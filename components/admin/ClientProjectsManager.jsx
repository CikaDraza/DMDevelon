"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";
import { useClientProjects } from "@/hooks/useClientProjects";
import { useProjectProposals } from "@/hooks/useProjectProposals";
import { useNotifications } from "@/hooks/useNotifications";
import { useCardHighlight } from "@/hooks/useCardHighlight";
import ProposalEditorDialog from "@/components/admin/ProposalEditorDialog";
import DeletePhaseDialog from "@/components/admin/DeletePhaseDialog";
import MilestoneEditorDialog from "@/components/admin/MilestoneEditorDialog";
import {
  MilestonePlanEditor,
  createEmptyMilestone,
  normalizeMilestonePlan,
  validateMilestonePlan,
} from "@/components/admin/MilestonePlanEditor";
import { MilestoneChat } from "@/components/dashboard/MilestoneChat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Plus,
  Edit,
  Trash2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Check,
  CircleDot,
  Circle,
  Eye,
  FileText,
  RotateCcw,
  Send,
} from "lucide-react";

const STATUS_BADGE = {
  planning: "bg-purple-500/20 text-purple-300",
  in_progress: "bg-blue-500/20 text-blue-400",
  on_hold: "bg-yellow-500/20 text-yellow-400",
  completed: "bg-green-500/20 text-green-400",
};

const ITEM_STATUS = ["pending", "in_progress", "completed"];
const ITEM_STATUS_ICON = {
  completed: <Check className="w-4 h-4 text-green-400" />,
  in_progress: <CircleDot className="w-4 h-4 text-blue-400" />,
  pending: <Circle className="w-4 h-4 text-gray-500" />,
};

const PROPOSAL_STATUS_BADGE = {
  draft: "bg-gray-500/20 text-gray-300",
  sent: "bg-blue-500/20 text-blue-300",
  changes_requested: "bg-amber-500/20 text-amber-300",
  accepted: "bg-green-500/20 text-green-300",
  rejected: "bg-red-500/20 text-red-300",
  archived: "bg-purple-500/20 text-purple-300",
};

function sortProposals(items) {
  return [...items].sort((a, b) => {
    if (a.kind === "master" && b.kind !== "master") return -1;
    if (b.kind === "master" && a.kind !== "master") return 1;
    return (a.phaseNumber || 0) - (b.phaseNumber || 0);
  });
}

function phaseWorkHasStarted(milestones, proposalId) {
  return (milestones || []).some(
    (milestone) =>
      String(milestone.proposalId || "") === String(proposalId || "") &&
      (milestone.workStartedAt ||
        ![undefined, null, "", "pending"].includes(milestone.status) ||
        (milestone.tasks || []).some(
          (task) =>
            task.workStartedAt ||
            ![undefined, null, "", "pending"].includes(task.status),
        ) ||
        (milestone.changeHistory || []).length > 0),
  );
}

function getProposalMilestonePlan(proposal) {
  return normalizeMilestonePlan(
    proposal?.milestonePlan || proposal?.milestones || [],
  );
}

function ProjectProposalsAdmin({
  project,
  highlightProposalId,
  onPhaseDeleted,
}) {
  const { markRead } = useNotifications();
  const {
    proposals,
    isLoading,
    error,
    createProposal,
    updateProposal,
    sendProposal,
    archiveProposal,
    createRevision,
  } = useProjectProposals(project._id);
  const [editor, setEditor] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const openedHighlight = useRef(null);

  const sorted = useMemo(() => sortProposals(proposals), [proposals]);
  const nextPhaseNumber = Math.max(
    2,
    ...sorted.map((proposal) => (proposal.phaseNumber || 0) + 1),
  );
  const isSaving =
    createProposal.isPending ||
    updateProposal.isPending ||
    createRevision.isPending;

  useEffect(() => {
    if (
      !highlightProposalId ||
      openedHighlight.current === highlightProposalId ||
      !sorted.length
    ) {
      return;
    }
    const proposal = sorted.find((item) => item._id === highlightProposalId);
    if (!proposal) return;
    openedHighlight.current = highlightProposalId;
    markRead.mutate({
      entityId: project._id,
      proposalId: highlightProposalId,
    });
    const timer = setTimeout(() => {
      document
        .getElementById(`proposal-${proposal._id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      setEditor({ proposal, readOnly: true });
    }, 150);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightProposalId, sorted, project._id]);

  const openNew = () => {
    setEditor({
      proposal: {
        kind: "phase",
        phaseNumber: nextPhaseNumber,
        phaseLabel: `Faza ${nextPhaseNumber}`,
        title: `Faza ${nextPhaseNumber}`,
        scope: "",
        timeline: "",
        budget: "",
        milestonePlan: [],
      },
      readOnly: false,
    });
  };

  const handleSave = async (data) => {
    try {
      if (editor?.sourceProposalId) {
        await createRevision.mutateAsync({
          proposalId: editor.sourceProposalId,
          data,
        });
        toast.success(
          editor?.addMilestoneMode
            ? "Milestone proposal draft created"
            : "Proposal revision created",
        );
      } else if (editor?.proposal?._id) {
        await updateProposal.mutateAsync({
          proposalId: editor.proposal._id,
          data,
        });
        toast.success("Proposal draft updated");
      } else {
        await createProposal.mutateAsync(data);
        toast.success("Proposal draft created");
      }
      setEditor(null);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save proposal");
    }
  };

  const handleSend = async (proposal) => {
    try {
      await sendProposal.mutateAsync({ proposalId: proposal._id });
      toast.success("Proposal sent to the client");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to send proposal");
    }
  };

  const handleDeletePhase = async (data) => {
    if (!deleteTarget?._id) return;
    const target = deleteTarget;
    try {
      const result = await archiveProposal.mutateAsync({
        proposalId: target._id,
        data,
      });
      onPhaseDeleted?.(target._id, result);
      setDeleteTarget(null);
      toast.success("Phase removed from the live project");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete phase");
    }
  };

  const openRevision = (proposal) => {
    setEditor({
      sourceProposalId: proposal._id,
      proposal: {
        ...proposal,
        _id: undefined,
        kind: "phase",
        phaseNumber: nextPhaseNumber,
        phaseLabel: `Faza ${nextPhaseNumber}`,
        title: `Faza ${nextPhaseNumber}`,
        status: "draft",
        sentAt: null,
        acceptedAt: null,
        rejectedAt: null,
      },
      readOnly: false,
    });
  };

  const openAddMilestone = (proposal) => {
    const newMilestone = createEmptyMilestone(0);

    if (["draft", "changes_requested"].includes(proposal.status)) {
      const milestonePlan = getProposalMilestonePlan(proposal);
      setEditor({
        addMilestoneMode: true,
        proposal: {
          ...proposal,
          milestonePlan: normalizeMilestonePlan([
            ...milestonePlan,
            { ...newMilestone, order: milestonePlan.length },
          ]),
        },
        readOnly: false,
      });
      return;
    }

    setEditor({
      sourceProposalId: proposal._id,
      addMilestoneMode: true,
      proposal: {
        ...proposal,
        _id: undefined,
        kind: "phase",
        phaseNumber: nextPhaseNumber,
        phaseLabel: `Faza ${nextPhaseNumber}`,
        title: `Faza ${nextPhaseNumber}`,
        status: "draft",
        sentAt: null,
        acceptedAt: null,
        rejectedAt: null,
        archivedAt: null,
        milestonePlan: normalizeMilestonePlan([newMilestone]),
      },
      readOnly: false,
    });
  };

  return (
    <section className="rounded-xl border border-white/10 bg-black/10 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2 font-semibold text-white">
            <FileText className="h-4 w-4 text-[#FFB633]" /> Proposals
          </h4>
          <p className="mt-0.5 text-xs text-gray-500">
            Master scope and all follow-up phases for this project.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={openNew}
          className="bg-[#FFB633] text-black hover:bg-[#e5a32e]"
        >
          <Plus className="mr-1 h-4 w-4" /> Add proposal
        </Button>
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm text-gray-500">Loading proposals…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-red-400">
          Proposals could not be loaded.
        </p>
      ) : sorted.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">
          No proposal snapshots yet. Existing milestones remain available below.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {sorted.map((proposal) => {
            const canEdit = ["draft", "changes_requested"].includes(
              proposal.status,
            );
            const phaseWorkStarted = phaseWorkHasStarted(
              project.milestones,
              proposal._id,
            );
            return (
              <div
                id={`proposal-${proposal._id}`}
                key={proposal._id}
                className={`rounded-lg border p-3 transition-colors ${
                  highlightProposalId === proposal._id
                    ? "border-[#FFB633] bg-[#FFB633]/5"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-white">
                        {proposal.phaseLabel ||
                          (proposal.kind === "master"
                            ? "Master Proposal"
                            : `Faza ${proposal.phaseNumber || ""}`)}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          PROPOSAL_STATUS_BADGE[proposal.status] ||
                          PROPOSAL_STATUS_BADGE.draft
                        }`}
                      >
                        {(proposal.status || "draft").replaceAll("_", " ")}
                      </span>
                      <span className="text-[11px] text-gray-500">
                        v{proposal.version || 1}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-gray-300">
                      {proposal.title || "Untitled proposal"}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {proposal.budget || "No price"} · {proposal.timeline || "No duration"}
                      {" · "}
                      {(proposal.milestonePlan || proposal.milestones || []).length}{" "}
                      milestones
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditor({ proposal, readOnly: true })}
                      className="border-white/15 text-gray-300 hover:text-white"
                    >
                      <Eye className="mr-1 h-3.5 w-3.5" /> View
                    </Button>
                    {canEdit && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditor({ proposal, readOnly: false })}
                          className="border-white/15 text-gray-300 hover:text-white"
                        >
                          <Edit className="mr-1 h-3.5 w-3.5" /> Edit
                        </Button>
                        {proposal.status === "draft" && (
                          <Button
                            type="button"
                            size="sm"
                            disabled={sendProposal.isPending}
                            onClick={() => handleSend(proposal)}
                            className="bg-[#FFB633] text-black hover:bg-[#e5a32e]"
                          >
                            <Send className="mr-1 h-3.5 w-3.5" /> Send
                          </Button>
                        )}
                      </>
                    )}
                    {["accepted", "rejected"].includes(
                      proposal.status,
                    ) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openRevision(proposal)}
                        className="border-white/15 text-gray-300 hover:text-white"
                      >
                        <RotateCcw className="mr-1 h-3.5 w-3.5" /> Create revision
                      </Button>
                    )}
                    {["draft", "changes_requested", "accepted", "rejected"].includes(
                      proposal.status,
                    ) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openAddMilestone(proposal)}
                        className="border-[#FFB633]/30 text-[#FFB633] hover:bg-[#FFB633]/10 hover:text-[#FFD47A]"
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" /> Add milestone
                      </Button>
                    )}
                    {proposal.status === "accepted" &&
                      proposal.kind === "phase" &&
                      Number(proposal.phaseNumber) > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={
                            archiveProposal.isPending || phaseWorkStarted
                          }
                          title={
                            phaseWorkStarted
                              ? "This phase cannot be deleted because work has already started"
                              : "Delete this untouched phase from active work"
                          }
                          onClick={() => setDeleteTarget(proposal)}
                          className="border-red-500/30 text-red-300 hover:bg-red-500/10 hover:text-red-200"
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete phase
                        </Button>
                      )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ProposalEditorDialog
        open={!!editor}
        onOpenChange={(open) => !open && setEditor(null)}
        proposal={editor?.proposal || null}
        onSubmit={handleSave}
        isSubmitting={isSaving}
        readOnly={!!editor?.readOnly}
        dialogTitle={
          editor?.readOnly
            ? editor?.proposal?.phaseLabel || "Proposal"
            : editor?.addMilestoneMode
              ? editor?.sourceProposalId
                ? "Add milestone proposal"
                : "Add milestone to proposal"
            : editor?.sourceProposalId
              ? "Create proposal revision"
              : editor?.proposal?._id
                ? "Edit proposal draft"
                : "Add project proposal"
        }
        dialogDescription={
          editor?.addMilestoneMode && editor?.sourceProposalId
            ? "Create a follow-up proposal with one new milestone. It becomes live after the client accepts it."
            : editor?.addMilestoneMode
              ? "Add another planned milestone to this editable proposal draft."
              : undefined
        }
        submitLabel={
          editor?.addMilestoneMode && editor?.sourceProposalId
            ? "Create milestone proposal"
            : editor?.sourceProposalId
              ? "Create revision"
              : "Save draft"
        }
        showPhaseFields
      />
      <DeletePhaseDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        proposal={deleteTarget}
        affectedMilestoneCount={(project.milestones || []).filter(
          (milestone) => milestone.proposalId === deleteTarget?._id,
        ).length}
        onConfirm={handleDeletePhase}
        isSubmitting={archiveProposal.isPending}
      />
    </section>
  );
}

function computeProgress(project) {
  const milestones = project.milestones || [];
  const allTasks = milestones.flatMap((m) => m.tasks || []);
  if (allTasks.length > 0) {
    const done = allTasks.filter((t) => t.status === "completed").length;
    return Math.round((done / allTasks.length) * 100);
  }
  if (milestones.length > 0) {
    const done = milestones.filter((m) => m.status === "completed").length;
    return Math.round((done / milestones.length) * 100);
  }
  return 0;
}

const emptyForm = {
  status: "in_progress",
  clientUserId: "",
  clientName: "",
  clientEmail: "",
  title: "",
  description: "",
  requirements: "",
  coverImageUrl: "",
  livePreviewUrl: "",
  githubRepoUrl: "",
  category: "",
  color: "blue",
  publishToHomepage: false,
};

export default function ClientProjectsManager({
  highlightId,
  highlightMilestoneId,
  highlightProposalId,
}) {
  const { user, getAuthHeaders } = useAuth();
  const {
    projects,
    isLoading,
    createProject,
    updateProject,
    deleteProject,
    updateMilestone,
    updateTask,
    updateMilestoneAgreed,
    addInitialMilestones,
  } = useClientProjects();
  const { unreadMilestoneIds, unreadByMilestone, markRead } = useNotifications();
  const flashId = useCardHighlight(highlightId, !isLoading);

  const [users, setUsers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [milestones, setMilestones] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [chat, setChat] = useState(null); // { projectId, milestone }
  const [milestoneEdit, setMilestoneEdit] = useState(null); // { projectId, milestone }
  const [initialPlanTarget, setInitialPlanTarget] = useState(null);
  const [initialPlan, setInitialPlan] = useState([]);
  const [initialPlanError, setInitialPlanError] = useState("");

  useEffect(() => {
    axios
      .get("/api/users", { headers: getAuthHeaders() })
      .then((res) => setUsers(res.data || []))
      .catch(() => {});
  }, [getAuthHeaders]);

  // Deep-link from a project_message notification (?id=<project>&m=<milestone>):
  // expand that project, scroll to the milestone and open its chat.
  useEffect(() => {
    if (!highlightMilestoneId || isLoading) return;
    const project = projects.find((p) => p._id === highlightId);
    const milestone = project?.milestones?.find(
      (m) => m._id === highlightMilestoneId,
    );
    if (!project || !milestone) return;
    setExpandedId(project._id);
    const t = setTimeout(() => {
      document
        .getElementById(`ms-${milestone._id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      setChat({ projectId: project._id, milestone });
      markRead.mutate({ entityId: project._id, milestoneId: milestone._id });
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightMilestoneId, highlightId, isLoading]);

  // Proposal notifications open the owning project and let the proposals
  // section handle scrolling/opening the exact proposal snapshot.
  useEffect(() => {
    if (!highlightProposalId || !highlightId || isLoading) return;
    if (projects.some((project) => project._id === highlightId)) {
      setExpandedId(highlightId);
    }
  }, [highlightProposalId, highlightId, isLoading, projects]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setMilestones([]);
    setIsModalOpen(true);
  };

  const openEdit = (project) => {
    setEditingId(project._id);
    setForm({ ...emptyForm, ...project });
    setMilestones(JSON.parse(JSON.stringify(project.milestones || [])));
    setIsModalOpen(true);
  };

  const handleSelectClient = (userId) => {
    const u = users.find((x) => x._id === userId);
    setForm((f) => ({
      ...f,
      clientUserId: userId,
      clientName: u?.name || f.clientName,
      clientEmail: u?.email || f.clientEmail,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    const payload = { ...form, milestones };
    try {
      if (editingId) {
        await updateProject.mutateAsync({ id: editingId, data: payload });
        toast.success("Project updated");
      } else {
        await createProject.mutateAsync(payload);
        toast.success("Project created");
      }
      setIsModalOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save project");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this client project and its conversations?")) return;
    try {
      await deleteProject.mutateAsync(id);
      toast.success("Project deleted");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete");
    }
  };

  // --- Granular (PATCH) quick progress updates on the live project ---
  const cycleMilestoneStatus = async (projectId, m) => {
    const next =
      ITEM_STATUS[(ITEM_STATUS.indexOf(m.status) + 1) % ITEM_STATUS.length];
    try {
      await updateMilestone.mutateAsync({
        id: projectId,
        mid: m._id,
        data: { status: next },
      });
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update");
    }
  };

  const cycleTaskStatus = async (projectId, mid, t) => {
    const next =
      ITEM_STATUS[(ITEM_STATUS.indexOf(t.status) + 1) % ITEM_STATUS.length];
    try {
      await updateTask.mutateAsync({
        id: projectId,
        mid,
        tid: t._id,
        data: { status: next },
      });
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update");
    }
  };

  const handleMilestoneAgreedChange = async (payload) => {
    if (!milestoneEdit) return;
    try {
      const result = await updateMilestoneAgreed.mutateAsync({
        id: milestoneEdit.projectId,
        mid: milestoneEdit.milestone._id,
        data: payload,
      });
      const updatedProject = result?.project || result;
      const updatedMilestone = updatedProject?.milestones?.find(
        (item) => item._id === milestoneEdit.milestone._id,
      );
      if (updatedMilestone && chat?.milestone?._id === updatedMilestone._id) {
        setChat({ projectId: milestoneEdit.projectId, milestone: updatedMilestone });
      }
      setMilestoneEdit(null);
      toast.success("Agreed milestone change saved");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update milestone");
    }
  };

  const openInitialMilestones = (project) => {
    setInitialPlanTarget(project);
    setInitialPlan([createEmptyMilestone(0)]);
    setInitialPlanError("");
  };

  const closeInitialMilestones = () => {
    setInitialPlanTarget(null);
    setInitialPlan([]);
    setInitialPlanError("");
  };

  const handleInitialMilestonesSubmit = async (event) => {
    event.preventDefault();
    if (!initialPlanTarget) return;

    const normalized = normalizeMilestonePlan(initialPlan);
    const validation = validateMilestonePlan(normalized);
    if (!validation.valid) {
      setInitialPlanError(
        validation.errors[0]?.message || "Check the milestone plan.",
      );
      return;
    }
    if (normalized.length === 0) {
      setInitialPlanError("Add at least one milestone.");
      return;
    }

    try {
      await addInitialMilestones.mutateAsync({
        id: initialPlanTarget._id,
        data: { milestones: normalized },
      });
      closeInitialMilestones();
      toast.success("Initial milestones added");
    } catch (err) {
      setInitialPlanError("");
      toast.error(err.response?.data?.error || "Failed to add milestones");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Client Projects</h2>
          <p className="text-gray-400 text-sm mt-1">
            Create engagements and track progress clients can follow.
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-[#FFB633] text-black hover:bg-[#e5a32e]"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>

      {isLoading ? (
        <div className="text-gray-400">Loading projects…</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 bg-[#1a1a1b] rounded-xl border border-white/10">
          <p className="text-gray-400">No client projects yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map((project) => {
            const progress = computeProgress(project);
            const expanded = expandedId === project._id;
            return (
              <div
                key={project._id}
                id={`card-${project._id}`}
                className={`bg-[#1a1a1b] rounded-xl border transition-colors ${
                  flashId === project._id
                    ? "border-[#FFB633] ring-2 ring-[#FFB633]"
                    : "border-white/10"
                }`}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-lg font-semibold text-white">
                          {project.title}
                        </h3>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            STATUS_BADGE[project.status] || STATUS_BADGE.planning
                          }`}
                        >
                          {project.status.replace("_", " ")}
                        </span>
                        {project.publishToHomepage && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#FFB633]/20 text-[#FFB633]">
                            on homepage
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm mt-1">
                        {project.clientName || project.clientEmail || "No client"}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => openEdit(project)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(project._id)}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* progress bar */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                      <span>Progress</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#FFB633] rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      setExpandedId(expanded ? null : project._id)
                    }
                    className="mt-4 flex items-center gap-1 text-sm text-[#FFB633] hover:underline"
                  >
                    {expanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                    {expanded ? "Hide" : "Manage"} proposals &amp; milestones (
                    {project.milestones?.length || 0} milestones)
                  </button>
                </div>

                {/* Inline granular progress management (PATCH) */}
                {expanded && (
                  <div className="border-t border-white/10 p-6 space-y-4">
                    <ProjectProposalsAdmin
                      project={project}
                      highlightProposalId={
                        highlightId === project._id ? highlightProposalId : null
                      }
                      onPhaseDeleted={(proposalId) => {
                        if (chat?.milestone?.proposalId === proposalId) {
                          setChat(null);
                        }
                        if (milestoneEdit?.milestone?.proposalId === proposalId) {
                          setMilestoneEdit(null);
                        }
                      }}
                    />

                    {(project.milestones || []).length === 0 && (
                      <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.03] p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-medium text-white">
                              No live milestones yet
                            </p>
                            <p className="mt-1 text-sm text-gray-500">
                              Add the initial live plan here. Later additions
                              should go through a proposal, and agreed changes
                              use Edit milestone.
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => openInitialMilestones(project)}
                            className="bg-[#FFB633] text-black hover:bg-[#e5a32e]"
                          >
                            <Plus className="mr-1 h-4 w-4" />
                            Add initial milestones
                          </Button>
                        </div>
                      </div>
                    )}
                    {[...(project.milestones || [])]
                      .sort((a, b) => (a.order || 0) - (b.order || 0))
                      .map((m) => (
                        <div
                          key={m._id}
                          id={`ms-${m._id}`}
                          className="bg-white/5 rounded-lg p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <button
                              onClick={() => cycleMilestoneStatus(project._id, m)}
                              className="flex items-center gap-2 text-left min-w-0"
                              title="Click to cycle status"
                            >
                              {ITEM_STATUS_ICON[m.status]}
                              <span className="text-white font-medium truncate">
                                {m.title || "Untitled milestone"}
                              </span>
                            </button>
                            <div className="flex items-center gap-2 min-w-0 shrink-0">
                              {unreadByMilestone[m._id]?.body && (
                                <span className="max-w-[150px] truncate rounded-full bg-[#FFB633] text-black text-[10px] font-medium px-2 py-0.5">
                                  {unreadByMilestone[m._id].body}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  setMilestoneEdit({
                                    projectId: project._id,
                                    milestone: m,
                                  })
                                }
                                className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#FFB633]"
                              >
                                <Edit className="w-4 h-4" />
                                Edit milestone
                              </button>
                              <button
                                onClick={() => {
                                  setChat({
                                    projectId: project._id,
                                    milestone: m,
                                  });
                                  if (unreadMilestoneIds.has(m._id))
                                    markRead.mutate({
                                      entityId: project._id,
                                      milestoneId: m._id,
                                    });
                                }}
                                className={`flex items-center gap-1 text-xs ${
                                  unreadMilestoneIds.has(m._id)
                                    ? "text-[#FFB633] animate-pulse"
                                    : "text-gray-400 hover:text-[#FFB633]"
                                }`}
                              >
                                <MessageSquare className="w-4 h-4" />
                                Chat
                              </button>
                            </div>
                          </div>
                          {(m.tasks || []).length > 0 && (
                            <div className="mt-3 pl-6 space-y-2">
                              {[...m.tasks]
                                .sort((a, b) => (a.order || 0) - (b.order || 0))
                                .map((t) => (
                                  <button
                                    key={t._id}
                                    onClick={() =>
                                      cycleTaskStatus(project._id, m._id, t)
                                    }
                                    className="flex items-center gap-2 text-left w-full"
                                    title="Click to cycle status"
                                  >
                                    {ITEM_STATUS_ICON[t.status]}
                                    <span className="text-sm text-gray-300">
                                      {t.title || "Untitled task"}
                                    </span>
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-[#1a1a1b] border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Client Project" : "New Client Project"}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {editingId
                ? "Update project details, assignment, and publishing settings."
                : "Define the project, assign a client, and break it into milestones."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {/* Status */}
            <div>
              <Label className="text-white">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Client */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-white">Client (account)</Label>
                <Select
                  value={form.clientUserId || ""}
                  onValueChange={handleSelectClient}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u._id} value={u._id}>
                        {u.name} — {u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-white">Client email</Label>
                <Input
                  value={form.clientEmail}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, clientEmail: e.target.value }))
                  }
                  placeholder="client@email.com"
                  className="bg-white/5 border-white/10 text-white mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-white">Title</Label>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="Build AI English tutor platform"
                required
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>

            <div>
              <Label className="text-white">Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={3}
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>

            <div>
              <Label className="text-white">Requirements (markdown)</Label>
              <Textarea
                value={form.requirements}
                onChange={(e) =>
                  setForm((f) => ({ ...f, requirements: e.target.value }))
                }
                rows={4}
                placeholder="What the client asked for…"
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>

            {/* Showcase fields only when completed */}
            {form.status === "completed" && (
              <div className="space-y-4 p-4 rounded-lg bg-white/5 border border-white/10">
                <p className="text-sm font-medium text-[#FFB633]">
                  Showcase (for homepage)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-white">Cover image URL</Label>
                    <Input
                      value={form.coverImageUrl}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, coverImageUrl: e.target.value }))
                      }
                      className="bg-white/5 border-white/10 text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Category</Label>
                    <Input
                      value={form.category}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, category: e.target.value }))
                      }
                      placeholder="Web App"
                      className="bg-white/5 border-white/10 text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Live preview URL</Label>
                    <Input
                      value={form.livePreviewUrl}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, livePreviewUrl: e.target.value }))
                      }
                      className="bg-white/5 border-white/10 text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-white">GitHub URL</Label>
                    <Input
                      value={form.githubRepoUrl}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, githubRepoUrl: e.target.value }))
                      }
                      className="bg-white/5 border-white/10 text-white mt-1"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-white">Show on homepage</Label>
                  <Switch
                    checked={form.publishToHomepage}
                    onCheckedChange={(v) =>
                      setForm((f) => ({ ...f, publishToHomepage: v }))
                    }
                  />
                </div>
              </div>
            )}

            {editingId ? (
              <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-gray-400">
                Live milestones are edited individually through the audited
                <span className="text-white"> Edit milestone </span>
                action, where a change summary is required. If this project has
                no live milestones yet, expand it and use
                <span className="text-white"> Add initial milestones</span>.
              </div>
            ) : (
              <MilestonePlanEditor
                value={milestones}
                onChange={setMilestones}
                mode="operational"
                heading="Milestones & tasks"
                description="Define the initial live project plan. Later content edits use the audited milestone action."
              />
            )}

            <Button
              type="submit"
              className="w-full bg-[#FFB633] text-black hover:bg-[#e5a32e]"
            >
              {editingId ? "Save Changes" : "Create Project"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!initialPlanTarget}
        onOpenChange={(open) => {
          if (!open) closeInitialMilestones();
        }}
      >
        <DialogContent className="bg-[#1a1a1b] border-white/10 text-white max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add initial milestones</DialogTitle>
            <DialogDescription className="text-gray-400">
              Create the first live milestone plan for this project. This is
              only available while the project has no live milestones.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleInitialMilestonesSubmit} className="mt-2 space-y-5">
            <MilestonePlanEditor
              value={initialPlan}
              onChange={(next) => {
                setInitialPlan(normalizeMilestonePlan(next));
                setInitialPlanError("");
              }}
              mode="operational"
              heading="Initial milestones & tasks"
              description="These milestones become live immediately for the client."
            />

            {initialPlanError && (
              <p role="alert" className="text-sm text-red-400">
                {initialPlanError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeInitialMilestones}
                disabled={addInitialMilestones.isPending}
                className="border-white/20 text-gray-300 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addInitialMilestones.isPending}
                className="bg-[#FFB633] text-black hover:bg-[#e5a32e]"
              >
                {addInitialMilestones.isPending ? "Saving…" : "Add milestones"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <MilestoneEditorDialog
        open={!!milestoneEdit}
        onOpenChange={(open) => !open && setMilestoneEdit(null)}
        milestone={milestoneEdit?.milestone || null}
        onSubmit={handleMilestoneAgreedChange}
        isSubmitting={updateMilestoneAgreed.isPending}
      />

      {/* Admin chat per milestone */}
      <Sheet open={!!chat} onOpenChange={(o) => !o && setChat(null)}>
        <SheetContent
          side="right"
          className="bg-[#1a1a1b] border-white/10 text-white p-0 w-full sm:max-w-md flex flex-col"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Milestone conversation</SheetTitle>
          </SheetHeader>
          {chat && (
            <MilestoneChat
              projectId={chat.projectId}
              milestone={chat.milestone}
              viewerRole="admin"
              viewerName={user?.name || "Admin"}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
