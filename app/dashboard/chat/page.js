"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { ProjectChat } from "@/components/chat/ProjectChat";
import NotificationBell from "@/components/NotificationBell";
import PushManager from "@/components/PushManager";
import { ArrowLeft } from "lucide-react";

function ChatPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="h-dvh bg-[#0f0f10] flex items-center justify-center">
        <div className="text-white">Loading…</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="h-dvh flex flex-col bg-[#0f0f10]">
      {/* Keeps the push subscription in sync while this page is open. The chat
          is where people sit longest, and it was the one authenticated page
          that never re-registered the service worker. */}
      <PushManager />
      {/* Header */}
      <header className="bg-[#1a1a1b] border-b border-white/10 px-3 lg:px-6 py-4 shrink-0">
        <div className="container mx-auto flex items-center justify-between px-1 lg:px-3">
          <Link href="/dashboard" className="flex items-center gap-3">
            <img
              src="/icons/dmd-logo.png"
              alt="DMDevelon"
              className="h-8 w-auto"
            />
            <div>
              <h1 className="font-bold text-white">DMDevelon</h1>
              <p className="text-xs text-gray-400">Client Dashboard</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            {/* The bell belongs here too: a notification about ANOTHER project
                arriving while you are in one channel had no visible home on
                this page, and neither did the "Enable push notifications"
                prompt it carries. */}
            <NotificationBell />
            <Link
              href="/dashboard"
              className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Chat fills the rest */}
      <main className="flex-1 min-h-0">
        <div className="container mx-auto px-4 py-8 h-full">
          <ProjectChat
            viewerRole="client"
            initialChannelId={searchParams.get("channel")}
            initialMessageId={searchParams.get("m")}
          />
        </div>
      </main>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="h-dvh bg-[#0f0f10] flex items-center justify-center">
          <div className="text-white">Loading…</div>
        </div>
      }
    >
      <ChatPageInner />
    </Suspense>
  );
}
