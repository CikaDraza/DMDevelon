"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";
import { useClientProjects } from "@/hooks/useClientProjects";
import { MILESTONE_ICON_OPTIONS } from "@/components/ui/project-timeline";
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
  GripVertical,
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

export default function ClientProjectsManager() {
  const { user, getAuthHeaders } = useAuth();
  const {
    projects,
    isLoading,
    createProject,
    updateProject,
    deleteProject,
    updateMilestone,
    updateTask,
  } = useClientProjects();

  const [users, setUsers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [milestones, setMilestones] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [chat, setChat] = useState(null); // { projectId, milestone }

  useEffect(() => {
    axios
      .get("/api/users", { headers: getAuthHeaders() })
      .then((res) => setUsers(res.data || []))
      .catch(() => {});
  }, [getAuthHeaders]);

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

  // --- Milestone builder helpers (local state, saved via full PUT) ---
  const addMilestone = () => {
    setMilestones((ms) => [
      ...ms,
      {
        _id: crypto.randomUUID(),
        title: "",
        description: "",
        icon: "Circle",
        status: "pending",
        githubBranch: "",
        order: ms.length,
        tasks: [],
      },
    ]);
  };

  const updateLocalMilestone = (idx, patch) => {
    setMilestones((ms) =>
      ms.map((m, i) => (i === idx ? { ...m, ...patch } : m)),
    );
  };

  const removeMilestone = (idx) => {
    setMilestones((ms) => ms.filter((_, i) => i !== idx).map((m, i) => ({ ...m, order: i })));
  };

  const moveMilestone = (idx, dir) => {
    setMilestones((ms) => {
      const next = [...ms];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return ms;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next.map((m, i) => ({ ...m, order: i }));
    });
  };

  const addTask = (mIdx) => {
    setMilestones((ms) =>
      ms.map((m, i) =>
        i === mIdx
          ? {
              ...m,
              tasks: [
                ...(m.tasks || []),
                {
                  _id: crypto.randomUUID(),
                  title: "",
                  description: "",
                  status: "pending",
                  order: (m.tasks || []).length,
                },
              ],
            }
          : m,
      ),
    );
  };

  const updateLocalTask = (mIdx, tIdx, patch) => {
    setMilestones((ms) =>
      ms.map((m, i) =>
        i === mIdx
          ? {
              ...m,
              tasks: m.tasks.map((t, j) => (j === tIdx ? { ...t, ...patch } : t)),
            }
          : m,
      ),
    );
  };

  const removeTask = (mIdx, tIdx) => {
    setMilestones((ms) =>
      ms.map((m, i) =>
        i === mIdx
          ? { ...m, tasks: m.tasks.filter((_, j) => j !== tIdx) }
          : m,
      ),
    );
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
                className="bg-[#1a1a1b] rounded-xl border border-white/10"
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
                    {expanded ? "Hide" : "Manage"} progress (
                    {project.milestones?.length || 0} milestones)
                  </button>
                </div>

                {/* Inline granular progress management (PATCH) */}
                {expanded && (
                  <div className="border-t border-white/10 p-6 space-y-4">
                    {(project.milestones || []).length === 0 && (
                      <p className="text-gray-500 text-sm">
                        No milestones — use Edit to add them.
                      </p>
                    )}
                    {[...(project.milestones || [])]
                      .sort((a, b) => (a.order || 0) - (b.order || 0))
                      .map((m) => (
                        <div
                          key={m._id}
                          className="bg-white/5 rounded-lg p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <button
                              onClick={() => cycleMilestoneStatus(project._id, m)}
                              className="flex items-center gap-2 text-left"
                              title="Click to cycle status"
                            >
                              {ITEM_STATUS_ICON[m.status]}
                              <span className="text-white font-medium">
                                {m.title || "Untitled milestone"}
                              </span>
                            </button>
                            <button
                              onClick={() =>
                                setChat({ projectId: project._id, milestone: m })
                              }
                              className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#FFB633]"
                            >
                              <MessageSquare className="w-4 h-4" />
                              Chat
                            </button>
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
              Define the project, assign a client, and break it into milestones.
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

            {/* Milestone builder */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-white">Milestones &amp; tasks</Label>
                <Button
                  type="button"
                  onClick={addMilestone}
                  variant="outline"
                  size="sm"
                  className="border-white/20 text-gray-300 hover:text-white"
                >
                  <Plus className="w-4 h-4 mr-1" /> Milestone
                </Button>
              </div>

              {milestones.map((m, mIdx) => (
                <div
                  key={m._id}
                  className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-gray-600 shrink-0" />
                    <Input
                      value={m.title}
                      onChange={(e) =>
                        updateLocalMilestone(mIdx, { title: e.target.value })
                      }
                      placeholder={`Milestone ${mIdx + 1} title`}
                      className="bg-white/5 border-white/10 text-white"
                    />
                    <button
                      type="button"
                      onClick={() => moveMilestone(mIdx, -1)}
                      className="p-1 text-gray-400 hover:text-white"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveMilestone(mIdx, 1)}
                      className="p-1 text-gray-400 hover:text-white"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeMilestone(mIdx)}
                      className="p-1 text-gray-400 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Select
                      value={m.icon}
                      onValueChange={(v) => updateLocalMilestone(mIdx, { icon: v })}
                    >
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue placeholder="Icon" />
                      </SelectTrigger>
                      <SelectContent>
                        {MILESTONE_ICON_OPTIONS.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={m.status}
                      onValueChange={(v) =>
                        updateLocalMilestone(mIdx, { status: v })
                      }
                    >
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ITEM_STATUS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s.replace("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={m.githubBranch}
                      onChange={(e) =>
                        updateLocalMilestone(mIdx, { githubBranch: e.target.value })
                      }
                      placeholder="git branch"
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>

                  <Textarea
                    value={m.description}
                    onChange={(e) =>
                      updateLocalMilestone(mIdx, { description: e.target.value })
                    }
                    rows={2}
                    placeholder="What this part covers…"
                    className="bg-white/5 border-white/10 text-white"
                  />

                  {/* Tasks */}
                  <div className="pl-4 space-y-2 border-l border-white/10">
                    {(m.tasks || []).map((t, tIdx) => (
                      <div key={t._id} className="flex items-center gap-2">
                        <Input
                          value={t.title}
                          onChange={(e) =>
                            updateLocalTask(mIdx, tIdx, { title: e.target.value })
                          }
                          placeholder={`Task ${tIdx + 1}`}
                          className="bg-white/5 border-white/10 text-white"
                        />
                        <Select
                          value={t.status}
                          onValueChange={(v) =>
                            updateLocalTask(mIdx, tIdx, { status: v })
                          }
                        >
                          <SelectTrigger className="w-32 bg-white/5 border-white/10 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ITEM_STATUS.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s.replace("_", " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <button
                          type="button"
                          onClick={() => removeTask(mIdx, tIdx)}
                          className="p-1 text-gray-400 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      onClick={() => addTask(mIdx)}
                      variant="ghost"
                      size="sm"
                      className="text-gray-400 hover:text-white"
                    >
                      <Plus className="w-4 h-4 mr-1" /> Task
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="submit"
              className="w-full bg-[#FFB633] text-black hover:bg-[#e5a32e]"
            >
              {editingId ? "Save Changes" : "Create Project"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

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
