"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";
import { useProjectRequest } from "@/hooks/useProjectRequests";
import { RequestConversation } from "@/components/dashboard/RequestConversation";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Lightbulb,
  Check,
  Edit3,
  ArrowRight,
} from "lucide-react";

const STATUS = {
  new: { label: "Submitted — awaiting review", cls: "bg-purple-500/20 text-purple-300" },
  discussion: { label: "Discussion", cls: "bg-blue-500/20 text-blue-400" },
  proposal_sent: { label: "Proposal Ready", cls: "bg-[#FFB633]/20 text-[#FFB633]" },
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

  useEffect(() => {
    if (!authLoading && !user) router.push("/");
  }, [authLoading, user, router]);

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
      <header className="bg-[#1a1a1b] border-b border-white/10 px-6 py-4">
        <div className="container mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3">
            <Lightbulb className="w-8 h-8 text-[#FFB633]" />
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
                router.push(`/dashboard/projects/${request.linkedClientProjectId}`)
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
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                {proposal.title || "Proposal"}
              </h3>
              <span className="text-xs text-gray-500">v{proposal.version}</span>
            </div>
            {proposal.scope && (
              <p className="text-gray-300 text-sm mt-3 whitespace-pre-wrap">
                {proposal.scope}
              </p>
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
