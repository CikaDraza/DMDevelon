import { NextResponse } from "next/server";
import { networkInterfaces } from "os";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import Service from "@/models/Service";
import Project from "@/models/Project";
import Testimonial from "@/models/Testimonial";
import CompanyProfile from "@/models/CompanyProfile";
import ContactMessage from "@/models/ContactMessage";
import CMSPage from "@/models/CMSPage";
import ClientProject from "@/models/ClientProject";
import ProjectMessage from "@/models/ProjectMessage";
import ProjectRequest from "@/models/ProjectRequest";
import ProjectProposal from "@/models/ProjectProposal";
import ProjectMember from "@/models/ProjectMember";
import ProjectAuditLog from "@/models/ProjectAuditLog";
import ProjectInvitation from "@/models/ProjectInvitation";
import ChatChannel from "@/models/ChatChannel";
import ChatMessage from "@/models/ChatMessage";
import ChatRead from "@/models/ChatRead";
import ProjectItem from "@/models/ProjectItem";
import Notification from "@/models/Notification";
import PushSubscription from "@/models/PushSubscription";
import {
  DIGEST_TYPES,
  notifyUser,
  notifyAdmins,
  resolveClientUserId,
} from "@/lib/notify";
import { sendPushToUser } from "@/lib/push";
import { NOTIFICATION_THROTTLE_MS } from "@/lib/notification-policy.mjs";
import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  getUserFromRequest,
  verifyToken,
} from "@/lib/auth";
import { v4 as uuidv4, v5 as uuidv5 } from "uuid";
import { randomBytes } from "crypto";
import { emailTemplates } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email";

// Base URL for links in emails (prod domain, falls back to localhost in dev)
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  "http://localhost:3003";

// The dev server binds `--hostname 0.0.0.0` (listens on every interface), but
// that address is only meaningful to bind to — it is not something a browser
// on another device (or even the same machine) can actually open. Same idea
// for `localhost`/`127.0.0.1`: fine for the machine running the server, dead
// on arrival for a phone or a colleague's laptop testing an invite email.
// Whenever the incoming request's own host is one of these, substitute the
// machine's real LAN IPv4 address instead, so a link emailed out mid-dev-test
// actually opens for whoever clicks it.
const UNROUTABLE_HOSTS = new Set(["0.0.0.0", "[::]", "localhost", "127.0.0.1"]);

function detectLanIPv4() {
  const interfaces = networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const iface of entries || []) {
      const family = iface.family === "IPv4" || iface.family === 4;
      if (family && !iface.internal) return iface.address;
    }
  }
  return null;
}

// Interactive email links (verify/reset/invite) that the person testing the
// flow is about to click themselves. In production, always the configured
// canonical domain — trusting a request's Host header there would let a
// spoofed header point verification/invite links at an attacker's domain.
// In development, NEXT_PUBLIC_APP_URL is typically still the eventual
// production domain (so the build matches prod ahead of deploy), which
// otherwise sends every dev-mode email link to a site that doesn't have the
// token being tested — using the dev server's own request origin instead
// lets the whole invite/verify/reset flow be exercised locally.
function resolveAppUrl(request) {
  if (process.env.NODE_ENV === "production") return APP_URL;
  try {
    const url = new URL(request.url);
    const port = url.port ? `:${url.port}` : "";
    if (UNROUTABLE_HOSTS.has(url.hostname)) {
      const lanIp = detectLanIPv4();
      if (lanIp) return `${url.protocol}//${lanIp}${port}`;
    }
    return `${url.protocol}//${url.host}`;
  } catch {
    return APP_URL;
  }
}
import cloudinary, {
  uploadToCloudinary,
  uploadRawToCloudinary,
  ensureClientFolders,
  ensureAdminFolders,
  clientFolder,
  adminFolder,
} from "@/lib/cloudinary";

// Extract public_id from a res.cloudinary.com delivery URL so the download
// proxy can fall back to the Admin API when direct fetch is blocked (e.g.
// "Restricted media types" rejects a PDF delivered through image/upload).
function parseCloudinaryUrl(url) {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith(".cloudinary.com")) return null;
    const parts = u.pathname.split("/upload/");
    if (parts.length < 2) return null;
    // Strip optional version prefix (v1234567890/) and file extension
    let publicIdWithExt = parts[1].replace(/^v\d+\//, "");
    const lastDot = publicIdWithExt.lastIndexOf(".");
    const ext = lastDot >= 0 ? publicIdWithExt.slice(lastDot + 1) : "";
    const publicId =
      lastDot >= 0 ? publicIdWithExt.slice(0, lastDot) : publicIdWithExt;
    return { publicId, ext };
  } catch {
    return null;
  }
}
import { slugify } from "@/lib/slugify";
import {
  canAccessClientEntity,
  canPerformClientProposalAction,
  materializeMilestonePlan as materializeProposalMilestones,
  preparePhaseArchive,
} from "@/lib/project-proposal-domain.mjs";
import {
  requireProjectPermission,
  resolveProjectAccess,
} from "@/lib/project-access";
import {
  serializeInvitationForManager,
  serializeInvitationPreview,
  serializeMemberPublic,
  serializeProjectForAccess,
} from "@/lib/project-serializers.mjs";
import {
  assertInvitationAcceptable,
  canConvertMessage,
  canModerateMessage,
  dmKeyFor,
  displayRoleLabel,
  escapeRegExp,
  hashInviteToken,
  generateInviteToken,
  isUserOnline,
  INVITABLE_ROLES,
  MESSAGE_FLAGS,
  nextItemRef,
  normalizeEmail,
  PROJECT_ITEM_KINDS,
  resolveInvitationAction,
  sanitizeChatMessagePayload,
  sanitizeConvertPayload,
  sanitizeInvitationPayload,
  sanitizeProjectItemUpdate,
  sanitizePurgePayload,
} from "@/lib/chat-domain.mjs";
import {
  serializeChannelDetail,
  serializeChannelMember,
  serializeChannelSummary,
  serializeChatMessageForAccess,
  serializeProjectItem,
} from "@/lib/chat-serializers.mjs";

function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

const REFRESH_COOKIE_NAME = "dmdevelon_refresh";
const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

function authUserPayload(user) {
  return {
    id: user._id,
    _id: user._id,
    name: user.name,
    email: user.email,
    isAdmin: user.isAdmin,
    image: user.image,
    emailVerified: user.emailVerified,
  };
}

function authTokenPayload(user) {
  return {
    userId: user._id,
    email: user.email,
    isAdmin: user.isAdmin,
    sessionVersion: Number(user.sessionVersion || 0),
  };
}

