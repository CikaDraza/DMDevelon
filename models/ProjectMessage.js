import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const AttachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    type: { type: String, enum: ['image', 'pdf'], default: 'image' },
    name: { type: String, default: '' },
  },
  { _id: false }
);

const ProjectMessageSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => uuidv4() },
    projectId: { type: String, required: true, index: true },
    milestoneId: { type: String, required: true, index: true },
    proposalId: { type: String, default: null, index: true },
    messageType: {
      type: String,
      enum: [
        'message',
        'question',
        'change_request',
        'system',
        'change_agreed',
      ],
      default: 'message',
    },
    authorUserId: { type: String, default: null },
    authorName: { type: String, default: '' },
    authorRole: { type: String, enum: ['admin', 'client'], required: true },
    body: { type: String, default: '' },
    attachments: { type: [AttachmentSchema], default: [] },
  },
  { timestamps: true, _id: false }
);

export default mongoose.models.ProjectMessage ||
  mongoose.model('ProjectMessage', ProjectMessageSchema);
