import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

// Append-only trail for invitation and membership changes. Answers, months
// later: who invited this person, who changed their rights, when they gained
// access, who removed them, and whether they had access at a given moment.
// Admin-visible only.
const ProjectAuditLogSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => uuidv4() },
    projectId: { type: String, required: true },
    actorUserId: { type: String, default: null },
    actorName: { type: String, default: '' },
    targetUserId: { type: String, default: null },
    targetEmail: { type: String, default: '' },
    eventType: {
      type: String,
      enum: [
        'invitation.created',
        'invitation.resent',
        'invitation.revoked',
        'invitation.accepted',
        'member.added',
        'member.role_changed',
        'member.suspended',
        'member.removed',
        'member.left',
      ],
      required: true,
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, _id: false }
);

ProjectAuditLogSchema.index({ projectId: 1, createdAt: -1 });

export default mongoose.models.ProjectAuditLog ||
  mongoose.model('ProjectAuditLog', ProjectAuditLogSchema);
