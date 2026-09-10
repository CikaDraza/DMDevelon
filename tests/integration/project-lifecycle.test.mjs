import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import * as restoreRoute from "@/app/api/client-projects/[id]/restore/route.js";
import * as ownershipRoute from "@/app/api/client-projects/[id]/ownership/route.js";
import ClientProject from "@/models/ClientProject";
import ProjectAuditLog from "@/models/ProjectAuditLog";
import ProjectMember from "@/models/ProjectMember";
import User from "@/models/User";
import { resolveProjectAccess } from "@/lib/project-access";
import {
  addMember,
  callApi,
  connectTestDb,
  disconnectTestDb,
  makeProject,
  makeUser,
  resetDb,
  tokenFor,
} from "./harness.mjs";

async function callLifecycle(route, { id, actor, body }) {
  const headers = { "Content-Type": "application/json" };
  if (actor) headers.Authorization = `Bearer ${tokenFor(actor)}`;
  const response = await route.POST(
    new Request(`http://localhost:3003/api/client-projects/${id}/command`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
  return { status: response.status, body: await response.json() };
}

async function makeDeletedProject({ owner = null, ownerless = false } = {}) {
  return makeProject({
    owner: ownerless ? null : owner,
    title: "Psihointegritet foundation",
    status: "deleted",
    deletedAt: new Date("2026-08-09T14:00:43.898Z"),
    deletedByUserId: "operator-old",
    deletedByName: "Previous operator",
    ...(ownerless
      ? {
          clientUserId: "deleted-owner-id",
          clientName: "Previous client",
          clientEmail: "previous-client@test.local",
          ownerAccountDeletedAt: new Date("2026-08-09T16:52:56.147Z"),
        }
      : {}),
    milestones: [
      {
        _id: "milestone-1",
        title: "Existing foundation",
        status: "completed",
        tasks: [
          {
            _id: "task-1",
            title: "Completed market foundation",
            status: "completed",
          },
        ],
      },
    ],
  });
}

let admin;
let client;
let otherClient;

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(async () => {
  await resetDb();
  admin = await makeUser({
    name: "Operator",
    email: "operator@test.local",
    isAdmin: true,
  });
  client = await makeUser({ name: "Petra", email: "petra@test.local" });
  otherClient = await makeUser({ name: "Marjan", email: "marjan@test.local" });
});

describe("dedicated lifecycle route authorization and validation", () => {
  it("does not let a non-admin restore a project", async () => {
    const project = await makeDeletedProject({ owner: client });
    const response = await callLifecycle(restoreRoute, {
      id: project._id,
      actor: client,
      body: { status: "planning" },
    });
    expect(response.status).toBe(403);
    expect((await ClientProject.findById(project._id)).status).toBe("deleted");
  });

  it("does not let a non-admin assign an owner", async () => {
    const project = await makeDeletedProject({ ownerless: true });
    const response = await callLifecycle(ownershipRoute, {
      id: project._id,
      actor: client,
      body: { ownerUserId: otherClient._id },
    });
    expect(response.status).toBe(403);
  });

  it("rejects a restore target outside the explicit active states", async () => {
    const project = await makeDeletedProject({ owner: client });
    const response = await callLifecycle(restoreRoute, {
      id: project._id,
      actor: admin,
      body: { status: "completed" },
    });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_REQUEST");
  });

  it("rejects a global admin as the client owner", async () => {
    const project = await makeDeletedProject({ ownerless: true });
    const response = await callLifecycle(ownershipRoute, {
      id: project._id,
      actor: admin,
      body: { ownerUserId: admin._id },
    });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe("ADMIN_OWNER_FORBIDDEN");
  });
});

describe("restore", () => {
  for (const status of ["planning", "on_hold", "in_progress"]) {
    it(`restores a deleted project to ${status} without rewriting work`, async () => {
      const project = await makeDeletedProject({ owner: client });
      const beforeMilestones = project.milestones.toObject();
      const response = await callLifecycle(restoreRoute, {
        id: project._id,
        actor: admin,
        body: { status },
      });

      expect(response.status).toBe(200);
      const stored = await ClientProject.findById(project._id);
      expect(stored.status).toBe(status);
      expect(stored.deletedAt).toBeNull();
      expect(stored.deletedByUserId).toBeNull();
      expect(stored.deletedByName).toBe("");
      expect(stored.milestones.toObject()).toEqual(beforeMilestones);
      expect(stored.events.at(-1).type).toBe("project_restored");
      expect(
        await ProjectAuditLog.countDocuments({
          projectId: project._id,
          eventType: "project.restored",
        }),
      ).toBe(1);
    });
  }

  it("will not activate an ownerless deleted project without a new owner", async () => {
    const project = await makeDeletedProject({ ownerless: true });
    const response = await callLifecycle(restoreRoute, {
      id: project._id,
      actor: admin,
      body: { status: "in_progress" },
    });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe("OWNER_REQUIRED");
    const stored = await ClientProject.findById(project._id);
    expect(stored.status).toBe("deleted");
    expect(stored.ownerAccountDeletedAt).not.toBeNull();
  });

  it("requires a new owner when the recorded owner identity no longer exists", async () => {
    const project = await makeDeletedProject({ owner: client });
    await User.deleteOne({ _id: client._id });

    const response = await callLifecycle(restoreRoute, {
      id: project._id,
      actor: admin,
      body: { status: "planning" },
    });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("OWNER_REQUIRED");
    expect((await ClientProject.findById(project._id)).status).toBe("deleted");
  });

  it("atomically assigns an owner while restoring an ownerless project", async () => {
    const project = await makeDeletedProject({ ownerless: true });
    const beforeMilestones = project.milestones.toObject();
    const response = await callLifecycle(restoreRoute, {
      id: project._id,
      actor: admin,
      body: { status: "in_progress", ownerUserId: client._id },
    });
    expect(response.status).toBe(200);
    const stored = await ClientProject.findById(project._id);
    expect(stored.status).toBe("in_progress");
    expect(stored.clientUserId).toBe(client._id);
    expect(stored.clientName).toBe(client.name);
    expect(stored.clientEmail).toBe(client.email);
    expect(stored.ownerAccountDeletedAt).toBeNull();
    expect(stored.milestones.toObject()).toEqual(beforeMilestones);
    expect(response.body.auditEventTypes).toEqual([
      "project.owner_assigned",
      "project.restored",
    ]);
  });
});

describe("ownership recovery and transfer", () => {
  it("switches an active collaborator to removed in the same transaction", async () => {
    const project = await makeDeletedProject({ ownerless: true });
    const membership = await addMember(project, otherClient, "collaborator");
    const response = await callLifecycle(ownershipRoute, {
      id: project._id,
      actor: admin,
      body: { ownerUserId: otherClient._id },
    });
    expect(response.status).toBe(200);
    expect(response.body.membershipTransitioned).toBe(true);
    expect((await ProjectMember.findById(membership._id)).status).toBe("removed");
    expect((await ClientProject.findById(project._id)).clientUserId).toBe(
      otherClient._id,
    );
  });

  it("keeps an already removed membership as history and creates no duplicate", async () => {
    const project = await makeDeletedProject({ ownerless: true });
    const membership = await addMember(project, otherClient, "collaborator", {
      status: "removed",
    });
    const response = await callLifecycle(ownershipRoute, {
      id: project._id,
      actor: admin,
      body: { ownerUserId: otherClient._id },
    });
    expect(response.status).toBe(200);
    expect(response.body.membershipTransitioned).toBe(false);
    expect(await ProjectMember.countDocuments({ projectId: project._id })).toBe(1);
    expect((await ProjectMember.findById(membership._id)).status).toBe("removed");
  });

  it("rolls project, member, events and audit back when audit persistence fails", async () => {
    const project = await makeDeletedProject({ ownerless: true });
    const membership = await addMember(project, otherClient, "collaborator");
    const auditSpy = vi
      .spyOn(ProjectAuditLog, "create")
      .mockRejectedValueOnce(new Error("forced audit failure"));
    const response = await callLifecycle(ownershipRoute, {
      id: project._id,
      actor: admin,
      body: { ownerUserId: otherClient._id },
    });
    auditSpy.mockRestore();

    expect(response.status).toBe(500);
    const stored = await ClientProject.findById(project._id);
    expect(stored.clientUserId).toBe("deleted-owner-id");
    expect(stored.ownerAccountDeletedAt).not.toBeNull();
    expect(stored.events).toHaveLength(0);
    expect((await ProjectMember.findById(membership._id)).status).toBe("active");
    expect(await ProjectAuditLog.countDocuments({ projectId: project._id })).toBe(0);
  });

  it("writes ownership audit/event once and treats an identical replay as a no-op", async () => {
    const project = await makeDeletedProject({ ownerless: true });
    const first = await callLifecycle(ownershipRoute, {
      id: project._id,
      actor: admin,
      body: { ownerUserId: otherClient._id },
    });
    const second = await callLifecycle(ownershipRoute, {
      id: project._id,
      actor: admin,
      body: { ownerUserId: otherClient._id },
    });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.noOp).toBe(true);
    expect(
      await ProjectAuditLog.countDocuments({
        projectId: project._id,
        eventType: "project.owner_assigned",
      }),
    ).toBe(1);
    const stored = await ClientProject.findById(project._id);
    expect(stored.events.filter((event) => event.type === "ownership_transferred"))
      .toHaveLength(1);
  });

  it("makes the new owner authoritative while removed membership grants nothing", async () => {
    const project = await makeDeletedProject({ ownerless: true });
    await addMember(project, otherClient, "collaborator", { status: "removed" });
    await callLifecycle(ownershipRoute, {
      id: project._id,
      actor: admin,
      body: { ownerUserId: client._id },
    });
    const stored = await ClientProject.findById(project._id);
    expect((await resolveProjectAccess(client, stored)).role).toBe("owner");
    expect((await resolveProjectAccess(otherClient, stored)).role).toBeNull();
  });
});

describe("owner removal and recovery", () => {
  it("does not let a client orphan their own active project", async () => {
    const project = await makeProject({ owner: client, title: "Active project" });

    const deletion = await callApi("DELETE", `users/${client._id}`, {
      token: tokenFor(client),
    });

    expect(deletion.status).toBe(409);
    expect(await User.findById(client._id)).not.toBeNull();
    expect((await ClientProject.findById(project._id)).ownerAccountDeletedAt)
      .toBeNull();
  });

  it("lets an admin remove the owner, closes writes, then recovers ownership", async () => {
    const project = await makeProject({ owner: client, title: "Adopted foundation" });
    const membership = await addMember(project, otherClient, "collaborator");

    const deletion = await callApi("DELETE", `users/${client._id}`, {
      token: tokenFor(admin),
    });
    expect(deletion.status).toBe(200);
    const closed = await ClientProject.findById(project._id);
    expect(await User.findById(client._id)).toBeNull();
    expect(closed.ownerAccountDeletedAt).not.toBeNull();
    const closedAccess = await resolveProjectAccess(otherClient, closed);
    expect(closedAccess.role).toBe("collaborator");
    expect(closedAccess.permissions.projectRead).toBe(true);
    expect(closedAccess.permissions.chatWrite).toBe(false);

    const recovery = await callLifecycle(ownershipRoute, {
      id: project._id,
      actor: admin,
      body: { ownerUserId: otherClient._id },
    });
    expect(recovery.status).toBe(200);
    const recovered = await ClientProject.findById(project._id);
    expect(recovered.ownerAccountDeletedAt).toBeNull();
    expect((await ProjectMember.findById(membership._id)).status).toBe("removed");
    const ownerAccess = await resolveProjectAccess(otherClient, recovered);
    expect(ownerAccess.role).toBe("owner");
    expect(ownerAccess.permissions.chatWrite).toBe(true);
  });

  it("does not touch unrelated live client projects", async () => {
    const spiritualized = await makeProject({
      owner: client,
      title: "Spiritualized Language Tutor",
    });
    const sanja = await makeProject({ owner: otherClient, title: "Sanja Neuer" });
    const target = await makeDeletedProject({ ownerless: true });
    const before = JSON.parse(
      JSON.stringify([spiritualized.toObject(), sanja.toObject()]),
    );

    await callLifecycle(restoreRoute, {
      id: target._id,
      actor: admin,
      body: { status: "in_progress", ownerUserId: client._id },
    });

    const after = JSON.parse(
      JSON.stringify(
        await ClientProject.find({
          _id: { $in: [spiritualized._id, sanja._id] },
        }).sort({ title: -1 }),
      ),
    );
    expect(after).toEqual(before);
  });
});
