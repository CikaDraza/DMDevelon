import test from "node:test";
import assert from "node:assert/strict";
import { permissionsForRole } from "../lib/chat-domain.mjs";
import {
  serializeInvitationForManager,
  serializeInvitationPreview,
  serializeMemberPublic,
  serializeMilestoneForMember,
  serializeProjectForAccess,
  serializeProjectForMember,
} from "../lib/project-serializers.mjs";

function accessFor(role) {
  return { role, permissions: permissionsForRole(role) };
}

// A project document carrying every field a collaborator must not receive.
function projectFixture() {
  return {
    _id: "p-1",
    title: "Psihointegritet",
    description: "Digital centre",
    requirements: "Booking, blog",
    status: "in_progress",
    coverImageUrl: "https://cdn/cover.png",
    category: "web",
    color: "blue",
    githubRepoUrl: "https://github.com/x/y",
    livePreviewUrl: "https://example.com",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
    // --- must never reach a collaborator ---
    clientUserId: "u-owner",
    clientEmail: "anja@example.com",
    clientSlug: "anja",
    requestId: "req-1",
    linkedProjectId: "proj-9",
    archivedProposalIds: ["prop-1"],
    deletedByUserId: null,
    deletedByName: "",
    events: [{ _id: "e1", body: "Proposal accepted", actorName: "Milan" }],
    milestones: [
      {
        _id: "m-1",
        title: "Discovery",
        description: "Research",
        icon: "Circle",
        order: 0,
        status: "in_progress",
        githubBranch: "feat/discovery",
        phaseLabel: "Phase 1",
        phaseNumber: 1,
        // --- must never reach a collaborator ---
        proposalId: "prop-1",
        revision: 3,
        workStartedAt: "2026-01-05T00:00:00.000Z",
        changeHistory: [
          { _id: "c1", changeSummary: "Rebated price by 15%", before: {}, after: {} },
        ],
        tasks: [
          {
            _id: "t-1",
            title: "Interviews",
            description: "Talk to therapists",
            order: 0,
            status: "completed",
            workStartedAt: "2026-01-06T00:00:00.000Z",
          },
        ],
      },
    ],
  };
}

// The whole point of an allowlist is that a forgotten field is absent, not
// null — a null still discloses that the field (and the concept) exists.
const FORBIDDEN_PROJECT_KEYS = [
  "clientUserId",
  "clientEmail",
  "clientSlug",
  "requestId",
  "linkedProjectId",
  "archivedProposalIds",
  "events",
  "deletedByUserId",
  "deletedByName",
];

const FORBIDDEN_MILESTONE_KEYS = [
  "proposalId",
  "revision",
  "changeHistory",
  "workStartedAt",
];

test("a member projection omits commercial and internal keys entirely", () => {
  const out = serializeProjectForMember(projectFixture());
  for (const key of FORBIDDEN_PROJECT_KEYS) {
    assert.ok(!(key in out), `expected key "${key}" to be absent, not null`);
  }
});

test("a member projection omits milestone proposal linkage entirely", () => {
  const out = serializeProjectForMember(projectFixture());
  const milestone = out.milestones[0];
  for (const key of FORBIDDEN_MILESTONE_KEYS) {
    assert.ok(
      !(key in milestone),
      `expected milestone key "${key}" to be absent, not null`,
    );
  }
});

test("a member still sees the plan of work", () => {
  const out = serializeProjectForMember(projectFixture());
  assert.equal(out.title, "Psihointegritet");
  assert.equal(out.status, "in_progress");
  assert.equal(out.milestones.length, 1);
  assert.equal(out.milestones[0].title, "Discovery");
  assert.equal(out.milestones[0].tasks.length, 1);
  assert.equal(out.milestones[0].tasks[0].title, "Interviews");
});

test("task projection drops the deletion-safety marker", () => {
  const out = serializeProjectForMember(projectFixture());
  assert.ok(!("workStartedAt" in out.milestones[0].tasks[0]));
});

test("a project with no milestones serializes to an empty list", () => {
  const out = serializeProjectForMember({ _id: "p-2", title: "Empty" });
  assert.deepEqual(out.milestones, []);
});

test("mongoose documents are converted before picking", () => {
  const raw = projectFixture();
  const doc = { toObject: () => raw };
  const out = serializeProjectForMember(doc);
  assert.equal(out.title, "Psihointegritet");
  assert.ok(!("clientEmail" in out));
});

test("milestone serializer tolerates a missing task array", () => {
  const out = serializeMilestoneForMember({ _id: "m", title: "T" });
  assert.deepEqual(out.tasks, []);
});

// --- Access-driven projection ----------------------------------------------

test("owner and operator keep the untouched document", () => {
  const project = projectFixture();
  assert.equal(serializeProjectForAccess(project, accessFor("owner")), project);
  assert.equal(serializeProjectForAccess(project, accessFor("admin")), project);
});

