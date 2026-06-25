"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lightbulb, Lock } from "lucide-react";

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { resetPassword } = useAuth();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token, password);
      toast.success("Password updated. Please sign in.");
      router.push("/");
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f10] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#1a1a1b] border border-white/10 rounded-2xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <Lightbulb className="w-8 h-8 text-[#FFB633]" />
          <span className="font-bold text-white">DMDevelon</span>
        </div>

        {!token ? (
          <div className="text-center">
            <h1 className="text-xl font-bold text-white mb-2">
              Invalid reset link
            </h1>
            <p className="text-gray-400 text-sm">
              This link is missing its token.{" "}
              <Link href="/" className="text-[#FFB633] hover:underline">
                Go home
              </Link>
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-1">
              <Lock className="w-5 h-5 text-[#FFB633]" />
              <h1 className="text-xl font-bold text-white">Set a new password</h1>
            </div>
            <p className="text-gray-400 text-sm mb-6">
              Choose a new password for your account.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-white">New password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="bg-white/5 border-white/10 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-white">Confirm password</Label>
                <Input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="bg-white/5 border-white/10 text-white mt-1"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#FFB633] text-black hover:bg-[#e5a32e]"
              >
                {loading ? "Updating…" : "Update password"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0f0f10]" />}>
      <ResetPasswordInner />
    </Suspense>
  );
}
