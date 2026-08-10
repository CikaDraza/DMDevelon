import test from "node:test";
import assert from "node:assert/strict";
import {
  ATTACHMENT_VISIBILITIES,
  CHAT_LIMITS,
  ChatPermissionError,
  ChatStateError,
  ChatValidationError,
  INVITABLE_ROLES,
  MESSAGE_FLAGS,
  PERMISSION_KEYS,
  PRESENCE_ONLINE_THRESHOLD_MS,
  PURGE_DEFAULT_DAYS,
  PURGE_MAX_DAYS,
  ROLE_PERMISSIONS,
  assertInvitationAcceptable,
  buildReplyPreview,
  canConvertMessage,
  canInviteToProject,
  canManageMembers,
  canModerateMessage,
  canPostToChannel,
  canPurgeChannel,
  canViewAttachment,
  displayRoleLabel,
  isUserOnline,
  dmKeyFor,
  escapeRegExp,
  generateInviteToken,
  hashInviteToken,
  maskEmail,
  restrictForClosedProject,
  nextItemRef,
  normalizeEmail,
  parseMentions,
  permissionsForRole,
  resolveInvitationAction,
  resolveRoleFromFacts,
  sanitizeChatMessagePayload,
  sanitizeConvertPayload,
  sanitizeInvitationPayload,
  sanitizeProjectItemUpdate,
  sanitizePurgePayload,
} from "../lib/chat-domain.mjs";

function accessFor(role, userId = "u-actor") {
  return { role, userId, permissions: permissionsForRole(role) };
}

const groupChannel = { _id: "ch-1", kind: "group", postingPolicy: "all" };

// --- Permission matrix ------------------------------------------------------

test("every role preset covers exactly the known permission keys", () => {
  for (const [role, preset] of Object.entries(ROLE_PERMISSIONS)) {
    assert.deepEqual(
      Object.keys(preset).sort(),
      [...PERMISSION_KEYS].sort(),
      `role ${role} has drifted from PERMISSION_KEYS`,
    );
  }
});

test("collaborator and viewer never learn a proposal exists", () => {
  for (const role of ["collaborator", "viewer"]) {
    assert.equal(permissionsForRole(role).proposalsRead, false);
    assert.equal(permissionsForRole(role).internalFinanceRead, false);
  }
});

test("internal finance is admin-only, separate from proposal access", () => {
  assert.equal(permissionsForRole("admin").internalFinanceRead, true);
  assert.equal(permissionsForRole("owner").proposalsRead, true);
  assert.equal(permissionsForRole("owner").internalFinanceRead, false);
  assert.equal(permissionsForRole("client_lead").proposalsRead, true);
  assert.equal(permissionsForRole("client_lead").internalFinanceRead, false);
});

test("viewer is read-only across chat, files and milestones", () => {
  const viewer = permissionsForRole("viewer");
  assert.equal(viewer.chatRead, true);
  assert.equal(viewer.chatWrite, false);
  assert.equal(viewer.filesUpload, false);
  assert.equal(viewer.milestoneComment, false);
  assert.equal(viewer.pin, false);
});

test("only the owner and the operator manage members", () => {
  assert.equal(canManageMembers(accessFor("admin")), true);
  assert.equal(canManageMembers(accessFor("owner")), true);
  assert.equal(canManageMembers(accessFor("client_lead")), false);
  assert.equal(canManageMembers(accessFor("collaborator")), false);
});

test("inviting is open to owner, admin and the client lead", () => {
  assert.equal(canInviteToProject(accessFor("owner")), true);
  assert.equal(canInviteToProject(accessFor("admin")), true);
  assert.equal(canInviteToProject(accessFor("client_lead")), true);
  assert.equal(canInviteToProject(accessFor("collaborator")), false);
  assert.equal(canInviteToProject(accessFor("viewer")), false);
});

test("an unknown or absent role grants nothing", () => {
  assert.equal(canPostToChannel(accessFor(null), groupChannel), false);
  assert.equal(canPostToChannel(null, groupChannel), false);
  for (const key of PERMISSION_KEYS) {
    assert.equal(permissionsForRole("nope")[key], false);
  }
});

// --- Channel posting --------------------------------------------------------

