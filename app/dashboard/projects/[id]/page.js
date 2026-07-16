"use client";

import { Fragment, useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MarkdownContent from "@/components/ui/markdown-content";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  useClientProject,
  useClientProjects,
} from "@/hooks/useClientProjects";
import { useProjectProposals } from "@/hooks/useProjectProposals";
import { useNotifications } from "@/hooks/useNotifications";
import { ProjectTimeline } from "@/components/ui/project-timeline";
import { MilestoneChat } from "@/components/dashboard/MilestoneChat";
import MilestoneEditorDialog from "@/components/admin/MilestoneEditorDialog";
import ProposalEditorDialog from "@/components/admin/ProposalEditorDialog";
import DeletePhaseDialog from "@/components/admin/DeletePhaseDialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ArrowLeft,
  MessageSquare,
  Check,
  CheckCircle2,
  CircleDot,
  Circle,
  Edit,
  ExternalLink,
  FileText,
  Github,
  Activity,
  ChevronDown,
  ChevronUp,
  Plus,
  RotateCcw,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";

function eventTimeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const STATUS_BADGE = {
  planning: "bg-purple-500/20 text-purple-300",
  in_progress: "bg-blue-500/20 text-blue-400",
  on_hold: "bg-yellow-500/20 text-yellow-400",
  completed: "bg-green-500/20 text-green-400",
};

