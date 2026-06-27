"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "@/hooks/useAuth";
import { useClientProject } from "@/hooks/useClientProjects";
import { useNotifications } from "@/hooks/useNotifications";
import { ProjectTimeline } from "@/components/ui/project-timeline";
import { MilestoneChat } from "@/components/dashboard/MilestoneChat";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ArrowLeft,
  Lightbulb,
  MessageSquare,
  Check,
  CircleDot,
  Circle,
  ExternalLink,
  Github,
  Activity,
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
  ol: ({ children }) => (
    <ol className="list-decimal list-inside text-gray-300 mb-3 space-y-1">
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

  const [selectedMilestoneId, setSelectedMilestoneId] = useState(null);
  const [chatMilestone, setChatMilestone] = useState(null);
  const { markRead, unreadMilestoneIds, unreadByMilestone } = useNotifications();

  useEffect(() => {
    if (!authLoading && !user) router.push("/");
  }, [authLoading, user, router]);

  // Clear non-message notifications (status/task/milestone) for this project on
  // open. Per-milestone chat messages stay unread until their chat is opened.
  useEffect(() => {
    if (id) markRead.mutate({ entityId: id, excludeMilestones: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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
    (a, b) => (a.order || 0) - (b.order || 0),
  );

  return (
    <div className="min-h-screen bg-[#0f0f10]">
      {/* Header */}
      <header className="bg-[#1a1a1b] border-b border-white/10 px-2 lg:px-6 py-4">
        <div className="container mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3">
            <Lightbulb className="w-8 h-8 text-[#FFB633]" />
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
          <div>
            <h2 className="text-3xl font-bold text-white">{project.title}</h2>
            {project.description && (
              <p className="text-gray-400 mt-2 max-w-2xl">
                {project.description}
              </p>
            )}
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              STATUS_BADGE[project.status] || STATUS_BADGE.planning
            }`}
          >
            {project.status.replace("_", " ")}
          </span>
        </div>

        {/* Timeline */}
        <div className="mt-8 bg-[#1a1a1b] rounded-xl p-6 border border-white/10 overflow-x-auto">
          <ProjectTimeline
            milestones={milestones}
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
            milestones.map((m) => (
              <div
                key={m._id}
                id={`milestone-${m._id}`}
                className={`bg-[#1a1a1b] rounded-xl p-6 border transition-colors ${
                  selectedMilestoneId === m._id
                    ? "border-[#FFB633]/50"
                    : "border-white/10"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2">
                    {ITEM_ICON[m.status]}
                    <h4 className="text-lg font-semibold text-white">
                      {m.title}
                    </h4>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 min-w-0">
                    {unreadByMilestone[m._id]?.body && (
                      <span className="max-w-[150px] truncate rounded-full bg-[#FFB633] text-black text-[10px] font-medium px-2 py-0.5">
                        {unreadByMilestone[m._id].body}
                      </span>
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
                      <span className="hidden sm:inline">Ask a question</span>
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
              viewerRole="client"
              viewerName={user?.name || "Client"}
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
