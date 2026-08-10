// Pure domain rules for the Project Communication Hub.
//
// No database imports: everything here is a total function over plain values so
// the authorization matrix can be unit tested directly. `lib/project-access.js`
// is the only place that turns a user + project into an `access` object, and it
// gets its permission presets from ROLE_PERMISSIONS below.

import { createHash, randomBytes } from "node:crypto";

export const MESSAGE_FLAGS = Object.freeze([
  "none",
  "request",
  "task",
  "idea",
  "problem",
  "incident",
  "decision",
]);

export const CHANNEL_KINDS = Object.freeze(["group", "dm", "system"]);

export const PROJECT_ITEM_KINDS = Object.freeze([
  "idea",
  "problem",
  "incident",
  "decision",
]);

export const PROJECT_ITEM_SEVERITIES = Object.freeze([
  "low",
  "medium",
  "high",
  "critical",
]);

export const PROJECT_ITEM_STATUSES = Object.freeze([
  "open",
  "in_review",
  "accepted",
  "rejected",
  "resolved",
  "closed",
]);

export const CONVERT_TARGETS = Object.freeze([
  "request",
  "task",
  "item",
  "milestone_comment",
]);

/**
 * How much of a channel's history a purge removes. `all` empties it;
 * `older_than` keeps the most recent `days` and deletes everything before.
 */
export const PURGE_SCOPES = Object.freeze(["all", "older_than"]);

// "Older than a month" as the UI offers it. Defined here, not in the button,
// so the server validates the same number the button promises.
export const PURGE_DEFAULT_DAYS = 30;
export const PURGE_MAX_DAYS = 3650;

export const MEMBER_ROLES = Object.freeze([
  "collaborator",
  "viewer",
  "client_lead",
  "project_admin",
]);

export const INVITATION_STATUSES = Object.freeze([
  "pending",
  "accepted",
  "expired",
  "revoked",
]);

export const ATTACHMENT_VISIBILITIES = Object.freeze([
  "project_shared",
  "client_only",
  "internal_team",
]);

export const CHAT_LIMITS = Object.freeze({
  body: 10_000,
  attachments: 10,
  attachmentName: 300,
  replyPreview: 140,
  mentions: 50,
  roleLabel: 80,
  personalMessage: 2_000,
  itemTitle: 200,
  itemBody: 10_000,
});

/**
 * Every permission the app can ask about. Endpoints must always ask for one of
 * these keys — never for a role name — so that the policy stays in one place.
 */
export const PERMISSION_KEYS = Object.freeze([
  "projectRead",
  "milestoneRead",
  "milestoneComment",
  "taskRead",
  "chatRead",
  "chatWrite",
  "filesUpload",
  "filesDeleteOwn",
  "messagesModerate",
  "membersRead",
  "membersInvite",
  "membersManage",
  "proposalsRead",
  "internalFinanceRead",
  "convertToItem",
  "convertToFormal",
  "pin",
  // Deciding on a converted item (accept/reject a Decision, close an
  // Incident). Listed here but granted to no preset except `admin`, which
  // takes every key by construction — so it is operator-only without needing
  // a role-name check anywhere.
  "itemsApprove",
  "leaveProject",
]);

function permissions(granted) {
  const result = {};
  for (const key of PERMISSION_KEYS) result[key] = granted.includes(key);
  return Object.freeze(result);
}

/**
 * The authorization matrix, in one place.
 *
 * `admin` is the global operator (User.isAdmin), `owner` is the client whose
 * account the project belongs to. The remaining roles come from ProjectMember.
 *
 * Two deliberate exclusions:
 *  - `proposalsRead` is withheld from collaborator/viewer. Being a member of a
 *    project is NOT sufficient to learn that a commercial proposal exists, let
 *    alone its amount.
 *  - `internalFinanceRead` is admin-only and separate from proposal access, so
 *    that a future internal cost/margin field never lands in a client-facing
 *    projection by default.
 */
