// Test harness for the Chat API suite.
//
// Calls the real Next.js route handlers in-process (no dev server) against a
// throwaway MongoDB. `callApi` reproduces exactly what the App Router hands a
// catch-all route: a Request plus a `context.params` promise carrying the
// split path — so a test exercises the same branch resolution the browser
// hits, including the ordering between `chat/messages/:id` and its
// sub-resources.
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import ClientProject from "@/models/ClientProject";
import ProjectMember from "@/models/ProjectMember";
import ProjectInvitation from "@/models/ProjectInvitation";
import ProjectItem from "@/models/ProjectItem";
import ChatChannel from "@/models/ChatChannel";
import ChatMessage from "@/models/ChatMessage";
import ChatRead from "@/models/ChatRead";
import Notification from "@/models/Notification";
import ProjectRequest from "@/models/ProjectRequest";
import ProjectMessage from "@/models/ProjectMessage";
import ProjectProposal from "@/models/ProjectProposal";
import ProjectAuditLog from "@/models/ProjectAuditLog";
import PushSubscription from "@/models/PushSubscription";

import * as route from "@/app/api/[[...path]]/route.js";

const BASE = "http://localhost:3003/api";

// Every collection the suite can WRITE, not just the ones it seeds. A
// conversion creates ProjectRequest / ProjectMessage rows, so leaving those
// out let one test's side effects leak into the next test's counts (a
// "collaborator may not create a request" assertion counted six requests that
// earlier, unrelated tests had legitimately created).
const MODELS = [
  User,
  ClientProject,
  ProjectMember,
  ProjectInvitation,
  ProjectItem,
  ChatChannel,
  ChatMessage,
  ChatRead,
  Notification,
  ProjectRequest,
  ProjectMessage,
  ProjectProposal,
  ProjectAuditLog,
  PushSubscription,
];

/**
 * Connect once per test file and make sure every unique/partial index this
 * suite relies on actually exists. Several behaviours under test (one group
 * channel per project, one DM per pair, one item ref per kind) are enforced
 * by the index, not by application code — without `init()` those tests would
 * pass against a schema that has no such guarantee in production.
 */
export async function connectTestDb() {
  await connectDB();
  await Promise.all(MODELS.map((m) => m.init()));
}

/** Wipe every collection this suite touches, keeping the indexes in place. */
export async function resetDb() {
  await Promise.all(MODELS.map((m) => m.deleteMany({})));
  outbox().emails.length = 0;
  outbox().pushes.length = 0;
}

export async function disconnectTestDb() {
  await mongoose.disconnect();
}

/** Emails and pushes captured by the stubs in setup.mjs. */
export function outbox() {
  return globalThis.__outbound || { emails: [], pushes: [] };
}

// --- Identities ------------------------------------------------------------

export async function makeUser({
  name,
  email,
  isAdmin = false,
  emailNotifications = true,
  pushNotifications = true,
  lastActiveAt = null,
} = {}) {
  const id = uuidv4();
  const user = await User.create({
    _id: id,
    name: name || `User ${id.slice(0, 6)}`,
    email: email || `user-${id.slice(0, 8)}@test.local`,
    password: "hashed-not-used",
    isAdmin,
    emailVerified: true,
    emailNotifications,
    pushNotifications,
    lastActiveAt,
  });
  return user;
}

/**
 * A usable access token for `user`. Mirrors authTokenPayload in the route —
 * including sessionVersion, which getUserFromRequest checks, so a test can
 * also assert that bumping it invalidates a token.
 */
export function tokenFor(user, overrides = {}) {
  return jwt.sign(
    {
      userId: user._id,
      email: user.email,
      isAdmin: user.isAdmin,
      sessionVersion: Number(user.sessionVersion || 0),
      tokenType: "access",
      ...overrides,
    },
    process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );
}

// --- Fixtures ---------------------------------------------------------------

export async function makeProject({ owner, title = "Test Project", ...rest }) {
  return ClientProject.create({
    _id: uuidv4(),
    clientUserId: owner?._id || null,
    clientName: owner?.name || "",
    clientEmail: owner?.email || "",
    clientSlug: "test-client",
    title,
    status: "in_progress",
    ...rest,
  });
}

export async function addMember(project, user, role, extra = {}) {
  return ProjectMember.create({
    _id: uuidv4(),
    projectId: project._id,
    userId: user._id,
    name: user.name,
    email: user.email,
    role,
    status: "active",
    joinedAt: new Date(),
    ...extra,
  });
}

