import test from "node:test";
import assert from "node:assert/strict";
import {
  serializeChannelDetail,
  serializeChannelMember,
  serializeChannelSummary,
  serializeChatMessageForAccess,
  serializeProjectItem,
} from "../lib/chat-serializers.mjs";

function accessFor(role) {
  return { role };
}

function accessWithPermissions(role, permissions) {
  return { role, permissions };
}

function messageFixture(overrides = {}) {
  return {
    _id: "m-1",
    channelId: "ch-1",
    projectId: "p-1",
    authorUserId: "u-1",
    authorName: "Ana",
    authorRole: "member",
    body: "hello team",
    attachments: [
      { url: "https://cdn/a.png", type: "image", name: "a.png", visibility: "project_shared" },
      { url: "https://cdn/b.pdf", type: "pdf", name: "contract.pdf", visibility: "client_only" },
      { url: "https://cdn/c.png", type: "image", name: "internal.png", visibility: "internal_team" },
    ],
    flag: "decision",
    kind: "user",
    replyToMessageId: null,
    replyToPreview: null,
    mentions: ["u-2"],
    pinned: true,
    pinnedAt: "2026-01-01T00:00:00.000Z",
    convertedTo: [{ target: "item", targetId: "item-1", kind: "decision", ref: "D-001" }],
    editedAt: null,
    deletedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("a collaborator sees only project_shared attachments", () => {
  const out = serializeChatMessageForAccess(messageFixture(), accessFor("collaborator"));
  assert.equal(out.attachments.length, 1);
  assert.equal(out.attachments[0].name, "a.png");
});

test("the owner additionally sees client_only attachments", () => {
  const out = serializeChatMessageForAccess(messageFixture(), accessFor("owner"));
  assert.deepEqual(
    out.attachments.map((a) => a.name),
    ["a.png", "contract.pdf"],
  );
});

test("the admin sees every attachment including internal_team", () => {
  const out = serializeChatMessageForAccess(messageFixture(), accessFor("admin"));
  assert.equal(out.attachments.length, 3);
});

test("attachments never carry a raw visibility field into the response", () => {
  const out = serializeChatMessageForAccess(messageFixture(), accessFor("admin"));
  for (const a of out.attachments) {
    assert.ok(!("visibility" in a));
  }
});

test("a deleted message keeps its identity but redacts body and attachments for everyone", () => {
  const out = serializeChatMessageForAccess(
    messageFixture({ deletedAt: "2026-01-02T00:00:00.000Z" }),
    accessFor("admin"),
  );
  assert.equal(out.deleted, true);
  assert.equal(out.body, "");
  assert.deepEqual(out.attachments, []);
  // The formal-record link survives deletion — that's the whole point of
  // soft delete here.
  assert.equal(out.convertedTo[0].ref, "D-001");
  assert.equal(out.pinned, true);
  assert.equal(out.flag, "decision");
  assert.equal(out.authorName, "Ana");
});

test("a null access object is treated as no role, not a crash", () => {
  const out = serializeChatMessageForAccess(messageFixture(), null);
  assert.equal(out.attachments.length, 1); // project_shared only
});

test("mongoose documents are converted before picking", () => {
  const raw = messageFixture();
  const doc = { toObject: () => raw };
  const out = serializeChatMessageForAccess(doc, accessFor("admin"));
  assert.equal(out._id, "m-1");
  assert.equal(out.attachments.length, 3);
});

// --- Channel summary ---------------------------------------------------------

test("a channel summary carries unread count and a serialized last message", () => {
  const out = serializeChannelSummary(
    { _id: "ch-1", projectId: "p-1", kind: "group", name: "Project Group", postingPolicy: "all" },
    { unreadCount: 3, lastMessage: messageFixture(), accessObj: accessFor("collaborator") },
  );
  assert.equal(out.unreadCount, 3);
  assert.equal(out.lastMessage.attachments.length, 1);
  assert.equal(out.kind, "group");
});

test("a channel with no messages yet has a null lastMessage, not an error", () => {
  const out = serializeChannelSummary({ _id: "ch-2", kind: "group" });
  assert.equal(out.lastMessage, null);
  assert.equal(out.unreadCount, 0);
});

test("memberUserIds is present for a dm channel and absent for a group channel", () => {
  const dm = serializeChannelSummary({ _id: "ch-3", kind: "dm", memberUserIds: ["u-1", "u-2"] });
  assert.deepEqual(dm.memberUserIds, ["u-1", "u-2"]);
  const group = serializeChannelSummary({ _id: "ch-4", kind: "group" });
  assert.ok(!("memberUserIds" in group));
});

test("canPin/canWrite reflect the caller's own resolved permissions, not the channel kind", () => {
  const collaborator = serializeChannelSummary(
    { _id: "ch-5", kind: "group" },
    {
      accessObj: accessWithPermissions("collaborator", {
        pin: true,
        chatWrite: true,
        convertToItem: true,
        convertToFormal: false,
      }),
    },
  );
  assert.equal(collaborator.canPin, true);
  assert.equal(collaborator.canWrite, true);
  assert.equal(collaborator.canConvertToItem, true);
  assert.equal(collaborator.canConvertToFormal, false);
  assert.equal(collaborator.canApproveItems, false);

  const viewer = serializeChannelSummary(
    { _id: "ch-6", kind: "group" },
    {
      accessObj: accessWithPermissions("viewer", {
        pin: false,
        chatWrite: false,
        convertToItem: false,
        convertToFormal: false,
      }),
    },
  );
  assert.equal(viewer.canPin, false);
  assert.equal(viewer.canWrite, false);
  assert.equal(viewer.canConvertToItem, false);
  assert.equal(viewer.canConvertToFormal, false);
});

test("canPin/canWrite/canConvert* default to false rather than throwing when accessObj is missing", () => {
  const out = serializeChannelSummary({ _id: "ch-7", kind: "group" });
  assert.equal(out.canPin, false);
  assert.equal(out.canWrite, false);
  assert.equal(out.canConvertToItem, false);
  assert.equal(out.canConvertToFormal, false);
  assert.equal(out.canApproveItems, false);
});

// --- Channel detail / member roster ------------------------------------------

test("channel detail carries the member roster passed in", () => {
  const members = [serializeChannelMember({ userId: "u-1", name: "Ana", role: "collaborator" })];
  const out = serializeChannelDetail({ _id: "ch-1", kind: "group", name: "X" }, { members });
  assert.equal(out.members.length, 1);
  assert.equal(out.members[0].roleLabel, "Collaborator");
});

test("a channel member is labeled by business role, never 'admin'", () => {
  const out = serializeChannelMember({ userId: "u-9", name: "Milan", role: "admin" });
  assert.equal(out.roleLabel, "Lead Developer / Product Owner");
});

test("a custom roleLabel on a channel member wins over the default", () => {
  const out = serializeChannelMember({
    userId: "u-2",
    name: "Zak",
    role: "collaborator",
    roleLabel: "Designer",
  });
  assert.equal(out.roleLabel, "Designer");
});

// --- Project items -----------------------------------------------------------

test("a project item carries its ref, provenance, and confirmations", () => {
  const out = serializeProjectItem({
    _id: "item-1",
    projectId: "p-1",
    kind: "decision",
    ref: "D-001",
    title: "Ship v2",
    body: "let's ship v2",
    status: "open",
    severity: "low",
    sourceChannelId: "ch-1",
    sourceMessageId: "m-1",
    milestoneId: null,
    confirmedBy: [{ userId: "u-1", name: "Ana", at: new Date("2026-01-01") }],
    createdByUserId: "u-1",
    createdByName: "Ana",
    decidedAt: new Date("2026-01-01"),
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  });
  assert.equal(out.ref, "D-001");
  assert.equal(out.sourceMessageId, "m-1");
  assert.equal(out.confirmedBy.length, 1);
  assert.equal(out.confirmedBy[0].name, "Ana");
  assert.ok(out.decidedAt);
});

test("a project item with no confirmations yet serializes to an empty list, not an error", () => {
  const out = serializeProjectItem({ _id: "item-2", kind: "idea", ref: "ID-001", title: "x" });
  assert.deepEqual(out.confirmedBy, []);
  assert.equal(out.decidedAt, null);
  assert.equal(out.status, "open");
  assert.equal(out.severity, "low");
});
