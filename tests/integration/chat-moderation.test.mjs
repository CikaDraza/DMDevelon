// Pinning, editing and deleting: the message-scoped endpoints behind the
// bubble's "…" menu and the pinned bar above the thread.
//
// The asymmetry between edit and delete is the point of most of this file:
// editing is author-only with no operator override, deleting is author *or*
// moderator.
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

describe("pinning", () => {
  it("the operator pins a message and it shows up in the pinned bar", async () => {
    const sent = await send(client, { body: "The agreed scope is X" });

    const pin = await admin.post(`chat/messages/${sent.body._id}/pin`, {
      pinned: true,
    });
    expect(pin.status).toBe(200);
    expect(pin.body.pinned).toBe(true);
    expect(pin.body.pinnedAt).not.toBeNull();

    const bar = await client.get(`chat/channels/${channelId}/pinned`);
    expect(bar.status).toBe(200);
    expect(bar.body.map((m) => m.body)).toEqual(["The agreed scope is X"]);
  });

  it("the client owner and a collaborator may pin too", async () => {
    const a = await send(admin, { body: "one" });
    const b = await send(admin, { body: "two" });

    expect(
      (await client.post(`chat/messages/${a.body._id}/pin`, { pinned: true }))
        .status,
    ).toBe(200);
    expect(
      (
        await collaborator.post(`chat/messages/${b.body._id}/pin`, {
          pinned: true,
        })
      ).status,
    ).toBe(200);
  });

  it("a viewer may not pin", async () => {
    const sent = await send(admin, { body: "important" });

    const res = await viewer.post(`chat/messages/${sent.body._id}/pin`, {
      pinned: true,
    });

    expect(res.status).toBe(403);
  });

  it("unpinning removes it from the bar and clears the timestamp", async () => {
    const sent = await send(admin, { body: "temporarily important" });
    await admin.post(`chat/messages/${sent.body._id}/pin`, { pinned: true });

    const unpin = await admin.post(`chat/messages/${sent.body._id}/pin`, {
      pinned: false,
    });

    expect(unpin.body.pinned).toBe(false);
    expect(unpin.body.pinnedAt).toBeNull();
    expect((await client.get(`chat/channels/${channelId}/pinned`)).body).toEqual(
      [],
    );
  });

  it("an omitted `pinned` flag means pin, not unpin", async () => {
    const sent = await send(admin, { body: "defaulting" });

    const res = await admin.post(`chat/messages/${sent.body._id}/pin`, {});

    expect(res.body.pinned).toBe(true);
  });

  it("the pinned bar is ordered most-recently-pinned first", async () => {
    const first = await send(admin, { body: "pinned first" });
    const second = await send(admin, { body: "pinned second" });

    await admin.post(`chat/messages/${first.body._id}/pin`, { pinned: true });
    await new Promise((r) => setTimeout(r, 10));
    await admin.post(`chat/messages/${second.body._id}/pin`, { pinned: true });

    const bar = await admin.get(`chat/channels/${channelId}/pinned`);
    expect(bar.body.map((m) => m.body)).toEqual([
      "pinned second",
      "pinned first",
    ]);
  });

  it("a cleared conversation hides pins from before the clear", async () => {
    const sent = await send(admin, { body: "old pin" });
    await admin.post(`chat/messages/${sent.body._id}/pin`, { pinned: true });

    await client.post(`chat/channels/${channelId}/clear`, {});

    expect((await client.get(`chat/channels/${channelId}/pinned`)).body).toEqual(
      [],
    );
    // Still pinned for everyone else.
    expect(
      (await admin.get(`chat/channels/${channelId}/pinned`)).body,
    ).toHaveLength(1);
  });
});

