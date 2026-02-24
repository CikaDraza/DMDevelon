import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const TestimonialSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => uuidv4(),
    },
    clientName: { type: String, required: true },
    clientEmail: { type: String, required: true },
    clientTitle: { type: String, default: '' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
    adminReply: { type: String, default: '' },
    userId: { type: String, ref: 'User' },
  },
  { timestamps: true, _id: false }
);

export default mongoose.models.Testimonial || mongoose.model('Testimonial', TestimonialSchema);