test("an announcements-style channel only accepts the operator", () => {
  const announcements = { _id: "ch-2", postingPolicy: "admin_only" };
  assert.equal(canPostToChannel(accessFor("admin"), announcements), true);
  assert.equal(canPostToChannel(accessFor("owner"), announcements), false);
  assert.equal(canPostToChannel(accessFor("collaborator"), announcements), false);
});

test("an archived channel is read-only for everyone", () => {
  const archived = { ...groupChannel, archivedAt: new Date() };
  assert.equal(canPostToChannel(accessFor("admin"), archived), false);
  assert.equal(canPostToChannel(accessFor("owner"), archived), false);
});

// --- Moderation -------------------------------------------------------------

test("authors manage their own messages, moderators anyone's", () => {
  const mine = { _id: "m1", authorUserId: "u-actor" };
  const theirs = { _id: "m2", authorUserId: "u-someone-else" };

  assert.equal(canModerateMessage(accessFor("collaborator"), mine), true);
  assert.equal(canModerateMessage(accessFor("collaborator"), theirs), false);
  assert.equal(canModerateMessage(accessFor("owner"), theirs), false);
  assert.equal(canModerateMessage(accessFor("admin"), theirs), true);
  // A viewer cannot even delete a message it could never have written.
  assert.equal(canModerateMessage(accessFor("viewer"), mine), false);
});

// --- Conversions ------------------------------------------------------------

test("collaborators capture items, only owner and operator create commitments", () => {
  const collaborator = accessFor("collaborator");
  assert.equal(canConvertMessage(collaborator, "item"), true);
  assert.equal(canConvertMessage(collaborator, "request"), false);
  assert.equal(canConvertMessage(collaborator, "task"), false);
  assert.equal(canConvertMessage(collaborator, "milestone_comment"), false);

  for (const target of ["item", "request", "task", "milestone_comment"]) {
    assert.equal(canConvertMessage(accessFor("owner"), target), true);
    assert.equal(canConvertMessage(accessFor("admin"), target), true);
  }
});

test("an unknown conversion target is refused", () => {
  assert.equal(canConvertMessage(accessFor("admin"), "invoice"), false);
});

test("sanitizeConvertPayload refuses a role without the target's permission", () => {
  assert.throws(
    () => sanitizeConvertPayload("request", { title: "x" }, accessFor("collaborator")),
    ChatPermissionError,
  );
  assert.throws(
    () => sanitizeConvertPayload("item", { kind: "idea", title: "x" }, accessFor("viewer")),
    ChatPermissionError,
  );
});

test("sanitizeConvertPayload — item requires a known kind and a title", () => {
  const out = sanitizeConvertPayload(
    "item",
    { kind: "decision", title: "Ship v2" },
    accessFor("owner"),
    { sourceBody: "let's ship v2" },
  );
  assert.equal(out.kind, "decision");
  assert.equal(out.title, "Ship v2");
  assert.equal(out.body, "let's ship v2"); // falls back to the source message
  assert.equal(out.severity, "low"); // default when not provided

  assert.throws(
    () =>
      sanitizeConvertPayload("item", { kind: "not-a-kind", title: "x" }, accessFor("owner")),
    ChatValidationError,
  );
  assert.throws(
    () => sanitizeConvertPayload("item", { kind: "idea" }, accessFor("owner")),
    ChatValidationError,
  );
});

test("sanitizeConvertPayload — an invalid severity silently falls back to low, not rejected", () => {
  const out = sanitizeConvertPayload(
    "item",
    { kind: "incident", title: "Outage", severity: "catastrophic" },
    accessFor("admin"),
  );
  assert.equal(out.severity, "low");
});

test("sanitizeConvertPayload — an explicit body overrides the source message text", () => {
  const out = sanitizeConvertPayload(
    "item",
    { kind: "idea", title: "x", body: "typed over it" },
    accessFor("admin"),
    { sourceBody: "original chat text" },
  );
  assert.equal(out.body, "typed over it");
});

test("sanitizeConvertPayload — task and milestone_comment require a milestoneId", () => {
  assert.throws(
    () => sanitizeConvertPayload("task", { title: "Do the thing" }, accessFor("owner")),
    ChatValidationError,
  );
  const task = sanitizeConvertPayload(
    "task",
    { milestoneId: "m-1", title: "Do the thing" },
    accessFor("owner"),
  );
  assert.equal(task.milestoneId, "m-1");

  // Valid milestoneId, but no body override and no sourceBody — empty text.
  assert.throws(
    () =>
      sanitizeConvertPayload(
        "milestone_comment",
        { milestoneId: "m-1" },
        accessFor("admin"),
      ),
    ChatValidationError,
  );
});

