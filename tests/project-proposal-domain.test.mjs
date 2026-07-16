import test from "node:test";
import assert from "node:assert/strict";
import {
  PROPOSAL_VISIBLE_STATUSES,
  ProposalStateError,
  ProposalValidationError,
  assertProposalTransition,
  canAccessClientEntity,
  canPerformClientProposalAction,
  canTransitionProposal,
  deterministicUuid,
  materializeMilestonePlan,
  preparePhaseArchive,
  reconcileMilestoneMaterialization,
  sanitizeProposalPayload,
  snapshotMilestone,
  snapshotProposal,
} from "../lib/project-proposal-domain.mjs";

function idGenerator(prefix = "generated") {
  let value = 0;
  return () => `${prefix}-${++value}`;
}

const draftPayload = {
  title: "  Phase two  ",
  scope: "  **Scope**  ",
  timeline: "  4 weeks ",
  budget: "  EUR 5,000 ",
  phaseNumber: 2,
  phaseLabel: "  Faza 2 ",
  milestonePlan: [
    {
      title: "  API  ",
      description: "  Build endpoints  ",
      icon: "Server",
      githubBranch: " phase-2/api ",
      order: 0,
      tasks: [
        {
          title: "  Proposal routes ",
          description: "  CRUD and actions ",
          order: 0,
        },
      ],
    },
  ],
};

test("sanitizeProposalPayload allowlists, trims, and server-generates plan ids", () => {
  const result = sanitizeProposalPayload(
    {
      ...draftPayload,
      status: "accepted",
      projectId: "attacker-project",
      clientUserId: "attacker-client",
      acceptedAt: new Date(),
      createdByUserId: "attacker-admin",
    },
    { generateId: idGenerator() },
  );

  assert.deepEqual(Object.keys(result).sort(), [
    "budget",
    "milestonePlan",
    "phaseLabel",
    "phaseNumber",
    "scope",
    "timeline",
    "title",
  ]);
  assert.equal(result.title, "Phase two");
  assert.equal(result.scope, "**Scope**");
  assert.equal(result.milestonePlan[0]._id, "generated-1");
  assert.equal(result.milestonePlan[0].tasks[0]._id, "generated-2");
  assert.equal(result.milestonePlan[0].githubBranch, "phase-2/api");
});

test("sanitizeProposalPayload merges edits and preserves only matching existing ids", () => {
  const existing = sanitizeProposalPayload(draftPayload, {
    generateId: idGenerator("old"),
  });
  const result = sanitizeProposalPayload(
    {
      title: "Revised phase two",
      milestonePlan: [
        {
          ...existing.milestonePlan[0],
          title: "Revised API",
          tasks: [
            existing.milestonePlan[0].tasks[0],
            { _id: "untrusted-client-id", title: "New task", order: 1 },
          ],
        },
      ],
    },
    { existing, generateId: idGenerator("new") },
  );

  assert.equal(result.timeline, "4 weeks");
  assert.equal(result.phaseNumber, 2);
  assert.equal(result.milestonePlan[0]._id, "old-1");
  assert.equal(result.milestonePlan[0].tasks[0]._id, "old-2");
  assert.equal(result.milestonePlan[0].tasks[1]._id, "new-1");
});

test("proposal validation errors are identifiable HTTP 400 errors", () => {
  assert.throws(
    () =>
      sanitizeProposalPayload(
        {
          title: "Valid title",
          milestonePlan: [
            { title: "One", order: 0 },
            { title: "Two", order: 0 },
          ],
        },
        { generateId: idGenerator() },
      ),
    (error) =>
      error instanceof ProposalValidationError &&
      error.statusCode === 400 &&
      error.code === "DUPLICATE_PROPOSAL_PLAN_VALUE",
  );
  assert.throws(
    () =>
      sanitizeProposalPayload(
        { title: "Valid", milestonePlan: [{ title: "   " }] },
        { generateId: idGenerator() },
      ),
    (error) =>
      error instanceof ProposalValidationError && error.statusCode === 400,
  );
});

