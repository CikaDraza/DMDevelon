// lib/push.js — Web Push (VAPID) delivery. Sends OS-level push notifications to
// a user's saved browser subscriptions and prunes dead ones.
import webpush from "web-push";
import PushSubscription from "@/models/PushSubscription";

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:contact@dmdevelon.website";

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  if (!PUBLIC_KEY || !PRIVATE_KEY) return false;
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
  configured = true;
  return true;
}

// Send a push payload to every subscription belonging to `userId`.
// Silently no-ops when VAPID isn't configured; never throws.
export async function sendPushToUser(userId, payload) {
  if (!userId || !ensureConfigured()) return;
  let subs;
  try {
    subs = await PushSubscription.find({ userId });
  } catch (e) {
    console.error("push: failed to load subscriptions:", e);
    return;
  }
  if (!subs.length) return;

  const body = JSON.stringify({
    title: payload.title || "Notification",
    body: payload.body || "",
    url: payload.link || payload.url || "/",
    icon: payload.icon || "/icons/dmdevelon_logo-notifications.png",
    badge: payload.badge || "/icons/badge-72.png",
  });

  const dead = [];
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          body,
        );
      } catch (err) {
        // 404/410 = subscription expired/unsubscribed → remove it
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          dead.push(sub._id);
        } else {
          console.error("push: send failed:", err?.statusCode || err?.message);
        }
      }
    }),
  );

  if (dead.length) {
    try {
      await PushSubscription.deleteMany({ _id: { $in: dead } });
    } catch (e) {
      console.error("push: prune failed:", e);
    }
  }
}
