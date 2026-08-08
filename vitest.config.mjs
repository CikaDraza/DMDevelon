import { defineConfig } from "vitest/config";

// Root config whose only job is to hold the options a workspace project is
// NOT allowed to set for itself.
//
// `fileParallelism` is one of them: written inside a `defineWorkspace` project
// it is accepted without complaint and then ignored. The integration suite
// shares one throwaway database and wipes it between tests, so files running
// concurrently delete each other's fixtures — the symptom was ~150 phantom
// 401/404/E11000 failures that every passed when its file was run alone.
export default defineConfig({
  test: {
    workspace: "./vitest.workspace.mjs",
    fileParallelism: false,
  },
});
