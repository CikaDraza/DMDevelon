import { createHash, randomUUID } from "node:crypto";

export const PROPOSAL_STATUSES = Object.freeze([
  "draft",
  "sent",
  "changes_requested",
  "accepted",
  "rejected",
  "archived",
]);

export const PROPOSAL_VISIBLE_STATUSES = Object.freeze([
  "sent",
  "changes_requested",
  "accepted",
]);

export const PROPOSAL_KINDS = Object.freeze(["master", "phase"]);

export const PROPOSAL_TRANSITIONS = Object.freeze({
  draft: Object.freeze(["sent"]),
  sent: Object.freeze(["accepted", "changes_requested", "rejected"]),
  changes_requested: Object.freeze(["draft"]),
  accepted: Object.freeze(["archived"]),
  rejected: Object.freeze([]),
  archived: Object.freeze([]),
});

export const PROPOSAL_LIMITS = Object.freeze({
  title: 240,
  phaseLabel: 100,
  scope: 100_000,
  timeline: 500,
  budget: 500,
  milestoneTitle: 240,
  milestoneDescription: 20_000,
  githubBranch: 500,
  taskTitle: 240,
  taskDescription: 10_000,
  milestones: 200,
  tasksPerMilestone: 500,
});

/** Pure ownership helpers shared by API authorization and unit tests. */
export function ownsClientEntity(user, entity) {
  if (!user || !entity) return false;
  const userId = String(user._id || user.userId || "");
  return !!(
    (entity.clientUserId && String(entity.clientUserId) === userId) ||
    (entity.clientEmail && entity.clientEmail === user.email)
  );
}

export function canAccessClientEntity(user, entity) {
  return !!user && (user.isAdmin === true || ownsClientEntity(user, entity));
}

export function canPerformClientProposalAction(user, entity) {
  return !!user && user.isAdmin !== true && ownsClientEntity(user, entity);
}

const EDITABLE_STRING_FIELDS = Object.freeze([
  "title",
  "scope",
  "timeline",
  "budget",
]);

export class ProposalDomainError extends Error {
  constructor(message, { name, code, statusCode } = {}) {
    super(message);
    this.name = name || "ProposalDomainError";
    this.code = code || "PROPOSAL_DOMAIN_ERROR";
    this.statusCode = statusCode || 400;
  }
}

export class ProposalValidationError extends ProposalDomainError {
  constructor(message, code = "INVALID_PROPOSAL") {
    super(message, {
      name: "ProposalValidationError",
      code,
      statusCode: 400,
    });
  }
}

export class ProposalStateError extends ProposalDomainError {
  constructor(message, code = "INVALID_PROPOSAL_TRANSITION") {
    super(message, {
      name: "ProposalStateError",
      code,
      statusCode: 409,
    });
  }
}

function asPlainObject(value) {
  if (!value) return {};
  if (typeof value.toObject === "function") {
    return value.toObject({
      depopulate: true,
      getters: false,
      virtuals: false,
    });
  }
  return value;
}

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function cleanString(value, field, maxLength, { required = false } = {}) {
  if (value === undefined || value === null) value = "";
  if (typeof value !== "string") {
    throw new ProposalValidationError(`${field} must be a string`);
  }
  const cleaned = value.trim();
  if (required && !cleaned) {
    throw new ProposalValidationError(`${field} is required`);
  }
  if (cleaned.length > maxLength) {
    throw new ProposalValidationError(
      `${field} must not exceed ${maxLength} characters`,
      "PROPOSAL_FIELD_TOO_LARGE",
    );
  }
  return cleaned;
}

function cleanOrder(value, fallback, field) {
  if (value === undefined || value === null || value === "") return fallback;
  if (!Number.isInteger(value) || value < 0) {
    throw new ProposalValidationError(
      `${field} must be a non-negative integer`,
    );
  }
  return value;
}

function makeId(generateId, field) {
  const id = generateId();
  if (typeof id !== "string" || !id.trim()) {
    throw new ProposalValidationError(
      `ID generator returned an invalid ${field} id`,
    );
  }
  return id.trim();
}

function existingItemFor(incoming, index, existingItems) {
  const requestedId = incoming?._id;
  if (requestedId) {
    const byId = existingItems.find((item) => item?._id === requestedId);
    if (byId) return byId;
  }
  return existingItems[index] || null;
}

