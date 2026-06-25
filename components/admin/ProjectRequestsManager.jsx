"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  useProjectRequests,
  useProjectRequest,
} from "@/hooks/useProjectRequests";
import { useNotifications } from "@/hooks/useNotifications";
import { RequestConversation } from "@/components/dashboard/RequestConversation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  ArrowRight,
  Trash2,
  XCircle,
  FileText,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

const STATUS = {
  new: { label: "New", cls: "bg-purple-500/20 text-purple-300" },
  discussion: { label: "Discussion", cls: "bg-blue-500/20 text-blue-400" },
  proposal_sent: { label: "Proposal Ready", cls: "bg-[#FFB633]/20 text-[#FFB633]" },
  approved: { label: "Approved", cls: "bg-green-500/20 text-green-400" },
  closed: { label: "Closed", cls: "bg-gray-500/20 text-gray-400" },
};

function lastMessagePreview(req) {
  const msgs = (req.messages || []).filter((m) => m.type !== "system");
  const last = msgs[msgs.length - 1];
  return last?.body?.slice(0, 80) || "—";
}

// Last non-system author === "client" means the client spoke last → needs reply
function needsReply(req) {
  const msgs = (req.messages || []).filter((m) => m.type !== "system");
  return msgs[msgs.length - 1]?.authorRole === "client";
}

function RequestDetail({ id, onBack }) {
  const { user } = useAuth();
  const { request, postMessage, uploadAttachment } = useProjectRequest(id);
  const { saveProposal, updateStatus, deleteRequest } = useProjectRequests();
  const { markRead } = useNotifications();

  useEffect(() => {
    if (id) markRead.mutate({ entityId: id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const [proposal, setProposal] = useState({
    title: "",
    scope: "",
    timeline: "",
    budget: "",
  });

  // Seed the form once when this request first loads (keyed by id), NOT on
  // every poll/refetch — otherwise an admin's in-progress proposal draft would
  // be overwritten whenever the request changes (new chat message, status, …).
  useEffect(() => {
    if (request) {
      setProposal({
        title: request.proposal?.title || request.title || "",
        scope: request.proposal?.scope || "",
        timeline: request.proposal?.timeline || "",
        budget: request.proposal?.budget || "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?._id]);

  if (!request) {
    return <div className="text-gray-400">Loading…</div>;
  }

  const status = STATUS[request.status] || STATUS.new;

  const handleSendProposal = async (e) => {
    e.preventDefault();
    try {
      await saveProposal.mutateAsync({ id, data: proposal });
      toast.success("Proposal sent");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to send proposal");
    }
  };

  const handleClose = async () => {
    try {
      await updateStatus.mutateAsync({ id, status: "closed" });
      toast.success("Request closed");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this request permanently?")) return;
    try {
      await deleteRequest.mutateAsync(id);
      toast.success("Request deleted");
      onBack();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed");
    }
  };

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-400 hover:text-white mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to requests
      </button>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">{request.title}</h2>
          <p className="text-gray-400 text-sm mt-1">
            {request.clientName || request.clientEmail}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${status.cls}`}
          >
            {status.label}
          </span>
          {request.status !== "closed" && request.status !== "approved" && (
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-yellow-400"
              title="Close request"
            >
              <XCircle className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={handleDelete}
            className="p-2 text-gray-400 hover:text-red-400"
            title="Delete"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {request.status === "approved" && request.linkedClientProjectId && (
        <Link
          href={`/dashboard/projects/${request.linkedClientProjectId}`}
          className="inline-flex items-center gap-2 text-[#FFB633] hover:underline mb-6"
        >
          <ExternalLink className="w-4 h-4" /> Open the created project
        </Link>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversation */}
        <div className="bg-[#1a1a1b] rounded-xl p-5 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">Conversation</h3>
          <RequestConversation
            request={request}
            viewerRole="admin"
            viewerName={user?.name || "DMDevelon"}
            postMessage={postMessage}
            uploadAttachment={uploadAttachment}
          />
        </div>

        {/* Proposal builder */}
        <div className="bg-[#1a1a1b] rounded-xl p-5 border border-white/10 h-fit">
          <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#FFB633]" /> Proposal
          </h3>
          {request.proposal?.version > 0 && (
            <p className="text-xs text-gray-500 mb-3">
              Current version: v{request.proposal.version}
              {request.proposal.acceptedAt && " · accepted"}
            </p>
          )}
          <form onSubmit={handleSendProposal} className="space-y-3 mt-2">
            <div>
              <Label className="text-white">Title</Label>
              <Input
                value={proposal.title}
                onChange={(e) =>
                  setProposal((p) => ({ ...p, title: e.target.value }))
                }
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-white">Scope</Label>
              <Textarea
                value={proposal.scope}
                onChange={(e) =>
                  setProposal((p) => ({ ...p, scope: e.target.value }))
                }
                rows={4}
                placeholder="What we'll build…"
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-white">Timeline</Label>
                <Input
                  value={proposal.timeline}
                  onChange={(e) =>
                    setProposal((p) => ({ ...p, timeline: e.target.value }))
                  }
                  placeholder="10 weeks"
                  className="bg-white/5 border-white/10 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-white">Budget</Label>
                <Input
                  value={proposal.budget}
                  onChange={(e) =>
                    setProposal((p) => ({ ...p, budget: e.target.value }))
                  }
                  placeholder="$4,000"
                  className="bg-white/5 border-white/10 text-white mt-1"
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={saveProposal.isPending || request.status === "approved"}
              className="w-full bg-[#FFB633] text-black hover:bg-[#e5a32e]"
            >
              {request.proposal?.version > 0
                ? "Send Updated Proposal"
                : "Send Proposal"}
            </Button>
            {request.status === "approved" && (
              <p className="text-xs text-green-400">
                Proposal already accepted — project created.
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ProjectRequestsManager() {
  const { requests, isLoading } = useProjectRequests();
  const { unreadEntityIds } = useNotifications();
  const [selectedId, setSelectedId] = useState(null);

  if (selectedId) {
    return <RequestDetail id={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Project Requests</h2>
        <p className="text-gray-400 text-sm mt-1">
          Leads &amp; conversations before they become projects.
        </p>
      </div>

      {isLoading ? (
        <div className="text-gray-400">Loading requests…</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 bg-[#1a1a1b] rounded-xl border border-white/10">
          <p className="text-gray-400">No project requests yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const status = STATUS[req.status] || STATUS.new;
            return (
              <button
                key={req._id}
                onClick={() => setSelectedId(req._id)}
                className="w-full text-left bg-[#1a1a1b] rounded-xl p-5 border border-white/10 hover:border-[#FFB633]/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      {unreadEntityIds.has(req._id) && (
                        <span className="w-2 h-2 rounded-full bg-[#FFB633] shrink-0" />
                      )}
                      <h3 className="text-lg font-semibold text-white">
                        {req.title}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${status.cls}`}
                      >
                        {status.label}
                      </span>
                      {needsReply(req) && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
                          Needs reply
                        </span>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm mt-1">
                      {req.clientName || req.clientEmail}
                    </p>
                    <p className="text-gray-500 text-sm mt-2 truncate">
                      {lastMessagePreview(req)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-xs text-gray-500">
                      {new Date(
                        req.lastActivityAt || req.createdAt,
                      ).toLocaleDateString()}
                    </span>
                    <ArrowRight className="w-4 h-4 text-gray-500 mt-2" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
