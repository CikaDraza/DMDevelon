const ACCOUNT_ORIGINS = new Set(["local", "test", "staging", "production"]);

export function resolveAccountOrigin(env = process.env) {
  const explicit = String(env.APP_ENV || "").trim().toLowerCase();
  if (ACCOUNT_ORIGINS.has(explicit)) return explicit;
  if (env.NODE_ENV === "test") return "test";
  if (env.VERCEL_ENV === "production" || env.NODE_ENV === "production") {
    return "production";
  }
  return "local";
}

export function registrationProvenance(env = process.env, now = new Date()) {
  return {
    accountOrigin: resolveAccountOrigin(env),
    registeredAt: now,
  };
}