test("sanitizeConvertPayload — milestone_comment needs actual text, title/kind excluded from its shape", () => {
  const out = sanitizeConvertPayload(
    "milestone_comment",
    { milestoneId: "m-2" },
    accessFor("admin"),
    { sourceBody: "carried over from chat" },
  );
  assert.equal(out.body, "carried over from chat");
  assert.ok(!("title" in out));
  assert.ok(!("kind" in out));
});

test("sanitizeConvertPayload — request just needs a title", () => {
  const out = sanitizeConvertPayload(
    "request",
    { title: "Add dark mode" },
    accessFor("owner"),
    { sourceBody: "can we get dark mode?" },
  );
  assert.equal(out.title, "Add dark mode");
  assert.equal(out.body, "can we get dark mode?");
  assert.throws(
    () => sanitizeConvertPayload("request", {}, accessFor("admin")),
    ChatValidationError,
  );
});

test("deciding on an item is operator-only — owner and collaborator are refused", () => {
  assert.throws(
    () => sanitizeProjectItemUpdate({ status: "accepted" }, accessFor("owner")),
    ChatPermissionError,
  );
  assert.throws(
    () =>
      sanitizeProjectItemUpdate({ status: "accepted" }, accessFor("collaborator")),
    ChatPermissionError,
  );
  assert.equal(
    sanitizeProjectItemUpdate({ status: "accepted" }, accessFor("admin")).status,
    "accepted",
  );
});

test("accepting an item co-signs it; every other status does not", () => {
  const admin = accessFor("admin");
  assert.equal(sanitizeProjectItemUpdate({ status: "accepted" }, admin).confirm, true);
  for (const status of ["open", "in_review", "rejected", "resolved", "closed"]) {
    assert.equal(sanitizeProjectItemUpdate({ status }, admin).confirm, false);
  }
});

test("an unknown item status is refused", () => {
  assert.throws(
    () => sanitizeProjectItemUpdate({ status: "approved" }, accessFor("admin")),
    ChatValidationError,
  );
  assert.throws(
    () => sanitizeProjectItemUpdate({}, accessFor("admin")),
    ChatValidationError,
  );
});

// --- Email handling ---------------------------------------------------------

test("email normalization is literal, not provider-aware", () => {
  assert.equal(normalizeEmail("  Milan@Example.COM "), "milan@example.com");
  // Plus-addressing stays a distinct identity on purpose.
  assert.notEqual(normalizeEmail("ime+test@gmail.com"), normalizeEmail("ime@gmail.com"));
  assert.equal(normalizeEmail(null), "");
});

test("masking keeps the hint without disclosing the address", () => {
  assert.equal(maskEmail("milan@example.com"), "m***@example.com");
  assert.equal(maskEmail("a@example.com"), "*@example.com");
  assert.equal(maskEmail("not-an-email"), "");
});

test("the mask width is fixed, so it does not leak the address length", () => {
  assert.equal(maskEmail("an@example.com"), "a***@example.com");
  assert.equal(maskEmail("anastasija@example.com"), "a***@example.com");
});

// --- Mentions ---------------------------------------------------------------

const members = [
  { userId: "u1", name: "Ana" },
  { userId: "u2", name: "Ana Marija" },
  { userId: "u3", name: "Milan Dražić" },
];

test("mentions resolve against real membership, longest name first", () => {
  assert.deepEqual(parseMentions("hey @Ana Marija, ping @Milan Dražić", members), [
    "u2",
    "u3",
  ]);
});

test("mentions ignore names that are not channel members", () => {
  assert.deepEqual(parseMentions("@Nepoznat hello", members), []);
});

test("mentions are deduplicated and case-insensitive", () => {
  assert.deepEqual(parseMentions("@ana and @ANA again", members), ["u1"]);
});

test("a longer name is claimed whole, so the shorter one does not also fire", () => {
  // "@Ana Marija" contains "@Ana"; only the person actually addressed is tagged.
  assert.deepEqual(parseMentions("@Ana Marija please review", members), ["u2"]);
});

