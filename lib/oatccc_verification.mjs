import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { formTextParagraphs } from "../src/oatccc/verification_form_text.mjs";
import { selectAll } from "./supabase_paging.mjs";

// OATCCC Indoor State Meet team verification (Part B groundwork).
// Database: install/99_OATCCC_VERIFICATION.sql (rules enforced there).
// API: api/oatccc/verification.js. Pages: src/oatccc/verification_pages.mjs.
//
// Every database call here runs AS THE SIGNED-IN USER (their Supabase
// access token with the publishable key), never with the service role, so
// row-level security and the guard triggers decide what they can see and
// do. The checks in this file only give friendlier errors earlier.

// The verification form (Zachary, 2026-11-17), in this order:
//   Name of school (dropdown: only the OATCCC's verification list)
//   Boys' head coach:  first and last name, cell phone, email
//   Girls' head coach: first and last name, cell phone, email
//   Athletic director: first and last name, cell phone, email
//   The agreement text (src/oatccc/verification_form_text.mjs), then the
//   signature: signature pad, typed name, date.
// School and AD are required. A coach section is required only when the
// school has that team ("We have a boys' team" / "We have a girls' team";
// at least one). Coach names and emails are kept so the Chair can check
// OATCCC membership later.
//
// Stored answers (jsonb):
//   { has_boys, has_girls,
//     boys_coach:  { first_name, last_name, cell_phone, email } | null,
//     girls_coach: { ... } | null,
//     ad:          { first_name, last_name, cell_phone, email } }
export const PERSON_FIELDS = [
  { key: "first_name", label: "First name", type: "text", max: 60, autocomplete: "given-name" },
  { key: "last_name", label: "Last name", type: "text", max: 60, autocomplete: "family-name" },
  { key: "cell_phone", label: "Cell phone", type: "tel", max: 30, autocomplete: "tel" },
  { key: "email", label: "Email", type: "email", max: 254, autocomplete: "email" }
];
export const PEOPLE = [
  { key: "boys_coach", label: "Boys' head coach", team: "has_boys", teamLabel: "We have a boys' team" },
  { key: "girls_coach", label: "Girls' head coach", team: "has_girls", teamLabel: "We have a girls' team" },
  { key: "ad", label: "Athletic director", team: null }
];

// Every submit and resubmit records which form text was signed.
export const FORM_TEXT_SHA256 = createHash("sha256").update(formTextParagraphs().join("\n"), "utf8").digest("hex");

// Admin roles (install/101_OATCCC_ADMIN_ROLES.sql). The database enforces
// these; the pages only use them to decide what to show.
export const ADMIN_ROLES = ["president", "indoor_chair", "ms_indoor_chair", "clinic_chair", "site_admin"];
export const INDOOR_ROLES = ["president", "indoor_chair", "site_admin"];
export function canWorkIndoor(role) {
  return INDOOR_ROLES.includes(role);
}

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

// US numbers only: 10 digits, an optional leading 1. Stored as
// (614) 555-0100.
export function cleanPhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) return null;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function cleanEmail(value) {
  const email = String(value ?? "").trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@<>()",;:]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/.test(email)) return null;
  return email;
}

function cleanPerson(input, label) {
  const person = input && typeof input === "object" ? input : {};
  const out = {};
  const problems = [];
  for (const field of PERSON_FIELDS) {
    const raw = String(person[field.key] ?? "").replace(/\s+/g, " ").trim();
    if (!raw) { problems.push(`${label}: ${field.label.toLowerCase()}`); continue; }
    if (raw.length > field.max) throw verificationError(`${label}: ${field.label.toLowerCase()} is too long.`);
    if (field.key === "cell_phone") {
      const phone = cleanPhone(raw);
      if (!phone) throw verificationError(`${label}: enter a 10-digit cell phone number.`);
      out[field.key] = phone;
    } else if (field.key === "email") {
      const email = cleanEmail(raw);
      if (!email) throw verificationError(`${label}: enter a valid email address.`);
      out[field.key] = email;
    } else {
      out[field.key] = raw;
    }
  }
  return { person: out, problems };
}

// Validates and normalizes the answers. Unknown keys are dropped; a coach
// section for a team the school does not have is not stored.
export function cleanAnswers(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw verificationError("Fill in the form before submitting.");
  const yes = (value) => value === true || value === "on" || value === "true";
  const answers = { has_boys: yes(input.has_boys), has_girls: yes(input.has_girls), boys_coach: null, girls_coach: null, ad: null };
  if (!answers.has_boys && !answers.has_girls) throw verificationError("Check at least one team: boys or girls.");
  const missing = [];
  for (const who of PEOPLE) {
    if (who.team && !answers[who.team]) continue;
    const { person, problems } = cleanPerson(input[who.key], who.label);
    missing.push(...problems);
    answers[who.key] = person;
  }
  if (missing.length) throw verificationError(`Please complete: ${missing.join("; ")}.`);
  return answers;
}