function sanitizeTaskPlan(tasks, existingTasks, generateId, milestoneIndex) {
  if (!Array.isArray(tasks)) {
    throw new ProposalValidationError(
      `milestonePlan[${milestoneIndex}].tasks must be an array`,
    );
  }
  if (tasks.length > PROPOSAL_LIMITS.tasksPerMilestone) {
    throw new ProposalValidationError(
      `milestonePlan[${milestoneIndex}] has too many tasks`,
      "PROPOSAL_PLAN_TOO_LARGE",
    );
  }

  const result = tasks.map((rawTask, taskIndex) => {
    if (!isObject(rawTask)) {
      throw new ProposalValidationError(
        `milestonePlan[${milestoneIndex}].tasks[${taskIndex}] must be an object`,
      );
    }
    const existing = existingItemFor(rawTask, taskIndex, existingTasks);
    const preservedId =
      existing && rawTask._id && existing._id === rawTask._id
        ? existing._id
        : existing && !rawTask._id
          ? existing._id
          : null;
    return {
      _id: preservedId || makeId(generateId, "task"),
      title: cleanString(
        rawTask.title,
        `milestonePlan[${milestoneIndex}].tasks[${taskIndex}].title`,
        PROPOSAL_LIMITS.taskTitle,
        { required: true },
      ),
      description: cleanString(
        rawTask.description,
        `milestonePlan[${milestoneIndex}].tasks[${taskIndex}].description`,
        PROPOSAL_LIMITS.taskDescription,
      ),
      order: cleanOrder(
        rawTask.order,
        taskIndex,
        `milestonePlan[${milestoneIndex}].tasks[${taskIndex}].order`,
      ),
    };
  });

  assertUniquePlanValues(
    result,
    "order",
    `milestonePlan[${milestoneIndex}] task order`,
  );
  assertUniquePlanValues(
    result,
    "_id",
    `milestonePlan[${milestoneIndex}] task id`,
  );
  return result;
}

function sanitizeMilestonePlan(plan, existingPlan, generateId) {
  if (!Array.isArray(plan)) {
    throw new ProposalValidationError("milestonePlan must be an array");
  }
  if (plan.length > PROPOSAL_LIMITS.milestones) {
    throw new ProposalValidationError(
      "milestonePlan has too many milestones",
      "PROPOSAL_PLAN_TOO_LARGE",
    );
  }

  const result = plan.map((rawMilestone, milestoneIndex) => {
    if (!isObject(rawMilestone)) {
      throw new ProposalValidationError(
        `milestonePlan[${milestoneIndex}] must be an object`,
      );
    }
    const existing = existingItemFor(
      rawMilestone,
      milestoneIndex,
      existingPlan,
    );
    const preservedId =
      existing && rawMilestone._id && existing._id === rawMilestone._id
        ? existing._id
        : existing && !rawMilestone._id
          ? existing._id
          : null;
    const rawTasks = Array.isArray(rawMilestone.tasks)
      ? rawMilestone.tasks
      : [];
    const existingTasks = Array.isArray(existing?.tasks) ? existing.tasks : [];
    return {
      _id: preservedId || makeId(generateId, "milestone"),
      title: cleanString(
        rawMilestone.title,
        `milestonePlan[${milestoneIndex}].title`,
        PROPOSAL_LIMITS.milestoneTitle,
        { required: true },
      ),
      description: cleanString(
        rawMilestone.description,
        `milestonePlan[${milestoneIndex}].description`,
        PROPOSAL_LIMITS.milestoneDescription,
      ),
      icon: cleanString(
        rawMilestone.icon || "Circle",
        `milestonePlan[${milestoneIndex}].icon`,
        100,
      ),
      githubBranch: cleanString(
        rawMilestone.githubBranch,
        `milestonePlan[${milestoneIndex}].githubBranch`,
        PROPOSAL_LIMITS.githubBranch,
      ),
      order: cleanOrder(
        rawMilestone.order,
        milestoneIndex,
        `milestonePlan[${milestoneIndex}].order`,
      ),
      tasks: sanitizeTaskPlan(
        rawTasks,
        existingTasks,
        generateId,
        milestoneIndex,
      ),
    };
  });

  assertUniquePlanValues(result, "order", "milestonePlan order");
  assertUniquePlanValues(result, "_id", "milestonePlan id");
  return result;
}

