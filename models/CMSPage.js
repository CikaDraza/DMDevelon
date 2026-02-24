import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const CMSPageSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => uuidv4(),
    },
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    content: { type: String, required: true },
  },
  { timestamps: true, _id: false }
);

export default mongoose.models.CMSPage || mongoose.model('CMSPage', CMSPageSchema);
