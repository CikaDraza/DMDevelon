// Notification fan-out for chat messages.
//
// This is the part of the chat that reaches people who are not looking at it:
// the bell in both dashboards, web push, and the batched email digest. The
// rules being pinned down here are the ones that decide whether the feature is
// useful or spam — who gets a row, what the deep link points at, and which
// deliveries are suppressed.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  asUser,
  addMember,
  connectTestDb,
  disconnectTestDb,
  groupChannelIdFor,
  makeUser,
  outbox,
  resetDb,
  seedProjectCast,
  subscribeToPush,
} from "./harness.mjs";
import Notification from "@/models/Notification";
import { PRESENCE_ONLINE_THRESHOLD_MS } from "@/lib/chat-domain.mjs";

let cast;
let admin;
let client;
let collaborator;
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
  channelId = await groupChannelIdFor(admin, cast.project._id);
  // groupChannelIdFor polls the channel list, which doubles as a presence
  // heartbeat — clear it so "recipient is online" is only true where a test
  // deliberately sets it.
  const { default: User } = await import("@/models/User");
  await User.updateMany({}, { $set: { lastActiveAt: null } });
});

const send = (actor, body) =>
  actor.post(`chat/channels/${channelId}/messages`, body);
const notificationsFor = (user) => Notification.find({ userId: user._id });

describe("group-channel fan-out", () => {
  it("a client message reaches every other participant and the operator", async () => {
    await send(client, { body: "Any update on the homepage?" });

    expect(await notificationsFor(cast.admin)).toHaveLength(1);
    expect(await notificationsFor(cast.collaborator)).toHaveLength(1);
    expect(await notificationsFor(cast.viewer)).toHaveLength(1);
    // Never yourself.
    expect(await notificationsFor(cast.client)).toHaveLength(0);
  });

  it("an admin message does not re-notify the rest of the admin team", async () => {
    const secondAdmin = await makeUser({
      name: "Second Admin",
      email: "admin2@test.local",
      isAdmin: true,
    });

    await send(admin, { body: "Deploying tonight" });

    expect(await notificationsFor(cast.client)).toHaveLength(1);
    expect(await notificationsFor(secondAdmin)).toHaveLength(0);
  });

  it("an admin who is also an invited member gets exactly one notification", async () => {
    const hybrid = await makeUser({
      name: "Hybrid Admin",
      email: "hybrid@test.local",
      isAdmin: true,
    });
    await addMember(cast.project, hybrid, "collaborator");

    await send(client, { body: "One notification please" });

    expect(await notificationsFor(hybrid)).toHaveLength(1);
  });

  it("the deep link points each recipient at their own dashboard", async () => {
    const posted = await send(client, { body: "Where does this take me?" });
    const messageId = posted.body._id;

    const [forAdmin] = await notificationsFor(cast.admin);
    const [forCollaborator] = await notificationsFor(cast.collaborator);

    expect(forAdmin.link).toBe(
      `/admin?tab=chat&channel=${channelId}&m=${messageId}`,
    );
    expect(forCollaborator.link).toBe(
      `/dashboard/chat?channel=${channelId}&m=${messageId}`,
    );
  });

  it("the deep link names the message, not just the channel", async () => {
    // Without `m=`, clicking a notification dropped the reader at the bottom
    // of the thread and left them to work out what it was about. The chat
    // consumes this to scroll to and highlight the message, paging older
    // history in if it has already scrolled out of the first page.
    await send(client, { body: "first" });
    const second = await send(client, { body: "the one being linked" });

    const [latestForAdmin] = await Notification.find({
      userId: cast.admin._id,
    }).sort({ createdAt: -1 });
    expect(latestForAdmin.link).toContain(`m=${second.body._id}`);
    expect(latestForAdmin.channelId).toBe(channelId);
  });

  it("the notification carries a truncated preview, not the whole message", async () => {
    await send(client, { body: "z".repeat(500) });

    const [forCollaborator] = await notificationsFor(cast.collaborator);

    expect(forCollaborator.body).toHaveLength(140);
    expect(forCollaborator.type).toBe("chat_message");
  });

  it("an attachment-only message still says something useful", async () => {
    await send(client, {
      attachments: [{ url: "https://x/brief.pdf", type: "pdf", name: "brief.pdf" }],
    });

    const [forCollaborator] = await notificationsFor(cast.collaborator);

    expect(forCollaborator.body).toBe("(attachment)");
  });

  it("a removed member stops receiving notifications", async () => {
    const { default: ProjectMember } = await import("@/models/ProjectMember");
    await ProjectMember.updateOne(
      { projectId: cast.project._id, userId: cast.viewer._id },
      { $set: { status: "removed" } },
    );

    await send(client, { body: "Only for current members" });

    expect(await notificationsFor(cast.viewer)).toHaveLength(0);
    expect(await notificationsFor(cast.collaborator)).toHaveLength(1);
  });
});

