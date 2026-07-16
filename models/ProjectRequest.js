import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import {
  ProposalMilestonePlanSchema,
  ProposalRevisionSchema,
} from './ProjectProposal.js';

const AttachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    type: { type: String, enum: ['image', 'pdf'], default: 'image' },
    name: { type: String, default: '' },
  },
  { _id: false }
);

const RequestMessageSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => uuidv4() },
    authorUserId: { type: String, default: null },
    authorName: { type: String, default: '' },
    authorRole: { type: String, enum: ['admin', 'client'], default: 'client' },
    type: { type: String, enum: ['message', 'system'], default: 'message' },
    body: { type: String, default: '' },
    attachments: { type: [AttachmentSchema], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ProposalSchema = new mongoose.Schema(
  {
    title: { type: String, default: '' },
    scope: { type: String, default: '' },
    timeline: { type: String, default: '' },
    budget: { type: String, default: '' },
    kind: { type: String, enum: ['master'], default: 'master' },
    phaseNumber: { type: Number, default: 1, min: 1 },
    phaseLabel: { type: String, default: 'Master Proposal' },
    status: {
      type: String,
      enum: [
        'draft',
        'sent',
        'changes_requested',
        'accepted',
        'rejected',
        'archived',
      ],
      default: 'draft',
    },
    version: { type: Number, default: 0 },
    milestonePlan: { type: [ProposalMilestonePlanSchema], default: [] },
    revisionHistory: { type: [ProposalRevisionSchema], default: [] },
    createdByUserId: { type: String, default: null },
    sentAt: { type: Date, default: null },
    acceptedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
  },
  { _id: false }
);

const ProjectRequestSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => uuidv4() },
    clientUserId: { type: String, default: null },
    clientName: { type: String, default: '' },
    clientEmail: { type: String, default: '' },
    clientSlug: { type: String, default: '' },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    status: {
      type: String,
      enum: ['new', 'discussion', 'proposal_sent', 'approved', 'closed'],
      default: 'new',
    },
    messages: { type: [RequestMessageSchema], default: [] },
    proposal: { type: ProposalSchema, default: () => ({}) },
    linkedClientProjectId: { type: String, default: null },
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true, _id: false }
);

export default mongoose.models.ProjectRequest ||
  mongoose.model('ProjectRequest', ProjectRequestSchema);