export const ROLE_PERMISSIONS = Object.freeze({
  admin: permissions(PERMISSION_KEYS.filter((k) => k !== "leaveProject")),
  owner: permissions([
    "projectRead",
    "milestoneRead",
    "milestoneComment",
    "taskRead",
    "chatRead",
    "chatWrite",
    "filesUpload",
    "filesDeleteOwn",
    "membersRead",
    "membersInvite",
    "membersManage",
    "proposalsRead",
    "convertToItem",
    "convertToFormal",
    "pin",
  ]),
  project_admin: permissions([
    "projectRead",
    "milestoneRead",
    "milestoneComment",
    "taskRead",
    "chatRead",
    "chatWrite",
    "filesUpload",
    "filesDeleteOwn",
    "membersRead",
    "membersInvite",
    "membersManage",
    "proposalsRead",
    "convertToItem",
    "pin",
    "leaveProject",
  ]),
  client_lead: permissions([
    "projectRead",
    "milestoneRead",
    "milestoneComment",
    "taskRead",
    "chatRead",
    "chatWrite",
    "filesUpload",
    "filesDeleteOwn",
    "membersRead",
    "membersInvite",
    "proposalsRead",
    "convertToItem",
    "pin",
  ]),
  collaborator: permissions([
    "projectRead",
    "milestoneRead",
    "milestoneComment",
    "taskRead",
    "chatRead",
    "chatWrite",
    "filesUpload",
    "filesDeleteOwn",
    "membersRead",
    "convertToItem",
    "pin",
    "leaveProject",
  ]),
  viewer: permissions([
    "projectRead",
    "milestoneRead",
    "taskRead",
    "chatRead",
    "membersRead",
    "leaveProject",
  ]),
});

const NO_PERMISSIONS = permissions([]);

/** Permission preset for a resolved role. An unknown role grants nothing. */
export function permissionsForRole(role) {
  return ROLE_PERMISSIONS[role] || NO_PERMISSIONS;
}

/**
 * Pure decision for "which role does this user have on this project", given
 * facts the caller has already gathered: the global admin flag, the existing
 * canAccessClientEntity ownership check, and (at most) one active
 * ProjectMember row. Kept separate from the database lookups themselves
 * (lib/project-access.js does those) so the decision itself — the part that
 * actually matters for security — can be unit tested without a database.
 *
 * Only a membership with status 'active' resolves to a role. 'suspended' and
 * 'removed' rows, or a role string that has drifted outside MEMBER_ROLES,
 * resolve to no role at all — the same outcome as never having been invited.
 * That is deliberate: a removed collaborator's request must be
 * indistinguishable from a stranger's (both get denied the same way), not
 * "you used to have access".
 */
export function resolveRoleFromFacts({
  isAdmin = false,
  isOwner = false,
  membership = null,
} = {}) {
  if (isAdmin) return "admin";
  if (isOwner) return "owner";
  if (
    membership &&
    membership.status === "active" &&
    MEMBER_ROLES.includes(membership.role)
  ) {
    return membership.role;
  }
  return null;
}

/**
 * Permissions that survive on a closed project. Everything else is masked off.
 * Reading and leaving remain; nothing that writes, invites, or commits does.
 */
const CLOSED_PROJECT_PERMISSIONS = Object.freeze([
  "projectRead",
  "milestoneRead",
  "taskRead",
  "chatRead",
  "membersRead",
  "leaveProject",
]);

/**
 * Downgrade permissions on a project whose client has closed their account.
 *
 * The engagement is kept as history — the operator needs it, and so do the
 * collaborators who worked on it — but nobody can act on it any more: there is
 * no longer an owner who could agree to a change, approve a milestone, or
 * answer a question. So it goes read-only for every participant.
 *
 * The operator is exempt: they still administer the historical record and are
 * the one who publishes the finished work to the public portfolio.
 *
 * Note this is triggered by the owner's account being gone, NOT by the project
 * merely being completed. A delivered project with a live client stays fully
 * writable — post-delivery questions are normal work, and restricting them
 * would be a regression for clients who do this today.
 */