test("a mention stops at a word boundary", () => {
  assert.deepEqual(parseMentions("@Anabela is someone else", members), []);
});

test("an email address in the body is not a mention", () => {
  assert.deepEqual(
    parseMentions("write to milan@Ana or ana@example.com", members),
    [],
  );
});

test("both names are tagged when each is addressed separately", () => {
  assert.deepEqual(parseMentions("@Ana and @Ana Marija", members), ["u1", "u2"]);
});

// --- Reply previews ---------------------------------------------------------

test("reply preview is truncated and self-contained", () => {
  const preview = buildReplyPreview({
    _id: "m-9",
    authorName: "Ana",
    body: "x".repeat(500),
  });
  assert.equal(preview.messageId, "m-9");
  assert.equal(preview.authorName, "Ana");
  assert.equal(preview.body.length, CHAT_LIMITS.replyPreview);
  assert.equal(buildReplyPreview(null), null);
});

// --- Payload sanitization ---------------------------------------------------

test("a message needs a body or an attachment", () => {
  assert.throws(
    () =>
      sanitizeChatMessagePayload(
        { body: "   " },
        { accessObj: accessFor("owner"), channel: groupChannel },
      ),
    ChatValidationError,
  );
});

test("an attachment alone is a valid message", () => {
  const out = sanitizeChatMessagePayload(
    { attachments: [{ url: "https://cdn/x.png", type: "image", name: "x.png" }] },
    { accessObj: accessFor("collaborator"), channel: groupChannel },
  );
  assert.equal(out.body, "");
  assert.equal(out.attachments.length, 1);
  assert.equal(out.attachments[0].visibility, "project_shared");
  assert.ok(ATTACHMENT_VISIBILITIES.includes(out.attachments[0].visibility));
});

test("a viewer cannot post at all", () => {
  assert.throws(
    () =>
      sanitizeChatMessagePayload(
        { body: "hi" },
        { accessObj: accessFor("viewer"), channel: groupChannel },
      ),
    ChatPermissionError,
  );
});

test("an unknown flag is refused", () => {
  assert.throws(
    () =>
      sanitizeChatMessagePayload(
        { body: "hi", flag: "invoice" },
        { accessObj: accessFor("owner"), channel: groupChannel },
      ),
    ChatValidationError,
  );
  for (const flag of MESSAGE_FLAGS) {
    const out = sanitizeChatMessagePayload(
      { body: "hi", flag },
      { accessObj: accessFor("owner"), channel: groupChannel },
    );
    assert.equal(out.flag, flag);
  }
});

test("a body over the limit is refused", () => {
  assert.throws(
    () =>
      sanitizeChatMessagePayload(
        { body: "x".repeat(CHAT_LIMITS.body + 1) },
        { accessObj: accessFor("owner"), channel: groupChannel },
      ),
    ChatValidationError,
  );
});

test("a reply cannot quote a message from another channel", () => {
  assert.throws(
    () =>
      sanitizeChatMessagePayload(
        { body: "re", replyToMessageId: "m-other" },
        {
          accessObj: accessFor("owner"),
          channel: groupChannel,
          replyToMessage: { _id: "m-other", channelId: "ch-999", body: "secret" },
        },
      ),
    ChatValidationError,
  );
});

test("a reply in the same channel carries a denormalized preview", () => {
  const out = sanitizeChatMessagePayload(
    { body: "re", replyToMessageId: "m-1" },
    {
      accessObj: accessFor("owner"),
      channel: groupChannel,
      replyToMessage: {
        _id: "m-1",
        channelId: "ch-1",
        authorName: "Ana",
        body: "original",
      },
    },
  );
  assert.equal(out.replyToMessageId, "m-1");
  assert.deepEqual(out.replyToPreview, {
    messageId: "m-1",
    authorName: "Ana",
    body: "original",
  });
});

test("mentions in a payload are intersected with membership", () => {
  const out = sanitizeChatMessagePayload(
    { body: "@Ana and @Nepoznat", mentions: ["u-injected"] },
    { accessObj: accessFor("owner"), channel: groupChannel, members },
  );
  assert.deepEqual(out.mentions, ["u1"]);
});

// --- Project item references ------------------------------------------------

