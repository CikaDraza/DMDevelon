"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { verifyEmail } = useAuth();
  const [state, setState] = useState("loading"); // loading | success | error
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return; // guard against double-run in strict mode
    ranRef.current = true;
    if (!token) {
      setState("error");
      return;
    }
    verifyEmail(token)
      .then(() => setState("success"))
      .catch(() => setState("error"));
  }, [token, verifyEmail]);

  return (
    <div className="min-h-screen bg-[#0f0f10] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#1a1a1b] border border-white/10 rounded-2xl p-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-6">
          <img src="/icons/dmd-logo.png" alt="DMDevelon" className="h-8 w-auto" />
          <span className="font-bold text-white">DMDevelon</span>
        </div>

        {state === "loading" && (
          <>
            <Loader2 className="w-12 h-12 text-[#FFB633] mx-auto mb-4 animate-spin" />
            <p className="text-gray-400">Verifying your email…</p>
          </>
        )}

        {state === "success" && (
          <>
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">Email verified</h1>
            <p className="text-gray-400 text-sm mb-6">
              Your email address has been confirmed. Thank you!
            </p>
            <Link
              href="/dashboard"
              className="inline-block bg-[#FFB633] text-black px-5 py-2 rounded-lg hover:bg-[#e5a32e]"
            >
              Go to dashboard
            </Link>
          </>
        )}

        {state === "error" && (
          <>
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">
              Verification failed
            </h1>
            <p className="text-gray-400 text-sm mb-6">
              This verification link is invalid or has already been used. You can
              request a new one from your dashboard.
            </p>
            <Link
              href="/dashboard"
              className="inline-block border border-white/20 text-gray-300 px-5 py-2 rounded-lg hover:text-white"
            >
              Go to dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0f0f10]" />}>
      <VerifyEmailInner />
    </Suspense>
  );
}