export function restrictForClosedProject(perms, { role, project } = {}) {
  if (role === "admin") return perms;
  if (!project?.ownerAccountDeletedAt) return perms;
  const restricted = {};
  for (const key of PERMISSION_KEYS) {
    restricted[key] = perms?.[key] === true && CLOSED_PROJECT_PERMISSIONS.includes(key);
  }
  return Object.freeze(restricted);
}

/**
 * Canonical key for a direct-message pair: sorted ids joined by ':'.
 *
 * Sorting is what makes (a,b) and (b,a) the same channel. This value carries a
 * unique index, so two simultaneous "open a DM with this person" requests
 * collide in the database instead of quietly producing two conversations that
 * each hold half the history.
 */
export function dmKeyFor(userIdA, userIdB) {
  const a = String(userIdA ?? "");
  const b = String(userIdB ?? "");
  if (!a || !b) throw new ChatValidationError("A direct message needs two participants");
  if (a === b) throw new ChatValidationError("Cannot open a direct message with yourself");
  return [a, b].sort().join(":");
}

export class ChatDomainError extends Error {
  constructor(message, { name, code, statusCode } = {}) {
    super(message);
    this.name = name || "ChatDomainError";
    this.code = code || "CHAT_DOMAIN_ERROR";
    this.statusCode = statusCode || 400;
    // Matches the shape `errorResponse` in the API route already understands.
    this.status = this.statusCode;
  }
}

export class ChatValidationError extends ChatDomainError {
  constructor(message, code = "INVALID_CHAT_PAYLOAD") {
    super(message, { name: "ChatValidationError", code, statusCode: 400 });
  }
}

export class ChatPermissionError extends ChatDomainError {
  constructor(message = "Forbidden", code = "CHAT_FORBIDDEN") {
    super(message, { name: "ChatPermissionError", code, statusCode: 403 });
  }
}

/**
 * The resource exists and the actor has some claim to it, but its current
 * status doesn't allow this action — a revoked/expired/already-accepted
 * invitation, for instance. Distinct from ChatValidationError (malformed
 * input) and ChatPermissionError (wrong identity): this is a state conflict,
 * matching the 409 already used for ProposalStateError in
 * lib/project-proposal-domain.mjs.
 */
export class ChatStateError extends ChatDomainError {
  constructor(message, code = "INVALID_STATE") {
    super(message, { name: "ChatStateError", code, statusCode: 409 });
  }
}

/**
 * Literal normalization only.
 *
 * Provider-specific rewrites (gmail dots, plus-addressing) are deliberately not
 * applied: treating ime+test@gmail.com and ime@gmail.com as one identity would
 * silently widen who can accept an invitation.
 */
export function normalizeEmail(email) {
  if (typeof email !== "string") return "";
  return email.trim().toLowerCase();
}

/**
 * m***@example.com — safe to show on an invitation mismatch screen.
 *
 * The mask is a fixed width on purpose: varying it with the local part would
 * disclose the address length to whoever is holding the link.
 */
export function maskEmail(email) {
  const normalized = normalizeEmail(email);
  const at = normalized.indexOf("@");
  if (at <= 0) return "";
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at);
  // A single-character local part cannot be hinted at without revealing it.
  if (local.length <= 1) return `*${domain}`;
  return `${local[0]}***${domain}`;
}

// --- Invitations -------------------------------------------------------

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Random 32-byte token for an invitation link, base64url so it drops cleanly
 * into a URL. This value goes in the email only — the database stores just
 * its hash (below), the same way User.resetToken's counterpart never does.
 */
export function generateInviteToken() {
  return randomBytes(32).toString("base64url");
}

/**
 * sha256 of the raw token, hex-encoded. Creation and lookup MUST hash the same
 * way or every token silently reads as invalid — that's why this is one named
 * function instead of an inline `createHash(...)` at each call site.
 */
export function hashInviteToken(rawToken) {
  return createHash("sha256").update(String(rawToken ?? "")).digest("hex");
}

