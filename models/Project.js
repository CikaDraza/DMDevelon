import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const ProjectSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => uuidv4(),
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    image_url: { type: String, default: '' },
    logo_url: { type: String, default: '' },
    live_preview_url: { type: String, default: '' },
    github_url: { type: String, default: '' },
    color: { type: String, default: 'blue' },
    category: { type: String, required: true },
    slug: { type: String, unique: true },
  },
  { timestamps: true, _id: false }
);

ProjectSchema.pre('save', function (next) {
  if (!this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

export default mongoose.models.Project || mongoose.model('Project', ProjectSchema);
