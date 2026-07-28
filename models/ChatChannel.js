import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

// A conversation surface inside a project.
//
// Phase 1 creates exactly one `group` channel per project (lazily, on first
// open) plus `dm` channels on demand. `systemKey` and `postingPolicy` exist
// from day one so the Phase 2 system channels (Announcements, Ideas,
// Development, Design & Content, Incidents, Milestone Activity) can be added
// without a migration.
const ChatChannelSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => uuidv4() },
    // null is reserved for future project-independent DMs.
    projectId: { type: String, default: null },
    kind: {
      type: String,
      enum: ['group', 'dm', 'system'],
      default: 'group',
      required: true,
    },
    name: { type: String, default: '' },
    systemKey: {
      type: String,
      enum: [
        'announcements',
        'ideas',
        'development',
        'design',
        'incidents',
        'milestone_activity',
      ],
      default: null,
    },
    // Only meaningful for `dm`. group/system membership is derived from
    // ProjectMember plus the project owner and admins.
    memberUserIds: { type: [String], default: [] },
    // Canonical identity of a DM pair: sorted user ids joined by ':'.
    // An array field cannot express "one channel per pair" to an index, so
    // without this two concurrent get-or-create requests would each open their
    // own DM for the same two people. See dmKeyFor() in lib/chat-domain.mjs.
    dmKey: { type: String, default: null },
    postingPolicy: {
      type: String,
      enum: ['all', 'admin_only'],
      default: 'all',
      required: true,
    },
    archivedAt: { type: Date, default: null },
    createdByUserId: { type: String, default: null },
  },
  { timestamps: true, _id: false }
);

ChatChannelSchema.index({ projectId: 1, kind: 1 });
ChatChannelSchema.index({ kind: 1, memberUserIds: 1 });
// Exactly one group channel per project, even if two requests race to create
// it lazily on first open. Keyed on projectId alone: an index sharing the
// {projectId, kind} pattern above with different options would be rejected as
// an options conflict.
ChatChannelSchema.index(
  { projectId: 1 },
  {
    unique: true,
    partialFilterExpression: { kind: 'group' },
  }
);
// System channels stay unique per key within a project.
ChatChannelSchema.index(
  { projectId: 1, systemKey: 1 },
  {
    unique: true,
    partialFilterExpression: { systemKey: { $type: 'string' } },
  }
);
// One DM per pair of people per project. The unique constraint — not an
// application-level "find or create" — is what actually settles the race.
ChatChannelSchema.index(
  { projectId: 1, dmKey: 1 },
  {
    unique: true,
    partialFilterExpression: { dmKey: { $type: 'string' } },
  }
);

export default mongoose.models.ChatChannel ||
  mongoose.model('ChatChannel', ChatChannelSchema);
