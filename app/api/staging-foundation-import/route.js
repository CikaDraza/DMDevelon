import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import CMSPage from "@/models/CMSPage";
import CompanyProfile from "@/models/CompanyProfile";
import Project from "@/models/Project";
import Service from "@/models/Service";
import Testimonial from "@/models/Testimonial";
import User from "@/models/User";

const ALLOWED_EMAILS = [
  "milan.drazic@dmdevelon.website",
  "gordana@spiritualized-language-tutor.com",
  "sanjaneuer@gmail.com",
  "dmdevelon.orion@gmail.com",
];

const EXPECTED_PAYLOAD_SHA256 =
  "32f6380aacdd891f26a320f63f7efffa57f688aef4459bd174d517bfddbac6f1";

const EXCLUDED_COLLECTIONS = [
  "notifications",
  "chatchannels",
  "chatmessages",
  "chatreads",
  "projectmessages",
  "projectauditlogs",
];

const payloadSchema = z.object({
  users: z.array(z.record(z.unknown())).length(ALLOWED_EMAILS.length),
  services: z.array(z.record(z.unknown())).length(10),
  projects: z.array(z.record(z.unknown())).length(8),
  companyProfiles: z.array(z.record(z.unknown())).length(1),
  testimonials: z.array(z.record(z.unknown())).length(3),
  cmsPages: z.array(z.record(z.unknown())).length(4),
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
  if (Buffer.byteLength(rawPayload, "utf8") > 1_000_000) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const payloadSha256 = createHash("sha256").update(rawPayload).digest("hex");
  if (payloadSha256 !== EXPECTED_PAYLOAD_SHA256) {
    return NextResponse.json({ error: "Fixture digest mismatch" }, { status: 400 });
  }

  let payload;
  try {
    payload = payloadSchema.parse(JSON.parse(rawPayload));
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

  const selectedUserIds = new Set(payload.users.map((user) => String(user._id)));
  const externalTestimonialUserIds = payload.testimonials
    .map((testimonial) => testimonial.userId)
    .filter((userId) => userId && !selectedUserIds.has(String(userId)));
  if (externalTestimonialUserIds.length) {
    return NextResponse.json(
      { error: "Testimonial has an external user dependency" },
      { status: 409 },
    );
  }

  await connectDB();

  const fixtures = [
    { name: "users", Model: User, documents: payload.users.map(prepareUser) },
    { name: "services", Model: Service, documents: payload.services },
    { name: "projects", Model: Project, documents: payload.projects },
    {
      name: "companyProfiles",
      Model: CompanyProfile,
      documents: payload.companyProfiles,
    },
    { name: "testimonials", Model: Testimonial, documents: payload.testimonials },
    { name: "cmsPages", Model: CMSPage, documents: payload.cmsPages },
  ];

  await Promise.all(fixtures.map(({ Model }) => Model.init()));

  const replaceableIds = {};
  for (const fixture of fixtures) {
    const allowedIds = new Set(
      fixture.documents.map((document) => String(document._id)),
    );
    const existingIds = await fixture.Model.find({}).distinct("_id");
    const unexpectedIds = existingIds.filter(
      (id) => !allowedIds.has(String(id)),
    );
    if (fixture.name === "companyProfiles" && unexpectedIds.length === 1) {
      replaceableIds[fixture.name] = unexpectedIds;
      continue;
    }
    if (unexpectedIds.length) {
      return NextResponse.json(
        { error: `Unexpected records already exist in ${fixture.name}` },
        { status: 409 },
      );
    }
  }

  const session = await User.startSession();
  const results = {};
  try {
    await session.withTransaction(async () => {
      for (const fixture of fixtures) {
        const idsToReplace = replaceableIds[fixture.name] || [];
        const removed = idsToReplace.length
          ? (
              await fixture.Model.deleteMany(
                { _id: { $in: idsToReplace } },
                { session },
              )
            ).deletedCount
          : 0;
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
          removed,
          matched: result.matchedCount,
          modified: result.modifiedCount,
          upserted: result.upsertedCount,
        };
      }
    });
  } catch (error) {
    console.error("staging foundation import failed", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  } finally {
    await session.endSession();
  }

  const verified = {};
  for (const fixture of fixtures) {
    verified[fixture.name] = await fixture.Model.countDocuments({});
  }

  const [userIndexes, projectIndexes, cmsPageIndexes] = await Promise.all([
    User.collection.indexes(),
    Project.collection.indexes(),
    CMSPage.collection.indexes(),
  ]);
  const [importedUsers, excludedCounts] = await Promise.all([
    User.find({})
      .select({ name: 1, email: 1, isAdmin: 1 })
      .sort({ email: 1 })
      .lean(),
    Promise.all(
      EXCLUDED_COLLECTIONS.map(async (collectionName) => [
        collectionName,
        await User.db.db.collection(collectionName).countDocuments({}),
      ]),
    ),
  ]);

  return NextResponse.json({
    results,
    verified,
    users: importedUsers,
    excluded: Object.fromEntries(excludedCounts),
    indexes: {
      users: userIndexes.map(({ name, key, unique = false }) => ({
        name,
        key,
        unique,
      })),
      projects: projectIndexes.map(({ name, key, unique = false }) => ({
        name,
        key,
        unique,
      })),
      cmsPages: cmsPageIndexes.map(({ name, key, unique = false }) => ({
        name,
        key,
        unique,
      })),
    },
  });
}
