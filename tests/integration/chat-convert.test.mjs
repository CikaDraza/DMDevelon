// "Convert to…" — the point where a conversation stops being chat and becomes
// a record the project is actually held to.
//
// Two permission tiers are the substance of this file: capturing an *item*
// (idea/problem/incident/decision) is open to collaborators, because that is
// what letting the team log things as they happen means; creating a request,
// a task or a milestone comment changes the project's commitments and stays
// with the client owner and the operator. Deciding on an item afterwards is
// operator-only.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  asUser,
  connectTestDb,
  disconnectTestDb,
  groupChannelIdFor,
  resetDb,
  seedProjectCast,
} from "./harness.mjs";
import ProjectItem from "@/models/ProjectItem";
import ProjectRequest from "@/models/ProjectRequest";
import ProjectMessage from "@/models/ProjectMessage";
import ClientProject from "@/models/ClientProject";

let cast;
let admin;
let client;
let collaborator;
let viewer;
let channelId;
let milestoneId;

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

  milestoneId = "milestone-1";
  cast.project.milestones.push({
    _id: milestoneId,
    title: "Phase One",
    order: 0,
    status: "in_progress",
    tasks: [],
  });
  await cast.project.save();
});

const send = (actor, body) =>
  actor.post(`chat/channels/${channelId}/messages`, body);
const convert = (actor, messageId, payload) =>
  actor.post(`chat/messages/${messageId}/convert`, payload);

describe("converting a message into an item", () => {
  it("a collaborator can capture a problem they just described", async () => {
    const sent = await send(collaborator, {
      body: "The checkout page 500s on Safari",
      flag: "problem",
    });

    const res = await convert(collaborator, sent.body._id, {
      target: "item",
      kind: "problem",
      title: "Checkout fails on Safari",
      severity: "high",
    });

    expect(res.status).toBe(201);
    expect(res.body.target).toBe("item");
    expect(res.body.created.kind).toBe("problem");
    expect(res.body.created.ref).toBe("P-001");
    expect(res.body.created.severity).toBe("high");
    expect(res.body.created.status).toBe("open");
    // The body defaults to the message's own text — converting without
    // retyping anything still produces a meaningful record.
    expect(res.body.created.body).toBe("The checkout page 500s on Safari");
  });

  it("the record links back to the conversation it came from", async () => {
    const sent = await send(client, { body: "Let us go with option B" });

    const res = await convert(admin, sent.body._id, {
      target: "item",
      kind: "decision",
      title: "Option B",
    });

    expect(res.body.created.sourceMessageId).toBe(sent.body._id);
    expect(res.body.created.sourceChannelId).toBe(channelId);
    // …and the message carries the forward link.
    expect(res.body.message.convertedTo).toHaveLength(1);
    expect(res.body.message.convertedTo[0]).toMatchObject({
      target: "item",
      targetId: res.body.created._id,
      ref: "D-001",
    });
  });

  it("converting a decision co-signs it — an accepted record never has nobody's name on it", async () => {
    const sent = await send(client, { body: "Agreed: launch on the 14th" });

    const res = await convert(admin, sent.body._id, {
      target: "item",
      kind: "decision",
      title: "Launch date",
    });

    expect(res.body.created.confirmedBy).toHaveLength(1);
    expect(res.body.created.confirmedBy[0].userId).toBe(cast.admin._id);
    expect(res.body.created.decidedAt).not.toBeNull();
  });

  it("an idea is captured without being treated as decided", async () => {
    const sent = await send(collaborator, { body: "What about dark mode?" });

    const res = await convert(collaborator, sent.body._id, {
      target: "item",
      kind: "idea",
      title: "Dark mode",
    });

    expect(res.body.created.ref).toBe("ID-001");
    expect(res.body.created.confirmedBy).toEqual([]);
    expect(res.body.created.decidedAt).toBeNull();
  });

  it("references increment per kind, independently of each other", async () => {
    const a = await send(admin, { body: "one" });
    const b = await send(admin, { body: "two" });
    const c = await send(admin, { body: "three" });

    const first = await convert(admin, a.body._id, {
      target: "item",
      kind: "incident",
      title: "First incident",
    });
    const second = await convert(admin, b.body._id, {
      target: "item",
      kind: "incident",
      title: "Second incident",
    });
    const other = await convert(admin, c.body._id, {
      target: "item",
      kind: "decision",
      title: "A decision",
    });

    expect(first.body.created.ref).toBe("I-001");
    expect(second.body.created.ref).toBe("I-002");
    expect(other.body.created.ref).toBe("D-001");
  });

  it("an explicit body overrides the source message text", async () => {
    const sent = await send(admin, { body: "rambling original" });

    const res = await convert(admin, sent.body._id, {
      target: "item",
      kind: "idea",
      title: "Tidied up",
      body: "The clean version",
    });

    expect(res.body.created.body).toBe("The clean version");
  });

  it("an unknown item kind is refused", async () => {
    const sent = await send(admin, { body: "something" });

    const res = await convert(admin, sent.body._id, {
      target: "item",
      kind: "epic",
      title: "Nope",
    });

    expect(res.status).toBe(400);
  });

  it("an item needs a title", async () => {
    const sent = await send(admin, { body: "something" });

    const res = await convert(admin, sent.body._id, {
      target: "item",
      kind: "idea",
      title: "   ",
    });

    expect(res.status).toBe(400);
  });

  it("an invalid severity quietly falls back to low rather than failing the capture", async () => {
    const sent = await send(admin, { body: "something" });

    const res = await convert(admin, sent.body._id, {
      target: "item",
      kind: "incident",
      title: "Odd severity",
      severity: "apocalyptic",
    });

    expect(res.status).toBe(201);
    expect(res.body.created.severity).toBe("low");
  });

  it("a viewer cannot convert anything", async () => {
    const sent = await send(admin, { body: "something" });

    const res = await convert(viewer, sent.body._id, {
      target: "item",
      kind: "idea",
      title: "Not for you",
    });

    expect(res.status).toBe(403);
  });

  it("a deleted message cannot be converted", async () => {
    const sent = await send(client, { body: "retracted" });
    await client.del(`chat/messages/${sent.body._id}`);

    const res = await convert(admin, sent.body._id, {
      target: "item",
      kind: "idea",
      title: "Too late",
    });

    expect(res.status).toBe(409);
  });

  it("an unknown target is refused", async () => {
    const sent = await send(admin, { body: "something" });

    const res = await convert(admin, sent.body._id, {
      target: "invoice",
      title: "Nope",
    });

    expect(res.status).toBe(403);
  });
});

