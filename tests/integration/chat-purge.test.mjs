// POST /api/chat/channels/:id/purge — the hard delete.
//
// The whole point of this file is the distinction between the chat's three
// "delete" verbs, which are easy to conflate and behave nothing alike:
//
//   /clear             per-viewer watermark, rows untouched
//   DELETE /messages/  soft delete, row survives with its body redacted
//   /purge             deleteMany, gone for everyone
//
// So most assertions here read the collection directly rather than trusting an
// API projection — a soft delete and a purge look identical through the GET.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  asUser,
  connectTestDb,
  disconnectTestDb,
  groupChannelIdFor,
  resetDb,
  seedProjectCast,
} from "./harness.mjs";
import ChatMessage from "@/models/ChatMessage";
import Notification from "@/models/Notification";
import ProjectAuditLog from "@/models/ProjectAuditLog";

const DAY_MS = 24 * 60 * 60 * 1000;

let cast;
let admin;
let client;
let collaborator;
let viewer;
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
  collaborator = asUser(cast.collaborator);
  viewer = asUser(cast.viewer);
  channelId = await groupChannelIdFor(admin, cast.project._id);
});

const send = (actor, body) =>
  actor.post(`chat/channels/${channelId}/messages`, body);

const purge = (actor, payload, id = channelId) =>
  actor.post(`chat/channels/${id}/purge`, payload);

/**
 * Backdate a message so a window purge has something old to find.
 *
 * Goes through the raw collection on purpose: a `timestamps: true` schema marks
 * `createdAt` immutable, and mongoose SILENTLY drops it from a `$set` rather
 * than erroring — the update reports one document modified and the date is
 * unchanged, which reads as "the purge query is broken".
 */
const backdate = (messageId, daysAgo) =>
  ChatMessage.collection.updateOne(
    { _id: messageId },
    { $set: { createdAt: new Date(Date.now() - daysAgo * DAY_MS) } },
  );

// Everything the purge left behind, minus the system notice it posts itself.
const remainingUserMessages = () =>
  ChatMessage.find({ channelId, kind: "user" }).sort({ createdAt: 1 });

describe("purging every message", () => {
  it("the operator empties the channel and the rows are actually gone", async () => {
    const first = await send(client, { body: "first" });
    await send(admin, { body: "second" });

    const res = await purge(admin, { scope: "all" });

    expect(res.status).toBe(200);
    expect(res.body.deletedCount).toBe(2);
    expect(await remainingUserMessages()).toHaveLength(0);
    // Not a soft delete: the row does not survive with a redacted body.
    expect(await ChatMessage.findById(first.body._id)).toBeNull();
  });

  it("a purge is not the same as a clear — it empties the channel for everyone", async () => {
    await send(client, { body: "shared history" });

    await purge(admin, { scope: "all" });

    for (const actor of [admin, client, collaborator, viewer]) {
      const thread = await actor.get(`chat/channels/${channelId}/messages`);
      expect(thread.body.filter((m) => m.kind === "user")).toEqual([]);
    }
  });

  it("leaves a system message saying what happened, so an empty channel is not a mystery", async () => {
    await send(client, { body: "one" });
    await send(client, { body: "two" });

    await purge(admin, { scope: "all" });

    const thread = await client.get(`chat/channels/${channelId}/messages`);
    expect(thread.body).toHaveLength(1);
    expect(thread.body[0].kind).toBe("system");
    expect(thread.body[0].body).toContain("2 messages");
  });

  it("posts no system notice when there was nothing to delete", async () => {
    const res = await purge(admin, { scope: "all" });

    expect(res.body.deletedCount).toBe(0);
    expect(await ChatMessage.countDocuments({ channelId })).toBe(0);
  });

  it("clears the pinned bar with the messages it pointed at", async () => {
    const sent = await send(client, { body: "the agreed scope" });
    await admin.post(`chat/messages/${sent.body._id}/pin`, { pinned: true });

    await purge(admin, { scope: "all" });

    expect((await admin.get(`chat/channels/${channelId}/pinned`)).body).toEqual(
      [],
    );
  });

  it("scope defaults to all when the body says nothing", async () => {
    await send(client, { body: "implicit" });

    const res = await purge(admin, {});

    expect(res.body.scope).toBe("all");
    expect(res.body.deletedCount).toBe(1);
  });

  it("touches only the channel it was asked about", async () => {
    await send(client, { body: "group message" });
    const dm = await admin.post("chat/dm", {
      projectId: cast.project._id,
      userId: cast.client._id,
    });
    await admin.post(`chat/channels/${dm.body._id}/messages`, {
      body: "dm message",
    });

    await purge(admin, { scope: "all" }, dm.body._id);

    expect(await remainingUserMessages()).toHaveLength(1);
    expect(
      await ChatMessage.countDocuments({
        channelId: dm.body._id,
        kind: "user",
      }),
    ).toBe(0);
  });
});

