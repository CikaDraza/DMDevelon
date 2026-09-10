import ClientProject from "@/models/ClientProject";
import ProjectAuditLog from "@/models/ProjectAuditLog";
import ProjectMember from "@/models/ProjectMember";
import User from "@/models/User";

export const RESTORE_TARGET_STATUSES = Object.freeze([
  "planning",
  "on_hold",
  "in_progress",
]);

export class ProjectLifecycleError extends Error {
  constructor(
    message,
    { code = "PROJECT_LIFECYCLE_ERROR", statusCode = 400 } = {},
  ) {
    super(message);
    this.name = "ProjectLifecycleError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function lifecycleError(message, code, statusCode) {
  return new ProjectLifecycleError(message, { code, statusCode });
}

function actorSnapshot(actor) {
  return {
    actorUserId: String(actor._id),
    actorName: actor.name || actor.email || "Admin",
  };
}

function previousOwnerSnapshot(project) {
  return {
    previousOwnerUserId: project.clientUserId || null,
    previousOwnerName: project.clientName || "",
    previousOwnerEmail: project.clientEmail || "",
    previousOwnerAccountDeletedAt: project.ownerAccountDeletedAt || null,
  };
}

async function loadTargetOwner(ownerUserId, session) {
  const target = await User.findById(ownerUserId).session(session);
  if (!target) {
    throw lifecycleError("Owner account not found", "OWNER_NOT_FOUND", 404);
  }
  if (target.isAdmin === true) {
    throw lifecycleError(
      "A global admin cannot be assigned as the client owner",
      "ADMIN_OWNER_FORBIDDEN",
      409,
    );
  }
  return target;
}

async function loadValidCurrentOwner(project, session) {
  if (project.ownerAccountDeletedAt) return null;
  let owner = project.clientUserId
    ? await User.findById(project.clientUserId).session(session)
    : null;
  if (!owner && project.clientEmail) {
    owner = await User.findOne({ email: project.clientEmail }).session(session);
  }
  return owner && owner.isAdmin !== true ? owner : null;
}

async function applyOwnerAssignment({
  project,
  target,
  actor,
  session,
  now,
  nextStatus,
}) {
  const previousOwner = previousOwnerSnapshot(project);
  const membership = await ProjectMember.findOne({
    projectId: String(project._id),
    userId: String(target._id),
  }).session(session);
  const targetWasActiveCollaborator = membership?.status === "active";
  const sameOwner =
    !project.ownerAccountDeletedAt &&
    String(project.clientUserId || "") === String(target._id) &&
    project.clientName === target.name &&
    project.clientEmail === target.email;

  if (sameOwner && !targetWasActiveCollaborator) {
    return { changed: false, audit: null, membershipTransitioned: false };
  }

  if (targetWasActiveCollaborator) {
    membership.status = "removed";
    await membership.save({ session });
  }

  const hadActiveOwner = !project.ownerAccountDeletedAt && project.clientUserId;
  const eventType = hadActiveOwner
    ? "project.owner_transferred"
    : "project.owner_assigned";
  project.clientUserId = String(target._id);
  project.clientName = target.name || "";
  project.clientEmail = target.email || "";
  project.ownerAccountDeletedAt = null;
  project.events.push({
    type: "ownership_transferred",
    body: "Project ownership updated",
    actorName: actor.name || "Admin",
    createdAt: now,
  });

  return {
    changed: true,
    membershipTransitioned: targetWasActiveCollaborator,
    audit: {
      projectId: String(project._id),
      ...actorSnapshot(actor),
      targetUserId: String(target._id),
      targetEmail: target.email || "",
      eventType,
      metadata: {
        ...previousOwner,
        newOwnerUserId: String(target._id),
        newOwnerEmail: target.email || "",
        previousProjectStatus: project.status,
        newProjectStatus: nextStatus || project.status,
        targetWasActiveCollaborator,
        occurredAt: now,
      },
    },
  };
}

async function runLifecycleTransaction(work) {
  const session = await ClientProject.db.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (error) {
    if (
      /transaction numbers are only allowed|does not support transactions/i.test(
        String(error?.message || ""),
      )
    ) {
      throw lifecycleError(
        "Project recovery requires MongoDB transaction support",
        "TRANSACTION_REQUIRED",
        503,
      );
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

export async function restoreClientProject({
  projectId,
  status,
  ownerUserId,
  actor,
}) {
  if (!RESTORE_TARGET_STATUSES.includes(status)) {
    throw lifecycleError(
      "Restore status must be planning, on_hold, or in_progress",
      "INVALID_RESTORE_STATUS",
      400,
    );
  }

  return runLifecycleTransaction(async (session) => {
    const project = await ClientProject.findById(projectId).session(session);
    if (!project) {
      throw lifecycleError("Project not found", "PROJECT_NOT_FOUND", 404);
    }
    if (project.status !== "deleted") {
      throw lifecycleError(
        "Only a deleted project can be restored",
        "PROJECT_NOT_DELETED",
        409,
      );
    }

    const previousStatus = project.status;
    const now = new Date();
    const currentOwner = await loadValidCurrentOwner(project, session);
    let ownerResult = {
      changed: false,
      audit: null,
      membershipTransitioned: false,
    };
    if (ownerUserId) {
      const target = await loadTargetOwner(ownerUserId, session);
      ownerResult = await applyOwnerAssignment({
        project,
        target,
        actor,
        session,
        now,
        nextStatus: status,
      });
    } else if (!currentOwner) {
      throw lifecycleError(
        "A new owner is required before this project can be restored",
        "OWNER_REQUIRED",
        409,
      );
    }

    project.status = status;
    project.deletedAt = null;
    project.deletedByUserId = null;
    project.deletedByName = "";
    project.events.push({
      type: "project_restored",
      body: "Project restored",
      actorName: actor.name || "Admin",
      createdAt: now,
    });
    await project.save({ session });

    const audits = [
      ...(ownerResult.audit ? [ownerResult.audit] : []),
      {
        projectId: String(project._id),
        ...actorSnapshot(actor),
        targetUserId: project.clientUserId || null,
        targetEmail: project.clientEmail || "",
        eventType: "project.restored",
        metadata: {
          previousProjectStatus: previousStatus,
          newProjectStatus: status,
          newOwnerUserId: project.clientUserId || null,
          newOwnerEmail: project.clientEmail || "",
          targetWasActiveCollaborator:
            ownerResult.membershipTransitioned === true,
          occurredAt: now,
        },
      },
    ];
    await ProjectAuditLog.create(audits, { session, ordered: true });

    return {
      project,
      noOp: false,
      membershipTransitioned: ownerResult.membershipTransitioned,
      auditEventTypes: audits.map((audit) => audit.eventType),
    };
  });
}

export async function assignClientProjectOwner({
  projectId,
  ownerUserId,
  actor,
}) {
  return runLifecycleTransaction(async (session) => {
    const project = await ClientProject.findById(projectId).session(session);
    if (!project) {
      throw lifecycleError("Project not found", "PROJECT_NOT_FOUND", 404);
    }
    const target = await loadTargetOwner(ownerUserId, session);
    const now = new Date();
    const ownerResult = await applyOwnerAssignment({
      project,
      target,
      actor,
      session,
      now,
      nextStatus: project.status,
    });
    if (!ownerResult.changed) {
      return {
        project,
        noOp: true,
        membershipTransitioned: false,
        auditEventTypes: [],
      };
    }

    await project.save({ session });
    await ProjectAuditLog.create([ownerResult.audit], { session });
    return {
      project,
      noOp: false,
      membershipTransitioned: ownerResult.membershipTransitioned,
      auditEventTypes: [ownerResult.audit.eventType],
    };
  });
}
