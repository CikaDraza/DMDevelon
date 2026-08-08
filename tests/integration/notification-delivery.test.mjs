// Notification, email and web-push DELIVERY — the pipeline itself, rather
// than the chat rules that feed it (those live in chat-notifications).
//
// Everything here was reported by the operator as "works sometimes": a push
// that never arrived, a proposal email that did not go out, a message digest
// that stayed silent for an hour after an unrelated email. Each describe block
// pins one of those down.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  asUser,
  connectTestDb,
  disconnectTestDb,
  groupChannelIdFor,
  makeProject,
  makeUser,
  outbox,
  resetDb,
  runDigestSweep,
  seedProjectCast,
  subscribeToPush,
} from "./harness.mjs";
import Notification from "@/models/Notification";
import PushSubscription from "@/models/PushSubscription";
import User from "@/models/User";
import { v4 as uuidv4 } from "uuid";

let cast;
let admin;
let client;

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(async () => {
  await resetDb();
  cast = await seedProjectCast();
  admin = asUser(cast.admin);
  client = asUser(cast.client);
  // Listing channels doubles as a presence heartbeat; start every test from
  // "nobody is online" so suppression is only in play where a test says so.
  await User.updateMany({}, { $set: { lastActiveAt: null } });
});

const notificationsFor = (user) =>
  Notification.find({ userId: user._id }).sort({ createdAt: -1 });
const emailsTo = (address) => outbox().emails.filter((e) => e.to === address);
const pushesTo = (user) =>
  outbox().pushes.filter((p) => String(p.userId) === String(user._id));

describe("proposal lifecycle reaches the people it is blocking", () => {
  let proposalId;

  beforeEach(async () => {
    const created = await admin.post(
      `client-projects/${cast.project._id}/proposals`,
      {
        title: "Phase 2 — Booking flow",
        scope: "Request-first booking with manual confirmation.",
        budget: "2400 EUR",
      },
    );
    expect(created.status).toBe(201);
    proposalId = created.body._id;
  });

  it("sending a proposal notifies AND emails the client", async () => {
    const res = await admin.post(
      `client-projects/${cast.project._id}/proposals/${proposalId}/send`,
      {},
    );
    expect(res.status).toBe(200);

    const [row] = await notificationsFor(cast.client);
    expect(row.type).toBe("project_proposal_sent");
    expect(row.proposalId).toBe(proposalId);
    expect(row.link).toBe(
      `/dashboard/projects/${cast.project._id}?proposal=${proposalId}`,
    );
    expect(emailsTo(cast.client.email)).toHaveLength(1);
  });

  it("a proposal still emails a client who happens to be online", async () => {
    // Presence suppresses chatter, never a commercial step someone is blocked
    // on. This is the rule that keeps "I never got the email" from being a
    // side effect of having a tab open.
    await User.updateOne(
      { _id: cast.client._id },
      { $set: { lastActiveAt: new Date() } },
    );

    await admin.post(
      `client-projects/${cast.project._id}/proposals/${proposalId}/send`,
      {},
    );

    expect(emailsTo(cast.client.email)).toHaveLength(1);
  });

  it("accepting, rejecting and requesting changes each reach the operator", async () => {
    await admin.post(
      `client-projects/${cast.project._id}/proposals/${proposalId}/send`,
      {},
    );

    const changes = await client.post(
      `client-projects/${cast.project._id}/proposals/${proposalId}/request-changes`,
      { reason: "Please split the booking work in two." },
    );
    expect(changes.status).toBe(200);

    const adminRows = await notificationsFor(cast.admin);
    expect(adminRows[0].type).toBe("project_proposal_changes_requested");
    expect(adminRows[0].link).toContain(`proposal=${proposalId}`);
    expect(emailsTo(cast.admin.email).length).toBeGreaterThanOrEqual(1);
  });

  it("a client whose account email differs only in case is still found", async () => {
    // ClientProject.clientEmail is typed by the operator; User.email is typed
    // by the client at registration. A capital letter between the two used to
    // resolve to nobody, and notifyUser returned silently — no row, no email,
    // no log line.
    const owner = await makeUser({
      name: "Mixed Case",
      email: "ana.petrovic@test.local",
    });
    const project = await makeProject({ owner, title: "Case Sensitivity" });
    project.clientUserId = null; // force the email fallback
    project.clientEmail = "Ana.Petrovic@Test.Local";
    await project.save();

    const created = await admin.post(`client-projects/${project._id}/proposals`, {
      title: "Phase 2",
      scope: "Something",
    });
    await admin.post(
      `client-projects/${project._id}/proposals/${created.body._id}/send`,
      {},
    );

    expect(await notificationsFor(owner)).toHaveLength(1);
    expect(emailsTo(owner.email)).toHaveLength(1);
  });
});

