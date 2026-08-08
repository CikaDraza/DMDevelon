// GET /api/chat/channels and /api/chat/channels/:id
//
// This is the first call both dashboards make: the admin panel's Chat tab and
// /dashboard/chat both mount on it, and it is what lazily creates a project's
// group channel. Everything downstream (unread badges, the permission flags
// the UI hides buttons with, presence) is decided here.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  asUser,
  addMember,
  connectTestDb,
  disconnectTestDb,
  groupChannelIdFor,
  makeProject,
  makeUser,
  resetDb,
  seedProjectCast,
  callApi,
} from "./harness.mjs";
import ChatChannel from "@/models/ChatChannel";
import ChatMessage from "@/models/ChatMessage";
import User from "@/models/User";
import { PRESENCE_ONLINE_THRESHOLD_MS } from "@/lib/chat-domain.mjs";

let cast;

beforeAll(async () => {
  await connectTestDb();
});
afterAll(async () => {
  await disconnectTestDb();
});
beforeEach(async () => {
  await resetDb();
  cast = await seedProjectCast();
});

describe("channel list — who sees which projects", () => {
  it("rejects an anonymous caller", async () => {
    const res = await callApi("GET", "chat/channels");
    expect(res.status).toBe(401);
  });

  it("the client dashboard sees the owner's own project", async () => {
    const client = asUser(cast.client);
    const res = await client.get("chat/channels");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].projectId).toBe(cast.project._id);
    expect(res.body[0].kind).toBe("group");
  });

  it("the admin panel sees every project, including ones it is not a member of", async () => {
    const otherClient = await makeUser({ email: "other@test.local" });
    await makeProject({ owner: otherClient, title: "Someone Else's Work" });

    const res = await asUser(cast.admin).get("chat/channels");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((c) => c.name)).toEqual(
      expect.arrayContaining([
        "Redesign — Project Group",
        "Someone Else's Work — Project Group",
      ]),
    );
  });

  it("an invited collaborator sees the project through their membership", async () => {
    const res = await asUser(cast.collaborator).get("chat/channels");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].projectId).toBe(cast.project._id);
  });

  it("an outsider sees nothing at all", async () => {
    const res = await asUser(cast.outsider).get("chat/channels");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("a removed member drops back to seeing nothing", async () => {
    const gone = await makeUser({ email: "gone@test.local" });
    const membership = await addMember(cast.project, gone, "collaborator");

    expect((await asUser(gone).get("chat/channels")).body).toHaveLength(1);

    membership.status = "removed";
    await membership.save();

    expect((await asUser(gone).get("chat/channels")).body).toEqual([]);
  });

  it("a project owned by email rather than by id still resolves to its owner", async () => {
    // Older ClientProject rows carry only clientEmail; the access check is
    // supposed to fall back to it.
    const legacyClient = await makeUser({ email: "legacy@test.local" });
    await makeProject({
      owner: null,
      clientEmail: "legacy@test.local",
      title: "Legacy Engagement",
    });

    const res = await asUser(legacyClient).get("chat/channels");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("Legacy Engagement — Project Group");
  });
});

describe("lazy group-channel creation", () => {
  it("creates exactly one group channel, no matter how many people open the chat", async () => {
    expect(await ChatChannel.countDocuments({})).toBe(0);

    await asUser(cast.client).get("chat/channels");
    await asUser(cast.admin).get("chat/channels");
    await asUser(cast.collaborator).get("chat/channels");
    await asUser(cast.viewer).get("chat/channels");

    expect(
      await ChatChannel.countDocuments({
        projectId: cast.project._id,
        kind: "group",
      }),
    ).toBe(1);
  });

  it("survives four dashboards opening the same project at the same instant", async () => {
    // The unique partial index is the real guard here; the handler is only
    // required to make losing that race a normal outcome rather than a 500.
    const results = await Promise.all([
      asUser(cast.client).get("chat/channels"),
      asUser(cast.admin).get("chat/channels"),
      asUser(cast.collaborator).get("chat/channels"),
      asUser(cast.viewer).get("chat/channels"),
    ]);

    for (const res of results) expect(res.status).toBe(200);
    expect(
      await ChatChannel.countDocuments({
        projectId: cast.project._id,
        kind: "group",
      }),
    ).toBe(1);
  });
});

