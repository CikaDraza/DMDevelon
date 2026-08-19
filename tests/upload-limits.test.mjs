import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  dataUriByteLength,
  formatFileSize,
  uploadSizeError,
} from "../lib/upload-limits.mjs";

test("the limit stays well inside the 4.5MB platform body cap once base64-encoded", () => {
  assert.equal(MAX_UPLOAD_BYTES, 2 * 1024 * 1024);
  assert.equal(MAX_UPLOAD_LABEL, "2MB");
  // base64 inflates by 4/3; this is the check that actually protects us.
  const encoded = Math.ceil(MAX_UPLOAD_BYTES / 3) * 4;
  assert.ok(
    encoded < 4.5 * 1024 * 1024,
    `encoded payload ${encoded} must stay under the 4.5MB function limit`,
  );
});

test("formatFileSize reports sizes the way a file manager does", () => {
  assert.equal(formatFileSize(512), "512B");
  assert.equal(formatFileSize(2048), "2KB");
  assert.equal(formatFileSize(3 * 1024 * 1024), "3.0MB");
  assert.equal(formatFileSize(-1), "");
  assert.equal(formatFileSize(undefined), "");
});

test("dataUriByteLength recovers the decoded size without decoding", () => {
  const bytes = Buffer.from("hello upload limits, this is some payload");
  const uri = `data:image/png;base64,${bytes.toString("base64")}`;
  assert.equal(dataUriByteLength(uri), bytes.length);

  // Padding cases: lengths that produce one and two '=' characters.
  for (const n of [1, 2, 3, 4, 5, 6, 100, 1001]) {
    const buf = Buffer.alloc(n, 7);
    const u = `data:application/pdf;base64,${buf.toString("base64")}`;
    assert.equal(dataUriByteLength(u), n, `size mismatch for ${n} bytes`);
  }
});

test("dataUriByteLength returns 0 for anything that is not a base64 data URI", () => {
  assert.equal(dataUriByteLength(""), 0);
  assert.equal(dataUriByteLength(null), 0);
  assert.equal(dataUriByteLength(undefined), 0);
  assert.equal(dataUriByteLength("https://res.cloudinary.com/x.png"), 0);
  assert.equal(dataUriByteLength("data:text/plain,hello"), 0);
});

test("uploadSizeError passes anything at or under the limit", () => {
  assert.equal(uploadSizeError(0, "empty.png"), null);
  assert.equal(uploadSizeError(MAX_UPLOAD_BYTES, "exact.png"), null);
  assert.equal(uploadSizeError(MAX_UPLOAD_BYTES - 1, "just-under.png"), null);
  assert.equal(uploadSizeError(NaN, "unknown.png"), null);
});

test("uploadSizeError names the file, its size, and the limit", () => {
  const msg = uploadSizeError(3 * 1024 * 1024, "photo.jpg");
  assert.ok(msg, "a 3MB file must be rejected");
  assert.match(msg, /photo\.jpg/);
  assert.match(msg, /3\.0MB/);
  assert.match(msg, /2MB/);
});

test("uploadSizeError still reads sensibly without a file name", () => {
  const msg = uploadSizeError(MAX_UPLOAD_BYTES + 1);
  assert.ok(msg);
  assert.match(msg, /^This file is/);
});
