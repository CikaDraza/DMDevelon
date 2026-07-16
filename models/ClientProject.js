import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const TaskSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => uuidv4() },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    order: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed'],
      default: 'pending',
    },
    // Monotonic safety marker: returning a task to pending must never make
    // previously started work eligible for phase deletion.
    workStartedAt: { type: Date, default: null },
  },
  { _id: false }
);

// Deliberately bounded audit snapshots: only fields an admin may change through
// the agreed milestone-edit flow are copied into before/after history.
const AuditTaskSnapshotSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    order: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed'],
      default: 'pending',
    },
  },
  { _id: false }
);

const MilestoneAuditSnapshotSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    icon: { type: String, default: 'Circle' },
    order: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed'],
      default: 'pending',
    },
    githubBranch: { type: String, default: '' },
    tasks: { type: [AuditTaskSnapshotSchema], default: [] },
  },
  { _id: false }
);

const MilestoneChangeSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => uuidv4() },
    changedAt: { type: Date, default: Date.now },
    changedByUserId: { type: String, default: null },
    changedByName: { type: String, default: '' },
    changeSummary: { type: String, required: true },
    sourceMessageId: { type: String, default: null },
    before: { type: MilestoneAuditSnapshotSchema, required: true },
    after: { type: MilestoneAuditSnapshotSchema, required: true },
  },
  { _id: false }
);

const MilestoneSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => uuidv4() },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    icon: { type: String, default: 'Circle' },
    order: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed'],
      default: 'pending',
    },
    workStartedAt: { type: Date, default: null },
    githubBranch: { type: String, default: '' },
    proposalId: { type: String, default: null },
    phaseNumber: { type: Number, default: null, min: 1 },
    phaseLabel: { type: String, default: '' },
    revision: { type: Number, default: 0, min: 0 },
    changeHistory: { type: [MilestoneChangeSchema], default: [] },
    tasks: { type: [TaskSchema], default: [] },
  },
  { _id: false }
);

const ClientProjectSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => uuidv4() },
    clientUserId: { type: String, default: null },
    clientName: { type: String, default: '' },
    clientEmail: { type: String, default: '' },
    clientSlug: { type: String, default: '' }, // Cloudinary folder slug from clientName
    title: { type: String, required: true },
    description: { type: String, default: '' },
    requirements: { type: String, default: '' },
    status: {
      type: String,
      enum: ['planning', 'in_progress', 'completed', 'on_hold'],
      default: 'in_progress',
    },
    // Showcase fields (used when published to homepage)
    githubRepoUrl: { type: String, default: '' },
    livePreviewUrl: { type: String, default: '' },
    coverImageUrl: { type: String, default: '' },
    category: { type: String, default: '' },
    color: { type: String, default: 'blue' },
    publishToHomepage: { type: Boolean, default: false },
    linkedProjectId: { type: String, default: null },
    requestId: { type: String, default: null }, // back-link to originating ProjectRequest
    // Terminal guard for accepted follow-up phases removed from active work.
    // It prevents an idempotent/concurrent accept replay from re-materializing
    // milestones after the proposal snapshot has been archived.
    archivedProposalIds: { type: [String], default: [] },
    milestones: { type: [MilestoneSchema], default: [] },
    events: {
      type: [
        new mongoose.Schema(
          {
            _id: { type: String, default: () => uuidv4() },
            type: { type: String, default: 'event' },
            body: { type: String, default: '' },
            actorName: { type: String, default: '' },
            createdAt: { type: Date, default: Date.now },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true, _id: false, optimisticConcurrency: true }
);

ClientProjectSchema.index(
  { requestId: 1 },
  {
    unique: true,
    partialFilterExpression: { requestId: { $type: 'string' } },
  }
);
ClientProjectSchema.index({ 'milestones.proposalId': 1 });

export default mongoose.models.ClientProject ||
  mongoose.model('ClientProject', ClientProjectSchema);
