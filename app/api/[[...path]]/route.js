import { NextResponse } from "next/server";
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
import Notification from "@/models/Notification";
import PushSubscription from "@/models/PushSubscription";
import {
  notifyUser,
  notifyAdmins,
  resolveClientUserId,
} from "@/lib/notify";
import {
  hashPassword,
  comparePassword,
  generateToken,
  getUserFromRequest,
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
import {
  uploadToCloudinary,
  ensureClientFolders,
  ensureAdminFolders,
  clientFolder,
  adminFolder,
} from "@/lib/cloudinary";
import { slugify } from "@/lib/slugify";
import {
  canAccessClientEntity,
  canPerformClientProposalAction,
  materializeMilestonePlan as materializeProposalMilestones,
  preparePhaseArchive,
} from "@/lib/project-proposal-domain.mjs";

function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

// Admin gets full access; client only to their own projects (by id or email).
function canAccessClientProject(user, project) {
  return canAccessClientEntity(user, project);
}

// Same ownership rule for project requests.
function canAccessRequest(user, req) {
  return canAccessClientEntity(user, req);
}

const CLIENT_PROPOSAL_STATUSES = [
  "sent",
  "changes_requested",
  "accepted",
];
const ITEM_STATUSES = new Set(["pending", "in_progress", "completed"]);
const PROJECT_STATUSES = new Set([
  "planning",
  "in_progress",
  "completed",
  "on_hold",
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
  if (value === undefined) return JSON.parse(JSON.stringify(existingPlan || []));
  if (!Array.isArray(value)) throw apiError("milestonePlan must be an array");
  if (value.length > 60) throw apiError("milestonePlan has too many milestones");

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
      throw apiError(`Task order values must be unique in milestone ${index + 1}`);
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
      githubBranch: cleanString(
        raw.githubBranch,
        "Milestone git branch",
        250,
      ),
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
          title: cleanString(
            task.title,
            `Task ${taskIndex + 1} title`,
            200,
            { required: true },
          ),
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
    title: cleanString(
      body.title ?? existing?.title,
      "Proposal title",
      200,
      { required: true },
    ),
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
    type: { $in: ["project_message", "request_message"] },
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
    processedIds.push(...notes.map((n) => n._id));
    const recipient = await User.findById(userId);
    // Skip (but still mark processed) if user opted out or has no email.
    if (!recipient?.email || recipient.emailNotifications === false) {
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
      const projects = await ClientProject.find(query).sort({ createdAt: -1 });
      return NextResponse.json(projects, { headers: getCorsHeaders() });
    }

    if (pathStr.startsWith("client-projects/")) {
      const user = await getUserFromRequest(request);
      if (!user) {
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
      if (!canAccessClientProject(user, project)) {
        return NextResponse.json(
          { error: "Forbidden" },
          { status: 403, headers: getCorsHeaders() },
        );
      }
      // Proposals belonging to this single client project. Drafts are never
      // returned to clients, even when a proposal id is guessed directly.
      if (path[2] === "proposals") {
        const proposalQuery = {
          projectId: id,
          ...(user.isAdmin
            ? {}
            : { status: { $in: CLIENT_PROPOSAL_STATUSES } }),
        };
        if (path[3]) proposalQuery._id = path[3];
        if (path[3]) {
          const proposal = await ProjectProposal.findOne(proposalQuery);
          if (!proposal) {
            return NextResponse.json(
              { error: "Proposal not found" },
              { status: 404, headers: getCorsHeaders() },
            );
          }
          return NextResponse.json(proposal, { headers: getCorsHeaders() });
        }
        const proposals = await ProjectProposal.find(proposalQuery).sort({
          phaseNumber: 1,
          createdAt: 1,
        });
        return NextResponse.json(proposals, { headers: getCorsHeaders() });
      }
      // Per-milestone chat thread: client-projects/:id/messages?milestoneId=...
      if (path[2] === "messages") {
        const milestoneId = searchParams.get("milestoneId");
        const mq = { projectId: id };
        if (milestoneId) mq.milestoneId = milestoneId;
        const messages = await ProjectMessage.find(mq).sort({ createdAt: 1 });
        return NextResponse.json(messages, { headers: getCorsHeaders() });
      }
      return NextResponse.json(project, { headers: getCorsHeaders() });
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
      const user = await getUserFromRequest(request);
      if (!user) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const id = path[1];
      const req = await ProjectRequest.findById(id);
      if (!req) {
        return NextResponse.json(
          { error: "Request not found" },
          { status: 404, headers: getCorsHeaders() },
        );
      }
      if (!canAccessRequest(user, req)) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
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

    // Auth - Register
    if (pathStr === "auth/register") {
      const { name, email, password } = body;
      if (!name || !email || !password) {
        return NextResponse.json(
          { error: "Missing required fields" },
          { status: 400, headers: getCorsHeaders() },
        );
      }
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return NextResponse.json(
          { error: "Email already exists" },
          { status: 400, headers: getCorsHeaders() },
        );
      }
      const hashedPassword = hashPassword(password);
      const verifyToken = randomBytes(32).toString("hex");
      const user = await User.create({
        _id: uuidv4(),
        name,
        email,
        password: hashedPassword,
        isAdmin: false,
        emailVerified: false,
        verifyToken,
      });

      try {
        const verificationUrl = `${APP_URL}/verify-email?token=${verifyToken}`;
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

      const token = generateToken({
        userId: user._id,
        email: user.email,
        isAdmin: user.isAdmin,
      });
      return NextResponse.json(
        {
          token,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            isAdmin: user.isAdmin,
            emailVerified: user.emailVerified,
          },
        },
        { headers: getCorsHeaders() },
      );
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
      const token = generateToken({
        userId: user._id,
        email: user.email,
        isAdmin: user.isAdmin,
      });
      return NextResponse.json(
        {
          token,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            isAdmin: user.isAdmin,
            image: user.image,
            emailVerified: user.emailVerified,
          },
        },
        { headers: getCorsHeaders() },
      );
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
            const resetUrl = `${APP_URL}/reset-password?token=${user.resetToken}`;
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
        const verificationUrl = `${APP_URL}/verify-email?token=${user.verifyToken}`;
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
      if (!PROJECT_STATUSES.has(status)) throw apiError("Invalid project status");
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
          if (!ITEM_STATUSES.has(taskStatus)) throw apiError("Invalid task status");
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
        description: cleanString(body.description, "Project description", 100000),
        requirements: cleanString(body.requirements, "Project requirements", 100000),
        status,
        githubRepoUrl: cleanString(body.githubRepoUrl, "GitHub URL", 2000),
        livePreviewUrl: cleanString(body.livePreviewUrl, "Live preview URL", 2000),
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
            );
            const hasStoredRecipient =
              txProposal.archiveRecipientUserId !== null &&
              txProposal.archiveRecipientUserId !== undefined;
            let recipientUserId = hasStoredRecipient
              ? txProposal.archiveRecipientUserId || null
              : txProject.clientUserId || null;
            if (!hasStoredRecipient && !recipientUserId && txProject.clientEmail) {
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
                    archiveReason: reason,
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
                    actorName:
                      archived.archivedByName || user.name || "Admin",
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
          body: reason || `${project.clientName || "The client"} requested changes.`,
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
    if (pathStr.startsWith("client-projects/") && path[2] === "messages") {
      const user = await getUserFromRequest(request);
      if (!user) {
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
      if (!canAccessClientProject(user, project)) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      if (!body.milestoneId) {
        return NextResponse.json(
          { error: "milestoneId is required" },
          { status: 400, headers: getCorsHeaders() },
        );
      }
      const milestone = (project.milestones || []).find(
        (item) => String(item._id) === String(body.milestoneId),
      );
      if (!milestone) {
        return NextResponse.json(
          { error: "Milestone not found" },
          { status: 404, headers: getCorsHeaders() },
        );
      }
      const allowedMessageTypes = user.isAdmin
        ? new Set(["message", "question", "system", "change_agreed"])
        : new Set(["message", "question", "change_request"]);
      const messageType = body.messageType || "message";
      if (!allowedMessageTypes.has(messageType)) {
        return NextResponse.json(
          { error: "Invalid message type" },
          { status: 400, headers: getCorsHeaders() },
        );
      }
      const message = await ProjectMessage.create({
        _id: uuidv4(),
        projectId: id,
        milestoneId: body.milestoneId,
        proposalId: milestone.proposalId || null,
        messageType,
        authorUserId: user._id,
        authorName:
          user.name || (user.isAdmin ? "DMDevelon" : project.clientName) || user.email,
        authorRole: user.isAdmin ? "admin" : "client",
        body: cleanString(body.body, "Message", 10000),
        attachments: Array.isArray(body.attachments) ? body.attachments : [],
      });
      const msgPreview = (body.body || "").slice(0, 140);
      if (user.isAdmin) {
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
      } else {
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
      const user = await getUserFromRequest(request);
      if (!user) {
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
      if (!canAccessRequest(user, reqDoc)) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
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
        if (user.isAdmin && reqDoc.status === "new") reqDoc.status = "discussion";
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
      else if (body.entityId) {
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
      return NextResponse.json({ success: true }, { headers: getCorsHeaders() });
    }

    // File upload (images + PDF) to Cloudinary (auth required)
    if (pathStr === "upload") {
      const user = await getUserFromRequest(request);
      if (!user) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const { file, name, projectId, requestId, kind } = body;
      if (!file) {
        return NextResponse.json(
          { error: "No file provided" },
          { status: 400, headers: getCorsHeaders() },
        );
      }
      const isPdf =
        file.startsWith("data:application/pdf") ||
        (name && name.toLowerCase().endsWith(".pdf"));
      if (!file.startsWith("data:image/") && !isPdf) {
        return NextResponse.json(
          { error: "Only images and PDF files are allowed" },
          { status: 400, headers: getCorsHeaders() },
        );
      }
      // Resolve destination folder: admin -> portfolio/admin/<kind>,
      // client -> portfolio/clients/<slug>/<kind>. Requires owner access to
      // the referenced project or request.
      let folder;
      if (projectId) {
        const project = await ClientProject.findById(projectId);
        if (!project || !canAccessClientProject(user, project)) {
          return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401, headers: getCorsHeaders() },
          );
        }
        folder = user.isAdmin
          ? adminFolder(kind)
          : clientFolder(project.clientSlug || slugify(project.clientName), kind);
      } else if (requestId) {
        const reqDoc = await ProjectRequest.findById(requestId);
        if (!reqDoc || !canAccessRequest(user, reqDoc)) {
          return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401, headers: getCorsHeaders() },
          );
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
      const url = await uploadToCloudinary(file, { folder });
      return NextResponse.json(
        { url, type: isPdf ? "pdf" : "image", name: name || "" },
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
        if (!PROJECT_STATUSES.has(body.status)) throw apiError("Invalid project status");
        update.status = body.status;
      }
      if (body.publishToHomepage !== undefined) {
        if (typeof body.publishToHomepage !== "boolean") {
          throw apiError("publishToHomepage must be a boolean");
        }
        update.publishToHomepage = body.publishToHomepage;
      }
      // Publish to public portfolio: create a linked Project once.
      if (
        body.publishToHomepage &&
        !existing.linkedProjectId
      ) {
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
      const revisionHistory = [
        ...(existingProposal.revisionHistory || []),
      ];
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
      if (body.email !== undefined) {
        const target = await User.findById(id);
        if (target && body.email !== target.email) {
          const activeProjects = await ClientProject.countDocuments({
            status: { $ne: "completed" },
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

    // Client Projects (admin only)
    if (pathStr.startsWith("client-projects/")) {
      if (!user || !user.isAdmin) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const id = path[1];
      const project = await ClientProject.findByIdAndDelete(id);
      if (!project) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404, headers: getCorsHeaders() },
        );
      }
      await ProjectMessage.deleteMany({ projectId: id });
      await ProjectProposal.deleteMany({ projectId: id });
      return NextResponse.json(
        { message: "Project deleted" },
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
        status: { $ne: "completed" },
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
      const deletedUser = await User.findByIdAndDelete(id);
      if (!deletedUser) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404, headers: getCorsHeaders() },
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
    console.error("DELETE Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: getCorsHeaders() },
    );
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
