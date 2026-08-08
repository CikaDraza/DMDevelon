// Sending and reading messages: POST/GET /api/chat/channels/:id/messages.
//
// The thread itself, plus the two things that quietly decide what a given
// dashboard actually renders — per-role attachment visibility and the
// per-user read/clear watermark.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  asUser,
  connectTestDb,
  disconnectTestDb,
  groupChannelIdFor,
  resetDb,
  seedProjectCast,
  callApi,
} from "./harness.mjs";
import ChatMessage from "@/models/ChatMessage";
import ChatRead from "@/models/ChatRead";

let cast;
let admin;
let client;
let collaborator;
let viewer;
let outsider;
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
  outsider = asUser(cast.outsider);
  channelId = await groupChannelIdFor(admin, cast.project._id);
});

const send = (actor, body) =>
  actor.post(`chat/channels/${channelId}/messages`, body);
const list = (actor, query) =>
  actor.get(`chat/channels/${channelId}/messages`, { query });

describe("who may post", () => {
  it("the operator posts as an admin-authored message", async () => {
    const res = await send(admin, { body: "From the admin panel" });

    expect(res.status).toBe(201);
    expect(res.body.authorRole).toBe("admin");
    expect(res.body.authorName).toBe("Operator Admin");
    expect(res.body.body).toBe("From the admin panel");
    expect(res.body.kind).toBe("user");
  });

  it("the project owner posts as a client-authored message", async () => {
    const res = await send(client, { body: "From the client dashboard" });

    expect(res.status).toBe(201);
    expect(res.body.authorRole).toBe("client");
  });

  it("an invited collaborator posts as a member", async () => {
    const res = await send(collaborator, { body: "From a collaborator" });

    expect(res.status).toBe(201);
    expect(res.body.authorRole).toBe("member");
  });

  it("a viewer is refused — read-only means read-only", async () => {
    const res = await send(viewer, { body: "Trying to speak" });

    expect(res.status).toBe(403);
    expect(await ChatMessage.countDocuments({})).toBe(0);
  });

  it("an outsider is refused without confirming the channel exists", async () => {
    const res = await send(outsider, { body: "Who am I talking to" });

    expect(res.status).toBe(404);
  });

  it("an anonymous caller is refused", async () => {
    const res = await callApi("POST", `chat/channels/${channelId}/messages`, {
      body: { body: "hello" },
    });

    expect(res.status).toBe(401);
  });

  it("a closed project refuses every write, including the owner's", async () => {
    cast.project.ownerAccountDeletedAt = new Date();
    await cast.project.save();

    expect((await send(client, { body: "Still there?" })).status).toBe(403);
    expect((await send(collaborator, { body: "Hello?" })).status).toBe(403);
    // The operator still administers the historical record.
    expect((await send(admin, { body: "Archiving." })).status).toBe(201);
  });
});