describe("converting into a formal commitment", () => {
  it("the client owner can turn a message into a project request", async () => {
    const sent = await send(client, { body: "We also need a blog section" });

    const res = await convert(client, sent.body._id, {
      target: "request",
      title: "Blog section",
    });

    expect(res.status).toBe(201);
    const created = await ProjectRequest.findById(res.body.created._id);
    // Identity is the project's client, not whoever clicked convert.
    expect(created.clientUserId).toBe(cast.client._id);
    expect(created.sourceMessageId).toBe(sent.body._id);
    expect(created.status).toBe("new");
  });

  it("an admin converting on the client's behalf does not become the requester", async () => {
    const sent = await send(client, { body: "And a newsletter signup" });

    const res = await convert(admin, sent.body._id, {
      target: "request",
      title: "Newsletter signup",
    });

    const created = await ProjectRequest.findById(res.body.created._id);
    expect(created.clientUserId).toBe(cast.client._id);
    expect(created.clientEmail).toBe(cast.client.email);
  });

  it("a collaborator may NOT create a request — that is a commitment", async () => {
    const sent = await send(collaborator, { body: "We should also do X" });

    const res = await convert(collaborator, sent.body._id, {
      target: "request",
      title: "Sneaking in scope",
    });

    expect(res.status).toBe(403);
    expect(await ProjectRequest.countDocuments({})).toBe(0);
  });

  it("a message becomes a task on an existing milestone", async () => {
    const sent = await send(client, { body: "Please add the cookie banner" });

    const res = await convert(admin, sent.body._id, {
      target: "task",
      milestoneId,
      title: "Cookie banner",
    });

    expect(res.status).toBe(201);
    const project = await ClientProject.findById(cast.project._id);
    const milestone = project.milestones.find((m) => m._id === milestoneId);
    expect(milestone.tasks.map((t) => t.title)).toEqual(["Cookie banner"]);
    expect(milestone.tasks[0].status).toBe("pending");
  });

  it("a task needs a milestone that actually exists", async () => {
    const sent = await send(client, { body: "somewhere" });

    const res = await convert(admin, sent.body._id, {
      target: "task",
      milestoneId: "no-such-milestone",
      title: "Homeless task",
    });

    expect(res.status).toBe(404);
  });

  it("a task without a milestone id is refused outright", async () => {
    const sent = await send(client, { body: "somewhere" });

    const res = await convert(admin, sent.body._id, {
      target: "task",
      title: "Homeless task",
    });

    expect(res.status).toBe(400);
  });

  it("a message becomes a milestone comment attributed to the right side", async () => {
    const sent = await send(client, { body: "The header spacing looks off" });

    const res = await convert(client, sent.body._id, {
      target: "milestone_comment",
      milestoneId,
    });

    expect(res.status).toBe(201);
    const created = await ProjectMessage.findById(res.body.created._id);
    expect(created.milestoneId).toBe(milestoneId);
    expect(created.authorRole).toBe("client");
    expect(created.body).toBe("The header spacing looks off");
  });

  it("an admin's milestone comment is attributed to DMDevelon", async () => {
    const sent = await send(admin, { body: "Fixed in the latest deploy" });

    const res = await convert(admin, sent.body._id, {
      target: "milestone_comment",
      milestoneId,
    });

    const created = await ProjectMessage.findById(res.body.created._id);
    expect(created.authorRole).toBe("admin");
    expect(created.authorName).toBe("DMDevelon");
  });

  it("a milestone comment with nothing to say is refused", async () => {
    const sent = await send(client, {
      attachments: [{ url: "https://x/a.png", type: "image" }],
    });

    const res = await convert(client, sent.body._id, {
      target: "milestone_comment",
      milestoneId,
    });

    expect(res.status).toBe(400);
  });
});

