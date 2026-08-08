// Global setup for the Chat API integration suite.
//
// Two jobs: refuse to run against anything that isn't a throwaway database,
// and stub the outbound side effects (email, web push, Cloudinary) so a test
// run never leaves the machine. Everything else — Mongo reads/writes,
// authorization, notification rows — is the real code path, because that is
// the whole point of this suite.
import { vi } from "vitest";

// --- Safety rail ------------------------------------------------------------
// A misconfigured MONGO_URL here would write test channels and messages into
// the live Atlas cluster. Fail loudly instead.
const mongoUrl = process.env.MONGO_URL || "";
if (/mongodb\+srv:/.test(mongoUrl) || /mongodb\.net/.test(mongoUrl)) {
  throw new Error(
    `Refusing to run integration tests against a remote cluster: ${mongoUrl}`,
  );
}
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)/.test(mongoUrl)) {
  throw new Error(
    `MONGO_URL must point at a local throwaway MongoDB, got: ${mongoUrl}`,
  );
}
if (!/test/i.test(process.env.DB_NAME || "")) {
  throw new Error(
    `DB_NAME must be a test database, got: ${process.env.DB_NAME}`,
  );
}

// --- Outbound side effects --------------------------------------------------
// Captured rather than discarded: several tests assert that a mention emails
// immediately while a plain message does not.
const outbound = vi.hoisted(() => ({ emails: [], pushes: [] }));
globalThis.__outbound = outbound;

vi.mock("@/lib/email", () => ({
  FROM_EMAIL_MAP: {},
  REPLY_TO_MAP: {},
  sendEmail: vi.fn(async (payload) => {
    outbound.emails.push(payload);
    return { id: "test-email" };
  }),
}));

// The stub stops short of the network but keeps lib/push's real contract:
// it counts the caller's ACTUAL subscriptions and reports `sent` from that.
// A stub that always answered `{ sent: 1 }` would have hidden the bug it is
// here to guard — notifyUser stamps `pushedAt` on that number, and stamping it
// for a user with no reachable device suppresses the next hour of real pushes.
vi.mock("@/lib/push", () => ({
  sendPushToUser: vi.fn(async (userId, payload) => {
    const { default: PushSubscription } = await import(
      "@/models/PushSubscription"
    );
    const subs = await PushSubscription.countDocuments({ userId });
    if (subs === 0) {
      return { sent: 0, failed: 0, pruned: 0, skipped: "no_subscriptions" };
    }
    outbound.pushes.push({ userId, ...payload });
    return { sent: subs, failed: 0, pruned: 0, skipped: null };
  }),
}));

vi.mock("@/lib/cloudinary", () => {
  const uploaded = async (file, folder, name) => ({
    url: `https://res.cloudinary.com/test/image/upload/${name || "file"}.png`,
    public_id: `${folder}/${name || "file"}`,
  });
  return {
    default: { config: () => {}, uploader: {}, api: {} },
    ROOT_FOLDER: "test",
    uploadToCloudinary: vi.fn(uploaded),
    uploadRawToCloudinary: vi.fn(uploaded),
    ensureClientFolders: vi.fn(async () => {}),
    ensureAdminFolders: vi.fn(async () => {}),
    clientFolder: (slug, kind = "chat") => `test/clients/${slug}/${kind}`,
    adminFolder: (kind = "chat") => `test/admin/${kind}`,
  };
});
