import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const UserSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => uuidv4(),
    },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    image: { type: String, default: '' },
    isAdmin: { type: Boolean, default: false },
    provider: { type: String, default: 'local' },
    emailVerified: { type: Boolean, default: false },
    emailNotifications: { type: Boolean, default: true },
    pushNotifications: { type: Boolean, default: true },
    verifyToken: { type: String },
    resetToken: { type: String },
    resetTokenExpiry: { type: Date },
    // Incrementing this invalidates all issued access/refresh token pairs.
    sessionVersion: { type: Number, default: 0 },
    // Touched by GET /chat/channels' 15s poll while the chat UI is open —
    // "online" is derived from this being recent, not a separate socket
    // connection. Good enough for a presence dot; not a general app-wide
    // "last seen" feature.
    lastActiveAt: { type: Date, default: null },
  },
  { timestamps: true, _id: false }
);

export default mongoose.models.User || mongoose.model('User', UserSchema);