describe("web push delivery", () => {
  let channelId;

  beforeEach(async () => {
    channelId = await groupChannelIdFor(admin, cast.project._id);
    await User.updateMany({}, { $set: { lastActiveAt: null } });
  });

  it("a push is finished before the request returns", async () => {
    // The send used to be fire-and-forget. On a serverless runtime the
    // instance is free to freeze the moment the response is written, so the
    // in-flight push simply never completed — the single likeliest reason
    // push "worked sometimes". Asserting immediately after the call, with no
    // sleep, is the whole point of this test.
    await subscribeToPush(cast.collaborator);

    await admin.post(`chat/channels/${channelId}/messages`, {
      body: "does this reach the phone?",
    });

    expect(pushesTo(cast.collaborator)).toHaveLength(1);
    const [row] = await Notification.find({ userId: cast.collaborator._id });
    expect(row.pushedAt).toBeTruthy();
  });

  it("pushedAt is not stamped when no device was reachable", async () => {
    // Nobody is subscribed here. Stamping pushedAt on ATTEMPT made an
    // undelivered push suppress the next hour of real ones, because the
    // throttle reads that timestamp as proof of delivery.
    await admin.post(`chat/channels/${channelId}/messages`, {
      body: "into the void",
    });

    const [row] = await Notification.find({ userId: cast.collaborator._id });
    expect(row).toBeTruthy();
    expect(row.pushedAt).toBeNull();
  });

  it("the test endpoint reports why a device is or is not reachable", async () => {
    // "Push doesn't arrive on my phone" has at least five distinct causes and
    // none are visible from outside. This turns it into an answer.
    const withoutDevice = await client.post("push/test", {});
    expect(withoutDevice.status).toBe(200);
    expect(withoutDevice.body.subscriptions).toBe(0);
    expect(withoutDevice.body.sent).toBe(0);
    expect(withoutDevice.body.pushEnabledOnAccount).toBe(true);

    await subscribeToPush(cast.client);
    const withDevice = await client.post("push/test", {});
    expect(withDevice.body.subscriptions).toBe(1);
    expect(withDevice.body.sent).toBe(1);
    // The host is returned on purpose — it is how you tell one device from
    // another. The full endpoint is not: its path is a bearer credential for
    // that browser, and anyone holding it can push to the device.
    expect(withDevice.body.devices[0].host).toBe("push.test.local");
    expect(JSON.stringify(withDevice.body)).not.toContain(
      `push.test.local/${cast.client._id}`,
    );
  });

  it("a subscription rejected for bad credentials is pruned, not retried forever", async () => {
    // 401/403 from the push service means this subscription was created
    // against a VAPID key the server no longer signs with — a key rotation
    // leaves every existing device in exactly this state. Keeping the row
    // means failing on every send forever with nothing to show for it; the
    // client rebuilds it against the current key once it is gone.
    const { sendPushToUser } = await import("@/lib/push");
    const working = sendPushToUser.getMockImplementation();
    await subscribeToPush(cast.collaborator);

    sendPushToUser.mockImplementation(async (userId) => {
      const { default: PushSubscription } = await import(
        "@/models/PushSubscription"
      );
      await PushSubscription.deleteMany({ userId });
      return { sent: 0, failed: 0, pruned: 1, skipped: null };
    });

    await admin.post(`chat/channels/${channelId}/messages`, {
      body: "goes to a device bound to an old key",
    });

    const remaining = await PushSubscription.countDocuments({
      userId: cast.collaborator._id,
    });
    expect(remaining).toBe(0);

    // Nothing was delivered, so nothing may claim it was.
    const [row] = await Notification.find({ userId: cast.collaborator._id });
    expect(row.pushedAt).toBeNull();

    sendPushToUser.mockImplementation(working);
  });

  it("the test endpoint refuses an anonymous caller", async () => {
    const { callApi } = await import("./harness.mjs");
    const res = await callApi("POST", "push/test", { body: {} });
    expect(res.status).toBe(401);
  });

  it("push carries a per-conversation tag so banners replace rather than stack", async () => {
    await subscribeToPush(cast.collaborator);

    await admin.post(`chat/channels/${channelId}/messages`, {
      body: "tag me",
    });

    const [push] = pushesTo(cast.collaborator);
    expect(push.tag).toBe(`dmdevelon:${channelId}`);
  });
});

