// The single attachment size ceiling, shared by every upload path: the
// browser-side guards in the chat composers and the /api/upload route itself.
//
// The hard constraint is the platform's, not ours. A Vercel serverless
// function rejects a request body over 4.5MB *before* any of our code runs,
// and what the browser gets back is Vercel's own HTML error page — which is
// why an oversized upload looked like the whole app crashing rather than a
// failed upload. Attachments travel as base64 data URIs, and base64 inflates
// a file by 4/3, so a 3MB photo already arrives as ~4.1MB of JSON and trips
// that limit. 2MB keeps the encoded payload around 2.7MB, comfortably inside
// it with room for the rest of the JSON body.
//
// Raising this means moving uploads off data URIs (direct-to-Cloudinary
// signed uploads) — the 4.5MB wall cannot be configured away.
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = "2MB";

// Sizes people can compare against what their file manager shows them.
export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// Decoded byte length of a base64 data URI, computed from the string length
// so the server never has to allocate a Buffer just to find out a payload is
// too big. Returns 0 for anything that isn't a base64 data URI.
export function dataUriByteLength(dataUri) {
  if (typeof dataUri !== "string") return 0;
  const comma = dataUri.indexOf(",");
  if (comma === -1 || !dataUri.slice(0, comma).includes(";base64")) return 0;
  const base64 = dataUri.slice(comma + 1);
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

// The user-facing rejection message, in one place so the browser guard and
// the server's 413 say the same thing. `null` means the size is fine.
export function uploadSizeError(bytes, name) {
  if (!Number.isFinite(bytes) || bytes <= MAX_UPLOAD_BYTES) return null;
  const subject = name ? `"${name}"` : "This file";
  return `${subject} is ${formatFileSize(bytes)} — the limit is ${MAX_UPLOAD_LABEL}. Please resize or compress it and try again.`;
}
