"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellRing, CheckCheck } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/useNotifications";
import { usePush } from "@/hooks/usePush";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

// Ordered categories per audience; maps a notification's entityType to a label.
const CATEGORY_ORDER = {
  admin: ["Messages", "Testimonials", "Requests", "Projects"],
  client: ["My Projects", "Testimonials"],
};

function categoryOf(n, variant) {
  if (variant === "admin") {
    if (n.entityType === "contact") return "Messages";
    if (n.entityType === "testimonial") return "Testimonials";
    if (n.entityType === "request") return "Requests";
    if (n.entityType === "project") return "Projects";
    return "Projects";
  }
  // client
  if (n.entityType === "testimonial") return "Testimonials";
  return "My Projects"; // request + project
}

export default function NotificationBell({ variant = "client" }) {
  const router = useRouter();
  const { items, unreadCount, markRead } = useNotifications();
  const { supported, permission, isSubscribed, busy, subscribe } = usePush();
  const [open, setOpen] = useState(false);

  const showEnablePush = supported && (permission !== "granted" || !isSubscribed);

  const handleEnablePush = async () => {
    if (permission === "denied") {
      toast.error(
        "Notifikacije su blokirane u browseru. Uključi ih u podešavanjima sajta.",
      );
      return;
    }
    const ok = await subscribe();
    if (ok) toast.success("Push notifikacije uključene");
    else if (Notification.permission === "denied")
      toast.error("Dozvola odbijena. Uključi je u podešavanjima browsera.");
  };

  const handleClick = (n) => {
    if (!n.read) markRead.mutate({ id: n._id });
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  // Group items by category, preserving the (recency-sorted) item order.
  const grouped = items.reduce((acc, n) => {
    const cat = categoryOf(n, variant);
    (acc[cat] ||= []).push(n);
    return acc;
  }, {});
  const categories = CATEGORY_ORDER[variant] || CATEGORY_ORDER.client;

  const renderItem = (n) => (
    <button
      key={n._id}
      onClick={() => handleClick(n)}
      className={cn(
        "w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors flex gap-2",
        !n.read && "bg-[#FFB633]/5",
      )}
    >
      <span
        className={cn(
          "mt-1.5 w-2 h-2 rounded-full shrink-0",
          n.read ? "bg-transparent" : "bg-[#FFB633]",
        )}
      />
      <span className="min-w-0">
        <span className="block text-sm text-white truncate">{n.title}</span>
        {n.body && (
          <span className="block text-xs text-gray-400 truncate">{n.body}</span>
        )}
        <span className="block text-[10px] text-gray-500 mt-0.5">
          {timeAgo(n.createdAt)}
        </span>
      </span>
    </button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative p-2 text-gray-400 hover:text-white transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 p-0 bg-[#1a1a1b] border-white/10 text-white"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={() => markRead.mutate({})}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#FFB633]"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">
              No notifications yet.
            </p>
          ) : (
            categories
              .filter((cat) => grouped[cat]?.length)
              .map((cat) => (
                <div key={cat}>
                  <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    {cat}
                  </p>
                  {grouped[cat].map(renderItem)}
                </div>
              ))
          )}
        </div>
        {showEnablePush && (
          <button
            onClick={handleEnablePush}
            disabled={busy}
            className="w-full flex items-center gap-2 px-4 py-3 border-t border-white/10 text-sm text-[#FFB633] hover:bg-white/5 transition-colors disabled:opacity-60"
          >
            <BellRing className="w-4 h-4 shrink-0" />
            {busy ? "Uključivanje..." : "Uključi push notifikacije"}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