test("item refs start at 001 and increment per kind", () => {
  assert.equal(nextItemRef("decision", null), "D-001");
  assert.equal(nextItemRef("decision", "D-040"), "D-041");
  assert.equal(nextItemRef("incident", "I-006"), "I-007");
  assert.equal(nextItemRef("problem", null), "P-001");
  assert.equal(nextItemRef("idea", "ID-012"), "ID-013");
});

test("a ref from a different kind does not continue the sequence", () => {
  assert.equal(nextItemRef("decision", "I-099"), "D-001");
});

test("an unknown item kind is refused", () => {
  assert.throws(() => nextItemRef("invoice", null), ChatValidationError);
});

// --- Display labels ---------------------------------------------------------

test("the operator is shown a business role, never 'superadmin'", () => {
  const label = displayRoleLabel("admin");
  assert.equal(label, "Lead Developer / Product Owner");
  assert.ok(!label.toLowerCase().includes("admin"));
});

test("a member's own role label wins over the default", () => {
  assert.equal(displayRoleLabel("collaborator", "Designer"), "Designer");
  assert.equal(displayRoleLabel("collaborator", "  "), "Collaborator");
});

// --- Presence ----------------------------------------------------------------

test("isUserOnline is true just under the threshold, false at or beyond it", () => {
  // Derived from the constant rather than hardcoded seconds: the threshold
  // tracks the slowest poll that feeds lastActiveAt and has already moved
  // once (45s → 90s when the notifications poll became a second heartbeat).
  const now = new Date("2026-01-01T01:00:00.000Z");
  const recent = new Date(now.getTime() - (PRESENCE_ONLINE_THRESHOLD_MS - 5_000));
  const exactly = new Date(now.getTime() - PRESENCE_ONLINE_THRESHOLD_MS);
  const stale = new Date(now.getTime() - (PRESENCE_ONLINE_THRESHOLD_MS + 5_000));
  assert.equal(isUserOnline(recent, now), true);
  assert.equal(isUserOnline(exactly, now), false, "the boundary counts as offline");
  assert.equal(isUserOnline(stale, now), false);
});

test("isUserOnline is false for null/invalid lastActiveAt, never throws", () => {
  assert.equal(isUserOnline(null), false);
  assert.equal(isUserOnline(undefined), false);
  assert.equal(isUserOnline("not-a-date"), false);
});

// --- Role resolution (the decision behind lib/project-access.js) -----------

test("the global admin flag wins over everything else", () => {
  assert.equal(
    resolveRoleFromFacts({
      isAdmin: true,
      isOwner: true,
      membership: { status: "active", role: "collaborator" },
    }),
    "admin",
  );
});

test("ownership wins over membership", () => {
  assert.equal(
    resolveRoleFromFacts({
      isOwner: true,
      membership: { status: "active", role: "viewer" },
    }),
    "owner",
  );
});

test("an active membership resolves to its own role", () => {
  assert.equal(
    resolveRoleFromFacts({ membership: { status: "active", role: "collaborator" } }),
    "collaborator",
  );
  assert.equal(
    resolveRoleFromFacts({ membership: { status: "active", role: "viewer" } }),
    "viewer",
  );
});

test("no facts at all resolves to no role", () => {
  assert.equal(resolveRoleFromFacts({}), null);
  assert.equal(resolveRoleFromFacts(), null);
});

test("a removed or suspended member is indistinguishable from a stranger", () => {
  assert.equal(
    resolveRoleFromFacts({ membership: { status: "removed", role: "collaborator" } }),
    null,
  );
  assert.equal(
    resolveRoleFromFacts({ membership: { status: "suspended", role: "collaborator" } }),
    null,
  );
});

test("a membership role outside the known set is refused, not passed through", () => {
  assert.equal(
    resolveRoleFromFacts({ membership: { status: "active", role: "superuser" } }),
    null,
  );
});

// --- Closed project (owner closed their account) ---------------------------

const closedProject = { _id: "p-1", ownerAccountDeletedAt: new Date() };
const liveProject = { _id: "p-1", ownerAccountDeletedAt: null };

test("a live project is untouched, whatever its status", () => {
  const perms = permissionsForRole("collaborator");
  assert.equal(restrictForClosedProject(perms, { role: "collaborator", project: liveProject }), perms);
  // A delivered project with a live client stays writable — restricting it
  // would break post-delivery conversation that works today.
  assert.equal(
    restrictForClosedProject(perms, {
      role: "collaborator",
      project: { ...liveProject, status: "completed" },
    }),
    perms,
  );
});

