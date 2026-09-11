import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const resendSend = vi.fn();
const webPushSend = vi.fn();
const subscriptionFind = vi.fn();

vi.mock("@/lib/resend", () => ({
  getResendClient: () => ({ emails: { send: resendSend } }),
}));

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: webPushSend,
  },
}));

vi.mock("@/models/PushSubscription", () => ({
  default: {
    find: subscriptionFind,
    deleteMany: vi.fn(),
  },
}));

const originalEnv = {
  APP_ENV: process.env.APP_ENV,
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
  STAGING_SAFE_RECIPIENTS: process.env.STAGING_SAFE_RECIPIENTS,
};

function restoreEnv(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

beforeAll(() => {
  process.env.APP_ENV = "staging";
  process.env.VAPID_PUBLIC_KEY = "staging-public";
  process.env.VAPID_PRIVATE_KEY = "staging-private";
  process.env.STAGING_SAFE_RECIPIENTS = "bootstrap-only@example.com";
});

afterAll(() => {
  for (const [name, value] of Object.entries(originalEnv)) {
    restoreEnv(name, value);
  }
});

beforeEach(() => {
  resendSend.mockReset();
  resendSend.mockResolvedValue({ data: { id: "email-id" }, error: null });
  webPushSend.mockReset();
  webPushSend.mockResolvedValue(undefined);
  subscriptionFind.mockReset();
  subscriptionFind.mockResolvedValue([
    {
      _id: "subscription-id",
      endpoint: "https://push.example.test/device",
      keys: { p256dh: "p256dh", auth: "auth" },
    },
  ]);
});

describe("normal staging outbound delivery", () => {
  it("sends verification/notification email outside the optional bootstrap list", async () => {
    const { sendEmail } = await import("@/lib/email");

    await expect(
      sendEmail({
        to: "normal-staging-user@example.com",
        subject: "Verify",
        html: "<p>Verify</p>",
        type: "verification",
      }),
    ).resolves.toEqual({ success: true, messageId: "email-id" });
    expect(resendSend).toHaveBeenCalledOnce();
  });

  it("sends push for a staging user without consulting an email allowlist", async () => {
    const { sendPushToUser } = await import("@/lib/push");

    await expect(
      sendPushToUser("staging-user-id", { title: "Test", body: "Message" }),
    ).resolves.toMatchObject({ sent: 1, failed: 0, skipped: null });
    expect(webPushSend).toHaveBeenCalledOnce();
  });
});
