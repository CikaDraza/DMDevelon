"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";
import { useProjectRequest } from "@/hooks/useProjectRequests";
import { useNotifications } from "@/hooks/useNotifications";
import { RequestConversation } from "@/components/dashboard/RequestConversation";
import MarkdownContent from "@/components/ui/markdown-content";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Check,
  Edit3,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const STATUS = {
  new: {
    label: "Submitted — awaiting review",
    cls: "bg-purple-500/20 text-purple-300",
  },
  discussion: { label: "Discussion", cls: "bg-blue-500/20 text-blue-400" },
  proposal_sent: {
    label: "Proposal Ready",
    cls: "bg-[#FFB633]/20 text-[#FFB633]",
  },
  approved: { label: "Approved", cls: "bg-green-500/20 text-green-400" },
  closed: { label: "Closed", cls: "bg-gray-500/20 text-gray-400" },
};

export default function ClientRequestDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const {
    request,
    isLoading,
    error,
    postMessage,
    uploadAttachment,
    accept,
    requestChanges,
  } = useProjectRequest(id);

  const { markRead } = useNotifications();

  // Scope accordion — collapsed by default; the choice persists across visits
  // (Scope is read once, then usually just referenced, so keep it out of the way).
  const [scopeOpen, setScopeOpen] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("proposalScopeClosed");
    const closed = stored === null ? true : stored === "true";
    setScopeOpen(!closed);
  }, []);
  const toggleScope = () => {
    setScopeOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("proposalScopeClosed", String(!next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    if (!authLoading && !user) router.push("/");
  }, [authLoading, user, router]);

  // Clear unread notifications for this request on open
  useEffect(() => {
    if (id) markRead.mutate({ entityId: id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleAccept = async () => {
    try {
      const res = await accept.mutateAsync();
      toast.success("Proposal accepted! Your project is ready.");
      if (res?.projectId) router.push(`/dashboard/projects/${res.projectId}`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to accept");
    }
  };

  const handleRequestChanges = async () => {
    try {
      await requestChanges.mutateAsync({});
      toast.success("Sent back for changes — continue in the thread below.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed");
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-[#0f0f10] flex items-center justify-center">
        <div className="text-white">Loading…</div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="min-h-screen bg-[#0f0f10] flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400">Request not found or access denied.</p>
        <Link href="/dashboard" className="text-[#FFB633] hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const status = STATUS[request.status] || STATUS.new;
  const proposal = request.proposal;
  const showProposal = request.status === "proposal_sent" && proposal?.sentAt;

  return (
    <div className="min-h-screen bg-[#0f0f10]">
      <header className="bg-[#1a1a1b] border-b border-white/10 px-2 lg:px-6 py-4">
        <div className="container mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3">
            <img src="/icons/dmd-logo.png" alt="DMDevelon" className="h-8 w-auto" />
            <div>
              <h1 className="font-bold text-white">DMDevelon</h1>
              <p className="text-xs text-gray-400">Project Request</p>
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

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold text-white">{request.title}</h2>
            <p className="text-gray-500 text-sm mt-1">
              Created {new Date(request.createdAt).toLocaleDateString()}
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${status.cls}`}
          >
            {status.label}
          </span>
        </div>

        {/* Approved → link to project */}
        {request.status === "approved" && request.linkedClientProjectId && (
          <div className="mt-6 bg-green-500/10 border border-green-500/30 rounded-xl p-5 flex items-center justify-between gap-4">
            <p className="text-green-400 text-sm">
              This request is approved and your project is live.
            </p>
            <Button
              onClick={() =>
                router.push(
                  `/dashboard/projects/${request.linkedClientProjectId}`,
                )
              }
              className="bg-[#FFB633] text-black hover:bg-[#e5a32e]"
            >
              View project <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Proposal panel */}
        {showProposal && (
          <div className="mt-6 bg-[#1a1a1b] border border-[#FFB633]/30 rounded-xl p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <h3 className="text-lg font-bold text-white truncate">
                  {proposal.title || "Proposal"}
                </h3>
                <span
                  className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full ${status.cls}`}
                >
                  {status.label}
                </span>
              </div>
              <span className="text-xs text-gray-500 shrink-0">
                v{proposal.version}
              </span>
            </div>
            {proposal.scope && (
              <div className="mt-3 border border-white/10 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={toggleScope}
                  aria-expanded={scopeOpen}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/5 transition-colors"
                >
                  <span className="text-sm font-semibold text-white">Scope</span>
                  {scopeOpen ? (
                    <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                  )}
                </button>
                {scopeOpen && (
                  <div className="px-4 pb-2">
                    <MarkdownContent
                      content={proposal.scope}
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
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-xs text-gray-400">Timeline</p>
                <p className="text-white font-semibold">
                  {proposal.timeline || "—"}
                </p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-xs text-gray-400">Budget</p>
                <p className="text-white font-semibold">
                  {proposal.budget || "—"}
                </p>
              </div>
            </div>
            {(proposal.milestonePlan || proposal.milestones || []).length > 0 && (
              <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Planned milestones
                </p>
                <div className="mt-2 space-y-2">
                  {[...(proposal.milestonePlan || proposal.milestones || [])]
                    .sort((a, b) => (a.order || 0) - (b.order || 0))
                    .map((milestone, index) => (
                      <div
                        key={milestone._id || `${milestone.title}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-md bg-black/20 px-3 py-2"
                      >
                        <span className="text-sm text-gray-200">
                          {milestone.title || `Milestone ${index + 1}`}
                        </span>
                        <span className="shrink-0 text-[11px] text-gray-500">
                          {(milestone.tasks || []).length} tasks
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-3 mt-5">
              <Button
                onClick={handleAccept}
                disabled={accept.isPending}
                className="bg-[#FFB633] text-black hover:bg-[#e5a32e]"
              >
                <Check className="w-4 h-4 mr-2" />
                Accept Proposal
              </Button>
              <Button
                onClick={handleRequestChanges}
                disabled={requestChanges.isPending}
                variant="outline"
                className="border-white/20 text-gray-300 hover:text-white"
              >
                <Edit3 className="w-4 h-4 mr-2" />
                Request Changes
              </Button>
            </div>
          </div>
        )}

        {/* Conversation */}
        <div className="mt-8">
          <h3 className="text-lg font-bold text-white mb-4">Conversation</h3>
          <RequestConversation
            request={request}
            viewerRole="client"
            viewerName={user?.name || "Client"}
            postMessage={postMessage}
            uploadAttachment={uploadAttachment}
          />
        </div>
      </div>
    </div>
  );
}
