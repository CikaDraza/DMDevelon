import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const ContactMessageSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => uuidv4(),
    },
    name: { type: String, required: true },
    email: { type: String, required: true },
    message: { type: String, required: true },
    replied: { type: Boolean, default: false },
    replyMessage: { type: String, default: '' },
  },
  { timestamps: true, _id: false }
);

export default mongoose.models.ContactMessage || mongoose.model('ContactMessage', ContactMessageSchema);
