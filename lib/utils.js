import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

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
// Uses the server-side proxy endpoint so the fetch happens from the same
// domain — this avoids the CORS block that stops a browser fetch against
// a Cloudinary raw/PDF URL. The server streams it back with Content-Dispo-
// sition: attachment, so the browser saves it instead of navigating.
export async function downloadFileToDevice(url, name) {
  try {
    const proxyUrl = `/api/download?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name || "download")}`;
    // A plain <a> click is enough here: the proxy already sends the
    // Content-Disposition header telling the browser to save, so we don't
    // need fetch→blob→createObjectURL (that was the old CORS workaround).
    const a = document.createElement("a");
    a.href = proxyUrl;
    // Don't set `download` — letting the server's Content-Disposition take
    // precedence gives us the real filename Cloudinary stored.
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch {
    // Absolute last resort — won't work for PDFs from Cloudinary, but at
    // least the user sees *something*.
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

// Shorten a file name for display without losing its extension.
//
// A phone-camera upload ("IMG_20260819_143512_edited_final.jpg") ran the
// attachment dialog's title under the ⋯ and ✕ buttons and stretched the
// preview past the edge of a phone screen. Capping the string keeps every
// place a file name is shown a predictable width, whatever CSS wraps it. The
// extension is kept because it is the half that says what the file is.
export function shortenFileName(name, max = 20) {
  if (!name) return "";
  if (name.length <= max) return name;

  const dot = name.lastIndexOf(".");
  // Only treat it as an extension if it's short and not the whole name.
  const ext = dot > 0 && name.length - dot <= 6 ? name.slice(dot) : "";
  const stem = ext ? name.slice(0, dot) : name;
  const keep = max - ext.length - 1; // 1 char for the ellipsis

  if (keep < 1) return `${name.slice(0, max - 1)}…`;
  return `${stem.slice(0, keep)}…${ext}`;
}