test("proposal state machine allows only documented transitions", () => {
  assert.equal(canTransitionProposal("draft", "sent"), true);
  assert.equal(canTransitionProposal("sent", "accepted"), true);
  assert.equal(canTransitionProposal("sent", "changes_requested"), true);
  assert.equal(canTransitionProposal("changes_requested", "draft"), true);
  assert.equal(canTransitionProposal("accepted", "archived"), true);
  assert.equal(canTransitionProposal("accepted", "draft"), false);
  assert.equal(canTransitionProposal("draft", "accepted"), false);
  assert.equal(assertProposalTransition("sent", "rejected"), true);
  assert.throws(
    () => assertProposalTransition("accepted", "sent"),
    (error) =>
      error instanceof ProposalStateError && error.statusCode === 409,
  );
});

test("client-visible statuses never include drafts", () => {
  assert.deepEqual(PROPOSAL_VISIBLE_STATUSES, [
    "sent",
    "changes_requested",
    "accepted",
  ]);
  assert.equal(PROPOSAL_VISIBLE_STATUSES.includes("draft"), false);
  assert.equal(PROPOSAL_VISIBLE_STATUSES.includes("rejected"), false);
});

test("accepted follow-up phase can be archived while all live work is untouched", () => {
  const result = preparePhaseArchive(
    {
      _id: "phase-2",
      kind: "phase",
      phaseNumber: 2,
      status: "accepted",
    },
    [
      {
        _id: "milestone-1",
        proposalId: "phase-2",
        status: "pending",
        tasks: [{ _id: "task-1", status: "pending" }],
        changeHistory: [],
      },
      { _id: "master-milestone", proposalId: "master-1" },
    ],
  );

  assert.deepEqual(result, {
    proposalId: "phase-2",
    alreadyArchived: false,
    milestoneIds: ["milestone-1"],
    milestoneCount: 1,
  });
});

test("master proposals and phases with started work cannot be archived", () => {
  assert.throws(
    () =>
      preparePhaseArchive({
        _id: "master-1",
        kind: "master",
        phaseNumber: 1,
        status: "accepted",
      }),
    (error) =>
      error instanceof ProposalStateError &&
      error.code === "MASTER_PROPOSAL_IMMUTABLE",
  );

  assert.throws(
    () =>
      preparePhaseArchive(
        {
          _id: "phase-2",
          kind: "phase",
          phaseNumber: 2,
          status: "accepted",
        },
        [
          {
            _id: "milestone-1",
            proposalId: "phase-2",
            status: "pending",
            tasks: [{ _id: "task-1", status: "in_progress" }],
          },
        ],
      ),
    (error) =>
      error instanceof ProposalStateError &&
      error.code === "PHASE_WORK_ALREADY_STARTED",
  );

  assert.throws(
    () =>
      preparePhaseArchive(
        {
          _id: "phase-2",
          kind: "phase",
          phaseNumber: 2,
          status: "accepted",
        },
        [
          {
            _id: "milestone-1",
            proposalId: "phase-2",
            status: "pending",
            tasks: [
              {
                _id: "task-1",
                status: "pending",
                workStartedAt: new Date(),
              },
            ],
          },
        ],
      ),
    (error) =>
      error instanceof ProposalStateError &&
      error.code === "PHASE_WORK_ALREADY_STARTED",
  );
});

test("archived phase replay can only remove untouched partial-failure leftovers", () => {
  const result = preparePhaseArchive(
    {
      _id: "phase-2",
      kind: "phase",
      phaseNumber: 2,
      status: "archived",
    },
    [
      {
        _id: "milestone-1",
        proposalId: "phase-2",
        status: "pending",
      },
    ],
  );

  assert.equal(result.alreadyArchived, true);
  assert.deepEqual(result.milestoneIds, ["milestone-1"]);

  assert.throws(
    () =>
      preparePhaseArchive(
        {
          _id: "phase-2",
          kind: "phase",
          phaseNumber: 2,
          status: "archived",
        },
        [
          {
            _id: "milestone-1",
            proposalId: "phase-2",
            status: "pending",
            workStartedAt: new Date(),
          },
        ],
      ),
    (error) =>
      error instanceof ProposalStateError &&
      error.code === "PHASE_WORK_ALREADY_STARTED",
  );
});