/** Roles Phase 1 actually offers from the invite dialog. */
export const INVITABLE_ROLES = Object.freeze(["collaborator", "viewer"]);

/**
 * Validate and normalize an invite request. Throws ChatValidationError on a
 * malformed email or an out-of-phase role (client_lead/project_admin exist in
 * the schema for Phase 2, but this endpoint doesn't hand them out yet).
 */
export function sanitizeInvitationPayload(input) {
  const payload = input && typeof input === "object" ? input : {};
  const email = normalizeEmail(payload.email);
  if (!email || !EMAIL_SHAPE.test(email)) {
    throw new ChatValidationError("A valid email is required");
  }
  const intendedRole = payload.intendedRole || "collaborator";
  if (!INVITABLE_ROLES.includes(intendedRole)) {
    throw new ChatValidationError("Invalid role");
  }
  return {
    email,
    intendedRole,
    roleLabel: cleanText(payload.roleLabel, "Role label", CHAT_LIMITS.roleLabel),
    personalMessage: cleanText(
      payload.personalMessage,
      "Personal message",
      CHAT_LIMITS.personalMessage,
    ),
  };
}

/**
 * Given what already exists for this (project, email) pair, decide what a new
 * invite request should do. Kept separate from the database lookups so the
 * decision matrix — the exact thing that prevents duplicate invitations or a
 * silent second membership — is testable without one.
 *
 * `membershipStatus` is the status of an existing ProjectMember row for this
 * person on this project, if any (null if they were never a member).
 * `invitationStatus` is the status of the most recent invitation for this
 * (project, email) pair, if any.
 */
export function resolveInvitationAction({ membershipStatus, invitationStatus } = {}) {
  if (membershipStatus === "active") return "already_member";
  if (invitationStatus === "pending") return "pending_exists";
  // A 'removed' (or 'suspended') membership does not block a fresh invite —
  // re-inviting someone who left is allowed. Their eventual acceptance reuses
  // the existing ProjectMember row (see assertInvitationAcceptable's caller in
  // lib/project-access.js / route.js) rather than creating a duplicate one.
  return "create";
}

/**
 * Is this invitation acceptable right now, by this authenticated email?
 *
 * Throws ChatStateError (409) for a revoked/accepted/expired invitation —
 * a state conflict, not a permission problem — and ChatPermissionError (403)
 * when the invitation is live but bound to a different address. The 403
 * message includes a masked hint, never the full address of either side.
 */
export function assertInvitationAcceptable(invitation, userEmail) {
  if (invitation.status === "revoked") {
    throw new ChatStateError("This invitation has been revoked", "INVITATION_REVOKED");
  }
  if (invitation.status === "accepted") {
    throw new ChatStateError(
      "This invitation has already been used",
      "INVITATION_ALREADY_ACCEPTED",
    );
  }
  const expired =
    invitation.status === "expired" ||
    (invitation.expiresAt && new Date(invitation.expiresAt).getTime() < Date.now());
  if (expired) {
    throw new ChatStateError("This invitation has expired", "INVITATION_EXPIRED");
  }
  if (normalizeEmail(userEmail) !== invitation.emailNormalized) {
    throw new ChatPermissionError(
      `This invitation is for ${maskEmail(invitation.emailNormalized)}. You are signed in as a different user.`,
      "INVITATION_EMAIL_MISMATCH",
    );
  }
}

function access(value) {
  return value && typeof value === "object" ? value : null;
}

function can(accessObj, permission) {
  const resolved = access(accessObj);
  if (!resolved) return false;
  const perms = resolved.permissions || permissionsForRole(resolved.role);
  return perms?.[permission] === true;
}

/** Exposed so callers can ask about a permission without duplicating lookups. */
export function hasPermission(accessObj, permission) {
  return can(accessObj, permission);
}

/**
 * May this actor post into this channel?
 *
 * Beyond `chatWrite`, an `admin_only` channel (Announcements in Phase 2) is
 * restricted to the global operator, and archived channels are read-only.
 */