function assertUniquePlanValues(items, key, label) {
  const values = new Set();
  for (const item of items) {
    if (values.has(item[key])) {
      throw new ProposalValidationError(
        `${label} values must be unique`,
        "DUPLICATE_PROPOSAL_PLAN_VALUE",
      );
    }
    values.add(item[key]);
  }
}

/**
 * Return only admin-editable proposal fields. Server-owned identity, lifecycle,
 * ownership and timestamp fields in `input` are deliberately ignored.
 *
 * When `existing` is supplied, omitted fields and matching planner IDs are
 * preserved. IDs for genuinely new plan nodes always come from `generateId`.
 */
export function sanitizeProposalPayload(
  input,
  { existing = null, generateId = randomUUID } = {},
) {
  if (!isObject(input)) {
    throw new ProposalValidationError("Proposal payload must be an object");
  }
  if (typeof generateId !== "function") {
    throw new ProposalValidationError("generateId must be a function");
  }

  const current = asPlainObject(existing);
  const result = {};
  for (const field of EDITABLE_STRING_FIELDS) {
    const raw = hasOwn(input, field) ? input[field] : current[field];
    result[field] = cleanString(
      raw,
      field,
      PROPOSAL_LIMITS[field],
      field === "title" ? { required: true } : undefined,
    );
  }

  const phaseValue = hasOwn(input, "phaseNumber")
    ? input.phaseNumber
    : current.phaseNumber ?? 1;
  if (!Number.isInteger(phaseValue) || phaseValue < 1) {
    throw new ProposalValidationError(
      "phaseNumber must be a positive integer",
    );
  }
  result.phaseNumber = phaseValue;

  const fallbackLabel =
    phaseValue === 1 ? "Master Proposal" : `Faza ${phaseValue}`;
  result.phaseLabel = cleanString(
    hasOwn(input, "phaseLabel")
      ? input.phaseLabel
      : current.phaseLabel || fallbackLabel,
    "phaseLabel",
    PROPOSAL_LIMITS.phaseLabel,
    { required: true },
  );

  const existingPlan = Array.isArray(current.milestonePlan)
    ? current.milestonePlan
    : Array.isArray(current.milestones)
      ? current.milestones
      : [];
  const incomingPlan = hasOwn(input, "milestonePlan")
    ? input.milestonePlan
    : hasOwn(input, "milestones")
      ? input.milestones
      : existingPlan;
  result.milestonePlan = sanitizeMilestonePlan(
    incomingPlan || [],
    existingPlan,
    generateId,
  );

  return result;
}

export function canTransitionProposal(fromStatus, toStatus) {
  if (!PROPOSAL_STATUSES.includes(fromStatus)) return false;
  if (!PROPOSAL_STATUSES.includes(toStatus)) return false;
  return PROPOSAL_TRANSITIONS[fromStatus].includes(toStatus);
}

export function assertProposalTransition(fromStatus, toStatus) {
  if (!PROPOSAL_STATUSES.includes(fromStatus)) {
    throw new ProposalValidationError(
      `Unknown proposal status: ${fromStatus}`,
      "UNKNOWN_PROPOSAL_STATUS",
    );
  }
  if (!PROPOSAL_STATUSES.includes(toStatus)) {
    throw new ProposalValidationError(
      `Unknown proposal status: ${toStatus}`,
      "UNKNOWN_PROPOSAL_STATUS",
    );
  }
  if (!canTransitionProposal(fromStatus, toStatus)) {
    throw new ProposalStateError(
      `Proposal cannot transition from ${fromStatus} to ${toStatus}`,
    );
  }
  return true;
}

/**
 * Validate cancellation of an accepted follow-up phase without losing audit
 * history. The proposal document is archived; only its untouched operational
 * milestones are eligible to be removed from the live project.
 */
