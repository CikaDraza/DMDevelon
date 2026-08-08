import test from "node:test";
import assert from "node:assert/strict";
import {
  CONVERSATIONAL_TYPES,
  NOTIFICATION_THROTTLE_MS,
  isConversationalType,
  notificationScopeKey,
  resolveDeliveryChannels,
} from "../lib/notification-policy.mjs";

const NOW = new Date("2026-01-01T12:00:00.000Z");
const minutesAgo = (n) => new Date(NOW.getTime() - n * 60 * 1000);

test("in-app delivery is never suppressed, whatever the circumstances", () => {
  const cases = [
    { type: "chat_message", recipientOnline: true },
    {
      type: "chat_message",
      lastEmailedAt: minutesAgo(1),
      lastPushedAt: minutesAgo(1),
    },
    { type: "project_proposal_sent", recipientOnline: true },
  ];
  for (const input of cases) {
    assert.equal(
      resolveDeliveryChannels({ ...input, now: NOW }).inApp,
      true,
      `inApp must stay true for ${JSON.stringify(input)}`,
    );
  }
});

test("reading the conversation right now silences both loud channels", () => {
  const out = resolveDeliveryChannels({
    type: "chat_message",
    recipientOnline: true,
    recipientViewingConversation: true,
    now: NOW,
  });
  assert.deepEqual(out, { inApp: true, email: false, push: false });
});

test("being online elsewhere silences the email but NOT the phone", () => {
  // Presence is per account; push is per device. Treating "the dashboard is
  // open on a laptop" as reason to skip push silenced the phone in the user's
  // pocket — the one device push exists for. The bell covers the laptop, so
  // the email is redundant; the push is not.
  const out = resolveDeliveryChannels({
    type: "chat_message",
    recipientOnline: true,
    recipientViewingConversation: false,
    now: NOW,
  });
  assert.deepEqual(out, { inApp: true, email: false, push: true });
});

test("a push to an online recipient is still bounded by the throttle", () => {
  const out = resolveDeliveryChannels({
    type: "chat_message",
    recipientOnline: true,
    recipientViewingConversation: false,
    lastPushedAt: minutesAgo(5),
    now: NOW,
  });
  assert.equal(out.push, false, "one push per conversation per window");
});

test("an offline recipient with no prior delivery gets everything", () => {
  const out = resolveDeliveryChannels({
    type: "chat_message",
    recipientOnline: false,
    now: NOW,
  });
  assert.deepEqual(out, { inApp: true, email: true, push: true });
});

test("a second conversational notification inside the window is throttled", () => {
  const out = resolveDeliveryChannels({
    type: "chat_message",
    lastEmailedAt: minutesAgo(5),
    lastPushedAt: minutesAgo(5),
    now: NOW,
  });
  assert.equal(out.email, false);
  assert.equal(out.push, false);
});

test("past the window it opens back up", () => {
  const out = resolveDeliveryChannels({
    type: "chat_message",
    lastEmailedAt: minutesAgo(61),
    lastPushedAt: minutesAgo(61),
    now: NOW,
  });
  assert.equal(out.email, true);
  assert.equal(out.push, true);
});

test("email and push throttle independently of each other", () => {
  const out = resolveDeliveryChannels({
    type: "chat_message",
    lastEmailedAt: minutesAgo(5), // still inside the window
    lastPushedAt: minutesAgo(90), // outside it
    now: NOW,
  });
  assert.equal(out.email, false);
  assert.equal(out.push, true);
});

test("actionable types are never throttled and never suppressed by presence", () => {
  for (const type of [
    "chat_mention",
    "project_proposal_sent",
    "project_proposal_accepted",
    "request_created",
  ]) {
    const out = resolveDeliveryChannels({
      type,
      recipientOnline: true,
      lastEmailedAt: minutesAgo(1),
      lastPushedAt: minutesAgo(1),
      now: NOW,
    });
    assert.deepEqual(
      out,
      { inApp: true, email: true, push: true },
      `${type} must always be delivered`,
    );
  }
});

test("the throttle boundary is inclusive — exactly one window later passes", () => {
  const out = resolveDeliveryChannels({
    type: "chat_message",
    lastEmailedAt: new Date(NOW.getTime() - NOTIFICATION_THROTTLE_MS),
    now: NOW,
  });
  assert.equal(out.email, true);
});

test("only the three message types are conversational", () => {
  assert.deepEqual(
    [...CONVERSATIONAL_TYPES].sort(),
    ["chat_message", "project_message", "request_message"],
  );
  assert.equal(isConversationalType("chat_mention"), false);
  assert.equal(isConversationalType(undefined), false);
});

test("scope prefers the channel so one busy chat cannot silence another thread", () => {
  assert.equal(
    notificationScopeKey({ channelId: "ch-1", entityId: "p-1" }),
    "ch-1",
  );
  assert.equal(notificationScopeKey({ entityId: "p-1" }), "p-1");
  assert.equal(notificationScopeKey({}), "");
  assert.equal(notificationScopeKey(), "");
});
