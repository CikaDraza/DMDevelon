// SHC-2 regression: PUT /api/users/:id accepted a raw Mongo update document.
// A self-authorized user could bypass the shallow body.isAdmin check with
// { $set: { isAdmin: true } } and become a global administrator.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { comparePassword, hashPassword } from "@/lib/auth";
import ClientProject from "@/models/ClientProject";
import User from "@/models/User";
import {
  callApi,
  connectTestDb,
  disconnectTestDb,
  makeProject,
  makeUser,
  resetDb,
  tokenFor,
} from "./harness.mjs";

let self;
let other;
let admin;

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

beforeEach(async () => {
  await resetDb();
  self = await makeUser({ name: "Self", email: "self@test.local" });
  other = await makeUser({ name: "Other", email: "other@test.local" });
  admin = await makeUser({
    name: "Admin",
    email: "admin@test.local",
    isAdmin: true,
  });
});

describe("PUT /api/users/:id authorization", () => {
  it("rejects an anonymous caller", async () => {
    const res = await callApi("PUT", `users/${self._id}`, {
      body: { name: "Anonymous rewrite" },
    });

    expect(res.status).toBe(401);
    expect((await User.findById(self._id)).name).toBe("Self");
  });

  it("rejects an authenticated actor targeting another user", async () => {
    const res = await callApi("PUT", `users/${other._id}`, {
      token: tokenFor(self),
      body: { name: "Cross-account rewrite" },
    });

    expect(res.status).toBe(401);
    expect((await User.findById(other._id)).name).toBe("Other");
  });
});

describe("PUT /api/users/:id mutation boundary", () => {
  it("rejects a top-level Mongo operator and prevents admin escalation", async () => {
    const res = await callApi("PUT", `users/${self._id}`, {
      token: tokenFor(self),
      body: { $set: { isAdmin: true } },
    });

    expect(res.status).toBe(400);
    expect((await User.findById(self._id)).isAdmin).toBe(false);
  });

  it("rejects unsafe keys recursively, including inside arrays", async () => {
    const nestedOperator = await callApi("PUT", `users/${self._id}`, {
      token: tokenFor(self),
      body: { ignored: { nested: { $set: { isAdmin: true } } } },
    });
    const dottedPath = await callApi("PUT", `users/${self._id}`, {
      token: tokenFor(self),
      body: {
        name: "Should not be written",
        ignored: [{ "profile.isAdmin": true }],
      },
    });

    expect(nestedOperator.status).toBe(400);
    expect(dottedPath.status).toBe(400);
    const persisted = await User.findById(self._id);
    expect(persisted.name).toBe("Self");
    expect(persisted.isAdmin).toBe(false);
  });

  it("ignores direct privileged and unknown fields for a self update", async () => {
    const res = await callApi("PUT", `users/${self._id}`, {
      token: tokenFor(self),
      body: {
        name: "Allowed Name",
        isAdmin: true,
        sessionVersion: 999,
        emailVerified: false,
        verifiedAt: null,
        accountOrigin: "production",
        provider: "forged",
        lastActiveAt: "2000-01-01T00:00:00.000Z",
        emailNotifications: false,
        pushNotifications: false,
        unknownField: "ignored",
      },
    });

    expect(res.status).toBe(200);
    const persisted = await User.findById(self._id);
    expect(persisted.name).toBe("Allowed Name");
    expect(persisted.isAdmin).toBe(false);
    expect(persisted.sessionVersion).toBe(0);
    expect(persisted.emailVerified).toBe(true);
    // These provenance fields do not exist in the older main User schema;
    // injection must not materialize them while the main model stays intact.
    expect(persisted.verifiedAt).toBeUndefined();
    expect(persisted.accountOrigin).toBeUndefined();
    expect(persisted.provider).toBe("local");
    expect(persisted.lastActiveAt).toBeNull();
    expect(persisted.emailNotifications).toBe(true);
    expect(persisted.pushNotifications).toBe(true);
    expect(persisted.unknownField).toBeUndefined();
  });

  it("rejects invalid types for allowed fields", async () => {
    const res = await callApi("PUT", `users/${self._id}`, {
      token: tokenFor(self),
      body: { name: { value: "not a string" } },
    });

    expect(res.status).toBe(400);
    expect((await User.findById(self._id)).name).toBe("Self");
  });

  it("allows the existing self profile fields", async () => {
    const res = await callApi("PUT", `users/${self._id}`, {
      token: tokenFor(self),
      body: {
        name: "Updated Self",
        image: "https://example.test/avatar.png",
        email: "updated-self@test.local",
      },
    });

    expect(res.status).toBe(200);
    const persisted = await User.findById(self._id);
    expect(persisted.name).toBe("Updated Self");
    expect(persisted.image).toBe("https://example.test/avatar.png");
    expect(persisted.email).toBe("updated-self@test.local");
  });

  it("keeps password hashing and session invalidation in one update", async () => {
    self.password = hashPassword("old-password");
    await self.save();
    const oldToken = tokenFor(self);

    const res = await callApi("PUT", `users/${self._id}`, {
      token: oldToken,
      body: { password: "new-password", sessionVersion: 999 },
    });

    expect(res.status).toBe(200);
    const persisted = await User.findById(self._id);
    expect(comparePassword("new-password", persisted.password)).toBe(true);
    expect(persisted.sessionVersion).toBe(1);

    const oldSession = await callApi("GET", "auth/me", { token: oldToken });
    expect(oldSession.status).toBe(401);
  });

  it("preserves the active-project email guard", async () => {
    await makeProject({ owner: self, title: "Active Project" });

    const res = await callApi("PUT", `users/${self._id}`, {
      token: tokenFor(self),
      body: { name: "Name still updates", email: "blocked@test.local" },
    });

    expect(res.status).toBe(200);
    const persisted = await User.findById(self._id);
    expect(persisted.name).toBe("Name still updates");
    expect(persisted.email).toBe("self@test.local");
    expect(await ClientProject.countDocuments({ clientUserId: self._id })).toBe(1);
  });

  it("keeps admin role changes functional", async () => {
    const promote = await callApi("PUT", `users/${other._id}`, {
      token: tokenFor(admin),
      body: { isAdmin: true },
    });
    expect(promote.status).toBe(200);
    expect((await User.findById(other._id)).isAdmin).toBe(true);

    const demote = await callApi("PUT", `users/${other._id}`, {
      token: tokenFor(admin),
      body: { isAdmin: false },
    });
    expect(demote.status).toBe(200);
    expect((await User.findById(other._id)).isAdmin).toBe(false);
  });

  it("preserves the existing ability for an admin to demote themselves", async () => {
    const res = await callApi("PUT", `users/${admin._id}`, {
      token: tokenFor(admin),
      body: { isAdmin: false },
    });

    expect(res.status).toBe(200);
    expect((await User.findById(admin._id)).isAdmin).toBe(false);
  });

  it("preserves admin password reset and derives the target session bump", async () => {
    other.password = hashPassword("old-password");
    await other.save();

    const res = await callApi("PUT", `users/${other._id}`, {
      token: tokenFor(admin),
      body: { password: "admin-reset-password", sessionVersion: 999 },
    });

    expect(res.status).toBe(200);
    const persisted = await User.findById(other._id);
    expect(comparePassword("admin-reset-password", persisted.password)).toBe(
      true,
    );
    expect(persisted.sessionVersion).toBe(1);
  });
});
