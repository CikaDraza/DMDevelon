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
import {
  hashPassword,
  comparePassword,
  generateToken,
  getUserFromRequest,
} from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
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

function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

// Admin gets full access; client only to their own projects (by id or email).
function canAccessClientProject(user, project) {
  if (!user || !project) return false;
  if (user.isAdmin) return true;
  return (
    (project.clientUserId && project.clientUserId === user.userId) ||
    (project.clientEmail && project.clientEmail === user.email)
  );
}

// Same ownership rule for project requests.
function canAccessRequest(user, req) {
  if (!user || !req) return false;
  if (user.isAdmin) return true;
  return (
    (req.clientUserId && req.clientUserId === user.userId) ||
    (req.clientEmail && req.clientEmail === user.email)
  );
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: getCorsHeaders() });
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
        : { $or: [{ clientUserId: user.userId }, { clientEmail: user.email }] };
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
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
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
        : { $or: [{ clientUserId: user.userId }, { clientEmail: user.email }] };
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

    // User profile
    if (pathStr === "auth/me") {
      const user = await getUserFromRequest(request);
      if (!user) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const userData = await User.findById(user.userId).select(
        "-password -verifyToken -resetToken -resetTokenExpiry",
      );
      if (!userData) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404, headers: getCorsHeaders() },
        );
      }
      return NextResponse.json(userData, { headers: getCorsHeaders() });
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
    console.error("GET Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}

export async function POST(request, context) {
  await connectDB();
  const params = await context.params;
  const path = params?.path || [];
  const pathStr = path.join("/");

  try {
    const body = await request.json();

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
      const clientSlug = slugify(body.clientName || body.title);
      const project = await ClientProject.create({
        _id: uuidv4(),
        ...body,
        clientSlug,
      });
      // Create the Cloudinary folder tree for this client (+ admin folder).
      ensureClientFolders(clientSlug).catch(() => {});
      ensureAdminFolders().catch(() => {});
      return NextResponse.json(project, {
        status: 201,
        headers: getCorsHeaders(),
      });
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
      const message = await ProjectMessage.create({
        _id: uuidv4(),
        projectId: id,
        milestoneId: body.milestoneId,
        authorUserId: user.userId,
        authorName: body.authorName || user.email,
        authorRole: user.isAdmin ? "admin" : "client",
        body: body.body || "",
        attachments: Array.isArray(body.attachments) ? body.attachments : [],
      });
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
      const owner = await User.findById(user.userId);
      const clientName = owner?.name || body.clientName || user.email;
      const clientEmail = owner?.email || user.email;
      const clientSlug = slugify(clientName);
      const now = new Date();
      const messages = body.description
        ? [
            {
              _id: uuidv4(),
              authorUserId: user.userId,
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
        clientUserId: user.userId,
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
          authorUserId: user.userId,
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
        return NextResponse.json(reqDoc, {
          status: 201,
          headers: getCorsHeaders(),
        });
      }

      if (path[2] === "accept") {
        if (reqDoc.linkedClientProjectId) {
          return NextResponse.json(
            { projectId: reqDoc.linkedClientProjectId, request: reqDoc },
            { headers: getCorsHeaders() },
          );
        }
        const clientSlug = reqDoc.clientSlug || slugify(reqDoc.clientName);
        const project = await ClientProject.create({
          _id: uuidv4(),
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
        });
        ensureClientFolders(clientSlug).catch(() => {});
        reqDoc.status = "approved";
        if (reqDoc.proposal) reqDoc.proposal.acceptedAt = now;
        reqDoc.linkedClientProjectId = project._id;
        reqDoc.messages.push({
          _id: uuidv4(),
          authorName: "System",
          authorRole: role,
          type: "system",
          body: "Request approved — project created.",
          createdAt: now,
        });
        reqDoc.lastActivityAt = now;
        await reqDoc.save();
        return NextResponse.json(
          { projectId: project._id, request: reqDoc },
          { status: 201, headers: getCorsHeaders() },
        );
      }

      if (path[2] === "request-changes") {
        if (body.body) {
          reqDoc.messages.push({
            _id: uuidv4(),
            authorUserId: user.userId,
            authorName: body.authorName || reqDoc.clientName || user.email,
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
        reqDoc.lastActivityAt = now;
        await reqDoc.save();
        return NextResponse.json(reqDoc, { headers: getCorsHeaders() });
      }
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
        folder = adminFolder(kind);
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
        userId: user?.userId || null,
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
    console.error("POST Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}

export async function PUT(request, context) {
  await connectDB();
  const params = await context.params;
  const path = params?.path || [];
  const pathStr = path.join("/");

  try {
    const body = await request.json();

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
      // Publish to public portfolio: create a linked Project once.
      if (
        body.publishToHomepage &&
        !existing.linkedProjectId &&
        !body.linkedProjectId
      ) {
        const title = body.title || existing.title;
        const slug = title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
        const portfolio = await Project.create({
          _id: uuidv4(),
          title,
          description: body.description || existing.description || title,
          image_url: body.coverImageUrl || existing.coverImageUrl || "",
          live_preview_url: body.livePreviewUrl || existing.livePreviewUrl || "",
          github_url: body.githubRepoUrl || existing.githubRepoUrl || "",
          color: body.color || existing.color || "blue",
          category: body.category || existing.category || "Web App",
          slug,
        });
        body.linkedProjectId = portfolio._id;
      }
      // Reassign / renamed client -> recompute slug and ensure its folders.
      if (body.clientName && slugify(body.clientName) !== existing.clientSlug) {
        body.clientSlug = slugify(body.clientName);
        ensureClientFolders(body.clientSlug).catch(() => {});
      }
      const project = await ClientProject.findByIdAndUpdate(id, body, {
        new: true,
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
      const now = new Date();
      reqDoc.proposal = {
        title: body.title || reqDoc.title,
        scope: body.scope || "",
        timeline: body.timeline || "",
        budget: body.budget || "",
        version: (reqDoc.proposal?.version || 0) + 1,
        sentAt: now,
        acceptedAt: reqDoc.proposal?.acceptedAt || null,
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
      // User can update their own profile, admin can update anyone
      if (!user || (user.userId !== id && !user.isAdmin)) {
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
    console.error("PUT Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: getCorsHeaders() },
    );
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
      if (!user || (testimonial.userId !== user.userId && !user.isAdmin)) {
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
      if (!user || (user.userId !== id && !user.isAdmin)) {
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

    if (path[0] === "client-projects" && path[1]) {
      const user = await getUserFromRequest(request);
      if (!user || !user.isAdmin) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      const id = path[1];

      // PATCH /client-projects/:id/status
      if (path[2] === "status") {
        const update = {};
        if (body.status !== undefined) update.status = body.status;
        if (body.publishToHomepage !== undefined)
          update.publishToHomepage = body.publishToHomepage;
        const project = await ClientProject.findByIdAndUpdate(
          id,
          { $set: update },
          { new: true },
        );
        if (!project) {
          return NextResponse.json(
            { error: "Project not found" },
            { status: 404, headers: getCorsHeaders() },
          );
        }
        return NextResponse.json(project, { headers: getCorsHeaders() });
      }

      // PATCH /client-projects/:id/milestone/:mid[/task/:tid]
      if (path[2] === "milestone" && path[3]) {
        const mid = path[3];

        // Task-level update
        if (path[4] === "task" && path[5]) {
          const tid = path[5];
          const set = {};
          ["status", "title", "description", "order"].forEach((k) => {
            if (body[k] !== undefined)
              set[`milestones.$[m].tasks.$[t].${k}`] = body[k];
          });
          const project = await ClientProject.findByIdAndUpdate(
            id,
            { $set: set },
            {
              new: true,
              arrayFilters: [{ "m._id": mid }, { "t._id": tid }],
            },
          );
          if (!project) {
            return NextResponse.json(
              { error: "Project not found" },
              { status: 404, headers: getCorsHeaders() },
            );
          }
          return NextResponse.json(project, { headers: getCorsHeaders() });
        }

        // Milestone-level update
        const set = {};
        ["status", "title", "description", "icon", "order", "githubBranch"].forEach(
          (k) => {
            if (body[k] !== undefined) set[`milestones.$[m].${k}`] = body[k];
          },
        );
        const project = await ClientProject.findByIdAndUpdate(
          id,
          { $set: set },
          { new: true, arrayFilters: [{ "m._id": mid }] },
        );
        if (!project) {
          return NextResponse.json(
            { error: "Project not found" },
            { status: 404, headers: getCorsHeaders() },
          );
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
      return NextResponse.json(reqDoc, { headers: getCorsHeaders() });
    }

    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("PATCH Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
