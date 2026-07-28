import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

// Per-user read watermark for one channel. This is what produces the exact
// unread count in the channel list.
//
// Deliberately separate from Notification: that model drives the bell, web
// push and the batched email digest, and its rows are pruned/marked read on a
// different schedule. Conflating the two makes "unread in this channel" wrong.
const ChatReadSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => uuidv4() },
    channelId: { type: String, required: true },
    userId: { type: String, required: true },
    lastReadAt: { type: Date, default: Date.now },
    lastReadMessageId: { type: String, default: null },
    // "Clear this conversation for me": messages created at or before this
    // moment are hidden from THIS user only. Everyone else — and the project's
    // history for the operator — is untouched, which is why clearing is a
    // per-user watermark here rather than a delete on ChatMessage.
    clearedAt: { type: Date, default: null },
  },
  { timestamps: true, _id: false }
);

ChatReadSchema.index({ channelId: 1, userId: 1 }, { unique: true });
ChatReadSchema.index({ userId: 1 });

export default mongoose.models.ChatRead ||
  mongoose.model('ChatRead', ChatReadSchema);
