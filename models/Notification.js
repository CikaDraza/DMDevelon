import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const NotificationSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => uuidv4() },
    userId: { type: String, required: true, index: true }, // recipient
    type: { type: String, default: 'info' },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    link: { type: String, default: '' },
    entityType: { type: String, default: '' }, // 'request' | 'project'
    entityId: { type: String, default: '' },
    read: { type: Boolean, default: false },
  },
  { timestamps: true, _id: false }
);

NotificationSchema.index({ userId: 1, read: 1 });
NotificationSchema.index({ userId: 1, entityId: 1 });

export default mongoose.models.Notification ||
  mongoose.model('Notification', NotificationSchema);