// The signature: typed name and the signature pad's PNG image.
const PNG_PREFIX = "data:image/png;base64,";
export const SIGNATURE_MAX = 300000;
export function cleanSignature(input) {
  const typedName = String(input?.typed_name ?? "").replace(/\s+/g, " ").trim();
  if (typedName.length < 2) throw verificationError("Type your name to sign.");
  if (typedName.length > 120) throw verificationError("Your typed name is too long.");
  const png = String(input?.png ?? "");
  if (!png.startsWith(PNG_PREFIX) || png.length > SIGNATURE_MAX) throw verificationError("Sign in the signature box.");
  const bytes = Buffer.from(png.slice(PNG_PREFIX.length), "base64");
  if (bytes.length < 60 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw verificationError("Sign in the signature box.");
  return { typedName, png };
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

// A Supabase client with no sign-in (the anon role): reads only the
// public views install/99 and 102 grant to anon (verified list, division
// list, MileSplit export).
export function anonClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw verificationError("Not configured.", 500);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
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

// What this person may do: admin, and/or AD for which schools, and
// whether they may pick a school (install/102 oatccc_config).
export async function loadMe(client, user) {
  const [staff, contacts, seasons, config] = await Promise.all([
    run(client.from("oatccc_staff").select("user_id, display_name, role").eq("user_id", user.id)),
    run(client.from("oatccc_school_contacts").select("school_id, display_name, oatccc_schools(id, name, city, is_test)").eq("user_id", user.id)),
    run(client.from("oatccc_seasons").select("id, name, meet_year, opens_at, due_at, late_closes_at, is_test")),
    run(client.from("oatccc_config").select("key, value").eq("key", "ad_school_choice"))
  ]);
  const schools = contacts.map((row) => row.oatccc_schools).filter(Boolean).map((school) => ({
    ...school,
    season: seasonForSchool(school, seasons)
  }));
  const role = staff[0]?.role || null;
  // isAdmin = may use the verification queue (an indoor role).
  const choice = config[0]?.value === "pick" ? "pick" : "linked";
  return { email: user.email || null, isAdmin: canWorkIndoor(role), role, adminName: staff[0]?.display_name || null, schools, choice, seasons };
}

// The school dropdown: the schools this person may pick (row-level
// security: the OATCCC verification list in "pick" mode, TEST schools for
// testers), each with the season it would submit to.
export async function listPickableSchools(client, seasons) {
  const rows = await run(selectAll(
    () => client.from("oatccc_schools")
      .select("id, name, city, is_test, on_verification_list")
      .or("on_verification_list.eq.true,is_test.eq.true")
      .order("is_test", { ascending: false })
      .order("name"),
    { maxRows: 5000 }
  ));
  return rows.map((school) => {
    const season = seasonForSchool(school, seasons);
    return { id: school.id, name: school.name, city: school.city, is_test: school.is_test, season_id: season?.id || null };
  });
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
  const [comments, events, signatures] = await Promise.all([
    run(client.from("oatccc_submission_comments").select("id, author_role, body, created_at").eq("submission_id", id).order("created_at")),
    run(client.from("oatccc_submission_events").select("id, event, from_status, to_status, actor_role, is_late, created_at").eq("submission_id", id).order("id")),
    run(client.from("oatccc_signatures").select("id, typed_name, signature_png, signed_at, form_text_sha256").eq("submission_id", id).order("signed_at"))
  ]);
  return { submission, comments, events, signatures };
}

export async function findSubmission(client, seasonId, schoolId) {
  return run(client.from("oatccc_submissions").select(SUBMISSION_COLUMNS).eq("season_id", seasonId).eq("school_id", schoolId).maybeSingle());
}

// Submit (or resubmit a returned form) with the signature. Everything is
// checked here first for clear messages, and again by the database.
export async function submit(client, { seasonId, schoolId, answers, signature }) {
  if (!isUuid(seasonId) || !isUuid(schoolId)) throw verificationError("Pick your school from the list.");
  const clean = cleanAnswers(answers);
  const sign = cleanSignature(signature);
  return run(client.rpc("oatccc_submit_signed", {
    p_season: seasonId,
    p_school: schoolId,
    p_answers: clean,
    p_typed_name: sign.typedName,
    p_signature_png: sign.png,
    p_form_text_sha256: FORM_TEXT_SHA256
  }).single());
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