/**
 * The full cast the chat is designed around, on one project:
 *   admin        — the operator (global isAdmin, no membership row)
 *   client       — the project owner
 *   collaborator — invited, can post and capture items
 *   viewer       — invited, read-only
 *   outsider     — no relationship to the project at all
 */
export async function seedProjectCast() {
  const admin = await makeUser({
    name: "Operator Admin",
    email: "admin@test.local",
    isAdmin: true,
  });
  const client = await makeUser({
    name: "Client Owner",
    email: "client@test.local",
  });
  const collaborator = await makeUser({
    name: "Collab Person",
    email: "collab@test.local",
  });
  const viewer = await makeUser({
    name: "Viewer Person",
    email: "viewer@test.local",
  });
  const outsider = await makeUser({
    name: "Outsider Person",
    email: "outsider@test.local",
  });

  const project = await makeProject({ owner: client, title: "Redesign" });
  await addMember(project, collaborator, "collaborator");
  await addMember(project, viewer, "viewer");

  return { admin, client, collaborator, viewer, outsider, project };
}

// --- HTTP ------------------------------------------------------------------

const METHODS = {
  GET: route.GET,
  POST: route.POST,
  PUT: route.PUT,
  PATCH: route.PATCH,
  DELETE: route.DELETE,
};

/**
 * Invoke a route handler the way the App Router would.
 *
 * @param method  HTTP verb
 * @param apiPath path under /api, e.g. "chat/channels/abc/messages"
 * @param opts.token  bearer token (omit for an anonymous call)
 * @param opts.body   JSON body
 * @param opts.query  object of query params
 * @returns { status, body } — body is the parsed JSON payload
 */
export async function callApi(method, apiPath, opts = {}) {
  const { token, body, query } = opts;
  const handler = METHODS[method];
  if (!handler) throw new Error(`Unsupported method ${method}`);

  const [pathPart, inlineQuery] = String(apiPath).split("?");
  const segments = pathPart.split("/").filter(Boolean);

  const search = new URLSearchParams(inlineQuery || "");
  for (const [k, v] of Object.entries(query || {})) {
    if (v !== undefined && v !== null) search.set(k, String(v));
  }
  const qs = search.toString();
  const url = `${BASE}/${segments.join("/")}${qs ? `?${qs}` : ""}`;

  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const request = new Request(url, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const response = await handler(request, {
    params: Promise.resolve({ path: segments }),
  });

  let parsed = null;
  const text = await response.text();
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  return { status: response.status, body: parsed };
}

/** `callApi` bound to one identity — keeps the test bodies readable. */
export function asUser(user) {
  const token = tokenFor(user);
  return {
    user,
    token,
    get: (p, o) => callApi("GET", p, { ...o, token }),
    post: (p, body, o) => callApi("POST", p, { ...o, body, token }),
    patch: (p, body, o) => callApi("PATCH", p, { ...o, body, token }),
    del: (p, o) => callApi("DELETE", p, { ...o, token }),
  };
}

/**
 * Give a user one web-push subscription.
 *
 * Required for any assertion about push: `sendPushToUser` reports how many
 * devices it actually reached, and `notifyUser` only stamps `pushedAt` when
 * that count is above zero. A user with no subscription is correctly treated
 * as "not pushed", so a test that expects a push has to say who is listening.
 */
export async function subscribeToPush(user) {
  return PushSubscription.create({
    _id: uuidv4(),
    userId: user._id,
    endpoint: `https://push.test.local/${user._id}`,
    keys: { p256dh: "test-p256dh", auth: "test-auth" },
  });
}

/**
 * Run the batched email digest the way Vercel Cron does — bearer token, not a
 * user session. Returns `{ status, body }` like every other call here.
 */
export async function runDigestSweep() {
  const request = new Request(`${BASE}/cron/email-digest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
    },
    body: "{}",
  });
  const response = await route.POST(request, {
    params: Promise.resolve({ path: ["cron", "email-digest"] }),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

/**
 * The project's group channel id, created lazily by GET /chat/channels the
 * same way the real dashboards trigger it on first open.
 */
export async function groupChannelIdFor(actor, projectId) {
  const res = await actor.get("chat/channels");
  const channel = (res.body || []).find(
    (c) => c.kind === "group" && String(c.projectId) === String(projectId),
  );
  if (!channel) {
    throw new Error(
      `No group channel for project ${projectId} in ${JSON.stringify(res.body)}`,
    );
  }
  return channel.id || channel._id;
}
