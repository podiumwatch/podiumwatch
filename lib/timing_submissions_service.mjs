// Timing Company Submissions: a separate, no-login public intake channel
// for timing companies to hand off finished race results directly --
// distinct from the existing Results Ingestion Engine (web crawling,
// lib/result_ingestion_engine.mjs) and the existing /submit-results/
// text/paste path (that same file's createPublicResultsSubmission). This
// one is specifically a raw FILE handoff: nothing here parses, matches, or
// imports anything -- a file lands hidden in Supabase Storage, its
// metadata lands hidden in this table, and an admin reviews and runs it
// through the existing import tooling by hand. See install/45.
//
// Upload shape: the file's actual bytes never pass through this file (or
// any Vercel serverless function) at all. Vercel Functions hard-cap
// request bodies at 4.5 MB (confirmed against Vercel's own docs, 2026-09),
// which a base64-encoded file comfortably blows past well before this
// feature's real 25 MB cap -- the same pattern api/timing-submissions/
// submit.js's sibling request-upload.js exists to avoid. The browser
// uploads directly to Supabase Storage using a short-lived signed upload
// URL (requestTimingSubmissionUploadSlot below); only the resulting
// storage key and plain metadata (no bytes) ever reach an API route.
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "./supabase-admin.mjs";
import { cleanAthleteText } from "./athlete_foundation_service.mjs";

const BUCKET = "timing-submissions";
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUBMISSION_DAILY_LIMIT = 10;
const UPLOAD_SLOT_DAILY_LIMIT = 30; // slightly looser than the final-submit limit -- a retried/failed upload shouldn't burn a submission slot

// Server-side allowlist -- the real safety boundary. The public form's
// <input accept> is a UI convenience only; a client can send anything, so
// this is checked again here regardless of what accept suggested. Hy-Tek's
// .hy3 is accepted for storage (a timing company's own native export),
// even though nothing in this codebase parses it -- this feature only ever
// hands a file to an admin to process by hand, so "nobody can auto-read it
// yet" is not a reason to refuse storing it.
const ALLOWED_EXTENSIONS = new Set(["pdf", "csv", "xlsx", "xls", "hy3", "txt"]);

function fail(message, status = 400, code = "") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  throw error;
}

function fileExtension(filename) {
  const cleaned = cleanAthleteText(filename, 300);
  const match = cleaned.match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : "";
}

function cleanDate(value) {
  const cleaned = cleanAthleteText(value, 30);
  if (!cleaned) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(cleaned) ? cleaned : null;
}

async function checkRateLimit(ipHash, { table = "timing_submissions", column = "submitter_ip_hash", limit }) {
  if (!ipHash) return;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabaseAdmin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, ipHash)
    .gte("created_at", since);
  if (error) throw error;
  if ((count || 0) >= limit) {
    fail("Too many submissions from this connection in the last day. Please try again tomorrow, or contact Podium Watch directly if this is a mistake.", 429, "RATE_LIMITED");
  }
}

// --- step 1: the browser asks for somewhere to upload directly ------------

// Deliberately does not touch timing_submissions at all -- a slot that's
// requested but never actually uploaded to (an abandoned form, a network
// failure) leaves nothing behind. The real submission row (step 2 below)
// is what actually records anything, and only after a real upload
// succeeded against this exact key.
export async function requestTimingSubmissionUploadSlot({ fileName, ipHash }) {
  const cleanedName = cleanAthleteText(fileName, 300);
  if (!cleanedName) fail("Choose a results file to upload.");

  const extension = fileExtension(cleanedName);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    fail(`That file type isn't accepted. Use one of: ${[...ALLOWED_EXTENSIONS].join(", ")}.`);
  }

  await checkRateLimit(ipHash, { table: "timing_submission_upload_slots", limit: UPLOAD_SLOT_DAILY_LIMIT });

  const storageKey = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUploadUrl(storageKey);
  if (error) throw error;

  // A lightweight audit trail of issued slots, purely for the rate limit
  // above to count against -- not the submission record itself.
  const { error: logError } = await supabaseAdmin
    .from("timing_submission_upload_slots")
    .insert({ storage_key: storageKey, submitter_ip_hash: ipHash || null });
  if (logError) throw logError;

  return {
    storage_key: storageKey,
    signed_url: data.signedUrl,
    token: data.token,
    max_file_bytes: MAX_FILE_BYTES
  };
}

// --- step 2: after a real upload succeeded, record the submission ---------