describe("the project items list", () => {
  beforeEach(async () => {
    const a = await send(admin, { body: "a bug" });
    const b = await send(admin, { body: "a thought" });
    await convert(admin, a.body._id, {
      target: "item",
      kind: "problem",
      title: "A bug",
    });
    await convert(admin, b.body._id, {
      target: "item",
      kind: "idea",
      title: "A thought",
    });
  });

  const items = (actor, query) => actor.get("project-items", { query });

  it("every role that can see the project can see its record log", async () => {
    for (const actor of [admin, client, collaborator, viewer]) {
      const res = await items(actor, { projectId: cast.project._id });
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    }
  });

  it("an outsider gets a 404, not the log", async () => {
    const res = await items(asUser(cast.outsider), {
      projectId: cast.project._id,
    });

    expect(res.status).toBe(404);
  });

  it("requires a projectId — it is never a global list", async () => {
    const res = await items(admin, {});

    expect(res.status).toBe(400);
  });

  it("filters by kind and by status", async () => {
    const problems = await items(admin, {
      projectId: cast.project._id,
      kind: "problem",
    });
    expect(problems.body.map((i) => i.title)).toEqual(["A bug"]);

    const open = await items(admin, {
      projectId: cast.project._id,
      status: "open",
    });
    expect(open.body).toHaveLength(2);

    const accepted = await items(admin, {
      projectId: cast.project._id,
      status: "accepted",
    });
    expect(accepted.body).toEqual([]);
  });

  it("is ordered newest first", async () => {
    const res = await items(admin, { projectId: cast.project._id });

    expect(res.body.map((i) => i.title)).toEqual(["A thought", "A bug"]);
  });
});

describe("deciding on an item", () => {
  let itemId;

  beforeEach(async () => {
    const sent = await send(collaborator, { body: "Proposing we drop IE11" });
    const res = await convert(collaborator, sent.body._id, {
      target: "item",
      kind: "decision",
      title: "Drop IE11",
    });
    itemId = res.body.created._id;
  });

  it("the operator accepts it, and the acceptance is co-signed", async () => {
    const res = await admin.patch(`project-items/${itemId}`, {
      status: "accepted",
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("accepted");
    expect(res.body.confirmedBy.map((c) => c.userId)).toContain(cast.admin._id);
    expect(res.body.decidedAt).not.toBeNull();
  });

  it("rejecting does not add a confirmation", async () => {
    const before = (await ProjectItem.findById(itemId)).confirmedBy.length;

    const res = await admin.patch(`project-items/${itemId}`, {
      status: "rejected",
    });

    expect(res.body.status).toBe("rejected");
    expect(res.body.confirmedBy).toHaveLength(before);
  });

  it("the client owner may not decide — approving items is operator-only", async () => {
    const res = await client.patch(`project-items/${itemId}`, {
      status: "accepted",
    });

    expect(res.status).toBe(403);
  });

  it("a collaborator may not decide on the item they themselves captured", async () => {
    const res = await collaborator.patch(`project-items/${itemId}`, {
      status: "accepted",
    });

    expect(res.status).toBe(403);
  });

  it("an unknown status is refused", async () => {
    const res = await admin.patch(`project-items/${itemId}`, {
      status: "maybe",
    });

    expect(res.status).toBe(400);
  });

  it("accepting twice does not double-sign", async () => {
    await admin.patch(`project-items/${itemId}`, { status: "accepted" });
    const res = await admin.patch(`project-items/${itemId}`, {
      status: "accepted",
    });

    const signers = res.body.confirmedBy.filter(
      (c) => c.userId === cast.admin._id,
    );
    expect(signers).toHaveLength(1);
  });

  it("an item that does not exist is a 404", async () => {
    const res = await admin.patch(
      "project-items/00000000-0000-0000-0000-000000000000",
      { status: "accepted" },
    );

    expect(res.status).toBe(404);
  });
});
