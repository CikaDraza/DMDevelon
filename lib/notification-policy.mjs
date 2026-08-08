// Which delivery channels a notification actually goes out on.
//
// No database imports: this is a total function over plain values so the
// "did we already spam this person" rules can be unit tested directly, the
// same discipline as lib/chat-domain.mjs.
//
// The problem it solves: every chat message previously produced an in-app
// notification AND a web push AND (eventually) an email, for every recipient.
// A short burst of conversation therefore turned into a burst of OS
// notifications and a digest row per message.

/**
 * Chatter. Valuable to see, rarely urgent enough to interrupt someone who is
 * already looking at the app — and the thing that actually causes spam,
 * because a conversation is many messages in a short window.
 */
export const CONVERSATIONAL_TYPES = Object.freeze(
  new Set(["chat_message", "project_message", "request_message"]),
);

/**
 * Everything else is treated as actionable: it names the recipient directly
 * (`chat_mention`), or it is a commercial step someone is blocked on (the
 * proposal lifecycle, a new request, an invitation). These are never
 * throttled and never suppressed by presence — a proposal waiting on the
 * client has to reach their inbox even while they happen to have a tab open.
 */
export function isConversationalType(type) {
  return CONVERSATIONAL_TYPES.has(type);
}

/** One hour, scoped per conversation (channel, else entity). */
export const NOTIFICATION_THROTTLE_MS = 60 * 60 * 1000;

function millisSince(value, now) {
  if (!value) return Infinity;
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return Infinity;
  return now.getTime() - then;
}

/**
 * Decide how one notification should be delivered.
 *
 * `lastEmailedAt` / `lastPushedAt` are the timestamps of the most recent
 * notification ALREADY delivered to this person for the same scope — the
 * caller looks those up; this function only decides.
 *
 * `recipientOnline` means "this ACCOUNT was active somewhere in the last
 * minute or so". `recipientViewingConversation` is the stronger claim: they
 * have read THIS conversation inside that same window, i.e. they are looking
 * at it right now.
 *
 * The distinction matters because presence is per account while push is per
 * device. Treating "online" as reason enough to skip push meant that having
 * the dashboard open on a laptop silenced the phone in your pocket — which is
 * precisely the device push exists for. Being at your desk now suppresses the
 * email (you can see the bell); only actually reading the conversation
 * suppresses the push.
 *
 * `inApp` is deliberately always true: the bell count and the in-app toast
 * must reflect every single message. Throttling only ever silences the
 * interruptive channels (email, push), never the record itself.
 */
export function resolveDeliveryChannels({
  type,
  recipientOnline = false,
  recipientViewingConversation = false,
  lastEmailedAt = null,
  lastPushedAt = null,
  now = new Date(),
  throttleMs = NOTIFICATION_THROTTLE_MS,
} = {}) {
  if (!isConversationalType(type)) {
    return { inApp: true, email: true, push: true };
  }

  // Reading the thread as it happens. Anything louder is noise.
  if (recipientViewingConversation) {
    return { inApp: true, email: false, push: false };
  }

  // Active somewhere, but not in this conversation: no email (the bell already
  // tells them), but the phone may still buzz — bounded by the throttle to at
  // most one push per conversation per window.
  return {
    inApp: true,
    email: recipientOnline
      ? false
      : millisSince(lastEmailedAt, now) >= throttleMs,
    push: millisSince(lastPushedAt, now) >= throttleMs,
  };
}

/**
 * The bucket a throttle applies to. A DM, a project's group channel and a
 * milestone thread each throttle independently — one busy conversation must
 * not silence a different one.
 */
export function notificationScopeKey({ channelId, entityId } = {}) {
  return channelId || entityId || "";
}
