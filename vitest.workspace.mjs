import { defineWorkspace } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

const root = path.resolve(process.cwd());

// `@/...` is the jsconfig path alias the app uses everywhere. A bare "@"
// string alias would also swallow "@testing-library/react", so match the
// slash explicitly.
const alias = [{ find: /^@\//, replacement: `${root}/` }];

export default defineWorkspace([
  // --- Chat API integration -------------------------------------------------
  // Imports the real route handlers and talks to a throwaway MongoDB replica
  // set (see tests/integration/README.md). Never points at a real database:
  // the connection string is pinned here, not read from .env.local.
  {
    resolve: { alias },
    test: {
      name: "chat-api",
      environment: "node",
      include: ["tests/integration/**/*.test.mjs"],
      setupFiles: ["tests/integration/setup.mjs"],
      // One file at a time: every file shares the same database and wipes it
      // between tests, so parallel files would clobber each other.
      //
      // `fileParallelism` is a ROOT-only option — set inside a workspace
      // project it is silently ignored, which is exactly what happened here:
      // every file still ran concurrently and `resetDb()` in one file deleted
      // the users another file had just seeded (143 phantom 401/404 failures
      // that all passed when the file was run alone). Capping the fork pool at
      // one worker is the project-level equivalent and IS honoured. Each file
      // still gets its own fresh fork, which matters because `afterAll` here
      // disconnects mongoose while `lib/mongodb.js` keeps a module-level
      // connection cache — sharing one process would hand file N+1 a cached,
      // already-closed connection.
      poolOptions: { forks: { minForks: 1, maxForks: 1 } },
      testTimeout: 30_000,
      hookTimeout: 60_000,
      env: {
        MONGO_URL:
          process.env.TEST_MONGO_URL ||
          "mongodb://127.0.0.1:27077/?replicaSet=rs0",
        DB_NAME: "dmdevelon_chat_test",
        JWT_SECRET: "test-jwt-secret",
        NEXT_PUBLIC_APP_URL: "http://localhost:3003",
        RESEND_API_KEY: "re_test_key",
        // The digest endpoint is bearer-gated; without a secret it is 401 for
        // everyone, including a test that wants to exercise the sweep.
        CRON_SECRET: "test-cron-secret",
        NODE_ENV: "test",
      },
    },
  },

  // --- Chat UI components ---------------------------------------------------
  {
    plugins: [react()],
    resolve: { alias },
    // The app has no `jsx` compiler option anywhere (Next handles it), so
    // esbuild falls back to the classic runtime and every render throws
    // "React is not defined". Say automatic explicitly rather than adding a
    // React import to files that never needed one.
    esbuild: { jsx: "automatic" },
    test: {
      name: "chat-ui",
      environment: "jsdom",
      include: ["tests/ui/**/*.test.jsx"],
      setupFiles: ["tests/ui/setup.js"],
      globals: true,
    },
  },
]);