test("every other role goes through the allowlist", () => {
  const project = projectFixture();
  for (const role of ["collaborator", "viewer", "client_lead", "project_admin"]) {
    const out = serializeProjectForAccess(project, accessFor(role));
    assert.notEqual(out, project, `role ${role} received the raw document`);
    assert.ok(!("clientEmail" in out));
    assert.ok(!("proposalId" in out.milestones[0]));
  }
});

test("a missing access object still gets the narrow projection", () => {
  const out = serializeProjectForAccess(projectFixture(), null);
  assert.ok(!("clientEmail" in out));
});

// --- Members ----------------------------------------------------------------

const memberFixture = {
  _id: "pm-1",
  userId: "u-2",
  role: "collaborator",
  roleLabel: "Designer",
  status: "active",
  joinedAt: "2026-03-01T00:00:00.000Z",
};

const memberUser = {
  _id: "u-2",
  name: "Ana",
  email: "ana@example.com",
  image: "https://cdn/ana.png",
  password: "hashed",
  sessionVersion: 4,
};

test("a participant entry hides the private email by default", () => {
  const out = serializeMemberPublic(memberFixture, { user: memberUser });
  assert.equal(out.name, "Ana");
  assert.equal(out.roleLabel, "Designer");
  assert.ok(!("email" in out), "email must be absent unless explicitly included");
});

test("only an explicit opt-in exposes the email", () => {
  const out = serializeMemberPublic(memberFixture, {
    user: memberUser,
    includeEmail: true,
  });
  assert.equal(out.email, "ana@example.com");
});

test("a participant entry never carries account internals", () => {
  const out = serializeMemberPublic(memberFixture, {
    user: memberUser,
    includeEmail: true,
  });
  assert.ok(!("password" in out));
  assert.ok(!("sessionVersion" in out));
});

test("a member without a custom label falls back to the role name", () => {
  const out = serializeMemberPublic(
    { ...memberFixture, roleLabel: "" },
    { user: memberUser },
  );
  assert.equal(out.roleLabel, "Collaborator");
});

test("isOnline defaults to false and passes through when given", () => {
  const offline = serializeMemberPublic(memberFixture, { user: memberUser });
  assert.equal(offline.isOnline, false);
  const online = serializeMemberPublic(memberFixture, {
    user: memberUser,
    isOnline: true,
  });
  assert.equal(online.isOnline, true);
});

// --- Invitations ------------------------------------------------------------

const invitationFixture = {
  _id: "inv-1",
  projectId: "p-1",
  emailNormalized: "ana@example.com",
  intendedRole: "collaborator",
  invitedByName: "Milan",
  personalMessage: "Join us",
  tokenHash: "e3b0c44298fc1c149afbf4c8996fb924",
  status: "pending",
  createdAt: "2026-03-01T00:00:00.000Z",
  expiresAt: "2026-03-08T00:00:00.000Z",
};

test("the pre-acceptance preview masks the address and hides the token", () => {
  const out = serializeInvitationPreview(invitationFixture, {
    title: "Psihointegritet",
    clientEmail: "anja@example.com",
  });
  assert.equal(out.projectName, "Psihointegritet");
  assert.equal(out.inviterName, "Milan");
  assert.equal(out.maskedEmail, "a***@example.com");
  assert.equal(out.requiresAuthentication, true);
  assert.equal(out.status, "pending");
  assert.ok(!("tokenHash" in out));
  assert.ok(!("emailNormalized" in out));
});

test("the preview reports a dead invitation's status so the page can explain it", () => {
  const revoked = serializeInvitationPreview(
    { ...invitationFixture, status: "revoked" },
    { title: "P" },
  );
  assert.equal(revoked.status, "revoked");
});

test("the preview discloses nothing about the project beyond its name", () => {
  const out = serializeInvitationPreview(invitationFixture, projectFixture());
  assert.ok(!("milestones" in out));
  assert.ok(!("description" in out));
  assert.ok(!("clientEmail" in out));
});

test("the manager view lists an invitation without its token", () => {
  const out = serializeInvitationForManager(invitationFixture);
  assert.equal(out.email, "ana@example.com");
  assert.equal(out.status, "pending");
  assert.equal(out.intendedRoleLabel, "Collaborator");
  assert.ok(!("tokenHash" in out));
});

test("a custom role label on the invitation wins over the default, in both views", () => {
  const withLabel = { ...invitationFixture, roleLabel: "Designer" };
  assert.equal(serializeInvitationForManager(withLabel).intendedRoleLabel, "Designer");
  assert.equal(
    serializeInvitationPreview(withLabel, { title: "P" }).intendedRoleLabel,
    "Designer",
  );
});