test("a closed project is read-only for a collaborator", () => {
  const out = restrictForClosedProject(permissionsForRole("collaborator"), {
    role: "collaborator",
    project: closedProject,
  });
  assert.equal(out.projectRead, true);
  assert.equal(out.chatRead, true);
  assert.equal(out.membersRead, true);
  assert.equal(out.leaveProject, true);
  assert.equal(out.chatWrite, false);
  assert.equal(out.filesUpload, false);
  assert.equal(out.milestoneComment, false);
  assert.equal(out.pin, false);
  assert.equal(out.convertToItem, false);
});

test("a closed project is read-only for the owner role too", () => {
  const out = restrictForClosedProject(permissionsForRole("owner"), {
    role: "owner",
    project: closedProject,
  });
  assert.equal(out.projectRead, true);
  assert.equal(out.chatWrite, false);
  assert.equal(out.membersInvite, false);
  assert.equal(out.membersManage, false);
  assert.equal(out.proposalsRead, false);
});

test("the operator keeps full access to a closed project", () => {
  const perms = permissionsForRole("admin");
  assert.equal(restrictForClosedProject(perms, { role: "admin", project: closedProject }), perms);
});

test("closing never grants a permission the role did not already have", () => {
  const out = restrictForClosedProject(permissionsForRole("viewer"), {
    role: "viewer",
    project: closedProject,
  });
  // viewer never had chatWrite; it must not appear via the read-only mask.
  assert.equal(out.chatWrite, false);
  assert.equal(out.chatRead, true);
});

// --- DM pair identity -------------------------------------------------------

test("a DM key is the same whichever participant asks", () => {
  assert.equal(dmKeyFor("u2", "u1"), dmKeyFor("u1", "u2"));
  assert.equal(dmKeyFor("u1", "u2"), "u1:u2");
});

test("a DM needs two distinct participants", () => {
  assert.throws(() => dmKeyFor("u1", "u1"), ChatValidationError);
  assert.throws(() => dmKeyFor("u1", null), ChatValidationError);
  assert.throws(() => dmKeyFor("", "u2"), ChatValidationError);
});

// --- Invitation tokens -------------------------------------------------------

test("a generated token is long, url-safe, and unique per call", () => {
  const a = generateInviteToken();
  const b = generateInviteToken();
  assert.notEqual(a, b);
  assert.ok(a.length >= 40);
  assert.ok(/^[A-Za-z0-9_-]+$/.test(a));
});

test("token hashing is deterministic and one-way in practice", () => {
  const token = "fixed-token-for-test";
  assert.equal(hashInviteToken(token), hashInviteToken(token));
  assert.notEqual(hashInviteToken(token), token);
  assert.equal(hashInviteToken(token).length, 64); // sha256 hex
});

test("different tokens hash to different values", () => {
  assert.notEqual(hashInviteToken("a"), hashInviteToken("b"));
});

// --- Invitation payload validation ------------------------------------------

test("a valid invite payload is normalized", () => {
  const out = sanitizeInvitationPayload({
    email: "  Designer@Example.COM ",
    intendedRole: "viewer",
    roleLabel: "Designer",
    personalMessage: "Welcome aboard",
  });
  assert.deepEqual(out, {
    email: "designer@example.com",
    intendedRole: "viewer",
    roleLabel: "Designer",
    personalMessage: "Welcome aboard",
  });
});

test("an invite payload defaults to collaborator with empty optional fields", () => {
  const out = sanitizeInvitationPayload({ email: "a@example.com" });
  assert.equal(out.intendedRole, "collaborator");
  assert.equal(out.roleLabel, "");
  assert.equal(out.personalMessage, "");
});

test("a malformed email is refused", () => {
  for (const bad of ["", "not-an-email", "no-domain@", "@no-local.com", "   "]) {
    assert.throws(
      () => sanitizeInvitationPayload({ email: bad }),
      ChatValidationError,
      `expected "${bad}" to be refused`,
    );
  }
});

