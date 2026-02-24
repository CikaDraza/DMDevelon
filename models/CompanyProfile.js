import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const CompanyProfileSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => uuidv4(),
    },
    name: { type: String, required: true },
    description: { type: String, required: true },
    logo: { type: String, default: '' },
    heroImage: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    socialLinks: {
      facebook: { type: String, default: '' },
      twitter: { type: String, default: '' },
      linkedin: { type: String, default: '' },
      instagram: { type: String, default: '' },
      github: { type: String, default: '' },
    },
    seo: {
      title: { type: String, default: '' },
      description: { type: String, default: '' },
      keywords: { type: String, default: '' },
    },
  },
  { timestamps: true, _id: false }
);

export default mongoose.models.CompanyProfile || mongoose.model('CompanyProfile', CompanyProfileSchema);
