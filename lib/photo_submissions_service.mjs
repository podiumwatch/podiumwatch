// Photo Submissions: a no-login public intake channel for parents, coaches,
// and photographers to hand off bulk meet photos, either by direct upload
// or by sharing an existing album link. See install/69_PHOTO_SUBMISSIONS.sql
// for the full storage-discipline design.
//
// Every image byte this module ever writes to Storage was produced by a
// browser's own Canvas encoder (the submitter's browser for preview/
// pending-original, an admin's browser for kept copies) -- nothing here
// trusts an arbitrary uploaded file's raw bytes directly, so there is no
// magic-byte sniffing here the way team_media_service/award_media_service
// need for their base64-through-function uploads. This module only ever
// hands out signed upload URLs and records the resulting storage keys.
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "./supabase-admin.mjs";
import { cleanAthleteText } from "./athlete_foundation_service.mjs";

const BUCKET = "photo-submissions";
export const MAX_FILE_BYTES = 12 * 1024 * 1024;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUBMISSION_DAILY_LIMIT = 10;
const UPLOAD_SLOT_DAILY_LIMIT = 400; // one submission can cover a whole meet -- up to MAX_ITEMS_PER_SUBMISSION photos, each needing 2 slots (preview + pending-original)
const MAX_ITEMS_PER_SUBMISSION = 150;
const SUBMITTER_ROLES = new Set(["parent", "coach", "photographer", "other"]);

function fail(message, status = 400, code = "") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  throw error;
}

function cleanDate(value) {
  const cleaned = cleanAthleteText(value, 30);
  if (!cleaned) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(cleaned) ? cleaned : null;
}

function fileExtension(filename) {
  const cleaned = cleanAthleteText(filename, 300);
  const match = cleaned.match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : "jpg";
}

async function checkRateLimit(ipHash, { table, limit }) {
  if (!ipHash) return;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabaseAdmin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("submitter_ip_hash", ipHash)
    .gte("created_at", since);
  if (error) throw error;
  if ((count || 0) >= limit) {
    fail("Too many submissions from this connection in the last day. Please try again tomorrow, or contact Podium Watch directly if this is a mistake.", 429, "RATE_LIMITED");
  }
}

// --- step 1: the browser asks for somewhere to upload a client-compressed image directly ---

export async function requestPhotoUploadSlot({ fileName, ipHash }) {
  const cleanedName = cleanAthleteText(fileName, 300);
  if (!cleanedName) fail("Choose a photo to upload.");

  await checkRateLimit(ipHash, { table: "photo_submission_upload_slots", limit: UPLOAD_SLOT_DAILY_LIMIT });

  const extension = fileExtension(cleanedName);
  const storageKey = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUploadUrl(storageKey);
  if (error) throw error;

  const { error: logError } = await supabaseAdmin
    .from("photo_submission_upload_slots")
    .insert({ storage_key: storageKey, submitter_ip_hash: ipHash || null });
  if (logError) throw logError;

  return {
    storage_key: storageKey,
    signed_url: data.signedUrl,
    token: data.token,
    max_file_bytes: MAX_FILE_BYTES
  };
}

async function confirmUploadExists(storageKey) {
  const [folder, name] = [storageKey.split("/")[0], storageKey.split("/")[1]];
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).list(folder, { search: name });
  if (error) throw error;
  return Boolean(data && data.length);
}

// --- step 2: after uploads succeeded, record the submission + its items ---