export function canPostToChannel(accessObj, channel) {
  if (!can(accessObj, "chatWrite")) return false;
  if (!channel) return false;
  if (channel.archivedAt) return false;
  if (channel.postingPolicy === "admin_only") {
    return access(accessObj)?.role === "admin";
  }
  return true;
}

/**
 * May this actor edit or delete this message? Authors manage their own
 * messages; only a moderator may touch someone else's.
 */
export function canModerateMessage(accessObj, message, { userId } = {}) {
  const resolved = access(accessObj);
  if (!resolved || !message) return false;
  if (can(resolved, "messagesModerate")) return true;
  const actorId = String(userId ?? resolved.userId ?? "");
  if (!actorId) return false;
  if (String(message.authorUserId ?? "") !== actorId) return false;
  return can(resolved, "filesDeleteOwn");
}

/**
 * May this actor wipe a channel's history?
 *
 * Three different "delete" verbs exist in the chat and this is the destructive
 * one:
 *   - POST /channels/:id/clear   → ChatRead.clearedAt, hides history from ONE
 *     viewer, changes nothing for anyone else;
 *   - DELETE /messages/:id       → soft delete, redacts one message but keeps
 *     the row so its convertedTo links survive;
 *   - POST /channels/:id/purge   → this one: the rows are gone, for everyone,
 *     with no undo.
 *
 * So it stays with `messagesModerate` (the operator) even inside a DM. Either
 * DM participant already has `clear` for their own copy; letting one of them
 * destroy the shared record would make the project's history depend on whoever
 * most wanted it gone.
 */
export function canPurgeChannel(accessObj) {
  return can(accessObj, "messagesModerate");
}

export function canInviteToProject(accessObj) {
  return can(accessObj, "membersInvite");
}

export function canManageMembers(accessObj) {
  return can(accessObj, "membersManage");
}

/**
 * Converting a message into a formal record.
 *
 * `item` (idea / problem / incident / decision) is open to collaborators — that
 * is the whole point of letting the team capture things as they come up.
 * Creating a request, a task, or a milestone comment changes the project's
 * commitments, so it stays with the owner and the operator.
 */
export function canConvertMessage(accessObj, target) {
  if (!CONVERT_TARGETS.includes(target)) return false;
  if (target === "item") return can(accessObj, "convertToItem");
  return can(accessObj, "convertToFormal");
}

/**
 * Validate and normalize a "Convert to…" request. Shape depends entirely on
 * `target`: an item needs a `kind` (idea/problem/incident/decision) and a
 * title; a task or a milestone comment need to say which milestone; a
 * request just needs a title. `body` falls back to the source message's own
 * text when the caller doesn't override it, so converting without retyping
 * anything still produces a meaningful record.
 *
 * The permission check lives here, not just at the call site — same
 * defense-in-depth reasoning as sanitizeChatMessagePayload's own
 * canPostToChannel check.
 */
export function sanitizeConvertPayload(
  target,
  input,
  accessObj,
  { sourceBody = "" } = {},
) {
  if (!canConvertMessage(accessObj, target)) {
    throw new ChatPermissionError("You cannot convert this message");
  }
  const payload = input && typeof input === "object" ? input : {};
  const body = cleanText(
    payload.body !== undefined ? payload.body : sourceBody,
    "Body",
    CHAT_LIMITS.itemBody,
  );

  if (target === "item") {
    if (!PROJECT_ITEM_KINDS.includes(payload.kind)) {
      throw new ChatValidationError("A valid item kind is required");
    }
    const severity = PROJECT_ITEM_SEVERITIES.includes(payload.severity)
      ? payload.severity
      : "low";
    const title = cleanText(payload.title, "Title", CHAT_LIMITS.itemTitle, {
      required: true,
    });
    return { target, kind: payload.kind, title, body, severity };
  }

  if (target === "task") {
    const milestoneId = cleanText(payload.milestoneId, "Milestone", 200, {
      required: true,
    });
    const title = cleanText(payload.title, "Title", CHAT_LIMITS.itemTitle, {
      required: true,
    });
    return { target, milestoneId, title, body };
  }

  if (target === "milestone_comment") {
    const milestoneId = cleanText(payload.milestoneId, "Milestone", 200, {
      required: true,
    });
    if (!body) throw new ChatValidationError("Message body is required");
    return { target, milestoneId, body };
  }

  // target === "request"
  const title = cleanText(payload.title, "Title", CHAT_LIMITS.itemTitle, {
    required: true,
  });
  return { target, title, body };
}

