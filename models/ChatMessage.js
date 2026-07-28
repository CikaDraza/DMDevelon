import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const ChatAttachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    type: { type: String, enum: ['image', 'pdf'], default: 'image' },
    name: { type: String, default: '' },
    // Membership in a project does not by itself grant access to every file
    // attached to it. Access is derived from access to the carrying message
    // and channel (a DM attachment is reachable only by the DM participants);
    // this field additionally narrows who may see it inside a shared channel.
    // Phase 2 replaces the public Cloudinary URL with a short-lived signed URL
    // for every attachment in the app at once.
    visibility: {
      type: String,
      enum: ['project_shared', 'client_only', 'internal_team'],
      default: 'project_shared',
    },
  },
  { _id: false }
);

// Denormalized quote of the message being replied to. Copied on write because
// the codebase has no ref/populate convention — rendering a thread must never
// need a second round trip.
const ReplyPreviewSchema = new mongoose.Schema(
  {
    messageId: { type: String, required: true },
    authorName: { type: String, default: '' },
    body: { type: String, default: '' },
  },
  { _id: false }
);

// Record of a formal artifact created out of this message ("Convert to…").
// The link is what keeps a decision traceable back to the conversation it
// came from.
const ConvertedToSchema = new mongoose.Schema(
  {
    target: {
      type: String,
      enum: ['request', 'task', 'item', 'milestone_comment'],
      required: true,
    },
    targetId: { type: String, required: true },
    // For target 'item': idea | problem | incident | decision.
    kind: { type: String, default: '' },
    // Human-readable reference of the created record, e.g. "D-041".
    ref: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    byUserId: { type: String, default: null },
    byName: { type: String, default: '' },
  },
  { _id: false }
);

const ChatMessageSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => uuidv4() },
    channelId: { type: String, required: true },
    // Denormalized from the channel so permission checks and per-project
    // filtering never need to load the channel first.
    projectId: { type: String, default: null },
    authorUserId: { type: String, default: null },
    authorName: { type: String, default: '' },
    authorRole: {
      type: String,
      enum: ['admin', 'client', 'member'],
      required: true,
    },
    body: { type: String, default: '' },
    attachments: { type: [ChatAttachmentSchema], default: [] },
    // What kind of thing this message is about. Drives the badge, the header
    // filter, and which "Convert to…" targets are offered. Distinct from
    // ProjectMessage.messageType, which governs the milestone change flow.
    flag: {
      type: String,
      enum: [
        'none',
        'request',
        'task',
        'idea',
        'problem',
        'incident',
        'decision',
      ],
      default: 'none',
    },
    kind: { type: String, enum: ['user', 'system'], default: 'user' },
    replyToMessageId: { type: String, default: null },
    replyToPreview: { type: ReplyPreviewSchema, default: null },
    // User ids, already intersected with real channel membership on write.
    mentions: { type: [String], default: [] },
    pinned: { type: Boolean, default: false },
    pinnedAt: { type: Date, default: null },
    pinnedByUserId: { type: String, default: null },
    convertedTo: { type: [ConvertedToSchema], default: [] },
    editedAt: { type: Date, default: null },
    // Soft delete: a message already converted into a request or decision must
    // not vanish, because the formal record links back to it.
    deletedAt: { type: Date, default: null },
    deletedByUserId: { type: String, default: null },
  },
  { timestamps: true, _id: false }
);

// Backwards pagination (newest first, then `before` cursor).
ChatMessageSchema.index({ channelId: 1, createdAt: -1 });
ChatMessageSchema.index({ channelId: 1, pinned: 1 });
ChatMessageSchema.index({ projectId: 1, flag: 1 });
ChatMessageSchema.index({ channelId: 1, mentions: 1 });

export default mongoose.models.ChatMessage ||
  mongoose.model('ChatMessage', ChatMessageSchema);
