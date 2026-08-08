"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { Bell, BellRing, CheckCheck, Share, Wifi } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
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
  admin: ["Messages", "Testimonials", "Requests", "Projects", "Chat"],
  client: ["My Projects", "Testimonials", "Chat"],
};

function categoryOf(n, variant) {
  // Checked first: chat notifications also carry entityType: "project" (to
  // reuse the existing project-link/email plumbing), so without this early
  // check they'd be misclassified as "Projects"/"My Projects" below.
  if (n.channelId) return "Chat";
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

/**
 * Where a notification points when it carries no `link` of its own.
 *
 * Older rows (and any future emitter that forgets a link) would otherwise be
 * unclickable, which reads as a broken bell. Derived from the fields the row
 * definitely has — channel, entity type, entity id — and split by audience,
 * because the same project lives at two different URLs for an operator and a
 * client.
 */
export function fallbackLinkFor(n, variant = "client") {
  if (!n) return "";
  if (n.channelId) {
    return variant === "admin"
      ? `/admin?tab=chat&channel=${n.channelId}`
      : `/dashboard/chat?channel=${n.channelId}`;
  }
  if (variant === "admin") {
    if (n.entityType === "contact") return "/admin?tab=messages";
    if (n.entityType === "testimonial") return "/admin?tab=testimonials";
    if (n.entityType === "request") {
      return n.entityId
        ? `/admin?tab=project-requests&id=${n.entityId}`
        : "/admin?tab=project-requests";
    }
    return n.entityId
      ? `/admin?tab=client-projects&id=${n.entityId}`
      : "/admin?tab=client-projects";
  }
  if (n.entityType === "testimonial") return "/dashboard?tab=testimonials";
  if (n.entityType === "request") {
    return n.entityId ? `/dashboard/requests/${n.entityId}` : "/dashboard";
  }
  return n.entityId ? `/dashboard/projects/${n.entityId}` : "/dashboard";
}

export default function NotificationBell({ variant = "client" }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { items, unreadCount, markRead } = useNotifications();
  const {
    supported,
    permission,
    isSubscribed,
    busy,
    subscribe,
    iosNeedsInstall,
    unavailableMessage,
    lastErrorMessage,
  } = usePush();
  const { getAuthHeaders } = useAuth();
  const [open, setOpen] = useState(false);
  const [testing, setTesting] = useState(false);

  const showEnablePush =
    supported && (permission !== "granted" || !isSubscribed);
  // Always offered. Gating it on "already subscribed" hid the diagnostic in
  // precisely the situation it exists for — someone whose push is not working
  // and who needs to be told which of the five causes it is.
  const showTestPush = true;

  const handleEnablePush = async () => {
    if (permission === "denied") {
      toast.error(
        "Notifications are blocked in your browser. Enable them in the site settings.",
      );
      return;
    }
    try {
      const ok = await subscribe();
      if (ok) {
        toast.success("Push notifications enabled");
      } else if (lastErrorMessage) {
        // The real failure, naming the step. Long-lived because this is the
        // sentence someone has to read out or screenshot to get help.
        toast.error(lastErrorMessage, { duration: 12000 });
      } else if (
        typeof Notification !== "undefined" &&
        Notification.permission === "denied"
      ) {
        toast.error("Permission denied. Enable it in your browser settings.");
      } else {
        toast.error("Couldn't enable push notifications.");
      }
    } catch {
      // subscribe() never throws, but guard anyway so the dashboard never breaks
      toast.error("Couldn't enable push notifications.");
    }
  };

  // Wiring test, run from the device that is supposedly not receiving pushes.
  // It bypasses the delivery policy on purpose: the question it answers is
  // "can the server reach this device at all", which is the one thing you
  // cannot tell from the outside when a push simply never shows up.
  const handleTestPush = async () => {
    // Browser-side blockers first: no point asking the server to push to a
    // device that cannot receive one, and this is the layer that carries the
    // reason people actually need (wrong origin, key missing from the build).
    if (unavailableMessage) {
      toast.error(unavailableMessage, { duration: 10000 });
      return;
    }
    if (lastErrorMessage && !isSubscribed) {
      toast.error(lastErrorMessage, { duration: 12000 });
      return;
    }
    if (!isSubscribed) {
      toast(
        "This device isn't subscribed yet — tap “Enable push notifications” above first.",
        { icon: "🔔", duration: 7000 },
      );
      return;
    }
    setTesting(true);
    try {
      const res = await axios.post(
        "/api/push/test",
        {},
        { headers: getAuthHeaders() },
      );
      const {
        sent,
        pruned,
        subscriptions,
        vapidConfigured,
        pushEnabledOnAccount,
      } = res.data || {};
      if (!vapidConfigured) {
        toast.error(
          "This server has no VAPID keys set. They live in the deployment's environment variables, not in the app.",
          { duration: 8000 },
        );
      } else if (pruned > 0 && sent === 0) {
        // The subscription was bound to a superseded VAPID key; it has just
        // been dropped, and the next page load re-creates it against the
        // current one.
        toast(
          "This device was registered against an older key. It has been reset — reload the page and try again.",
          { icon: "🔄", duration: 8000 },
        );
      } else if (!pushEnabledOnAccount) {
        toast.error("Push is switched off for your account in settings.");
      } else if (!subscriptions) {
        toast.error(
          "No device is subscribed on this account. Tap “Enable push notifications” first.",
        );
      } else if (sent > 0) {
        toast.success(
          `Sent to ${sent} device${sent === 1 ? "" : "s"} — if nothing appears, the OS is blocking it.`,
        );
      } else {
        toast.error(
          `${subscriptions} subscription${subscriptions === 1 ? "" : "s"} on file but none accepted the push — re-enable it on this device.`,
        );
      }
    } catch {
      toast.error("Couldn't reach the push test endpoint.");
    } finally {
      setTesting(false);
    }
  };

  const handleClick = (n) => {
    if (!n.read) {
      // Chat notifications: mark the entire channel's batch read at once
      // so the badge clears immediately instead of one-by-one.
      if (n.channelId) {
        markRead.mutate({ channelId: n.channelId });
      } else {
        markRead.mutate({ id: n._id });
      }
    }
    setOpen(false);

    // Every notification has to go SOMEWHERE. A row with no link used to be a
    // dead click; send those to the entity's natural home instead.
    const destination = n.link || fallbackLinkFor(n, variant);
    if (!destination) return;

    // Re-clicking a notification for the page you are already on is a no-op
    // for the router, which is right — except when only the query differs
    // (another channel, another proposal on the same project page). Those are
    // real navigations, and `push` handles them; the explicit compare is only
    // to skip the pointless history entry when nothing at all changes.
    const current = `${pathname}${
      searchParams?.toString() ? `?${searchParams}` : ""
    }`;
    if (destination === current) return;
    router.push(destination);
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
              .sort((a, b) => {
                const dA = new Date(grouped[a][0]?.createdAt || 0);
                const dB = new Date(grouped[b][0]?.createdAt || 0);
                return dB - dA;
              })
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
            {busy ? "Enabling…" : "Enable push notifications"}
          </button>
        )}
        {showTestPush && (
          <button
            onClick={handleTestPush}
            disabled={testing}
            className="w-full flex items-center gap-2 px-4 py-3 border-t border-white/10 text-left text-sm text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-60"
          >
            <Wifi className="w-4 h-4 shrink-0" />
            {testing
              ? "Sending…"
              : unavailableMessage
                ? "Why can't I get notifications?"
                : "Send a test push to this device"}
          </button>
        )}
        {iosNeedsInstall && (
          <button
            onClick={() =>
              toast(
                "Add to your home screen: Share → “Add to Home Screen”, then open the app from there for push.",
                { icon: "📲", duration: 6000 },
              )
            }
            className="w-full flex items-center gap-2 px-4 py-3 border-t border-white/10 text-sm text-gray-300 hover:bg-white/5 transition-colors text-left"
          >
            <Share className="w-4 h-4 shrink-0" />
            Install app for push notifications
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