/**
 * Resolve `{ scope, days? }` into one absolute cutoff. Shared by everything the
 * app lets someone bulk-delete on a time window — channel history and a
 * person's own notification rows — so "older than a month" means the same
 * thing, and rejects the same nonsense, wherever it is offered.
 *
 * Carries NO permission check of its own: each caller gates on its own
 * authority (`sanitizePurgePayload` below for chat, `isAdmin` for the bell)
 * before asking what the window is.
 *
 * `now` is injectable so the cutoff is a pure function of its inputs — the
 * caller then audits and queries with the SAME instant, instead of one value
 * deciding what to delete and a second, slightly later one describing it.
 *
 * Returns `{ scope, days, before }`; `before` is null for scope "all", which is
 * what tells the caller to omit the createdAt filter entirely rather than build
 * an "everything before the epoch of now" range.
 */
export function resolvePurgeWindow(input, { now = new Date() } = {}) {
  const payload = input && typeof input === "object" ? input : {};
  const scope = payload.scope ?? "all";
  if (!PURGE_SCOPES.includes(scope)) {
    throw new ChatValidationError("A valid purge scope is required");
  }
  if (scope === "all") return { scope, days: null, before: null };

  const raw =
    payload.days === undefined || payload.days === null || payload.days === ""
      ? PURGE_DEFAULT_DAYS
      : Number(payload.days);
  if (!Number.isInteger(raw) || raw < 1 || raw > PURGE_MAX_DAYS) {
    throw new ChatValidationError(
      `Days must be a whole number between 1 and ${PURGE_MAX_DAYS}`,
    );
  }
  const before = new Date(now.getTime() - raw * 24 * 60 * 60 * 1000);
  return { scope, days: raw, before };
}

/**
 * A channel purge: the moderator gate, then the shared window above.
 *
 * The permission check runs FIRST and unconditionally, so a malformed payload
 * from someone with no right to purge comes back as 403 rather than as a 400
 * that confirms which scopes exist.
 */
export function sanitizePurgePayload(
  input,
  accessObj,
  { now = new Date() } = {},
) {
  if (!canPurgeChannel(accessObj)) {
    throw new ChatPermissionError(
      "You cannot delete this conversation's history",
    );
  }
  return resolvePurgeWindow(input, { now });
}

/**
 * Resolve `@Name` mentions against the channel's real membership.
 *
 * Members are matched by display name, longest first, so "@Ana Marija" wins
 * over "@Ana". Returns unique user ids in order of first appearance; anything
 * that does not match a member is ignored, which is what keeps mentions from
 * becoming a way to probe for other users.
 */
const WORD_CHAR = /[\p{L}\p{N}_]/u;

function isWordChar(char) {
  return typeof char === "string" && WORD_CHAR.test(char);
}

export function parseMentions(body, members) {
  if (typeof body !== "string" || !body || !Array.isArray(members)) return [];
  const candidates = members
    .map((member) => ({
      userId: String(member?.userId ?? member?._id ?? ""),
      name: typeof member?.name === "string" ? member.name.trim() : "",
    }))
    .filter((member) => member.userId && member.name)
    // Longest first so "@Ana Marija" is claimed before "@Ana" can match inside it.
    .sort((a, b) => b.name.length - a.name.length);
  if (candidates.length === 0) return [];

  const haystack = body.toLowerCase();
  const found = [];
  const seen = new Set();

  for (let i = haystack.indexOf("@"); i !== -1; i = haystack.indexOf("@", i + 1)) {
    // Skip the "@" inside an email address so a member named after a domain
    // cannot be mentioned by someone merely quoting an address.
    if (i > 0 && isWordChar(haystack[i - 1])) continue;

    for (const member of candidates) {
      const name = member.name.toLowerCase();
      if (!haystack.startsWith(name, i + 1)) continue;
      // The mention must end at a boundary: "@Ana" must not fire on "@Anabela".
      if (isWordChar(haystack[i + 1 + name.length])) continue;

      if (!seen.has(member.userId)) {
        seen.add(member.userId);
        found.push(member.userId);
      }
      // Consume the whole name so nothing shorter matches inside it.
      i += name.length;
      break;
    }
  }
  return found;
}

