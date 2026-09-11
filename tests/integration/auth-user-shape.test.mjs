import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as route from "@/app/api/[[...path]]/route.js";
import {
  callApi,
  connectTestDb,
  disconnectTestDb,
  resetDb,
} from "./harness.mjs";

const BASE = "http://localhost:3003/api";
const USER_KEYS = [
  "_id",
  "email",
  "emailNotifications",
  "emailVerified",
  "id",
  "image",
  "isAdmin",
  "name",
  "pushNotifications",
];

async function postWithCookies(apiPath, body, cookie = "") {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = cookie;
  const request = new NextRequest(`${BASE}/${apiPath}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const response = await route.POST(request, {
    params: Promise.resolve({ path: apiPath.split("/") }),
  });
  return {
    status: response.status,
    body: await response.json(),
    cookie: response.headers.get("set-cookie")?.split(";", 1)[0] || "",
  };
}

describe("auth user response contract", () => {
  beforeAll(async () => {
    await connectTestDb();
    await resetDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("keeps /auth/me identical to register, login and refresh user shapes", async () => {
    const credentials = {
      name: "Auth Shape User",
      email: "auth-shape@test.local",
      password: "correct-horse-battery-staple",
    };
    const registered = await callApi("POST", "auth/register", {
      body: credentials,
    });
    expect(registered.status).toBe(201);

    const loggedIn = await postWithCookies("auth/login", {
      email: credentials.email,
      password: credentials.password,
    });
    expect(loggedIn.status).toBe(200);
    expect(loggedIn.cookie).not.toBe("");

    const me = await callApi("GET", "auth/me", {
      token: loggedIn.body.token,
    });
    const refreshed = await postWithCookies("auth/refresh", {}, loggedIn.cookie);

    expect(me.status).toBe(200);
    expect(refreshed.status).toBe(200);
    for (const user of [
      registered.body.user,
      loggedIn.body.user,
      me.body,
      refreshed.body.user,
    ]) {
      expect(Object.keys(user).sort()).toEqual(USER_KEYS);
      expect(user.id).toBe(user._id);
    }
  });
});
