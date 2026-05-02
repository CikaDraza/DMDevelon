import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const CompanyProfileSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => uuidv4(),
    },
    name: { type: String, required: true },
    description: { type: String, required: true },
    subheadline: { type: String, required: false },
    logo: { type: String, default: "" },
    heroImage: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    socialLinks: {
      facebook: { type: String, default: "" },
      twitter: { type: String, default: "" },
      linkedin: { type: String, default: "" },
      instagram: { type: String, default: "" },
      github: { type: String, default: "" },
      tiktok: { type: String, default: "" },
    },
    geo: {
      address: { type: String, default: "" },
      city: { type: String, default: "" },
      country: { type: String, default: "" },
      postalCode: { type: String, default: "" },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    seo: {
      title: { type: String, default: "" },
      description: { type: String, default: "" },
      keywords: { type: String, default: "" },
      noIndex: { type: Boolean, default: false },
      ogImage: { type: String, default: "" },
    },
  },
  { timestamps: true, _id: false },
);

export default mongoose.models.CompanyProfile ||
  mongoose.model("CompanyProfile", CompanyProfileSchema);
