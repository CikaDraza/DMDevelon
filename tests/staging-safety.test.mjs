import test from "node:test";
import assert from "node:assert/strict";
import {
  assertStagingBootstrapRecipient,
  isStagingCronEnabled,
  resolveApplicationOrigin,
  validateStagingRuntimeConfig,
} from "../lib/staging-safety.mjs";

const base = {
  APP_ENV: "staging",
  MONGO_URL: "mongodb+srv://user:secret@staging.example.invalid/",
  DB_NAME: "portfolio_staging",
  NEXT_PUBLIC_APP_URL: "https://staging.dmdevelon.website",
};

test("non-staging environments are not constrained by staging policy", () => {
  assert.deepEqual(validateStagingRuntimeConfig({ APP_ENV: "production" }), {
    staging: false,
  });
});

test("a minimal provider-disabled staging configuration is valid", () => {
  assert.deepEqual(validateStagingRuntimeConfig(base), {
    staging: true,
    dbName: "portfolio_staging",
    appOrigin: "https://staging.dmdevelon.website",
    cloudinaryEnabled: false,
    emailEnabled: false,
    pushEnabled: false,
    cronEnabled: false,
  });
});

test("staging requires DB_NAME and rejects a production database identity", () => {
  assert.throws(
    () => validateStagingRuntimeConfig({ ...base, DB_NAME: "" }),
    /explicit DB_NAME/,
  );
  assert.throws(
    () =>
      validateStagingRuntimeConfig({
        ...base,
        DB_NAME: "portfolio_db",
      }),
    /production database identity/,
  );
});

test("staging rejects a production or mismatched application origin", () => {
  for (const origin of [
    "https://dmdevelon.website",
    "https://unrelated.example.com",
  ]) {
    assert.throws(
      () => validateStagingRuntimeConfig({ ...base, NEXT_PUBLIC_APP_URL: origin }),
      /canonical origin/,
    );
  }
});

test("Cloudinary stays disabled or denies every known production identity", () => {
  assert.throws(
    () => validateStagingRuntimeConfig({ ...base, CLOUDINARY_NAME: "partial" }),
    /incomplete/,
  );
  assert.throws(
    () =>
      validateStagingRuntimeConfig({
        ...base,
        CLOUDINARY_NAME: "prod-cloud",
        CLOUDINARY_KEY: "key",
        CLOUDINARY_SECRET: "secret",
        PRODUCTION_CLOUDINARY_NAMES: "prod-cloud",
        CLOUDINARY_FOLDER: "portfolio-staging",
      }),
    /production Cloudinary identity/,
  );
  assert.doesNotThrow(() =>
    validateStagingRuntimeConfig({
      ...base,
      CLOUDINARY_NAME: "staging-cloud",
      CLOUDINARY_KEY: "key",
      CLOUDINARY_SECRET: "secret",
      PRODUCTION_CLOUDINARY_NAMES: "prod-cloud",
      CLOUDINARY_FOLDER: "portfolio-staging",
    }),
  );
  assert.throws(
    () =>
      validateStagingRuntimeConfig({
        ...base,
        CLOUDINARY_NAME: "staging-cloud",
        CLOUDINARY_KEY: "key",
        CLOUDINARY_SECRET: "secret",
        CLOUDINARY_FOLDER: "portfolio-staging",
      }),
    /production identities/,
  );
});

test("staging account and project email links always use the canonical origin", () => {
  const origin = resolveApplicationOrigin(base);
  for (const path of [
    "/verify-email?token=verify-token",
    "/reset-password?token=reset-token",
    "/invite?token=invite-token",
    "/dashboard/projects",
  ]) {
    const link = new URL(path, `${origin}/`);
    assert.equal(link.origin, "https://staging.dmdevelon.website");
    assert.notEqual(link.origin, "https://dmdevelon.website");
  }
});

test("staging URL resolution fails closed instead of falling back to production", () => {
  assert.throws(
    () =>
      resolveApplicationOrigin({
        ...base,
        NEXT_PUBLIC_APP_URL: "https://dmdevelon.website",
      }),
    /canonical origin/,
  );
  assert.throws(
    () => resolveApplicationOrigin({ ...base, NEXT_PUBLIC_APP_URL: "" }),
    /requires NEXT_PUBLIC_APP_URL/,
  );
});

test("isolated staging providers do not require a recipient allowlist", () => {
  assert.doesNotThrow(() =>
    validateStagingRuntimeConfig({
      ...base,
      RESEND_API_KEY: "re_test",
    }),
  );
});

test("staging VAPID configuration is complete and uses one public key", () => {
  assert.throws(
    () =>
      validateStagingRuntimeConfig({
        ...base,
        VAPID_PUBLIC_KEY: "public-key",
      }),
    /VAPID configuration is incomplete/,
  );
  assert.throws(
    () =>
      validateStagingRuntimeConfig({
        ...base,
        VAPID_PUBLIC_KEY: "server-public-key",
        VAPID_PRIVATE_KEY: "private-key",
        NEXT_PUBLIC_VAPID_PUBLIC_KEY: "different-public-key",
      }),
    /VAPID keys do not match/,
  );
  assert.doesNotThrow(() =>
    validateStagingRuntimeConfig({
      ...base,
      VAPID_PUBLIC_KEY: "public-key",
      VAPID_PRIVATE_KEY: "private-key",
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: "public-key",
    }),
  );
});

test("the recipient list remains an explicit manual/bootstrap override", () => {
  const env = {
    ...base,
    STAGING_SAFE_RECIPIENTS: "pantelyasm@gmail.com, drazic.milan@gmail.com",
  };
  assert.doesNotThrow(() =>
    assertStagingBootstrapRecipient("PantelyaSM@gmail.com", env),
  );
  assert.throws(
    () =>
      assertStagingBootstrapRecipient(
        ["pantelyasm@gmail.com", "other@test.com"],
        env,
      ),
    /non-bootstrap recipient/,
  );
  assert.throws(
    () => assertStagingBootstrapRecipient("anyone@example.com", base),
    /No optional staging bootstrap recipients/,
  );
});

test("staging cron is disabled unless explicitly enabled", () => {
  assert.equal(isStagingCronEnabled(base), false);
  assert.equal(
    isStagingCronEnabled({ ...base, STAGING_CRON_ENABLED: "true" }),
    true,
  );
  assert.throws(
    () => validateStagingRuntimeConfig({ ...base, STAGING_CRON_ENABLED: "true" }),
    /CRON_SECRET/,
  );
});
