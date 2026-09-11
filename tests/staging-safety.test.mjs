import test from "node:test";
import assert from "node:assert/strict";
import {
  assertSafeStagingRecipient,
  isStagingCronEnabled,
  validateStagingRuntimeConfig,
} from "../lib/staging-safety.mjs";

const base = {
  APP_ENV: "staging",
  MONGO_URL: "mongodb+srv://user:secret@staging.example.invalid/",
  DB_NAME: "portfolio_staging",
  STAGING_DB_NAME: "portfolio_staging",
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

test("staging rejects an ambiguous or production database identity", () => {
  assert.throws(
    () => validateStagingRuntimeConfig({ ...base, STAGING_DB_NAME: "other" }),
    /expected staging database/,
  );
  assert.throws(
    () =>
      validateStagingRuntimeConfig({
        ...base,
        DB_NAME: "portfolio_db",
        STAGING_DB_NAME: "portfolio_db",
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

test("Cloudinary stays disabled or requires an explicit isolated identity", () => {
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
        STAGING_CLOUDINARY_NAME: "prod-cloud",
        PRODUCTION_CLOUDINARY_NAMES: "prod-cloud",
        CLOUDINARY_FOLDER: "staging/uploads",
      }),
    /production Cloudinary identity/,
  );
  assert.doesNotThrow(() =>
    validateStagingRuntimeConfig({
      ...base,
      CLOUDINARY_NAME: "staging-cloud",
      CLOUDINARY_KEY: "key",
      CLOUDINARY_SECRET: "secret",
      STAGING_CLOUDINARY_NAME: "staging-cloud",
      CLOUDINARY_FOLDER: "staging/portfolio",
    }),
  );
});

test("configured outbound providers require explicit safe recipients", () => {
  assert.throws(
    () => validateStagingRuntimeConfig({ ...base, RESEND_API_KEY: "re_test" }),
    /STAGING_SAFE_RECIPIENTS/,
  );
  assert.doesNotThrow(() =>
    validateStagingRuntimeConfig({
      ...base,
      RESEND_API_KEY: "re_test",
      STAGING_SAFE_RECIPIENTS: "pantelyasm@gmail.com",
    }),
  );
});

test("email and push delivery reject every recipient outside the allowlist", () => {
  const env = {
    ...base,
    STAGING_SAFE_RECIPIENTS: "pantelyasm@gmail.com, drazic.milan@gmail.com",
  };
  assert.doesNotThrow(() =>
    assertSafeStagingRecipient("PantelyaSM@gmail.com", env),
  );
  assert.throws(
    () => assertSafeStagingRecipient(["pantelyasm@gmail.com", "other@test.com"], env),
    /non-safe recipient/,
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
