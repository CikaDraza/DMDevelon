// SHC-1 regression: PUT /api/testimonials/:id used to authenticate only when
// the body carried `adminReply`. Any other field — name, rating, comment, even
// `userId` — was written for whoever asked, with no token and no ownership
// check, so an anonymous caller could rewrite any testimonial on the public
// marketing site.
//
// These tests pin the boundary to the operation and the resource rather than
// to one payload field, which is the shape the bug had.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { v4 as uuidv4 } from "uuid";
import {
  callApi,
  connectTestDb,
  disconnectTestDb,
  makeUser,
  resetDb,
  tokenFor,
} from "./harness.mjs";
import Testimonial from "@/models/Testimonial";

let author;
let stranger;
let admin;
let testimonial;

async function seedTestimonial(overrides = {}) {
  return Testimonial.create({
    _id: uuidv4(),
    clientName: "Real Client",
    clientEmail: "real.client@example.com",
    clientTitle: "CTO",
    rating: 5,
    comment: "Genuine praise.",
    userId: author?._id || null,
    ...overrides,
  });
}

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  await Testimonial.deleteMany({});
  await disconnectTestDb();
});

beforeEach(async () => {
  await resetDb();
  await Testimonial.deleteMany({});
  author = await makeUser({ name: "Author", email: "author@test.local" });
  stranger = await makeUser({ name: "Stranger", email: "stranger@test.local" });
  admin = await makeUser({ name: "Admin", email: "admin@test.local", isAdmin: true });
  testimonial = await seedTestimonial();
});

describe("PUT /api/testimonials/:id authorization", () => {
  it("rejects an anonymous caller and leaves the record untouched", async () => {
    const res = await callApi("PUT", `/testimonials/${testimonial._id}`, {
      body: { clientName: "Defaced", rating: 1, comment: "Owned." },
    });

    expect(res.status).toBe(401);

    const after = await Testimonial.findById(testimonial._id);
    expect(after.clientName).toBe("Real Client");
    expect(after.rating).toBe(5);
    expect(after.comment).toBe("Genuine praise.");
  });

  it("rejects an authenticated user who does not own the testimonial", async () => {
    const res = await callApi("PUT", `/testimonials/${testimonial._id}`, {
      token: tokenFor(stranger),
      body: { comment: "Not mine to edit." },
    });

    expect(res.status).toBe(403);

    const after = await Testimonial.findById(testimonial._id);
    expect(after.comment).toBe("Genuine praise.");
  });

  it("allows the author to update their own testimonial", async () => {
    const res = await callApi("PUT", `/testimonials/${testimonial._id}`, {
      token: tokenFor(author),
      body: { comment: "Updated by its author.", rating: 4 },
    });

    expect(res.status).toBe(200);
    expect(res.body.comment).toBe("Updated by its author.");
    expect(res.body.rating).toBe(4);
  });

  it("allows an admin to update any testimonial", async () => {
    const res = await callApi("PUT", `/testimonials/${testimonial._id}`, {
      token: tokenFor(admin),
      body: { comment: "Corrected by an operator." },
    });

    expect(res.status).toBe(200);
    expect(res.body.comment).toBe("Corrected by an operator.");
  });

  it("returns 404 for a missing testimonial without leaking the difference to a stranger", async () => {
    const res = await callApi("PUT", `/testimonials/${uuidv4()}`, {
      token: tokenFor(admin),
      body: { comment: "No such record." },
    });

    expect(res.status).toBe(404);
  });
});

describe("PUT /api/testimonials/:id field policy", () => {
  it("keeps adminReply admin-only", async () => {
    const res = await callApi("PUT", `/testimonials/${testimonial._id}`, {
      token: tokenFor(author),
      body: { adminReply: "Forged operator reply." },
    });

    expect(res.status).toBe(403);

    const after = await Testimonial.findById(testimonial._id);
    expect(after.adminReply).toBe("");
  });

  it("lets an admin set adminReply", async () => {
    const res = await callApi("PUT", `/testimonials/${testimonial._id}`, {
      token: tokenFor(admin),
      body: { adminReply: "Thanks for the feedback." },
    });

    expect(res.status).toBe(200);
    expect(res.body.adminReply).toBe("Thanks for the feedback.");
  });

  it("ignores userId so a caller cannot reassign ownership to themselves", async () => {
    const res = await callApi("PUT", `/testimonials/${testimonial._id}`, {
      token: tokenFor(author),
      body: { comment: "Still mine.", userId: stranger._id },
    });

    expect(res.status).toBe(200);

    const after = await Testimonial.findById(testimonial._id);
    expect(String(after.userId)).toBe(String(author._id));
  });

  it("does not let an ordinary field ride along with a rejected adminReply", async () => {
    const res = await callApi("PUT", `/testimonials/${testimonial._id}`, {
      token: tokenFor(author),
      body: { comment: "Sneaked through.", adminReply: "Forged." },
    });

    expect(res.status).toBe(403);

    const after = await Testimonial.findById(testimonial._id);
    expect(after.comment).toBe("Genuine praise.");
    expect(after.adminReply).toBe("");
  });
});
