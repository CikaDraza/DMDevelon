import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import User from "../models/User.js";
import ClientProject from "../models/ClientProject.js";
import ProjectMember from "../models/ProjectMember.js";
import ProjectRequest from "../models/ProjectRequest.js";

const deployment = process.env.FND2_STAGING_DEPLOYMENT;
if (!deployment) throw new Error("FND2_STAGING_DEPLOYMENT is required");
if (process.env.APP_ENV !== "staging") {
  throw new Error("Refusing to run outside APP_ENV=staging");
}
if (!String(process.env.DB_NAME || "").toLowerCase().includes("staging")) {
  throw new Error("Refusing to run against a database without staging in its name");
}

const runId = `fnd2-smoke-${Date.now()}-${randomUUID().slice(0, 8)}`;
const password = `Smoke-${randomUUID()}!`;
const ids = {
  admin: `${runId}-admin`,
  owner: `${runId}-owner`,
  collaborator: `${runId}-collaborator`,
  viewer: `${runId}-viewer`,
  outsider: `${runId}-outsider`,
  project: `${runId}-project`,
  request: `${runId}-request`,
};
const people = ["admin", "owner", "collaborator", "viewer", "outsider"];
const emails = Object.fromEntries(
  people.map((role) => [role, `${runId}-${role}@example.invalid`]),
);
const tokens = {};
const tempDir = mkdtempSync(join(tmpdir(), "dmd-fnd2-smoke-"));
const ownerCookieJar = join(tempDir, "owner.cookies");
let cleanupComplete = false;
let ownerMe;

