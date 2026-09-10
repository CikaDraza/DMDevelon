import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import ClientProject from "@/models/ClientProject";
import ProjectMember from "@/models/ProjectMember";
import User from "@/models/User";

const EXPECTED_PAYLOAD_SHA256 =
  "d4be52b52e8d79575c43cf929b31d40131f8fc9ba1f32fd8b40e33c6de7d6ad3";

const EXPECTED_USERS = new Map([
  ["milan.drazic@dmdevelon.website", "7ba9ebaf-f07f-48e5-b631-3df2a1e0efcb"],
  [
    "gordana@spiritualized-language-tutor.com",
    "93cf7074-c1c8-40c2-8a10-ce73256bb7e3",
  ],
  [
    "sanjaneuer@gmail.com",
    "ff9c35fb-7ecc-4536-9a49-5191589d6fc1",
  ],
  [
    "dmdevelon.orion@gmail.com",
    "f7da41a2-f229-475e-85a3-5b9d57f31732",
  ],
  ["makac06@gmail.com", "167c9c0c-0c30-4822-83e0-9a5462e710b0"],
]);

const BASELINE_EMAILS = [...EXPECTED_USERS.keys()].filter(
  (email) => email !== "makac06@gmail.com",
);

const EXPECTED_PROJECT_IDS = new Set([
  "c81aa6ea-8af1-58ef-ac0b-35323796751d",
  "d9d435d4-ab36-41f1-93c5-7b435ce270d6",
  "dcc4a553-1e91-5ef1-ac69-5ed2f5901ef7",
]);

const EXPECTED_MEMBER_ID = "57d95f45-a254-4b1e-b862-ea8daa4adb08";

const payloadSchema = z.object({
  user: z.record(z.unknown()),
  clientProjects: z.array(z.record(z.unknown())).length(3),
  projectMembers: z.array(z.record(z.unknown())).length(1),
});

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
  if (process.env.APP_ENV !== "staging") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rawPayload = await request.text();
  if (Buffer.byteLength(rawPayload, "utf8") > 500_000) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  if (
    createHash("sha256").update(rawPayload).digest("hex") !==
    EXPECTED_PAYLOAD_SHA256
  ) {
    return NextResponse.json({ error: "Fixture digest mismatch" }, { status: 400 });
  }

  let payload;
  try {
    payload = payloadSchema.parse(JSON.parse(rawPayload));
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const userEmail = String(payload.user.email || "").trim().toLowerCase();
  const projectIds = new Set(
    payload.clientProjects.map((project) => String(project._id)),
  );
  if (
    userEmail !== "makac06@gmail.com" ||
    String(payload.user._id) !== EXPECTED_USERS.get(userEmail) ||
    projectIds.size !== EXPECTED_PROJECT_IDS.size ||
    [...projectIds].some((id) => !EXPECTED_PROJECT_IDS.has(id)) ||
    String(payload.projectMembers[0]._id) !== EXPECTED_MEMBER_ID ||
    String(payload.projectMembers[0].userId) !== String(payload.user._id) ||
    String(payload.projectMembers[0].projectId) !==
      "dcc4a553-1e91-5ef1-ac69-5ed2f5901ef7"
  ) {
    return NextResponse.json({ error: "Fixture allowlist mismatch" }, { status: 400 });
  }

  await connectDB();
  await Promise.all([User.init(), ClientProject.init(), ProjectMember.init()]);

  const existingUsers = await User.find({})
    .select({ _id: 1, email: 1 })
    .lean();
  const invalidUser = existingUsers.some((user) => {
    const email = String(user.email || "").trim().toLowerCase();
    return EXPECTED_USERS.get(email) !== String(user._id);
  });
  const existingEmails = new Set(
    existingUsers.map((user) => String(user.email || "").trim().toLowerCase()),
  );
  if (
    invalidUser ||
    BASELINE_EMAILS.some((email) => !existingEmails.has(email)) ||
    ![4, 5].includes(existingUsers.length)
  ) {
    return NextResponse.json(
      { error: "Unexpected staging user baseline" },
      { status: 409 },
    );
  }

  const [existingProjectIds, existingMemberIds] = await Promise.all([
    ClientProject.find({}).distinct("_id"),
    ProjectMember.find({}).distinct("_id"),
  ]);
  if (
    existingProjectIds.some((id) => !EXPECTED_PROJECT_IDS.has(String(id))) ||
    existingMemberIds.some((id) => String(id) !== EXPECTED_MEMBER_ID)
  ) {
    return NextResponse.json(
      { error: "Unexpected staging project data" },
      { status: 409 },
    );
  }

  const fixtures = [
    { name: "user", Model: User, documents: [prepareUser(payload.user)] },
    {
      name: "clientProjects",
      Model: ClientProject,
      documents: payload.clientProjects,
    },
    {
      name: "projectMembers",
      Model: ProjectMember,
      documents: payload.projectMembers,
    },
  ];
  const results = {};
  const session = await User.startSession();
  try {
    await session.withTransaction(async () => {
      for (const fixture of fixtures) {
        const result = await fixture.Model.bulkWrite(
          fixture.documents.map((document) => ({
            replaceOne: {
              filter: { _id: document._id },
              replacement: document,
              upsert: true,
            },
          })),
          { ordered: true, session },
        );
        results[fixture.name] = {
          matched: result.matchedCount,
          modified: result.modifiedCount,
          upserted: result.upsertedCount,
        };
      }
    });
  } catch (error) {
    console.error("staging client project import failed", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  } finally {
    await session.endSession();
  }

  const [userCount, projects, members, memberIndexes] = await Promise.all([
    User.countDocuments({}),
    ClientProject.find({})
      .select({ title: 1, status: 1, clientEmail: 1, deletedAt: 1 })
      .sort({ title: 1 })
      .lean(),
    ProjectMember.find({})
      .select({ projectId: 1, userId: 1, role: 1, status: 1 })
      .lean(),
    ProjectMember.collection.indexes(),
  ]);

  return NextResponse.json({
    results,
    verified: {
      users: userCount,
      clientProjects: projects.length,
      projectMembers: members.length,
    },
    projects,
    members,
    memberIndexes: memberIndexes.map(({ name, key, unique = false }) => ({
      name,
      key,
      unique,
    })),
  });
}