describe("purging messages older than a window", () => {
  it("keeps the last 30 days and deletes what came before", async () => {
    const old = await send(client, { body: "from last quarter" });
    const edge = await send(client, { body: "five weeks ago" });
    await send(client, { body: "this week" });
    await backdate(old.body._id, 90);
    await backdate(edge.body._id, 35);

    const res = await purge(admin, { scope: "older_than", days: 30 });

    expect(res.body.deletedCount).toBe(2);
    const left = await remainingUserMessages();
    expect(left.map((m) => m.body)).toEqual(["this week"]);
  });

  it("defaults to a 30-day window when no day count is given", async () => {
    const old = await send(client, { body: "ancient" });
    await send(client, { body: "recent" });
    await backdate(old.body._id, 31);

    const res = await purge(admin, { scope: "older_than" });

    expect(res.body.days).toBe(30);
    expect(res.body.deletedCount).toBe(1);
  });

  it("an explicit day count narrows the window", async () => {
    const a = await send(client, { body: "ten days ago" });
    await send(client, { body: "today" });
    await backdate(a.body._id, 10);

    const res = await purge(admin, { scope: "older_than", days: 7 });

    expect(res.body.deletedCount).toBe(1);
    expect((await remainingUserMessages()).map((m) => m.body)).toEqual([
      "today",
    ]);
  });

  it("rejects a nonsensical window instead of guessing one", async () => {
    await send(client, { body: "keep me" });

    expect((await purge(admin, { scope: "older_than", days: 0 })).status).toBe(
      400,
    );
    expect(
      (await purge(admin, { scope: "older_than", days: -5 })).status,
    ).toBe(400);
    expect((await purge(admin, { scope: "sometimes" })).status).toBe(400);
    expect(await remainingUserMessages()).toHaveLength(1);
  });
});

describe("who may purge", () => {
  it("the project owner may not — clearing their own view is as far as it goes", async () => {
    await send(client, { body: "the client's own project history" });

    const res = await purge(client, { scope: "all" });

    expect(res.status).toBe(403);
    expect(await remainingUserMessages()).toHaveLength(1);
  });

  it("a collaborator and a viewer may not either", async () => {
    await send(client, { body: "history" });

    expect((await purge(collaborator, { scope: "all" })).status).toBe(403);
    expect((await purge(viewer, { scope: "all" })).status).toBe(403);
    expect(await remainingUserMessages()).toHaveLength(1);
  });

  it("an outsider is told the channel does not exist, not that it is forbidden", async () => {
    const outsider = asUser(cast.outsider);

    const res = await purge(outsider, { scope: "all" });

    expect(res.status).toBe(404);
  });

  it("an anonymous caller is rejected", async () => {
    const { callApi } = await import("./harness.mjs");

    const res = await callApi("POST", `chat/channels/${channelId}/purge`, {
      body: { scope: "all" },
    });

    expect(res.status).toBe(401);
  });
});

