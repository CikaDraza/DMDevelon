// Allowlist projections for chat channels and messages leaving the API.
//
// Same discipline as lib/project-serializers.mjs: pick fields explicitly
// rather than trust a document not to grow a field nobody meant to expose.
// Two chat-specific concerns live here that don't apply to a plain project:
//
//   - a soft-deleted message must still occupy its place in the thread (its
//     convertedTo / sourceMessageId links depend on it existing), but its
//     content is redacted for every viewer;
//   - an attachment's own `visibility` can be narrower than "can this role
//     read the channel at all" — canViewAttachment (lib/chat-domain.mjs) is
//     what actually enforces that, per attachment, not per message.

import { canViewAttachment, displayRoleLabel } from "./chat-domain.mjs";

function asPlainObject(value) {
  if (!value) return {};
  if (typeof value.toObject === "function") {
    return value.toObject({ depopulate: true, getters: false, virtuals: false });
  }
  return value;
}

/**
 * One chat message, projected for a specific viewer's role.
 *
 * A deleted message keeps its identity, author, flag, pin state and
 * convertedTo links — a formal record ("Decision D-041") must still be able
 * to point back at the message it came from — but its body and attachments
 * are redacted for everyone, and its attachments are additionally filtered by
 * `canViewAttachment` for a live message.
 */
export function serializeChatMessageForAccess(message, accessObj) {
  const plain = asPlainObject(message);
  const role = accessObj?.role ?? null;
  const deleted = !!plain.deletedAt;

  const attachments = deleted
    ? []
    : (plain.attachments || [])
        .filter((a) => canViewAttachment(role, a.visibility))
        .map((a) => ({
          url: a.url,
          type: a.type || "image",
          name: a.name || "",
        }));

  return {
    _id: plain._id,
    channelId: plain.channelId,
    projectId: plain.projectId ?? null,
    authorUserId: plain.authorUserId ?? null,
    authorName: plain.authorName || "",
    authorRole: plain.authorRole || "",
    body: deleted ? "" : plain.body || "",
    attachments,
    flag: plain.flag || "none",
    kind: plain.kind || "user",
    replyToMessageId: plain.replyToMessageId ?? null,
    replyToPreview: plain.replyToPreview || null,
    mentions: plain.mentions || [],
    pinned: !!plain.pinned,
    pinnedAt: plain.pinnedAt ?? null,
    convertedTo: plain.convertedTo || [],
    editedAt: plain.editedAt ?? null,
    deleted,
    createdAt: plain.createdAt ?? null,
    updatedAt: plain.updatedAt ?? null,
  };
}

/**
 * One entry in the channel list: the channel plus enough to render it without
 * a follow-up call — unread count and a preview of the last message.
 */
export function serializeChannelSummary(
  channel,
  { unreadCount = 0, lastMessage = null, accessObj = null } = {},
) {
  const plain = asPlainObject(channel);
  const out = {
    _id: plain._id,
    projectId: plain.projectId ?? null,
    kind: plain.kind,
    name: plain.name || "",
    systemKey: plain.systemKey ?? null,
    postingPolicy: plain.postingPolicy || "all",
    archivedAt: plain.archivedAt ?? null,
    unreadCount,
    // The caller's OWN resolved permissions for this channel's project — not
    // a coarse "admin dashboard vs client dashboard" guess. A `viewer` role
    // member reaches the client dashboard exactly like an `owner` or
    // `collaborator` does, so the UI cannot tell them apart without this.
    canPin: Boolean(accessObj?.permissions?.pin),
    canWrite: Boolean(accessObj?.permissions?.chatWrite),
    canConvertToItem: Boolean(accessObj?.permissions?.convertToItem),
    canConvertToFormal: Boolean(accessObj?.permissions?.convertToFormal),
    canApproveItems: Boolean(accessObj?.permissions?.itemsApprove),
    lastMessage: lastMessage
      ? serializeChatMessageForAccess(lastMessage, accessObj)
      : null,
  };
  // Present only for a dm — assigning `undefined` for a group/system channel
  // would still leave the key in place (`"memberUserIds" in out` stays true),
  // so it is only ever added, never set to a placeholder value.
  if (plain.kind === "dm") out.memberUserIds = plain.memberUserIds || [];
  return out;
}

/** Channel metadata plus its roster, for the single-channel detail view. */
export function serializeChannelDetail(channel, { members = [] } = {}) {
  const plain = asPlainObject(channel);
  return {
    _id: plain._id,
    projectId: plain.projectId ?? null,
    kind: plain.kind,
    name: plain.name || "",
    systemKey: plain.systemKey ?? null,
    postingPolicy: plain.postingPolicy || "all",
    archivedAt: plain.archivedAt ?? null,
    members,
  };
}

/** A member entry for the channel roster, business-labeled, never "admin". */
export function serializeChannelMember({ userId, name, role, roleLabel }) {
  return {
    userId,
    name: name || "",
    role: role || "",
    roleLabel: displayRoleLabel(role, roleLabel),
  };
}

/**
 * A project item (idea/problem/incident/decision) produced by "Convert to…".
 * Nothing here is role-sensitive the way project/chat data is — every role
 * that can read items at all sees the same shape — so this is a plain
 * allowlist, not a per-access projection like the message/channel serializers
 * above.
 */
export function serializeProjectItem(item) {
  const plain = asPlainObject(item);
  return {
    _id: plain._id,
    projectId: plain.projectId ?? null,
    kind: plain.kind,
    ref: plain.ref || "",
    title: plain.title || "",
    body: plain.body || "",
    status: plain.status || "open",
    severity: plain.severity || "low",
    sourceChannelId: plain.sourceChannelId ?? null,
    sourceMessageId: plain.sourceMessageId ?? null,
    milestoneId: plain.milestoneId ?? null,
    confirmedBy: (plain.confirmedBy || []).map((c) => ({
      userId: c.userId,
      name: c.name || "",
      at: c.at ?? null,
    })),
    createdByUserId: plain.createdByUserId ?? null,
    createdByName: plain.createdByName || "",
    decidedAt: plain.decidedAt ?? null,
    createdAt: plain.createdAt ?? null,
    updatedAt: plain.updatedAt ?? null,
  };
}