export async function submitTimingResults(input) {
  // Honeypot: a field real submitters never see or fill in. Report success
  // without doing any real work, so a bot gets no signal it was caught --
  // same convention as createPublicResultsSubmission and
  // submitRecruitingActivityTip.
  if (cleanAthleteText(input.website, 200)) {
    return { accepted: true, submission_id: null };
  }

  const meetName = cleanAthleteText(input.meetName, 300);
  const timingCompanyName = cleanAthleteText(input.timingCompanyName, 300);
  const submitterEmail = cleanAthleteText(input.submitterEmail, 320).toLowerCase();
  const meetDate = cleanDate(input.meetDate);
  const divisionLevel = cleanAthleteText(input.divisionLevel, 200) || null;
  const originalFilename = cleanAthleteText(input.fileName, 300);
  const contentType = cleanAthleteText(input.contentType, 200) || null;
  const storageKey = cleanAthleteText(input.storageKey, 500);
  const fileSizeBytes = Number(input.fileSizeBytes);

  if (!meetName) fail("Meet name is required.");
  if (!timingCompanyName) fail("Your timing company's name is required.");
  if (!EMAIL_PATTERN.test(submitterEmail)) fail("A valid contact email is required.");
  if (!originalFilename) fail("Choose a results file to upload.");
  if (!storageKey) fail("The uploaded file could not be found. Please try uploading again.");
  if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) fail("The uploaded file could not be read.");
  if (fileSizeBytes > MAX_FILE_BYTES) {
    fail(`That file is larger than ${Math.floor(MAX_FILE_BYTES / (1024 * 1024))} MB. Please contact Podium Watch directly for very large exports.`);
  }

  // Confirms a real upload actually landed at this exact key -- a
  // request-upload call with no matching completed upload can never turn
  // into a submission row.
  const { data: existsCheck, error: existsError } = await supabaseAdmin.storage
    .from(BUCKET)
    .list(storageKey.split("/")[0], { search: storageKey.split("/")[1] });
  if (existsError) throw existsError;
  if (!existsCheck || existsCheck.length === 0) {
    fail("The uploaded file could not be found. Please try uploading again.");
  }

  const ipHash = cleanAthleteText(input.ipHash, 100);
  await checkRateLimit(ipHash, { limit: SUBMISSION_DAILY_LIMIT });

  const { data, error } = await supabaseAdmin
    .from("timing_submissions")
    .insert({
      meet_name: meetName,
      meet_date: meetDate,
      division_level: divisionLevel,
      timing_company_name: timingCompanyName,
      submitter_email: submitterEmail,
      storage_key: storageKey,
      original_filename: originalFilename,
      content_type: contentType,
      file_size_bytes: Math.trunc(fileSizeBytes),
      submitter_ip_hash: ipHash || null,
      status: "pending"
    })
    .select("id")
    .single();

  if (error) throw error;

  return { accepted: true, submission_id: data.id };
}

// --- admin: review queue ----------------------------------------------------

export async function listTimingSubmissions({ status = "pending" } = {}) {
  let query = supabaseAdmin
    .from("timing_submissions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Signed, short-lived -- the bucket is private, so this is the only way
// an admin (or anyone) ever actually reaches a submitted file's bytes.
export async function getTimingSubmissionDownloadUrl(submissionId) {
  const cleanedId = cleanAthleteText(submissionId, 100);
  if (!cleanedId) fail("Choose a submission.");

  const { data: submission, error: fetchError } = await supabaseAdmin
    .from("timing_submissions")
    .select("storage_key, original_filename")
    .eq("id", cleanedId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!submission) fail("That submission could not be found.", 404);

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(submission.storage_key, 300, {
      download: submission.original_filename
    });
  if (error) throw error;

  return { url: data.signedUrl, expires_in_seconds: 300 };
}

export async function reviewTimingSubmission({ submissionId, status, note = "", actor = "Podium Watch Admin" }) {
  const cleanedId = cleanAthleteText(submissionId, 100);
  if (!cleanedId) fail("Choose a submission.");
  if (!["reviewed", "rejected"].includes(status)) fail("Invalid submission review status.");

  const { data, error } = await supabaseAdmin
    .from("timing_submissions")
    .update({
      status,
      review_note: cleanAthleteText(note, 2000) || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: actor
    })
    .eq("id", cleanedId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) fail("This submission has already been reviewed.", 409);
  return data;
}
