// lib/notify.js — central place to emit in-app notifications (+ optional email)
import { v4 as uuidv4 } from "uuid";
import Notification from "@/models/Notification";
import User from "@/models/User";
import { sendEmail } from "@/lib/email";
import { emailTemplates } from "@/lib/email-templates";
import { sendPushToUser } from "@/lib/push";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  "http://localhost:3003";

// Message notifications are emailed as a batched digest (via the cron sweep),
// not inline, to avoid spamming one email per message. Everything else emails
// immediately when `email: true`.
const DIGEST_TYPES = new Set(["project_message", "request_message"]);

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
  email = false,
}) {
  if (!userId || (actorId && String(userId) === String(actorId))) return;
  try {
    await Notification.create({
      _id: uuidv4(),
      userId,
      type,
      title,
      body,
      link,
      entityType,
      entityId,
      milestoneId,
      read: false,
    });
  } catch (e) {
    console.error("notify create failed:", e);
    return;
  }

  // Load recipient once for preference checks (email/push toggles).
  let recipient = null;
  try {
    recipient = await User.findById(userId);
  } catch (e) {
    console.error("notify: load recipient failed:", e);
  }

  // Push: fire on every notification (unless the user turned it off).
  if (recipient && recipient.pushNotifications !== false) {
    sendPushToUser(userId, { title, body: body || title, link }).catch((e) =>
      console.error("notify push failed:", e),
    );
  }

  // Email. Message types are left for the digest sweep (emailedAt stays null);
  // only non-message notifications email inline here.
  if (email && !DIGEST_TYPES.has(type)) {
    try {
      if (recipient?.email && recipient.emailNotifications !== false) {
        const tpl = emailTemplates.activityNotification({
          name: recipient.name,
          title,
          message: body || title,
          logoUrl: `${APP_URL}/icons/dmdevelon_logo-notifications.png`,
          ctaUrl: `${APP_URL}${link}`,
          ctaLabel: "View",
        });
        await sendEmail({
          to: recipient.email,
          ...tpl,
          type: emailTypeForEntity(entityType),
        });
      }
    } catch (e) {
      console.error("notify email failed:", e);
    }
  }
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
