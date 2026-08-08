import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  callApi,
  connectTestDb,
  disconnectTestDb,
  resetDb,
} from "./harness.mjs";

describe("harness", () => {
  beforeAll(async () => {
    await connectTestDb();
    await resetDb();
  });
  afterAll(async () => {
    await disconnectTestDb();
  });

  it("reaches the real route handler", async () => {
    const res = await callApi("GET", "health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
