import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { MAX_UPLOAD_LABEL } from "@/lib/upload-limits.mjs";

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

// Turn an axios failure into something worth showing a person.
//
// The reason this exists: `err.response.data.error` is right only when the
// response is our own JSON. When Vercel rejects a request at the platform
// edge — an upload body over its 4.5MB function limit is the one that bit us —
// the body is an HTML error page, `data.error` is undefined, and the caller
// either showed a bare "Upload failed" or dumped Vercel's markup on screen.
export function getApiErrorMessage(err, fallback = "Something went wrong") {
  const status = err?.response?.status;
  const data = err?.response?.data;

  if (typeof data?.error === "string" && data.error) return data.error;

  // 413 never carries a useful body — Vercel's own page is what arrives when
  // the request never reached our handler at all.
  if (status === 413) {
    return `That file is too large to upload (limit ${MAX_UPLOAD_LABEL}).`;
  }
  // Any other HTML body is a platform/proxy error page; its markup is noise.
  if (typeof data === "string" && /^\s*<(?:!doctype|html)/i.test(data)) {
    return status ? `${fallback} (server error ${status})` : fallback;
  }
  if (typeof data === "string" && data.trim()) return data.trim();
  if (err?.message === "Network Error") {
    return "Network error — check your connection and try again.";
  }
  return fallback;
}