describe("direct messages", () => {
  let dmId;

  beforeEach(async () => {
    const dm = await admin.post("chat/dm", {
      projectId: cast.project._id,
      userId: cast.client._id,
    });
    dmId = dm.body._id;
    await admin.post(`chat/channels/${dmId}/messages`, { body: "hello" });
    await client.post(`chat/channels/${dmId}/messages`, { body: "hi back" });
  });

  it("the operator may purge a DM they are part of", async () => {
    const res = await purge(admin, { scope: "all" }, dmId);

    expect(res.status).toBe(200);
    expect(res.body.deletedCount).toBe(2);
  });

  it("the other participant may not purge it out from under the operator", async () => {
    const res = await purge(client, { scope: "all" }, dmId);

    expect(res.status).toBe(403);
    expect(
      await ChatMessage.countDocuments({ channelId: dmId, kind: "user" }),
    ).toBe(2);
  });

  it("a fellow project member outside the DM cannot reach it at all", async () => {
    const res = await purge(collaborator, { scope: "all" }, dmId);

    expect(res.status).toBe(404);
    expect(
      await ChatMessage.countDocuments({ channelId: dmId, kind: "user" }),
    ).toBe(2);
  });
});

describe("what a purge takes with it", () => {
  it("deletes the chat notifications that quoted the purged messages", async () => {
    await send(client, { body: "something worth notifying about" });
    expect(
      await Notification.countDocuments({ channelId, type: "chat_message" }),
    ).toBeGreaterThan(0);

    await purge(admin, { scope: "all" });

    // Otherwise the bell keeps showing a 140-character copy of a message that
    // no longer exists anywhere else.
    expect(await Notification.countDocuments({ channelId })).toBe(0);
  });

  it("leaves another channel's notifications alone", async () => {
    const dm = await admin.post("chat/dm", {
      projectId: cast.project._id,
      userId: cast.client._id,
    });
    await admin.post(`chat/channels/${dm.body._id}/messages`, { body: "dm" });
    await send(client, { body: "group" });

    await purge(admin, { scope: "all" });

    expect(
      await Notification.countDocuments({ channelId: dm.body._id }),
    ).toBeGreaterThan(0);
  });

  it("reports how many converted messages it orphaned", async () => {
    const sent = await send(client, {
      body: "We should switch to weekly billing",
      flag: "decision",
    });
    await admin.post(`chat/messages/${sent.body._id}/convert`, {
      target: "item",
      kind: "decision",
      title: "Weekly billing",
    });
    await send(client, { body: "plain chatter" });

    const res = await purge(admin, { scope: "all" });

    expect(res.body.deletedCount).toBe(2);
    expect(res.body.convertedCount).toBe(1);
  });

  it("writes an audit row — after a purge it is the only record left", async () => {
    await send(client, { body: "gone" });

    await purge(admin, { scope: "older_than", days: 1 });
    await purge(admin, { scope: "all" });

    const rows = await ProjectAuditLog.find({
      projectId: cast.project._id,
      eventType: "chat.purged",
    }).sort({ createdAt: 1 });
    expect(rows).toHaveLength(2);
    expect(rows[0].metadata.scope).toBe("older_than");
    expect(rows[0].metadata.days).toBe(1);
    expect(rows[1].metadata.scope).toBe("all");
    expect(rows[1].metadata.deletedCount).toBe(1);
    expect(rows[1].actorUserId).toBe(cast.admin._id);
    expect(rows[1].metadata.channelId).toBe(channelId);
  });
});

describe("the channel afterwards", () => {
  it("still accepts new messages and pages them normally", async () => {
    await send(client, { body: "old life" });
    await purge(admin, { scope: "all" });

    const sent = await send(client, { body: "new life" });

    expect(sent.status).toBe(201);
    const thread = await client.get(`chat/channels/${channelId}/messages`);
    expect(thread.body.map((m) => m.body)).toContain("new life");
  });

  it("does not resurrect a purged message as unread", async () => {
    await send(client, { body: "will be purged" });
    await purge(admin, { scope: "all" });

    const channels = await client.get("chat/channels");
    const channel = channels.body.find((c) => c._id === channelId);
    // Only the system notice about the purge itself is new to the client.
    expect(channel.unreadCount).toBe(1);
    expect(channel.lastMessage.kind).toBe("system");
  });
});
