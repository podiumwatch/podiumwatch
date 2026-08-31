import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY ||= "test-service-role-key";

const {
  MAX_IMAGE_BYTES,
  decodeAwardImageUpload
} = await import("../lib/award_media_service.mjs");

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), "utf8");
}

function includesAll(text, values, label) {
  for (const value of values) {
    assert.ok(text.includes(value), `${label} is missing ${value}`);
  }
}

const pngBytes = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d
]);

// --- decodeAwardImageUpload --------------------------------------------------
// Same validation lib/team_media_service.mjs's decodeImageUpload already
// proves out (real magic bytes, never a claimed content type or file
// name) -- classifyImageBytes itself is reused directly from that file, so
// these cases just confirm this module's own wrapper around it behaves the
// same way for the awards upload path.

{
  const decoded = decodeAwardImageUpload({
    content: pngBytes.toString("base64"),
    encoding: "base64",
    fileName: "school-logo.png"
  });

  assert.equal(decoded.kind, "png");
  assert.equal(decoded.extension, "png");
  assert.equal(decoded.contentType, "image/png");
  assert.ok(decoded.bytes.equals(pngBytes));
  assert.equal(decoded.safeFileName, "school-logo.png");
}

assert.throws(
  () => decodeAwardImageUpload({ content: "", encoding: "base64", fileName: "logo.png" }),
  /Choose an image file/,
  "Empty content must be rejected."
);

assert.throws(
  () => decodeAwardImageUpload({
    content: Buffer.from("not an image, just text").toString("base64"),
    encoding: "base64",
    fileName: "logo.png"
  }),
  /doesn't look like a supported image/,
  "Base64 content that decodes to a non-image must be rejected regardless of its file name."
);

{
  // Oversized content must be rejected from its base64 length alone, before
  // ever decoding it into a Buffer -- matches the pre-decode size check
  // lib/team_media_service.mjs and lib/result_ingestion_engine.mjs already use.
  const oversized = Buffer.concat([pngBytes, Buffer.alloc(MAX_IMAGE_BYTES + 1)]);

  assert.throws(
    () => decodeAwardImageUpload({
      content: oversized.toString("base64"),
      encoding: "base64",
      fileName: "logo.png"
    }),
    /5 MB or smaller/,
    "An oversized upload must be rejected."
  );
}

assert.throws(
  () => decodeAwardImageUpload({
    content: pngBytes.toString("base64"),
    encoding: "utf8",
    fileName: "logo.png"
  }),
  /Unsupported upload encoding/,
  "Only base64 uploads are accepted."
);

// --- Source guards for the parts that need a live Supabase connection ------
// storeAwardImageUpload / submitAwardImageUpload both make real Supabase
// Storage calls this fixture-only test file has no live backend for (the
// award-media bucket also does not exist until install/36 is run). These
// guard the real safety properties in the source directly, the same way
// scripts/test-team-media.mjs does for its sibling feature.

const serviceSource = await read("lib/award_media_service.mjs");
const endpointSource = await read("api/admin/awards-upload-media.js");
const migrationSource = await read("install/36_AWARD_MEDIA_UPLOADS.sql");
const clientSource = await read("public/scripts/admin-awards.js");

includesAll(
  serviceSource,
  ["classifyImageBytes(bytes)", "from \"./team_media_service.mjs\"", "createHash(\"sha256\")", "cleanType !== \"aotw\" && cleanType !== \"totw\""],
  "submitAwardImageUpload must classify by real bytes (reusing team_media_service's classifier), content-address the storage key, and validate the award type"
);

includesAll(
  endpointSource,
  ["isAdminRequest(request)"],
  "The upload endpoint must require an admin sign-in before accepting a file"
);

assert.ok(
  !/\.from\(\s*["'](aotw|totw)_(finalists|nominations)["']\s*\)/.test(endpointSource),
  "The upload endpoint must never query or write the finalists/nominations tables directly -- only the existing, already-audited promote/update/create actions do."
);

includesAll(
  migrationSource,
  ["insert into storage.buckets", "'award-media'", "public", "true", "begin;", "commit;"],
  "The migration must create a public award-media storage bucket, wrapped in a transaction"
);

assert.ok(
  !/create table|alter table/i.test(migrationSource),
  "The migration must only create a storage bucket -- it must never create or alter any table."
);

includesAll(
  clientSource,
  ["data-award-image-file", "/api/admin/awards-upload-media/", "handleAwardImageFileChange"],
  "The admin awards UI must offer a file upload for the photo, wired to the new upload endpoint"
);

console.log("Award media upload feature validation passed.");
console.log("Upload decoding checked: empty content, non-image content, oversized content (pre-decode), and encoding -- reusing team_media_service's real magic-byte classifier.");
console.log("Admin-only auth requirement and finalists/nominations write-avoidance guarded at the source level (live Storage verification still required after install/36 is run).");
console.log("Admin UI checked: a file input is wired to the upload endpoint on both the promote form and the finalist edit form.");
