"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  XCircle,
  Mail,
  LogOut,
  UserPlus,
  LogIn,
} from "lucide-react";

function isExpired(preview) {
  return (
    preview?.status === "expired" ||
    (preview?.expiresAt && new Date(preview.expiresAt).getTime() < Date.now())
  );
}

const DEAD_MESSAGES = {
  revoked: "This invitation has been revoked by the project owner.",
  accepted: "This invitation has already been used.",
  expired: "This invitation has expired.",
};

function InviteInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // The raw token, captured into state and then held independently of the URL.
  //
  // The App Router patches window.history.replaceState — its own source says
  // it "ensures usePathname and useSearchParams hold the newly provided url".
  // So the hygiene call below (which strips ?token= from the address bar)
  // also blanks the token out of useSearchParams(). Reading the token
  // straight from searchParams therefore loses it the instant the URL is
  // cleaned, and this page would reject a perfectly valid invitation as
  // "missing its token".
  const [token, setToken] = useState(() => searchParams.get("token"));
  const {
    user,
    loading: authLoading,
    isAuthenticated,
    login,
    register,
    logout,
    getAuthHeaders,
  } = useAuth();

  // preview: loading | not_found | dead | ready
  const [previewState, setPreviewState] = useState("loading");
  const [preview, setPreview] = useState(null);
  const [mode, setMode] = useState("register"); // register | login
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [acceptError, setAcceptError] = useState("");
  const [accepting, setAccepting] = useState(false);

  // Only ever adopts a token, never clears one. That way a token that only
  // becomes readable a render after mount is still picked up, while the
  // URL-stripping below can never take it back away.
  useEffect(() => {
    const fromUrl = searchParams.get("token");
    if (fromUrl && fromUrl !== token) setToken(fromUrl);
  }, [searchParams, token]);

  useEffect(() => {
    if (!token) {
      setPreviewState("not_found");
      return;
    }
    axios
      .get(`/api/invitations/preview?token=${encodeURIComponent(token)}`)
      .then((res) => {
        setPreview(res.data);
        const dead =
          res.data.status === "revoked" ||
          res.data.status === "accepted" ||
          isExpired(res.data);
        setPreviewState(dead ? "dead" : "ready");
        // Strip the raw token from the visible URL/history once the server
        // has it (via the HttpOnly cookie the preview call just set), so it
        // stops sitting in the address bar, browser history and any outbound
        // referrer. This DOES clear it from useSearchParams() too (the App
        // Router patches replaceState) — which is exactly why `token` above
        // is held in component state rather than read from the URL.
        window.history.replaceState(null, "", "/invite");
      })
      .catch(() => setPreviewState("not_found"));
  }, [token]);

  const acceptInvitation = useCallback(async () => {
    setAccepting(true);
    setAcceptError("");
    try {
      await axios.post(
        "/api/invitations/accept",
        { token },
        { headers: getAuthHeaders() },
      );
      toast.success("You're in!");
      router.push("/dashboard?tab=chat");
    } catch (error) {
      setAcceptError(
        error.response?.data?.error || "Failed to accept the invitation",
      );
    } finally {
      setAccepting(false);
    }
  }, [token, getAuthHeaders, router]);

  // Already signed in when the page loads (or just finished loading the
  // session) — try acceptance right away, no form needed.
  useEffect(() => {
    if (
      previewState === "ready" &&
      !authLoading &&
      isAuthenticated &&
      !accepting &&
      !acceptError
    ) {
      acceptInvitation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewState, authLoading, isAuthenticated]);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      // email is deliberately not sent — the server locks the new account's
      // address to the invitation's own address and ignores this field.
      await register(form.name, "", form.password, { inviteToken: token });
      toast.success("Account created — you're in!");
      router.push("/dashboard?tab=chat");
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to create account");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(form.email, form.password);
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to sign in");
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    await acceptInvitation();
  };

  const handleSwitchAccount = async () => {
    setAcceptError("");
    await logout();
    setMode("login");
  };

  return (
    <div className="min-h-screen bg-[#0f0f10] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-[#1a1a1b] border border-white/10 rounded-2xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <img
            src="/icons/dmd-logo.png"
            alt="DMDevelon"
            className="h-8 w-auto"
          />
          <span className="font-bold text-white">DMDevelon</span>
        </div>

        {previewState === "loading" && (
          <div className="text-center py-8">
            <Loader2 className="w-10 h-10 text-[#FFB633] mx-auto mb-4 animate-spin" />
            <p className="text-gray-400 text-sm">Loading invitation…</p>
          </div>
        )}

        {previewState === "not_found" && (
          <div className="text-center py-4">
            <XCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">
              Invalid invitation link
            </h1>
            <p className="text-gray-400 text-sm mb-6">
              This link is missing its token or does not match any
              invitation.
            </p>
            <Link
              href="/"
              className="inline-block bg-[#FFB633] text-black px-5 py-2 rounded-lg hover:bg-[#e5a32e]"
            >
              Go home
            </Link>
          </div>
        )}

        {previewState === "dead" && (
          <div className="text-center py-4">
            <XCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">
              This invitation is no longer valid
            </h1>
            <p className="text-gray-400 text-sm mb-6">
              {DEAD_MESSAGES[
                preview?.status === "accepted" || preview?.status === "revoked"
                  ? preview.status
                  : "expired"
              ] || "This invitation can no longer be used."}
              {" "}Ask{" "}
              {preview?.inviterName || "the project owner"} to send a new one.
            </p>
            <Link
              href="/"
              className="inline-block border border-white/20 text-gray-300 px-5 py-2 rounded-lg hover:text-white"
            >
              Go home
            </Link>
          </div>
        )}

        {previewState === "ready" && (
          <>
            <div className="mb-6">
              <h1 className="text-xl font-bold text-white mb-1">
                You've been invited
              </h1>
              <p className="text-gray-400 text-sm">
                <span className="text-white">{preview.inviterName}</span>{" "}
                invited you to collaborate on{" "}
                <span className="text-white">{preview.projectName}</span> as
                a <span className="text-[#FFB633]">{preview.intendedRoleLabel}</span>.
              </p>
              {preview.personalMessage && (
                <p className="mt-3 text-sm text-gray-300 bg-white/5 border border-white/10 rounded-lg p-3 whitespace-pre-wrap">
                  {preview.personalMessage}
                </p>
              )}
            </div>

            {authLoading || (isAuthenticated && !acceptError) ? (
              <div className="text-center py-6">
                <Loader2 className="w-8 h-8 text-[#FFB633] mx-auto mb-3 animate-spin" />
                <p className="text-gray-400 text-sm">
                  {authLoading ? "Checking your session…" : "Joining the project…"}
                </p>
              </div>
            ) : acceptError ? (
              <div className="text-center py-4">
                <p className="text-red-400 text-sm mb-2">{acceptError}</p>
                {/* The invited address is masked (the preview is
                    unauthenticated, so it must not disclose who was invited)
                    — but two different addresses can mask identically
                    ("d***@gmail.com"), which makes a mismatch look like the
                    page is simply wrong. Showing the viewer their OWN signed-in
                    address discloses nothing they don't already know and makes
                    the actual problem obvious. */}
                {user?.email && (
                  <p className="text-gray-400 text-xs mb-4">
                    You are signed in as{" "}
                    <span className="text-gray-200">{user.email}</span>.
                  </p>
                )}
                <Button
                  onClick={handleSwitchAccount}
                  variant="outline"
                  className="border-white/20 text-gray-300 hover:text-white"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out and use a different account
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                  <Mail className="w-3.5 h-3.5" />
                  This invitation is for{" "}
                  <span className="text-gray-300">
                    {preview.maskedEmail || "your email address"}
                  </span>
                </div>

                <div className="flex rounded-lg border border-white/10 p-1 mb-5">
                  <button
                    type="button"
                    onClick={() => setMode("register")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm transition-colors ${
                      mode === "register"
                        ? "bg-[#FFB633] text-black font-medium"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <UserPlus className="w-4 h-4" />
                    Create account
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm transition-colors ${
                      mode === "login"
                        ? "bg-[#FFB633] text-black font-medium"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <LogIn className="w-4 h-4" />
                    Sign in
                  </button>
                </div>

                {mode === "register" ? (
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                      <Label className="text-white">Email</Label>
                      <Input
                        value={preview.maskedEmail || ""}
                        disabled
                        className="bg-white/5 border-white/10 text-gray-400"
                      />
                    </div>
                    <div>
                      <Label className="text-white">Your name</Label>
                      <Input
                        value={form.name}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, name: e.target.value }))
                        }
                        required
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-white">Password</Label>
                      <Input
                        type="password"
                        value={form.password}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, password: e.target.value }))
                        }
                        required
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-white">Confirm password</Label>
                      <Input
                        type="password"
                        value={form.confirmPassword}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            confirmPassword: e.target.value,
                          }))
                        }
                        required
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={submitting}
                      className="w-full bg-[#FFB633] text-black hover:bg-[#e5a32e]"
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Create account and join"
                      )}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <Label className="text-white">Email</Label>
                      <Input
                        type="email"
                        value={form.email}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, email: e.target.value }))
                        }
                        required
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-white">Password</Label>
                      <Input
                        type="password"
                        value={form.password}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, password: e.target.value }))
                        }
                        required
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={submitting}
                      className="w-full bg-[#FFB633] text-black hover:bg-[#e5a32e]"
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Sign in and join"
                      )}
                    </Button>
                  </form>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0f0f10]" />}>
      <InviteInner />
    </Suspense>
  );
}