describe("editing", () => {
  it("the author may correct their own message", async () => {
    const sent = await send(client, { body: "Deadline is Thusday" });

    const res = await client.patch(`chat/messages/${sent.body._id}`, {
      body: "Deadline is Thursday",
    });

    expect(res.status).toBe(200);
    expect(res.body.body).toBe("Deadline is Thursday");
    expect(res.body.editedAt).not.toBeNull();
  });

  it("the operator may NOT edit someone else's words", async () => {
    const sent = await send(client, { body: "What the client actually said" });

    const res = await admin.patch(`chat/messages/${sent.body._id}`, {
      body: "What the admin would prefer they said",
    });

    expect(res.status).toBe(403);
    expect((await ChatMessage.findById(sent.body._id)).body).toBe(
      "What the client actually said",
    );
  });

  it("a collaborator may not edit the client's message", async () => {
    const sent = await send(client, { body: "client words" });

    const res = await collaborator.patch(`chat/messages/${sent.body._id}`, {
      body: "rewritten" ,
    });

    expect(res.status).toBe(403);
  });

  it("an edit to an empty body is refused", async () => {
    const sent = await send(client, { body: "something" });

    const res = await client.patch(`chat/messages/${sent.body._id}`, {
      body: "   ",
    });

    expect(res.status).toBe(400);
  });

  it("a deleted message cannot be edited back into existence", async () => {
    const sent = await send(client, { body: "gone" });
    await client.del(`chat/messages/${sent.body._id}`);

    const res = await client.patch(`chat/messages/${sent.body._id}`, {
      body: "back again",
    });

    expect(res.status).toBe(409);
  });

  it("a viewer cannot edit anything — they have no chatWrite at all", async () => {
    const sent = await send(admin, { body: "read only for you" });

    const res = await viewer.patch(`chat/messages/${sent.body._id}`, {
      body: "nope",
    });

    expect(res.status).toBe(403);
  });
});

describe("deleting", () => {
  it("the author may retract their own message", async () => {
    const sent = await send(client, { body: "sent too early" });

    const res = await client.del(`chat/messages/${sent.body._id}`);

    expect(res.status).toBe(200);
    const stored = await ChatMessage.findById(sent.body._id);
    expect(stored.deletedAt).toBeInstanceOf(Date);
    expect(stored.deletedByUserId).toBe(cast.client._id);
  });

  it("the operator may moderate anyone's message", async () => {
    const sent = await send(collaborator, { body: "inappropriate" });

    const res = await admin.del(`chat/messages/${sent.body._id}`);

    expect(res.status).toBe(200);
    expect((await ChatMessage.findById(sent.body._id)).deletedByUserId).toBe(
      cast.admin._id,
    );
  });

  it("the client owner may not delete a collaborator's message — they are not a moderator", async () => {
    const sent = await send(collaborator, { body: "collab words" });

    const res = await client.del(`chat/messages/${sent.body._id}`);

    expect(res.status).toBe(403);
    expect((await ChatMessage.findById(sent.body._id)).deletedAt).toBeNull();
  });

  it("the row survives the delete, so a converted record can still point at it", async () => {
    const sent = await send(client, { body: "the origin of a decision" });

    await admin.del(`chat/messages/${sent.body._id}`);

    expect(await ChatMessage.countDocuments({ _id: sent.body._id })).toBe(1);
  });

  it("deleting also unpins, so the bar has no dead entries", async () => {
    const sent = await send(client, { body: "pinned then deleted" });
    await admin.post(`chat/messages/${sent.body._id}/pin`, { pinned: true });

    await admin.del(`chat/messages/${sent.body._id}`);

    const stored = await ChatMessage.findById(sent.body._id);
    expect(stored.pinned).toBe(false);
    expect(stored.pinnedAt).toBeNull();
    expect((await admin.get(`chat/channels/${channelId}/pinned`)).body).toEqual(
      [],
    );
  });

  it("deleting twice is idempotent and keeps the first deleter on record", async () => {
    const sent = await send(client, { body: "double click" });

    await client.del(`chat/messages/${sent.body._id}`);
    const first = await ChatMessage.findById(sent.body._id);
    const second = await admin.del(`chat/messages/${sent.body._id}`);

    expect(second.status).toBe(200);
    const stored = await ChatMessage.findById(sent.body._id);
    expect(stored.deletedByUserId).toBe(cast.client._id);
    expect(stored.deletedAt.getTime()).toBe(first.deletedAt.getTime());
  });

  it("an anonymous caller cannot delete", async () => {
    const sent = await send(client, { body: "not yours" });
    const { callApi } = await import("./harness.mjs");

    const res = await callApi("DELETE", `chat/messages/${sent.body._id}`);

    expect(res.status).toBe(401);
  });

  it("deleting a message that does not exist is a 404", async () => {
    const res = await admin.del(
      "chat/messages/00000000-0000-0000-0000-000000000000",
    );

    expect(res.status).toBe(404);
  });
});
