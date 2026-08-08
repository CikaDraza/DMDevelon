// Direct messages: POST /api/chat/dm plus the privacy rules that make a DM
// different from the group channel.
//
// The rule under test throughout: a fellow project member who is not part of
// THIS conversation is told it does not exist — never that it exists but is
// forbidden.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  asUser,
  addMember,
  connectTestDb,
  disconnectTestDb,
  makeUser,
  resetDb,
  seedProjectCast,
} from "./harness.mjs";
import ChatChannel from "@/models/ChatChannel";

let cast;
let admin;
let client;
let collaborator;
let viewer;
let outsider;

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
  outsider = asUser(cast.outsider);
});

const openDm = (actor, targetUser) =>
  actor.post("chat/dm", {
    projectId: cast.project._id,
    userId: targetUser._id,
  });

describe("opening a direct message", () => {
  it("the admin opens a DM with the client", async () => {
    const res = await openDm(admin, cast.client);

    expect(res.status).toBe(200);
    expect(res.body.kind).toBe("dm");
    expect(res.body.memberUserIds.sort()).toEqual(
      [cast.admin._id, cast.client._id].sort(),
    );
  });

  it("is the same conversation whichever side opens it", async () => {
    const fromAdmin = await openDm(admin, cast.client);
    const fromClient = await openDm(client, cast.admin);

    expect(fromClient.body._id).toBe(fromAdmin.body._id);
    expect(await ChatChannel.countDocuments({ kind: "dm" })).toBe(1);
  });

  it("opening it twice does not create a second channel", async () => {
    await openDm(admin, cast.collaborator);
    await openDm(admin, cast.collaborator);

    expect(await ChatChannel.countDocuments({ kind: "dm" })).toBe(1);
  });

  it("two simultaneous opens still settle on one channel", async () => {
    // Both sides clicking "message" at the same moment — the unique index on
    // (projectId, dmKey) is what actually decides this.
    const [a, b] = await Promise.all([
      openDm(admin, cast.client),
      openDm(client, cast.admin),
    ]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body._id).toBe(b.body._id);
    expect(await ChatChannel.countDocuments({ kind: "dm" })).toBe(1);
  });

  it("refuses a target with no relationship to the project", async () => {
    const res = await openDm(admin, cast.outsider);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not part of this project/i);
  });

  it("refuses a target that is not a real account", async () => {
    const res = await admin.post("chat/dm", {
      projectId: cast.project._id,
      userId: "00000000-0000-0000-0000-000000000000",
    });

    expect(res.status).toBe(404);
  });

  it("refuses opening a DM with yourself", async () => {
    const res = await openDm(admin, cast.admin);

    expect(res.status).toBe(400);
  });

  it("requires both a projectId and a userId", async () => {
    expect((await admin.post("chat/dm", { projectId: cast.project._id })).status).toBe(400);
    expect((await admin.post("chat/dm", { userId: cast.client._id })).status).toBe(400);
  });

  it("a viewer cannot start a DM — no chatWrite", async () => {
    const res = await openDm(viewer, cast.admin);

    expect(res.status).toBe(403);
  });

  it("an outsider cannot start a DM into a project they have no claim to", async () => {
    const res = await openDm(outsider, cast.client);

    expect(res.status).toBe(404);
  });

  it("a member of another project cannot reach into this one", async () => {
    const otherClient = await makeUser({ email: "other-owner@test.local" });
    const otherProject = await (
      await import("./harness.mjs")
    ).makeProject({ owner: otherClient, title: "Different Engagement" });
    await addMember(otherProject, cast.outsider, "collaborator");

    const res = await openDm(outsider, cast.client);

    expect(res.status).toBe(404);
  });
});

describe("direct-message privacy", () => {
  let dmId;

  beforeEach(async () => {
    const res = await openDm(admin, cast.client);
    dmId = res.body._id;
    await admin.post(`chat/channels/${dmId}/messages`, {
      body: "Just between us",
    });
  });

  it("both participants see it in their channel list", async () => {
    const adminKinds = (await admin.get("chat/channels")).body.map((c) => c.kind);
    const clientKinds = (await client.get("chat/channels")).body.map((c) => c.kind);

    expect(adminKinds).toContain("dm");
    expect(clientKinds).toContain("dm");
  });

  it("a fellow project member does not see it at all", async () => {
    const channels = (await collaborator.get("chat/channels")).body;

    expect(channels.map((c) => c.kind)).toEqual(["group"]);
  });

  it("a fellow project member is told the channel does not exist", async () => {
    expect((await collaborator.get(`chat/channels/${dmId}`)).status).toBe(404);
    expect(
      (await collaborator.get(`chat/channels/${dmId}/messages`)).status,
    ).toBe(404);
    expect((await collaborator.get(`chat/channels/${dmId}/pinned`)).status).toBe(
      404,
    );
  });

  it("a fellow project member cannot post into it", async () => {
    const res = await collaborator.post(`chat/channels/${dmId}/messages`, {
      body: "Butting in",
    });

    expect(res.status).toBe(404);
  });

  it("a fellow project member cannot moderate a message inside it", async () => {
    const [message] = (await admin.get(`chat/channels/${dmId}/messages`)).body;

    expect((await collaborator.del(`chat/messages/${message._id}`)).status).toBe(
      404,
    );
    expect(
      (await collaborator.post(`chat/messages/${message._id}/pin`, { pinned: true }))
        .status,
    ).toBe(404);
  });

  it("participants can read and reply normally", async () => {
    const res = await client.post(`chat/channels/${dmId}/messages`, {
      body: "Understood",
    });

    expect(res.status).toBe(201);
    expect((await client.get(`chat/channels/${dmId}/messages`)).body).toHaveLength(
      2,
    );
  });

  it("losing access to the project also hides the DM", async () => {
    const guest = await makeUser({ name: "Guest", email: "guest@test.local" });
    const membership = await addMember(cast.project, guest, "collaborator");
    const dm = await openDm(admin, guest);
    expect(
      (await asUser(guest).get("chat/channels")).body.some(
        (c) => c._id === dm.body._id,
      ),
    ).toBe(true);

    membership.status = "removed";
    await membership.save();

    const channels = (await asUser(guest).get("chat/channels")).body;
    expect(channels).toEqual([]);
    expect((await asUser(guest).get(`chat/channels/${dm.body._id}`)).status).toBe(
      404,
    );
  });
});
