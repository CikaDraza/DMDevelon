// Allowlist projections for anything leaving the API towards a project member.
//
// The rule this file exists to enforce: financial and internal fields are never
// *removed* from a response — they never enter it. The tempting alternative
//
//     const project = await getProject(id);
//     if (!canViewFinance) { delete project.budget; }
//
// breaks the day someone adds a new commercial field to the model and forgets
// the delete list. Here, a new field on ClientProject stays invisible to
// collaborators until it is explicitly added to an allowlist below.
//
// Owners and admins keep receiving the full document, so nothing about the
// existing client experience changes.

import { maskEmail, displayRoleLabel } from "./chat-domain.mjs";

function asPlainObject(value) {
  if (!value) return {};
  if (typeof value.toObject === "function") {
    return value.toObject({ depopulate: true, getters: false, virtuals: false });
  }
  return value;
}

function pick(source, keys) {
  const out = {};
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

const TASK_FIELDS = Object.freeze([
  "_id",
  "title",
  "description",
  "order",
  "status",
]);

// Note what is absent and must stay absent: `proposalId`, `revision` and
// `changeHistory`. Those disclose that a commercial proposal exists, which
// revision it is on and what was renegotiated — the existence of a proposal is
// itself information a collaborator has no claim to.
const MILESTONE_FIELDS = Object.freeze([
  "_id",
  "title",
  "description",
  "icon",
  "order",
  "status",
  "githubBranch",
  "phaseLabel",
  "phaseNumber",
]);

// Absent by design: `clientEmail`, `clientSlug`, `clientUserId`, `requestId`,
// `linkedProjectId`, `archivedProposalIds`, `events`, `deletedBy*`.
const PROJECT_FIELDS = Object.freeze([
  "_id",
  "title",
  "description",
  "requirements",
  "status",
  "coverImageUrl",
  "category",
  "color",
  "githubRepoUrl",
  "livePreviewUrl",
  "createdAt",
  "updatedAt",
]);

export function serializeTaskForMember(task) {
  return pick(asPlainObject(task), TASK_FIELDS);
}

export function serializeMilestoneForMember(milestone) {
  const plain = asPlainObject(milestone);
  const out = pick(plain, MILESTONE_FIELDS);
  out.tasks = Array.isArray(plain.tasks)
    ? plain.tasks.map(serializeTaskForMember)
    : [];
  return out;
}

/**
 * The projection an invited collaborator or viewer receives — the project as a
 * plan of work, with no commercial surface.
 *
 * Used for BOTH the list and the detail endpoint. Lists are the more common
 * leak: it is easy to remember the detail route and forget that
 * `GET /client-projects` returns the same documents.
 */
export function serializeProjectForMember(project) {
  const plain = asPlainObject(project);
  const out = pick(plain, PROJECT_FIELDS);
  out.milestones = Array.isArray(plain.milestones)
    ? plain.milestones.map(serializeMilestoneForMember)
    : [];
  return out;
}

/**
 * Choose the projection from the resolved access.
 *
 * Only the owner and the operator get the raw document — that keeps the
 * existing client experience byte-for-byte unchanged. Every other role,
 * including a future client_lead, goes through the allowlist; when client_lead
 * is switched on it gets a finance-inclusive serializer added explicitly here
 * rather than inheriting the full document by accident.
 */
export function serializeProjectForAccess(project, accessObj) {
  const role = accessObj?.role;
  if (role === "admin" || role === "owner") return project;
  return serializeProjectForMember(project);
}

/**
 * Participant entry for the member list. A private email address is not part
 * of what a project shares with everyone in it, so it is opt-in and only the
 * owner and the operator get it.
 */
export function serializeMemberPublic(
  member,
  { includeEmail = false, user = null, isOnline = false } = {},
) {
  const plain = asPlainObject(member);
  const account = asPlainObject(user);
  const out = {
    _id: plain._id,
    userId: plain.userId ?? account._id ?? null,
    name: account.name || plain.name || "",
    image: account.image || "",
    role: plain.role || "",
    roleLabel: displayRoleLabel(plain.role, plain.roleLabel),
    status: plain.status || "active",
    joinedAt: plain.joinedAt ?? null,
    isOnline: Boolean(isOnline),
  };
  if (includeEmail) out.email = account.email || plain.email || "";
  return out;
}

/**
 * Pending invitation as shown to someone who may manage the team. The token
 * hash never leaves the server, and there is no way back from this payload to
 * a usable invitation link.
 */
export function serializeInvitationForManager(invitation) {
  const plain = asPlainObject(invitation);
  return {
    _id: plain._id,
    email: plain.emailNormalized || "",
    intendedRole: plain.intendedRole || "",
    intendedRoleLabel: displayRoleLabel(plain.intendedRole, plain.roleLabel),
    invitedByName: plain.invitedByName || "",
    status: plain.status || "pending",
    createdAt: plain.createdAt ?? null,
    expiresAt: plain.expiresAt ?? null,
  };
}

/**
 * What the /invite landing page may show *before* the invitation is accepted.
 *
 * Anyone holding the link can read this, so it carries only enough to decide
 * whether to accept: which project, who invited, which role, and a masked hint
 * of the address the invitation is bound to. `status` is included so the page
 * can render "this invitation was revoked/already used" instead of a generic
 * error — `expiresAt` lets it detect expiry itself without a separate check.
 */
export function serializeInvitationPreview(invitation, project) {
  const plain = asPlainObject(invitation);
  const projectPlain = asPlainObject(project);
  return {
    projectName: projectPlain.title || "",
    inviterName: plain.invitedByName || "",
    intendedRole: plain.intendedRole || "",
    intendedRoleLabel: displayRoleLabel(plain.intendedRole, plain.roleLabel),
    maskedEmail: maskEmail(plain.emailNormalized),
    personalMessage: plain.personalMessage || "",
    status: plain.status || "pending",
    expiresAt: plain.expiresAt ?? null,
    requiresAuthentication: true,
  };
}
