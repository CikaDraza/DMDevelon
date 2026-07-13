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
  },
  { timestamps: true, _id: false }
);

export default mongoose.models.User || mongoose.model('User', UserSchema);