function setRefreshCookie(response, token) {
  response.cookies.set({
    name: REFRESH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
  return response;
}

function clearRefreshCookie(response) {
  response.cookies.set({
    name: REFRESH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}

// Carries the raw invite token from GET /invitations/preview through whatever
// the visitor does next (log in, or register) without it living in browser
// history or a referrer header. The token in the accept/register body is a
// fallback if a client can't rely on cookies.
const INVITE_COOKIE_NAME = "dmdevelon_invite";
const INVITE_COOKIE_MAX_AGE = 60 * 60; // 1h — just long enough to log in or register

function setInviteCookie(response, rawToken) {
  response.cookies.set({
    name: INVITE_COOKIE_NAME,
    value: rawToken,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: INVITE_COOKIE_MAX_AGE,
  });
  return response;
}

function clearInviteCookie(response) {
  response.cookies.set({
    name: INVITE_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}

function createSessionResponse(user, { status = 200 } = {}) {
  const response = NextResponse.json(
    {
      token: generateAccessToken(authTokenPayload(user)),
      user: authUserPayload(user),
    },
    { status, headers: getCorsHeaders() },
  );
  return setRefreshCookie(
    response,
    generateRefreshToken(authTokenPayload(user)),
  );
}

async function getRefreshSessionUser(request) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value;
  const decoded = refreshToken ? verifyToken(refreshToken) : null;
  if (!decoded || decoded.tokenType !== "refresh" || !decoded.userId) {
    return null;
  }
  const user = await User.findById(decoded.userId).select(
    "-password -verifyToken -resetToken -resetTokenExpiry",
  );
  if (
    !user ||
    Number(decoded.sessionVersion) !== Number(user.sessionVersion || 0)
  ) {
    return null;
  }
  return user;
}

// Admin gets full access; client only to their own projects (by id or email).
function canAccessClientProject(user, project) {
  return canAccessClientEntity(user, project);
}

// Same ownership rule for project requests.
function canAccessRequest(user, req) {
  return canAccessClientEntity(user, req);
}

// --- Shared request helpers for the Communication Hub branches ------------
//
// Existing branches in this file repeat the same inline
// `const user = await getUserFromRequest(request); if (!user) return
// NextResponse.json({ error: "Unauthorized" }, { status: 401, ... })` block,
// and are inconsistent about which status a permission failure gets (some
// ownership checks return 401 "Unauthorized", others 403 "Forbidden", for the
// same kind of "not your project" case). New Communication Hub branches use
// these three helpers instead, so every new endpoint is uniform from the
// start; `requireProjectPermission` (lib/project-access.js) throws errors
// shaped the same way `apiError` already is, so they flow through the
// existing `errorResponse` handling with no special-casing at the call site.

// Throws (rather than returning a NextResponse) so it composes inside the
// same try/catch every verb handler already wraps its branches in.
async function requireAuthenticatedUser(request) {
  const user = await getUserFromRequest(request);
  if (!user) throw apiError("Unauthorized", 401);
  return user;
}

function forbiddenResponse(message = "Forbidden") {
  return NextResponse.json(
    { error: message },
    { status: 403, headers: getCorsHeaders() },
  );
}

function notFoundResponse(message = "Not found") {
  return NextResponse.json(
    { error: message },
    { status: 404, headers: getCorsHeaders() },
  );
}

// --- Shared helpers for invitation acceptance and the chat group channel --
//
// getOrCreateGroupChannel/postSystemMessage are the one piece of the (not yet
// built) Chat API this section needs: accepting an invitation posts "<Name>
// joined the group" into the project's single group channel. Section 6 reuses
// these exact helpers for its own lazy-creation needs rather than duplicating
// the get-or-create logic.

// Idempotent under concurrency: the unique partial index on
// ChatChannel{projectId, kind:'group'} is what actually settles a race between
// two requests trying to create the first channel for a project at once —
// this function just makes losing that race a normal, handled outcome.
async function getOrCreateGroupChannel(project) {
  const existing = await ChatChannel.findOne({
    projectId: project._id,
    kind: "group",
  });
  if (existing) return existing;
  try {
    return await ChatChannel.create({
      _id: uuidv4(),
      projectId: project._id,
      kind: "group",
      name: `${project.title} — Project Group`,
      postingPolicy: "all",
    });
  } catch (error) {
    if (error?.code === 11000) {
      const raced = await ChatChannel.findOne({
        projectId: project._id,
        kind: "group",
      });
      if (raced) return raced;
    }
    throw error;
  }
}

// System messages are attributed as operator-level (authorRole: 'admin'),
// the same convention ProjectMessage already uses for its own server-
// generated change_agreed entries — `kind: 'system'` is what actually marks
// this as generated, not typed by a person.
async function postSystemMessage(channel, body) {
  return ChatMessage.create({
    _id: uuidv4(),
    channelId: channel._id,
    projectId: channel.projectId,
    authorUserId: null,
    authorName: "System",
    authorRole: "admin",
    body,
    kind: "system",
  });
}

// Same get-or-create-under-a-race shape as getOrCreateGroupChannel, keyed on
// the unique (projectId, dmKey) index instead — "proveri pa kreiraj" would
// let two simultaneous "open a DM with this person" requests each create
// their own channel; the unique index is what actually prevents that (I5).
async function getOrCreateDmChannel(project, userIdA, userIdB) {
  const dmKey = dmKeyFor(userIdA, userIdB);
  const existing = await ChatChannel.findOne({ projectId: project._id, dmKey });
  if (existing) return existing;
  try {
    return await ChatChannel.create({
      _id: uuidv4(),
      projectId: project._id,
      kind: "dm",
      dmKey,
      memberUserIds: [String(userIdA), String(userIdB)],
      postingPolicy: "all",
    });
  } catch (error) {
    if (error?.code === 11000) {
      const raced = await ChatChannel.findOne({
        projectId: project._id,
        dmKey,
      });
      if (raced) return raced;
    }
    throw error;
  }
}

// Shared entry point for every chat/* branch below: load the channel, resolve
// project-level access for `permission`, then layer DM privacy on top. A
// fellow project member who isn't part of THIS dm has no relationship to it
// specifically — same "don't disclose existence" policy as an unrelated
// project id, so this throws 404, not 403.
async function loadChannelWithAccess(channelId, user, permission) {
  const channel = await ChatChannel.findById(channelId);
  if (!channel) throw apiError("Channel not found", 404);
  const project = await ClientProject.findById(channel.projectId);
  if (!project) throw apiError("Project not found", 404);
  const access = await requireProjectPermission(user, project, permission);
  if (
    channel.kind === "dm" &&
    !(channel.memberUserIds || []).includes(String(user._id))
  ) {
    throw apiError("Channel not found", 404);
  }
  return { channel, project, access };
}

// Same shape, entered from a message id instead of a channel id — every
// message-scoped branch (pin, edit, delete) needs its channel and project
// resolved before it can decide anything.
async function loadMessageWithAccess(messageId, user, permission) {
  const message = await ChatMessage.findById(messageId);
  if (!message) throw apiError("Message not found", 404);
  const channel = await ChatChannel.findById(message.channelId);
  if (!channel) throw apiError("Channel not found", 404);
  const project = await ClientProject.findById(channel.projectId);
  if (!project) throw apiError("Project not found", 404);
  const access = await requireProjectPermission(user, project, permission);
  if (
    channel.kind === "dm" &&
    !(channel.memberUserIds || []).includes(String(user._id))
  ) {
    throw apiError("Message not found", 404);
  }
  return { message, channel, project, access };
}

// The channel's own member roster for @mention matching and the detail view:
// the project owner (if resolvable) plus active ProjectMembers. Global admins
// are deliberately not offered as mention candidates in Phase 1 — there is no
// single obvious admin identity to match a name against per project.
async function loadChannelRoster(project) {
  const roster = [];
  const ownerId = project.clientUserId || null;
  if (ownerId || project.clientEmail) {
    const owner = ownerId
      ? await User.findById(ownerId)
      : await User.findOne({ email: project.clientEmail });
    if (owner) {
      roster.push({
        userId: owner._id,
        name: owner.name || owner.email,
        role: "owner",
        roleLabel: "",
      });
    }
  }
  const members = await ProjectMember.find({
    projectId: project._id,
    status: "active",
  });
  for (const m of members) {
    roster.push({
      userId: m.userId,
      name: m.name || m.email,
      role: m.role,
      roleLabel: m.roleLabel,
    });
  }
  return roster;
}

// The point after which a message counts as unread for this user: the later
// of "last marked read" and "cleared up to" — clearing a conversation also
// counts as having read it, so a message that arrives right after a clear is
// not immediately (and confusingly) unread.
function readCutoff(read) {
  const lastReadAt = read?.lastReadAt ? new Date(read.lastReadAt).getTime() : 0;
  const clearedAt = read?.clearedAt ? new Date(read.clearedAt).getTime() : 0;
  return new Date(Math.max(lastReadAt, clearedAt));
}

// Core of both POST /api/invitations/accept and registration-through-invite:
// turn a valid, unexpired invitation plus an authenticated `user` into an
// active ProjectMember. Membership creation/reactivation and the invitation's
// status flip are one transaction (I2) — partial failure must never leave a
// member with no membership, or an invitation marked used with no membership
// to show for it. Reused across both call sites so the atomicity guarantee
// only has to be gotten right once.
async function acceptInvitationForUser(invitation, project, user) {
  const session = await ProjectMember.db.startSession();
  try {
    await session.withTransaction(async () => {
      // Reuse a prior (e.g. 'removed') row for this exact (project, user) pair
      // instead of inserting a second one — the unique index on
      // ProjectMember{projectId, userId} would reject a duplicate anyway, but
      // reusing it is what makes this idempotent under a retried transaction.
      const existing = await ProjectMember.findOne({
        projectId: invitation.projectId,
        userId: user._id,
      }).session(session);
      if (existing) {
        existing.status = "active";
        existing.role = invitation.intendedRole;
        existing.roleLabel = invitation.roleLabel || existing.roleLabel;
        existing.name = user.name || existing.name;
        existing.email = user.email || existing.email;
        existing.invitedByUserId = invitation.invitedByUserId;
        if (!existing.joinedAt) existing.joinedAt = new Date();
        await existing.save({ session });
      } else {
        // Mongoose only recognizes the `{ session }` options argument when the
        // first argument is an array — a single plain object there is instead
        // treated as a SECOND document to insert, which fails validation with
        // a confusing "userId/projectId is required" error pointing at the
        // options object itself.
        await ProjectMember.create(
          [
            {
              _id: uuidv4(),
              projectId: invitation.projectId,
              userId: user._id,
              name: user.name || "",
              email: user.email || "",
              role: invitation.intendedRole,
              roleLabel: invitation.roleLabel || "",
              status: "active",
              invitedByUserId: invitation.invitedByUserId,
              joinedAt: new Date(),
            },
          ],
          { session },
        );
      }
      // Conditional on 'pending': if a concurrent request already flipped
      // this (and this attempt is a transaction retry), matchedCount is 0
      // here and that is fine — the membership branch above already made
      // this call idempotent regardless of who wins the status update.
      await ProjectInvitation.updateOne(
        { _id: invitation._id, status: "pending" },
        {
          $set: {
            status: "accepted",
            acceptedAt: new Date(),
            acceptedByUserId: user._id,
          },
        },
        { session },
      );
    });
  } catch (error) {
    if (
      /transaction numbers are only allowed|does not support transactions/i.test(
        String(error?.message || ""),
      )
    ) {
      throw apiError(
        "Accepting this invitation requires MongoDB transaction support",
        503,
      );
    }
    throw error;
  } finally {
    await session.endSession();
  }

  // Post-commit, best-effort side effects (I2): never allowed to undo an
  // already-committed membership if either of these fails.
  try {
    await ProjectAuditLog.create({
      _id: uuidv4(),
      projectId: invitation.projectId,
      actorUserId: user._id,
      actorName: user.name || user.email || "",
      targetUserId: user._id,
      targetEmail: user.email || "",
      eventType: "invitation.accepted",
      metadata: { role: invitation.intendedRole },
    });
  } catch (e) {
    console.error("audit insert failed (invitation accepted):", e);
  }
  try {
    const channel = await getOrCreateGroupChannel(project);
    await postSystemMessage(
      channel,
      `${user.name || user.email} joined the group.`,
    );
  } catch (e) {
    console.error("system message failed (invitation accepted):", e);
  }
}

const CLIENT_PROPOSAL_STATUSES = ["sent", "changes_requested", "accepted"];
const ITEM_STATUSES = new Set(["pending", "in_progress", "completed"]);
const PROJECT_STATUSES = new Set([
  "planning",
  "in_progress",
  "completed",
  "on_hold",
  "cancelled",
  "deleted",
]);
const TERMINAL_PROJECT_STATUSES = new Set([
  "completed",
  "cancelled",
  "deleted",
]);

function apiError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function cleanString(value, field, max, { required = false } = {}) {
  if (value === undefined || value === null) value = "";
  if (typeof value !== "string") throw apiError(`${field} must be a string`);
  const cleaned = value.trim();
  if (required && !cleaned) throw apiError(`${field} is required`);
  if (cleaned.length > max) throw apiError(`${field} is too long`);
  return cleaned;
}

function proposalSnapshot(proposal) {
  return {
    kind: proposal.kind || "phase",
    phaseNumber: proposal.phaseNumber || 1,
    phaseLabel:
      proposal.phaseLabel ||
      (proposal.kind === "master" ? "Master Proposal" : "Proposal"),
    title: proposal.title || "",
    scope: proposal.scope || "",
    timeline: proposal.timeline || "",
    budget: proposal.budget || "",
    status: proposal.status || "sent",
    version: proposal.version || 1,
    milestonePlan: JSON.parse(JSON.stringify(proposal.milestonePlan || [])),
    sentAt: proposal.sentAt || null,
    capturedAt: new Date(),
    capturedByUserId: null,
  };
}

function milestoneAuditSnapshot(milestone) {
  return {
    _id: milestone._id,
    title: milestone.title || "",
    description: milestone.description || "",
    icon: milestone.icon || "Circle",
    order: Number.isInteger(milestone.order) ? milestone.order : 0,
    status: milestone.status || "pending",
    githubBranch: milestone.githubBranch || "",
    tasks: (milestone.tasks || []).map((task) => ({
      _id: task._id,
      title: task.title || "",
      description: task.description || "",
      order: Number.isInteger(task.order) ? task.order : 0,
      status: task.status || "pending",
    })),
  };
}

function normalizeMilestonePlan(value, existingPlan = []) {
  if (value === undefined)
    return JSON.parse(JSON.stringify(existingPlan || []));
  if (!Array.isArray(value)) throw apiError("milestonePlan must be an array");
  if (value.length > 60)
    throw apiError("milestonePlan has too many milestones");

  const explicitOrders = value
    .filter((item) => Number.isInteger(item?.order))
    .map((item) => item.order);
  if (explicitOrders.some((order) => order < 0)) {
    throw apiError("Milestone order values must be non-negative");
  }
  if (new Set(explicitOrders).size !== explicitOrders.length) {
    throw apiError("Milestone order values must be unique");
  }

  const existingById = new Map(
    (existingPlan || []).map((item) => [String(item._id), item]),
  );
  return value.map((raw, index) => {
    if (!raw || typeof raw !== "object") {
      throw apiError(`Milestone ${index + 1} is invalid`);
    }
    const existing = raw._id ? existingById.get(String(raw._id)) : null;
    const tasks = Array.isArray(raw.tasks) ? raw.tasks : [];
    if (tasks.length > 100) {
      throw apiError(`Milestone ${index + 1} has too many tasks`);
    }
    const taskOrders = tasks
      .filter((task) => Number.isInteger(task?.order))
      .map((task) => task.order);
    if (taskOrders.some((order) => order < 0)) {
      throw apiError(
        `Task order values must be non-negative in milestone ${index + 1}`,
      );
    }
    if (new Set(taskOrders).size !== taskOrders.length) {
      throw apiError(
        `Task order values must be unique in milestone ${index + 1}`,
      );
    }
    const existingTasks = new Map(
      (existing?.tasks || []).map((task) => [String(task._id), task]),
    );
    return {
      _id: existing?._id || uuidv4(),
      title: cleanString(raw.title, `Milestone ${index + 1} title`, 200, {
        required: true,
      }),
      description: cleanString(
        raw.description,
        `Milestone ${index + 1} description`,
        10000,
      ),
      icon: cleanString(raw.icon || "Circle", "Milestone icon", 80),
      githubBranch: cleanString(raw.githubBranch, "Milestone git branch", 250),
      order: Number.isInteger(raw.order) ? raw.order : index,
      tasks: tasks.map((task, taskIndex) => {
        if (!task || typeof task !== "object") {
          throw apiError(
            `Task ${taskIndex + 1} in milestone ${index + 1} is invalid`,
          );
        }
        const existingTask = task._id
          ? existingTasks.get(String(task._id))
          : null;
        return {
          _id: existingTask?._id || uuidv4(),
          title: cleanString(task.title, `Task ${taskIndex + 1} title`, 200, {
            required: true,
          }),
          description: cleanString(
            task.description,
            `Task ${taskIndex + 1} description`,
            5000,
          ),
          order: Number.isInteger(task.order) ? task.order : taskIndex,
        };
      }),
    };
  });
}

function normalizeProposalFields(body, existing = null) {
  const sourcePlan = body.milestonePlan ?? body.milestones;
  return {
    title: cleanString(body.title ?? existing?.title, "Proposal title", 200, {
      required: true,
    }),
    scope: cleanString(body.scope ?? existing?.scope, "Proposal scope", 100000),
    timeline: cleanString(
      body.timeline ?? existing?.timeline,
      "Proposal timeline",
      500,
    ),
    budget: cleanString(
      body.budget ?? existing?.budget,
      "Proposal budget",
      500,
    ),
    phaseLabel: cleanString(
      body.phaseLabel ?? existing?.phaseLabel,
      "Phase label",
      120,
      { required: true },
    ),
    milestonePlan: normalizeMilestonePlan(
      sourcePlan,
      existing?.milestonePlan || [],
    ),
  };
}

function materializeMilestonePlan(proposal) {
  return materializeProposalMilestones(proposal, { baseOrder: 0 });
}

async function reconcileProposalMilestones(projectId, proposal, actorName) {
  let added = 0;
  for (const milestone of materializeMilestonePlan(proposal)) {
    const result = await ClientProject.updateOne(
      {
        _id: projectId,
        archivedProposalIds: { $ne: proposal._id },
        "milestones._id": { $ne: milestone._id },
      },
      { $push: { milestones: milestone }, $inc: { __v: 1 } },
    );
    added += result.modifiedCount || 0;
  }

  const plannedCount = (proposal.milestonePlan || []).length;
  const eventId = uuidv5(`proposal-accepted:${proposal._id}`, uuidv5.URL);
  await ClientProject.updateOne(
    { _id: projectId, "events._id": { $ne: eventId } },
    {
      $push: {
        events: {
          _id: eventId,
          type: "proposal_accepted",
          body: `${proposal.phaseLabel} accepted — ${plannedCount} milestone${plannedCount === 1 ? "" : "s"} in this phase`,
          actorName: actorName || "Client",
          createdAt: proposal.acceptedAt || new Date(),
        },
      },
      $inc: { __v: 1 },
    },
  );
  if (added > 0) {
    await ClientProject.updateOne(
      { _id: projectId, status: "completed" },
      { $set: { status: "in_progress" }, $inc: { __v: 1 } },
    );
  }
  return added;
}

function errorResponse(error, label) {
  console.error(`${label} Error:`, error);
  const status =
    error?.status ||
    error?.statusCode ||
    (error?.name === "ValidationError"
      ? 400
      : error?.name === "VersionError" || error?.code === 11000
        ? 409
        : 500);
  return NextResponse.json(
    { error: status === 500 ? error.message : error.message },
    { status, headers: getCorsHeaders() },
  );
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: getCorsHeaders() });
}

// Verify the digest cron secret. Vercel Cron auto-sends `Authorization:
// Bearer <CRON_SECRET>` when the CRON_SECRET env var is set.
function isCronAuthorized(request) {
  const auth = request.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET;
  return !!secret && auth === `Bearer ${secret}`;
}

// Batched email digest of unread message notifications. Shared by GET (Vercel
// Cron sends GET) and POST (manual/external schedulers). Idempotent: once a
// notification is included it gets `emailedAt` set so it won't be re-sent.
async function runEmailDigest() {
  const pending = await Notification.find({
    // Imported from lib/notify.js rather than re-listed here. These were two
    // separate hardcoded lists once and they drifted (a type added to
    // DIGEST_TYPES was silently never swept).
    type: { $in: [...DIGEST_TYPES] },
    emailedAt: null,
    read: false,
  }).sort({ createdAt: 1 });

  if (!pending.length) return { sent: 0, processed: 0 };

  // Group per recipient, then per conversation (entityId).
  const byUser = new Map();
  for (const n of pending) {
    if (!byUser.has(n.userId)) byUser.set(n.userId, []);
    byUser.get(n.userId).push(n);
  }

  const logoUrl = `${APP_URL}/icons/dmd-email-logo.png`;
  const wordmarkUrl = `${APP_URL}/icons/dmd-email-logo.png`;
  let sent = 0;
  const processedIds = [];

  for (const [userId, notes] of byUser) {
    const recipient = await User.findById(userId);
    // Skip (but still mark processed) if user opted out or has no email.
    if (!recipient?.email || recipient.emailNotifications === false) {
      processedIds.push(...notes.map((n) => n.id ?? n._id));
      continue;
    }

    // Someone with the app open right now sees the toast and the bell; the
    // digest would just be noise. Deliberately NOT marked processed — leave
    // emailedAt null so it still reaches them once they go idle.
    if (isUserOnline(recipient.lastActiveAt)) continue;

    // The cron runs every 15 minutes, but a conversation should only email
    // once an hour. Anything still inside that window is left pending for a
    // later sweep rather than consumed.
    //
    // Scoped to DIGEST_TYPES: without that clause any inline email counted —
    // so a client who had just been emailed "Proposal ready" (an actionable
    // type that deliberately bypasses the digest) had their unread MESSAGES
    // held back for an hour by an unrelated notification.
    const lastDigest = await Notification.findOne({
      userId,
      type: { $in: [...DIGEST_TYPES] },
      emailedAt: { $ne: null },
    })
      .sort({ emailedAt: -1 })
      .select("emailedAt");
    if (
      lastDigest?.emailedAt &&
      Date.now() - new Date(lastDigest.emailedAt).getTime() <
        NOTIFICATION_THROTTLE_MS
    ) {
      continue;
    }

    const convMap = new Map();
    for (const n of notes) {
      const key = n.entityId || n.title;
      if (!convMap.has(key)) {
        convMap.set(key, {
          title: n.title,
          count: 0,
          preview: n.body || "",
          link: n.link,
        });
      }
      const c = convMap.get(key);
      c.count += 1;
      c.preview = n.body || c.preview; // latest message preview
      c.link = n.link || c.link;
    }
    const conversations = Array.from(convMap.values());
    const totalCount = notes.length;
    const ctaUrl = `${APP_URL}${conversations[0]?.link || "/dashboard"}`;

    try {
      const tpl = emailTemplates.newMessageDigest({
        name: recipient.name,
        logoUrl,
        wordmarkUrl,
        ctaUrl,
        totalCount,
        conversations,
      });
      await sendEmail({ to: recipient.email, ...tpl, type: "project" });
      sent += 1;
      // Consumed only on a successful send. Marking them processed before the
      // call meant a Resend outage silently burned the notifications: they got
      // `emailedAt` set, so the next sweep skipped them and the messages were
      // never emailed to anyone.
      processedIds.push(...notes.map((n) => n.id ?? n._id));
    } catch (e) {
      console.error("digest email failed for", userId, e);
    }
  }

  await Notification.updateMany(
    { _id: { $in: processedIds } },
    { $set: { emailedAt: new Date() } },
  );

  return { sent, processed: processedIds.length };
}

export async function GET(request, context) {
  await connectDB();
  const params = await context.params;
  const path = params?.path || [];
  const pathStr = path.join("/");
  const { searchParams } = new URL(request.url);

  try {
    // Health check
    if (pathStr === "health") {
      return NextResponse.json(
        { status: "ok", timestamp: new Date().toISOString() },
        { headers: getCorsHeaders() },
      );
    }

    // Cron - batched email digest. Vercel Cron triggers this via GET and
    // auto-sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set.
    if (pathStr === "cron/email-digest") {
      if (!isCronAuthorized(request)) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const result = await runEmailDigest();
      return NextResponse.json(result, { headers: getCorsHeaders() });
    }

    // Services
    if (pathStr === "services") {
      const services = await Service.find().sort({ displayOrder: 1 });
      return NextResponse.json(services, { headers: getCorsHeaders() });
    }

    if (pathStr.startsWith("services/")) {
      const id = path[1];
      const service = await Service.findById(id);
      if (!service) {
        return NextResponse.json(
          { error: "Service not found" },
          { status: 404, headers: getCorsHeaders() },
        );
      }
      return NextResponse.json(service, { headers: getCorsHeaders() });
    }

    // Projects
    if (pathStr === "projects") {
      const category = searchParams.get("category");
      const query = category && category !== "all" ? { category } : {};
      const projects = await Project.find(query).sort({ createdAt: -1 });
      return NextResponse.json(projects, { headers: getCorsHeaders() });
    }

    if (pathStr.startsWith("projects/slug/")) {
      const slug = path[2];
      const project = await Project.findOne({ slug });
      if (!project) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404, headers: getCorsHeaders() },
        );
      }
      return NextResponse.json(project, { headers: getCorsHeaders() });
    }

    if (pathStr.startsWith("projects/")) {
      const id = path[1];
      const project = await Project.findById(id);
      if (!project) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404, headers: getCorsHeaders() },
        );
      }
      return NextResponse.json(project, { headers: getCorsHeaders() });
    }

    // Client Projects (auth required)
    if (pathStr === "client-projects") {
      const user = await requireAuthenticatedUser(request);
      // Admin and owner scoping is unchanged; a collaborator/viewer additionally
      // sees the projects they were invited into, alongside anything they own.
      let query;
      if (user.isAdmin) {
        query = {};
      } else {
        const memberships = await ProjectMember.find({
          userId: user._id,
          status: "active",
        }).select("projectId");
        const orClauses = [
          { clientUserId: user._id },
          { clientEmail: user.email },
        ];
        if (memberships.length > 0) {
          orClauses.push({
            _id: { $in: memberships.map((m) => m.projectId) },
          });
        }
        query = { $or: orClauses };
      }
      const projects = await ClientProject.find(query).sort({ createdAt: -1 });
      // Owner/admin get the raw document exactly as before (zero regression);
      // a project reached only through membership goes through the allowlist.
      const result = await Promise.all(
        projects.map(async (project) => {
          if (canAccessClientEntity(user, project)) return project;
          const access = await resolveProjectAccess(user, project);
          return serializeProjectForAccess(project, access);
        }),
      );
      return NextResponse.json(result, { headers: getCorsHeaders() });
    }

    if (pathStr.startsWith("client-projects/")) {
      const user = await requireAuthenticatedUser(request);
      const id = path[1];
      const project = await ClientProject.findById(id);
      if (!project) return notFoundResponse("Project not found");

      // Proposals belonging to this single client project. A collaborator/
      // viewer has a real relationship to the project (projectRead) but not to
      // its commercial side — that is its own permission, checked here, not
      // inherited from being able to see the project at all. Drafts are never
      // returned to clients, even when a proposal id is guessed directly.
      if (path[2] === "proposals") {
        const access = await requireProjectPermission(
          user,
          project,
          "proposalsRead",
        );
        const proposalQuery = {
          projectId: id,
          ...(access.role === "admin"
            ? {}
            : { status: { $in: CLIENT_PROPOSAL_STATUSES } }),
        };
        if (path[3]) proposalQuery._id = path[3];
        if (path[3]) {
          const proposal = await ProjectProposal.findOne(proposalQuery);
          if (!proposal) return notFoundResponse("Proposal not found");
          return NextResponse.json(proposal, { headers: getCorsHeaders() });
        }
        const proposals = await ProjectProposal.find(proposalQuery).sort({
          phaseNumber: 1,
          createdAt: 1,
        });
        return NextResponse.json(proposals, { headers: getCorsHeaders() });
      }
      // Per-milestone chat thread: client-projects/:id/messages?milestoneId=...
      // Open to any role with milestoneRead (viewer included) — read-only.
      if (path[2] === "messages") {
        await requireProjectPermission(user, project, "milestoneRead");
        const milestoneId = searchParams.get("milestoneId");
        const mq = { projectId: id };
        if (milestoneId) mq.milestoneId = milestoneId;
        const messages = await ProjectMessage.find(mq).sort({ createdAt: 1 });
        return NextResponse.json(messages, { headers: getCorsHeaders() });
      }
      // Team roster: the project owner, active ProjectMembers, and every
      // global admin — each individually, so a client can DM any operator
      // directly rather than a single shared "support" identity — plus,
      // only for someone who can invite, the pending invitations. Private
      // emails are a further opt-in beyond that — owner/admin only — not
      // implied by "can see the team".
      if (path[2] === "members") {
        const access = await requireProjectPermission(
          user,
          project,
          "membersRead",
        );
        const activeMembers = await ProjectMember.find({
          projectId: id,
          status: "active",
        }).sort({ joinedAt: 1 });
        const admins = await User.find({ isAdmin: true });
        const ownerId = project.clientUserId || null;
        const owner = ownerId
          ? await User.findById(ownerId)
          : project.clientEmail
            ? await User.findOne({ email: project.clientEmail })
            : null;

        const accountsById = new Map();
        if (activeMembers.length > 0) {
          const accounts = await User.find({
            _id: { $in: activeMembers.map((m) => m.userId) },
          });
          for (const account of accounts) {
            accountsById.set(String(account._id), account);
          }
        }
        const includeEmail = access.role === "admin" || access.role === "owner";
        const now = new Date();

        // Exactly ONE row per person. The same human can legitimately be
        // several things at once — a global admin who also accepted an
        // invitation here, or an owner who is also an admin — and a second
        // row for them is worse than useless: both rows carry the same
        // userId, so both open the SAME dm channel (dmKey is per user pair),
        // making it look like a message went to "the wrong chat" when there
        // was only ever one conversation.
        //
        // Precedence is admin → owner → membership, the same order
        // resolveRoleFromFacts resolves permissions in, so the row a person
        // shows up as always matches the rights they actually have here.
        // That order is also the display order the plan asks for
        // (admin first, then owner, then everyone else).
        const byUserId = new Map();
        const addRow = (userId, member, account) => {
          const key = String(userId || "");
          if (!key || byUserId.has(key)) return;
          byUserId.set(
            key,
            serializeMemberPublic(member, {
              includeEmail,
              user: account,
              isOnline: isUserOnline(account?.lastActiveAt, now),
            }),
          );
        };

        for (const admin of admins) {
          addRow(
            admin._id,
            {
              _id: `admin:${admin._id}`,
              userId: admin._id,
              role: "admin",
              status: "active",
              joinedAt: admin.createdAt,
            },
            admin,
          );
        }
        if (owner) {
          addRow(
            owner._id,
            {
              _id: `owner:${owner._id}`,
              userId: owner._id,
              role: "owner",
              status: "active",
              joinedAt: project.createdAt,
            },
            owner,
          );
        }
        for (const m of activeMembers) {
          addRow(m.userId, m, accountsById.get(String(m.userId)));
        }
        const members = Array.from(byUserId.values());

        let invitations = [];
        if (access.permissions.membersInvite) {
          const pending = await ProjectInvitation.find({
            projectId: id,
            status: "pending",
          }).sort({ createdAt: -1 });
          invitations = pending.map(serializeInvitationForManager);
        }
        return NextResponse.json(
          { members, invitations },
          { headers: getCorsHeaders() },
        );
      }
      const access = await requireProjectPermission(
        user,
        project,
        "projectRead",
      );
      return NextResponse.json(serializeProjectForAccess(project, access), {
        headers: getCorsHeaders(),
      });
    }

    // Invitation preview — unauthenticated. Whoever holds the link learns only
    // enough to decide whether to accept: which project, who invited, which
    // role, and a masked hint of the bound address. Sets an HttpOnly cookie so
    // the raw token survives a login/registration redirect without sitting in
    // the URL bar, browser history, or a referrer header.
    if (pathStr === "invitations/preview") {
      const token = searchParams.get("token");
      if (!token) {
        return NextResponse.json(
          { error: "Token is required" },
          { status: 400, headers: getCorsHeaders() },
        );
      }
      const invitation = await ProjectInvitation.findOne({
        tokenHash: hashInviteToken(token),
      });
      if (!invitation) return notFoundResponse("Invitation not found");
      const project = await ClientProject.findById(invitation.projectId);
      const preview = serializeInvitationPreview(invitation, project || {});
      const response = NextResponse.json(preview, {
        headers: getCorsHeaders(),
      });
      return setInviteCookie(response, token);
    }

    // Every channel the user can see: their projects' group channel (lazily
    // created here, one per project) plus any DM channel they're part of.
    // One call fills the whole list, with unread counts and last-message
    // previews included.
    if (pathStr === "chat/channels") {
      const user = await requireAuthenticatedUser(request);
      // Presence heartbeat: this list is the one thing already polled every
      // 15s while the chat UI is open, so it doubles as "the caller is
      // active right now" — no separate heartbeat endpoint/poll needed.
      // Fire-and-forget: a failed touch should never break the channel list.
      User.updateOne(
        { _id: user._id },
        { $set: { lastActiveAt: new Date() } },
      ).catch((e) => console.error("presence heartbeat failed:", e));
      let projectQuery;
      if (user.isAdmin) {
        projectQuery = {};
      } else {
        const memberships = await ProjectMember.find({
          userId: user._id,
          status: "active",
        }).select("projectId");
        const orClauses = [
          { clientUserId: user._id },
          { clientEmail: user.email },
        ];
        if (memberships.length > 0) {
          orClauses.push({
            _id: { $in: memberships.map((m) => m.projectId) },
          });
        }
        projectQuery = { $or: orClauses };
      }
      const projects = await ClientProject.find(projectQuery);
      const projectsById = new Map(projects.map((p) => [String(p._id), p]));

      const groupChannels = await Promise.all(
        projects.map((p) => getOrCreateGroupChannel(p)),
      );

      // DM channels this user is part of. A dm's project might not be one of
      // the projects above (access could have been revoked since) — those
      // are skipped: no relationship to the project means no relationship to
      // a DM under it either.
      const dmChannelsRaw = await ChatChannel.find({
        kind: "dm",
        memberUserIds: String(user._id),
      });
      const dmChannels = [];
      for (const dm of dmChannelsRaw) {
        if (!projectsById.has(String(dm.projectId))) {
          const dmProject = await ClientProject.findById(dm.projectId);
          if (!dmProject) continue;
          const dmAccess = await resolveProjectAccess(user, dmProject);
          if (dmAccess.role === null) continue;
          projectsById.set(String(dmProject._id), dmProject);
        }
        dmChannels.push(dm);
      }

      const allChannels = [...groupChannels, ...dmChannels];
      const reads = await ChatRead.find({
        channelId: { $in: allChannels.map((c) => c._id) },
        userId: user._id,
      });
      const readByChannel = new Map(reads.map((r) => [r.channelId, r]));

      const result = await Promise.all(
        allChannels.map(async (channel) => {
          const read = readByChannel.get(channel._id);
          const clearedAt = read?.clearedAt || null;
          const since = readCutoff(read);

          const lastMessageQuery = { channelId: channel._id, deletedAt: null };
          if (clearedAt) lastMessageQuery.createdAt = { $gt: clearedAt };

          const unreadCount = await ChatMessage.countDocuments({
            channelId: channel._id,
            deletedAt: null,
            authorUserId: { $ne: user._id },
            createdAt: { $gt: since },
          });
          const lastMessage = await ChatMessage.findOne(lastMessageQuery).sort({
            createdAt: -1,
          });
          const project = projectsById.get(String(channel.projectId));
          const access = project
            ? await resolveProjectAccess(user, project)
            : null;
          return serializeChannelSummary(channel, {
            unreadCount,
            lastMessage,
            accessObj: access,
          });
        }),
      );

      return NextResponse.json(result, { headers: getCorsHeaders() });
    }

    // GET /api/chat/channels/:id — meta + member roster.
    if (pathStr.startsWith("chat/channels/") && !path[3]) {
      const user = await requireAuthenticatedUser(request);
      const { channel, project } = await loadChannelWithAccess(
        path[2],
        user,
        "chatRead",
      );
      const roster = await loadChannelRoster(project);
      return NextResponse.json(
        serializeChannelDetail(channel, {
          members: roster.map(serializeChannelMember),
        }),
        { headers: getCorsHeaders() },
      );
    }

    // GET /api/chat/channels/:id/messages?before=&limit=&flag=&q=
    if (pathStr.startsWith("chat/channels/") && path[3] === "messages") {
      const user = await requireAuthenticatedUser(request);
      const { channel, access } = await loadChannelWithAccess(
        path[2],
        user,
        "chatRead",
      );
      const read = await ChatRead.findOne({
        channelId: channel._id,
        userId: user._id,
      });

      const limitParam = Number.parseInt(searchParams.get("limit") || "", 10);
      const limit = Math.min(
        Math.max(Number.isFinite(limitParam) ? limitParam : 50, 1),
        100,
      );
      const before = searchParams.get("before");
      const flag = searchParams.get("flag");
      const q = searchParams.get("q");
      const attachmentType = searchParams.get("attachmentType");

      const query = { channelId: channel._id };
      const createdAtFilter = {};
      if (read?.clearedAt) createdAtFilter.$gt = read.clearedAt;
      if (before) {
        const beforeDate = new Date(before);
        if (!Number.isNaN(beforeDate.getTime()))
          createdAtFilter.$lt = beforeDate;
      }
      if (Object.keys(createdAtFilter).length > 0) {
        query.createdAt = createdAtFilter;
      }
      if (flag && flag !== "all") {
        if (flag === "pinned") query.pinned = true;
        else if (MESSAGE_FLAGS.includes(flag)) query.flag = flag;
      }
      // Matches a message with at least one attachment of this type — a
      // distinct filter dimension from `flag`, so it composes independently
      // (the UI only ever sends one or the other today, but the query
      // doesn't need to assume that).
      if (attachmentType === "image" || attachmentType === "pdf") {
        query["attachments.type"] = attachmentType;
      }
      if (q && String(q).trim().length >= 2) {
        query.body = { $regex: escapeRegExp(String(q).trim()), $options: "i" };
      }

      const messages = await ChatMessage.find(query)
        .sort({ createdAt: -1 })
        .limit(limit);
      return NextResponse.json(
        messages.reverse().map((m) => serializeChatMessageForAccess(m, access)),
        { headers: getCorsHeaders() },
      );
    }

    // GET /api/chat/channels/:id/pinned
    if (pathStr.startsWith("chat/channels/") && path[3] === "pinned") {
      const user = await requireAuthenticatedUser(request);
      const { channel, access } = await loadChannelWithAccess(
        path[2],
        user,
        "chatRead",
      );
      const read = await ChatRead.findOne({
        channelId: channel._id,
        userId: user._id,
      });
      // `deletedAt: null` also covers messages pinned and deleted BEFORE
      // delete started unpinning — those rows still carry pinned: true.
      const query = { channelId: channel._id, pinned: true, deletedAt: null };
      if (read?.clearedAt) query.createdAt = { $gt: read.clearedAt };
      const pinned = await ChatMessage.find(query).sort({ pinnedAt: -1 });
      return NextResponse.json(
        pinned.map((m) => serializeChatMessageForAccess(m, access)),
        { headers: getCorsHeaders() },
      );
    }

    // GET /api/project-items?projectId=&kind=&status= — formal records
    // produced by "Convert to…". Gated by `projectRead`, not something
    // chat-specific — every role that can see the project at all should be
    // able to see its decision/incident log, same as milestones/tasks.
    if (pathStr === "project-items") {
      const user = await requireAuthenticatedUser(request);
      const projectId = searchParams.get("projectId");
      if (!projectId) throw apiError("projectId is required", 400);
      const project = await ClientProject.findById(projectId);
      if (!project) return notFoundResponse("Project not found");
      await requireProjectPermission(user, project, "projectRead");

      const query = { projectId };
      const kind = searchParams.get("kind");
      if (kind && PROJECT_ITEM_KINDS.includes(kind)) query.kind = kind;
      const status = searchParams.get("status");
      if (status) query.status = status;

      const items = await ProjectItem.find(query).sort({ createdAt: -1 });
      return NextResponse.json(items.map(serializeProjectItem), {
        headers: getCorsHeaders(),
      });
    }

    // Project Requests (auth required)
    if (pathStr === "project-requests") {
      const user = await getUserFromRequest(request);
      if (!user) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const query = user.isAdmin
        ? {}
        : { $or: [{ clientUserId: user._id }, { clientEmail: user.email }] };
      const requests = await ProjectRequest.find(query).sort({
        lastActivityAt: -1,
      });
      return NextResponse.json(requests, { headers: getCorsHeaders() });
    }

    if (pathStr.startsWith("project-requests/")) {
      const user = await requireAuthenticatedUser(request);
      const id = path[1];
      const req = await ProjectRequest.findById(id);
      if (!req) return notFoundResponse("Request not found");
      // A request is owner/admin-only with no membership concept (unlike
      // client-projects) — a collaborator has no relationship to it at all,
      // so this is 404, not 403: existence is not disclosed to someone with
      // no claim to it, same policy as an unrelated client-projects id.
      if (!canAccessRequest(user, req))
        return notFoundResponse("Request not found");
      return NextResponse.json(req, { headers: getCorsHeaders() });
    }

    // Testimonials
    if (pathStr === "testimonials") {
      const testimonials = await Testimonial.find().sort({ createdAt: -1 });
      return NextResponse.json(testimonials, { headers: getCorsHeaders() });
    }

    if (pathStr.startsWith("testimonials/")) {
      const id = path[1];
      const testimonial = await Testimonial.findById(id);
      if (!testimonial) {
        return NextResponse.json(
          { error: "Testimonial not found" },
          { status: 404, headers: getCorsHeaders() },
        );
      }
      return NextResponse.json(testimonial, { headers: getCorsHeaders() });
    }

    // Company Profile
    if (pathStr === "company-profile") {
      let profile = await CompanyProfile.findOne();
      if (!profile) {
        profile = await CompanyProfile.create({
          _id: uuidv4(),
          name: "DMDevelon",
          description: "Transforming Ideas into Digital Success",
          subheadline: "",
          logo: "",
          heroImage: "",
          phone: "",
          email: "drazic.milan@gmail.com",
          socialLinks: {},
          seo: {
            title: "DMDevelon Portfolio",
            description: "Professional web development services",
            keywords: "web development, portfolio",
            OgImage: "",
          },
          geo: {
            address: "",
            city: "",
            country: "",
            postalCode: "",
            lat: "",
            lng: "",
          },
        });
      }
      return NextResponse.json(profile, { headers: getCorsHeaders() });
    }

    // Contact Messages (admin only)
    if (pathStr === "contact-messages") {
      const user = await getUserFromRequest(request);
      if (!user || !user.isAdmin) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const messages = await ContactMessage.find().sort({ createdAt: -1 });
      return NextResponse.json(messages, { headers: getCorsHeaders() });
    }

    // CMS Pages
    if (pathStr === "cms-pages") {
      const pages = await CMSPage.find();
      return NextResponse.json(pages, { headers: getCorsHeaders() });
    }

    if (pathStr.startsWith("cms-pages/slug/")) {
      const slug = path[2];
      const page = await CMSPage.findOne({ slug });
      if (!page) {
        return NextResponse.json(
          { error: "Page not found" },
          { status: 404, headers: getCorsHeaders() },
        );
      }
      return NextResponse.json(page, { headers: getCorsHeaders() });
    }

    // Users (admin only)
    if (pathStr === "users") {
      const decoded = await getUserFromRequest(request);

      if (!decoded || !decoded.isAdmin) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const users = await User.find().select(
        "-password -verifyToken -resetToken -resetTokenExpiry",
      );
      return NextResponse.json(users, { headers: getCorsHeaders() });
    }

    // User profile — getUserFromRequest already returns the user doc without
    // sensitive fields, so return it directly.
    if (pathStr === "auth/me") {
      const user = await getUserFromRequest(request);
      if (!user) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      return NextResponse.json(user, { headers: getCorsHeaders() });
    }

    // Notifications (current user)
    if (pathStr === "notifications") {
      const user = await getUserFromRequest(request);
      if (!user) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      // Second presence heartbeat. GET /chat/channels covers someone with the
      // chat open; this poll runs on EVERY authenticated page, so a person
      // reading their dashboard no longer looks offline — which matters now
      // that presence suppresses email/push. Fire-and-forget: a failed touch
      // must never break the bell.
      User.updateOne(
        { _id: user._id },
        { $set: { lastActiveAt: new Date() } },
      ).catch((e) => console.error("presence heartbeat failed:", e));
      const [items, unreadCount] = await Promise.all([
        Notification.find({ userId: user._id })
          .sort({ createdAt: -1 })
          .limit(50),
        Notification.countDocuments({ userId: user._id, read: false }),
      ]);
      return NextResponse.json(
        { items, unreadCount },
        { headers: getCorsHeaders() },
      );
    }

    // Proxy download — fetches from Cloudinary server-to-server (no CORS)
    // and streams back with Content-Disposition: attachment so the browser
    // saves the file instead of navigating. No auth: Cloudinary URLs are
    // already public, and the SSRF guard below (only res.cloudinary.com) is
    // what keeps this from being usable as a general proxy.
    if (pathStr === "download") {
      const { searchParams: dlParams } = new URL(request.url);
      const url = dlParams.get("url");
      const name = dlParams.get("name") || "download";

      if (!url) {
        return NextResponse.json(
          { error: "Missing url parameter" },
          { status: 400, headers: getCorsHeaders() },
        );
      }

      // Only proxy Cloudinary URLs — reject anything else to prevent SSRF
      if (!url.startsWith("https://res.cloudinary.com/")) {
        return NextResponse.json(
          { error: "Invalid source" },
          { status: 400, headers: getCorsHeaders() },
        );
      }

      // Stream a proxied response to the client.
      const streamResponse = async (res) => {
        const contentType =
          res.headers.get("content-type") || "application/octet-stream";
        const body = await res.arrayBuffer();
        return new NextResponse(body, {
          status: 200,
          headers: {
            ...getCorsHeaders(),
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="${encodeURIComponent(name)}"`,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      };

      try {
        // 1) Try a plain fetch — works for images and raw-uploaded files.
        let upstream = await fetch(url);
        if (upstream.ok) return await streamResponse(upstream);

        // 2) Fall back to a signed Admin API download URL for files stuck
        //    under image/upload that Cloudinary's "Restricted media types"
        //    refuses to serve as a raw delivery (notably PDFs).
        const parsed = parseCloudinaryUrl(url);
        if (parsed && parsed.ext) {
          const signedUrl = cloudinary.utils.private_download_url(
            parsed.publicId,
            parsed.ext,
            {
              resource_type: "image",
              type: "upload",
              attachment: true,
            },
          );
          upstream = await fetch(signedUrl);
          if (upstream.ok) return await streamResponse(upstream);
        }

        // Neither worked
        return NextResponse.json(
          { error: "Upstream fetch failed" },
          { status: 502, headers: getCorsHeaders() },
        );
      } catch {
        return NextResponse.json(
          { error: "Download failed" },
          { status: 502, headers: getCorsHeaders() },
        );
      }
    }

    // Statistics (admin only)
    if (pathStr === "statistics") {
      const user = await getUserFromRequest(request);

      if (!user || !user.isAdmin) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const [
        userCount,
        projectCount,
        serviceCount,
        testimonialCount,
        messageCount,
      ] = await Promise.all([
        User.countDocuments(),
        Project.countDocuments(),
        Service.countDocuments(),
        Testimonial.countDocuments(),
        ContactMessage.countDocuments(),
      ]);
      return NextResponse.json(
        {
          users: userCount,
          projects: projectCount,
          services: serviceCount,
          testimonials: testimonialCount,
          messages: messageCount,
        },
        { headers: getCorsHeaders() },
      );
    }

    // Categories
    if (pathStr === "categories") {
      const services = await Service.find().distinct("category");
      const projects = await Project.find().distinct("category");
      const categories = [...new Set([...services, ...projects])];
      return NextResponse.json(categories, { headers: getCorsHeaders() });
    }

    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: getCorsHeaders() },
    );
  } catch (error) {
    return errorResponse(error, "GET");
  }
}

export async function POST(request, context) {
  await connectDB();
  const params = await context.params;
  const path = params?.path || [];
  const pathStr = path.join("/");

  try {
    // Tolerate empty/no JSON body (e.g. cron/unsubscribe calls without a payload)
    const body = await request.json().catch(() => ({}));

    // Push - send a test notification to the caller's own devices.
    //
    // "Push doesn't arrive on my phone" has at least five distinct causes
    // (VAPID unset, no subscription saved, subscription expired, the delivery
    // policy suppressing it, the OS silencing it) and none of them are visible
    // from the outside. This answers which one it is, for the caller's own
    // account only, and deliberately bypasses the delivery policy: it is a
    // wiring test, not a notification.
    if (pathStr === "push/test") {
      const user = await requireAuthenticatedUser(request);
      const subscriptions = await PushSubscription.find({ userId: user._id });
      const result = await sendPushToUser(user._id, {
        title: "DMDevelon test",
        body: "Push notifications are working on this device.",
        link: "/dashboard",
      });
      return NextResponse.json(
        {
          ...result,
          vapidConfigured: Boolean(
            process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
          ),
          subscriptions: subscriptions.length,
          // Enough to tell one device from another without exposing the
          // endpoint, which is a bearer credential for that browser.
          devices: subscriptions.map((s) => ({
            host: (() => {
              try {
                return new URL(s.endpoint).host;
              } catch {
                return "unknown";
              }
            })(),
            userAgent: (s.userAgent || "").slice(0, 120),
            createdAt: s.createdAt,
          })),
          pushEnabledOnAccount: user.pushNotifications !== false,
        },
        { headers: getCorsHeaders() },
      );
    }

    // Push - save a browser push subscription for the current user
    if (pathStr === "push/subscribe") {
      const user = await getUserFromRequest(request);
      if (!user) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const sub = body?.subscription || body;
      if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
        return NextResponse.json(
          { error: "Invalid subscription" },
          { status: 400, headers: getCorsHeaders() },
        );
      }
      await PushSubscription.findOneAndUpdate(
        { endpoint: sub.endpoint },
        {
          $set: {
            userId: user._id,
            endpoint: sub.endpoint,
            keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
            userAgent: request.headers.get("user-agent") || "",
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      return NextResponse.json(
        { success: true },
        { status: 201, headers: getCorsHeaders() },
      );
    }

    // Push - remove a subscription (by endpoint) for the current user
    if (pathStr === "push/unsubscribe") {
      const user = await getUserFromRequest(request);
      if (!user) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const endpoint = body?.endpoint || body?.subscription?.endpoint;
      if (endpoint) {
        await PushSubscription.deleteOne({ endpoint, userId: user._id });
      }
      return NextResponse.json(
        { success: true },
        { headers: getCorsHeaders() },
      );
    }

    // Cron - batched email digest (manual/external schedulers via POST).
    if (pathStr === "cron/email-digest") {
      if (!isCronAuthorized(request)) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const result = await runEmailDigest();
      return NextResponse.json(result, { headers: getCorsHeaders() });
    }

    // Auth - Refresh access token from the HttpOnly refresh cookie. The
    // browser never exposes this cookie to JavaScript.
    if (pathStr === "auth/refresh") {
      const user = await getRefreshSessionUser(request);
      if (!user) {
        const response = NextResponse.json(
          { error: "Session expired" },
          { status: 401, headers: getCorsHeaders() },
        );
        return clearRefreshCookie(response);
      }
      return NextResponse.json(
        {
          token: generateAccessToken(authTokenPayload(user)),
          user: authUserPayload(user),
        },
        { headers: getCorsHeaders() },
      );
    }

    // Auth - Logout invalidates the current token family and clears the
    // HttpOnly refresh cookie, including when the access token has expired.
    if (pathStr === "auth/logout") {
      const user = await getRefreshSessionUser(request);
      if (user) {
        user.sessionVersion = Number(user.sessionVersion || 0) + 1;
        await user.save();
      }
      const response = NextResponse.json(
        { message: "Logged out" },
        { headers: getCorsHeaders() },
      );
      return clearRefreshCookie(response);
    }

    // Auth - Register
    if (pathStr === "auth/register") {
      const { name, password, inviteToken } = body;

      // Registering through an invite link locks the account's email to the
      // invitation's own address — body.email (if the form even sends one) is
      // never used. Holding a token that hashes to a live, pending invitation
      // is treated as proof of that inbox, the same trust a normal
      // verification email establishes, just already spent.
      let invitation = null;
      let email = body.email;
      if (inviteToken) {
        invitation = await ProjectInvitation.findOne({
          tokenHash: hashInviteToken(inviteToken),
        });
        if (!invitation) {
          throw apiError("Invalid or expired invitation", 400);
        }
        // Comparing the invitation's address to itself only exercises the
        // status/expiry checks — there is no other identity yet to mismatch
        // against at registration time. A dead invitation here means the
        // cookie should go too (I4) — but a validation failure further down
        // (missing field, existing account) must NOT clear it, since the
        // invitation itself is still perfectly good for a retry.
        try {
          assertInvitationAcceptable(invitation, invitation.emailNormalized);
        } catch (error) {
          return clearInviteCookie(errorResponse(error, "POST"));
        }
        email = invitation.emailNormalized;
      }

      if (!name || !email || !password) {
        return NextResponse.json(
          { error: "Missing required fields" },
          { status: 400, headers: getCorsHeaders() },
        );
      }
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        // Never create a second account for an email that already has one —
        // true with or without an invite (I3). With one, the fix is to sign
        // in and accept, not register again.
        return NextResponse.json(
          {
            error: invitation
              ? "An account with this email already exists. Please sign in and accept the invitation from your dashboard."
              : "Email already exists",
          },
          { status: 400, headers: getCorsHeaders() },
        );
      }
      const hashedPassword = hashPassword(password);
      const verifyToken = invitation
        ? undefined
        : randomBytes(32).toString("hex");
      const user = await User.create({
        _id: uuidv4(),
        name,
        email,
        password: hashedPassword,
        isAdmin: false,
        emailVerified: Boolean(invitation),
        verifyToken,
      });

      if (invitation) {
        const project = await ClientProject.findById(invitation.projectId);
        if (project) {
          await acceptInvitationForUser(invitation, project, user);
        }
      } else {
        try {
          const verificationUrl = `${resolveAppUrl(request)}/verify-email?token=${verifyToken}`;
          const template = emailTemplates.emailVerification({
            name,
            verificationUrl,
          });
          await sendEmail({
            to: email,
            ...template,
            type: "verification",
          });
        } catch (error) {
          console.error("Failed to send verification email:", error);
        }
      }

      const response = createSessionResponse(user, { status: 201 });
      return invitation ? clearInviteCookie(response) : response;
    }

    // Auth - Login
    if (pathStr === "auth/login") {
      const { email, password } = body;
      if (!email || !password) {
        return NextResponse.json(
          { error: "Missing email or password" },
          { status: 400, headers: getCorsHeaders() },
        );
      }
      const user = await User.findOne({ email });
      if (!user) {
        return NextResponse.json(
          { error: "Invalid credentials" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const isValid = comparePassword(password, user.password);
      if (!isValid) {
        return NextResponse.json(
          { error: "Invalid credentials" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      return createSessionResponse(user);
    }

    // Auth - Forgot password (always returns 200, no user enumeration)
    if (pathStr === "auth/forgot-password") {
      const { email } = body;
      if (email) {
        const user = await User.findOne({ email });
        if (user) {
          user.resetToken = randomBytes(32).toString("hex");
          user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1h
          await user.save();
          try {
            const resetUrl = `${resolveAppUrl(request)}/reset-password?token=${user.resetToken}`;
            const template = emailTemplates.passwordReset({
              name: user.name,
              resetUrl,
            });
            await sendEmail({ to: email, ...template, type: "system" });
          } catch (error) {
            console.error("Failed to send reset email:", error);
          }
        }
      }
      return NextResponse.json(
        {
          message:
            "If an account exists with that email, a reset link has been sent.",
        },
        { headers: getCorsHeaders() },
      );
    }

    // Auth - Reset password
    if (pathStr === "auth/reset-password") {
      const { token, password } = body;
      if (!token || !password) {
        return NextResponse.json(
          { error: "Missing token or password" },
          { status: 400, headers: getCorsHeaders() },
        );
      }
      const user = await User.findOne({
        resetToken: token,
        resetTokenExpiry: { $gt: new Date() },
      });
      if (!user) {
        return NextResponse.json(
          { error: "Invalid or expired token" },
          { status: 400, headers: getCorsHeaders() },
        );
      }
      user.password = hashPassword(password);
      user.resetToken = null;
      user.resetTokenExpiry = null;
      user.sessionVersion = Number(user.sessionVersion || 0) + 1;
      await user.save();
      return NextResponse.json(
        { message: "Password updated. You can now sign in." },
        { headers: getCorsHeaders() },
      );
    }

    // Auth - Verify email
    if (pathStr === "auth/verify-email") {
      const { token } = body;
      if (!token) {
        return NextResponse.json(
          { error: "Missing token" },
          { status: 400, headers: getCorsHeaders() },
        );
      }
      const user = await User.findOne({ verifyToken: token });
      if (!user) {
        return NextResponse.json(
          { error: "Invalid or expired verification link" },
          { status: 400, headers: getCorsHeaders() },
        );
      }
      user.emailVerified = true;
      user.verifyToken = null;
      await user.save();
      return NextResponse.json(
        { success: true, email: user.email },
        { headers: getCorsHeaders() },
      );
    }

    // Auth - Resend verification (authenticated)
    if (pathStr === "auth/resend-verification") {
      const decoded = await getUserFromRequest(request);
      if (!decoded) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const user = await User.findById(decoded._id || decoded.userId);
      if (!user) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404, headers: getCorsHeaders() },
        );
      }
      if (user.emailVerified) {
        return NextResponse.json(
          { message: "Email already verified" },
          { headers: getCorsHeaders() },
        );
      }
      user.verifyToken = randomBytes(32).toString("hex");
      await user.save();
      try {
        const verificationUrl = `${resolveAppUrl(request)}/verify-email?token=${user.verifyToken}`;
        const template = emailTemplates.emailVerification({
          name: user.name,
          verificationUrl,
        });
        await sendEmail({ to: user.email, ...template, type: "verification" });
      } catch (error) {
        console.error("Failed to resend verification email:", error);
      }
      return NextResponse.json(
        { message: "Verification email sent" },
        { headers: getCorsHeaders() },
      );
    }

    // Services (admin only)
    if (pathStr === "services") {
      const user = await getUserFromRequest(request);

      if (!user || !user.isAdmin) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const service = await Service.create({ _id: uuidv4(), ...body });
      return NextResponse.json(service, {
        status: 201,
        headers: getCorsHeaders(),
      });
    }

    // Projects (admin only)
    if (pathStr === "projects") {
      const user = await getUserFromRequest(request);
      if (!user || !user.isAdmin) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const slug = body.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const project = await Project.create({ _id: uuidv4(), ...body, slug });
      return NextResponse.json(project, {
        status: 201,
        headers: getCorsHeaders(),
      });
    }

    // Client Projects (admin only)
    if (pathStr === "client-projects") {
      const user = await getUserFromRequest(request);
      if (!user || !user.isAdmin) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const title = cleanString(body.title, "Project title", 200, {
        required: true,
      });
      const status = body.status || "in_progress";
      if (!PROJECT_STATUSES.has(status))
        throw apiError("Invalid project status");
      const normalizedPlan = normalizeMilestonePlan(body.milestones || [], []);
      const milestones = normalizedPlan.map((milestone, index) => {
        const source = body.milestones?.[index] || {};
        const milestoneStatus = source.status || "pending";
        if (!ITEM_STATUSES.has(milestoneStatus)) {
          throw apiError("Invalid milestone status");
        }
        const startedAt = new Date();
        const normalizedTasks = milestone.tasks.map((task, taskIndex) => {
          const taskStatus = source.tasks?.[taskIndex]?.status || "pending";
          if (!ITEM_STATUSES.has(taskStatus))
            throw apiError("Invalid task status");
          return {
            ...task,
            status: taskStatus,
            workStartedAt: taskStatus === "pending" ? null : startedAt,
          };
        });
        return {
          ...milestone,
          status: milestoneStatus,
          workStartedAt:
            milestoneStatus !== "pending" ||
            normalizedTasks.some((task) => task.workStartedAt)
              ? startedAt
              : null,
          revision: 1,
          changeHistory: [],
          tasks: normalizedTasks,
        };
      });
      const clientName = cleanString(body.clientName, "Client name", 200);
      const clientSlug = slugify(clientName || title);
      const project = await ClientProject.create({
        _id: uuidv4(),
        clientUserId:
          typeof body.clientUserId === "string" ? body.clientUserId : null,
        clientName,
        clientEmail: cleanString(body.clientEmail, "Client email", 320),
        clientSlug,
        title,
        description: cleanString(
          body.description,
          "Project description",
          100000,
        ),
        requirements: cleanString(
          body.requirements,
          "Project requirements",
          100000,
        ),
        status,
        githubRepoUrl: cleanString(body.githubRepoUrl, "GitHub URL", 2000),
        livePreviewUrl: cleanString(
          body.livePreviewUrl,
          "Live preview URL",
          2000,
        ),
        coverImageUrl: cleanString(body.coverImageUrl, "Cover image URL", 2000),
        category: cleanString(body.category, "Category", 200),
        color: cleanString(body.color || "blue", "Color", 100),
        publishToHomepage: body.publishToHomepage === true,
        milestones,
        events: [
          {
            _id: uuidv4(),
            type: "created",
            body: "Project created",
            actorName: user.name || "Admin",
            createdAt: new Date(),
          },
        ],
      });
      // Create the Cloudinary folder tree for this client (+ admin folder).
      ensureClientFolders(clientSlug).catch(() => {});
      ensureAdminFolders().catch(() => {});
      const clientId = await resolveClientUserId(project);
      await notifyUser({
        userId: clientId,
        actorId: user._id,
        type: "project_created",
        title: `Your project is live: ${project.title}`,
        body: "You can now follow its progress in your dashboard.",
        link: `/dashboard/projects/${project._id}`,
        entityType: "project",
        entityId: project._id,
        email: true,
      });
      return NextResponse.json(project, {
        status: 201,
        headers: getCorsHeaders(),
      });
    }

    // Project proposal lifecycle. A proposal always belongs to an existing
    // ClientProject; accepting a later phase appends to that same project.
    if (path[0] === "client-projects" && path[1] && path[2] === "proposals") {
      const user = await getUserFromRequest(request);
      if (!user) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const project = await ClientProject.findById(path[1]);
      if (!project) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404, headers: getCorsHeaders() },
        );
      }
      if (!canAccessClientProject(user, project)) {
        return NextResponse.json(
          { error: "Forbidden" },
          { status: 403, headers: getCorsHeaders() },
        );
      }

      // POST /client-projects/:projectId/proposals (admin creates a draft).
      if (!path[3]) {
        if (!user.isAdmin) {
          return NextResponse.json(
            { error: "Forbidden" },
            { status: 403, headers: getCorsHeaders() },
          );
        }
        const lastProposal = await ProjectProposal.findOne({
          projectId: project._id,
        })
          .sort({ phaseNumber: -1 })
          .select("phaseNumber");
        const phaseNumber = Math.max(2, (lastProposal?.phaseNumber || 1) + 1);
        const sourceProposal = body.sourceProposalId
          ? await ProjectProposal.findOne({
              _id: body.sourceProposalId,
              projectId: project._id,
            })
          : null;
        if (body.sourceProposalId && !sourceProposal) {
          return NextResponse.json(
            { error: "Source proposal not found" },
            { status: 404, headers: getCorsHeaders() },
          );
        }
        const fields = normalizeProposalFields(
          {
            ...(sourceProposal?.toObject?.() || {}),
            ...body,
            phaseLabel: body.phaseLabel || `Faza ${phaseNumber}`,
          },
          null,
        );
        try {
          const proposal = await ProjectProposal.create({
            _id: uuidv4(),
            projectId: project._id,
            requestId: null,
            clientUserId: project.clientUserId || null,
            kind: "phase",
            phaseNumber,
            ...fields,
            status: "draft",
            version: 1,
            revisionHistory: [],
            createdByUserId: user._id,
            sentAt: null,
            acceptedAt: null,
            rejectedAt: null,
          });
          return NextResponse.json(proposal, {
            status: 201,
            headers: getCorsHeaders(),
          });
        } catch (error) {
          if (error?.code === 11000) {
            throw apiError(
              "Another proposal already uses that phase number; refresh and try again",
              409,
            );
          }
          throw error;
        }
      }

      const proposal = await ProjectProposal.findOne({
        _id: path[3],
        projectId: project._id,
      });
      if (!proposal) {
        return NextResponse.json(
          { error: "Proposal not found" },
          { status: 404, headers: getCorsHeaders() },
        );
      }
      const action = path[4];
      const now = new Date();

      if (action === "send") {
        if (!user.isAdmin) {
          return NextResponse.json(
            { error: "Forbidden" },
            { status: 403, headers: getCorsHeaders() },
          );
        }
        if (proposal.status !== "draft") {
          return NextResponse.json(
            { error: "Only a draft proposal can be sent" },
            { status: 409, headers: getCorsHeaders() },
          );
        }
        if (proposal.sentAt) proposal.version += 1;
        proposal.status = "sent";
        proposal.sentAt = now;
        await proposal.save();
        await ClientProject.updateOne(
          { _id: project._id },
          {
            $push: {
              events: {
                _id: uuidv4(),
                type: "project_proposal_sent",
                body: `${proposal.phaseLabel} v${proposal.version} sent`,
                actorName: user.name || "Admin",
                createdAt: now,
              },
            },
            $inc: { __v: 1 },
          },
        );
        const clientId = await resolveClientUserId(project);
        await notifyUser({
          userId: clientId,
          actorId: user._id,
          type: "project_proposal_sent",
          title: `Proposal ready: ${proposal.phaseLabel}`,
          body: `${proposal.title} is ready for your review.`,
          link: `/dashboard/projects/${project._id}?proposal=${proposal._id}`,
          entityType: "project",
          entityId: project._id,
          proposalId: proposal._id,
          email: true,
        });
        return NextResponse.json(proposal, { headers: getCorsHeaders() });
      }

      // Pull a sent proposal back before the client has acted on it, so it
      // can be corrected and sent again. Only `sent` is reversible: once the
      // client has accepted there are live milestones behind it (that is what
      // `archive` is for), and once they have rejected or asked for changes
      // their answer is part of the record.
      if (action === "withdraw") {
        if (!user.isAdmin) return forbiddenResponse();
        if (proposal.status !== "sent") {
          throw apiError("Only a sent proposal can be withdrawn", 409);
        }
        proposal.status = "draft";
        proposal.sentAt = null;
        await proposal.save();
        await ClientProject.updateOne(
          { _id: project._id },
          {
            $push: {
              events: {
                _id: uuidv4(),
                type: "project_proposal_withdrawn",
                body: `${proposal.phaseLabel} withdrawn before the client responded`,
                actorName: user.name || user.email || "",
                createdAt: now,
              },
            },
            $inc: { __v: 1 },
          },
        );
        return NextResponse.json(proposal, { headers: getCorsHeaders() });
      }

      // Admin-only removal of an accepted follow-up phase. The accepted
      // proposal snapshot and all messages remain archived for audit; only
      // untouched operational milestones are removed from the live project.
      if (action === "archive") {
        if (!user.isAdmin) {
          return NextResponse.json(
            { error: "Forbidden" },
            { status: 403, headers: getCorsHeaders() },
          );
        }
        const reason = cleanString(body.reason, "Deletion reason", 5000, {
          required: true,
        });
        if (body.confirmation !== "DELETE") {
          return NextResponse.json(
            { error: "Deletion confirmation is required" },
            { status: 400, headers: getCorsHeaders() },
          );
        }
        // Operator override of the started-work guard. It never widens WHAT
        // may be removed — the master proposal and non-accepted statuses are
        // still refused inside preparePhaseArchive — only whether work that
        // has already begun blocks it. Gated on a second, explicit
        // confirmation so it can never be the result of one stray click.
        const forceArchive = body.force === true;
        if (forceArchive && body.forceConfirmation !== "DELETE STARTED WORK") {
          return NextResponse.json(
            {
              error: "Force deletion requires its own confirmation phrase",
            },
            { status: 400, headers: getCorsHeaders() },
          );
        }

        const proposalHasStoredRecipient =
          proposal.archiveRecipientUserId !== null &&
          proposal.archiveRecipientUserId !== undefined;
        const fallbackRecipientUserId = proposalHasStoredRecipient
          ? proposal.archiveRecipientUserId || null
          : (await resolveClientUserId(project)) || null;
        const session = await ClientProject.db.startSession();
        let archivePlan;
        let archived;
        let transitioned = false;

        try {
          await session.withTransaction(async () => {
            const txProject = await ClientProject.findById(project._id).session(
              session,
            );
            const txProposal = await ProjectProposal.findOne({
              _id: proposal._id,
              projectId: project._id,
            }).session(session);
            if (!txProject) throw apiError("Project not found", 404);
            if (!txProposal) throw apiError("Proposal not found", 404);

            archivePlan = preparePhaseArchive(
              txProposal,
              txProject.milestones,
              { force: forceArchive },
            );
            const hasStoredRecipient =
              txProposal.archiveRecipientUserId !== null &&
              txProposal.archiveRecipientUserId !== undefined;
            let recipientUserId = hasStoredRecipient
              ? txProposal.archiveRecipientUserId || null
              : txProject.clientUserId || null;
            if (
              !hasStoredRecipient &&
              !recipientUserId &&
              txProject.clientEmail
            ) {
              const recipient = await User.findOne({
                email: txProject.clientEmail,
              })
                .select("_id")
                .session(session);
              recipientUserId = recipient?._id || null;
            }
            if (!hasStoredRecipient && !recipientUserId) {
              recipientUserId = fallbackRecipientUserId || null;
            }

            const projectUpdate = await ClientProject.updateOne(
              { _id: txProject._id, __v: txProject.__v },
              {
                $addToSet: { archivedProposalIds: txProposal._id },
                $pull: { milestones: { proposalId: txProposal._id } },
                $inc: { __v: 1 },
              },
              { session },
            );
            if (projectUpdate.matchedCount !== 1) {
              throw apiError(
                "Project state changed; refresh and try deleting the phase again",
                409,
              );
            }

            if (!archivePlan.alreadyArchived) {
              archived = await ProjectProposal.findOneAndUpdate(
                {
                  _id: txProposal._id,
                  projectId: txProject._id,
                  status: "accepted",
                },
                {
                  $set: {
                    status: "archived",
                    archivedAt: now,
                    archivedByUserId: user._id,
                    archivedByName: user.name || "Admin",
                    // Empty string deliberately records that there was no
                    // recipient at archive time; a later project reassignment
                    // must not receive this historical notification.
                    archiveRecipientUserId: recipientUserId || "",
                    // When the override discarded work that had already
                    // begun, say so in the stored reason itself — the phase
                    // row is the only surviving record of what happened.
                    archiveReason: archivePlan.forcedOverStartedWork
                      ? `[Force-deleted over ${archivePlan.startedMilestoneCount} started milestone(s)] ${reason}`
                      : reason,
                  },
                },
                { new: true, runValidators: true, session },
              );
              transitioned = !!archived;
            } else {
              const recoveryFields = {};
              if (!txProposal.archivedAt) recoveryFields.archivedAt = now;
              if (!txProposal.archivedByUserId) {
                recoveryFields.archivedByUserId = user._id;
              }
              if (!txProposal.archivedByName) {
                recoveryFields.archivedByName = user.name || "Admin";
              }
              if (!hasStoredRecipient) {
                recoveryFields.archiveRecipientUserId = recipientUserId || "";
              }
              if (!txProposal.archiveReason) {
                recoveryFields.archiveReason = reason;
              }
              archived = Object.keys(recoveryFields).length
                ? await ProjectProposal.findOneAndUpdate(
                    {
                      _id: txProposal._id,
                      projectId: txProject._id,
                      status: "archived",
                    },
                    { $set: recoveryFields },
                    { new: true, runValidators: true, session },
                  )
                : txProposal;
            }

            if (archived?.status !== "archived") {
              throw apiError(
                "Proposal state changed; only an accepted phase can be deleted",
                409,
              );
            }

            const archivedReason = String(
              archived.archiveReason || reason || "Phase removed by agreement",
            );
            const eventId = uuidv5(
              `proposal-archived:${txProposal._id}`,
              uuidv5.URL,
            );
            await ClientProject.updateOne(
              { _id: txProject._id, "events._id": { $ne: eventId } },
              {
                $push: {
                  events: {
                    _id: eventId,
                    type: "project_proposal_archived",
                    body: `${archived.phaseLabel} removed from active work — ${archivedReason.slice(0, 180)}`,
                    actorName: archived.archivedByName || user.name || "Admin",
                    createdAt: archived.archivedAt || now,
                  },
                },
                $inc: { __v: 1 },
              },
              { session },
            );
          });
        } catch (error) {
          if (
            /transaction numbers are only allowed|does not support transactions/i.test(
              String(error?.message || ""),
            )
          ) {
            throw apiError(
              "Safe phase deletion requires MongoDB transaction support",
              503,
            );
          }
          throw error;
        } finally {
          await session.endSession();
        }

        const archivedReason = String(
          archived.archiveReason || reason || "Phase removed by agreement",
        );
        const clientId = archived.archiveRecipientUserId || null;
        const notificationActorId = archived.archivedByUserId || user._id;
        const notificationResult = await notifyUser({
          userId: clientId,
          actorId: notificationActorId,
          type: "project_proposal_archived",
          title: `Phase removed: ${archived.phaseLabel}`,
          body: archivedReason,
          link: `/dashboard/projects/${project._id}`,
          entityType: "project",
          entityId: project._id,
          dedupeKey: `project-proposal-archived:${proposal._id}`,
          email: true,
        });
        if (
          clientId &&
          String(clientId) !== String(notificationActorId) &&
          !notificationResult
        ) {
          throw apiError(
            "Phase was removed, but the client notification could not be queued; retry this action",
            503,
          );
        }

        const refreshedProject = await ClientProject.findById(project._id);
        return NextResponse.json(
          {
            proposal: archived,
            project: refreshedProject,
            removedMilestoneIds: archivePlan.milestoneIds,
            removedMilestoneCount: archivePlan.milestoneCount,
            alreadyArchived: !transitioned,
          },
          { headers: getCorsHeaders() },
        );
      }

      // Client decisions cannot be performed by an admin on the client's
      // behalf through these ordinary lifecycle endpoints.
      if (["accept", "request-changes", "reject"].includes(action)) {
        if (!canPerformClientProposalAction(user, project)) {
          return NextResponse.json(
            { error: "Only the project owner can perform this action" },
            { status: 403, headers: getCorsHeaders() },
          );
        }
      }

      if (action === "accept") {
        // An already accepted proposal is a successful idempotent replay. The
        // reconciliation still runs so a previous partial failure self-heals.
        let accepted = proposal;
        let transitioned = false;
        if (proposal.status === "sent") {
          accepted = await ProjectProposal.findOneAndUpdate(
            { _id: proposal._id, projectId: project._id, status: "sent" },
            { $set: { status: "accepted", acceptedAt: now } },
            { new: true },
          );
          transitioned = !!accepted;
          if (!accepted) {
            accepted = await ProjectProposal.findOne({
              _id: proposal._id,
              projectId: project._id,
            });
          }
        }
        if (accepted?.status !== "accepted") {
          return NextResponse.json(
            { error: "Only a sent proposal can be accepted" },
            { status: 409, headers: getCorsHeaders() },
          );
        }
        const addedMilestones = await reconcileProposalMilestones(
          project._id,
          accepted,
          project.clientName || user.name || "Client",
        );
        if (transitioned) {
          await notifyAdmins({
            actorId: user._id,
            type: "project_proposal_accepted",
            title: `Proposal accepted: ${accepted.phaseLabel}`,
            body: `${project.clientName || "The client"} accepted ${accepted.title}.`,
            link: `/admin?tab=client-projects&id=${project._id}&proposal=${accepted._id}`,
            entityType: "project",
            entityId: project._id,
            proposalId: accepted._id,
            email: true,
          });
        }
        const refreshedProject = await ClientProject.findById(project._id);
        return NextResponse.json(
          { proposal: accepted, project: refreshedProject, addedMilestones },
          { headers: getCorsHeaders() },
        );
      }

      if (action === "request-changes") {
        if (proposal.status !== "sent") {
          return NextResponse.json(
            { error: "Changes can only be requested on a sent proposal" },
            { status: 409, headers: getCorsHeaders() },
          );
        }
        const reason = cleanString(
          body.reason ?? body.body,
          "Change request",
          5000,
        );
        const changed = await ProjectProposal.findOneAndUpdate(
          { _id: proposal._id, projectId: project._id, status: "sent" },
          { $set: { status: "changes_requested" } },
          { new: true },
        );
        if (!changed) {
          return NextResponse.json(
            { error: "Proposal state changed; refresh and try again" },
            { status: 409, headers: getCorsHeaders() },
          );
        }
        await ClientProject.updateOne(
          { _id: project._id },
          {
            $push: {
              events: {
                _id: uuidv4(),
                type: "project_proposal_changes_requested",
                body: `${proposal.phaseLabel}: changes requested${reason ? ` — ${reason.slice(0, 180)}` : ""}`,
                actorName: project.clientName || user.name || "Client",
                createdAt: now,
              },
            },
            $inc: { __v: 1 },
          },
        );
        await notifyAdmins({
          actorId: user._id,
          type: "project_proposal_changes_requested",
          title: `Changes requested: ${proposal.phaseLabel}`,
          body:
            reason ||
            `${project.clientName || "The client"} requested changes.`,
          link: `/admin?tab=client-projects&id=${project._id}&proposal=${proposal._id}`,
          entityType: "project",
          entityId: project._id,
          proposalId: proposal._id,
          email: true,
        });
        return NextResponse.json(changed, { headers: getCorsHeaders() });
      }

      if (action === "reject") {
        const rejected = await ProjectProposal.findOneAndUpdate(
          { _id: proposal._id, projectId: project._id, status: "sent" },
          { $set: { status: "rejected", rejectedAt: now } },
          { new: true },
        );
        if (!rejected) {
          return NextResponse.json(
            { error: "Only a sent proposal can be rejected" },
            { status: 409, headers: getCorsHeaders() },
          );
        }
        await notifyAdmins({
          actorId: user._id,
          type: "project_proposal_rejected",
          title: `Proposal rejected: ${proposal.phaseLabel}`,
          body: `${project.clientName || "The client"} rejected ${proposal.title}.`,
          link: `/admin?tab=client-projects&id=${project._id}&proposal=${proposal._id}`,
          entityType: "project",
          entityId: project._id,
          proposalId: proposal._id,
          email: true,
        });
        return NextResponse.json(rejected, { headers: getCorsHeaders() });
      }

      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: getCorsHeaders() },
      );
    }

    // Post a chat message to a milestone (admin or owner client)
    // Create an invitation for a new collaborator/viewer.
    if (
      pathStr.startsWith("client-projects/") &&
      path[2] === "invitations" &&
      !path[3]
    ) {
      const user = await requireAuthenticatedUser(request);
      const id = path[1];
      const project = await ClientProject.findById(id);
      if (!project) return notFoundResponse("Project not found");
      await requireProjectPermission(user, project, "membersInvite");
      const sanitized = sanitizeInvitationPayload(body);

      if (
        project.clientEmail &&
        normalizeEmail(project.clientEmail) === sanitized.email
      ) {
        throw apiError("This is already the project owner's email", 400);
      }

      // "Already a member" can only be true if a real account exists for this
      // address — someone who never registered obviously has no membership
      // row yet, which is exactly the normal case being invited for the first
      // time.
      const existingUser = await User.findOne({ email: sanitized.email });
      const existingMembership = existingUser
        ? await ProjectMember.findOne({
            projectId: id,
            userId: existingUser._id,
          })
        : null;
      const existingInvitation = await ProjectInvitation.findOne({
        projectId: id,
        emailNormalized: sanitized.email,
        status: "pending",
      });
      const action = resolveInvitationAction({
        membershipStatus: existingMembership?.status,
        invitationStatus: existingInvitation?.status,
      });
      if (action === "already_member") {
        throw apiError("This person is already a member of this project", 409);
      }
      if (action === "pending_exists") {
        return NextResponse.json(
          {
            error: "An invitation is already pending for this email",
            invitationId: existingInvitation._id,
          },
          { status: 409, headers: getCorsHeaders() },
        );
      }

      const rawToken = generateInviteToken();
      const invitation = await ProjectInvitation.create({
        _id: uuidv4(),
        projectId: id,
        emailNormalized: sanitized.email,
        invitedByUserId: user._id,
        invitedByName: user.name || user.email,
        intendedRole: sanitized.intendedRole,
        roleLabel: sanitized.roleLabel,
        tokenHash: hashInviteToken(rawToken),
        status: "pending",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        personalMessage: sanitized.personalMessage,
      });

      await ProjectAuditLog.create({
        _id: uuidv4(),
        projectId: id,
        actorUserId: user._id,
        actorName: user.name || user.email || "",
        targetEmail: sanitized.email,
        eventType: "invitation.created",
        metadata: { intendedRole: sanitized.intendedRole },
      }).catch((e) =>
        console.error("audit insert failed (invitation created):", e),
      );

      try {
        const inviteUrl = `${resolveAppUrl(request)}/invite?token=${rawToken}`;
        const template = emailTemplates.projectInvite({
          inviterName: user.name || user.email,
          projectTitle: project.title,
          roleLabel: displayRoleLabel(
            sanitized.intendedRole,
            sanitized.roleLabel,
          ),
          inviteUrl,
          recipientEmail: sanitized.email,
          expiresAt: invitation.expiresAt,
          personalMessage: sanitized.personalMessage,
        });
        await sendEmail({ to: sanitized.email, ...template, type: "project" });
      } catch (error) {
        console.error("Failed to send invitation email:", error);
      }

      return NextResponse.json(serializeInvitationForManager(invitation), {
        status: 201,
        headers: getCorsHeaders(),
      });
    }

    // Resend an invitation: new token, new expiry. The old link stops working
    // the moment tokenHash changes — nothing else needs to revoke it.
    if (
      pathStr.startsWith("client-projects/") &&
      path[2] === "invitations" &&
      path[3] &&
      path[4] === "resend"
    ) {
      const user = await requireAuthenticatedUser(request);
      const id = path[1];
      const project = await ClientProject.findById(id);
      if (!project) return notFoundResponse("Project not found");
      await requireProjectPermission(user, project, "membersInvite");
      const invitation = await ProjectInvitation.findOne({
        _id: path[3],
        projectId: id,
      });
      if (!invitation) return notFoundResponse("Invitation not found");
      if (invitation.status !== "pending") {
        throw apiError("Only a pending invitation can be resent", 409);
      }
      const rawToken = generateInviteToken();
      invitation.tokenHash = hashInviteToken(rawToken);
      invitation.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await invitation.save();

      await ProjectAuditLog.create({
        _id: uuidv4(),
        projectId: id,
        actorUserId: user._id,
        actorName: user.name || user.email || "",
        targetEmail: invitation.emailNormalized,
        eventType: "invitation.resent",
        metadata: {},
      }).catch((e) =>
        console.error("audit insert failed (invitation resent):", e),
      );

      try {
        const inviteUrl = `${resolveAppUrl(request)}/invite?token=${rawToken}`;
        const template = emailTemplates.projectInvite({
          inviterName: user.name || user.email,
          projectTitle: project.title,
          roleLabel: displayRoleLabel(
            invitation.intendedRole,
            invitation.roleLabel,
          ),
          inviteUrl,
          recipientEmail: invitation.emailNormalized,
          expiresAt: invitation.expiresAt,
          personalMessage: invitation.personalMessage,
        });
        await sendEmail({
          to: invitation.emailNormalized,
          ...template,
          type: "project",
        });
      } catch (error) {
        console.error("Failed to send invitation email:", error);
      }

      return NextResponse.json(serializeInvitationForManager(invitation), {
        headers: getCorsHeaders(),
      });
    }

    // Accept an invitation. Auth required; token from the body or the
    // HttpOnly cookie GET /invitations/preview set.
    if (pathStr === "invitations/accept") {
      const user = await requireAuthenticatedUser(request);
      const token =
        body.token || request.cookies.get(INVITE_COOKIE_NAME)?.value;
      if (!token) {
        throw apiError("Invitation token is required", 400);
      }
      // A dead invitation (revoked/accepted/expired) or an email mismatch
      // means this token is spent either way — clear the cookie the same as
      // on success (I4), rather than leaving a dead token to linger in it for
      // up to an hour.
      try {
        const invitation = await ProjectInvitation.findOne({
          tokenHash: hashInviteToken(token),
        });
        if (!invitation) {
          return clearInviteCookie(notFoundResponse("Invitation not found"));
        }
        assertInvitationAcceptable(invitation, user.email);
        const project = await ClientProject.findById(invitation.projectId);
        if (!project) {
          return clearInviteCookie(notFoundResponse("Project not found"));
        }

        await acceptInvitationForUser(invitation, project, user);

        const response = NextResponse.json(
          { message: "Invitation accepted", projectId: project._id },
          { status: 200, headers: getCorsHeaders() },
        );
        return clearInviteCookie(response);
      } catch (error) {
        return clearInviteCookie(errorResponse(error, "POST"));
      }
    }

    // A collaborator/viewer removes themselves. Owner/admin have no
    // leaveProject permission — there is no membership row for them to leave.
    if (pathStr.startsWith("client-projects/") && path[2] === "leave") {
      const user = await requireAuthenticatedUser(request);
      const id = path[1];
      const project = await ClientProject.findById(id);
      if (!project) return notFoundResponse("Project not found");
      await requireProjectPermission(user, project, "leaveProject");
      const member = await ProjectMember.findOne({
        projectId: id,
        userId: user._id,
        status: "active",
      });
      if (!member) return notFoundResponse("Membership not found");
      member.status = "removed";
      await member.save();

      await ProjectAuditLog.create({
        _id: uuidv4(),
        projectId: id,
        actorUserId: user._id,
        actorName: user.name || user.email || "",
        targetUserId: user._id,
        targetEmail: user.email || "",
        eventType: "member.left",
        metadata: {},
      }).catch((e) => console.error("audit insert failed (member left):", e));

      return NextResponse.json(
        { message: "Left project" },
        { headers: getCorsHeaders() },
      );
    }

    // POST /api/chat/channels/:id/messages — send a message.
    if (pathStr.startsWith("chat/channels/") && path[3] === "messages") {
      const user = await requireAuthenticatedUser(request);
      const { channel, project, access } = await loadChannelWithAccess(
        path[2],
        user,
        "chatWrite",
      );
      const roster = await loadChannelRoster(project);

      let replyToMessage = null;
      if (body.replyToMessageId) {
        replyToMessage = await ChatMessage.findById(body.replyToMessageId);
        if (!replyToMessage) throw apiError("Replied message not found", 400);
      }

      const sanitized = sanitizeChatMessagePayload(body, {
        accessObj: access,
        channel,
        members: roster,
        replyToMessage,
      });

      const authorRole =
        access.role === "admin"
          ? "admin"
          : access.role === "owner"
            ? "client"
            : "member";

      const message = await ChatMessage.create({
        _id: uuidv4(),
        channelId: channel._id,
        projectId: channel.projectId,
        authorUserId: user._id,
        authorName: user.name || user.email,
        authorRole,
        body: sanitized.body,
        attachments: sanitized.attachments,
        flag: sanitized.flag,
        kind: "user",
        replyToMessageId: sanitized.replyToMessageId,
        replyToPreview: sanitized.replyToPreview,
        mentions: sanitized.mentions,
      });

      // Sending implicitly marks the channel read for the sender — never show
      // someone their own message as unread.
      await ChatRead.updateOne(
        { channelId: channel._id, userId: user._id },
        { $set: { lastReadAt: new Date(), lastReadMessageId: message._id } },
        { upsert: true },
      );

      // Notification fan-out (I6): recipients are computed from the roster/DM
      // membership resolved above — the CURRENT active state, never a stale
      // list. Mentions only ever resolve to roster entries (loadChannelRoster
      // excludes global admins as mention candidates), so the admin leg below
      // is always a plain "chat_message", never "chat_mention".
      const preview = sanitized.body
        ? sanitized.body.slice(0, 140)
        : "(attachment)";
      const mentionedIds = new Set((sanitized.mentions || []).map(String));

      // Deep link down to the MESSAGE, not just the channel. `?channel=` alone
      // dropped the reader at the bottom of a thread and left them to find
      // what the notification was about; `&m=` makes the chat scroll to and
      // highlight it (loading older pages first if it has scrolled out of the
      // first page). Two link shapes because the operator's chat lives in the
      // admin panel and everyone else's on the client dashboard.
      const chatLinkFor = (isAdminUser) =>
        isAdminUser
          ? `/admin?tab=chat&channel=${channel._id}&m=${message._id}`
          : `/dashboard/chat?channel=${channel._id}&m=${message._id}`;

      if (channel.kind === "dm") {
        const otherUserId = (channel.memberUserIds || []).find(
          (uid) => uid !== String(user._id),
        );
        if (otherUserId) {
          const otherUser = await User.findById(otherUserId).select("isAdmin");
          const isMentioned = mentionedIds.has(String(otherUserId));
          await notifyUser({
            userId: otherUserId,
            actorId: user._id,
            type: isMentioned ? "chat_mention" : "chat_message",
            title: isMentioned
              ? `${message.authorName} mentioned you`
              : `New direct message from ${message.authorName}`,
            body: preview,
            link: chatLinkFor(otherUser?.isAdmin),
            entityType: "project",
            entityId: project._id,
            channelId: channel._id,
            email: true,
          });
        }
      } else {
        // Everyone else currently in the group (owner + active members).
        // Pre-load the set of admin user IDs once so every roster row can
        // decide whether its notification link should point to the Admin
        // Panel or the Client Dashboard without N per-member round-trips.
        const adminIdSet = new Set(
          (await User.find({ isAdmin: true }).select("_id")).map((a) =>
            String(a._id),
          ),
        );
        await Promise.all(
          roster
            .filter((r) => String(r.userId) !== String(user._id))
            .map((r) => {
              const isMentioned = mentionedIds.has(String(r.userId));
              const isAdminUser = adminIdSet.has(String(r.userId));
              return notifyUser({
                userId: r.userId,
                actorId: user._id,
                type: isMentioned ? "chat_mention" : "chat_message",
                title: isMentioned
                  ? `${message.authorName} mentioned you in ${project.title}`
                  : `New message in ${project.title}`,
                body: preview,
                link: chatLinkFor(isAdminUser),
                entityType: "project",
                entityId: project._id,
                channelId: channel._id,
                email: true,
              });
            }),
        );
        // Admins too — unless the author already is one (mirrors the existing
        // milestone-chat convention: an admin's own message doesn't re-notify
        // the rest of the admin team).
        //
        // Anyone already reached through the roster above is skipped here: an
        // admin who also accepted an invitation to this project is in BOTH
        // lists and was otherwise getting two notifications for one message.
        // Reuse the adminIdSet already loaded above — no second DB round-trip.
        if (access.role !== "admin") {
          const alreadyNotified = new Set(roster.map((r) => String(r.userId)));
          await Promise.all(
            [...adminIdSet]
              .filter((id) => !alreadyNotified.has(id))
              .map((adminId) =>
                notifyUser({
                  userId: adminId,
                  actorId: user._id,
                  type: "chat_message",
                  title: `New message in ${project.title}`,
                  body: `${message.authorName}: ${preview}`,
                  link: chatLinkFor(true),
                  entityType: "project",
                  entityId: project._id,
                  channelId: channel._id,
                  email: true,
                }),
              ),
          );
        }
      }

      return NextResponse.json(serializeChatMessageForAccess(message, access), {
        status: 201,
        headers: getCorsHeaders(),
      });
    }

    // POST /api/chat/channels/:id/read — mark everything up to now (or a
    // specific message) as read.
    if (pathStr.startsWith("chat/channels/") && path[3] === "read") {
      const user = await requireAuthenticatedUser(request);
      const { channel } = await loadChannelWithAccess(
        path[2],
        user,
        "chatRead",
      );
      await ChatRead.updateOne(
        { channelId: channel._id, userId: user._id },
        {
          $set: {
            lastReadAt: new Date(),
            lastReadMessageId: body?.messageId || null,
          },
        },
        { upsert: true },
      );
      return NextResponse.json(
        { message: "Marked as read" },
        { headers: getCorsHeaders() },
      );
    }

    // POST /api/chat/channels/:id/clear — hide everything up to now for the
    // caller only; everyone else's view (and the project's history) is
    // untouched.
    if (pathStr.startsWith("chat/channels/") && path[3] === "clear") {
      const user = await requireAuthenticatedUser(request);
      const { channel } = await loadChannelWithAccess(
        path[2],
        user,
        "chatRead",
      );
      const now = new Date();
      await ChatRead.updateOne(
        { channelId: channel._id, userId: user._id },
        { $set: { lastReadAt: now, clearedAt: now } },
        { upsert: true },
      );
      return NextResponse.json(
        { message: "Conversation cleared" },
        { headers: getCorsHeaders() },
      );
    }

    // POST /api/chat/channels/:id/purge — { scope: "all" | "older_than",
    // days? } — HARD delete of a channel's history, for everyone, with no undo.
    //
    // The third and only destructive delete verb in the chat (see
    // canPurgeChannel): `/clear` above is a per-viewer watermark, DELETE
    // /chat/messages/:id soft-deletes one row. This one calls deleteMany.
    // Works on any channel the caller can reach — the project group channel and
    // a DM alike; loadChannelWithAccess already 404s a DM the caller isn't in.
    if (pathStr.startsWith("chat/channels/") && path[3] === "purge") {
      const user = await requireAuthenticatedUser(request);
      const { channel, project, access } = await loadChannelWithAccess(
        path[2],
        user,
        "chatRead",
      );
      // Throws ChatPermissionError (403) unless the caller can moderate, and
      // resolves `days` into one absolute cutoff used by every query below.
      const purge = sanitizePurgePayload(body, access);

      const query = { channelId: channel._id };
      if (purge.before) query.createdAt = { $lt: purge.before };

      // Counted BEFORE the delete, while the rows still exist. A message that
      // was converted into a request or a decision is the one thing a purge
      // cannot leave intact — the formal record's sourceMessageId will dangle —
      // so the operator gets told how many links they just broke.
      const convertedCount = await ChatMessage.countDocuments({
        ...query,
        "convertedTo.0": { $exists: true },
      });
      const { deletedCount } = await ChatMessage.deleteMany(query);

      // Deep delete reaches the bell too. A chat notification carries a
      // 140-character copy of the message body and an `?m=` link to a row that
      // no longer exists; leaving those behind would keep quoting text that was
      // just deleted everywhere else. Notification and message are written in
      // the same request, so the message cutoff selects the right ones.
      const notificationQuery = {
        channelId: channel._id,
        type: { $in: ["chat_message", "chat_mention"] },
      };
      if (purge.before) notificationQuery.createdAt = { $lt: purge.before };
      const purgedNotifications =
        await Notification.deleteMany(notificationQuery);

      // Why the channel emptied, in the channel itself. Without it a purge
      // reads to every other participant as the chat having lost their history.
      // Posted after the delete so it survives its own purge.
      //
      // Best-effort from here down, like the post-commit side effects on
      // invitation acceptance: the messages are already gone, so throwing now
      // would answer "failed to delete" to a request that did delete.
      const actorName = user.name || user.email || "The operator";
      if (deletedCount > 0) {
        try {
          await postSystemMessage(
            channel,
            purge.scope === "all"
              ? `${actorName} permanently deleted all ${deletedCount} messages in this conversation.`
              : `${actorName} permanently deleted ${deletedCount} messages older than ${purge.days} days.`,
          );
        } catch (e) {
          console.error("purge notice failed to post:", e);
        }
      }

      // The only remaining record that those messages ever existed.
      try {
        await ProjectAuditLog.create({
          _id: uuidv4(),
          projectId: project._id,
          actorUserId: user._id,
          actorName: user.name || user.email || "",
          eventType: "chat.purged",
          metadata: {
            channelId: channel._id,
            channelKind: channel.kind,
            scope: purge.scope,
            days: purge.days,
            before: purge.before,
            deletedCount,
            convertedCount,
            notificationsDeleted: purgedNotifications.deletedCount || 0,
          },
        });
      } catch (e) {
        console.error("audit insert failed (chat purged):", e);
      }

      return NextResponse.json(
        {
          message:
            purge.scope === "all"
              ? `Deleted ${deletedCount} messages`
              : `Deleted ${deletedCount} messages older than ${purge.days} days`,
          scope: purge.scope,
          days: purge.days,
          before: purge.before,
          deletedCount,
          convertedCount,
        },
        { headers: getCorsHeaders() },
      );
    }

    // POST /api/chat/dm — get-or-create a direct-message channel with a
    // fellow participant of the SAME project. The target must already have a
    // real relationship to the project (owner, admin, or active member) —
    // otherwise this would be a way to message an arbitrary stranger by
    // guessing their user id.
    if (pathStr === "chat/dm") {
      const user = await requireAuthenticatedUser(request);
      const { projectId, userId: targetUserId } = body;
      if (!projectId || !targetUserId) {
        throw apiError("projectId and userId are required", 400);
      }
      const project = await ClientProject.findById(projectId);
      if (!project) return notFoundResponse("Project not found");
      const access = await requireProjectPermission(user, project, "chatWrite");

      const targetUser = await User.findById(targetUserId);
      if (!targetUser) return notFoundResponse("User not found");
      const targetAccess = await resolveProjectAccess(targetUser, project);
      if (targetAccess.role === null) {
        throw apiError("That person is not part of this project", 400);
      }

      const channel = await getOrCreateDmChannel(
        project,
        user._id,
        targetUserId,
      );
      return NextResponse.json(
        serializeChannelSummary(channel, { accessObj: access }),
        { headers: getCorsHeaders() },
      );
    }

    // POST /api/chat/messages/:id/pin — { pinned }.
    if (pathStr.startsWith("chat/messages/") && path[3] === "pin") {
      const user = await requireAuthenticatedUser(request);
      const { message, access } = await loadMessageWithAccess(
        path[2],
        user,
        "pin",
      );
      const pinned = body?.pinned !== false;
      message.pinned = pinned;
      message.pinnedAt = pinned ? new Date() : null;
      message.pinnedByUserId = pinned ? user._id : null;
      await message.save();
      return NextResponse.json(serializeChatMessageForAccess(message, access), {
        headers: getCorsHeaders(),
      });
    }

    // POST /api/chat/messages/:id/convert — turn a flagged message into a
    // formal record: an item (idea/problem/incident/decision — open to
    // collaborators too, that's the point of letting the team capture things
    // as they come up), or a request/task/milestone comment (owner/admin
    // only — these change the project's actual commitments).
    if (pathStr.startsWith("chat/messages/") && path[3] === "convert") {
      const user = await requireAuthenticatedUser(request);
      const { message, channel, project, access } = await loadMessageWithAccess(
        path[2],
        user,
        "chatRead",
      );
      if (message.deletedAt) {
        throw apiError("Cannot convert a deleted message", 409);
      }
      const sanitized = sanitizeConvertPayload(body?.target, body, access, {
        sourceBody: message.body || "",
      });
      const actorName = user.name || user.email;
      let created;
      let convertedToEntry;

      if (sanitized.target === "item") {
        // Duplicate-ref races are rare (two people converting different
        // messages into the same kind at the same moment) but the unique
        // index on (projectId, kind, ref) is what actually prevents a
        // collision — this loop just makes losing that race a normal,
        // handled outcome (I5), same shape as getOrCreateGroupChannel above.
        // Sorted by createdAt, not ref: a lexicographic sort on the ref
        // string breaks once a kind passes 999 items in one project ("D-1000"
        // sorts before "D-999") — creation order never has that problem.
        for (let attempt = 0; attempt < 5 && !created; attempt++) {
          const last = await ProjectItem.findOne({
            projectId: project._id,
            kind: sanitized.kind,
          }).sort({ createdAt: -1 });
          const ref = nextItemRef(sanitized.kind, last?.ref);
          try {
            created = await ProjectItem.create({
              _id: uuidv4(),
              projectId: project._id,
              kind: sanitized.kind,
              ref,
              title: sanitized.title,
              body: sanitized.body,
              severity: sanitized.severity,
              sourceChannelId: channel._id,
              sourceMessageId: message._id,
              createdByUserId: user._id,
              createdByName: actorName,
              // Converting a message flagged "decision" into a formal Decision
              // record IS the act of confirming it — the converting user is
              // the first confirmation, not a bystander creating an open item.
              confirmedBy:
                sanitized.kind === "decision"
                  ? [{ userId: user._id, name: actorName, at: new Date() }]
                  : [],
              decidedAt: sanitized.kind === "decision" ? new Date() : null,
            });
          } catch (error) {
            if (error?.code !== 11000) throw error;
          }
        }
        if (!created) {
          throw apiError(
            "Could not allocate a reference number, please retry",
            409,
          );
        }
        convertedToEntry = {
          target: "item",
          targetId: created._id,
          kind: created.kind,
          ref: created.ref,
          byUserId: user._id,
          byName: actorName,
        };
      } else if (sanitized.target === "request") {
        // Identity is the PROJECT's client, not the acting user — a
        // ProjectRequest's clientName/-Email/-UserId mean "who this is from"
        // everywhere else in the app, and an admin converting on a client's
        // behalf doesn't change whose request this actually is.
        created = await ProjectRequest.create({
          _id: uuidv4(),
          clientUserId: project.clientUserId,
          clientName: project.clientName,
          clientEmail: project.clientEmail,
          clientSlug: project.clientSlug,
          title: sanitized.title,
          description: sanitized.body,
          status: "new",
          sourceProjectId: project._id,
          sourceMessageId: message._id,
        });
        await notifyAdmins({
          actorId: user._id,
          type: "request_created",
          title: `New project request: ${created.title}`,
          body: `${actorName} converted a chat message into a request on ${project.title}.`,
          link: `/admin?tab=project-requests&id=${created._id}`,
          entityType: "request",
          entityId: created._id,
          email: true,
        });
        convertedToEntry = {
          target: "request",
          targetId: created._id,
          byUserId: user._id,
          byName: actorName,
        };
      } else if (sanitized.target === "task") {
        // Same resource-first idiom as the milestone chat branch below: the
        // milestone is looked up from the already permission-checked
        // project's own array, never a separate collection by client id.
        const milestone = (project.milestones || []).find(
          (item) => String(item._id) === String(sanitized.milestoneId),
        );
        if (!milestone) throw apiError("Milestone not found", 404);
        const newTask = {
          _id: uuidv4(),
          title: sanitized.title,
          description: sanitized.body,
          order: milestone.tasks.length,
          status: "pending",
        };
        milestone.tasks.push(newTask);
        await project.save();
        created = newTask;
        convertedToEntry = {
          target: "task",
          targetId: newTask._id,
          byUserId: user._id,
          byName: actorName,
        };
      } else {
        // milestone_comment
        const milestone = (project.milestones || []).find(
          (item) => String(item._id) === String(sanitized.milestoneId),
        );
        if (!milestone) throw apiError("Milestone not found", 404);
        const authorRole = access.role === "admin" ? "admin" : "client";
        created = await ProjectMessage.create({
          _id: uuidv4(),
          projectId: project._id,
          milestoneId: milestone._id,
          proposalId: milestone.proposalId || null,
          messageType: "message",
          authorUserId: user._id,
          authorName:
            authorRole === "admin"
              ? "DMDevelon"
              : project.clientName || actorName,
          authorRole,
          body: sanitized.body,
        });
        convertedToEntry = {
          target: "milestone_comment",
          targetId: created._id,
          byUserId: user._id,
          byName: actorName,
        };
      }

      message.convertedTo.push(convertedToEntry);
      await message.save();

      return NextResponse.json(
        {
          message: serializeChatMessageForAccess(message, access),
          target: sanitized.target,
          created:
            sanitized.target === "item"
              ? serializeProjectItem(created)
              : { _id: created._id, title: created.title || "" },
        },
        { status: 201, headers: getCorsHeaders() },
      );
    }

    // POST /api/project-items/:id/task — turn an accepted item into real work.
    // Gated by `convertToFormal` (owner + admin), the same permission as
    // converting a message straight into a task: both create a commitment.
    if (pathStr.startsWith("project-items/") && path[2] === "task") {
      const user = await requireAuthenticatedUser(request);
      const item = await ProjectItem.findById(path[1]);
      if (!item) return notFoundResponse("Item not found");
      const project = await ClientProject.findById(item.projectId);
      if (!project) return notFoundResponse("Project not found");
      await requireProjectPermission(user, project, "convertToFormal");

      const milestoneId = cleanString(body.milestoneId, "Milestone", 200, {
        required: true,
      });
      const milestone = (project.milestones || []).find(
        (m) => String(m._id) === String(milestoneId),
      );
      if (!milestone) throw apiError("Milestone not found", 404);

      const newTask = {
        _id: uuidv4(),
        title: item.title,
        description: item.body,
        order: milestone.tasks.length,
        status: "pending",
      };
      milestone.tasks.push(newTask);
      await project.save();

      // Reuse the item's existing milestoneId as the link back to the work it
      // produced — no new field needed for a one-to-one relationship.
      item.milestoneId = milestone._id;
      await item.save();

      return NextResponse.json(
        { item: serializeProjectItem(item), task: newTask },
        { status: 201, headers: getCorsHeaders() },
      );
    }

    // POST /api/project-items/:id/handoff — hand this item off as NEW
    // billable work: a DRAFT phase proposal the admin then prices and sends,
    // and that the client has to accept before any milestone exists.
    //
    // There is deliberately no "add a milestone to an existing phase with
    // approval" variant: `{ projectId, phaseNumber }` is a UNIQUE index
    // (models/ProjectProposal.js), so a phase can only ever have one
    // proposal. New approved work therefore always becomes the next phase.
    // The un-approved variant that used to live here (POST .../milestone,
    // which wrote a live milestone immediately) was removed — new work means
    // new hours and a new price, and must not appear in the client's plan
    // without them agreeing to it.
    if (pathStr.startsWith("project-items/") && path[2] === "handoff") {
      const user = await requireAuthenticatedUser(request);
      const item = await ProjectItem.findById(path[1]);
      if (!item) return notFoundResponse("Item not found");
      const project = await ClientProject.findById(item.projectId);
      if (!project) return notFoundResponse("Project not found");
      // `itemsApprove` is operator-only by construction, matching the existing
      // rule that only an admin drafts a proposal — no role-name check needed.
      await requireProjectPermission(user, project, "itemsApprove");

      if (item.handoffProposalId) {
        const existing = await ProjectProposal.findById(item.handoffProposalId);
        // A live handoff already exists. Only a dead one (deleted, or a phase
        // the client refused) may be superseded, otherwise a double click
        // would quietly burn a phase number.
        if (existing && existing.status !== "rejected") {
          throw apiError(
            "This item has already been handed off; withdraw or delete that proposal first",
            409,
          );
        }
      }

      const lastProposal = await ProjectProposal.findOne({
        projectId: project._id,
      })
        .sort({ phaseNumber: -1 })
        .select("phaseNumber");
      const phaseNumber = Math.max(2, (lastProposal?.phaseNumber || 1) + 1);
      const fields = normalizeProposalFields(
        {
          title: body.title || item.title,
          scope: body.scope ?? item.body ?? "",
          timeline: body.timeline,
          budget: body.budget,
          phaseLabel: body.phaseLabel || `Faza ${phaseNumber}`,
          // The caller may design the whole plan in the handoff dialog; if it
          // sends nothing, seed one milestone carrying the item as its task
          // so the draft is never empty.
          milestonePlan:
            Array.isArray(body.milestonePlan) && body.milestonePlan.length > 0
              ? body.milestonePlan
              : [
                  {
                    title: item.title,
                    description: item.body || "",
                    tasks: [
                      { title: item.title, description: item.body || "" },
                    ],
                  },
                ],
        },
        null,
      );
      try {
        const proposal = await ProjectProposal.create({
          _id: uuidv4(),
          projectId: project._id,
          requestId: null,
          clientUserId: project.clientUserId || null,
          kind: "phase",
          phaseNumber,
          ...fields,
          sourceItemId: item._id,
          sourceItemRef: item.ref || "",
          status: "draft",
          version: 1,
          revisionHistory: [],
          createdByUserId: user._id,
          sentAt: null,
          acceptedAt: null,
          rejectedAt: null,
        });

        item.handoffProposalId = proposal._id;
        await item.save();

        return NextResponse.json(
          { item: serializeProjectItem(item), proposal },
          { status: 201, headers: getCorsHeaders() },
        );
      } catch (error) {
        if (error?.code === 11000) {
          throw apiError(
            "Another proposal already uses that phase number; refresh and try again",
            409,
          );
        }
        throw error;
      }
    }

    if (pathStr.startsWith("client-projects/") && path[2] === "messages") {
      const user = await requireAuthenticatedUser(request);
      const id = path[1];
      const project = await ClientProject.findById(id);
      if (!project) return notFoundResponse("Project not found");
      const access = await requireProjectPermission(
        user,
        project,
        "milestoneComment",
      );
      if (!body.milestoneId) {
        throw apiError("milestoneId is required", 400);
      }
      // The milestone is looked up from the already permission-checked
      // project's own array, never from a separate collection by a
      // client-supplied id — so a milestoneId belonging to another project
      // simply isn't found here, it can never leak that project's data.
      const milestone = (project.milestones || []).find(
        (item) => String(item._id) === String(body.milestoneId),
      );
      if (!milestone) return notFoundResponse("Milestone not found");

      const authorRole =
        access.role === "admin"
          ? "admin"
          : access.role === "owner"
            ? "client"
            : "member";
      // A collaborator/viewer never drives the change_request -> change_agreed
      // flow — that stays between the client and the operator.
      const allowedMessageTypes =
        authorRole === "admin"
          ? new Set(["message", "question", "system", "change_agreed"])
          : authorRole === "client"
            ? new Set(["message", "question", "change_request"])
            : new Set(["message", "question"]);
      const messageType = body.messageType || "message";
      if (!allowedMessageTypes.has(messageType)) {
        return NextResponse.json(
          { error: "Invalid message type" },
          { status: 400, headers: getCorsHeaders() },
        );
      }
      const authorName =
        user.name ||
        (authorRole === "admin"
          ? "DMDevelon"
          : authorRole === "client"
            ? project.clientName
            : "") ||
        user.email;
      const message = await ProjectMessage.create({
        _id: uuidv4(),
        projectId: id,
        milestoneId: body.milestoneId,
        proposalId: milestone.proposalId || null,
        messageType,
        authorUserId: user._id,
        authorName,
        authorRole,
        body: cleanString(body.body, "Message", 10000),
        attachments: Array.isArray(body.attachments) ? body.attachments : [],
      });
      const msgPreview = (body.body || "").slice(0, 140);
      if (authorRole === "admin") {
        const clientId = await resolveClientUserId(project);
        await notifyUser({
          userId: clientId,
          actorId: user._id,
          type: "project_message",
          title: `New message on ${project.title}`,
          body: msgPreview,
          link: `/dashboard/projects/${project._id}?m=${message.milestoneId}`,
          entityType: "project",
          entityId: project._id,
          milestoneId: message.milestoneId,
          proposalId: message.proposalId || "",
          email: true,
        });
      } else if (authorRole === "client") {
        const notificationType =
          messageType === "change_request"
            ? "milestone_change_requested"
            : "project_message";
        await notifyAdmins({
          actorId: user._id,
          type: notificationType,
          title:
            messageType === "change_request"
              ? `Change requested: ${milestone.title}`
              : `Client message on ${project.title}`,
          body: `${project.clientName}: ${msgPreview}`,
          link: `/admin?tab=client-projects&id=${project._id}&m=${message.milestoneId}`,
          entityType: "project",
          entityId: project._id,
          milestoneId: message.milestoneId,
          proposalId: message.proposalId || "",
          email: true,
        });
      } else {
        // Collaborator/viewer message: never a change_request, so this always
        // notifies as a plain project_message. Notifying the client owner too
        // (not just admins) is a Section 10 decision, not made here.
        await notifyAdmins({
          actorId: user._id,
          type: "project_message",
          title: `Message on ${project.title}`,
          body: `${authorName}: ${msgPreview}`,
          link: `/admin?tab=client-projects&id=${project._id}&m=${message.milestoneId}`,
          entityType: "project",
          entityId: project._id,
          milestoneId: message.milestoneId,
          proposalId: message.proposalId || "",
          email: true,
        });
      }
      return NextResponse.json(message, {
        status: 201,
        headers: getCorsHeaders(),
      });
    }

    // Project Requests
    if (pathStr === "project-requests") {
      const user = await getUserFromRequest(request);
      if (!user) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }

      // Admin: convert an existing ContactMessage into a ProjectRequest
      if (body.fromMessageId) {
        if (!user.isAdmin) {
          return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401, headers: getCorsHeaders() },
          );
        }
        const msg = await ContactMessage.findById(body.fromMessageId);
        if (!msg) {
          return NextResponse.json(
            { error: "Message not found" },
            { status: 404, headers: getCorsHeaders() },
          );
        }
        if (msg.convertedToRequestId) {
          return NextResponse.json(
            { error: "Message already converted" },
            { status: 400, headers: getCorsHeaders() },
          );
        }
        const owner = await User.findOne({ email: msg.email });
        const clientName = owner?.name || msg.name;
        const clientSlug = slugify(clientName);
        const now = new Date();
        const messages = [
          {
            _id: uuidv4(),
            authorUserId: owner?._id || null,
            authorName: clientName,
            authorRole: "client",
            type: "message",
            body: msg.message,
            createdAt: msg.createdAt || now,
          },
        ];
        let status = "new";
        if (msg.replyMessage) {
          messages.push({
            _id: uuidv4(),
            authorName: "DMDevelon",
            authorRole: "admin",
            type: "message",
            body: msg.replyMessage,
            createdAt: now,
          });
          status = "discussion";
        }
        const title =
          (msg.message || "")
            .replace(/^\[Project request\]\s*/i, "")
            .split(/[.\n]/)[0]
            .slice(0, 80)
            .trim() || "Project request";
        const reqDoc = await ProjectRequest.create({
          _id: uuidv4(),
          clientUserId: owner?._id || null,
          clientName,
          clientEmail: msg.email,
          clientSlug,
          title,
          description: msg.message,
          status,
          messages,
          lastActivityAt: now,
        });
        msg.convertedToRequestId = reqDoc._id;
        await msg.save();
        ensureClientFolders(clientSlug).catch(() => {});
        return NextResponse.json(reqDoc, {
          status: 201,
          headers: getCorsHeaders(),
        });
      }

      // Client (or admin) creates a request
      if (!body.title) {
        return NextResponse.json(
          { error: "Title is required" },
          { status: 400, headers: getCorsHeaders() },
        );
      }
      const owner = await User.findById(user._id);
      const clientName = owner?.name || body.clientName || user.email;
      const clientEmail = owner?.email || user.email;
      const clientSlug = slugify(clientName);
      const now = new Date();
      const messages = body.description
        ? [
            {
              _id: uuidv4(),
              authorUserId: user._id,
              authorName: clientName,
              authorRole: "client",
              type: "message",
              body: body.description,
              createdAt: now,
            },
          ]
        : [];
      const reqDoc = await ProjectRequest.create({
        _id: uuidv4(),
        clientUserId: user._id,
        clientName,
        clientEmail,
        clientSlug,
        title: body.title,
        description: body.description || "",
        status: "new",
        messages,
        lastActivityAt: now,
      });
      ensureClientFolders(clientSlug).catch(() => {});
      await notifyAdmins({
        actorId: user._id,
        type: "request_created",
        title: `New project request: ${reqDoc.title}`,
        body: `${clientName} submitted a new request.`,
        link: `/admin?tab=project-requests&id=${reqDoc._id}`,
        entityType: "request",
        entityId: reqDoc._id,
        email: true,
      });
      return NextResponse.json(reqDoc, {
        status: 201,
        headers: getCorsHeaders(),
      });
    }

    // Project Request sub-actions (messages / accept / request-changes)
    if (pathStr.startsWith("project-requests/") && path[1]) {
      const user = await requireAuthenticatedUser(request);
      const reqDoc = await ProjectRequest.findById(path[1]);
      if (!reqDoc) return notFoundResponse("Request not found");
      if (!canAccessRequest(user, reqDoc))
        return notFoundResponse("Request not found");
      const now = new Date();
      const role = user.isAdmin ? "admin" : "client";

      if (path[2] === "messages") {
        reqDoc.messages.push({
          _id: uuidv4(),
          authorUserId: user._id,
          authorName:
            body.authorName ||
            (user.isAdmin ? "DMDevelon" : reqDoc.clientName || user.email),
          authorRole: role,
          type: "message",
          body: body.body || "",
          attachments: Array.isArray(body.attachments) ? body.attachments : [],
          createdAt: now,
        });
        if (user.isAdmin && reqDoc.status === "new")
          reqDoc.status = "discussion";
        reqDoc.lastActivityAt = now;
        await reqDoc.save();
        const preview = (body.body || "").slice(0, 140);
        if (user.isAdmin) {
          const clientId = await resolveClientUserId(reqDoc);
          await notifyUser({
            userId: clientId,
            actorId: user._id,
            type: "request_message",
            title: `DMDevelon replied: ${reqDoc.title}`,
            body: preview,
            link: `/dashboard/requests/${reqDoc._id}`,
            entityType: "request",
            entityId: reqDoc._id,
            email: true,
          });
        } else {
          await notifyAdmins({
            actorId: user._id,
            type: "request_message",
            title: `New message: ${reqDoc.title}`,
            body: `${reqDoc.clientName}: ${preview}`,
            link: `/admin?tab=project-requests&id=${reqDoc._id}`,
            entityType: "request",
            entityId: reqDoc._id,
            email: true,
          });
        }
        return NextResponse.json(reqDoc, {
          status: 201,
          headers: getCorsHeaders(),
        });
      }

      if (path[2] === "accept") {
        if (!canPerformClientProposalAction(user, reqDoc)) {
          return NextResponse.json(
            { error: "Only the request owner can accept the proposal" },
            { status: 403, headers: getCorsHeaders() },
          );
        }
        const isReplay =
          reqDoc.status === "approved" && !!reqDoc.linkedClientProjectId;
        if (
          !isReplay &&
          (reqDoc.status !== "proposal_sent" || !reqDoc.proposal?.sentAt)
        ) {
          return NextResponse.json(
            { error: "Only a sent proposal can be accepted" },
            { status: 409, headers: getCorsHeaders() },
          );
        }

        const clientSlug = reqDoc.clientSlug || slugify(reqDoc.clientName);
        let project = reqDoc.linkedClientProjectId
          ? await ClientProject.findById(reqDoc.linkedClientProjectId)
          : await ClientProject.findOne({ requestId: reqDoc._id });
        if (reqDoc.linkedClientProjectId && !project) {
          project = await ClientProject.findOne({ requestId: reqDoc._id });
        }
        const projectWasCreated = !project;
        if (!project) {
          const projectId = uuidv5(`project-request:${reqDoc._id}`, uuidv5.URL);
          try {
            project = await ClientProject.findOneAndUpdate(
              { requestId: reqDoc._id },
              {
                $setOnInsert: {
                  _id: projectId,
                  clientUserId: reqDoc.clientUserId,
                  clientName: reqDoc.clientName,
                  clientEmail: reqDoc.clientEmail,
                  clientSlug,
                  requestId: reqDoc._id,
                  title: reqDoc.proposal?.title || reqDoc.title,
                  description: reqDoc.proposal?.scope || reqDoc.description,
                  requirements: reqDoc.description,
                  status: "in_progress",
                  milestones: [],
                  events: [
                    {
                      _id: uuidv5(
                        `project-request-created:${reqDoc._id}`,
                        uuidv5.URL,
                      ),
                      type: "created",
                      body: "Project created from accepted proposal",
                      actorName: reqDoc.clientName || "Client",
                      createdAt: now,
                    },
                  ],
                },
              },
              { new: true, upsert: true, setDefaultsOnInsert: true },
            );
          } catch (error) {
            if (error?.code !== 11000) throw error;
            project = await ClientProject.findOne({ requestId: reqDoc._id });
          }
        }
        if (!project) {
          throw apiError("Could not reconcile the accepted project", 409);
        }

        const embeddedPlan = normalizeMilestonePlan(
          reqDoc.proposal?.milestonePlan || reqDoc.proposal?.milestones || [],
          reqDoc.proposal?.milestonePlan || reqDoc.proposal?.milestones || [],
        );
        const masterProposalId = uuidv5(
          `master-proposal:${reqDoc._id}`,
          uuidv5.URL,
        );
        let masterProposal;
        try {
          masterProposal = await ProjectProposal.findOneAndUpdate(
            { requestId: reqDoc._id },
            {
              $setOnInsert: {
                _id: masterProposalId,
                projectId: project._id,
                requestId: reqDoc._id,
                clientUserId: reqDoc.clientUserId || null,
                kind: "master",
                phaseNumber: 1,
                phaseLabel: reqDoc.proposal?.phaseLabel || "Master Proposal",
                title: reqDoc.proposal?.title || reqDoc.title,
                scope: reqDoc.proposal?.scope || reqDoc.description || "",
                timeline: reqDoc.proposal?.timeline || "",
                budget: reqDoc.proposal?.budget || "",
                status: "accepted",
                version: Math.max(1, reqDoc.proposal?.version || 1),
                milestonePlan: embeddedPlan,
                revisionHistory: reqDoc.proposal?.revisionHistory || [],
                createdByUserId: reqDoc.proposal?.createdByUserId || null,
                sentAt: reqDoc.proposal?.sentAt || now,
                acceptedAt: reqDoc.proposal?.acceptedAt || now,
                rejectedAt: null,
              },
            },
            { new: true, upsert: true, setDefaultsOnInsert: true },
          );
        } catch (error) {
          if (error?.code !== 11000) throw error;
          masterProposal = await ProjectProposal.findOne({
            $or: [
              { requestId: reqDoc._id },
              { projectId: project._id, kind: "master" },
            ],
          });
        }
        if (!masterProposal) {
          throw apiError("Could not reconcile the master proposal", 409);
        }
        await reconcileProposalMilestones(
          project._id,
          masterProposal,
          reqDoc.clientName || "Client",
        );

        ensureClientFolders(clientSlug).catch(() => {});
        const requestUpdate = await ProjectRequest.updateOne(
          { _id: reqDoc._id, status: { $ne: "approved" } },
          {
            $set: {
              status: "approved",
              linkedClientProjectId: project._id,
              "proposal.status": "accepted",
              "proposal.acceptedAt": masterProposal.acceptedAt || now,
              lastActivityAt: now,
            },
            $push: {
              messages: {
                _id: uuidv4(),
                authorName: "System",
                authorRole: "client",
                type: "system",
                body: "Request approved — project created.",
                createdAt: now,
              },
            },
          },
        );
        if (requestUpdate.modifiedCount) {
          await notifyAdmins({
            actorId: user._id,
            type: "project_proposal_accepted",
            title: `Proposal accepted: ${reqDoc.title}`,
            body: `${reqDoc.clientName} accepted the proposal — project created.`,
            link: `/admin?tab=client-projects&id=${project._id}&proposal=${masterProposal._id}`,
            entityType: "project",
            entityId: project._id,
            proposalId: masterProposal._id,
            email: true,
          });
        }
        const refreshedRequest = await ProjectRequest.findById(reqDoc._id);
        return NextResponse.json(
          {
            projectId: project._id,
            proposalId: masterProposal._id,
            request: refreshedRequest,
          },
          {
            status: projectWasCreated ? 201 : 200,
            headers: getCorsHeaders(),
          },
        );
      }

      if (path[2] === "request-changes") {
        if (!canPerformClientProposalAction(user, reqDoc)) {
          return NextResponse.json(
            { error: "Only the request owner can request proposal changes" },
            { status: 403, headers: getCorsHeaders() },
          );
        }
        if (reqDoc.status !== "proposal_sent" || !reqDoc.proposal?.sentAt) {
          return NextResponse.json(
            { error: "Changes can only be requested on a sent proposal" },
            { status: 409, headers: getCorsHeaders() },
          );
        }
        if (body.body) {
          reqDoc.messages.push({
            _id: uuidv4(),
            authorUserId: user._id,
            authorName: reqDoc.clientName || user.name || user.email,
            authorRole: role,
            type: "message",
            body: body.body,
            attachments: Array.isArray(body.attachments)
              ? body.attachments
              : [],
            createdAt: now,
          });
        }
        reqDoc.messages.push({
          _id: uuidv4(),
          authorName: "System",
          authorRole: role,
          type: "system",
          body: "Changes requested on the proposal.",
          createdAt: now,
        });
        reqDoc.status = "discussion";
        if (reqDoc.proposal) reqDoc.proposal.status = "changes_requested";
        reqDoc.lastActivityAt = now;
        await reqDoc.save();
        await notifyAdmins({
          actorId: user._id,
          type: "request_changes",
          title: `Changes requested: ${reqDoc.title}`,
          body: `${reqDoc.clientName} requested changes on the proposal.`,
          link: `/admin?tab=project-requests&id=${reqDoc._id}`,
          entityType: "request",
          entityId: reqDoc._id,
          email: true,
        });
        return NextResponse.json(reqDoc, { headers: getCorsHeaders() });
      }
    }

    // Mark notifications read (current user)
    if (pathStr === "notifications/read") {
      const user = await getUserFromRequest(request);
      if (!user) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const filter = { userId: user._id, read: false };
      if (body.id) filter._id = body.id;
      else if (body.channelId) {
        filter.channelId = body.channelId;
        if (body.entityId) filter.entityId = body.entityId;
      } else if (body.entityId) {
        filter.entityId = body.entityId;
        if (body.milestoneId) filter.milestoneId = body.milestoneId;
        if (body.proposalId) filter.proposalId = body.proposalId;
        const exclusions = [];
        if (body.excludeMilestones) {
          exclusions.push({
            $or: [
              { milestoneId: "" },
              { milestoneId: { $exists: false } },
              { milestoneId: null },
            ],
          });
        }
        if (body.excludeProposals) {
          exclusions.push({
            $or: [
              { proposalId: "" },
              { proposalId: { $exists: false } },
              { proposalId: null },
            ],
          });
        }
        if (exclusions.length) filter.$and = exclusions;
      }
      // else: all unread for this user
      await Notification.updateMany(filter, { $set: { read: true } });
      return NextResponse.json(
        { success: true },
        { headers: getCorsHeaders() },
      );
    }

    // File upload (images, PDF, DOC/DOCX, TXT) to Cloudinary (auth required)
    if (pathStr === "upload") {
      const user = await requireAuthenticatedUser(request);
      const { file, name, projectId, requestId, kind } = body;
      if (!file) {
        return NextResponse.json(
          { error: "No file provided" },
          { status: 400, headers: getCorsHeaders() },
        );
      }
      // Determine attachment type for the response and decide whether this
      // needs resource_type: "raw" (anything non-image goes to /raw/upload so
      // Cloudinary's "Restricted media types" doesn't block it later).
      const ext = name ? name.slice(name.lastIndexOf(".")).toLowerCase() : "";
      const isImage = file.startsWith("data:image/");
      const isPdf = file.startsWith("data:application/pdf") || ext === ".pdf";
      const isDoc =
        file.startsWith("data:application/msword") ||
        file.startsWith(
          "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ) ||
        ext === ".doc" ||
        ext === ".docx";
      const isTxt =
        file.startsWith("data:text/plain") || ext === ".txt" || ext === ".text";
      if (!isImage && !isPdf && !isDoc && !isTxt) {
        return NextResponse.json(
          { error: "Only images, PDF, DOC/DOCX, and TXT files are allowed" },
          { status: 400, headers: getCorsHeaders() },
        );
      }
      const attachmentType = isImage
        ? "image"
        : isPdf
          ? "pdf"
          : isDoc
            ? "doc"
            : "txt";
      // Resolve destination folder: admin -> portfolio/admin/<kind>,
      // client -> portfolio/clients/<slug>/<kind>. The project/request is
      // loaded first and permission is checked against THAT document — the
      // projectId/requestId in the body only ever selects which record to
      // load, never which one to check access against.
      let folder;
      if (projectId) {
        const project = await ClientProject.findById(projectId);
        if (!project) return notFoundResponse("Project not found");
        const access = await requireProjectPermission(
          user,
          project,
          "filesUpload",
        );
        folder =
          access.role === "admin"
            ? adminFolder(kind)
            : clientFolder(
                project.clientSlug || slugify(project.clientName),
                kind,
              );
      } else if (requestId) {
        const reqDoc = await ProjectRequest.findById(requestId);
        if (!reqDoc) return notFoundResponse("Request not found");
        if (!canAccessRequest(user, reqDoc)) {
          return notFoundResponse("Request not found");
        }
        folder = user.isAdmin
          ? adminFolder(kind)
          : clientFolder(reqDoc.clientSlug || slugify(reqDoc.clientName), kind);
      } else {
        // No project/request context (e.g. a profile avatar upload): route the
        // file into the uploader's own folder — clients/<slug>/images for a
        // client, admin/<kind> for staff.
        folder = user.isAdmin
          ? adminFolder(kind)
          : clientFolder(slugify(user.name || user.email), kind);
      }
      const uploadFn = isImage ? uploadToCloudinary : uploadRawToCloudinary;
      const url = await uploadFn(file, { folder });
      return NextResponse.json(
        { url, type: attachmentType, name: name || "" },
        { status: 201, headers: getCorsHeaders() },
      );
    }

    // Testimonials
    if (pathStr === "testimonials") {
      const user = await getUserFromRequest(request);
      const testimonial = await Testimonial.create({
        _id: uuidv4(),
        ...body,
        userId: user?._id || null,
      });
      await notifyAdmins({
        actorId: user?._id,
        type: "testimonial_created",
        title: `New testimonial from ${testimonial.clientName}`,
        body: (testimonial.comment || "").slice(0, 140),
        link: `/admin?tab=testimonials&id=${testimonial._id}`,
        entityType: "testimonial",
        entityId: testimonial._id,
      });
      return NextResponse.json(testimonial, {
        status: 201,
        headers: getCorsHeaders(),
      });
    }

    // Contact Messages
    if (pathStr === "contact-messages") {
      const { name, email, message } = body;
      if (!name || !email || !message) {
        return NextResponse.json(
          { error: "Missing required fields" },
          { status: 400, headers: getCorsHeaders() },
        );
      }
      const contactMessage = await ContactMessage.create({
        _id: uuidv4(),
        name,
        email,
        message,
      });

      try {
        const template = emailTemplates.contactNotification({
          name,
          email,
          message,
        });
        await sendEmail({
          to: "milan.drazic@dmdevelon.website",
          ...template,
          type: "contact",
        });
      } catch (error) {
        console.error("Failed to send contact notification:", error);
      }

      await notifyAdmins({
        actorId: null,
        type: "contact_message",
        title: `New message from ${name}`,
        body: (message || "").slice(0, 140),
        link: `/admin?tab=messages&id=${contactMessage._id}`,
        entityType: "contact",
        entityId: contactMessage._id,
      });

      return NextResponse.json(contactMessage, {
        status: 201,
        headers: getCorsHeaders(),
      });
    }

    // CMS Pages (admin only)
    if (pathStr === "cms-pages") {
      const user = await getUserFromRequest(request);
      if (!user || !user.isAdmin) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const page = await CMSPage.create({ _id: uuidv4(), ...body });
      return NextResponse.json(page, {
        status: 201,
        headers: getCorsHeaders(),
      });
    }

    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: getCorsHeaders() },
    );
  } catch (error) {
    return errorResponse(error, "POST");
  }
}

export async function PUT(request, context) {
  await connectDB();
  const params = await context.params;
  const path = params?.path || [];
  const pathStr = path.join("/");

  try {
    const body = await request.json();

    // Audited content edit for one operational milestone. This route keeps the
    // milestone id (and all matching task ids) stable, so existing chat links
    // remain valid, and records a bounded before/after snapshot.
    if (
      path[0] === "client-projects" &&
      path[1] &&
      path[2] === "milestones" &&
      path[3]
    ) {
      const user = await getUserFromRequest(request);
      if (!user) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      if (!user.isAdmin) {
        return NextResponse.json(
          { error: "Forbidden" },
          { status: 403, headers: getCorsHeaders() },
        );
      }
      const project = await ClientProject.findById(path[1]);
      if (!project) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404, headers: getCorsHeaders() },
        );
      }
      const milestone = (project.milestones || []).find(
        (item) => String(item._id) === String(path[3]),
      );
      if (!milestone) {
        return NextResponse.json(
          { error: "Milestone not found" },
          { status: 404, headers: getCorsHeaders() },
        );
      }
      const changeSummary = cleanString(
        body.changeSummary,
        "changeSummary",
        2000,
        { required: true },
      );
      const sourceMessageId = cleanString(
        body.sourceMessageId,
        "sourceMessageId",
        100,
      );
      if (sourceMessageId) {
        const sourceMessage = await ProjectMessage.findOne({
          _id: sourceMessageId,
          projectId: project._id,
          milestoneId: milestone._id,
        });
        if (!sourceMessage) {
          return NextResponse.json(
            { error: "sourceMessageId does not belong to this milestone" },
            { status: 400, headers: getCorsHeaders() },
          );
        }
      }

      const requested =
        body.milestone && typeof body.milestone === "object"
          ? body.milestone
          : body;
      const currentPlain = milestone.toObject
        ? milestone.toObject()
        : JSON.parse(JSON.stringify(milestone));
      const changedAt = new Date();
      const normalized = normalizeMilestonePlan(
        [
          {
            ...currentPlain,
            ...requested,
            _id: currentPlain._id,
            tasks:
              requested.tasks === undefined
                ? currentPlain.tasks || []
                : requested.tasks,
            order:
              requested.order === undefined
                ? currentPlain.order || 0
                : requested.order,
          },
        ],
        [currentPlain],
      )[0];
      const nextStatus = requested.status ?? milestone.status ?? "pending";
      if (!ITEM_STATUSES.has(nextStatus)) {
        throw apiError("Invalid milestone status");
      }
      const requestedTasks = Array.isArray(requested.tasks)
        ? requested.tasks
        : currentPlain.tasks || [];
      const currentTasksById = new Map(
        (currentPlain.tasks || []).map((task) => [String(task._id), task]),
      );
      normalized.tasks = normalized.tasks.map((task, index) => {
        const requestedTask = requestedTasks[index] || {};
        const currentTask = currentTasksById.get(String(task._id));
        const status = requestedTask.status ?? currentTask?.status ?? "pending";
        if (!ITEM_STATUSES.has(status)) throw apiError("Invalid task status");
        return {
          ...task,
          sourcePlanTaskId: currentTask?.sourcePlanTaskId || "",
          status,
          workStartedAt:
            currentTask?.workStartedAt ||
            (![undefined, null, "", "pending"].includes(currentTask?.status) ||
            status !== "pending"
              ? changedAt
              : null),
        };
      });

      const before = milestoneAuditSnapshot(milestone);
      milestone.title = normalized.title;
      milestone.description = normalized.description;
      milestone.icon = normalized.icon;
      milestone.githubBranch = normalized.githubBranch;
      milestone.order = normalized.order;
      milestone.status = nextStatus;
      if (
        !milestone.workStartedAt &&
        (![undefined, null, "", "pending"].includes(currentPlain.status) ||
          nextStatus !== "pending" ||
          normalized.tasks.some((task) => task.workStartedAt))
      ) {
        milestone.workStartedAt = changedAt;
      }
      milestone.tasks = normalized.tasks;
      milestone.revision = (milestone.revision || 0) + 1;
      const after = milestoneAuditSnapshot(milestone);
      if (!Array.isArray(milestone.changeHistory)) milestone.changeHistory = [];
      milestone.changeHistory.push({
        changedAt,
        changedByUserId: user._id,
        changedByName: user.name || "Admin",
        changeSummary,
        sourceMessageId: sourceMessageId || null,
        before,
        after,
      });
      project.events.push({
        _id: uuidv4(),
        type: "milestone_change_applied",
        body: `${milestone.title}: ${changeSummary}`,
        actorName: user.name || "Admin",
        createdAt: changedAt,
      });
      project.markModified("milestones");
      await project.save();

      try {
        await ProjectMessage.create({
          _id: uuidv4(),
          projectId: project._id,
          milestoneId: milestone._id,
          proposalId: milestone.proposalId || null,
          authorUserId: user._id,
          authorName: user.name || "DMDevelon",
          authorRole: "admin",
          messageType: "change_agreed",
          body: changeSummary,
          attachments: [],
        });
      } catch (error) {
        // The authoritative audit lives on the milestone. A transient chat
        // write must not make the already-applied edit look unsuccessful.
        console.error("milestone change system message failed:", error);
      }
      const clientId = await resolveClientUserId(project);
      await notifyUser({
        userId: clientId,
        actorId: user._id,
        type: "milestone_change_applied",
        title: `Milestone updated: ${milestone.title}`,
        body: changeSummary,
        link: `/dashboard/projects/${project._id}?m=${milestone._id}`,
        entityType: "project",
        entityId: project._id,
        milestoneId: milestone._id,
        proposalId: milestone.proposalId || "",
        email: true,
      });
      return NextResponse.json(project, { headers: getCorsHeaders() });
    }

    // One-time bootstrap for projects that were created/accepted without a
    // live plan. Existing live milestones must still use proposal/audit flows.
    if (
      path[0] === "client-projects" &&
      path[1] &&
      path[2] === "initial-milestones"
    ) {
      const user = await getUserFromRequest(request);
      if (!user) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      if (!user.isAdmin) {
        return NextResponse.json(
          { error: "Forbidden" },
          { status: 403, headers: getCorsHeaders() },
        );
      }

      const project = await ClientProject.findById(path[1]);
      if (!project) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404, headers: getCorsHeaders() },
        );
      }
      if ((project.milestones || []).length > 0) {
        return NextResponse.json(
          {
            error:
              "Initial milestones can only be added before the live plan exists",
          },
          { status: 409, headers: getCorsHeaders() },
        );
      }

      const rawPlan = body.milestones ?? body.milestonePlan ?? [];
      const normalizedPlan = normalizeMilestonePlan(rawPlan, []);
      if (normalizedPlan.length === 0) {
        throw apiError("Add at least one milestone");
      }

      const startedAt = new Date();
      project.milestones = normalizedPlan.map((milestone, index) => {
        const source = rawPlan[index] || {};
        const milestoneStatus = source.status || "pending";
        if (!ITEM_STATUSES.has(milestoneStatus)) {
          throw apiError("Invalid milestone status");
        }
        const normalizedTasks = milestone.tasks.map((task, taskIndex) => {
          const taskStatus = source.tasks?.[taskIndex]?.status || "pending";
          if (!ITEM_STATUSES.has(taskStatus))
            throw apiError("Invalid task status");
          return {
            ...task,
            status: taskStatus,
            workStartedAt: taskStatus === "pending" ? null : startedAt,
          };
        });
        return {
          ...milestone,
          status: milestoneStatus,
          workStartedAt:
            milestoneStatus !== "pending" ||
            normalizedTasks.some((task) => task.workStartedAt)
              ? startedAt
              : null,
          revision: 1,
          changeHistory: [],
          tasks: normalizedTasks,
        };
      });
      project.events.push({
        _id: uuidv4(),
        type: "initial_milestones_added",
        body: `${project.milestones.length} initial milestone${
          project.milestones.length === 1 ? "" : "s"
        } added`,
        actorName: user.name || "Admin",
        createdAt: startedAt,
      });
      project.markModified("milestones");
      await project.save();

      return NextResponse.json(project, { headers: getCorsHeaders() });
    }

    // User - update notification preferences (current user)
    if (pathStr === "user/settings") {
      const user = await getUserFromRequest(request);
      if (!user) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const update = {};
      if (typeof body.emailNotifications === "boolean") {
        update.emailNotifications = body.emailNotifications;
      }
      if (typeof body.pushNotifications === "boolean") {
        update.pushNotifications = body.pushNotifications;
      }
      const updated = await User.findByIdAndUpdate(user._id, update, {
        new: true,
      }).select("emailNotifications pushNotifications");
      return NextResponse.json(
        {
          emailNotifications: updated?.emailNotifications ?? true,
          pushNotifications: updated?.pushNotifications ?? true,
        },
        { headers: getCorsHeaders() },
      );
    }

    // Services
    if (pathStr.startsWith("services/")) {
      const user = await getUserFromRequest(request);
      if (!user || !user.isAdmin) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const id = path[1];
      const service = await Service.findByIdAndUpdate(id, body, { new: true });
      if (!service) {
        return NextResponse.json(
          { error: "Service not found" },
          { status: 404, headers: getCorsHeaders() },
        );
      }
      return NextResponse.json(service, { headers: getCorsHeaders() });
    }

    // Projects
    if (pathStr.startsWith("projects/")) {
      const user = await getUserFromRequest(request);
      if (!user || !user.isAdmin) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const id = path[1];
      if (body.title) {
        body.slug = body.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
      }
      const project = await Project.findByIdAndUpdate(id, body, { new: true });
      if (!project) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404, headers: getCorsHeaders() },
        );
      }
      return NextResponse.json(project, { headers: getCorsHeaders() });
    }

    // Client Projects (admin only) - full update / reassign / publish
    if (pathStr.startsWith("client-projects/")) {
      const user = await getUserFromRequest(request);
      if (!user || !user.isAdmin) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const id = path[1];
      const existing = await ClientProject.findById(id);
      if (!existing) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404, headers: getCorsHeaders() },
        );
      }
      const update = {};
      const stringFields = {
        clientName: ["Client name", 200],
        clientEmail: ["Client email", 320],
        title: ["Project title", 200],
        description: ["Project description", 100000],
        requirements: ["Project requirements", 100000],
        githubRepoUrl: ["GitHub URL", 2000],
        livePreviewUrl: ["Live preview URL", 2000],
        coverImageUrl: ["Cover image URL", 2000],
        category: ["Category", 200],
        color: ["Color", 100],
      };
      for (const [field, [label, max]] of Object.entries(stringFields)) {
        if (body[field] !== undefined) {
          update[field] = cleanString(body[field], label, max, {
            required: field === "title",
          });
        }
      }
      if (body.clientUserId !== undefined) {
        update.clientUserId =
          typeof body.clientUserId === "string" ? body.clientUserId : null;
      }
      if (body.status !== undefined) {
        if (!PROJECT_STATUSES.has(body.status))
          throw apiError("Invalid project status");
        update.status = body.status;
      }
      if (body.publishToHomepage !== undefined) {
        if (typeof body.publishToHomepage !== "boolean") {
          throw apiError("publishToHomepage must be a boolean");
        }
        update.publishToHomepage = body.publishToHomepage;
      }
      // Publish to public portfolio: create a linked Project once.
      if (body.publishToHomepage && !existing.linkedProjectId) {
        const title = update.title || existing.title;
        const slug = title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
        const portfolio = await Project.create({
          _id: uuidv4(),
          title,
          description: update.description || existing.description || title,
          image_url: update.coverImageUrl || existing.coverImageUrl || "",
          live_preview_url:
            update.livePreviewUrl || existing.livePreviewUrl || "",
          github_url: update.githubRepoUrl || existing.githubRepoUrl || "",
          color: update.color || existing.color || "blue",
          category: update.category || existing.category || "Web App",
          slug,
        });
        update.linkedProjectId = portfolio._id;
      }
      // Reassign / renamed client -> recompute slug and ensure its folders.
      if (
        update.clientName &&
        slugify(update.clientName) !== existing.clientSlug
      ) {
        update.clientSlug = slugify(update.clientName);
        ensureClientFolders(update.clientSlug).catch(() => {});
      }
      // Milestone content intentionally cannot be replaced by this generic
      // endpoint; use the audited /milestones/:milestoneId route instead.
      const project = await ClientProject.findByIdAndUpdate(id, update, {
        new: true,
        runValidators: true,
      });
      return NextResponse.json(project, { headers: getCorsHeaders() });
    }

    // Project Request proposal (admin only)
    if (pathStr.startsWith("project-requests/") && path[2] === "proposal") {
      const user = await getUserFromRequest(request);
      if (!user || !user.isAdmin) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const reqDoc = await ProjectRequest.findById(path[1]);
      if (!reqDoc) {
        return NextResponse.json(
          { error: "Request not found" },
          { status: 404, headers: getCorsHeaders() },
        );
      }
      if (
        reqDoc.status === "approved" ||
        reqDoc.status === "closed" ||
        reqDoc.proposal?.acceptedAt
      ) {
        return NextResponse.json(
          { error: "An accepted or closed proposal is immutable" },
          { status: 409, headers: getCorsHeaders() },
        );
      }
      const now = new Date();
      const existingProposal = reqDoc.proposal?.toObject
        ? reqDoc.proposal.toObject()
        : reqDoc.proposal || {};
      const fields = normalizeProposalFields(
        {
          ...body,
          title: body.title || existingProposal.title || reqDoc.title,
          phaseLabel: "Master Proposal",
        },
        {
          ...existingProposal,
          phaseLabel: existingProposal.phaseLabel || "Master Proposal",
        },
      );
      const revisionHistory = [...(existingProposal.revisionHistory || [])];
      if ((existingProposal.version || 0) > 0) {
        revisionHistory.push(
          proposalSnapshot({
            ...existingProposal,
            kind: "master",
            phaseNumber: 1,
            phaseLabel: "Master Proposal",
            status: existingProposal.sentAt ? "sent" : existingProposal.status,
          }),
        );
      }
      reqDoc.proposal = {
        ...fields,
        kind: "master",
        phaseNumber: 1,
        phaseLabel: "Master Proposal",
        status: "sent",
        version: (existingProposal.version || 0) + 1,
        revisionHistory,
        createdByUserId: existingProposal.createdByUserId || user._id,
        sentAt: now,
        acceptedAt: null,
      };
      reqDoc.status = "proposal_sent";
      reqDoc.messages.push({
        _id: uuidv4(),
        authorName: "DMDevelon",
        authorRole: "admin",
        type: "system",
        body: `Proposal sent · v${reqDoc.proposal.version}`,
        createdAt: now,
      });
      reqDoc.lastActivityAt = now;
      await reqDoc.save();
      {
        const clientId = await resolveClientUserId(reqDoc);
        await notifyUser({
          userId: clientId,
          actorId: user._id,
          type: "proposal_sent",
          title: `Proposal ready: ${reqDoc.title}`,
          body: "A proposal is ready for your review.",
          link: `/dashboard/requests/${reqDoc._id}`,
          entityType: "request",
          entityId: reqDoc._id,
          email: true,
        });
      }
      return NextResponse.json(reqDoc, { headers: getCorsHeaders() });
    }

    // Testimonials (admin reply)
    if (pathStr.startsWith("testimonials/")) {
      const user = await getUserFromRequest(request);
      const id = path[1];
      if (body.adminReply !== undefined) {
        if (!user || !user.isAdmin) {
          return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401, headers: getCorsHeaders() },
          );
        }
      }
      const testimonial = await Testimonial.findByIdAndUpdate(id, body, {
        new: true,
      });
      if (!testimonial) {
        return NextResponse.json(
          { error: "Testimonial not found" },
          { status: 404, headers: getCorsHeaders() },
        );
      }
      if (body.adminReply) {
        const clientId = await resolveClientUserId(testimonial);
        await notifyUser({
          userId: clientId,
          actorId: user._id,
          type: "testimonial_reply",
          title: "DMDevelon replied to your testimonial",
          body: body.adminReply.slice(0, 140),
          link: `/dashboard?tab=testimonials&id=${testimonial._id}`,
          entityType: "testimonial",
          entityId: testimonial._id,
          email: true,
        });
      }
      return NextResponse.json(testimonial, { headers: getCorsHeaders() });
    }

    // Company Profile
    if (pathStr === "company-profile") {
      const user = await getUserFromRequest(request);
      if (!user || !user.isAdmin) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      let profile = await CompanyProfile.findOne();
      if (profile) {
        profile = await CompanyProfile.findByIdAndUpdate(profile._id, body, {
          new: true,
        });
      } else {
        profile = await CompanyProfile.create({ _id: uuidv4(), ...body });
      }
      return NextResponse.json(profile, { headers: getCorsHeaders() });
    }

    // Contact Message Reply
    if (pathStr.startsWith("contact-messages")) {
      const user = await getUserFromRequest(request);
      if (!user || !user.isAdmin) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const id = path[1];
      const message = await ContactMessage.findByIdAndUpdate(id, body, {
        new: true,
      });
      if (!message) {
        return NextResponse.json(
          { error: "Message not found" },
          { status: 404, headers: getCorsHeaders() },
        );
      }
      if (message?.replyMessage) {
        try {
          const template = emailTemplates.contactReply({
            name: message.name,
            originalMessage: message.message,
            replyMessage: message?.replyMessage,
          });
          await sendEmail({
            to: message.email,
            ...template,
            type: "contact",
          });
        } catch (error) {
          console.error("Failed to send reply email:", error);
        }
      }
      return NextResponse.json(message, { headers: getCorsHeaders() });
    }

    // CMS Pages
    if (pathStr.startsWith("cms-pages/")) {
      const user = await getUserFromRequest(request);
      if (!user || !user.isAdmin) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const id = path[1];
      const page = await CMSPage.findByIdAndUpdate(id, body, { new: true });
      if (!page) {
        return NextResponse.json(
          { error: "Page not found" },
          { status: 404, headers: getCorsHeaders() },
        );
      }
      return NextResponse.json(page, { headers: getCorsHeaders() });
    }

    // Users
    if (pathStr.startsWith("users/")) {
      const user = await getUserFromRequest(request);
      const id = path[1];
      // User can update their own profile, admin can update anyone.
      // getUserFromRequest returns the User doc, so compare against _id.
      if (!user || (String(user._id) !== id && !user.isAdmin)) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      // Only admin can change isAdmin status
      if (body.isAdmin !== undefined && !user.isAdmin) {
        delete body.isAdmin;
      }
      // Don't allow changing email while an active project relies on it for
      // ownership matching (keeps client projects from being orphaned).
      let targetUser = null;
      if (body.email !== undefined) {
        const target = await User.findById(id);
        targetUser = target;
        if (target && body.email !== target.email) {
          const activeProjects = await ClientProject.countDocuments({
            status: { $nin: [...TERMINAL_PROJECT_STATUSES] },
            $or: [{ clientUserId: id }, { clientEmail: target.email }],
          });
          if (activeProjects > 0) {
            delete body.email;
          }
        }
      }
      // Hash password if being updated
      if (body.password) {
        body.password = hashPassword(body.password);
        targetUser = targetUser || (await User.findById(id));
        if (targetUser) {
          body.sessionVersion = Number(targetUser.sessionVersion || 0) + 1;
        }
      }
      const updatedUser = await User.findByIdAndUpdate(id, body, {
        new: true,
      }).select("-password -resetToken -resetTokenExpiry");
      if (!updatedUser) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404, headers: getCorsHeaders() },
        );
      }
      return NextResponse.json(updatedUser, { headers: getCorsHeaders() });
    }

    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: getCorsHeaders() },
    );
  } catch (error) {
    return errorResponse(error, "PUT");
  }
}

export async function DELETE(request, context) {
  await connectDB();
  const params = await context.params;
  const path = params?.path || [];
  const pathStr = path.join("/");

  try {
    const user = await getUserFromRequest(request);

    // DELETE /api/chat/messages/:id — soft delete. Author or admin
    // (canModerateMessage) — unlike edit (PATCH), which is author-only.
    if (pathStr.startsWith("chat/messages/") && path[2] && !path[3]) {
      if (!user) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const { message, access } = await loadMessageWithAccess(
        path[2],
        user,
        "chatWrite",
      );
      if (!canModerateMessage(access, message, { userId: user._id })) {
        return forbiddenResponse("You cannot delete this message");
      }
      if (!message.deletedAt) {
        message.deletedAt = new Date();
        message.deletedByUserId = user._id;
        // Deleting also unpins. A pin is a pointer to something worth coming
        // back to; once the content is gone the pin is a dead entry the user
        // cannot clear (the moderation menu only exists on live messages).
        // The message row itself survives — convertedTo links depend on it.
        message.pinned = false;
        message.pinnedAt = null;
        message.pinnedByUserId = null;
        await message.save();
      }
      return NextResponse.json(
        { message: "Message deleted" },
        { headers: getCorsHeaders() },
      );
    }

    // Services
    if (pathStr.startsWith("services/")) {
      if (!user || !user.isAdmin) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const id = path[1];
      const service = await Service.findByIdAndDelete(id);
      if (!service) {
        return NextResponse.json(
          { error: "Service not found" },
          { status: 404, headers: getCorsHeaders() },
        );
      }
      return NextResponse.json(
        { message: "Service deleted" },
        { headers: getCorsHeaders() },
      );
    }

    // Projects
    if (pathStr.startsWith("projects/")) {
      const user = await getUserFromRequest(request);
      if (!user || !user.isAdmin) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const id = path[1];
      const project = await Project.findByIdAndDelete(id);
      if (!project) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404, headers: getCorsHeaders() },
        );
      }
      return NextResponse.json(
        { message: "Project deleted" },
        { headers: getCorsHeaders() },
      );
    }

    // DELETE /client-projects/:id/proposals/:pid — throw away a proposal that
    // never became work. Same "match the more specific path first" reasoning
    // as the invitation branch below: the admin-only project delete further
    // down would otherwise shadow this and soft-delete the whole project.
    //
    // Deletable: `draft` (never sent), `rejected` (the client said no), and
    // `archived` (an accepted phase already unwound by `archive`, which pulled
    // its milestones back out of the project). Not `sent` — it is still in
    // front of the client, so withdraw it first — and not `accepted`, which
    // still has live milestones hanging off its proposalId; that has to go
    // through `archive` first. Those two rules together give every status a
    // complete path to full removal.
    if (
      pathStr.startsWith("client-projects/") &&
      path[2] === "proposals" &&
      path[3]
    ) {
      const user = await requireAuthenticatedUser(request);
      const project = await ClientProject.findById(path[1]);
      if (!project) return notFoundResponse("Project not found");
      if (!user.isAdmin) return forbiddenResponse();

      const proposal = await ProjectProposal.findOne({
        _id: path[3],
        projectId: project._id,
      });
      if (!proposal) return notFoundResponse("Proposal not found");
      if (!["draft", "rejected", "archived"].includes(proposal.status)) {
        throw apiError(
          proposal.status === "sent"
            ? "Withdraw this proposal before deleting it"
            : proposal.status === "accepted"
              ? "Delete this phase from active work first, then delete it permanently"
              : "Only a draft, rejected or archived proposal can be deleted",
          409,
        );
      }

      // Defensive: an archive that only half-completed would leave milestones
      // still pointing at this proposal, and deleting it would orphan them
      // with no way to trace where they came from.
      const orphanCount = (project.milestones || []).filter(
        (m) => String(m.proposalId || "") === String(proposal._id),
      ).length;
      if (orphanCount > 0) {
        throw apiError(
          `This proposal still owns ${orphanCount} milestone(s) in the plan; remove the phase from active work first`,
          409,
        );
      }

      await ProjectProposal.deleteOne({ _id: proposal._id });
      // Drop the archive tombstone too: it exists purely to stop an accept
      // replay from re-materializing this phase's milestones, and with the
      // proposal itself gone there is nothing left that could replay.
      await ClientProject.updateOne(
        { _id: project._id },
        {
          $pull: { archivedProposalIds: proposal._id },
          $inc: { __v: 1 },
        },
      );
      // Release the originating chat item so it can be handed off again.
      await ProjectItem.updateMany(
        { handoffProposalId: proposal._id },
        { $set: { handoffProposalId: null } },
      );

      return NextResponse.json(
        { success: true, deletedId: proposal._id },
        { headers: getCorsHeaders() },
      );
    }

    // Client Projects (admin only)
    // Revoke a pending invitation. Checked BEFORE the admin-only project
    // delete below, which would otherwise shadow this and soft-delete the
    // whole project instead — a more specific path must be matched first.
    if (
      pathStr.startsWith("client-projects/") &&
      path[2] === "invitations" &&
      path[3]
    ) {
      if (!user) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const id = path[1];
      const project = await ClientProject.findById(id);
      if (!project) return notFoundResponse("Project not found");
      await requireProjectPermission(user, project, "membersInvite");
      const invitation = await ProjectInvitation.findOne({
        _id: path[3],
        projectId: id,
      });
      if (!invitation) return notFoundResponse("Invitation not found");
      if (invitation.status !== "pending") {
        throw apiError("Only a pending invitation can be revoked", 409);
      }
      invitation.status = "revoked";
      await invitation.save();

      await ProjectAuditLog.create({
        _id: uuidv4(),
        projectId: id,
        actorUserId: user._id,
        actorName: user.name || user.email || "",
        targetEmail: invitation.emailNormalized,
        eventType: "invitation.revoked",
        metadata: {},
      }).catch((e) =>
        console.error("audit insert failed (invitation revoked):", e),
      );

      return NextResponse.json(
        { message: "Invitation revoked" },
        { headers: getCorsHeaders() },
      );
    }

    // Remove an active member. Same shadowing concern as above.
    if (
      pathStr.startsWith("client-projects/") &&
      path[2] === "members" &&
      path[3]
    ) {
      if (!user) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const id = path[1];
      const project = await ClientProject.findById(id);
      if (!project) return notFoundResponse("Project not found");
      await requireProjectPermission(user, project, "membersManage");
      const member = await ProjectMember.findOne({
        _id: path[3],
        projectId: id,
        status: { $ne: "removed" },
      });
      if (!member) return notFoundResponse("Member not found");
      member.status = "removed";
      await member.save();

      await ProjectAuditLog.create({
        _id: uuidv4(),
        projectId: id,
        actorUserId: user._id,
        actorName: user.name || user.email || "",
        targetUserId: member.userId,
        targetEmail: member.email || "",
        eventType: "member.removed",
        metadata: { reason: "removed_by_manager" },
      }).catch((e) =>
        console.error("audit insert failed (member removed):", e),
      );

      return NextResponse.json(
        { message: "Member removed" },
        { headers: getCorsHeaders() },
      );
    }

    if (pathStr.startsWith("client-projects/")) {
      if (!user || !user.isAdmin) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const id = path[1];
      const project = await ClientProject.findById(id);
      if (!project) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404, headers: getCorsHeaders() },
        );
      }
      // Preserve the project, its milestones, messages and proposal snapshots
      // in the client's history until the client deletes their account.
      if (project.status !== "deleted") {
        project.status = "deleted";
        project.deletedAt = new Date();
        project.deletedByUserId = String(user._id);
        project.deletedByName = user.name || "Admin";
        project.events.push({
          _id: uuidv4(),
          type: "deleted",
          body: "Project moved to deleted history",
          actorName: user.name || "Admin",
          createdAt: project.deletedAt,
        });
        await project.save();
      }
      return NextResponse.json(
        { message: "Project moved to deleted history", project },
        { headers: getCorsHeaders() },
      );
    }

    // Project Requests (admin only)
    if (pathStr.startsWith("project-requests/")) {
      if (!user || !user.isAdmin) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const reqDoc = await ProjectRequest.findByIdAndDelete(path[1]);
      if (!reqDoc) {
        return NextResponse.json(
          { error: "Request not found" },
          { status: 404, headers: getCorsHeaders() },
        );
      }
      return NextResponse.json(
        { message: "Request deleted" },
        { headers: getCorsHeaders() },
      );
    }

    // Testimonials
    if (pathStr.startsWith("testimonials/")) {
      const user = await getUserFromRequest(request);
      const id = path[1];
      const testimonial = await Testimonial.findById(id);
      if (!testimonial) {
        return NextResponse.json(
          { error: "Testimonial not found" },
          { status: 404, headers: getCorsHeaders() },
        );
      }
      // User can delete their own testimonial, admin can delete any
      if (
        !user ||
        (String(testimonial.userId) !== String(user._id) && !user.isAdmin)
      ) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      await Testimonial.findByIdAndDelete(id);
      return NextResponse.json(
        { message: "Testimonial deleted" },
        { headers: getCorsHeaders() },
      );
    }

    // Contact Messages
    if (pathStr.startsWith("contact-messages/")) {
      const user = await getUserFromRequest(request);
      if (!user || !user.isAdmin) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const id = path[1];
      const message = await ContactMessage.findByIdAndDelete(id);
      if (!message) {
        return NextResponse.json(
          { error: "Message not found" },
          { status: 404, headers: getCorsHeaders() },
        );
      }
      return NextResponse.json(
        { message: "Message deleted" },
        { headers: getCorsHeaders() },
      );
    }

    // CMS Pages
    if (pathStr.startsWith("cms-pages/")) {
      const user = await getUserFromRequest(request);
      if (!user || !user.isAdmin) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const id = path[1];
      const page = await CMSPage.findByIdAndDelete(id);
      if (!page) {
        return NextResponse.json(
          { error: "Page not found" },
          { status: 404, headers: getCorsHeaders() },
        );
      }
      return NextResponse.json(
        { message: "Page deleted" },
        { headers: getCorsHeaders() },
      );
    }

    // Users
    if (pathStr.startsWith("users/")) {
      const user = await getUserFromRequest(request);
      const id = path[1];
      // User can delete their own account, admin can delete anyone
      if (!user || (String(user._id) !== String(id) && !user.isAdmin)) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      // Block deletion while the user still owns an active project, so it
      // doesn't become orphaned. Admin must reassign it first.
      const target = await User.findById(id);
      const activeProjects = await ClientProject.countDocuments({
        status: { $nin: [...TERMINAL_PROJECT_STATUSES] },
        $or: [
          { clientUserId: id },
          ...(target?.email ? [{ clientEmail: target.email }] : []),
        ],
      });
      if (activeProjects > 0) {
        return NextResponse.json(
          {
            error:
              "Account has a project in progress. Please contact admin to reassign it before deleting.",
          },
          { status: 409, headers: getCorsHeaders() },
        );
      }
      // Every project this person owns is now guaranteed terminal (the guard
      // above rejects anything still active) — closing them and removing this
      // person's memberships elsewhere is the other half of "this identity is
      // gone", so it happens in the same transaction as the delete itself.
      // Partial failure here (account deleted but projects still marked open,
      // or vice versa) is exactly the inconsistency I2 rules out for invitation
      // accept; the same reasoning applies to account deletion.
      const ownedProjectQuery = {
        $or: [
          { clientUserId: id },
          ...(target?.email ? [{ clientEmail: target.email }] : []),
        ],
      };
      const memberships = await ProjectMember.find({
        userId: id,
        status: { $ne: "removed" },
      });
      const session = await User.db.startSession();
      let deletedUser;
      try {
        await session.withTransaction(async () => {
          deletedUser = await User.findByIdAndDelete(id).session(session);
          if (!deletedUser) return; // handled after the transaction, as 404
          await ClientProject.updateMany(
            { ...ownedProjectQuery, ownerAccountDeletedAt: null },
            { $set: { ownerAccountDeletedAt: new Date() } },
            { session },
          );
          if (memberships.length > 0) {
            await ProjectMember.updateMany(
              { userId: id, status: { $ne: "removed" } },
              { $set: { status: "removed" } },
              { session },
            );
          }
        });
      } catch (error) {
        if (
          /transaction numbers are only allowed|does not support transactions/i.test(
            String(error?.message || ""),
          )
        ) {
          throw apiError(
            "Account deletion requires MongoDB transaction support",
            503,
          );
        }
        throw error;
      } finally {
        await session.endSession();
      }
      if (!deletedUser) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404, headers: getCorsHeaders() },
        );
      }
      // Audit is a post-commit side effect: idempotent inserts, never allowed
      // to undo an already-committed deletion if it fails.
      if (memberships.length > 0) {
        await ProjectAuditLog.insertMany(
          memberships.map((m) => ({
            _id: uuidv4(),
            projectId: m.projectId,
            actorUserId: user._id,
            actorName: user.name || user.email || "",
            targetUserId: m.userId,
            targetEmail: m.email || "",
            eventType: "member.removed",
            metadata: { reason: "account_deleted" },
          })),
        ).catch((e) =>
          console.error("audit insert failed (account deletion):", e),
        );
      }
      return NextResponse.json(
        { message: "User deleted" },
        { headers: getCorsHeaders() },
      );
    }

    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: getCorsHeaders() },
    );
  } catch (error) {
    // Was a hardcoded 500, which flattened every deliberate status thrown in
    // this handler: requireAuthenticatedUser's 401, requireProjectPermission's
    // 403/404, and apiError's 409. GET/POST/PATCH have always used
    // errorResponse; DELETE was the odd one out.
    return errorResponse(error, "DELETE");
  }
}

// Granular, patch-based progress updates (admin only). Targets a single
// project status, a milestone, or a task — no need to resend the whole project.
export async function PATCH(request, context) {
  await connectDB();
  const params = await context.params;
  const path = params?.path || [];

  try {
    const body = await request.json();

    // PATCH /api/project-items/:id — decide on a converted item. Accepting a
    // Decision also co-signs it (sanitizeProjectItemUpdate folds the two
    // together), so an accepted record always carries the name of whoever
    // accepted it. Operator-only via the `itemsApprove` permission.
    if (path[0] === "project-items" && path[1] && !path[2]) {
      const user = await requireAuthenticatedUser(request);
      // Resource-first: the project comes from the loaded item, never from
      // anything the caller sent.
      const item = await ProjectItem.findById(path[1]);
      if (!item) return notFoundResponse("Item not found");
      const project = await ClientProject.findById(item.projectId);
      if (!project) return notFoundResponse("Project not found");
      const access = await requireProjectPermission(
        user,
        project,
        "itemsApprove",
      );

      const { status, confirm } = sanitizeProjectItemUpdate(body, access);
      item.status = status;
      if (
        confirm &&
        !(item.confirmedBy || []).some(
          (c) => String(c.userId) === String(user._id),
        )
      ) {
        item.confirmedBy.push({
          userId: user._id,
          name: user.name || user.email || "",
          at: new Date(),
        });
      }
      if (status === "accepted" && !item.decidedAt) item.decidedAt = new Date();
      await item.save();

      return NextResponse.json(serializeProjectItem(item), {
        headers: getCorsHeaders(),
      });
    }

    // PATCH /api/chat/messages/:id — edit own message. Author-only, no admin
    // override (unlike delete) — see plan section 9's Chat table.
    if (path[0] === "chat" && path[1] === "messages" && path[2] && !path[3]) {
      const user = await requireAuthenticatedUser(request);
      const { message, access } = await loadMessageWithAccess(
        path[2],
        user,
        "chatWrite",
      );
      if (String(message.authorUserId) !== String(user._id)) {
        return forbiddenResponse("Only the author can edit this message");
      }
      if (message.deletedAt) {
        throw apiError("A deleted message cannot be edited", 409);
      }
      message.body = cleanString(body.body, "Message", 10000, {
        required: true,
      });
      message.editedAt = new Date();
      await message.save();
      return NextResponse.json(serializeChatMessageForAccess(message, access), {
        headers: getCorsHeaders(),
      });
    }

    // PATCH /client-projects/:projectId/proposals/:proposalId (admin draft
    // editing only). Server-owned lifecycle and ownership fields are ignored.
    if (
      path[0] === "client-projects" &&
      path[1] &&
      path[2] === "proposals" &&
      path[3]
    ) {
      const user = await getUserFromRequest(request);
      if (!user) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      if (!user.isAdmin) {
        return NextResponse.json(
          { error: "Forbidden" },
          { status: 403, headers: getCorsHeaders() },
        );
      }
      const project = await ClientProject.findById(path[1]);
      if (!project) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404, headers: getCorsHeaders() },
        );
      }
      const proposal = await ProjectProposal.findOne({
        _id: path[3],
        projectId: project._id,
      });
      if (!proposal) {
        return NextResponse.json(
          { error: "Proposal not found" },
          { status: 404, headers: getCorsHeaders() },
        );
      }
      if (!["draft", "changes_requested"].includes(proposal.status)) {
        return NextResponse.json(
          { error: "Only a draft or requested revision can be edited" },
          { status: 409, headers: getCorsHeaders() },
        );
      }
      if (proposal.status === "changes_requested") {
        const alreadyCaptured = (proposal.revisionHistory || []).some(
          (revision) => Number(revision.version) === Number(proposal.version),
        );
        if (!alreadyCaptured) {
          proposal.revisionHistory.push(proposalSnapshot(proposal));
        }
        proposal.status = "draft";
      }
      const fields = normalizeProposalFields(body, proposal);
      Object.assign(proposal, fields);
      await proposal.save();
      return NextResponse.json(proposal, { headers: getCorsHeaders() });
    }

    // PATCH /client-projects/:id/members/:memberId — role/roleLabel. Checked
    // BEFORE the admin-only catch-all just below, which would otherwise
    // shadow this and reject anyone but a global admin — membersManage also
    // belongs to the project owner, not only the operator.
    if (
      path[0] === "client-projects" &&
      path[1] &&
      path[2] === "members" &&
      path[3]
    ) {
      const user = await requireAuthenticatedUser(request);
      const id = path[1];
      const project = await ClientProject.findById(id);
      if (!project) return notFoundResponse("Project not found");
      const access = await requireProjectPermission(
        user,
        project,
        "membersManage",
      );
      const member = await ProjectMember.findOne({
        _id: path[3],
        projectId: id,
        status: "active",
      });
      if (!member) return notFoundResponse("Member not found");

      const previousRole = member.role;
      if (body.role !== undefined) {
        if (!INVITABLE_ROLES.includes(body.role)) {
          throw apiError("Invalid role", 400);
        }
        member.role = body.role;
      }
      if (body.roleLabel !== undefined) {
        member.roleLabel = cleanString(body.roleLabel, "Role label", 80);
      }
      await member.save();

      if (body.role !== undefined && body.role !== previousRole) {
        await ProjectAuditLog.create({
          _id: uuidv4(),
          projectId: id,
          actorUserId: user._id,
          actorName: user.name || user.email || "",
          targetUserId: member.userId,
          targetEmail: member.email || "",
          eventType: "member.role_changed",
          metadata: { from: previousRole, to: member.role },
        }).catch((e) =>
          console.error("audit insert failed (member role changed):", e),
        );
      }

      const includeEmail = access.role === "admin" || access.role === "owner";
      const memberAccount = await User.findById(member.userId);
      return NextResponse.json(
        serializeMemberPublic(member, { includeEmail, user: memberAccount }),
        { headers: getCorsHeaders() },
      );
    }

    if (path[0] === "client-projects" && path[1]) {
      const user = await getUserFromRequest(request);
      if (!user || !user.isAdmin) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const id = path[1];

      const project = await ClientProject.findById(id);
      if (!project) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404, headers: getCorsHeaders() },
        );
      }
      const actorName = user.name || "Admin";
      const projLink = `/dashboard/projects/${project._id}`;

      // PATCH /client-projects/:id/status
      if (path[2] === "status") {
        if (body.status !== undefined) {
          if (!PROJECT_STATUSES.has(body.status)) {
            throw apiError("Invalid project status");
          }
          project.status = body.status;
          project.events.push({
            _id: uuidv4(),
            type: "status",
            body: `Project status → ${String(body.status).replace("_", " ")}`,
            actorName,
            createdAt: new Date(),
          });
        }
        if (
          body.publishToHomepage !== undefined &&
          typeof body.publishToHomepage !== "boolean"
        ) {
          throw apiError("publishToHomepage must be a boolean");
        }
        if (body.publishToHomepage !== undefined)
          project.publishToHomepage = body.publishToHomepage;
        await project.save();
        const clientId = await resolveClientUserId(project);
        await notifyUser({
          userId: clientId,
          actorId: user._id,
          type: "status_change",
          title: `${project.title}: ${String(body.status || "").replace("_", " ")}`,
          body: "Project status updated.",
          link: projLink,
          entityType: "project",
          entityId: project._id,
          email: false,
        });
        return NextResponse.json(project, { headers: getCorsHeaders() });
      }

      // PATCH /client-projects/:id/milestone/:mid[/task/:tid]
      if (path[2] === "milestone" && path[3]) {
        const mid = path[3];
        const m = (project.milestones || []).find((x) => x._id === mid);
        if (!m) {
          return NextResponse.json(
            { error: "Milestone not found" },
            { status: 404, headers: getCorsHeaders() },
          );
        }

        // Task-level update
        if (path[4] === "task" && path[5]) {
          const t = (m.tasks || []).find((x) => x._id === path[5]);
          if (!t) {
            return NextResponse.json(
              { error: "Task not found" },
              { status: 404, headers: getCorsHeaders() },
            );
          }
          const prev = t.status;
          if (body.status === undefined || !ITEM_STATUSES.has(body.status)) {
            throw apiError("A valid task status is required");
          }
          const statusChangedAt = new Date();
          t.status = body.status;
          if (prev !== "pending" || body.status !== "pending") {
            if (!t.workStartedAt) t.workStartedAt = statusChangedAt;
            if (!m.workStartedAt) m.workStartedAt = statusChangedAt;
          }
          const justCompleted =
            body.status === "completed" && prev !== "completed";
          if (body.status !== undefined && body.status !== prev) {
            project.events.push({
              _id: uuidv4(),
              type: "task",
              body: `Task '${t.title}' → ${String(body.status).replace("_", " ")}`,
              actorName,
              createdAt: statusChangedAt,
            });
          }
          project.markModified("milestones");
          await project.save();
          if (justCompleted) {
            const clientId = await resolveClientUserId(project);
            await notifyUser({
              userId: clientId,
              actorId: user._id,
              type: "task_done",
              title: `${project.title}: task completed`,
              body: `Task '${t.title}' was completed.`,
              link: projLink,
              entityType: "project",
              entityId: project._id,
              email: false,
            });
          }
          return NextResponse.json(project, { headers: getCorsHeaders() });
        }

        // Milestone-level update
        const prev = m.status;
        if (body.status === undefined || !ITEM_STATUSES.has(body.status)) {
          throw apiError("A valid milestone status is required");
        }
        const statusChangedAt = new Date();
        m.status = body.status;
        if (
          (prev !== "pending" || body.status !== "pending") &&
          !m.workStartedAt
        ) {
          m.workStartedAt = statusChangedAt;
        }
        const justCompleted =
          body.status === "completed" && prev !== "completed";
        if (body.status !== undefined && body.status !== prev) {
          project.events.push({
            _id: uuidv4(),
            type: "milestone",
            body: `Milestone '${m.title}' → ${String(body.status).replace("_", " ")}`,
            actorName,
            createdAt: statusChangedAt,
          });
        }
        project.markModified("milestones");
        await project.save();
        if (justCompleted) {
          const clientId = await resolveClientUserId(project);
          await notifyUser({
            userId: clientId,
            actorId: user._id,
            type: "milestone_done",
            title: `${project.title}: milestone completed`,
            body: `Milestone '${m.title}' was completed.`,
            link: projLink,
            entityType: "project",
            entityId: project._id,
            email: true,
          });
        }
        return NextResponse.json(project, { headers: getCorsHeaders() });
      }
    }

    // PATCH /project-requests/:id/status (admin)
    if (path[0] === "project-requests" && path[1] && path[2] === "status") {
      const user = await getUserFromRequest(request);
      if (!user || !user.isAdmin) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const reqDoc = await ProjectRequest.findById(path[1]);
      if (!reqDoc) {
        return NextResponse.json(
          { error: "Request not found" },
          { status: 404, headers: getCorsHeaders() },
        );
      }
      const now = new Date();
      const allowedStatuses = new Set(["new", "discussion", "closed"]);
      if (!allowedStatuses.has(body.status)) {
        return NextResponse.json(
          {
            error:
              "This request status is controlled by the proposal lifecycle",
          },
          { status: 409, headers: getCorsHeaders() },
        );
      }
      reqDoc.status = body.status;
      reqDoc.messages.push({
        _id: uuidv4(),
        authorName: "DMDevelon",
        authorRole: "admin",
        type: "system",
        body: `Status changed to ${body.status}`,
        createdAt: now,
      });
      reqDoc.lastActivityAt = now;
      await reqDoc.save();
      {
        const clientId = await resolveClientUserId(reqDoc);
        await notifyUser({
          userId: clientId,
          actorId: user._id,
          type: "status_change",
          title: `Request status: ${reqDoc.title}`,
          body: `Status changed to ${body.status}.`,
          link: `/dashboard/requests/${reqDoc._id}`,
          entityType: "request",
          entityId: reqDoc._id,
          email: false,
        });
      }
      return NextResponse.json(reqDoc, { headers: getCorsHeaders() });
    }

    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: getCorsHeaders() },
    );
  } catch (error) {
    return errorResponse(error, "PATCH");
  }
}
