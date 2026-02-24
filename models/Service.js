import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const ServiceSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => uuidv4(),
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    image: { type: String, default: '' },
    color: { type: String, default: '#3B82F6' },
    icon: { type: String, default: 'Code' },
    category: { type: String, required: true },
    displayOrder: { type: Number, default: 0 },
    gridSpan: { type: Number, default: 1, min: 1, max: 7 },
  },
  { timestamps: true, _id: false }
);

export default mongoose.models.Service || mongoose.model('Service', ServiceSchema);
