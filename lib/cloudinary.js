// lib/cloudinary.js
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
  secure: true,
});

// Root folder. Project preview images live directly here (admin-only browsing).
export const ROOT_FOLDER = process.env.CLOUDINARY_FOLDER || "portfolio";

// --- Folder layout ----------------------------------------------------------
// portfolio/                         -> project preview images (existing)
// portfolio/admin/images             -> admin's image uploads (all clients)
// portfolio/admin/chat               -> admin's chat attachments (images + docs)
// portfolio/clients/<slug>/images    -> a client's image uploads
// portfolio/clients/<slug>/chat      -> a client's chat attachments (images + docs)

export function clientFolder(slug, kind = "chat") {
  const sub = kind === "images" ? "images" : "chat";
  return `${ROOT_FOLDER}/clients/${slug}/${sub}`;
}

export function adminFolder(kind = "chat") {
  const sub = kind === "images" ? "images" : "chat";
  return `${ROOT_FOLDER}/admin/${sub}`;
}

/**
 * Upload a data URI / base64 string to Cloudinary into a specific folder.
 * resource_type "auto" handles both images and raw files (PDF).
 */
export async function uploadToCloudinary(dataUri, options = {}) {
  const { folder = `${ROOT_FOLDER}/uploads`, ...rest } = options;
  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: "auto",
    ...rest,
  });
  return result.secure_url;
}

// Eagerly create the empty folder tree so it exists as soon as a project is
// created. Errors (already exists / permissions) are swallowed on purpose.
export async function ensureClientFolders(slug) {
  if (!slug) return;
  const base = `${ROOT_FOLDER}/clients/${slug}`;
  for (const p of [base, `${base}/images`, `${base}/chat`]) {
    try {
      await cloudinary.api.create_folder(p);
    } catch (_) {
      // ignore
    }
  }
}

export async function ensureAdminFolders() {
  const base = `${ROOT_FOLDER}/admin`;
  for (const p of [base, `${base}/images`, `${base}/chat`]) {
    try {
      await cloudinary.api.create_folder(p);
    } catch (_) {
      // ignore
    }
  }
}

export default cloudinary;