describe("payload validation", () => {
  it("an empty message with no attachment is refused", async () => {
    const res = await send(client, { body: "   " });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/body or an attachment/i);
  });

  it("an attachment with no text is a valid message", async () => {
    const res = await send(client, {
      attachments: [
        { url: "https://res.cloudinary.com/x/spec.pdf", type: "pdf", name: "spec.pdf" },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.body).toBe("");
    expect(res.body.attachments).toHaveLength(1);
    expect(res.body.attachments[0].type).toBe("pdf");
  });

  it("an unknown flag is refused", async () => {
    const res = await send(client, { body: "Tagged", flag: "urgent" });

    expect(res.status).toBe(400);
  });

  it("each known flag is accepted and round-trips", async () => {
    for (const flag of ["none", "request", "task", "idea", "problem", "incident", "decision"]) {
      const res = await send(admin, { body: `Flagged ${flag}`, flag });
      expect(res.status).toBe(201);
      expect(res.body.flag).toBe(flag);
    }
  });

  it("a body past the 10 000 character limit is refused", async () => {
    const res = await send(client, { body: "x".repeat(10_001) });

    expect(res.status).toBe(400);
  });

  it("more than ten attachments is refused", async () => {
    const res = await send(client, {
      body: "Everything at once",
      attachments: Array.from({ length: 11 }, (_, i) => ({
        url: `https://res.cloudinary.com/x/${i}.png`,
        type: "image",
      })),
    });

    expect(res.status).toBe(400);
  });
});

describe("replies", () => {
  it("a reply carries a denormalized quote of its target", async () => {
    const original = await send(admin, {
      body: "Can you confirm the deadline?",
    });

    const reply = await send(client, {
      body: "Yes, Friday works",
      replyToMessageId: original.body._id,
    });

    expect(reply.status).toBe(201);
    expect(reply.body.replyToMessageId).toBe(original.body._id);
    expect(reply.body.replyToPreview.authorName).toBe("Operator Admin");
    expect(reply.body.replyToPreview.body).toBe("Can you confirm the deadline?");
  });

  it("the quote is truncated so a wall of text cannot be smuggled into a preview", async () => {
    const original = await send(admin, { body: "y".repeat(500) });

    const reply = await send(client, {
      body: "Noted",
      replyToMessageId: original.body._id,
    });

    expect(reply.body.replyToPreview.body).toHaveLength(140);
  });

  it("a reply cannot quote a message from another channel", async () => {
    // A DM the client is not part of, holding a message they must not quote.
    const otherDm = await admin.post("chat/dm", {
      projectId: cast.project._id,
      userId: cast.collaborator._id,
    });
    const secret = await admin.post(
      `chat/channels/${otherDm.body._id}/messages`,
      { body: "Internal note" },
    );

    const res = await send(client, {
      body: "Quoting something I should not see",
      replyToMessageId: secret.body._id,
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/another channel/i);
  });

  it("replying to a message that does not exist is refused", async () => {
    const res = await send(client, {
      body: "Reply to nothing",
      replyToMessageId: "00000000-0000-0000-0000-000000000000",
    });

    expect(res.status).toBe(400);
  });
});

describe("mentions", () => {
  it("a mention resolves to the member's user id", async () => {
    const res = await send(admin, { body: "Please review @Collab Person" });

    expect(res.status).toBe(201);
    expect(res.body.mentions).toEqual([cast.collaborator._id]);
  });

  it("a name that is not on the roster is not a mention", async () => {
    const res = await send(admin, { body: "cc @Outsider Person" });

    expect(res.body.mentions).toEqual([]);
  });

  it("the operator is not a mention candidate — no roster entry to match", async () => {
    const res = await send(client, { body: "@Operator Admin can you look" });

    expect(res.body.mentions).toEqual([]);
  });

  it("an email address in the body is never read as a mention", async () => {
    const res = await send(admin, { body: "write to collab@test.local" });

    expect(res.body.mentions).toEqual([]);
  });

  it("two people addressed separately are both tagged, once each", async () => {
    const res = await send(admin, {
      body: "@Client Owner and @Viewer Person — also @Client Owner again",
    });

    expect(res.body.mentions.sort()).toEqual(
      [cast.client._id, cast.viewer._id].sort(),
    );
  });
});

describe("reading the thread", () => {
  it("returns messages oldest-first", async () => {
    for (const body of ["first", "second", "third"]) {
      await send(admin, { body });
    }

    const res = await list(client);

    expect(res.status).toBe(200);
    expect(res.body.map((m) => m.body)).toEqual(["first", "second", "third"]);
  });

  it("a viewer can read even though they cannot write", async () => {
    await send(admin, { body: "Status update" });

    const res = await list(viewer);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("an outsider gets a 404 for the thread", async () => {
    const res = await list(outsider);

    expect(res.status).toBe(404);
  });

  it("paginates backwards with the `before` cursor", async () => {
    for (let i = 1; i <= 5; i++) await send(admin, { body: `msg ${i}` });

    const newest = await list(client, { limit: 2 });
    expect(newest.body.map((m) => m.body)).toEqual(["msg 4", "msg 5"]);

    const older = await list(client, {
      limit: 2,
      before: newest.body[0].createdAt,
    });
    expect(older.body.map((m) => m.body)).toEqual(["msg 2", "msg 3"]);
  });

  it("clamps the page size to at most 100", async () => {
    await send(admin, { body: "only one" });

    const res = await list(client, { limit: 5000 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("filters by flag", async () => {
    await send(admin, { body: "plain" });
    await send(admin, { body: "a blocker", flag: "problem" });
    await send(admin, { body: "an idea", flag: "idea" });

    const res = await list(client, { flag: "problem" });

    expect(res.body.map((m) => m.body)).toEqual(["a blocker"]);
  });

  it("filters by pinned", async () => {
    const kept = await send(admin, { body: "worth keeping" });
    await send(admin, { body: "chatter" });
    await admin.post(`chat/messages/${kept.body._id}/pin`, { pinned: true });

    const res = await list(client, { flag: "pinned" });

    expect(res.body.map((m) => m.body)).toEqual(["worth keeping"]);
  });

  it("searches the body, case-insensitively and literally", async () => {
    await send(admin, { body: "The Deadline is Friday" });
    await send(admin, { body: "unrelated" });

    const hit = await list(client, { q: "deadline" });
    expect(hit.body).toHaveLength(1);

    // A regex metacharacter must be matched literally, not compiled.
    await send(admin, { body: "cost is 100$ total" });
    const literal = await list(client, { q: "100$" });
    expect(literal.body.map((m) => m.body)).toEqual(["cost is 100$ total"]);
  });

  it("ignores a one-character search rather than matching everything", async () => {
    await send(admin, { body: "alpha" });
    await send(admin, { body: "beta" });

    const res = await list(client, { q: "a" });

    expect(res.body).toHaveLength(2);
  });

  it("filters by attachment type", async () => {
    await send(admin, {
      body: "mockup",
      attachments: [{ url: "https://x/y.png", type: "image" }],
    });
    await send(admin, {
      body: "contract",
      attachments: [{ url: "https://x/y.pdf", type: "pdf" }],
    });
    await send(admin, { body: "no files" });

    const images = await list(client, { attachmentType: "image" });
    const pdfs = await list(client, { attachmentType: "pdf" });

    expect(images.body.map((m) => m.body)).toEqual(["mockup"]);
    expect(pdfs.body.map((m) => m.body)).toEqual(["contract"]);
  });
});

describe("attachment visibility per role", () => {
  beforeEach(async () => {
    await send(admin, {
      body: "Files for everyone and for some",
      attachments: [
        { url: "https://x/shared.png", type: "image", visibility: "project_shared" },
        { url: "https://x/client.pdf", type: "pdf", visibility: "client_only" },
        { url: "https://x/internal.pdf", type: "pdf", visibility: "internal_team" },
      ],
    });
  });

  const urlsFor = async (actor) => {
    const res = await list(actor);
    return res.body[0].attachments.map((a) => a.url);
  };

  it("the operator sees all three", async () => {
    expect(await urlsFor(admin)).toEqual([
      "https://x/shared.png",
      "https://x/client.pdf",
      "https://x/internal.pdf",
    ]);
  });

  it("the client owner sees the shared and client-only files, never the internal one", async () => {
    expect(await urlsFor(client)).toEqual([
      "https://x/shared.png",
      "https://x/client.pdf",
    ]);
  });

  it("a collaborator sees only what is shared with the whole project", async () => {
    expect(await urlsFor(collaborator)).toEqual(["https://x/shared.png"]);
  });

  it("the raw visibility field never leaves the API", async () => {
    const res = await list(admin);

    for (const attachment of res.body[0].attachments) {
      expect(attachment).not.toHaveProperty("visibility");
    }
  });
});

describe("read watermark", () => {
  it("marking read clears the unread badge", async () => {
    await send(admin, { body: "unread one" });
    await send(admin, { body: "unread two" });

    const before = (await client.get("chat/channels")).body[0];
    expect(before.unreadCount).toBe(2);

    const res = await client.post(`chat/channels/${channelId}/read`, {});
    expect(res.status).toBe(200);

    const after = (await client.get("chat/channels")).body[0];
    expect(after.unreadCount).toBe(0);
  });

  it("records which message the read pointer stopped at", async () => {
    const sent = await send(admin, { body: "the one they saw" });

    await client.post(`chat/channels/${channelId}/read`, {
      messageId: sent.body._id,
    });

    const read = await ChatRead.findOne({
      channelId,
      userId: cast.client._id,
    });
    expect(read.lastReadMessageId).toBe(sent.body._id);
  });

  it("sending implicitly marks the channel read for the sender", async () => {
    await send(admin, { body: "admin speaks" });
    await send(client, { body: "client answers" });

    const summary = (await client.get("chat/channels")).body[0];
    expect(summary.unreadCount).toBe(0);
  });

  it("a viewer may mark read even though they may not write", async () => {
    await send(admin, { body: "for the viewer" });

    const res = await viewer.post(`chat/channels/${channelId}/read`, {});

    expect(res.status).toBe(200);
  });
});

describe("clearing a conversation", () => {
  it("hides prior history for that person only", async () => {
    await send(admin, { body: "old news" });

    const res = await client.post(`chat/channels/${channelId}/clear`, {});
    expect(res.status).toBe(200);

    expect((await list(client)).body).toEqual([]);
    // Everyone else — and the project's history — is untouched.
    expect((await list(admin)).body.map((m) => m.body)).toEqual(["old news"]);
    expect(await ChatMessage.countDocuments({})).toBe(1);
  });

  it("messages sent after a clear are visible again", async () => {
    await send(admin, { body: "before" });
    await client.post(`chat/channels/${channelId}/clear`, {});
    await send(admin, { body: "after" });

    expect((await list(client)).body.map((m) => m.body)).toEqual(["after"]);
  });

  it("a clear also counts as having read, so nothing is instantly unread", async () => {
    await send(admin, { body: "old news" });

    await client.post(`chat/channels/${channelId}/clear`, {});

    const summary = (await client.get("chat/channels")).body[0];
    expect(summary.unreadCount).toBe(0);
    expect(summary.lastMessage).toBeNull();
  });
});

describe("a deleted message in the thread", () => {
  it("keeps its slot but redacts body and attachments for everyone", async () => {
    const sent = await send(admin, {
      body: "Sensitive text",
      attachments: [{ url: "https://x/secret.pdf", type: "pdf" }],
    });
    await admin.del(`chat/messages/${sent.body._id}`);

    for (const actor of [admin, client, collaborator, viewer]) {
      const [message] = (await list(actor)).body;
      expect(message._id).toBe(sent.body._id);
      expect(message.deleted).toBe(true);
      expect(message.body).toBe("");
      expect(message.attachments).toEqual([]);
      expect(message.authorName).toBe("Operator Admin");
    }
  });
});