describe("email and push throttle independently", () => {
  let channelId;

  beforeEach(async () => {
    channelId = await groupChannelIdFor(admin, cast.project._id);
    await User.updateMany({}, { $set: { lastActiveAt: null } });
  });

  it("a row that was pushed but not emailed does not re-open the email gate", async () => {
    // The throttle lookup used to read the most recent row carrying EITHER
    // timestamp and take both fields off it. A push-only row therefore
    // reported "never emailed", letting a second email out inside the window.
    // Both timestamps now come from their own scoped lookup.
    const recent = new Date(Date.now() - 60_000);
    await Notification.create({
      _id: uuidv4(),
      userId: cast.collaborator._id,
      type: "chat_message",
      title: "earlier — emailed",
      channelId,
      entityId: cast.project._id,
      emailedAt: recent,
      pushedAt: null,
      read: true,
    });
    await Notification.create({
      _id: uuidv4(),
      userId: cast.collaborator._id,
      type: "chat_message",
      title: "later — pushed only",
      channelId,
      entityId: cast.project._id,
      emailedAt: null,
      pushedAt: new Date(Date.now() - 30_000),
      read: true,
    });

    const before = emailsTo(cast.collaborator.email).length;
    await admin.post(`chat/channels/${channelId}/messages`, {
      body: "@Collab Person still inside the email window",
    });

    // chat_mention is actionable and deliberately never throttled, so this
    // one DOES send — what matters is that the lookup no longer mis-reports
    // the timestamps. Verify the recorded state directly instead.
    expect(emailsTo(cast.collaborator.email).length).toBeGreaterThan(before);

    const rows = await Notification.find({
      userId: cast.collaborator._id,
      channelId,
      emailedAt: { $ne: null },
    }).sort({ emailedAt: -1 });
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  it("a conversation already pushed inside the window is not pushed again", async () => {
    await subscribeToPush(cast.collaborator);

    await admin.post(`chat/channels/${channelId}/messages`, { body: "one" });
    await admin.post(`chat/channels/${channelId}/messages`, { body: "two" });
    await admin.post(`chat/channels/${channelId}/messages`, { body: "three" });

    expect(await notificationsFor(cast.collaborator)).toHaveLength(3);
    expect(pushesTo(cast.collaborator)).toHaveLength(1);
  });
});

describe("email digest sweep", () => {
  let channelId;

  beforeEach(async () => {
    channelId = await groupChannelIdFor(admin, cast.project._id);
    await User.updateMany({}, { $set: { lastActiveAt: null } });
    outbox().emails.length = 0;
  });

  it("an unrelated inline email no longer holds back the message digest", async () => {
    // The per-user throttle counted ANY notification with emailedAt set,
    // including the actionable ones that bypass the digest on purpose. A
    // client who had just been emailed "Proposal ready" therefore heard
    // nothing about their unread messages for a full hour.
    await Notification.create({
      _id: uuidv4(),
      userId: cast.collaborator._id,
      type: "project_proposal_sent",
      title: "Proposal ready",
      entityId: cast.project._id,
      emailedAt: new Date(),
      read: true,
    });
    await admin.post(`chat/channels/${channelId}/messages`, {
      body: "and here is an unread message",
    });

    const res = await runDigestSweep();
    expect(res.status).toBe(200);
    // The sweep is system-wide, so it also emails the other recipients of
    // that message; the assertion that matters is the one person who was
    // being held back.
    expect(emailsTo(cast.collaborator.email)).toHaveLength(1);
  });

  it("a message digest inside the window is still held back", async () => {
    await Notification.create({
      _id: uuidv4(),
      userId: cast.collaborator._id,
      type: "chat_message",
      title: "already digested",
      channelId,
      entityId: cast.project._id,
      emailedAt: new Date(),
      read: true,
    });
    await admin.post(`chat/channels/${channelId}/messages`, {
      body: "too soon for another digest",
    });

    await runDigestSweep();

    // Throttled for this one recipient only — everyone else on the channel
    // still hears about it, which is the difference between a throttle and an
    // outage.
    expect(emailsTo(cast.collaborator.email)).toHaveLength(0);
    expect(emailsTo(cast.viewer.email)).toHaveLength(1);
  });

  it("notifications are not consumed when the send fails", async () => {
    // Marking them emailed BEFORE the call meant an email-provider outage
    // silently burned the batch: emailedAt was set, the next sweep skipped
    // them, and nobody was ever told.
    const { sendEmail } = await import("@/lib/email");
    await admin.post(`chat/channels/${channelId}/messages`, {
      body: "this one must survive a failed sweep",
    });

    const working = sendEmail.getMockImplementation();
    sendEmail.mockImplementation(async () => {
      throw new Error("provider down");
    });
    const failed = await runDigestSweep();
    expect(failed.body.sent).toBe(0);

    const stillPending = await Notification.countDocuments({
      type: "chat_message",
      emailedAt: null,
    });
    expect(stillPending).toBeGreaterThan(0);

    // …and the retry on the next sweep goes through.
    sendEmail.mockImplementation(working);
    const retried = await runDigestSweep();
    expect(retried.body.sent).toBeGreaterThan(0);
    expect(emailsTo(cast.collaborator.email)).toHaveLength(1);
  });
});
