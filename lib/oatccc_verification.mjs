import { createClient } from "@supabase/supabase-js";

// OATCCC Indoor State Meet team verification (Part B groundwork).
// Database: install/99_OATCCC_VERIFICATION.sql (rules enforced there).
// API: api/oatccc/verification.js. Pages: src/oatccc/verification_pages.mjs.
//
// Every database call here runs AS THE SIGNED-IN USER (their Supabase
// access token with the publishable key), never with the service role, so
// row-level security and the guard triggers decide what they can see and
// do. The checks in this file only give friendlier errors earlier.

// The form questions are waiting on Anjanette. These placeholders let the
// pages and the database be tested end to end; replace them when the real
// questions arrive. Answers are stored as one jsonb object keyed by `key`.
export const FORM_FIELDS = [
  { key: "ad_name", label: "Athletic director name", type: "text", required: true, max: 120 },
  { key: "coaches", label: "Board-approved indoor coaches (one per line)", type: "textarea", required: true, max: 2000 },
  { key: "board_approved", label: "Our local Board of Education approves this indoor team and its coaches for 2026-2027.", type: "checkbox", required: true },
  { key: "agree_terms", label: "I have read and agree to the Verification Agreement terms.", type: "checkbox", required: true }
];
export const FORM_IS_PLACEHOLDER = true;

export const STATUSES = ["submitted", "returned", "resubmitted", "approved"];
export const STATUS_LABELS = {
  submitted: "Submitted",
  returned: "Returned for changes",
  resubmitted: "Resubmitted",
  approved: "Approved"
};

export function verificationError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// Validates and normalizes answers against FORM_FIELDS. Unknown keys are
// dropped; nothing else is stored.
export function cleanAnswers(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw verificationError("Fill in the form before submitting.");
  const answers = {};
  const missing = [];
  for (const field of FORM_FIELDS) {
    const raw = input[field.key];
    if (field.type === "checkbox") {
      const value = raw === true || raw === "on" || raw === "true";
      if (field.required && !value) missing.push(field.label);
      answers[field.key] = value;
    } else {
      const value = String(raw ?? "").replace(/\r\n/g, "\n").trim();
      if (field.max && value.length > field.max) throw verificationError(`"${field.label}" is too long (${field.max} characters at most).`);
      if (field.required && !value) missing.push(field.label);
      answers[field.key] = value;
    }
  }
  if (missing.length) throw verificationError(`Please complete: ${missing.join("; ")}`);
  return answers;
}

export function cleanComment(input, { required = true } = {}) {
  const value = String(input ?? "").replace(/\r\n/g, "\n").trim();
  if (required && !value) throw verificationError("Write a comment first.");
  if (value.length > 5000) throw verificationError("Comments are limited to 5,000 characters.");
  return value;
}

export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ""));
}

// Database errors raised by the guard triggers start with this prefix;
// show the rest to the person, and map permission errors to 403.
export function friendlyDbError(error) {
  const message = String(error?.message || "");
  const match = message.match(/OATCCC verification: (.+)$/);
  if (match) return verificationError(match[1].charAt(0).toUpperCase() + match[1].slice(1) + ".", error.code === "42501" ? 403 : 400);
  if (error?.code === "42501") return verificationError("You do not have access to that.", 403);
  return verificationError("Something went wrong. Please try again.", 500);
}

// The season an AD submits to for a school: the newest season whose TEST
// flag matches the school's (TEST schools only ever use TEST seasons).
export function seasonForSchool(school, seasons) {
  return [...seasons]
    .filter((season) => season.is_test === school.is_test)
    .sort((a, b) => b.meet_year - a.meet_year)[0] || null;
}

export function bearerToken(request) {
  const header = request.headers?.authorization || request.headers?.Authorization || "";
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

// A Supabase client that acts as the signed-in user (RLS applies).
export function userClient(token) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw verificationError("Verification is not configured.", 500);
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
}