test("only the two Phase 1 roles can be invited from this payload", () => {
  for (const role of INVITABLE_ROLES) {
    const out = sanitizeInvitationPayload({ email: "a@example.com", intendedRole: role });
    assert.equal(out.intendedRole, role);
  }
  for (const reserved of ["client_lead", "project_admin", "admin", "owner"]) {
    assert.throws(
      () => sanitizeInvitationPayload({ email: "a@example.com", intendedRole: reserved }),
      ChatValidationError,
    );
  }
});

// --- Invitation action matrix ------------------------------------------------

test("an active membership blocks a new invite", () => {
  assert.equal(
    resolveInvitationAction({ membershipStatus: "active", invitationStatus: null }),
    "already_member",
  );
});

test("a pending invitation blocks stacking a second one", () => {
  assert.equal(
    resolveInvitationAction({ membershipStatus: null, invitationStatus: "pending" }),
    "pending_exists",
  );
});

test("a removed membership does not block re-inviting the same person", () => {
  assert.equal(
    resolveInvitationAction({ membershipStatus: "removed", invitationStatus: null }),
    "create",
  );
  assert.equal(
    resolveInvitationAction({ membershipStatus: "removed", invitationStatus: "revoked" }),
    "create",
  );
});

test("no prior relationship simply creates a new invitation", () => {
  assert.equal(resolveInvitationAction({}), "create");
  assert.equal(
    resolveInvitationAction({ membershipStatus: null, invitationStatus: "accepted" }),
    "create",
  );
});

test("active membership is checked before a pending invitation", () => {
  // Should not normally coexist, but the priority must still be unambiguous.
  assert.equal(
    resolveInvitationAction({ membershipStatus: "active", invitationStatus: "pending" }),
    "already_member",
  );
});

// --- Invitation acceptance ---------------------------------------------------

function invitationFor(overrides = {}) {
  return {
    emailNormalized: "ana@example.com",
    status: "pending",
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  };
}

test("a live invitation accepted by its own address passes", () => {
  assert.doesNotThrow(() => assertInvitationAcceptable(invitationFor(), "Ana@Example.com"));
});

test("a revoked invitation is a state conflict, not a permission error", () => {
  assert.throws(
    () => assertInvitationAcceptable(invitationFor({ status: "revoked" }), "ana@example.com"),
    ChatStateError,
  );
});

test("an already-accepted invitation cannot be accepted twice", () => {
  assert.throws(
    () => assertInvitationAcceptable(invitationFor({ status: "accepted" }), "ana@example.com"),
    ChatStateError,
  );
});

test("an expired invitation is refused even if its status field lags", () => {
  assert.throws(
    () =>
      assertInvitationAcceptable(
        invitationFor({ expiresAt: new Date(Date.now() - 1000) }),
        "ana@example.com",
      ),
    ChatStateError,
  );
  assert.throws(
    () => assertInvitationAcceptable(invitationFor({ status: "expired" }), "ana@example.com"),
    ChatStateError,
  );
});

test("a mismatched email is a permission error with a masked hint, not the full address", () => {
  assert.throws(
    () => {
      try {
        assertInvitationAcceptable(invitationFor(), "someone-else@example.com");
      } catch (e) {
        assert.ok(e instanceof ChatPermissionError);
        assert.ok(e.message.includes("a***@example.com"));
        assert.ok(!e.message.includes("ana@example.com"));
        throw e;
      }
    },
    ChatPermissionError,
  );
});

test("status is checked before identity, so a stranger cannot probe a dead invitation for the real address", () => {
  // A revoked invitation reports its state, not a mismatch, regardless of who asks.
  assert.throws(
    () =>
      assertInvitationAcceptable(
        invitationFor({ status: "revoked" }),
        "attacker@example.com",
      ),
    ChatStateError,
  );
});

// --- Attachment visibility ---------------------------------------------------

test("project_shared is visible to any role, including an unrecognized one", () => {
  for (const role of ["viewer", "collaborator", "client_lead", "owner", "admin", "bogus"]) {
    assert.equal(canViewAttachment(role, "project_shared"), true);
  }
});

test("client_only is limited to owner and admin", () => {
  assert.equal(canViewAttachment("owner", "client_only"), true);
  assert.equal(canViewAttachment("admin", "client_only"), true);
  assert.equal(canViewAttachment("collaborator", "client_only"), false);
  assert.equal(canViewAttachment("viewer", "client_only"), false);
  assert.equal(canViewAttachment("client_lead", "client_only"), false);
});

