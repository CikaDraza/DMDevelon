import test from "node:test";
import assert from "node:assert/strict";

import {
  registrationProvenance,
  resolveAccountOrigin,
} from "../lib/account-provenance.mjs";

test("account origin is derived from server environment, not client input", () => {
  assert.equal(resolveAccountOrigin({ APP_ENV: "staging" }), "staging");
  assert.equal(resolveAccountOrigin({ APP_ENV: "production" }), "production");
  assert.equal(resolveAccountOrigin({ NODE_ENV: "test" }), "test");
  assert.equal(resolveAccountOrigin({ NODE_ENV: "development" }), "local");
});

test("registration provenance uses one server timestamp", () => {
  const now = new Date("2026-09-11T12:00:00.000Z");
  assert.deepEqual(registrationProvenance({ APP_ENV: "staging" }, now), {
    accountOrigin: "staging",
    registeredAt: now,
  });
});
