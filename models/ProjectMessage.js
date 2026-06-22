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
