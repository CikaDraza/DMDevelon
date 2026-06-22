// Folder/URL-safe slug. Handles Serbian-latin diacritics so client names like
// "Uros Mirkovic" -> "uros-mirkovic" and "Proxify IT Services" -> "proxify-it-services".
const CHAR_MAP = {
  "č": "c", // č
  "ć": "c", // ć
  "š": "s", // š
  "ž": "z", // ž
  "đ": "dj", // đ
  "Č": "c", // Č
  "Ć": "c", // Ć
  "Š": "s", // Š
  "Ž": "z", // Ž
  "Đ": "dj", // Đ
};

export function slugify(input = "") {
  return String(input)
    .split("")
    .map((ch) => CHAR_MAP[ch] ?? ch)
    .join("")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip remaining accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default slugify;