/**
 * Denormalized quote of the message being replied to. Copied on write because
 * the codebase has no populate convention — rendering must not need a lookup.
 */
export function buildReplyPreview(message) {
  if (!message || !message._id) return null;
  const body = typeof message.body === "string" ? message.body : "";
  return {
    messageId: String(message._id),
    authorName: typeof message.authorName === "string" ? message.authorName : "",
    body: body.slice(0, CHAT_LIMITS.replyPreview),
  };
}

function cleanText(value, field, maxLength, { required = false } = {}) {
  if (value === undefined || value === null) value = "";
  if (typeof value !== "string") {
    throw new ChatValidationError(`${field} must be a string`);
  }
  const trimmed = value.trim();
  if (required && !trimmed) {
    throw new ChatValidationError(`${field} is required`);
  }
  if (trimmed.length > maxLength) {
    throw new ChatValidationError(
      `${field} must be at most ${maxLength} characters`,
    );
  }
  return trimmed;
}

function sanitizeAttachments(input) {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) {
    throw new ChatValidationError("Attachments must be an array");
  }
  if (input.length > CHAT_LIMITS.attachments) {
    throw new ChatValidationError(
      `At most ${CHAT_LIMITS.attachments} attachments per message`,
    );
  }
  return input.map((raw) => {
    const url = cleanText(raw?.url, "Attachment url", 2000, { required: true });
    const type = raw?.type === "pdf" ? "pdf" : "image";
    const visibility = ATTACHMENT_VISIBILITIES.includes(raw?.visibility)
      ? raw.visibility
      : "project_shared";
    return {
      url,
      type,
      name: cleanText(raw?.name, "Attachment name", CHAT_LIMITS.attachmentName),
      visibility,
    };
  });
}

/**
 * Validate and normalize an inbound chat message.
 *
 * Everything the client sends is treated as a suggestion: mentions are
 * intersected with real membership, the reply target must live in the same
 * channel, and the flag must be a known value. The caller supplies `members`
 * (channel membership) and the already-loaded `replyToMessage`.
 */
export function sanitizeChatMessagePayload(
  input,
  { accessObj = null, channel = null, members = [], replyToMessage = null } = {},
) {
  const payload = input && typeof input === "object" ? input : {};

  if (channel && !canPostToChannel(accessObj, channel)) {
    throw new ChatPermissionError("You cannot post in this channel");
  }

  const body = cleanText(payload.body, "Message", CHAT_LIMITS.body);
  const attachments = sanitizeAttachments(payload.attachments);
  if (!body && attachments.length === 0) {
    throw new ChatValidationError("Message body or an attachment is required");
  }

  const flag = payload.flag === undefined || payload.flag === null
    ? "none"
    : payload.flag;
  if (!MESSAGE_FLAGS.includes(flag)) {
    throw new ChatValidationError("Invalid message flag");
  }

  let replyToMessageId = null;
  let replyToPreview = null;
  if (payload.replyToMessageId) {
    if (!replyToMessage) {
      throw new ChatValidationError("Replied message not found");
    }
    // Never trust the client's channel association: a reply must not be able to
    // pull a quote out of a conversation the author cannot see.
    if (
      channel &&
      String(replyToMessage.channelId ?? "") !== String(channel._id ?? "")
    ) {
      throw new ChatValidationError("Replied message is from another channel");
    }
    replyToMessageId = String(replyToMessage._id);
    replyToPreview = buildReplyPreview(replyToMessage);
  }

  const mentions = parseMentions(body, members).slice(0, CHAT_LIMITS.mentions);

  return { body, attachments, flag, replyToMessageId, replyToPreview, mentions };
}