describe("the permission flags the UI renders from", () => {
  it("the owner may write, pin and convert to a formal record", async () => {
    const [summary] = (await asUser(cast.client).get("chat/channels")).body;

    expect(summary.canWrite).toBe(true);
    expect(summary.canPin).toBe(true);
    expect(summary.canConvertToItem).toBe(true);
    expect(summary.canConvertToFormal).toBe(true);
    expect(summary.canApproveItems).toBe(false);
  });

  it("only the operator may approve items", async () => {
    const [summary] = (await asUser(cast.admin).get("chat/channels")).body;

    expect(summary.canApproveItems).toBe(true);
    expect(summary.canConvertToFormal).toBe(true);
  });

  it("a collaborator may capture an item but not commit the project to anything", async () => {
    const [summary] = (await asUser(cast.collaborator).get("chat/channels"))
      .body;

    expect(summary.canWrite).toBe(true);
    expect(summary.canConvertToItem).toBe(true);
    expect(summary.canConvertToFormal).toBe(false);
    expect(summary.canApproveItems).toBe(false);
  });

  it("a viewer reaches the same dashboard but gets a read-only surface", async () => {
    const [summary] = (await asUser(cast.viewer).get("chat/channels")).body;

    expect(summary.canWrite).toBe(false);
    expect(summary.canPin).toBe(false);
    expect(summary.canConvertToItem).toBe(false);
  });

  it("a closed project goes read-only for the client but not for the operator", async () => {
    cast.project.ownerAccountDeletedAt = new Date();
    await cast.project.save();

    const [asClient] = (await asUser(cast.client).get("chat/channels")).body;
    const [asAdmin] = (await asUser(cast.admin).get("chat/channels")).body;

    expect(asClient.canWrite).toBe(false);
    expect(asClient.canPin).toBe(false);
    expect(asAdmin.canWrite).toBe(true);
  });
});

describe("unread counts and last-message preview", () => {
  it("a fresh channel has no unread messages and no preview", async () => {
    const [summary] = (await asUser(cast.client).get("chat/channels")).body;

    expect(summary.unreadCount).toBe(0);
    expect(summary.lastMessage).toBeNull();
  });

  it("someone else's messages count as unread; your own never do", async () => {
    const admin = asUser(cast.admin);
    const client = asUser(cast.client);
    const channelId = await groupChannelIdFor(admin, cast.project._id);

    await admin.post(`chat/channels/${channelId}/messages`, { body: "One" });
    await admin.post(`chat/channels/${channelId}/messages`, { body: "Two" });
    await client.post(`chat/channels/${channelId}/messages`, {
      body: "Client reply",
    });

    const [forClient] = (await client.get("chat/channels")).body;
    const [forAdmin] = (await admin.get("chat/channels")).body;

    // The client read the channel implicitly by posting into it.
    expect(forClient.unreadCount).toBe(0);
    // The admin has one unread: the client's reply, not their own two.
    expect(forAdmin.unreadCount).toBe(1);
    expect(forClient.lastMessage.body).toBe("Client reply");
  });

  it("a deleted message is not offered as the last-message preview", async () => {
    const admin = asUser(cast.admin);
    const channelId = await groupChannelIdFor(admin, cast.project._id);

    await admin.post(`chat/channels/${channelId}/messages`, { body: "Kept" });
    const sent = await admin.post(`chat/channels/${channelId}/messages`, {
      body: "Retracted",
    });
    await admin.del(`chat/messages/${sent.body._id}`);

    const [summary] = (await admin.get("chat/channels")).body;
    expect(summary.lastMessage.body).toBe("Kept");
  });
});