export async function requireUser(request) {
  const token = bearerToken(request);
  if (!token) throw verificationError("Please sign in.", 401);
  const client = userClient(token);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) throw verificationError("Your sign-in has expired. Please sign in again.", 401);
  return { client, user: data.user };
}

async function run(query) {
  const { data, error } = await query;
  if (error) throw friendlyDbError(error);
  return data;
}

// What this person may do: admin, and/or AD for which schools.
export async function loadMe(client, user) {
  const [staff, contacts, seasons] = await Promise.all([
    run(client.from("oatccc_staff").select("user_id, display_name").eq("user_id", user.id)),
    run(client.from("oatccc_school_contacts").select("school_id, display_name, oatccc_schools(id, name, city, is_test)").eq("user_id", user.id)),
    run(client.from("oatccc_seasons").select("id, name, meet_year, opens_at, due_at, late_closes_at, is_test"))
  ]);
  const schools = contacts.map((row) => row.oatccc_schools).filter(Boolean).map((school) => ({
    ...school,
    season: seasonForSchool(school, seasons)
  }));
  return { email: user.email || null, isAdmin: staff.length > 0, adminName: staff[0]?.display_name || null, schools };
}

const SUBMISSION_COLUMNS = "id, status, is_late, answers, first_submitted_at, last_submitted_at, decided_at, updated_at, season_id, school_id, oatccc_schools(name, city, is_test), oatccc_seasons(name, meet_year)";

export async function listSubmissions(client, { status } = {}) {
  let query = client.from("oatccc_submissions").select(SUBMISSION_COLUMNS).order("last_submitted_at", { ascending: false }).limit(1000);
  if (status) {
    if (!STATUSES.includes(status)) throw verificationError("Unknown status.");
    query = query.eq("status", status);
  }
  return run(query);
}

export async function loadSubmission(client, id) {
  if (!isUuid(id)) throw verificationError("Submission not found.", 404);
  const submission = await run(client.from("oatccc_submissions").select(SUBMISSION_COLUMNS).eq("id", id).maybeSingle());
  if (!submission) throw verificationError("Submission not found.", 404);
  const [comments, events] = await Promise.all([
    run(client.from("oatccc_submission_comments").select("id, author_role, body, created_at").eq("submission_id", id).order("created_at")),
    run(client.from("oatccc_submission_events").select("id, event, from_status, to_status, actor_role, is_late, created_at").eq("submission_id", id).order("id"))
  ]);
  return { submission, comments, events };
}

export async function findSubmission(client, seasonId, schoolId) {
  return run(client.from("oatccc_submissions").select(SUBMISSION_COLUMNS).eq("season_id", seasonId).eq("school_id", schoolId).maybeSingle());
}

export async function submit(client, { seasonId, schoolId, answers }) {
  if (!isUuid(seasonId) || !isUuid(schoolId)) throw verificationError("Pick your school first.");
  const clean = cleanAnswers(answers);
  return run(client.rpc("oatccc_submit", { p_season: seasonId, p_school: schoolId, p_answers: clean }).single());
}

export async function returnSubmission(client, { submissionId, comment }) {
  if (!isUuid(submissionId)) throw verificationError("Submission not found.", 404);
  return run(client.rpc("oatccc_return_submission", { p_submission: submissionId, p_comment: cleanComment(comment) }).single());
}

export async function approveSubmission(client, { submissionId, comment }) {
  if (!isUuid(submissionId)) throw verificationError("Submission not found.", 404);
  const note = cleanComment(comment, { required: false });
  return run(client.rpc("oatccc_approve_submission", { p_submission: submissionId, p_comment: note || null }).single());
}

export async function addComment(client, { submissionId, body }) {
  if (!isUuid(submissionId)) throw verificationError("Submission not found.", 404);
  // author_id and author_role are set by the database from the sign-in.
  return run(client.from("oatccc_submission_comments").insert({ submission_id: submissionId, author_role: "admin", body: cleanComment(body) }).select("id, author_role, body, created_at").single());
}
