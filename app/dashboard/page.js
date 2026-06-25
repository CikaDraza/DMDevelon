"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useTestimonials } from "@/hooks/useTestimonials";
import { useClientProjects } from "@/hooks/useClientProjects";
import { useProjectRequests } from "@/hooks/useProjectRequests";
import { useNotifications } from "@/hooks/useNotifications";
import NotificationBell from "@/components/NotificationBell";
import toast from "react-hot-toast";
import axios from "axios";
import {
  User,
  Briefcase,
  MessageSquare,
  Settings,
  LogOut,
  Lightbulb,
  Star,
  Plus,
  Edit,
  Trash2,
  Home,
  AlertTriangle,
  ArrowRight,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import Link from "next/link";

// Client Dashboard Page
export default function DashboardPage() {
  const router = useRouter();
  const { user, logout, loading, getAuthHeaders, resendVerification } =
    useAuth();
  const {
    testimonials,
    createTestimonial,
    updateTestimonial,
    deleteTestimonial,
  } = useTestimonials();
  const { projects: clientProjects, isLoading: projectsLoading } =
    useClientProjects();
  const {
    requests: projectRequests,
    isLoading: requestsLoading,
    createRequest,
  } = useProjectRequests();
  const { unreadEntityIds } = useNotifications();
  const [activeTab, setActiveTab] = useState("services");
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isTestimonialModalOpen, setIsTestimonialModalOpen] = useState(false);
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] =
    useState(false);
  const [isStartProjectModalOpen, setIsStartProjectModalOpen] = useState(false);
  const [requestTitle, setRequestTitle] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState(null);
  const [profileData, setProfileData] = useState({
    name: "",
    password: "",
    confirmPassword: "",
  });
  const [testimonialData, setTestimonialData] = useState({
    clientName: "",
    clientEmail: "",
    clientTitle: "",
    rating: 5,
    comment: "",
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      setProfileData((prev) => ({ ...prev, name: user.name || "" }));
      setTestimonialData((prev) => ({
        ...prev,
        clientName: user.name || "",
        clientEmail: user.email || "",
      }));
    }
  }, [user]);

  const [resending, setResending] = useState(false);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const handleResendVerification = async () => {
    setResending(true);
    try {
      await resendVerification();
      toast.success("Verification email sent — check your inbox.");
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to send email");
    } finally {
      setResending(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (
      profileData.password &&
      profileData.password !== profileData.confirmPassword
    ) {
      toast.error("Passwords do not match");
      return;
    }
    try {
      const updateData = { name: profileData.name };
      if (profileData.password) {
        updateData.password = profileData.password;
      }
      await axios.put(`/api/users/${user.id}`, updateData, {
        headers: getAuthHeaders(),
      });
      toast.success("Profile updated successfully!");
      setIsProfileModalOpen(false);
      setProfileData({ ...profileData, password: "", confirmPassword: "" });
      // Update local storage
      const updatedUser = { ...user, name: profileData.name };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      window.location.reload();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to update profile");
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await axios.delete(`/api/users/${user.id}`, {
        headers: getAuthHeaders(),
      });
      toast.success("Account deleted successfully");
      logout();
      router.push("/");
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to delete account");
    }
  };

  const handleSubmitProjectRequest = async (e) => {
    e.preventDefault();
    if (!requestTitle.trim()) {
      toast.error("Please give your project a name");
      return;
    }
    setRequestSubmitting(true);
    try {
      const created = await createRequest.mutateAsync({
        title: requestTitle.trim(),
        description: requestMessage.trim(),
      });
      toast.success("Request created! We'll get back to you shortly.");
      setRequestTitle("");
      setRequestMessage("");
      setIsStartProjectModalOpen(false);
      if (created?._id) router.push(`/dashboard/requests/${created._id}`);
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to create request");
    } finally {
      setRequestSubmitting(false);
    }
  };

  const handleSubmitTestimonial = async (e) => {
    e.preventDefault();
    try {
      if (editingTestimonial) {
        await updateTestimonial.mutateAsync({
          id: editingTestimonial._id,
          data: testimonialData,
        });
        toast.success("Testimonial updated successfully!");
      } else {
        await createTestimonial.mutateAsync(testimonialData);
        toast.success("Testimonial submitted successfully!");
      }
      setIsTestimonialModalOpen(false);
      setEditingTestimonial(null);
      setTestimonialData({
        clientName: user?.name || "",
        clientEmail: user?.email || "",
        clientTitle: "",
        rating: 5,
        comment: "",
      });
    } catch (error) {
      toast.error(
        error.response?.data?.error || "Failed to submit testimonial",
      );
    }
  };

  const handleEditTestimonial = (testimonial) => {
    setEditingTestimonial(testimonial);
    setTestimonialData({
      clientName: testimonial.clientName,
      clientEmail: testimonial.clientEmail,
      clientTitle: testimonial.clientTitle || "",
      rating: testimonial.rating,
      comment: testimonial.comment,
    });
    setIsTestimonialModalOpen(true);
  };

  const handleDeleteTestimonial = async (id) => {
    if (confirm("Are you sure you want to delete this testimonial?")) {
      try {
        await deleteTestimonial.mutateAsync(id);
        toast.success("Testimonial deleted successfully!");
      } catch (error) {
        toast.error(
          error.response?.data?.error || "Failed to delete testimonial",
        );
      }
    }
  };

  // Filter user's testimonials
  const userTestimonials = testimonials.filter(
    (t) => t.clientEmail === user?.email || t.userId === user?.id,
  );

  // Progress = completed tasks / total tasks (fallback to milestones)
  const computeProgress = (project) => {
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
  };

  const statusBadgeClass = (status) =>
    status === "completed"
      ? "bg-green-500/20 text-green-400"
      : status === "in_progress"
        ? "bg-blue-500/20 text-blue-400"
        : status === "on_hold"
          ? "bg-yellow-500/20 text-yellow-400"
          : "bg-purple-500/20 text-purple-300";

  // Client can't delete account while a project is still active (avoids orphans)
  const hasActiveProject = clientProjects.some((p) => p.status !== "completed");

  const REQUEST_STATUS = {
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
  const lastMsgPreview = (req) => {
    const msgs = (req.messages || []).filter((m) => m.type !== "system");
    return msgs[msgs.length - 1]?.body?.slice(0, 90) || "—";
  };
  // Last non-system author role → who needs to act next
  const lastAuthorRole = (req) => {
    const msgs = (req.messages || []).filter((m) => m.type !== "system");
    return msgs[msgs.length - 1]?.authorRole || null;
  };
  // Approved requests are represented by their ClientProject below
  const pendingRequests = projectRequests.filter(
    (r) => r.status !== "approved",
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f10] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0f0f10]">
      {/* Header */}
      <header className="bg-[#1a1a1b] border-b border-white/10 px-3 lg:px-6 py-4">
        <div className="container mx-auto flex items-center justify-between px-1 lg:px-3">
          <a href="/" className="flex items-center lg:gap-3">
            <Lightbulb className="w-8 h-8 text-[#FFB633]" />
            <div>
              <h1 className="font-bold text-white">DMDevelon</h1>
              <p className="text-xs text-gray-400">Client Dashboard</p>
            </div>
          </a>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <Link
              href="/"
              className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="border-white/20 text-gray-400 hover:text-white"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {!user.emailVerified && (
        <div className="bg-[#FFB633]/10 border-b border-[#FFB633]/30">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-[#FFB633] shrink-0" />
              <p className="text-sm text-gray-200">
                Please verify your email address — check your inbox for the
                confirmation link.
              </p>
            </div>
            <Button
              onClick={handleResendVerification}
              disabled={resending}
              size="sm"
              variant="outline"
              className="border-[#FFB633]/50 text-[#FFB633] hover:bg-[#FFB633]/10"
            >
              {resending ? "Sending…" : "Resend email"}
            </Button>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* User Info Card */}
            <div className="bg-[#1a1a1b] rounded-xl p-6 border border-white/10 mb-6">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto rounded-full bg-[#FFB633]/20 flex items-center justify-center mb-4">
                  <User className="w-10 h-10 text-[#FFB633]" />
                </div>
                <h2 className="text-xl font-bold text-white">{user.name}</h2>
                <p className="text-gray-400 text-sm">{user.email}</p>
                <Button
                  onClick={() => setIsProfileModalOpen(true)}
                  variant="outline"
                  size="sm"
                  className="mt-4 border-white/20 text-gray-400 hover:text-white"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
              </div>
            </div>

            {/* Navigation */}
            <nav className="bg-[#1a1a1b] rounded-xl p-4 border border-white/10 space-y-2">
              <button
                onClick={() => setActiveTab("services")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === "services"
                    ? "bg-[#FFB633] text-black"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Briefcase className="w-5 h-5" />
                <span>My Projects</span>
              </button>
              <button
                onClick={() => setActiveTab("testimonials")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === "testimonials"
                    ? "bg-[#FFB633] text-black"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <MessageSquare className="w-5 h-5" />
                <span>Testimonials</span>
              </button>
            </nav>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {activeTab === "services" && (
              <div>
                <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      My Projects
                    </h2>
                    <p className="text-gray-400 mt-1">
                      Your project requests and active projects.
                    </p>
                  </div>
                  <Button
                    onClick={() => setIsStartProjectModalOpen(true)}
                    className="bg-[#FFB633] text-black hover:bg-[#e5a32e]"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Start a project
                  </Button>
                </div>

                {projectsLoading || requestsLoading ? (
                  <div className="text-gray-400">Loading…</div>
                ) : pendingRequests.length === 0 &&
                  clientProjects.length === 0 ? (
                  <div className="text-center py-12 bg-[#1a1a1b] rounded-xl border border-white/10">
                    <Briefcase className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">
                      You haven't requested any services yet.
                    </p>
                    <button
                      onClick={() => setIsStartProjectModalOpen(true)}
                      className="inline-block mt-4 text-[#FFB633] hover:underline"
                    >
                      Get in touch to start a project
                    </button>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Project Requests */}
                    {pendingRequests.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-3">
                          Project Requests
                        </h3>
                        <div className="space-y-4">
                          {pendingRequests.map((req) => {
                            const s =
                              REQUEST_STATUS[req.status] || REQUEST_STATUS.new;
                            return (
                              <motion.div
                                key={req._id}
                                whileHover={{ scale: 1.01 }}
                                onClick={() =>
                                  router.push(`/dashboard/requests/${req._id}`)
                                }
                                className="bg-[#1a1a1b] rounded-xl p-6 border border-white/10 cursor-pointer hover:border-[#FFB633]/40 transition-colors"
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      {unreadEntityIds.has(req._id) && (
                                        <span className="w-2 h-2 rounded-full bg-[#FFB633] shrink-0" />
                                      )}
                                      <h4 className="text-lg font-semibold text-white truncate">
                                        {req.title}
                                      </h4>
                                    </div>
                                    <p className="text-gray-500 text-sm mt-1 line-clamp-1">
                                      {lastMsgPreview(req)}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {lastAuthorRole(req) === "admin" && (
                                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-[#FFB633]/20 text-[#FFB633]">
                                        Action needed
                                      </span>
                                    )}
                                    <span
                                      className={`px-3 py-1 rounded-full text-xs font-medium ${s.cls}`}
                                    >
                                      {s.label}
                                    </span>
                                  </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                                  <span className="text-gray-500 text-xs">
                                    Updated{" "}
                                    {new Date(
                                      req.lastActivityAt || req.createdAt,
                                    ).toLocaleDateString()}
                                  </span>
                                  <span className="flex items-center gap-1 text-sm text-[#FFB633]">
                                    <MessageCircle className="w-4 h-4" />
                                    Open Conversation
                                  </span>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Active / completed projects */}
                    {clientProjects.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-3">
                          Projects
                        </h3>
                        <div className="space-y-4">
                          {clientProjects.map((project) => {
                            const progress = computeProgress(project);
                            return (
                              <motion.div
                                key={project._id}
                                whileHover={{ scale: 1.01 }}
                                onClick={() =>
                                  router.push(
                                    `/dashboard/projects/${project._id}`,
                                  )
                                }
                                className="bg-[#1a1a1b] rounded-xl p-6 border border-white/10 cursor-pointer hover:border-[#FFB633]/40 transition-colors"
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      {unreadEntityIds.has(project._id) && (
                                        <span className="w-2 h-2 rounded-full bg-[#FFB633] shrink-0" />
                                      )}
                                      <h4 className="text-lg font-semibold text-white truncate">
                                        {project.title}
                                      </h4>
                                    </div>
                                    {project.description && (
                                      <p className="text-gray-400 text-sm mt-1 line-clamp-2">
                                        {project.description}
                                      </p>
                                    )}
                                  </div>
                                  <span
                                    className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 ${statusBadgeClass(
                                      project.status,
                                    )}`}
                                  >
                                    {project.status.replace("_", " ")}
                                  </span>
                                </div>
                                <div className="mt-4 pt-4 border-t border-white/10">
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
                                  <div className="flex items-center gap-1 mt-3 text-sm text-[#FFB633]">
                                    View progress
                                    <ArrowRight className="w-4 h-4" />
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === "testimonials" && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      My Testimonials
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">
                      Share your experience with our services
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setEditingTestimonial(null);
                      setTestimonialData({
                        clientName: user?.name || "",
                        clientEmail: user?.email || "",
                        clientTitle: "",
                        rating: 5,
                        comment: "",
                      });
                      setIsTestimonialModalOpen(true);
                    }}
                    className="bg-[#FFB633] text-black hover:bg-[#e5a32e]"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Leave Testimonial
                  </Button>
                </div>

                {userTestimonials.length === 0 ? (
                  <div className="text-center py-12 bg-[#1a1a1b] rounded-xl border border-white/10">
                    <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">
                      You haven't left any testimonials yet.
                    </p>
                    <p className="text-gray-500 text-sm mt-2">
                      Share your experience to help others!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {userTestimonials.map((testimonial) => (
                      <motion.div
                        key={testimonial._id}
                        whileHover={{ scale: 1.01 }}
                        className="bg-[#1a1a1b] rounded-xl p-6 border border-white/10"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-5 h-5 ${
                                  i < testimonial.rating
                                    ? "text-[#FFB633] fill-[#FFB633]"
                                    : "text-gray-600"
                                }`}
                              />
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditTestimonial(testimonial)}
                              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                handleDeleteTestimonial(testimonial._id)
                              }
                              className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <p className="text-gray-300 mt-4">
                          "{testimonial.comment}"
                        </p>
                        {testimonial.adminReply && (
                          <div className="mt-4 p-4 bg-[#FFB633]/10 rounded-lg border-l-2 border-[#FFB633]">
                            <p className="text-sm text-gray-400">
                              <span className="text-[#FFB633] font-medium">
                                Admin Reply:
                              </span>{" "}
                              {testimonial.adminReply}
                            </p>
                          </div>
                        )}
                        <p className="text-gray-500 text-xs mt-4">
                          Posted on{" "}
                          {new Date(testimonial.createdAt).toLocaleDateString()}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="mt-12 bg-red-500/5 rounded-xl p-6 border border-red-500/20">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            <h3 className="text-lg font-semibold text-red-400">Danger Zone</h3>
          </div>
          <p className="text-gray-400 text-sm mb-4">
            Once you delete your account, there is no going back. Please be
            certain.
          </p>
          {hasActiveProject && (
            <p className="text-yellow-400/80 text-sm mb-4">
              You have a project in progress. Please contact admin to reassign
              it before deleting your account.
            </p>
          )}
          <Button
            onClick={() => setIsDeleteAccountModalOpen(true)}
            disabled={hasActiveProject}
            variant="outline"
            className="border-red-500/50 text-red-400 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Delete Account
          </Button>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <Dialog open={isProfileModalOpen} onOpenChange={setIsProfileModalOpen}>
        <DialogContent className="bg-[#1a1a1b] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription className="text-gray-400">
              Update your profile information
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateProfile} className="space-y-4 mt-4">
            <div>
              <Label className="text-white">Name</Label>
              <Input
                value={profileData.name}
                onChange={(e) =>
                  setProfileData({ ...profileData, name: e.target.value })
                }
                placeholder="Your name"
                required
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-white">Email</Label>
              <Input
                value={user?.email || ""}
                disabled
                className="bg-white/5 border-white/10 text-gray-500 mt-1"
              />
              <p className="text-gray-500 text-xs mt-1">
                Email cannot be changed
              </p>
            </div>
            <div>
              <Label className="text-white">New Password (optional)</Label>
              <Input
                type="password"
                value={profileData.password}
                onChange={(e) =>
                  setProfileData({ ...profileData, password: e.target.value })
                }
                placeholder="Leave blank to keep current"
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
            {profileData.password && (
              <div>
                <Label className="text-white">Confirm Password</Label>
                <Input
                  type="password"
                  value={profileData.confirmPassword}
                  onChange={(e) =>
                    setProfileData({
                      ...profileData,
                      confirmPassword: e.target.value,
                    })
                  }
                  placeholder="Confirm new password"
                  className="bg-white/5 border-white/10 text-white mt-1"
                />
              </div>
            )}
            <Button
              type="submit"
              className="w-full bg-[#FFB633] text-black hover:bg-[#e5a32e]"
            >
              Save Changes
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Testimonial Modal */}
      <Dialog
        open={isTestimonialModalOpen}
        onOpenChange={setIsTestimonialModalOpen}
      >
        <DialogContent className="bg-[#1a1a1b] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTestimonial ? "Edit Testimonial" : "Leave a Testimonial"}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Share your experience with our services
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitTestimonial} className="space-y-4 mt-4">
            <div>
              <Label className="text-white">Your Title/Position</Label>
              <Input
                value={testimonialData.clientTitle}
                onChange={(e) =>
                  setTestimonialData({
                    ...testimonialData,
                    clientTitle: e.target.value,
                  })
                }
                placeholder="e.g., CEO at TechCorp"
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-white">Rating</Label>
              <div className="flex gap-2 mt-2">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() =>
                      setTestimonialData({ ...testimonialData, rating })
                    }
                    className="p-1"
                  >
                    <Star
                      className={`w-8 h-8 transition-colors ${
                        rating <= testimonialData.rating
                          ? "text-[#FFB633] fill-[#FFB633]"
                          : "text-gray-600 hover:text-[#FFB633]/50"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-white">Your Testimonial</Label>
              <textarea
                value={testimonialData.comment}
                onChange={(e) =>
                  setTestimonialData({
                    ...testimonialData,
                    comment: e.target.value,
                  })
                }
                placeholder="Share your experience..."
                required
                rows={4}
                className="w-full bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 mt-1"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-[#FFB633] text-black hover:bg-[#e5a32e]"
            >
              {editingTestimonial ? "Update Testimonial" : "Submit Testimonial"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirmation Modal */}
      <Dialog
        open={isDeleteAccountModalOpen}
        onOpenChange={setIsDeleteAccountModalOpen}
      >
        <DialogContent className="bg-[#1a1a1b] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-400">Delete Account</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to delete your account? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-4 mt-6">
            <Button
              onClick={() => setIsDeleteAccountModalOpen(false)}
              variant="outline"
              className="flex-1 border-white/20 text-gray-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteAccount}
              className="flex-1 bg-red-500 text-white hover:bg-red-600"
            >
              Delete Account
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Start a Project Modal */}
      <Dialog
        open={isStartProjectModalOpen}
        onOpenChange={setIsStartProjectModalOpen}
      >
        <DialogContent className="bg-[#1a1a1b] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Start a project</DialogTitle>
            <DialogDescription className="text-gray-400">
              Tell us what you'd like to build and we'll set it up for you.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleSubmitProjectRequest}
            className="space-y-4 mt-2"
          >
            <div>
              <Label className="text-white">Project name</Label>
              <Input
                value={requestTitle}
                onChange={(e) => setRequestTitle(e.target.value)}
                placeholder="e.g. Spiritualized Language Tutor"
                required
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-white">What do you want to build?</Label>
              <textarea
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                placeholder="Describe the idea, features, goals…"
                rows={4}
                className="w-full bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 mt-1"
              />
            </div>
            <Button
              type="submit"
              disabled={requestSubmitting}
              className="w-full bg-[#FFB633] text-black hover:bg-[#e5a32e] disabled:opacity-60"
            >
              {requestSubmitting ? "Creating…" : "Create request"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
