import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

// Durable project membership. Created only when an invitation is accepted, so
// userId is always a real account.
//
// The project owner (ClientProject.clientUserId / clientEmail) and global
// admins deliberately have NO row here — canAccessClientEntity in
// lib/project-proposal-domain.mjs remains the authority for them. This model
// only describes invited collaborators, which is why the same person can own
// their own project and be a collaborator on someone else's.
const ProjectMemberSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => uuidv4() },
    projectId: { type: String, required: true },
    userId: { type: String, required: true },
    // Identity denormalized at accept time.
    //
    // Accounts are hard-deleted (User.findByIdAndDelete), and a finished
    // project has to remain readable history for the operator — and for the
    // other participants — long after some of the people in it have closed
    // their accounts. Without these two fields the member list would render
    // blank rows for anyone who left, and the audit trail would point at an id
    // nobody can resolve.
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    role: {
      type: String,
      enum: ['collaborator', 'viewer', 'client_lead', 'project_admin'],
      default: 'collaborator',
      required: true,
    },
    // Removal is soft: the row survives so the audit trail can still answer
    // "did this person have access at the time?".
    status: {
      type: String,
      enum: ['active', 'suspended', 'removed'],
      default: 'active',
      required: true,
    },
    // Free-text display label the member states about themselves ("Designer",
    // "Consultant", "CTO"). Never used for authorization — role is.
    roleLabel: { type: String, default: '', maxlength: 80 },
    invitedByUserId: { type: String, default: null },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, _id: false }
);

// Makes accepting an invitation idempotent: a double click cannot produce a
// second membership row.
ProjectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });
ProjectMemberSchema.index({ userId: 1, status: 1 });

export default mongoose.models.ProjectMember ||
  mongoose.model('ProjectMember', ProjectMemberSchema);
