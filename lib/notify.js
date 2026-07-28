// lib/notify.js — central place to emit in-app notifications (+ optional email)
import { v4 as uuidv4 } from "uuid";
import Notification from "@/models/Notification";
import User from "@/models/User";
import { sendEmail } from "@/lib/email";
import { emailTemplates } from "@/lib/email-templates";
import { sendPushToUser } from "@/lib/push";
import { isUserOnline } from "@/lib/chat-domain.mjs";
import {
  notificationScopeKey,
  resolveDeliveryChannels,
} from "@/lib/notification-policy.mjs";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  "http://localhost:3003";

// Message notifications are emailed as a batched digest (via the cron sweep),
// not inline, to avoid spamming one email per message. Everything else emails
// immediately when `email: true`. "chat_mention" is deliberately NOT in this
// set — being mentioned emails right away, same as I4's design intent.
export const DIGEST_TYPES = new Set([
  "project_message",
  "request_message",
  "chat_message",
]);

// Pick the sender identity (From + Reply-To) based on the notification's entity.
// Projects/requests -> milan.drazic@, testimonials/contact -> contact@.
function emailTypeForEntity(entityType) {
  if (entityType === "project" || entityType === "request") return "project";
  if (entityType === "testimonial" || entityType === "contact") return "testimonial";
  return "system";
}

// Create one in-app notification for a recipient; optionally email them.
// Skips self-notification (actor === recipient).
export async function notifyUser({
  userId,
  actorId,
  type = "info",
  title,
  body = "",
  link = "",
  entityType = "",
  entityId = "",
  milestoneId = "",
  proposalId = "",
  channelId = "",
  dedupeKey = "",
  email = false,
}) {
  if (!userId || (actorId && String(userId) === String(actorId))) return;
  let created = true;
  const notificationId = uuidv4();
  try {
    const notification = {
      _id: notificationId,
      userId,
      type,
      title,
      body,
      link,
      entityType,
      entityId,
      milestoneId,
      proposalId,
      channelId,
      read: false,
    };
    if (dedupeKey) {
      const result = await Notification.updateOne(
        { userId, dedupeKey },
        { $setOnInsert: { ...notification, dedupeKey } },
        { upsert: true },
      );
      created = Boolean(result.upsertedCount || result.upsertedId);
    } else {
      await Notification.create(notification);
    }
  } catch (e) {
    console.error("notify create failed:", e);
    return;
  }
  // A replay completes any missing surrounding audit work without sending a
  // duplicate in-app notification, push, or email.
  if (!created) return { created: false };

  // Load recipient once for preference checks (email/push toggles) and for
  // presence.
  let recipient = null;
  try {
    recipient = await User.findById(userId);
  } catch (e) {
    console.error("notify: load recipient failed:", e);
  }

  // How loud may this one be? A conversation is many messages in a short
  // window, so email/push for those are throttled per conversation and
  // skipped entirely for someone who already has the app open. Actionable
  // notifications (mentions, the proposal lifecycle) always go out.
  const scopeKey = notificationScopeKey({ channelId, entityId });
  let lastEmailedAt = null;
  let lastPushedAt = null;
  try {
    const lastDelivered = await Notification.findOne({
      userId,
      ...(channelId ? { channelId } : { entityId }),
      $or: [{ emailedAt: { $ne: null } }, { pushedAt: { $ne: null } }],
    })
      .sort({ createdAt: -1 })
      .select("emailedAt pushedAt");
    lastEmailedAt = lastDelivered?.emailedAt || null;
    lastPushedAt = lastDelivered?.pushedAt || null;
  } catch (e) {
    // Failing open (treating it as "nothing sent recently") is the safe
    // direction: worst case someone gets one extra email, versus silently
    // swallowing a notification.
    console.error("notify: throttle lookup failed:", e);
  }
  const channels = resolveDeliveryChannels({
    type,
    recipientOnline: isUserOnline(recipient?.lastActiveAt),
    lastEmailedAt: scopeKey ? lastEmailedAt : null,
    lastPushedAt: scopeKey ? lastPushedAt : null,
  });

  if (channels.push && recipient && recipient.pushNotifications !== false) {
    sendPushToUser(userId, { title, body: body || title, link })
      .then(() =>
        Notification.updateOne(
          { _id: notificationId },
          { $set: { pushedAt: new Date() } },
        ),
      )
      .catch((e) => console.error("notify push failed:", e));
  }

  // Email. Message types are left for the digest sweep (emailedAt stays null);
  // only non-message notifications email inline here.
  if (email && channels.email && !DIGEST_TYPES.has(type)) {
    try {
      if (recipient?.email && recipient.emailNotifications !== false) {
        const tpl = emailTemplates.activityNotification({
          name: recipient.name,
          title,
          message: body || title,
          logoUrl: `${APP_URL}/icons/dmd-email-logo.png`,
          ctaUrl: `${APP_URL}${link}`,
          ctaLabel: "View",
        });
        await sendEmail({
          to: recipient.email,
          ...tpl,
          type: emailTypeForEntity(entityType),
        });
        await Notification.updateOne(
          { _id: notificationId },
          { $set: { emailedAt: new Date() } },
        );
      }
    } catch (e) {
      console.error("notify email failed:", e);
    }
  }
  return { created: true };
}

// Notify every admin (except the actor).
export async function notifyAdmins(opts) {
  const admins = await User.find({ isAdmin: true }).select("_id");
  await Promise.all(
    admins.map((a) => notifyUser({ ...opts, userId: a._id })),
  );
}

// Resolve a request/project client's User._id (clientUserId may be null on
// older docs, so fall back to matching by email).
export async function resolveClientUserId(entity) {
  if (entity?.clientUserId) return entity.clientUserId;
  if (entity?.clientEmail) {
    const u = await User.findOne({ email: entity.clientEmail }).select("_id");
    return u?._id || null;
  }
  return null;
}
