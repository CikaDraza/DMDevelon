import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

// Formal record produced out of a chat message. Chat is the communication
// layer; this is where an agreement stops being a message and becomes
// evidence — "Decision D-041" with the people who confirmed it, the date, and
// a link back to the original conversation.
//
// Requests, tasks and milestone comments already have homes (ProjectRequest,
// ClientProject.milestones[].tasks, ProjectMessage); this model covers the
// four kinds that had none.
const ConfirmationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    name: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ProjectItemSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => uuidv4() },
    projectId: { type: String, required: true },
    kind: {
      type: String,
      enum: ['idea', 'problem', 'incident', 'decision'],
      required: true,
    },
    // Human-readable sequence per (projectId, kind): D-041, I-007, P-002, ID-013.
    ref: { type: String, required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, default: '', maxlength: 10000 },
    status: {
      type: String,
      enum: [
        'open',
        'in_review',
        'accepted',
        'rejected',
        'resolved',
        'closed',
      ],
      default: 'open',
      required: true,
    },
    // Meaningful for incident/problem; left at 'low' elsewhere.
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low',
    },
    sourceChannelId: { type: String, default: null },
    sourceMessageId: { type: String, default: null },
    // Set when this item was handed off as a task straight into an existing,
    // already-agreed milestone (no client approval needed).
    milestoneId: { type: String, default: null },
    // Set when this item was handed off as NEW billable work instead: the
    // draft phase proposal it produced. Distinct from milestoneId because
    // that work does not exist as a milestone until the client accepts.
    handoffProposalId: { type: String, default: null },
    confirmedBy: { type: [ConfirmationSchema], default: [] },
    createdByUserId: { type: String, default: null },
    createdByName: { type: String, default: '' },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: true, _id: false }
);

ProjectItemSchema.index({ projectId: 1, kind: 1, status: 1 });
ProjectItemSchema.index({ sourceMessageId: 1 });
ProjectItemSchema.index({ projectId: 1, kind: 1, ref: 1 }, { unique: true });

export default mongoose.models.ProjectItem ||
  mongoose.model('ProjectItem', ProjectItemSchema);