describe("presence heartbeat", () => {
  it("listing channels marks the caller as recently active", async () => {
    expect((await User.findById(cast.client._id)).lastActiveAt).toBeNull();

    await asUser(cast.client).get("chat/channels");
    // The touch is deliberately fire-and-forget, so give it a moment to land.
    await new Promise((r) => setTimeout(r, 150));

    const refreshed = await User.findById(cast.client._id);
    expect(refreshed.lastActiveAt).toBeInstanceOf(Date);
    expect(Date.now() - refreshed.lastActiveAt.getTime()).toBeLessThan(
      PRESENCE_ONLINE_THRESHOLD_MS,
    );
  });
});

describe("channel detail and roster", () => {
  it("lists the owner and every active member, business-labeled", async () => {
    const admin = asUser(cast.admin);
    const channelId = await groupChannelIdFor(admin, cast.project._id);

    const res = await admin.get(`chat/channels/${channelId}`);

    expect(res.status).toBe(200);
    const roles = res.body.members.map((m) => m.role).sort();
    expect(roles).toEqual(["collaborator", "owner", "viewer"]);
    // The operator is not offered as a mention candidate.
    expect(res.body.members.map((m) => m.userId)).not.toContain(cast.admin._id);
  });

  it("drops a member as soon as their membership is suspended", async () => {
    const admin = asUser(cast.admin);
    const channelId = await groupChannelIdFor(admin, cast.project._id);
    const { default: ProjectMember } = await import("@/models/ProjectMember");
    await ProjectMember.updateOne(
      { projectId: cast.project._id, userId: cast.viewer._id },
      { $set: { status: "suspended" } },
    );

    const res = await admin.get(`chat/channels/${channelId}`);

    expect(res.body.members.map((m) => m.userId)).not.toContain(
      cast.viewer._id,
    );
  });

  it("an outsider is told the channel does not exist, not that it is forbidden", async () => {
    const channelId = await groupChannelIdFor(
      asUser(cast.admin),
      cast.project._id,
    );

    const res = await asUser(cast.outsider).get(`chat/channels/${channelId}`);

    expect(res.status).toBe(404);
  });

  it("a channel id that does not exist is a 404, not a crash", async () => {
    const res = await asUser(cast.admin).get(
      "chat/channels/00000000-0000-0000-0000-000000000000",
    );
    expect(res.status).toBe(404);
  });

  it("a channel whose project has been hard-removed is a 404", async () => {
    const channelId = await groupChannelIdFor(
      asUser(cast.admin),
      cast.project._id,
    );
    const orphan = await ChatChannel.create({
      _id: "orphan-channel",
      projectId: "no-such-project",
      kind: "group",
      name: "Orphan",
    });

    const res = await asUser(cast.admin).get(`chat/channels/${orphan._id}`);

    expect(res.status).toBe(404);
    expect(channelId).toBeTruthy();
  });
});

describe("system messages from invitation acceptance", () => {
  it("accepting an invitation posts a join notice into the group channel", async () => {
    const { default: ProjectInvitation } = await import(
      "@/models/ProjectInvitation"
    );
    const { generateInviteToken, hashInviteToken } = await import(
      "@/lib/chat-domain.mjs"
    );

    const newcomer = await makeUser({
      name: "Newcomer Person",
      email: "newcomer@test.local",
    });
    const rawToken = generateInviteToken();
    await ProjectInvitation.create({
      _id: "invite-1",
      projectId: cast.project._id,
      emailNormalized: "newcomer@test.local",
      tokenHash: hashInviteToken(rawToken),
      intendedRole: "collaborator",
      status: "pending",
      invitedByUserId: cast.admin._id,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    });

    const res = await asUser(newcomer).post("invitations/accept", {
      token: rawToken,
    });

    expect(res.status).toBeLessThan(300);

    const system = await ChatMessage.findOne({
      projectId: cast.project._id,
      kind: "system",
    });
    expect(system).not.toBeNull();
    expect(system.body).toContain("Newcomer Person");
    expect(system.authorRole).toBe("admin");
    expect(system.authorUserId).toBeNull();

    // And the newcomer can now see the project's channel.
    expect((await asUser(newcomer).get("chat/channels")).body).toHaveLength(1);
  });
});