test("ownership permits only the owner to perform client proposal actions", () => {
  const project = {
    clientUserId: "client-1",
    clientEmail: "owner@example.com",
  };
  const ownerById = { _id: "client-1", email: "new@example.com" };
  const legacyOwnerByEmail = {
    _id: "client-2",
    email: "owner@example.com",
  };
  const stranger = { _id: "client-3", email: "other@example.com" };
  const admin = { _id: "admin-1", email: "admin@example.com", isAdmin: true };

  assert.equal(canAccessClientEntity(ownerById, project), true);
  assert.equal(canAccessClientEntity(legacyOwnerByEmail, project), true);
  assert.equal(canAccessClientEntity(stranger, project), false);
  assert.equal(canAccessClientEntity(admin, project), true);
  assert.equal(canPerformClientProposalAction(ownerById, project), true);
  assert.equal(canPerformClientProposalAction(admin, project), false);
  assert.equal(canPerformClientProposalAction(stranger, project), false);
});

test("snapshotProposal is a detached immutable-value snapshot", () => {
  const source = {
    _id: "proposal-1",
    kind: "phase",
    phaseNumber: 2,
    phaseLabel: "Faza 2",
    version: 3,
    status: "sent",
    title: "Phase",
    scope: "Original",
    timeline: "4 weeks",
    budget: "5000",
    sentAt: new Date("2026-01-01T00:00:00.000Z"),
    milestonePlan: [
      {
        _id: "plan-m1",
        title: "API",
        tasks: [{ _id: "plan-t1", title: "Routes", order: 0 }],
      },
    ],
  };
  const snapshot = snapshotProposal(source, {
    capturedAt: new Date("2026-01-02T00:00:00.000Z"),
    capturedByUserId: "admin-1",
  });

  source.milestonePlan[0].title = "Mutated";
  source.milestonePlan[0].tasks[0].title = "Mutated task";
  assert.equal(snapshot.milestonePlan[0].title, "API");
  assert.equal(snapshot.milestonePlan[0].tasks[0].title, "Routes");
  assert.equal(snapshot.capturedByUserId, "admin-1");
  assert.equal(snapshot.capturedAt.toISOString(), "2026-01-02T00:00:00.000Z");
});