export async function createPhotoSubmission(input) {
  // Honeypot: matches every other public no-login submission on this site.
  if (cleanAthleteText(input.website, 200)) {
    return { accepted: true, submission_id: null };
  }

  const sourceType = input.sourceType === "link" ? "link" : "upload";
  const submitterName = cleanAthleteText(input.submitterName, 200);
  const submitterEmail = cleanAthleteText(input.submitterEmail, 320).toLowerCase();
  const submitterRole = SUBMITTER_ROLES.has(input.submitterRole) ? input.submitterRole : "other";
  const creditName = cleanAthleteText(input.creditName, 200);
  const permissionConfirmed = input.permissionConfirmed === true;
  const permissionNote = cleanAthleteText(input.permissionNote, 2000) || null;
  const meetName = cleanAthleteText(input.meetName, 300);
  const meetDate = cleanDate(input.meetDate);
  const schoolName = cleanAthleteText(input.schoolName, 300) || null;
  const albumUrl = cleanAthleteText(input.albumUrl, 2000) || null;

  if (!submitterName) fail("Your name is required.");
  if (!EMAIL_PATTERN.test(submitterEmail)) fail("A valid contact email is required.");
  if (!creditName) fail("A photo credit name is required.");
  if (!permissionConfirmed) fail("Please confirm you have permission to share these photos with Podium Watch.");
  if (!meetName) fail("Meet name is required.");

  if (sourceType === "link") {
    if (!albumUrl) fail("Paste your album link.");
  }

  const items = Array.isArray(input.items) ? input.items : [];
  if (sourceType === "upload") {
    if (!items.length) fail("Add at least one photo.");
    if (items.length > MAX_ITEMS_PER_SUBMISSION) {
      fail(`Please submit at most ${MAX_ITEMS_PER_SUBMISSION} photos at a time -- split a larger batch into more than one submission.`);
    }
    for (const item of items) {
      const previewKey = cleanAthleteText(item.previewStorageKey, 500);
      const pendingKey = cleanAthleteText(item.pendingOriginalStorageKey, 500);
      if (!previewKey || !pendingKey) fail("One of your photos did not finish uploading. Please try again.");
    }
    // Confirm every claimed key really landed in Storage -- a request-slot
    // call with no matching completed upload can never turn into an item.
    for (const item of items) {
      const previewOk = await confirmUploadExists(cleanAthleteText(item.previewStorageKey, 500));
      const pendingOk = await confirmUploadExists(cleanAthleteText(item.pendingOriginalStorageKey, 500));
      if (!previewOk || !pendingOk) fail("One of your photos could not be found. Please try uploading again.");
    }
  }

  const ipHash = cleanAthleteText(input.ipHash, 100);
  await checkRateLimit(ipHash, { table: "photo_submissions", limit: SUBMISSION_DAILY_LIMIT });

  const { data: submission, error: submissionError } = await supabaseAdmin
    .from("photo_submissions")
    .insert({
      source_type: sourceType,
      submitter_name: submitterName,
      submitter_email: submitterEmail,
      submitter_role: submitterRole,
      credit_name: creditName,
      permission_confirmed: permissionConfirmed,
      permission_note: permissionNote,
      meet_name: meetName,
      meet_date: meetDate,
      school_name: schoolName,
      album_url: albumUrl,
      submitter_ip_hash: ipHash || null
    })
    .select("id")
    .single();
  if (submissionError) throw submissionError;

  if (sourceType === "upload" && items.length) {
    const rows = items.map((item) => ({
      submission_id: submission.id,
      preview_storage_key: cleanAthleteText(item.previewStorageKey, 500),
      pending_original_storage_key: cleanAthleteText(item.pendingOriginalStorageKey, 500),
      original_filename: cleanAthleteText(item.originalFilename, 300) || null,
      athlete_tag: cleanAthleteText(item.athleteTag, 300) || null,
      school_tag: cleanAthleteText(item.schoolTag, 300) || null
    }));
    const { error: itemsError } = await supabaseAdmin.from("photo_submission_items").insert(rows);
    if (itemsError) throw itemsError;
  }

  return { accepted: true, submission_id: submission.id, item_count: items.length };
}

// --- admin: browse + select --------------------------------------------------

function publicUrl(storageKey) {
  if (!storageKey) return null;
  return supabaseAdmin.storage.from(BUCKET).getPublicUrl(storageKey).data.publicUrl;
}