/**
 * Validate a decision on an existing project item.
 *
 * Confirming is folded into the status change rather than being its own
 * action: an operator accepting a decision IS the operator co-signing it,
 * and separating the two invites the state where something reads "accepted"
 * with nobody's name against it — which is exactly the evidence value the
 * whole Decision record exists to provide.
 */
export function sanitizeProjectItemUpdate(input, accessObj) {
  if (!can(accessObj, "itemsApprove")) {
    throw new ChatPermissionError("You cannot decide on this item");
  }
  const payload = input && typeof input === "object" ? input : {};
  if (!PROJECT_ITEM_STATUSES.includes(payload.status)) {
    throw new ChatValidationError("A valid status is required");
  }
  return { status: payload.status, confirm: payload.status === "accepted" };
}

export const ITEM_REF_PREFIXES = Object.freeze({
  idea: "ID",
  problem: "P",
  incident: "I",
  decision: "D",
});

/**
 * Next human-readable reference for a project item, e.g. "D-041".
 * `lastRef` is the highest existing ref of the same kind in the same project.
 */
export function nextItemRef(kind, lastRef) {
  const prefix = ITEM_REF_PREFIXES[kind];
  if (!prefix) throw new ChatValidationError("Invalid project item kind");
  let last = 0;
  if (typeof lastRef === "string") {
    const match = lastRef.match(/^([A-Z]+)-(\d+)$/);
    if (match && match[1] === prefix) last = Number.parseInt(match[2], 10);
  }
  const next = Number.isFinite(last) && last > 0 ? last + 1 : 1;
  return `${prefix}-${String(next).padStart(3, "0")}`;
}

// Presence is derived from two polls touching the caller's own lastActiveAt:
// GET /chat/channels (15s, only while the chat UI is open) and
// GET /api/notifications (30s, running on every authenticated page). The
// threshold is 3x the SLOWER of the two, so someone reading their dashboard
// without the chat open still registers as online — which matters, because
// presence now suppresses email and push (lib/notification-policy.mjs) and a
// false "offline" would mean spamming someone who is sitting right there.
export const PRESENCE_ONLINE_THRESHOLD_MS = 90_000;

export function isUserOnline(lastActiveAt, now = new Date()) {
  if (!lastActiveAt) return false;
  const last = new Date(lastActiveAt).getTime();
  if (!Number.isFinite(last)) return false;
  return now.getTime() - last < PRESENCE_ONLINE_THRESHOLD_MS;
}

/** Business-facing label for the participant list — never "superadmin". */
export function displayRoleLabel(role, roleLabel = "") {
  const custom = typeof roleLabel === "string" ? roleLabel.trim() : "";
  if (custom) return custom;
  switch (role) {
    case "admin":
      return "Lead Developer / Product Owner";
    case "owner":
      return "Project Owner";
    case "project_admin":
      return "Project Admin";
    case "client_lead":
      return "Client Lead";
    case "collaborator":
      return "Collaborator";
    case "viewer":
      return "Viewer";
    default:
      return "";
  }
}

/**
 * Can this project role see an attachment marked with this visibility?
 * `project_shared` (the default) is visible to anyone who can read the
 * channel at all; `client_only` and `internal_team` narrow further within a
 * channel that collaborators, the owner, and the operator all share.
 */
export function canViewAttachment(role, visibility) {
  if (visibility === "internal_team") return role === "admin";
  if (visibility === "client_only") return role === "admin" || role === "owner";
  return true; // project_shared, or an unrecognized value, defaults open
}

/**
 * Escape a string for safe, literal use inside a RegExp — chat search is
 * free-text user input, and MongoDB's $regex takes it unescaped.
 */
export function escapeRegExp(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