describe("mentions", () => {
  it("being named turns the notification into a mention", async () => {
    await send(admin, { body: "@Collab Person can you take this?" });

    const [mentioned] = await notificationsFor(cast.collaborator);
    const [bystander] = await notificationsFor(cast.client);

    expect(mentioned.type).toBe("chat_mention");
    expect(mentioned.title).toMatch(/mentioned you/i);
    expect(bystander.type).toBe("chat_message");
  });

  it("a mention emails immediately; ordinary chatter is left to the digest", async () => {
    await send(admin, { body: "@Collab Person urgent, please look" });

    const recipients = outbox().emails.map((e) => e.to);
    expect(recipients).toContain("collab@test.local");
    // The client was notified in-app but not emailed inline.
    expect(recipients).not.toContain("client@test.local");
  });

  it("an emailed mention is stamped so the digest does not resend it", async () => {
    await send(admin, { body: "@Collab Person see above" });

    const [mentioned] = await notificationsFor(cast.collaborator);
    expect(mentioned.emailedAt).toBeInstanceOf(Date);

    const [chatter] = await notificationsFor(cast.client);
    expect(chatter.emailedAt).toBeFalsy();
  });
});

describe("delivery suppression", () => {
  // Push now reaches only a user with a real subscription, and `pushedAt` is
  // stamped only on actual delivery — so a push assertion has to say who is
  // listening. Without this the collaborator is legitimately "no device", and
  // every expectation below would be measuring the wrong thing.
  beforeEach(async () => {
    await subscribeToPush(cast.collaborator);
  });

  // The send is awaited inside the request now, so there is nothing left in
  // flight by the time the call returns.
  const sendAndSettle = async (body) => {
    await send(admin, { body });
  };

  const pushesToCollaborator = () =>
    outbox().pushes.filter((p) => p.userId === cast.collaborator._id);
  const emailsToCollaborator = () =>
    outbox().emails.filter((e) => e.to === "collab@test.local");

  it("ordinary chatter never emails inline — it is left to the digest sweep", async () => {
    await sendAndSettle("Just a regular update");

    const [row] = await notificationsFor(cast.collaborator);
    expect(row.type).toBe("chat_message");
    expect(row.emailedAt).toBeFalsy();
    expect(emailsToCollaborator()).toHaveLength(0);
  });

  it("someone reading THIS conversation is not pushed for ordinary chatter", async () => {
    const { default: User } = await import("@/models/User");
    const { default: ChatRead } = await import("@/models/ChatRead");
    await User.updateOne(
      { _id: cast.collaborator._id },
      { $set: { lastActiveAt: new Date() } },
    );
    // A fresh read receipt on this channel is what "they are looking at it
    // right now" actually means.
    await ChatRead.updateOne(
      { channelId, userId: cast.collaborator._id },
      { $set: { lastReadAt: new Date() } },
      { upsert: true },
    );

    await sendAndSettle("Are you seeing this?");

    // The in-app record is always written — only the loud channels are cut.
    expect(await notificationsFor(cast.collaborator)).toHaveLength(1);
    expect(pushesToCollaborator()).toHaveLength(0);
  });

  it("someone online elsewhere still gets the push on their phone", async () => {
    // Presence is per ACCOUNT; push is per DEVICE. Having the dashboard open
    // on a laptop used to silence the phone in your pocket for a full hour —
    // the reported "I stopped getting push on my phone". The email is still
    // suppressed (the bell on the laptop covers that); the push is not.
    const { default: User } = await import("@/models/User");
    await User.updateOne(
      { _id: cast.collaborator._id },
      { $set: { lastActiveAt: new Date() } },
    );
    // Deliberately no ChatRead row: active somewhere, but not in this channel.

    await sendAndSettle("Are you seeing this on your phone?");

    expect(pushesToCollaborator()).toHaveLength(1);
    expect(emailsToCollaborator()).toHaveLength(0);
  });

  it("a stale read receipt does not count as reading it now", async () => {
    const { default: User } = await import("@/models/User");
    const { default: ChatRead } = await import("@/models/ChatRead");
    await User.updateOne(
      { _id: cast.collaborator._id },
      { $set: { lastActiveAt: new Date() } },
    );
    await ChatRead.updateOne(
      { channelId, userId: cast.collaborator._id },
      {
        $set: {
          lastReadAt: new Date(
            Date.now() - PRESENCE_ONLINE_THRESHOLD_MS - 5_000,
          ),
        },
      },
      { upsert: true },
    );

    await sendAndSettle("You read this channel a while ago");

    expect(pushesToCollaborator()).toHaveLength(1);
  });

  it("someone last seen beyond the presence window is pushed", async () => {
    const { default: User } = await import("@/models/User");
    await User.updateOne(
      { _id: cast.collaborator._id },
      {
        $set: {
          lastActiveAt: new Date(Date.now() - PRESENCE_ONLINE_THRESHOLD_MS - 5_000),
        },
      },
    );

    await sendAndSettle("Still nothing?");

    expect(pushesToCollaborator()).toHaveLength(1);
  });

  it("a mention still reaches someone who has the app open — deliberately not throttled", async () => {
    const { default: User } = await import("@/models/User");
    await User.updateOne(
      { _id: cast.collaborator._id },
      { $set: { lastActiveAt: new Date() } },
    );

    await sendAndSettle("@Collab Person this one is for you");

    expect(emailsToCollaborator()).toHaveLength(1);
    expect(pushesToCollaborator()).toHaveLength(1);
  });

  it("a burst of chatter produces a bell row per message but one push", async () => {
    for (let i = 0; i < 4; i++) await sendAndSettle(`ping ${i}`);

    expect(await notificationsFor(cast.collaborator)).toHaveLength(4);
    expect(pushesToCollaborator()).toHaveLength(1);
  });

  it("a busy channel does not silence a different conversation", async () => {
    await sendAndSettle("group chatter");
    expect(pushesToCollaborator()).toHaveLength(1);

    const dm = await admin.post("chat/dm", {
      projectId: cast.project._id,
      userId: cast.collaborator._id,
    });
    await admin.post(`chat/channels/${dm.body._id}/messages`, {
      body: "a direct question",
    });
    await new Promise((r) => setTimeout(r, 120));

    // The DM throttles on its own channel, so it still gets through.
    expect(pushesToCollaborator()).toHaveLength(2);
  });

  it("someone who turned email off is never emailed", async () => {
    const { default: User } = await import("@/models/User");
    await User.updateOne(
      { _id: cast.collaborator._id },
      { $set: { emailNotifications: false } },
    );

    await send(admin, { body: "@Collab Person opted out" });

    expect(await notificationsFor(cast.collaborator)).toHaveLength(1);
    expect(outbox().emails.map((e) => e.to)).not.toContain("collab@test.local");
  });

  it("someone who turned push off is never pushed", async () => {
    const { default: User } = await import("@/models/User");
    await User.updateOne(
      { _id: cast.collaborator._id },
      { $set: { pushNotifications: false } },
    );

    await send(admin, { body: "@Collab Person no push please" });
    await new Promise((r) => setTimeout(r, 120));

    expect(outbox().pushes.map((p) => p.userId)).not.toContain(
      cast.collaborator._id,
    );
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
  });

  it("notifies only the other participant", async () => {
    const posted = await admin.post(`chat/channels/${dmId}/messages`, {
      body: "Just you",
    });

    const [forClient] = await notificationsFor(cast.client);
    expect(forClient.title).toMatch(/direct message/i);
    expect(forClient.link).toBe(
      `/dashboard/chat?channel=${dmId}&m=${posted.body._id}`,
    );
    expect(await notificationsFor(cast.collaborator)).toHaveLength(0);
    expect(await notificationsFor(cast.admin)).toHaveLength(0);
  });

  it("a client's reply links the admin back into the admin panel", async () => {
    const posted = await client.post(`chat/channels/${dmId}/messages`, {
      body: "Replying",
    });

    const [forAdmin] = await notificationsFor(cast.admin);
    expect(forAdmin.link).toBe(
      `/admin?tab=chat&channel=${dmId}&m=${posted.body._id}`,
    );
  });

  it("scopes the notification to the DM channel, not the project at large", async () => {
    await admin.post(`chat/channels/${dmId}/messages`, { body: "Scoped" });

    const [forClient] = await notificationsFor(cast.client);
    expect(forClient.channelId).toBe(dmId);
    expect(forClient.entityId).toBe(cast.project._id);
    expect(forClient.entityType).toBe("project");
  });
});
