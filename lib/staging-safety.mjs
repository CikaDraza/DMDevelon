const DEFAULT_STAGING_ORIGIN = "https://staging.dmdevelon.website";
const DEFAULT_PRODUCTION_ORIGINS = [
  "https://dmdevelon.website",
  "https://www.dmdevelon.website",
];
const DEFAULT_PRODUCTION_DB_NAMES = ["portfolio_db"];

function csv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizedOrigin(value, label) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute http(s) URL`);
  }
  if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error(`${label} must be an absolute http(s) URL`);
  }
  return parsed.origin.toLowerCase();
}

function configuredAppOrigin(env) {
  const value = env.NEXT_PUBLIC_APP_URL || env.NEXT_PUBLIC_BASE_URL;
  if (!value) {
    throw new Error(
      "Staging requires NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_BASE_URL",
    );
  }
  return normalizedOrigin(value, "The staging application URL");
}

export function resolveApplicationOrigin(env = process.env) {
  const configured = env.NEXT_PUBLIC_APP_URL || env.NEXT_PUBLIC_BASE_URL;

  if (!isStagingEnvironment(env)) {
    if (configured) return normalizedOrigin(configured, "The application URL");
    return env.NODE_ENV === "production"
      ? DEFAULT_PRODUCTION_ORIGINS[0]
      : "http://localhost:3003";
  }

  const expectedOrigin = normalizedOrigin(
    env.STAGING_CANONICAL_ORIGIN || DEFAULT_STAGING_ORIGIN,
    "STAGING_CANONICAL_ORIGIN",
  );
  const appOrigin = configuredAppOrigin(env);
  const productionOrigins = new Set([
    ...DEFAULT_PRODUCTION_ORIGINS,
    ...csv(env.PRODUCTION_APP_ORIGINS).map((origin) =>
      normalizedOrigin(origin, "PRODUCTION_APP_ORIGINS"),
    ),
  ]);

  if (appOrigin !== expectedOrigin || productionOrigins.has(appOrigin)) {
    throw new Error("Staging application URL does not match its canonical origin");
  }

  return appOrigin;
}

export function isStagingEnvironment(env = process.env) {
  return String(env.APP_ENV || "").trim().toLowerCase() === "staging";
}

export function safeStagingRecipients(env = process.env) {
  return new Set(
    csv(env.STAGING_SAFE_RECIPIENTS).map((email) => email.toLowerCase()),
  );
}

// Optional guard for one-off bootstrap/manual operations that deliberately
// want a narrow recipient set. Normal staging application delivery must not
// call this: staging users exercise the isolated providers like production.
export function assertStagingBootstrapRecipient(recipient, env = process.env) {
  if (!isStagingEnvironment(env)) return;

  const allowed = safeStagingRecipients(env);
  const recipients = (Array.isArray(recipient) ? recipient : [recipient])
    .map((email) => String(email || "").trim().toLowerCase())
    .filter(Boolean);

  if (allowed.size === 0) {
    throw new Error("No optional staging bootstrap recipients are configured");
  }
  if (!recipients.length || recipients.some((email) => !allowed.has(email))) {
    throw new Error("Manual staging delivery blocked for a non-bootstrap recipient");
  }
}

export function isStagingCronEnabled(env = process.env) {
  return !isStagingEnvironment(env) || env.STAGING_CRON_ENABLED === "true";
}

export function validateStagingRuntimeConfig(env = process.env) {
  if (!isStagingEnvironment(env)) return { staging: false };

  if (!env.MONGO_URL) throw new Error("Staging requires MONGO_URL");
  if (!env.DB_NAME) throw new Error("Staging requires an explicit DB_NAME");

  const productionDbNames = new Set([
    ...DEFAULT_PRODUCTION_DB_NAMES,
    ...csv(env.PRODUCTION_DB_NAMES),
  ]);
  if (productionDbNames.has(env.DB_NAME)) {
    throw new Error("Staging configuration resolves a production database identity");
  }

  const appOrigin = resolveApplicationOrigin(env);

  const cloudinaryValues = [
    env.CLOUDINARY_NAME,
    env.CLOUDINARY_KEY,
    env.CLOUDINARY_SECRET,
  ];
  const cloudinaryConfigured = cloudinaryValues.some(Boolean);
  if (cloudinaryConfigured && !cloudinaryValues.every(Boolean)) {
    throw new Error("Staging Cloudinary configuration is incomplete");
  }
  if (cloudinaryConfigured) {
    if (!env.CLOUDINARY_FOLDER) {
      throw new Error("Staging Cloudinary requires an explicit folder");
    }
    const productionClouds = new Set(csv(env.PRODUCTION_CLOUDINARY_NAMES));
    if (productionClouds.size === 0) {
      throw new Error(
        "Staging Cloudinary requires known production identities to be denied",
      );
    }
    if (productionClouds.has(env.CLOUDINARY_NAME)) {
      throw new Error("Staging resolves a production Cloudinary identity");
    }
  }

  const pushValues = [
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  ];
  if (pushValues.some(Boolean) && !pushValues.every(Boolean)) {
    throw new Error("Staging VAPID configuration is incomplete");
  }
  if (
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY !== env.VAPID_PUBLIC_KEY
  ) {
    throw new Error("Public and server staging VAPID keys do not match");
  }

  if (env.STAGING_CRON_ENABLED === "true" && !env.CRON_SECRET) {
    throw new Error("Enabled staging cron requires CRON_SECRET");
  }

  return {
    staging: true,
    dbName: env.DB_NAME,
    appOrigin,
    cloudinaryEnabled: cloudinaryConfigured,
    emailEnabled: Boolean(env.RESEND_API_KEY),
    pushEnabled: pushValues.every(Boolean),
    cronEnabled: env.STAGING_CRON_ENABLED === "true",
  };
}