test("materializeMilestonePlan creates deterministic, tagged operational copies", () => {
  const proposal = {
    _id: "proposal-2",
    phaseNumber: 2,
    phaseLabel: "Faza 2",
    milestonePlan: [
      {
        _id: "plan-m2",
        title: "UI",
        description: "New screens",
        icon: "Palette",
        githubBranch: "phase-2/ui",
        order: 7,
        tasks: [
          {
            _id: "plan-t2",
            title: "Proposal card",
            description: "Client view",
            order: 9,
          },
        ],
      },
    ],
  };

  const first = materializeMilestonePlan(proposal, { baseOrder: 4 });
  const second = materializeMilestonePlan(proposal, { baseOrder: 4 });
  assert.deepEqual(first, second);
  assert.match(first[0]._id, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(first[0].proposalId, "proposal-2");
  assert.equal(first[0].phaseNumber, 2);
  assert.equal(first[0].phaseLabel, "Faza 2");
  assert.equal(first[0].revision, 1);
  assert.equal(first[0].order, 4);
  assert.equal(first[0].status, "pending");
  assert.equal(first[0].tasks[0].status, "pending");
  assert.notEqual(first[0], proposal.milestonePlan[0]);
  assert.equal(
    first[0]._id,
    deterministicUuid(
      "project-proposal",
      "proposal-2",
      "milestone",
      "plan-m2",
    ),
  );
});

test("reconciliation inserts only missing milestones and accepts legacy tagged ids", () => {
  const proposal = {
    _id: "proposal-3",
    phaseNumber: 3,
    phaseLabel: "Faza 3",
    milestonePlan: [
      { _id: "one", title: "One", order: 0 },
      { _id: "two", title: "Two", order: 1 },
    ],
  };
  const planned = materializeMilestonePlan(proposal, { baseOrder: 5 });
  const partial = reconcileMilestoneMaterialization(
    [planned[0]],
    proposal,
    { baseOrder: 5 },
  );
  assert.equal(partial.complete, false);
  assert.deepEqual(partial.toInsert.map((item) => item._id), [planned[1]._id]);

  const legacy = reconcileMilestoneMaterialization(
    [
      { _id: "old-one", proposalId: "proposal-3", order: 5 },
      { _id: "old-two", proposalId: "proposal-3", order: 6 },
    ],
    proposal,
    { baseOrder: 5 },
  );
  assert.equal(legacy.complete, true);
  assert.equal(legacy.toInsert.length, 0);
  assert.equal(legacy.matches.every((match) => !match.exact), true);
});

test("snapshotMilestone keeps only bounded editable fields", () => {
  const snapshot = snapshotMilestone({
    _id: "milestone-1",
    title: "Build",
    proposalId: "proposal-1",
    changeHistory: [{ secret: "large recursive history" }],
    tasks: [
      {
        _id: "task-1",
        title: "Code",
        status: "completed",
        unrelated: "ignored",
      },
    ],
    unrelated: "ignored",
  });

  assert.equal(snapshot.proposalId, undefined);
  assert.equal(snapshot.changeHistory, undefined);
  assert.equal(snapshot.unrelated, undefined);
  assert.equal(snapshot.tasks[0].unrelated, undefined);
  assert.equal(snapshot.tasks[0].status, "completed");
});

test("master revision and phase acceptance append once to one project", () => {
  const project = { _id: "project-one", milestones: [] };
  const masterDraft = sanitizeProposalPayload(
    {
      title: "Master build",
      phaseNumber: 1,
      phaseLabel: "Master Proposal",
      milestonePlan: [{ title: "Foundation", order: 0 }],
    },
    { generateId: idGenerator("master-plan") },
  );
  let master = {
    _id: "master-proposal",
    kind: "master",
    status: "draft",
    version: 1,
    ...masterDraft,
  };

  assertProposalTransition(master.status, "sent");
  master = { ...master, status: "sent" };
  const sentV1 = snapshotProposal(master);
  assertProposalTransition(master.status, "changes_requested");
  master = { ...master, status: "changes_requested" };
  assertProposalTransition(master.status, "draft");
  master = {
    ...master,
    ...sanitizeProposalPayload(
      { title: "Revised master build" },
      { existing: master, generateId: idGenerator("revised") },
    ),
    status: "draft",
    version: 2,
  };
  assertProposalTransition(master.status, "sent");
  master = { ...master, status: "sent" };
  assertProposalTransition(master.status, "accepted");
  master = { ...master, status: "accepted" };
  project.milestones.push(...materializeMilestonePlan(master));

  const phase = {
    _id: "phase-two-proposal",
    kind: "phase",
    status: "accepted",
    version: 1,
    ...sanitizeProposalPayload(
      {
        title: "Phase two",
        phaseNumber: 2,
        phaseLabel: "Faza 2",
        milestonePlan: [{ title: "Expansion", order: 0 }],
      },
      { generateId: idGenerator("phase-plan") },
    ),
  };
  const phaseReconciliation = reconcileMilestoneMaterialization(
    project.milestones,
    phase,
  );
  project.milestones.push(...phaseReconciliation.toInsert);
  const replay = reconcileMilestoneMaterialization(project.milestones, phase);

  assert.equal(project._id, "project-one");
  assert.equal(project.milestones.length, 2);
  assert.deepEqual(
    project.milestones.map((milestone) => milestone.phaseNumber),
    [1, 2],
  );
  assert.equal(replay.toInsert.length, 0);
  project.milestones[0].title = "Operational title changed";
  assert.equal(sentV1.milestonePlan[0].title, "Foundation");
});
