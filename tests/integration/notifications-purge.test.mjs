// POST /api/notifications/purge — emptying the bell.
//
// Two things carry the whole feature and neither is visible from the endpoint's
// signature: it can only ever reach the CALLER's own rows (there is no
// parameter for whose bell to empty), and it is offered to the operator alone,
// which is a product decision rather than a security one — so the "who" tests
// here are what would catch that gate being widened by accident.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { v4 as uuidv4 } from "uuid";
import {
  asUser,
  callApi,
  connectTestDb,
  disconnectTestDb,
  groupChannelIdFor,
  resetDb,
  seedProjectCast,
} from "./harness.mjs";
import Notification from "@/models/Notification";

const DAY_MS = 24 * 60 * 60 * 1000;

let cast;
let admin;
let client;
let channelId;

beforeAll(async () => {
  await connectTestDb();
});
afterAll(async () => {
  await disconnectTestDb();
});
beforeEach(async () => {
  await resetDb();
  cast = await seedProjectCast();
  admin = asUser(cast.admin);
  client = asUser(cast.client);
  channelId = await groupChannelIdFor(admin, cast.project._id);
});

const purge = (actor, payload) => actor.post("notifications/purge", payload);

const countFor = (user) => Notification.countDocuments({ userId: user._id });

/**
 * A bell row for `user`, optionally backdated.
 *
 * Written straight to the collection rather than triggered through a chat
 * message: `createdAt` is a mongoose timestamp and therefore immutable on
 * update, so the only way to get an OLD notification is to insert it as one.
 */
const giveNotification = (user, { daysAgo = 0, read = false, ...rest } = {}) =>
  Notification.collection.insertOne({
    _id: uuidv4(),
    userId: user._id,
    type: "chat_message",
    title: "Something happened",
    body: "preview text",
    link: "",
    entityType: "",
    entityId: "",
    milestoneId: "",
    proposalId: "",
    channelId: "",
    dedupeKey: null,
    read,
    emailedAt: null,
    pushedAt: null,
    createdAt: new Date(Date.now() - daysAgo * DAY_MS),
    updatedAt: new Date(),
  });

describe("deleting every notification", () => {
  it("empties the operator's bell", async () => {
    await giveNotification(cast.admin);
    await giveNotification(cast.admin, { read: true });

    const res = await purge(admin, { scope: "all" });

    expect(res.status).toBe(200);
    expect(res.body.deletedCount).toBe(2);
    expect(await countFor(cast.admin)).toBe(0);
  });

  it("takes read and unread alike", async () => {
    await giveNotification(cast.admin, { read: false });
    await giveNotification(cast.admin, { read: true });

    await purge(admin, { scope: "all" });

    const bell = await admin.get("notifications");
    expect(bell.body.items).toEqual([]);
    expect(bell.body.unreadCount).toBe(0);
  });

  it("scope defaults to all", async () => {
    await giveNotification(cast.admin);

    const res = await purge(admin, {});

    expect(res.body.scope).toBe("all");
    expect(res.body.deletedCount).toBe(1);
  });

  it("reports zero rather than failing on an already empty bell", async () => {
    const res = await purge(admin, { scope: "all" });

    expect(res.status).toBe(200);
    expect(res.body.deletedCount).toBe(0);
  });
});

describe("deleting notifications older than a window", () => {
  it("keeps the last 30 days", async () => {
    await giveNotification(cast.admin, { daysAgo: 90 });
    await giveNotification(cast.admin, { daysAgo: 31 });
    await giveNotification(cast.admin, { daysAgo: 2 });

    const res = await purge(admin, { scope: "older_than", days: 30 });

    expect(res.body.deletedCount).toBe(2);
    expect(await countFor(cast.admin)).toBe(1);
  });

  it("defaults to 30 days when no count is given", async () => {
    await giveNotification(cast.admin, { daysAgo: 45 });
    await giveNotification(cast.admin, { daysAgo: 1 });

    const res = await purge(admin, { scope: "older_than" });

    expect(res.body.days).toBe(30);
    expect(res.body.deletedCount).toBe(1);
  });

  it("an explicit day count narrows the window", async () => {
    await giveNotification(cast.admin, { daysAgo: 10 });
    await giveNotification(cast.admin, { daysAgo: 1 });

    const res = await purge(admin, { scope: "older_than", days: 7 });

    expect(res.body.deletedCount).toBe(1);
  });

  it("rejects a nonsensical window instead of guessing one", async () => {
    await giveNotification(cast.admin, { daysAgo: 400 });

    expect((await purge(admin, { scope: "older_than", days: 0 })).status).toBe(
      400,
    );
    expect(
      (await purge(admin, { scope: "older_than", days: 1.5 })).status,
    ).toBe(400);
    expect((await purge(admin, { scope: "eventually" })).status).toBe(400);
    expect(await countFor(cast.admin)).toBe(1);
  });
});

describe("whose notifications a purge can reach", () => {
  it("never touches another account's bell", async () => {
    await giveNotification(cast.admin);
    await giveNotification(cast.client);
    await giveNotification(cast.collaborator, { daysAgo: 90 });

    await purge(admin, { scope: "all" });

    expect(await countFor(cast.admin)).toBe(0);
    expect(await countFor(cast.client)).toBe(1);
    expect(await countFor(cast.collaborator)).toBe(1);
  });

  it("a client may not clear their bell in bulk — the control is operator-only", async () => {
    await giveNotification(cast.client);

    const res = await purge(client, { scope: "all" });

    expect(res.status).toBe(403);
    expect(await countFor(cast.client)).toBe(1);
  });

  it("an anonymous caller is rejected", async () => {
    const res = await callApi("POST", "notifications/purge", {
      body: { scope: "all" },
    });

    expect(res.status).toBe(401);
  });
});

describe("the bell afterwards", () => {
  it("still records new notifications", async () => {
    await giveNotification(cast.admin, { daysAgo: 90 });
    await purge(admin, { scope: "all" });

    await client.post(`chat/channels/${channelId}/messages`, {
      body: "fresh traffic",
    });

    const bell = await admin.get("notifications");
    expect(bell.body.items).toHaveLength(1);
    expect(bell.body.unreadCount).toBe(1);
  });

  it("leaves the chat messages themselves alone — this empties a bell, not a channel", async () => {
    await client.post(`chat/channels/${channelId}/messages`, {
      body: "still here",
    });

    await purge(admin, { scope: "all" });

    const thread = await admin.get(`chat/channels/${channelId}/messages`);
    expect(thread.body.map((m) => m.body)).toContain("still here");
  });
});
