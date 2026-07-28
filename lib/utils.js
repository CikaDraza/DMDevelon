import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Shared by every attachment upload flow (avatar, milestone chat, request
// thread, project chat): read a File as a base64 data URI for POST /api/upload.
export function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Save a remote file under its own name.
//
// Fetched as a blob rather than relying on <a download>: that attribute is
// ignored for cross-origin URLs, so against Cloudinary it would just navigate
// to the file instead of saving it. Falls back to opening the URL if the
// fetch is blocked, which is still better than doing nothing.
export async function downloadFileToDevice(url, name) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = name || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