export async function listPhotoSubmissions({ status, schoolName, meetName, itemStatus } = {}) {
  let query = supabaseAdmin
    .from("photo_submissions")
    .select("*, photo_submission_items(*)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (status && status !== "all") query = query.eq("status", status);
  if (schoolName) query = query.ilike("school_name", `%${schoolName}%`);
  if (meetName) query = query.ilike("meet_name", `%${meetName}%`);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((submission) => ({
    ...submission,
    photo_submission_items: (submission.photo_submission_items || [])
      .filter((item) => !itemStatus || itemStatus === "all" || item.item_status === itemStatus)
      .map((item) => ({
        ...item,
        preview_url: publicUrl(item.preview_storage_key),
        pending_original_url: publicUrl(item.pending_original_storage_key),
        kept_url: publicUrl(item.kept_storage_key)
      }))
  }));
}

// A signed upload URL for an ADMIN's browser to push a compressed "kept"
// copy to -- used both when promoting a pending-original (direct-upload
// path) and when an admin manually saves a photo they pulled from a shared
// album link (link path). Same primitive either way.
export async function requestKeptUploadSlot({ itemId }) {
  // itemId is optional here -- it's just a human-readable prefix on the
  // storage key when promoting an existing item. Adding a brand new kept
  // photo for a link submission (addKeptPhotoForLinkSubmission below) has
  // no item yet at slot-request time, so this falls back to a fresh id.
  const cleanedId = cleanAthleteText(itemId, 100) || randomUUID();
  const storageKey = `kept/${cleanedId}-${randomUUID().slice(0, 8)}.jpg`;
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(storageKey);
  if (error) throw error;

  return { storage_key: storageKey, signed_url: data.signedUrl, token: data.token };
}

// Completes a selection: after the admin's browser has already uploaded the
// compressed kept copy to the slot above, this marks the item selected and
// -- for the upload path -- deletes the now-unneeded pending-original
// immediately rather than waiting for the 90-day purge.
export async function selectPhotoItem({ itemId, keptStorageKey, actor = "Podium Watch Admin" }) {
  const cleanedId = cleanAthleteText(itemId, 100);
  if (!cleanedId) fail("Choose a photo.");
  const cleanedKeptKey = cleanAthleteText(keptStorageKey, 500);
  if (!cleanedKeptKey) fail("The kept copy could not be found. Please try again.");

  const keptOk = await confirmUploadExists(cleanedKeptKey);
  if (!keptOk) fail("The kept copy could not be found. Please try again.");

  const { data: item, error: fetchError } = await supabaseAdmin
    .from("photo_submission_items")
    .select("id, pending_original_storage_key")
    .eq("id", cleanedId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!item) fail("That photo could not be found.", 404);

  const { data, error } = await supabaseAdmin
    .from("photo_submission_items")
    .update({
      item_status: "selected",
      kept_storage_key: cleanedKeptKey,
      pending_original_storage_key: null,
      selected_at: new Date().toISOString(),
      selected_by: actor
    })
    .eq("id", cleanedId)
    .select("*")
    .single();
  if (error) throw error;

  if (item.pending_original_storage_key) {
    const { error: removeError } = await supabaseAdmin.storage.from(BUCKET).remove([item.pending_original_storage_key]);
    if (removeError) console.error("Photo submission: could not remove promoted pending-original:", removeError.message || removeError);
  }

  return data;
}

// A link submission has no items at all until an admin actually pulls a
// photo from the shared album and saves their own compressed copy -- this
// is that action. Creates the item already selected; there is no
// "pending" state for a link-sourced photo, since nothing about it was
// ever provisionally uploaded.
export async function addKeptPhotoForLinkSubmission({ submissionId, keptStorageKey, originalFilename, actor = "Podium Watch Admin" }) {
  const cleanedSubmissionId = cleanAthleteText(submissionId, 100);
  if (!cleanedSubmissionId) fail("Choose a submission.");
  const cleanedKeptKey = cleanAthleteText(keptStorageKey, 500);
  if (!cleanedKeptKey) fail("The kept copy could not be found. Please try again.");

  const keptOk = await confirmUploadExists(cleanedKeptKey);
  if (!keptOk) fail("The kept copy could not be found. Please try again.");

  const { data: submission, error: submissionError } = await supabaseAdmin
    .from("photo_submissions")
    .select("id, source_type")
    .eq("id", cleanedSubmissionId)
    .maybeSingle();
  if (submissionError) throw submissionError;
  if (!submission) fail("That submission could not be found.", 404);

  const { data, error } = await supabaseAdmin
    .from("photo_submission_items")
    .insert({
      submission_id: cleanedSubmissionId,
      item_status: "selected",
      kept_storage_key: cleanedKeptKey,
      original_filename: cleanAthleteText(originalFilename, 300) || null,
      selected_at: new Date().toISOString(),
      selected_by: actor
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function archivePhotoItem({ itemId, actor = "Podium Watch Admin" }) {
  const cleanedId = cleanAthleteText(itemId, 100);
  if (!cleanedId) fail("Choose a photo.");

  const { data, error } = await supabaseAdmin
    .from("photo_submission_items")
    .update({ item_status: "archived", selected_by: actor })
    .eq("id", cleanedId)
    .eq("item_status", "pending")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) fail("That photo is already selected or archived.", 409);
  return data;
}

export async function markSubmissionReviewed({ submissionId, actor = "Podium Watch Admin" }) {
  const cleanedId = cleanAthleteText(submissionId, 100);
  if (!cleanedId) fail("Choose a submission.");

  const { data, error } = await supabaseAdmin
    .from("photo_submissions")
    .update({ status: "reviewed", reviewed_at: new Date().toISOString(), reviewed_by: actor })
    .eq("id", cleanedId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) fail("That submission could not be found.", 404);
  return data;
}

// --- cron: purge unselected pending-originals past their 90-day window ------

export async function purgeExpiredPhotoOriginals() {
  const today = new Date().toISOString().slice(0, 10);
  const { data: items, error } = await supabaseAdmin
    .from("photo_submission_items")
    .select("id, pending_original_storage_key")
    .eq("item_status", "pending")
    .not("pending_original_storage_key", "is", null)
    .lte("purge_after", today)
    .limit(1000);
  if (error) throw error;

  let purged = 0, failed = 0;
  for (const item of items || []) {
    try {
      const { error: removeError } = await supabaseAdmin.storage.from(BUCKET).remove([item.pending_original_storage_key]);
      if (removeError) throw removeError;
      const { error: updateError } = await supabaseAdmin
        .from("photo_submission_items")
        .update({ pending_original_storage_key: null })
        .eq("id", item.id);
      if (updateError) throw updateError;
      purged += 1;
    } catch (purgeError) {
      failed += 1;
      console.error("Photo submission purge: could not purge item", item.id, purgeError.message || purgeError);
    }
  }

  return { purged, failed, checked: (items || []).length };
}
