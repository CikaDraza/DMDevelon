import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

export const ProposalTaskPlanSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => uuidv4() },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    order: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

export const ProposalMilestonePlanSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => uuidv4() },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    icon: { type: String, default: "Circle" },
    githubBranch: { type: String, default: "" },
    order: { type: Number, default: 0, min: 0 },
    tasks: { type: [ProposalTaskPlanSchema], default: [] },
  },
  { _id: false },
);

export const ProposalRevisionSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["master", "phase"], required: true },
    phaseNumber: { type: Number, required: true, min: 1 },
    phaseLabel: { type: String, required: true },
    version: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: [
        "draft",
        "sent",
        "changes_requested",
        "accepted",
        "rejected",
        "archived",
      ],
      required: true,
    },
    title: { type: String, required: true },
    scope: { type: String, default: "" },
    timeline: { type: String, default: "" },
    budget: { type: String, default: "" },
    milestonePlan: { type: [ProposalMilestonePlanSchema], default: [] },
    sentAt: { type: Date, default: null },
    capturedAt: { type: Date, default: Date.now },
    capturedByUserId: { type: String, default: null },
  },
  { _id: false },
);

const ProjectProposalSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => uuidv4() },
    projectId: { type: String, required: true },
    requestId: { type: String, default: null },
    clientUserId: { type: String, default: null },
    kind: {
      type: String,
      enum: ["master", "phase"],
      required: true,
    },
    phaseNumber: { type: Number, required: true, min: 1 },
    phaseLabel: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    scope: { type: String, default: "" },
    timeline: { type: String, default: "" },
    budget: { type: String, default: "" },
    status: {
      type: String,
      enum: [
        "draft",
        "sent",
        "changes_requested",
        "accepted",
        "rejected",
        "archived",
      ],
      default: "draft",
      required: true,
    },
    version: { type: Number, default: 1, min: 1 },
    milestonePlan: { type: [ProposalMilestonePlanSchema], default: [] },
    revisionHistory: { type: [ProposalRevisionSchema], default: [] },
    createdByUserId: { type: String, default: null },
    sentAt: { type: Date, default: null },
    acceptedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
    archivedByUserId: { type: String, default: null },
    archivedByName: { type: String, default: "" },
    archiveRecipientUserId: { type: String, default: null },
    archiveReason: { type: String, default: "", maxlength: 5000 },
  },
  { timestamps: true, _id: false, optimisticConcurrency: true },
);

ProjectProposalSchema.index(
  { projectId: 1, phaseNumber: 1 },
  { unique: true },
);
ProjectProposalSchema.index({ projectId: 1, status: 1 });
ProjectProposalSchema.index(
  { projectId: 1, kind: 1 },
  {
    unique: true,
    partialFilterExpression: { kind: "master" },
  },
);
ProjectProposalSchema.index(
  { requestId: 1 },
  {
    unique: true,
    partialFilterExpression: { requestId: { $type: "string" } },
  },
);

export default mongoose.models.ProjectProposal ||
  mongoose.model("ProjectProposal", ProjectProposalSchema);