const ITEM_ICON = {
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

const markdownComponents = {
  h2: ({ children }) => (
    <h2 className="text-xl font-bold text-white mt-4 mb-2">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg font-semibold text-white mt-3 mb-1">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-gray-300 mb-3 leading-relaxed">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-inside text-gray-300 mb-3 space-y-1">
      {children}
    </ul>
  ),
  ol: ({ node, children, ...props }) => (
    <ol
      {...props}
      className="list-decimal list-inside text-gray-300 mb-3 space-y-1"
    >
      {children}
    </ol>
  ),
  a: ({ href, children }) => (
    <a href={href} className="text-[#FFB633] hover:underline">
      {children}
    </a>
  ),
  code: ({ inline, children }) =>
    inline ? (
      <code className="bg-white/10 text-[#FFB633] px-1 rounded">
        {children}
      </code>
    ) : (
      <code className="block bg-[#0f0f10] p-3 rounded-lg overflow-x-auto text-gray-300">
        {children}
      </code>
    ),
};

function ClientProjectDetailInner() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { data: project, isLoading, error } = useClientProject(id);
  const { updateMilestoneAgreed } = useClientProjects();
  const {
    proposals,
    isLoading: proposalsLoading,
    error: proposalsError,
    createProposal,
    updateProposal,
    sendProposal,
    createRevision,
    acceptProposal,
    requestChanges,
    rejectProposal,
    archiveProposal,
  } = useProjectProposals(id);

  const [selectedMilestoneId, setSelectedMilestoneId] = useState(null);
  const [chatMilestone, setChatMilestone] = useState(null);
  const [milestoneEdit, setMilestoneEdit] = useState(null);
  const [proposalEditor, setProposalEditor] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [openProposalId, setOpenProposalId] = useState(null);
  const [changeProposalId, setChangeProposalId] = useState(null);
  const [changeMessage, setChangeMessage] = useState("");
  const [proposalActionId, setProposalActionId] = useState(null);
  const openedProposalDeepLink = useRef(null);
  const { markRead, unreadMilestoneIds, unreadByMilestone } = useNotifications();

  const visibleProposals = useMemo(
    () =>
      sortProposals(
        (proposals || []).filter(
          (proposal) => user?.isAdmin || proposal.status !== "draft",
        ),
      ),
    [proposals, user?.isAdmin],
  );
  const nextPhaseNumber = useMemo(
    () =>
      Math.max(
        2,
        ...(proposals || []).map(
          (proposal) => (proposal.phaseNumber || 0) + 1,
        ),
      ),
    [proposals],
  );
  const proposalEditorSaving =
    createProposal.isPending ||
    updateProposal.isPending ||
    createRevision.isPending;

  // Scope accordion — open by default here (unlike the proposal), and the
  // open/closed choice persists across visits/refreshes.
  const [scopeOpen, setScopeOpen] = useState(true);
  useEffect(() => {
    const stored = localStorage.getItem("projectScopeClosed");
    const closed = stored === null ? false : stored === "true";
    setScopeOpen(!closed);
  }, []);
  const toggleScope = () => {
    setScopeOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("projectScopeClosed", String(!next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    if (!authLoading && !user) router.push("/");
  }, [authLoading, user, router]);

  // Clear non-message notifications (status/task/milestone) for this project on
  // open. Per-milestone chat messages stay unread until their chat is opened.
  useEffect(() => {
    if (id && !searchParams.get("proposal")) {
      markRead.mutate({
        entityId: id,
        excludeMilestones: true,
        excludeProposals: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Proposal notifications open only the referenced proposal and mark only its
  // notifications read. This can coexist with the milestone ?m= deep-link.
  useEffect(() => {
    const proposalId = searchParams.get("proposal");
    if (
      !proposalId ||
      openedProposalDeepLink.current === proposalId ||
      !visibleProposals.some((proposal) => proposal._id === proposalId)
    ) {
      return;
    }
    openedProposalDeepLink.current = proposalId;
    setOpenProposalId(proposalId);
    markRead.mutate({ entityId: id, proposalId });
    const timer = setTimeout(() => {
      document
        .getElementById(`proposal-${proposalId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, searchParams, visibleProposals]);

  // Deep-link from a project_message notification: ?m=<milestoneId> opens that
  // milestone's chat directly and marks its unread message read.
  useEffect(() => {
    const mId = searchParams.get("m");
    if (!mId || !project?.milestones) return;
    const m = project.milestones.find((x) => x._id === mId);
    if (m) {
      setChatMilestone(m);
      markRead.mutate({ entityId: id, milestoneId: mId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?._id, searchParams]);

  const openChat = (m) => {
    setChatMilestone(m);
    if (unreadMilestoneIds.has(m._id))
      markRead.mutate({ entityId: id, milestoneId: m._id });
  };

  const handleSelect = (milestoneId) => {
    setSelectedMilestoneId(milestoneId);
    const el = document.getElementById(`milestone-${milestoneId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const runProposalAction = async (proposalId, action, data, successMessage) => {
    setProposalActionId(proposalId);
    try {
      await action.mutateAsync({ proposalId, data });
      toast.success(successMessage);
      setChangeProposalId(null);
      setChangeMessage("");
    } catch (err) {
      toast.error(err.response?.data?.error || "Proposal action failed");
    } finally {
      setProposalActionId(null);
    }
  };

  const handleRequestChanges = async (proposalId) => {
    const body = changeMessage.trim();
    if (!body) {
      toast.error("Describe the changes you need");
      return;
    }
    await runProposalAction(
      proposalId,
      requestChanges,
      { body },
      "Change request sent",
    );
  };

  const openNewProposal = () => {
    setProposalEditor({
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
    });
  };

  const openProposalRevision = (proposal) => {
    setProposalEditor({
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
    });
  };

  const handleProposalSave = async (data) => {
    try {
      let savedProposal;
      if (proposalEditor?.sourceProposalId) {
        savedProposal = await createRevision.mutateAsync({
          proposalId: proposalEditor.sourceProposalId,
          data,
        });
        toast.success("Proposal revision created");
      } else if (proposalEditor?.proposal?._id) {
        savedProposal = await updateProposal.mutateAsync({
          proposalId: proposalEditor.proposal._id,
          data,
        });
        toast.success("Proposal draft updated");
      } else {
        savedProposal = await createProposal.mutateAsync(data);
        toast.success("Proposal draft created");
      }
      setProposalEditor(null);
      if (savedProposal?._id) setOpenProposalId(savedProposal._id);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save proposal");
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
      const removedIds = new Set(result?.removedMilestoneIds || []);
      if (
        chatMilestone?.proposalId === target._id ||
        removedIds.has(chatMilestone?._id)
      ) {
        setChatMilestone(null);
      }
      if (
        milestoneEdit?.proposalId === target._id ||
        removedIds.has(milestoneEdit?._id)
      ) {
        setMilestoneEdit(null);
      }
      if (removedIds.has(selectedMilestoneId)) {
        setSelectedMilestoneId(null);
      }
      if (openProposalId === target._id) setOpenProposalId(null);

      const params = new URLSearchParams(searchParams.toString());
      if (params.get("proposal") === target._id) params.delete("proposal");
      if (removedIds.has(params.get("m"))) params.delete("m");
      const query = params.toString();
      router.replace(
        `/dashboard/projects/${id}${query ? `?${query}` : ""}`,
        { scroll: false },
      );

      setDeleteTarget(null);
      toast.success("Phase removed from the live project");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete phase");
    }
  };

  const handleMilestoneAgreedChange = async (payload) => {
    if (!milestoneEdit) return;
    try {
      const result = await updateMilestoneAgreed.mutateAsync({
        id: project._id,
        mid: milestoneEdit._id,
        data: payload,
      });
      const updatedProject = result?.project || result;
      const updatedMilestone = updatedProject?.milestones?.find(
        (item) => item._id === milestoneEdit._id,
      );
      if (updatedMilestone && chatMilestone?._id === updatedMilestone._id) {
        setChatMilestone(updatedMilestone);
      }
      setMilestoneEdit(null);
      toast.success("Agreed milestone change saved");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update milestone");
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-[#0f0f10] flex items-center justify-center">
        <div className="text-white">Loading…</div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-[#0f0f10] flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400">Project not found or access denied.</p>
        <Link href="/dashboard" className="text-[#FFB633] hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const milestones = [...(project.milestones || [])].sort(
    (a, b) =>
      (a.phaseNumber || 1) - (b.phaseNumber || 1) ||
      (a.order || 0) - (b.order || 0),
  );
  // ProjectTimeline sorts on order internally. Give it a display-only global
  // order so phase-local order values (0, 1, …) cannot interleave phases.
  const timelineMilestones = milestones.map((milestone, order) => ({
    ...milestone,
    order,
  }));

  return (
    <div className="min-h-screen bg-[#0f0f10]">
      {/* Header */}
      <header className="bg-[#1a1a1b] border-b border-white/10 px-2 lg:px-6 py-4">
        <div className="container mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3">
            <img src="/icons/dmd-logo.png" alt="DMDevelon" className="h-8 w-auto" />
            <div>
              <h1 className="font-bold text-white">DMDevelon</h1>
              <p className="text-xs text-gray-400">Project Progress</p>
            </div>
          </Link>
          <Link
            href="/dashboard"
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Title + status */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <h2 className="text-3xl font-bold text-white">{project.title}</h2>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              STATUS_BADGE[project.status] || STATUS_BADGE.planning
            }`}
          >
            {project.status.replace("_", " ")}
          </span>
        </div>

        {/* Scope (markdown, collapsible — open by default) */}
        {project.description && (
          <div className="mt-6 border border-white/10 rounded-xl overflow-hidden bg-[#1a1a1b]">
            <button
              type="button"
              onClick={toggleScope}
              aria-expanded={scopeOpen}
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/5 transition-colors"
            >
              <span className="text-sm font-semibold text-white">Scope</span>
              {scopeOpen ? (
                <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
              )}
            </button>
            {scopeOpen && (
              <div className="px-5 pb-3">
                <MarkdownContent
                  content={project.description}
                  className="text-sm"
                />
                <button
                  type="button"
                  onClick={toggleScope}
                  className="mt-1 w-full flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-white py-1.5 border-t border-white/5"
                >
                  <ChevronUp className="w-4 h-4" />
                  Collapse
                </button>
              </div>
            )}
          </div>
        )}

        {/* Proposal snapshots and follow-up phases */}
        <section className="mt-8">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h3 className="flex items-center gap-2 text-xl font-bold text-white">
                <FileText className="h-5 w-5 text-[#FFB633]" /> Proposals &amp;
                phases
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Approved scope and every phase planned inside this project.
              </p>
            </div>
            {user?.isAdmin && (
              <Button
                type="button"
                size="sm"
                onClick={openNewProposal}
                disabled={proposalsLoading || !!proposalsError}
                className="shrink-0 bg-[#FFB633] text-black hover:bg-[#e5a32e]"
              >
                <Plus className="mr-1.5 h-4 w-4" /> Add proposal
              </Button>
            )}
          </div>

          {proposalsLoading ? (
            <div className="rounded-xl border border-white/10 bg-[#1a1a1b] p-5 text-sm text-gray-500">
              Loading proposals…
            </div>
          ) : proposalsError ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-300">
              Proposals could not be loaded. Project progress is still available
              below.
            </div>
          ) : visibleProposals.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-[#1a1a1b] p-5 text-sm text-gray-500">
              This is an existing project scope. Its milestones remain available
              below.
            </div>
          ) : (
            <div className="space-y-3">
              {visibleProposals.map((proposal) => {
                const isOpen = openProposalId === proposal._id;
                const plan = proposal.milestonePlan || proposal.milestones || [];
                const actionPending = proposalActionId === proposal._id;
                const phaseWorkStarted = phaseWorkHasStarted(
                  project.milestones,
                  proposal._id,
                );
                return (
                  <article
                    id={`proposal-${proposal._id}`}
                    key={proposal._id}
                    className={`overflow-hidden rounded-xl border bg-[#1a1a1b] transition-colors ${
                      searchParams.get("proposal") === proposal._id
                        ? "border-[#FFB633]/70 ring-1 ring-[#FFB633]/30"
                        : "border-white/10"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setOpenProposalId(isOpen ? null : proposal._id)
                      }
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-white/5"
                    >
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-white">
                            {proposal.phaseLabel ||
                              (proposal.kind === "master"
                                ? "Master Proposal"
                                : `Faza ${proposal.phaseNumber || ""}`)}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              PROPOSAL_STATUS_BADGE[proposal.status] ||
                              PROPOSAL_STATUS_BADGE.sent
                            }`}
                          >
                            {(proposal.status || "sent").replaceAll("_", " ")}
                          </span>
                          <span className="text-[11px] text-gray-500">
                            v{proposal.version || 1}
                          </span>
                        </span>
                        <span className="mt-1 block truncate text-sm text-gray-300">
                          {proposal.title || "Proposal"}
                        </span>
                      </span>
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4 shrink-0 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
                      )}
                    </button>

                    {isOpen && (
                      <div className="space-y-5 border-t border-white/10 px-5 py-5">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="rounded-lg bg-white/5 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-gray-500">
                              Price
                            </p>
                            <p className="mt-1 text-sm text-white">
                              {proposal.budget || "—"}
                            </p>
                          </div>
                          <div className="rounded-lg bg-white/5 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-gray-500">
                              Duration
                            </p>
                            <p className="mt-1 text-sm text-white">
                              {proposal.timeline || "—"}
                            </p>
                          </div>
                        </div>

                        {proposal.scope && (
                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                              Scope
                            </p>
                            <MarkdownContent
                              content={proposal.scope}
                              className="text-sm"
                            />
                          </div>
                        )}

                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Planned milestones ({plan.length})
                          </p>
                          {plan.length === 0 ? (
                            <p className="text-sm text-gray-500">
                              No milestone plan was included in this legacy
                              proposal.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {[...plan]
                                .sort((a, b) => (a.order || 0) - (b.order || 0))
                                .map((milestone, index) => (
                                  <div
                                    key={milestone._id || `${proposal._id}-${index}`}
                                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="text-sm text-gray-200">
                                        {milestone.title || `Milestone ${index + 1}`}
                                      </span>
                                      <span className="shrink-0 text-[11px] text-gray-500">
                                        {(milestone.tasks || []).length} tasks
                                      </span>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>

                        {user?.isAdmin && (
                          <div className="space-y-3 border-t border-white/10 pt-4">
                            <p className="text-xs text-gray-500">
                              Proposal milestones and tasks become live project
                              work only after the client accepts this phase.
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {["draft", "changes_requested"].includes(
                                proposal.status,
                              ) && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  disabled={actionPending}
                                  onClick={() =>
                                    setProposalEditor({ proposal })
                                  }
                                  className="border-white/20 text-gray-300 hover:text-white"
                                >
                                  <Edit className="mr-1.5 h-4 w-4" /> Edit draft
                                </Button>
                              )}
                              {proposal.status === "draft" && (
                                <Button
                                  type="button"
                                  disabled={actionPending}
                                  onClick={() =>
                                    runProposalAction(
                                      proposal._id,
                                      sendProposal,
                                      {},
                                      "Proposal sent to the client",
                                    )
                                  }
                                  className="bg-[#FFB633] text-black hover:bg-[#e5a32e]"
                                >
                                  <Send className="mr-1.5 h-4 w-4" /> Send
                                </Button>
                              )}
                              {["accepted", "rejected"].includes(
                                proposal.status,
                              ) && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  disabled={actionPending}
                                  onClick={() => openProposalRevision(proposal)}
                                  className="border-white/20 text-gray-300 hover:text-white"
                                >
                                  <RotateCcw className="mr-1.5 h-4 w-4" /> Create
                                  revision
                                </Button>
                              )}
                              {proposal.status === "accepted" &&
                                proposal.kind === "phase" &&
                                Number(proposal.phaseNumber) > 1 && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    disabled={
                                      actionPending ||
                                      archiveProposal.isPending ||
                                      phaseWorkStarted
                                    }
                                    title={
                                      phaseWorkStarted
                                        ? "This phase cannot be deleted because work has already started"
                                        : "Delete this untouched phase from active work"
                                    }
                                    onClick={() => setDeleteTarget(proposal)}
                                    className="border-red-500/30 text-red-300 hover:bg-red-500/10 hover:text-red-200"
                                  >
                                    <Trash2 className="mr-1.5 h-4 w-4" />
                                    Delete phase
                                  </Button>
                                )}
                            </div>
                          </div>
                        )}

                        {!user?.isAdmin && proposal.status === "sent" && (
                          <div className="space-y-3 border-t border-white/10 pt-4">
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                disabled={actionPending}
                                onClick={() =>
                                  runProposalAction(
                                    proposal._id,
                                    acceptProposal,
                                    {},
                                    "Proposal accepted — project plan updated",
                                  )
                                }
                                className="bg-[#FFB633] text-black hover:bg-[#e5a32e]"
                              >
                                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                                Accept proposal
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                disabled={actionPending}
                                onClick={() => {
                                  setChangeProposalId(
                                    changeProposalId === proposal._id
                                      ? null
                                      : proposal._id,
                                  );
                                  setChangeMessage("");
                                }}
                                className="border-white/20 text-gray-300 hover:text-white"
                              >
                                <RotateCcw className="mr-1.5 h-4 w-4" /> Request
                                changes
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                disabled={actionPending}
                                onClick={() => {
                                  if (
                                    confirm(
                                      "Reject this proposal? The project itself will remain available.",
                                    )
                                  ) {
                                    runProposalAction(
                                      proposal._id,
                                      rejectProposal,
                                      {},
                                      "Proposal rejected",
                                    );
                                  }
                                }}
                                className="text-gray-400 hover:text-red-300"
                              >
                                <XCircle className="mr-1.5 h-4 w-4" /> Reject
                              </Button>
                            </div>
                            {changeProposalId === proposal._id && (
                              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                                <Textarea
                                  value={changeMessage}
                                  onChange={(event) =>
                                    setChangeMessage(event.target.value)
                                  }
                                  rows={3}
                                  maxLength={4000}
                                  placeholder="Describe what should be adjusted in scope, price, duration, or milestones…"
                                  className="border-white/10 bg-black/20 text-white"
                                />
                                <div className="mt-2 flex justify-end gap-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => {
                                      setChangeProposalId(null);
                                      setChangeMessage("");
                                    }}
                                    className="text-gray-400"
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    type="button"
                                    disabled={actionPending || !changeMessage.trim()}
                                    onClick={() =>
                                      handleRequestChanges(proposal._id)
                                    }
                                    className="bg-[#FFB633] text-black hover:bg-[#e5a32e]"
                                  >
                                    Send request
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {proposal.status === "accepted" && (
                          <p className="flex items-center gap-2 border-t border-white/10 pt-4 text-xs text-green-300">
                            <CheckCircle2 className="h-4 w-4" /> Accepted proposal
                            snapshot — read only.
                          </p>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Timeline */}
        <div className="mt-8 bg-[#1a1a1b] rounded-xl p-6 border border-white/10 overflow-x-auto">
          <ProjectTimeline
            milestones={timelineMilestones}
            selectedId={selectedMilestoneId}
            onSelect={handleSelect}
          />
        </div>

        {/* Requirements */}
        {project.requirements && (
          <div className="mt-8">
            <h3 className="text-xl font-bold text-white mb-3">Requirements</h3>
            <div className="bg-[#1a1a1b] rounded-xl p-6 border border-white/10">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {project.requirements}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* Milestones + tasks */}
        <div className="mt-8 space-y-4">
          <h3 className="text-xl font-bold text-white">Progress</h3>
          {milestones.length === 0 ? (
            <p className="text-gray-500 text-sm">
              The plan is being prepared — check back soon.
            </p>
          ) : (
            milestones.map((m, index) => (
              <Fragment key={m._id}>
                {(index === 0 ||
                  (milestones[index - 1]?.phaseNumber || 1) !==
                    (m.phaseNumber || 1)) && (
                  <div className="flex items-center gap-3 pt-2">
                    <span className="rounded-full bg-[#FFB633]/15 px-3 py-1 text-xs font-semibold text-[#FFB633]">
                      {m.phaseLabel ||
                        (m.phaseNumber > 1
                          ? `Faza ${m.phaseNumber}`
                          : "Master / Existing scope")}
                    </span>
                    <span className="h-px flex-1 bg-white/10" />
                  </div>
                )}
                <div
                  id={`milestone-${m._id}`}
                  className={`bg-[#1a1a1b] rounded-xl p-6 border transition-colors ${
                    selectedMilestoneId === m._id
                      ? "border-[#FFB633]/50"
                      : "border-white/10"
                  }`}
                >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {ITEM_ICON[m.status]}
                    <h4 className="text-lg font-semibold text-white">
                      {m.title}
                    </h4>
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-gray-400">
                      {m.phaseLabel ||
                        (m.phaseNumber > 1
                          ? `Faza ${m.phaseNumber}`
                          : "Master")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 min-w-0">
                    {unreadByMilestone[m._id]?.body && (
                      <span className="max-w-[150px] truncate rounded-full bg-[#FFB633] text-black text-[10px] font-medium px-2 py-0.5">
                        {unreadByMilestone[m._id].body}
                      </span>
                    )}
                    {user?.isAdmin && (
                      <button
                        type="button"
                        onClick={() => setMilestoneEdit(m)}
                        className="flex shrink-0 items-center gap-1 text-sm text-gray-400 hover:text-[#FFB633]"
                      >
                        <Edit className="h-4 w-4" />
                        <span className="hidden sm:inline">Edit milestone</span>
                      </button>
                    )}
                    <button
                      onClick={() => openChat(m)}
                      className={`flex items-center gap-1 text-sm shrink-0 ${
                        unreadMilestoneIds.has(m._id)
                          ? "text-[#FFB633] animate-pulse"
                          : "text-gray-400 hover:text-[#FFB633]"
                      }`}
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span className="hidden sm:inline">
                        {user?.isAdmin ? "Chat" : "Ask a question"}
                      </span>
                    </button>
                  </div>
                </div>

                {m.description && (
                  <p className="text-gray-400 text-sm mt-2">{m.description}</p>
                )}

                {(m.tasks || []).length > 0 && (
                  <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
                    {[...m.tasks]
                      .sort((a, b) => (a.order || 0) - (b.order || 0))
                      .map((t) => (
                        <div key={t._id} className="flex items-start gap-2">
                          <span className="mt-0.5">{ITEM_ICON[t.status]}</span>
                          <div>
                            <p
                              className={`text-sm ${
                                t.status === "completed"
                                  ? "text-gray-400 line-through"
                                  : "text-gray-200"
                              }`}
                            >
                              {t.title}
                            </p>
                            {t.description && (
                              <p className="text-gray-500 text-xs mt-0.5">
                                {t.description}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
                </div>
              </Fragment>
            ))
          )}
        </div>

        {/* Activity feed */}
        {(project.events || []).length > 0 && (
          <div className="mt-8">
            <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#FFB633]" /> Activity
            </h3>
            <div className="bg-[#1a1a1b] rounded-xl p-6 border border-white/10 space-y-3">
              {[...project.events]
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .map((ev) => (
                  <div key={ev._id} className="flex items-start gap-3">
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-[#FFB633]/60 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-gray-200">{ev.body}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {ev.actorName ? `${ev.actorName} · ` : ""}
                        {eventTimeAgo(ev.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Showcase links when completed */}
        {project.status === "completed" &&
          (project.livePreviewUrl || project.githubRepoUrl) && (
            <div className="mt-8 flex gap-3">
              {project.livePreviewUrl && (
                <a
                  href={project.livePreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-[#FFB633] text-black px-4 py-2 rounded-lg hover:bg-[#e5a32e]"
                >
                  <ExternalLink className="w-4 h-4" /> Live Preview
                </a>
              )}
              {project.githubRepoUrl && (
                <a
                  href={project.githubRepoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 border border-white/20 text-gray-300 px-4 py-2 rounded-lg hover:text-white"
                >
                  <Github className="w-4 h-4" /> Source
                </a>
              )}
            </div>
          )}
      </div>

      {user?.isAdmin && (
        <>
          <ProposalEditorDialog
            open={!!proposalEditor}
            onOpenChange={(open) => !open && setProposalEditor(null)}
            proposal={proposalEditor?.proposal || null}
            onSubmit={handleProposalSave}
            isSubmitting={proposalEditorSaving}
            dialogTitle={
              proposalEditor?.sourceProposalId
                ? "Create proposal revision"
                : proposalEditor?.proposal?._id
                  ? "Edit proposal draft"
                  : "Add project proposal"
            }
            dialogDescription="Define the next project phase and add its milestones and tasks. They become live only after the proposal is sent and accepted by the client."
            submitLabel={
              proposalEditor?.sourceProposalId ? "Create revision" : "Save draft"
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
          <MilestoneEditorDialog
            open={!!milestoneEdit}
            onOpenChange={(open) => !open && setMilestoneEdit(null)}
            milestone={milestoneEdit}
            onSubmit={handleMilestoneAgreedChange}
            isSubmitting={updateMilestoneAgreed.isPending}
          />
        </>
      )}

      {/* Chat per milestone */}
      <Sheet
        open={!!chatMilestone}
        onOpenChange={(o) => !o && setChatMilestone(null)}
      >
        <SheetContent
          side="right"
          className="bg-[#1a1a1b] border-white/10 text-white p-0 w-full sm:max-w-md flex flex-col"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Milestone conversation</SheetTitle>
          </SheetHeader>
          {chatMilestone && (
            <MilestoneChat
              projectId={project._id}
              milestone={chatMilestone}
              viewerRole={user?.isAdmin ? "admin" : "client"}
              viewerName={user?.name || (user?.isAdmin ? "Admin" : "Client")}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function ClientProjectDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0f0f10] flex items-center justify-center">
          <div className="text-white">Loading…</div>
        </div>
      }
    >
      <ClientProjectDetailInner />
    </Suspense>
  );
}
