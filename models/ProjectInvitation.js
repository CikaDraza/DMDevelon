import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

// An invitation exists independently of a user account: at the moment it is
// sent the recipient may not be registered yet. Membership (ProjectMember) is
// created only once the invitation is accepted by a matching, authenticated
// identity — holding the link is never by itself proof of access.
const ProjectInvitationSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => uuidv4() },
    projectId: { type: String, required: true },
    // Literal normalization (trim + lowercase) only. Provider-specific
    // transforms (gmail dots, plus-addressing) are deliberately NOT applied:
    // ime+test@gmail.com and ime@gmail.com stay distinct identities.
    emailNormalized: { type: String, required: true },
    invitedByUserId: { type: String, default: null },
    invitedByName: { type: String, default: '' },
    intendedRole: {
      type: String,
      enum: ['collaborator', 'viewer', 'client_lead', 'project_admin'],
      default: 'collaborator',
      required: true,
    },
    // Free-text display label the inviter enters ("Designer", "Consultant").
    // Copied onto ProjectMember.roleLabel at accept time; never used for
    // authorization — intendedRole/role is.
    roleLabel: { type: String, default: '', maxlength: 80 },
    // sha256 of the raw token. The raw token is only ever put in the email —
    // a database dump must not hand out project access.
    tokenHash: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'expired', 'revoked'],
      default: 'pending',
      required: true,
    },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
    acceptedByUserId: { type: String, default: null },
    personalMessage: { type: String, default: '', maxlength: 2000 },
  },
  { timestamps: true, _id: false }
);

ProjectInvitationSchema.index({ tokenHash: 1 }, { unique: true });
// At most one live invitation per (project, email): a re-invite must resend or
// revoke the existing one rather than stack duplicates.
ProjectInvitationSchema.index(
  { projectId: 1, emailNormalized: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'pending' },
  }
);
ProjectInvitationSchema.index({ projectId: 1, status: 1 });

export default mongoose.models.ProjectInvitation ||
  mongoose.model('ProjectInvitation', ProjectInvitationSchema);