test("internal_team is admin-only", () => {
  assert.equal(canViewAttachment("admin", "internal_team"), true);
  assert.equal(canViewAttachment("owner", "internal_team"), false);
  assert.equal(canViewAttachment("collaborator", "internal_team"), false);
});

// --- Purging a channel -------------------------------------------------------

test("only a moderator may purge a channel — not the owner of the project", () => {
  assert.equal(canPurgeChannel(accessFor("admin")), true);
  assert.equal(canPurgeChannel(accessFor("owner")), false);
  assert.equal(canPurgeChannel(accessFor("project_admin")), false);
  assert.equal(canPurgeChannel(accessFor("collaborator")), false);
  assert.equal(canPurgeChannel(accessFor("viewer")), false);
  assert.equal(canPurgeChannel(null), false);
});

test("sanitizePurgePayload — the permission check runs before any validation", () => {
  assert.throws(
    () => sanitizePurgePayload({ scope: "all" }, accessFor("owner")),
    ChatPermissionError,
  );
  // Even a payload that would fail validation is rejected as forbidden first,
  // so a malformed request never reveals which scopes exist.
  assert.throws(
    () => sanitizePurgePayload({ scope: "nonsense" }, accessFor("viewer")),
    ChatPermissionError,
  );
});

test("sanitizePurgePayload — scope defaults to all and carries no cutoff", () => {
  const out = sanitizePurgePayload({}, accessFor("admin"));
  assert.equal(out.scope, "all");
  assert.equal(out.days, null);
  // null, not "the epoch" — this is what tells the caller to drop the createdAt
  // filter instead of building a range that would match nothing.
  assert.equal(out.before, null);
});

test("sanitizePurgePayload — older_than defaults to a 30-day window", () => {
  const now = new Date("2026-03-01T12:00:00.000Z");
  const out = sanitizePurgePayload(
    { scope: "older_than" },
    accessFor("admin"),
    { now },
  );
  assert.equal(out.scope, "older_than");
  assert.equal(out.days, PURGE_DEFAULT_DAYS);
  assert.equal(out.before.toISOString(), "2026-01-30T12:00:00.000Z");
});

test("sanitizePurgePayload — an explicit day count is honoured", () => {
  const now = new Date("2026-03-01T12:00:00.000Z");
  const out = sanitizePurgePayload(
    { scope: "older_than", days: 7 },
    accessFor("admin"),
    { now },
  );
  assert.equal(out.days, 7);
  assert.equal(out.before.toISOString(), "2026-02-22T12:00:00.000Z");
});

test("sanitizePurgePayload — an unknown scope is rejected", () => {
  assert.throws(
    () => sanitizePurgePayload({ scope: "everything" }, accessFor("admin")),
    ChatValidationError,
  );
});

test("sanitizePurgePayload — days must be a whole number in range", () => {
  for (const days of [0, -1, 1.5, "soon", Number.NaN, PURGE_MAX_DAYS + 1]) {
    assert.throws(
      () =>
        sanitizePurgePayload(
          { scope: "older_than", days },
          accessFor("admin"),
        ),
      ChatValidationError,
      `days=${String(days)} should be rejected`,
    );
  }
  // A numeric string is a normal shape off the wire and converts cleanly.
  assert.equal(
    sanitizePurgePayload({ scope: "older_than", days: "14" }, accessFor("admin"))
      .days,
    14,
  );
});

// --- Search input escaping ---------------------------------------------------

test("regex metacharacters in search input are escaped, not interpreted", () => {
  assert.equal(escapeRegExp("a.b"), "a\\.b");
  assert.equal(escapeRegExp("(hi)"), "\\(hi\\)");
  assert.equal(escapeRegExp("a+b*c?"), "a\\+b\\*c\\?");
  assert.equal(escapeRegExp("[test]"), "\\[test\\]");
});

test("an escaped pattern matches only the literal text", () => {
  const escaped = escapeRegExp("$5.00 (final)");
  const re = new RegExp(escaped, "i");
  assert.ok(re.test("Price is $5.00 (final) today"));
  assert.ok(!re.test("Price is 5x00 xfinalx today"));
});

test("escaping tolerates non-string input", () => {
  assert.equal(escapeRegExp(null), "");
  assert.equal(escapeRegExp(undefined), "");
});
