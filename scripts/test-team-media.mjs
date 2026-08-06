import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY ||= "test-service-role-key";

const {
  MAX_IMAGE_BYTES,
  classifyImageBytes,
  decodeImageUpload
} = await import("../lib/team_media_service.mjs");

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), "utf8");
}

function includesAll(text, values, label) {
  for (const value of values) {
    assert.ok(text.includes(value), `${label} is missing ${value}`);
  }
}

// --- classifyImageBytes -----------------------------------------------------
// Every case reads real magic bytes, never a file extension or a claimed
// content type -- the same principle lib/result_parsers.mjs already uses for
// results documents.

const pngBytes = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d
]);

const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const gifBytes = Buffer.from("GIF89a" + "\x00".repeat(10), "latin1");

const webpBytes = Buffer.concat([
  Buffer.from("RIFF", "latin1"),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from("WEBP", "latin1")
]);

assert.equal(classifyImageBytes(pngBytes), "png");
assert.equal(classifyImageBytes(jpegBytes), "jpeg");
assert.equal(classifyImageBytes(gifBytes), "gif");
assert.equal(classifyImageBytes(webpBytes), "webp");
assert.equal(classifyImageBytes(Buffer.from("plain text file")), null, "Ordinary text must not be classified as an image.");
assert.equal(classifyImageBytes(Buffer.from("<svg></svg>")), null, "SVG (XML, can carry scripts) must not be accepted as an image.");
assert.equal(classifyImageBytes(Buffer.alloc(0)), null, "An empty file must not be classified as an image.");
assert.equal(classifyImageBytes(Buffer.from([0xff, 0xd8])), null, "A truncated signature (too short to match) must not be classified as an image.");

// A file merely renamed to end in .png but containing HTML must still be
// rejected -- classification never looks at the file name.
const fakePng = Buffer.from("<html>not really a png</html>");
assert.equal(classifyImageBytes(fakePng), null, "A mislabeled non-image file must still be rejected by its real bytes.");

// --- decodeImageUpload -------------------------------------------------------

{
  const decoded = decodeImageUpload({
    content: pngBytes.toString("base64"),
    encoding: "base64",
    fileName: "logo.png",
    field: "logo_url"
  });

  assert.equal(decoded.kind, "png");
  assert.equal(decoded.extension, "png");
  assert.equal(decoded.contentType, "image/png");
  assert.ok(decoded.bytes.equals(pngBytes));
  assert.equal(decoded.safeFileName, "logo.png");
}

assert.throws(
  () => decodeImageUpload({
    content: pngBytes.toString("base64"),
    encoding: "base64",
    fileName: "logo.png",
    field: "not_a_real_field"
  }),
  /valid image field/,
  "An unrecognized target field must be rejected."
);

assert.throws(
  () => decodeImageUpload({
    content: "",
    encoding: "base64",
    fileName: "logo.png",
    field: "logo_url"
  }),
  /Choose an image file/,
  "Empty content must be rejected."
);

assert.throws(
  () => decodeImageUpload({
    content: Buffer.from("not an image, just text").toString("base64"),
    encoding: "base64",
    fileName: "logo.png",
    field: "logo_url"
  }),
  /doesn't look like a supported image/,
  "Base64 content that decodes to a non-image must be rejected regardless of its file name."
);

{
  // Oversized content must be rejected from its base64 length alone, before
  // ever decoding it into a Buffer -- matches the pre-decode size check
  // lib/result_ingestion_engine.mjs already uses for results documents.
  const oversized = Buffer.concat([pngBytes, Buffer.alloc(MAX_IMAGE_BYTES + 1)]);

  assert.throws(
    () => decodeImageUpload({
      content: oversized.toString("base64"),
      encoding: "base64",
      fileName: "logo.png",
      field: "logo_url"
    }),
    /5 MB or smaller/,
    "An oversized upload must be rejected."
  );
}

assert.throws(
  () => decodeImageUpload({
    content: pngBytes.toString("base64"),
    encoding: "utf8",
    fileName: "logo.png",
    field: "logo_url"
  }),
  /Unsupported upload encoding/,
  "Only base64 uploads are accepted."
);

// --- Source guards for the parts that need a live Supabase connection ------
// storeTeamMediaUpload and submitTeamMediaUpload both make real Supabase
// Storage calls this fixture-only test file does not have a live backend
// for (the team-media bucket also does not exist yet until install/08 is
// run). These guard the real safety properties in the source directly, the
// same way the team Instagram feature's tests do.

const serviceSource = await read("lib/team_media_service.mjs");
const endpointSource = await read("api/team/upload-media.js");
const migrationSource = await read("install/08_TEAM_MEDIA_UPLOADS.sql");

includesAll(
  serviceSource,
  ["classifyImageBytes(bytes)", "UPLOAD_FIELDS.has(field)", "createHash(\"sha256\")"],
  "submitTeamMediaUpload must classify by real bytes, validate the target field, and content-address the storage key"
);

includesAll(
  endpointSource,
  ["requireTeamUser(request)", "requireMembership(user.id, teamId)", "isAdminRequest(request)"],
  "The upload endpoint must require a signed-in team member (or an admin) before accepting a file"
);

assert.ok(
  !/\.from\(\s*["']team_pages["']\s*\)/.test(endpointSource),
  "The upload endpoint must never query or write public.team_pages directly -- only the existing, already-audited \"save\" action does."
);

includesAll(
  migrationSource,
  ["insert into storage.buckets", "'team-media'", "public", "true", "begin;", "commit;"],
  "The migration must create a public team-media storage bucket, wrapped in a transaction"
);

assert.ok(
  !/create table|alter table/i.test(migrationSource),
  "The migration must only create a storage bucket -- it must never create or alter any table."
);

console.log("Team media upload feature validation passed.");
console.log("Magic-byte image classification checked for PNG, JPEG, GIF, WEBP, and rejected for non-images, mislabeled files, and truncated signatures.");
console.log("Upload decoding checked: field validation, empty content, non-image content, oversized content (pre-decode), and encoding.");
console.log("Team membership auth requirement and team_pages write-avoidance guarded at the source level (live Storage verification still required after install/08 is run).");
