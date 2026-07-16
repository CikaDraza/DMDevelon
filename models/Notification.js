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
    entityType: { type: String, default: '' }, // 'request' | 'project' | 'contact' | 'testimonial'
    entityId: { type: String, default: '' },
    milestoneId: { type: String, default: '' }, // set for per-milestone chat messages
    proposalId: { type: String, default: '' }, // set for a project proposal deep-link
    dedupeKey: { type: String, default: null },
    read: { type: Boolean, default: false },
    emailedAt: { type: Date, default: null }, // set once included in a digest email
  },
  { timestamps: true, _id: false }
);

NotificationSchema.index({ userId: 1, read: 1 });
NotificationSchema.index({ userId: 1, entityId: 1 });
NotificationSchema.index({ userId: 1, entityId: 1, proposalId: 1 });
NotificationSchema.index(
  { userId: 1, dedupeKey: 1 },
  {
    unique: true,
    partialFilterExpression: { dedupeKey: { $type: 'string' } },
  }
);
// Digest sweep: pull un-emailed, still-unread message notifications by type
NotificationSchema.index({ type: 1, emailedAt: 1, read: 1 });

export default mongoose.models.Notification ||
  mongoose.model('Notification', NotificationSchema);
