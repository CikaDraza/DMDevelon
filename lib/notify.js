// lib/notify.js — central place to emit in-app notifications (+ optional email)
import { v4 as uuidv4 } from "uuid";
import Notification from "@/models/Notification";
import User from "@/models/User";
import ChatRead from "@/models/ChatRead";
import { sendEmail } from "@/lib/email";
import { emailTemplates } from "@/lib/email-templates";
import { sendPushToUser } from "@/lib/push";
import { escapeRegExp, isUserOnline, maskEmail } from "@/lib/chat-domain.mjs";
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
  // A missing recipient is not "nothing to do" — it means a notification that
  // was supposed to go out silently did not. Say so; the callers that resolve
  // a recipient by email can and do come back empty.
  if (!userId) {
    console.warn(`notify: no recipient for "${title}" (${type}) — skipped`);
    return;
  }
  if (actorId && String(userId) === String(actorId)) return;
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
  if (scopeKey) {
    // Two independent lookups, NOT one document read for both fields. The
    // previous version took the single most recent row that had either
    // timestamp and read both off it — so a row that was pushed but never
    // emailed reported `lastEmailedAt: null`, re-opening the email gate even
    // when an email had gone out minutes earlier on an older row (and the
    // mirror image for push). Each channel now gets the true last delivery
    // for its own scope.
    const scopeFilter = channelId ? { channelId } : { entityId };
    try {
      const [lastEmail, lastPush] = await Promise.all([
        Notification.findOne({
          userId,
          ...scopeFilter,
          emailedAt: { $ne: null },
        })
          .sort({ emailedAt: -1 })
          .select("emailedAt"),
        Notification.findOne({
          userId,
          ...scopeFilter,
          pushedAt: { $ne: null },
        })
          .sort({ pushedAt: -1 })
          .select("pushedAt"),
      ]);
      lastEmailedAt = lastEmail?.emailedAt || null;
      lastPushedAt = lastPush?.pushedAt || null;
    } catch (e) {
      // Failing open (treating it as "nothing sent recently") is the safe
      // direction: worst case someone gets one extra email, versus silently
      // swallowing a notification.
      console.error("notify: throttle lookup failed:", e);
    }
  }
  // "Is this person actually looking at THIS conversation?" — the only
  // condition that should silence a push, since presence alone is per account
  // while a push targets a device. ChatRead already carries a precise
  // per-channel read receipt, so no new state is needed.
  let viewingConversation = false;
  if (channelId) {
    try {
      const read = await ChatRead.findOne({ channelId, userId }).select(
        "lastReadAt",
      );
      viewingConversation = isUserOnline(read?.lastReadAt);
    } catch (e) {
      // Failing open means "not viewing", i.e. they still get the push. The
      // safe direction is a notification too many, not one silently dropped.
      console.error("notify: read-receipt lookup failed:", e);
    }
  }

  const channels = resolveDeliveryChannels({
    type,
    recipientOnline: isUserOnline(recipient?.lastActiveAt),
    recipientViewingConversation: viewingConversation,
    lastEmailedAt,
    lastPushedAt,
  });

  if (channels.push && recipient && recipient.pushNotifications !== false) {
    // AWAITED, not fire-and-forget. On a serverless deployment the runtime is
    // free to freeze the instance the moment the HTTP response is returned, so
    // a promise still in flight here was simply never finished — the single
    // most likely reason push "worked sometimes". The cost is a few hundred ms
    // on the request that sends the message; the benefit is that a delivered
    // push is actually delivered.
    try {
      const result = await sendPushToUser(userId, {
        title,
        body: body || title,
        link,
        // One notification per conversation on the device: a later message in
        // the same channel replaces the earlier banner rather than stacking.
        tag: scopeKey ? `dmdevelon:${scopeKey}` : undefined,
      });
      // Only stamp pushedAt when a device actually received it. Stamping on
      // attempt made an expired subscription look like a successful delivery,
      // and the throttle then suppressed the next hour of real pushes.
      if (result?.sent > 0) {
        await Notification.updateOne(
          { _id: notificationId },
          { $set: { pushedAt: new Date() } },
        );
      }
    } catch (e) {
      console.error("notify push failed:", e);
    }
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
//
// The fallback retries case-insensitively. `User.email` is stored exactly as
// typed at registration while `ClientProject.clientEmail` is typed again by
// the operator when the project is created, so "Ana@…" vs "ana@…" resolved to
// nobody — and because notifyUser returns silently on a missing userId, the
// client's "Proposal ready" notification and email simply never happened, with
// nothing in the logs to say so. Both are addressed here.
export async function resolveClientUserId(entity) {
  if (entity?.clientUserId) return entity.clientUserId;
  const clientEmail = entity?.clientEmail;
  if (!clientEmail) return null;

  const exact = await User.findOne({ email: clientEmail }).select("_id");
  if (exact) return exact._id;

  // Only runs when the exact match already failed, and only for one entity at
  // a time, so the un-indexed scan is bounded.
  const insensitive = await User.findOne({
    email: { $regex: `^${escapeRegExp(clientEmail.trim())}$`, $options: "i" },
  }).select("_id");
  if (insensitive) return insensitive._id;

  console.warn(
    `notify: no account found for client email ${maskEmail(clientEmail)} — notification skipped`,
  );
  return null;
}
