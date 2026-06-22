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
    githubBranch: { type: String, default: '' },
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
    milestones: { type: [MilestoneSchema], default: [] },
  },
  { timestamps: true, _id: false }
);

export default mongoose.models.ClientProject ||
  mongoose.model('ClientProject', ClientProjectSchema);
