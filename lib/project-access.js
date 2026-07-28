// Central authorization policy for the Project Communication Hub.
//
// This is the ONLY place that turns "this user, this project" into an access
// decision. Endpoints must ask for a permission key (requireProjectPermission),
// never branch on a role name directly — that is what keeps a new resource
// from accidentally trusting a role that was never meant to see it.
//
// The decision itself (resolveRoleFromFacts) is a pure function in
// lib/chat-domain.mjs and is unit tested there without a database. This file
// is the thin, DB-touching shell around it: it loads the one ProjectMember row
// that matters and defers to the pure function for the actual call.
import ProjectMember from "@/models/ProjectMember";
import { canAccessClientEntity } from "@/lib/project-proposal-domain.mjs";
import {
  permissionsForRole,
  resolveRoleFromFacts,
  restrictForClosedProject,
} from "@/lib/chat-domain.mjs";

export class ProjectAccessError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ProjectAccessError";
    this.status = status;
    this.statusCode = status;
  }
}

/**
 * No relationship to the project at all — including a non-existent project,
 * or a removed/suspended membership. Deliberately the same response as "this
 * project does not exist": existence is not disclosed to someone with no
 * claim to it.
 */
export class ProjectNotFoundError extends ProjectAccessError {
  constructor(message = "Not found") {
    super(message, 404);
    this.name = "ProjectNotFoundError";
  }
}

/**
 * A real relationship to the project (owner, admin, or an active membership),
 * but not the specific permission being asked for. This is the "collaborator
 * gets 200 for the project and 403 for the proposal" case.
 */
export class ProjectForbiddenError extends ProjectAccessError {
  constructor(message = "Forbidden") {
    super(message, 403);
    this.name = "ProjectForbiddenError";
  }
}

/**
 * Resolve what `user` may do on `project`.
 *
 * Resolution order mirrors the plan's matrix: a global admin is checked
 * first, then the existing client-ownership rule (canAccessClientEntity,
 * unchanged and untouched by this module), then a durable ProjectMember row.
 * Anyone else gets `role: null` and no permissions.
 *
 * `project` and `user` are expected to already be loaded documents (or plain
 * objects with the same shape) — this function does not fetch the project
 * itself, so a caller that got a 404 from `Model.findById` never even reaches
 * here with a real project.
 *
 * Permissions are then passed through `restrictForClosedProject`, which masks
 * everything but read access and leaving down to nothing when the project's
 * client has hard-deleted their account (`ClientProject.ownerAccountDeletedAt`).
 * This happens HERE, in the one place every endpoint already goes through —
 * not as something each new Communication Hub endpoint has to remember to
 * check on its own.
 */
export async function resolveProjectAccess(user, project) {
  if (!user || !project) {
    return { role: null, permissions: permissionsForRole(null), membership: null };
  }

  const isAdmin = user.isAdmin === true;
  const isOwner = !isAdmin && canAccessClientEntity(user, project);

  let membership = null;
  if (!isAdmin && !isOwner) {
    membership = await ProjectMember.findOne({
      projectId: String(project._id),
      userId: String(user._id),
      status: "active",
    });
  }

  const role = resolveRoleFromFacts({ isAdmin, isOwner, membership });
  const permissions = restrictForClosedProject(permissionsForRole(role), {
    role,
    project,
  });
  return {
    role,
    permissions,
    membership: membership || null,
  };
}

/**
 * Resolve access and enforce one permission in a single call — what almost
 * every endpoint actually wants.
 *
 *   const project = await ClientProject.findById(id);
 *   const access = await requireProjectPermission(user, project, "chatWrite");
 *   // access.role, access.permissions, access.membership are now available
 *   // for the handler to act on and to pick a serializer with.
 *
 * Throws ProjectNotFoundError (404) when there is no relationship to the
 * project at all, or ProjectForbiddenError (403) when there is a relationship
 * but not this permission. Both errors carry `.status`/`.statusCode`, which
 * the route's existing `errorResponse(error, label)` already understands —
 * no new error handling is needed at the call site.
 */
export async function requireProjectPermission(user, project, permission) {
  const access = await resolveProjectAccess(user, project);
  if (access.role === null) {
    throw new ProjectNotFoundError();
  }
  if (access.permissions[permission] !== true) {
    throw new ProjectForbiddenError();
  }
  return access;
}
