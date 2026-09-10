import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import Project from "@/models/Project";
import Service from "@/models/Service";
import User from "@/models/User";

const ALLOWED_EMAILS = [
  "milan.drazic@dmdevelon.website",
  "gordana@spiritualized-language-tutor.com",
  "sanjaneuer@gmail.com",
];

const payloadSchema = z.object({
  users: z.array(z.record(z.unknown())).length(ALLOWED_EMAILS.length),
  projects: z.array(z.record(z.unknown())),
  services: z.array(z.record(z.unknown())),
});

function hasValidSecret(request) {
  const expected = process.env.STAGING_MIGRATION_SECRET || "";
  const provided = request.headers.get("x-dmd-migration-secret") || "";
  if (!expected || expected.length !== provided.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

function prepareUser(user) {
  const copy = { ...user };
  delete copy.verifyToken;
  delete copy.resetToken;
  delete copy.resetTokenExpiry;
  copy.emailNotifications = false;
  copy.pushNotifications = false;
  copy.lastActiveAt = null;
  return copy;
}

export async function POST(request) {
  if (process.env.APP_ENV !== "staging" || !hasValidSecret(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let payload;
  try {
    payload = payloadSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const receivedEmails = payload.users
    .map((user) => String(user.email || "").trim().toLowerCase())
    .sort();
  const expectedEmails = [...ALLOWED_EMAILS].sort();
  if (JSON.stringify(receivedEmails) !== JSON.stringify(expectedEmails)) {
    return NextResponse.json({ error: "User allowlist mismatch" }, { status: 400 });
  }

  await connectDB();

  const [userCount, projectCount, serviceCount] = await Promise.all([
    User.countDocuments({}),
    Project.countDocuments({}),
    Service.countDocuments({}),
  ]);
  if (userCount || projectCount || serviceCount) {
    return NextResponse.json(
      {
        error: "Target collections must be empty",
        counts: { users: userCount, projects: projectCount, services: serviceCount },
      },
      { status: 409 },
    );
  }

  const inserted = [];
  try {
    const users = payload.users.map(prepareUser);
    await User.insertMany(users);
    inserted.push([User, users.map((document) => document._id)]);

    if (payload.projects.length) {
      await Project.insertMany(payload.projects);
      inserted.push([Project, payload.projects.map((document) => document._id)]);
    }

    if (payload.services.length) {
      await Service.insertMany(payload.services);
      inserted.push([Service, payload.services.map((document) => document._id)]);
    }
  } catch (error) {
    for (const [Model, ids] of inserted.reverse()) {
      await Model.deleteMany({ _id: { $in: ids } });
    }
    console.error("staging foundation import failed", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }

  return NextResponse.json({
    imported: {
      users: payload.users.length,
      projects: payload.projects.length,
      services: payload.services.length,
    },
  });
}