export function preparePhaseArchive(proposal, projectMilestones = []) {
  const source = asPlainObject(proposal);
  const proposalId = String(source._id || "").trim();
  if (!proposalId) {
    throw new ProposalValidationError("Proposal id is required");
  }
  const phaseNumber = Number(source.phaseNumber);
  if (
    source.kind !== "phase" ||
    !Number.isInteger(phaseNumber) ||
    phaseNumber <= 1
  ) {
    throw new ProposalStateError(
      "The Master Proposal cannot be deleted",
      "MASTER_PROPOSAL_IMMUTABLE",
    );
  }
  if (!["accepted", "archived"].includes(source.status)) {
    throw new ProposalStateError(
      "Only an accepted phase can be deleted",
      "PHASE_NOT_ACCEPTED",
    );
  }

  const linkedMilestones = (Array.isArray(projectMilestones)
    ? projectMilestones
    : []
  ).filter(
    (milestone) => String(milestone?.proposalId || "") === proposalId,
  );
  const startedMilestones = linkedMilestones.filter(
    (milestone) =>
      !!milestone?.workStartedAt ||
      ![undefined, null, "", "pending"].includes(milestone?.status) ||
      (Array.isArray(milestone?.tasks) &&
        milestone.tasks.some((task) =>
          task?.workStartedAt ||
          ![undefined, null, "", "pending"].includes(task?.status),
        )) ||
      (Array.isArray(milestone?.changeHistory) &&
        milestone.changeHistory.length > 0),
  );

  if (startedMilestones.length > 0) {
    throw new ProposalStateError(
      "This phase already has started or audited work and cannot be deleted",
      "PHASE_WORK_ALREADY_STARTED",
    );
  }

  return {
    proposalId,
    alreadyArchived: source.status === "archived",
    milestoneIds: linkedMilestones.map((milestone) => String(milestone._id)),
    milestoneCount: linkedMilestones.length,
  };
}

function cloneTaskPlan(task) {
  return {
    _id: String(task?._id || ""),
    title: String(task?.title || ""),
    description: String(task?.description || ""),
    order: Number.isInteger(task?.order) ? task.order : 0,
  };
}

function cloneMilestonePlan(milestone) {
  return {
    _id: String(milestone?._id || ""),
    title: String(milestone?.title || ""),
    description: String(milestone?.description || ""),
    icon: String(milestone?.icon || "Circle"),
    githubBranch: String(milestone?.githubBranch || ""),
    order: Number.isInteger(milestone?.order) ? milestone.order : 0,
    tasks: Array.isArray(milestone?.tasks)
      ? milestone.tasks.map(cloneTaskPlan)
      : [],
  };
}

export function snapshotProposal(
  proposal,
  { capturedAt = new Date(), capturedByUserId = null } = {},
) {
  const source = asPlainObject(proposal);
  const phaseNumber =
    Number.isInteger(source.phaseNumber) && source.phaseNumber > 0
      ? source.phaseNumber
      : 1;
  return {
    kind: PROPOSAL_KINDS.includes(source.kind)
      ? source.kind
      : phaseNumber === 1
        ? "master"
        : "phase",
    phaseNumber,
    phaseLabel: String(
      source.phaseLabel ||
        (phaseNumber === 1 ? "Master Proposal" : `Faza ${phaseNumber}`),
    ),
    version:
      Number.isInteger(source.version) && source.version > 0
        ? source.version
        : 1,
    status: PROPOSAL_STATUSES.includes(source.status)
      ? source.status
      : "draft",
    title: String(source.title || ""),
    scope: String(source.scope || ""),
    timeline: String(source.timeline || ""),
    budget: String(source.budget || ""),
    milestonePlan: Array.isArray(source.milestonePlan)
      ? source.milestonePlan.map(cloneMilestonePlan)
      : [],
    sentAt: source.sentAt ? new Date(source.sentAt) : null,
    capturedAt: new Date(capturedAt),
    capturedByUserId: capturedByUserId || null,
  };
}

/** Create a stable RFC-4122-shaped UUID from domain key parts. */
export function deterministicUuid(...parts) {
  if (!parts.length || parts.some((part) => part === undefined || part === null)) {
    throw new ProposalValidationError(
      "Deterministic UUID parts must be defined",
      "INVALID_MATERIALIZATION_KEY",
    );
  }
  const digest = createHash("sha256")
    .update(parts.map(String).join("\u001f"))
    .digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function sortedPlan(items) {
  return [...items]
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        (Number.isInteger(a.item?.order) ? a.item.order : a.index) -
          (Number.isInteger(b.item?.order) ? b.item.order : b.index) ||
        a.index - b.index,
    );
}

