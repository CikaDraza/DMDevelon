import test from "node:test";
import assert from "node:assert/strict";
import { matchPattern, matchRoute } from "../lib/route-match.mjs";

test("a literal pattern matches only its exact path", () => {
  assert.deepEqual(matchPattern("chat/channels", "chat/channels"), {});
  assert.equal(matchPattern("chat/channels", "chat/channel"), null);
});

test("params are extracted by name", () => {
  assert.deepEqual(
    matchPattern("chat/channels/:channelId/messages", "chat/channels/abc/messages"),
    { channelId: "abc" },
  );
});

test("multiple params are extracted in one pass", () => {
  assert.deepEqual(
    matchPattern(
      "client-projects/:projectId/invitations/:invitationId/resend",
      "client-projects/p-1/invitations/inv-9/resend",
    ),
    { projectId: "p-1", invitationId: "inv-9" },
  );
});

test("segment count must match exactly", () => {
  assert.equal(matchPattern("chat/channels/:id", "chat/channels"), null);
  assert.equal(matchPattern("chat/channels/:id", "chat/channels/a/b"), null);
});

test("leading and trailing slashes are irrelevant", () => {
  assert.deepEqual(matchPattern("/chat/channels/:id/", "chat/channels/x"), {
    id: "x",
  });
  assert.deepEqual(matchPattern("chat/channels/:id", "/chat/channels/x/"), {
    id: "x",
  });
});

test("params are URL-decoded", () => {
  assert.deepEqual(matchPattern("chat/dm/:userId", "chat/dm/a%40b.com"), {
    userId: "a@b.com",
  });
});

test("a param never matches an empty segment", () => {
  // "chat/channels//messages" collapses rather than yielding an empty id that
  // would be handed straight to a database lookup.
  assert.equal(
    matchPattern("chat/channels/:id/messages", "chat/channels//messages"),
    null,
  );
});

// --- Table dispatch ---------------------------------------------------------

const table = [
  { method: "GET", pattern: "chat/channels", handler: "list" },
  { method: "POST", pattern: "chat/channels/:id/read", handler: "read" },
  { method: "POST", pattern: "chat/channels/:id/messages", handler: "send" },
  { method: "GET", pattern: "chat/channels/:id", handler: "detail" },
];

test("dispatch returns the handler and its params", () => {
  const hit = matchRoute("POST", "chat/channels/c-1/messages", table);
  assert.equal(hit.route.handler, "send");
  assert.deepEqual(hit.params, { id: "c-1" });
});

test("the method is part of the match", () => {
  assert.equal(matchRoute("GET", "chat/channels/c-1/messages", table), null);
  assert.equal(matchRoute("post", "chat/channels/c-1/read", table).route.handler, "read");
});

test("the first matching entry wins, so order is the caller's contract", () => {
  const ambiguous = [
    { method: "GET", pattern: "chat/channels/:id", handler: "detail" },
    { method: "GET", pattern: "chat/channels/pinned", handler: "pinned" },
  ];
  assert.equal(matchRoute("GET", "chat/channels/pinned", ambiguous).route.handler, "detail");
});

test("an unmatched path returns null rather than throwing", () => {
  assert.equal(matchRoute("GET", "unknown/path", table), null);
  assert.equal(matchRoute("GET", "chat/channels", null), null);
  assert.equal(matchRoute("GET", "", table), null);
});
