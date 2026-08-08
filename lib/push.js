// lib/push.js — Web Push (VAPID) delivery. Sends OS-level push notifications to
// a user's saved browser subscriptions and prunes dead ones.
import webpush from "web-push";
import PushSubscription from "@/models/PushSubscription";

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:contact@dmdevelon.website";

// Push services reject oversized payloads (the spec floor is 4 KB of
// ciphertext). Truncating the body here is what keeps a long chat message
// from silently failing to deliver.
const MAX_BODY_CHARS = 300;

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  if (!PUBLIC_KEY || !PRIVATE_KEY) return false;
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
  configured = true;
  return true;
}

/**
 * Send a push payload to every subscription belonging to `userId`.
 *
 * Never throws — a push failure must not fail the request that triggered it.
 * Returns `{ sent, failed, pruned, skipped }` so the caller can record whether
 * a push actually reached a device; `notifyUser` uses `sent > 0` to decide
 * whether to stamp `pushedAt`. Before this returned undefined, so `pushedAt`
 * was written even when every subscription had expired — and the throttle then
 * suppressed the NEXT push too, on the strength of one that never arrived.
 *
 * `skipped: "not_configured"` (no VAPID keys) is deliberately distinct from
 * `skipped: "no_subscriptions"`: the first is a deployment problem, the second
 * is a user who simply never enabled push.
 */
export async function sendPushToUser(userId, payload = {}) {
  if (!userId) return { sent: 0, failed: 0, pruned: 0, skipped: "no_user" };
  if (!ensureConfigured()) {
    return { sent: 0, failed: 0, pruned: 0, skipped: "not_configured" };
  }

  let subs;
  try {
    subs = await PushSubscription.find({ userId });
  } catch (e) {
    console.error("push: failed to load subscriptions:", e);
    return { sent: 0, failed: 0, pruned: 0, skipped: "lookup_failed" };
  }
  if (!subs.length) {
    return { sent: 0, failed: 0, pruned: 0, skipped: "no_subscriptions" };
  }

  const rawBody = payload.body || "";
  const body = JSON.stringify({
    title: payload.title || "Notification",
    body:
      rawBody.length > MAX_BODY_CHARS
        ? `${rawBody.slice(0, MAX_BODY_CHARS - 1)}…`
        : rawBody,
    url: payload.link || payload.url || "/",
    icon: payload.icon || "/icons/dmdevelon_logo-notifications.png",
    badge: payload.badge || "/icons/badge-72.png",
    // A tag makes a second notification for the same conversation REPLACE the
    // first on the device instead of stacking a fresh banner per message.
    ...(payload.tag ? { tag: payload.tag } : {}),
  });

  const dead = [];
  let sent = 0;
  let failed = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          body,
        );
        sent++;
      } catch (err) {
        // 404/410 = subscription expired/unsubscribed → remove it
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          dead.push(sub._id);
        } else {
          failed++;
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

  return { sent, failed, pruned: dead.length, skipped: null };
}
