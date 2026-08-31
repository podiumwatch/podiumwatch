import crypto from "node:crypto";
import { supabaseAdmin } from "./supabase-admin.mjs";
import { classifyImageBytes } from "./team_media_service.mjs";

// Lets an admin upload an actual image file for an Athlete of the Week /
// Team of the Week nomination or finalist photo, instead of only being
// able to paste a URL to an image already hosted somewhere else. Most
// nominators never submit a photo_url at all (see lib/awards_service.mjs),
// so the most common real use of this is attaching a school logo an admin
// has as a local file. Mirrors lib/team_media_service.mjs's exact
// validate-by-magic-bytes-then-store pattern (see
// install/36_AWARD_MEDIA_UPLOADS.sql, and install/08 for the sibling team
// version) -- classifyImageBytes is reused directly from that file rather
// than reimplemented, since the magic-byte signatures it checks aren't
// award-specific. The only real differences here: a separate bucket, and
// this path is admin-only (api/admin/awards-upload-media.js gates on
// isAdminRequest), so there's no team-membership check to reuse.

const BUCKET = "award-media";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const IMAGE_KIND_INFO = {
  png: { extension: "png", contentType: "image/png" },
  jpeg: { extension: "jpg", contentType: "image/jpeg" },
  gif: { extension: "gif", contentType: "image/gif" },
  webp: { extension: "webp", contentType: "image/webp" }
};

function error(message, status = 400, code = "AWARD_MEDIA_ERROR") {
  const value = new Error(message);
  value.status = status;
  value.code = code;
  return value;
}

function clean(value, max = 200) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

// Decodes a base64 upload, checks its size before AND after decoding (the
// pre-decode check avoids allocating memory for an oversized payload just
// to reject it), and classifies it by magic bytes. Never trusts the
// caller's declared file name or content type on their own -- same
// reasoning as lib/team_media_service.mjs's decodeImageUpload.
export function decodeAwardImageUpload({ content, encoding, fileName }) {
  const text = String(content ?? "");

  if (!text.trim()) {
    throw error("Choose an image file to upload.", 400);
  }

  if (encoding && encoding !== "base64") {
    throw error("Unsupported upload encoding.", 400);
  }

  if (Buffer.byteLength(text, "base64") > MAX_IMAGE_BYTES) {
    throw error("Images must be 5 MB or smaller.", 413, "IMAGE_TOO_LARGE");
  }

  const bytes = Buffer.from(text, "base64");

  if (!bytes.length) {
    throw error("That file appears to be empty.", 400);
  }

  if (bytes.length > MAX_IMAGE_BYTES) {
    throw error("Images must be 5 MB or smaller.", 413, "IMAGE_TOO_LARGE");
  }

  const kind = classifyImageBytes(bytes);

  if (!kind) {
    throw error(
      "That file doesn't look like a supported image. Use a JPEG, PNG, GIF, or WEBP file.",
      422,
      "UNSUPPORTED_IMAGE_TYPE"
    );
  }

  const info = IMAGE_KIND_INFO[kind];

  return {
    bytes,
    kind,
    extension: info.extension,
    contentType: info.contentType,
    safeFileName: clean(fileName || `image.${info.extension}`, 180)
      .replace(/[^a-zA-Z0-9._ -]/g, "_")
  };
}

// Uploads already-validated bytes to the public award-media bucket and
// returns the resulting public URL. The storage key is content-addressed
// (award type + the nomination/finalist id it's being attached to + a
// short hash of the bytes) so re-uploading the same image is a no-op and a
// changed image always gets a fresh address, avoiding stale-cache
// confusion on the public finalist/winner card -- same reasoning as
// storeTeamMediaUpload.
export async function storeAwardImageUpload({
  type,
  recordId,
  bytes,
  extension,
  contentType
}) {
  const digest = crypto
    .createHash("sha256")
    .update(bytes)
    .digest("hex")
    .slice(0, 20);

  const storageKey = `${type}/${recordId}-${digest}.${extension}`;

  const { error: storageError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storageKey, bytes, {
      contentType,
      upsert: true
    });

  if (storageError) {
    throw error(
      `The image could not be uploaded: ${storageError.message || "storage error"}`,
      500,
      "IMAGE_STORAGE_FAILED"
    );
  }

  const { data } = supabaseAdmin.storage
    .from(BUCKET)
    .getPublicUrl(storageKey);

  if (!data?.publicUrl) {
    throw error(
      "The image was uploaded but no public address was returned.",
      500,
      "IMAGE_STORAGE_FAILED"
    );
  }

  return { url: data.publicUrl, storageKey };
}

// The single entry point api/admin/awards-upload-media.js calls: validates,
// then stores, then returns just what the admin UI needs to fill the
// matching Photo URL field in on the promote/edit form. Persisting that
// URL into aotw_finalists/totw_finalists (or the nomination row) happens
// later, through the existing promote_nomination / update_finalist /
// create_nomination actions, the same as if the admin had pasted the URL
// in by hand.
export async function submitAwardImageUpload({
  type,
  recordId,
  content,
  encoding,
  fileName
}) {
  const cleanType = String(type || "").trim().toLowerCase();
  if (cleanType !== "aotw" && cleanType !== "totw") {
    throw error("Choose athlete or team of the week.", 400, "INVALID_AWARD_TYPE");
  }

  const cleanRecordId = clean(recordId, 200);
  if (!cleanRecordId) {
    throw error("Choose a nomination or finalist first.", 400);
  }

  const decoded = decodeAwardImageUpload({ content, encoding, fileName });

  const stored = await storeAwardImageUpload({
    type: cleanType,
    recordId: cleanRecordId,
    bytes: decoded.bytes,
    extension: decoded.extension,
    contentType: decoded.contentType
  });

  return {
    url: stored.url,
    kind: decoded.kind,
    byteLength: decoded.bytes.length
  };
}