function pass(label) {
  process.stdout.write(`PASS ${label}\n`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function api(path, { method = "GET", token, body, cookieJar, cookieFile } = {}) {
  const curlArgs = [
    "--silent",
    "--show-error",
    "--request",
    method,
    "--header",
    "Accept: application/json",
  ];
  if (token) curlArgs.push("--header", `Authorization: Bearer ${token}`);
  if (cookieJar) curlArgs.push("--cookie-jar", cookieJar);
  if (cookieFile) curlArgs.push("--cookie", cookieFile);
  if (body !== undefined) {
    curlArgs.push(
      "--header",
      "Content-Type: application/json",
      "--data-raw",
      JSON.stringify(body),
    );
  }
  curlArgs.push("--write-out", "\n__FND2_STATUS__%{http_code}");

  const result = spawnSync(
    "npx",
    [
      "--yes",
      "vercel@latest",
      "curl",
      `/api/${path}`,
      "--deployment",
      deployment,
      "--",
      ...curlArgs,
    ],
    { cwd: process.cwd(), encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`vercel curl failed for ${method} ${path}: ${result.stderr.trim()}`);
  }
  const marker = "\n__FND2_STATUS__";
  const markerAt = result.stdout.lastIndexOf(marker);
  if (markerAt < 0) throw new Error(`Missing HTTP status for ${method} ${path}`);
  const rawBody = result.stdout.slice(0, markerAt).trim();
  const status = Number(result.stdout.slice(markerAt + marker.length).trim());
  let json = null;
  if (rawBody) {
    try {
      json = JSON.parse(rawBody);
    } catch {
      json = rawBody;
    }
  }
  return { status, body: json };
}

function expectStatus(response, expected, label) {
  assert(
    response.status === expected,
    `${label}: expected ${expected}, received ${response.status}`,
  );
  pass(`${label} (${expected})`);
  return response.body;
}

async function seed() {
  if (!process.env.MONGO_URL) throw new Error("MONGO_URL is required");
  await mongoose.connect(process.env.MONGO_URL, {
    dbName: process.env.DB_NAME,
    bufferCommands: false,
  });
  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();
  await User.insertMany(
    people.map((role) => ({
      _id: ids[role],
      name: `FND2 Smoke ${role}`,
      email: emails[role],
      password: passwordHash,
      isAdmin: role === "admin",
      provider: "local",
      accountOrigin: "staging",
      registeredAt: now,
      verifiedAt: now,
      emailVerified: true,
      emailNotifications: false,
      pushNotifications: false,
      sessionVersion: 0,
    })),
  );
  await ClientProject.create({
    _id: ids.project,
    clientUserId: ids.owner,
    clientName: "FND2 Smoke owner",
    clientEmail: emails.owner,
    clientSlug: runId,
    title: `FND2 authenticated smoke ${runId}`,
    description: "Temporary staging-only authorization fixture",
    status: "in_progress",
    milestones: [
      {
        _id: `${runId}-milestone`,
        title: "Smoke milestone",
        order: 0,
        status: "pending",
        tasks: [],
      },
    ],
  });
  await ProjectMember.insertMany([
    {
      _id: `${runId}-member-collaborator`,
      projectId: ids.project,
      userId: ids.collaborator,
      name: "FND2 Smoke collaborator",
      email: emails.collaborator,
      role: "collaborator",
      status: "active",
      invitedByUserId: ids.admin,
      joinedAt: now,
    },
    {
      _id: `${runId}-member-viewer`,
      projectId: ids.project,
      userId: ids.viewer,
      name: "FND2 Smoke viewer",
      email: emails.viewer,
      role: "viewer",
      status: "active",
      invitedByUserId: ids.admin,
      joinedAt: now,
    },
  ]);
  await ProjectRequest.create({
    _id: ids.request,
    clientUserId: ids.owner,
    clientName: "FND2 Smoke owner",
    clientEmail: emails.owner,
    clientSlug: runId,
    title: `FND2 request ${runId}`,
    description: "Temporary staging-only request fixture",
    status: "new",
    lastActivityAt: now,
  });
  pass("staging-only fixtures seeded");
}

async function cleanup() {
  if (cleanupComplete) return;
  if (mongoose.connection.readyState < 1) return;
  const db = mongoose.connection.db;
  const channelRows = await db
    .collection("chatchannels")
    .find({ projectId: ids.project }, { projection: { _id: 1 } })
    .toArray();
  const channelIds = channelRows.map((row) => row._id);
  await Promise.all([
    db.collection("chatreads").deleteMany({ channelId: { $in: channelIds } }),
    db.collection("chatmessages").deleteMany({
      $or: [{ channelId: { $in: channelIds } }, { projectId: ids.project }],
    }),
    db.collection("chatchannels").deleteMany({ projectId: ids.project }),
    db.collection("notifications").deleteMany({
      $or: [
        { userId: { $in: Object.values(ids).slice(0, 5) } },
        { actorId: { $in: Object.values(ids).slice(0, 5) } },
        { entityId: { $in: [ids.project, ids.request] } },
      ],
    }),
    db.collection("pushsubscriptions").deleteMany({
      userId: { $in: Object.values(ids).slice(0, 5) },
    }),
    db.collection("projectmessages").deleteMany({ projectId: ids.project }),
    db.collection("projectitems").deleteMany({ projectId: ids.project }),
    db.collection("projectauditlogs").deleteMany({ projectId: ids.project }),
    db.collection("projectinvitations").deleteMany({ projectId: ids.project }),
    db.collection("projectmembers").deleteMany({ projectId: ids.project }),
    db.collection("projectproposals").deleteMany({ projectId: ids.project }),
    db.collection("clientprojects").deleteMany({ _id: ids.project }),
    db.collection("projectrequests").deleteMany({ _id: ids.request }),
    db.collection("users").deleteMany({ _id: { $in: people.map((role) => ids[role]) } }),
  ]);
  const residue = await Promise.all([
    db.collection("users").countDocuments({ _id: { $in: people.map((role) => ids[role]) } }),
    db.collection("clientprojects").countDocuments({ _id: ids.project }),
    db.collection("projectrequests").countDocuments({ _id: ids.request }),
    db.collection("projectmembers").countDocuments({ projectId: ids.project }),
    db.collection("chatchannels").countDocuments({ projectId: ids.project }),
    db.collection("chatmessages").countDocuments({ projectId: ids.project }),
    db.collection("projectproposals").countDocuments({ projectId: ids.project }),
  ]);
  assert(residue.every((count) => count === 0), `cleanup residue: ${residue.join(",")}`);
  cleanupComplete = true;
  pass("temporary staging fixtures removed (zero residue)");
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, async () => {
    try {
      await cleanup();
      await mongoose.disconnect();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
      process.exit(128 + (signal === "SIGINT" ? 2 : 15));
    }
  });
}

async function main() {
  try {
    await seed();

    for (const role of people) {
      const login = expectStatus(
        api("auth/login", {
          method: "POST",
          body: { email: emails[role], password },
          ...(role === "owner" ? { cookieJar: ownerCookieJar } : {}),
        }),
        200,
        `${role} login`,
      );
      assert(login?.token, `${role} login did not return an access token`);
      assert(login?.user?.id === ids[role], `${role} login identity shape mismatch`);
      tokens[role] = login.token;
      if (role === "owner") {
        ownerMe = expectStatus(
          api("auth/me", { token: tokens.owner }),
          200,
          "owner /auth/me",
        );
        assert(ownerMe?.id === login.user.id, "/auth/me id differs from login");
        assert(ownerMe?._id === ownerMe?.id, "/auth/me id and _id differ");
        assert(
          JSON.stringify(Object.keys(ownerMe).sort()) ===
            JSON.stringify(Object.keys(login.user).sort()),
          "/auth/me shape differs from login",
        );
      }
    }

    const refreshed = expectStatus(
      api("auth/refresh", {
        method: "POST",
        body: {},
        cookieFile: ownerCookieJar,
      }),
      200,
      "owner refresh session",
    );
    assert(refreshed?.user?.id === ids.owner, "refresh identity mismatch");
    assert(
      JSON.stringify(Object.keys(refreshed.user).sort()) ===
        JSON.stringify(Object.keys(ownerMe).sort()),
      "refresh user shape differs from /auth/me",
    );

    const ownerProjects = expectStatus(
      api("client-projects", { token: tokens.owner }),
      200,
      "owner project list",
    );
    assert(ownerProjects.some((project) => project._id === ids.project), "owner project missing");
    const collaboratorProjects = expectStatus(
      api("client-projects", { token: tokens.collaborator }),
      200,
      "collaborator project list",
    );
    assert(
      collaboratorProjects.some((project) => project._id === ids.project),
      "collaborator project missing",
    );
    expectStatus(
      api(`client-projects/${ids.project}`, { token: tokens.outsider }),
      404,
      "outsider direct project access denied",
    );
    expectStatus(
      api(`client-projects/${ids.project}`, { token: tokens.viewer }),
      200,
      "viewer project detail",
    );

    const ownerRequests = expectStatus(
      api("project-requests", { token: tokens.owner }),
      200,
      "owner request list",
    );
    assert(ownerRequests.some((request) => request._id === ids.request), "owner request missing");
    expectStatus(
      api(`project-requests/${ids.request}`, { token: tokens.outsider }),
      404,
      "outsider request detail hidden",
    );
    const repliedRequest = expectStatus(
      api(`project-requests/${ids.request}/messages`, {
        method: "POST",
        token: tokens.admin,
        body: { body: "FND2 staging smoke reply" },
      }),
      201,
      "admin request reply",
    );
    assert(repliedRequest.status === "discussion", "request did not enter discussion");

    const draft = expectStatus(
      api(`client-projects/${ids.project}/proposals`, {
        method: "POST",
        token: tokens.admin,
        body: {
          title: "FND2 staging smoke phase",
          scope: "Temporary staging authorization exercise",
          timeline: "1 day",
          budget: "0 EUR",
          milestonePlan: [{ title: "Smoke phase", tasks: [{ title: "Smoke task" }] }],
        },
      }),
      201,
      "admin creates proposal draft",
    );
    const ownerDrafts = expectStatus(
      api(`client-projects/${ids.project}/proposals`, { token: tokens.owner }),
      200,
      "owner proposal list before send",
    );
    assert(!ownerDrafts.some((proposal) => proposal._id === draft._id), "owner saw draft proposal");
    expectStatus(
      api(`client-projects/${ids.project}/proposals`, { token: tokens.collaborator }),
      403,
      "collaborator commercial access denied",
    );
    expectStatus(
      api(`client-projects/${ids.project}/proposals/${draft._id}/send`, {
        method: "POST",
        token: tokens.admin,
        body: {},
      }),
      200,
      "admin sends proposal",
    );
    const ownerSent = expectStatus(
      api(`client-projects/${ids.project}/proposals`, { token: tokens.owner }),
      200,
      "owner sees sent proposal",
    );
    assert(ownerSent.some((proposal) => proposal._id === draft._id), "owner did not see sent proposal");
    expectStatus(
      api(`client-projects/${ids.project}/proposals/${draft._id}/accept`, {
        method: "POST",
        token: tokens.viewer,
        body: {},
      }),
      403,
      "viewer cannot accept proposal",
    );

    const adminChannels = expectStatus(
      api("chat/channels", { token: tokens.admin }),
      200,
      "admin channel list",
    );
    const channel = adminChannels.find(
      (item) => item.projectId === ids.project && item.kind === "group",
    );
    assert(channel?._id, "temporary project group channel missing");
    expectStatus(
      api(`chat/channels/${channel._id}`, { token: tokens.outsider }),
      404,
      "outsider direct channel access denied",
    );
    const sentMessage = expectStatus(
      api(`chat/channels/${channel._id}/messages`, {
        method: "POST",
        token: tokens.admin,
        body: { body: "FND2 authenticated staging smoke message" },
      }),
      201,
      "admin sends project chat message",
    );
    assert(sentMessage?.body?.includes("FND2 authenticated"), "chat response mismatch");
    const ownerMessages = expectStatus(
      api(`chat/channels/${channel._id}/messages`, { token: tokens.owner }),
      200,
      "owner reads project chat",
    );
    assert(ownerMessages.some((message) => message._id === sentMessage._id), "owner cannot see message");
    expectStatus(
      api(`chat/channels/${channel._id}/messages`, {
        method: "POST",
        token: tokens.viewer,
        body: { body: "Viewer must not be able to send this" },
      }),
      403,
      "viewer chat write denied",
    );

    const notifications = expectStatus(
      api("notifications", { token: tokens.owner }),
      200,
      "owner notification center",
    );
    assert(
      notifications.items.some((item) => item.entityId === ids.project || item.entityId === ids.request),
      "owner notification evidence missing",
    );
    const settings = expectStatus(
      api("user/settings", {
        method: "PUT",
        token: tokens.owner,
        body: { emailNotifications: false, pushNotifications: false },
      }),
      200,
      "owner settings persist",
    );
    assert(
      settings.emailNotifications === false && settings.pushNotifications === false,
      "settings response mismatch",
    );

    const users = expectStatus(api("users", { token: tokens.admin }), 200, "admin user list");
    assert(users.some((user) => user.id === ids.owner || user._id === ids.owner), "admin cannot see fixture users");
    expectStatus(api("users", { token: tokens.owner }), 401, "client admin boundary");
    expectStatus(
      api("auth/logout", {
        method: "POST",
        body: {},
        cookieFile: ownerCookieJar,
        cookieJar: ownerCookieJar,
      }),
      200,
      "owner logout",
    );
    expectStatus(
      api("auth/me", { token: tokens.owner }),
      401,
      "logout invalidates prior access token",
    );
  } finally {
    await cleanup();
    await mongoose.disconnect();
    rmSync(tempDir, { recursive: true, force: true });
  }
}

await main();
