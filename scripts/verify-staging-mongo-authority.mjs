import { MongoClient } from "mongodb";
import { validateStagingRuntimeConfig } from "../lib/staging-safety.mjs";

const WRITE_ACTIONS = new Set([
  "bypassDocumentValidation",
  "changeCustomData",
  "changePassword",
  "collMod",
  "compact",
  "convertToCapped",
  "createCollection",
  "createIndex",
  "createRole",
  "createUser",
  "dropCollection",
  "dropDatabase",
  "dropIndex",
  "dropRole",
  "dropUser",
  "grantRole",
  "insert",
  "remove",
  "renameCollectionSameDB",
  "reIndex",
  "revokeRole",
  "setAuthenticationRestriction",
  "update",
]);

const config = validateStagingRuntimeConfig(process.env);
if (!config.staging) {
  throw new Error("This audit only runs with APP_ENV=staging");
}

const productionDbNames = new Set(
  String(process.env.PRODUCTION_DB_NAMES || "portfolio_db")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean),
);

const client = new MongoClient(process.env.MONGO_URL, {
  serverSelectionTimeoutMS: 10_000,
});

try {
  await client.connect();
  const status = await client
    .db("admin")
    .command({ connectionStatus: 1, showPrivileges: true });
  const privileges = status?.authInfo?.authenticatedUserPrivileges || [];
  const dangerous = privileges.filter((privilege) => {
    const db = privilege?.resource?.db;
    const targetsProduction =
      db === "" || db === undefined || productionDbNames.has(db);
    return (
      targetsProduction &&
      (privilege.actions || []).some((action) => WRITE_ACTIONS.has(action))
    );
  });

  if (dangerous.length) {
    throw new Error(
      "Staging Mongo credentials expose write-capable production privileges",
    );
  }

  const authenticatedUsers = status?.authInfo?.authenticatedUsers || [];
  if (!authenticatedUsers.length) {
    throw new Error("Mongo authority audit could not identify an authenticated user");
  }

  console.log(
    JSON.stringify({
      ok: true,
      stagingDb: config.dbName,
      authenticatedUserCount: authenticatedUsers.length,
      checkedPrivilegeCount: privileges.length,
      productionWritePrivileges: 0,
    }),
  );
} finally {
  await client.close();
}
