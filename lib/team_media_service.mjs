import crypto from "node:crypto";
import { supabaseAdmin } from "./supabase-admin.mjs";

// A claimed team's coach can already paste a URL to an already-hosted logo
// or banner image directly into public.team_pages.logo_url /
// banner_image_url -- that path is untouched by this file. This module adds
// a second path: uploading an actual image file. It validates the file by
// reading its own magic bytes (never trusting the browser-supplied content
// type alone, the same principle lib/result_parsers.mjs already uses for
// results documents), stores it in the public "team-media" Supabase Storage
// bucket (see install/08_TEAM_MEDIA_UPLOADS.sql), and hands back a public
// URL. The caller writes that URL into the very same logo_url /
// banner_image_url field the existing "save" action in api/team/detail.js
// already persists, so nothing about how those fields are stored, audited,
// or displayed needs to change. See docs/DECISIONS.md, 2026-08-06.

const BUCKET = "team-media";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const UPLOAD_FIELDS = new Set(["logo_url", "banner_image_url"]);

const IMAGE_KIND_INFO = {
  png: { extension: "png", contentType: "image/png" },
  jpeg: { extension: "jpg", contentType: "image/jpeg" },
  gif: { extension: "gif", contentType: "image/gif" },
  webp: { extension: "webp", contentType: "image/webp" }
};

function error(message, status = 400, code = "TEAM_MEDIA_ERROR") {
  const value = new Error(message);
  value.status = status;
  value.code = code;
  return value;
}

function clean(value, max = 200) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

// Reads the first few bytes of a file to identify its real format,
// regardless of what content type or file extension the browser reported.
export function classifyImageBytes(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 4) {
    return null;
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }

  if (bytes.length >= 6) {
    const header = bytes.subarray(0, 6).toString("latin1");

    if (header === "GIF87a" || header === "GIF89a") {
      return "gif";
    }
  }

  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("latin1") === "RIFF" &&
    bytes.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return "webp";
  }

  return null;
}

// Decodes a base64 upload, checks its size before AND after decoding (the
// pre-decode check avoids allocating memory for an oversized payload just to
// reject it), and classifies it by magic bytes. Throws a clear, user-facing
// error for every way an upload can be invalid; never trusts the caller's
// declared field, file name, or content type on their own.
export function decodeImageUpload({
  content,
  encoding,
  fileName,
  field
}) {
  if (!UPLOAD_FIELDS.has(field)) {
    throw error("Choose a valid image field.", 400, "INVALID_FIELD");
  }

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

// Uploads already-validated bytes to the public team-media bucket and
// returns the resulting public URL. Each upload gets a content-addressed
// key (team id + field + a short hash of the bytes) so re-uploading the
// same image is a no-op and a changed image always gets a fresh address,
// which avoids any stale-cache confusion on the public team page.
export async function storeTeamMediaUpload({
  teamId,
  field,
  bytes,
  extension,
  contentType
}) {
  const digest = crypto
    .createHash("sha256")
    .update(bytes)
    .digest("hex")
    .slice(0, 20);

  const storageKey = `${teamId}/${field}-${digest}.${extension}`;

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

// The single entry point api/team/upload-media.js calls: validates, then
// stores, then returns just what the client needs to fill the matching URL
// field in on the team editor form. Persisting that URL into
// public.team_pages happens later, through the existing "save" action, the
// same as if the coach had pasted the URL in by hand.
export async function submitTeamMediaUpload({
  teamId,
  field,
  content,
  encoding,
  fileName
}) {
  const cleanTeamId = clean(teamId, 200);

  if (!cleanTeamId) {
    throw error("A team is required.", 400);
  }

  const decoded = decodeImageUpload({
    content,
    encoding,
    fileName,
    field
  });

  const stored = await storeTeamMediaUpload({
    teamId: cleanTeamId,
    field,
    bytes: decoded.bytes,
    extension: decoded.extension,
    contentType: decoded.contentType
  });

  return {
    url: stored.url,
    field,
    kind: decoded.kind,
    byteLength: decoded.bytes.length
  };
}