export function materializeMilestonePlan(
  proposal,
  { baseOrder = 0 } = {},
) {
  const source = asPlainObject(proposal);
  const proposalId = String(source._id || source.proposalId || "").trim();
  if (!proposalId) {
    throw new ProposalValidationError(
      "Proposal id is required for milestone materialization",
      "MISSING_PROPOSAL_ID",
    );
  }
  if (!Number.isInteger(baseOrder) || baseOrder < 0) {
    throw new ProposalValidationError(
      "baseOrder must be a non-negative integer",
    );
  }
  const phaseNumber =
    Number.isInteger(source.phaseNumber) && source.phaseNumber > 0
      ? source.phaseNumber
      : 1;
  const phaseLabel = String(
    source.phaseLabel ||
      (phaseNumber === 1 ? "Master Proposal" : `Faza ${phaseNumber}`),
  );
  const plan = Array.isArray(source.milestonePlan) ? source.milestonePlan : [];

  return sortedPlan(plan).map(({ item: milestone, index: sourceIndex }, index) => {
    const milestoneKey = String(milestone?._id || `index:${sourceIndex}`);
    const tasks = Array.isArray(milestone?.tasks) ? milestone.tasks : [];
    return {
      _id: deterministicUuid("project-proposal", proposalId, "milestone", milestoneKey),
      title: String(milestone?.title || "").trim(),
      description: String(milestone?.description || "").trim(),
      icon: String(milestone?.icon || "Circle"),
      order: baseOrder + index,
      status: "pending",
      githubBranch: String(milestone?.githubBranch || "").trim(),
      proposalId,
      phaseNumber,
      phaseLabel,
      revision: 1,
      changeHistory: [],
      tasks: sortedPlan(tasks).map(
        ({ item: task, index: taskSourceIndex }, taskIndex) => {
          const taskKey = String(task?._id || `index:${taskSourceIndex}`);
          return {
            _id: deterministicUuid(
              "project-proposal",
              proposalId,
              "milestone",
              milestoneKey,
              "task",
              taskKey,
            ),
            title: String(task?.title || "").trim(),
            description: String(task?.description || "").trim(),
            order: taskIndex,
            status: "pending",
          };
        },
      ),
    };
  });
}

/**
 * Compare an accepted plan with the project's current milestones. Exact
 * deterministic IDs are preferred. Existing legacy milestones already tagged
 * with the proposal are consumed positionally so a migration/retry cannot add
 * a second copy merely because their old IDs were retained.
 */
export function reconcileMilestoneMaterialization(
  existingMilestones,
  proposal,
  options = {},
) {
  const current = Array.isArray(existingMilestones) ? existingMilestones : [];
  const planned = materializeMilestonePlan(proposal, options);
  const proposalId = String(proposal?._id || proposal?.proposalId || "");
  const currentById = new Map(current.map((item) => [String(item?._id), item]));
  const tagged = current
    .filter((item) => String(item?.proposalId || "") === proposalId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const usedExistingIds = new Set();
  const matches = [];
  const unmatched = [];

  for (const plannedMilestone of planned) {
    const exact = currentById.get(String(plannedMilestone._id));
    if (exact) {
      usedExistingIds.add(String(exact._id));
      matches.push({ planned: plannedMilestone, existing: exact, exact: true });
    } else {
      unmatched.push(plannedMilestone);
    }
  }

  const legacyCandidates = tagged.filter(
    (item) => !usedExistingIds.has(String(item._id)),
  );
  const toInsert = [];
  unmatched.forEach((plannedMilestone, index) => {
    const legacy = legacyCandidates[index];
    if (legacy) {
      matches.push({
        planned: plannedMilestone,
        existing: legacy,
        exact: false,
      });
    } else {
      toInsert.push(plannedMilestone);
    }
  });

  return {
    proposalId,
    planned,
    matches,
    toInsert,
    complete: toInsert.length === 0,
  };
}

export function snapshotMilestone(milestone) {
  const source = asPlainObject(milestone);
  return {
    _id: String(source._id || ""),
    title: String(source.title || ""),
    description: String(source.description || ""),
    icon: String(source.icon || "Circle"),
    order: Number.isInteger(source.order) ? source.order : 0,
    status: ["pending", "in_progress", "completed"].includes(source.status)
      ? source.status
      : "pending",
    githubBranch: String(source.githubBranch || ""),
    tasks: Array.isArray(source.tasks)
      ? source.tasks.map((task) => ({
          _id: String(task?._id || ""),
          title: String(task?.title || ""),
          description: String(task?.description || ""),
          order: Number.isInteger(task?.order) ? task.order : 0,
          status: ["pending", "in_progress", "completed"].includes(task?.status)
            ? task.status
            : "pending",
        }))
      : [],
  };
}
