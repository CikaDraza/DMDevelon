// lib/notify.js — central place to emit in-app notifications (+ optional email)
import { v4 as uuidv4 } from "uuid";
import Notification from "@/models/Notification";
import User from "@/models/User";
import { sendEmail } from "@/lib/email";
import { emailTemplates } from "@/lib/email-templates";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  "http://localhost:3003";

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
      read: false,
    });
  } catch (e) {
    console.error("notify create failed:", e);
    return;
  }
  if (email) {
    try {
      const recipient = await User.findById(userId);
      if (recipient?.email) {
        const tpl = emailTemplates.activityNotification({
          name: recipient.name,
          title,
          message: body || title,
          ctaUrl: `${APP_URL}${link}`,
          ctaLabel: "View",
        });
        await sendEmail({ to: recipient.email, ...tpl, type: "system" });
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
