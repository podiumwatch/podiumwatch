// Intern Writer Applications: the public, no-login entry point at /apply/
// where a high school student can apply to write for Podium Watch --
// matches the same "held for review, never public on its own" pattern
// already used by every other public submission on this site
// (createPublicResultsSubmission, recruiting_activity_tips,
// timing_submissions). A submission here is never auto-accepted; it sits
// in intern_applications until an admin reviews it by hand in the
// Operations Center and follows up directly with the applicant (and their
// parent/guardian) by email.
import { supabaseAdmin } from "./supabase-admin.mjs";
import { cleanAthleteText } from "./athlete_foundation_service.mjs";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const APPLICATION_DAILY_LIMIT = 5;

// Fixed allowlists, not free text -- keeps the review queue consistent and
// matches exactly what the public form's own dropdown/checkboxes offer.
const GRADE_OPTIONS = new Set(["9th grade", "10th grade", "11th grade", "12th grade"]);
const COVERAGE_OPTIONS = new Set([
  "My own school",
  "A specific region/division",
  "Rankings & polls commentary",
  "Feature stories / profiles",
  "Recruiting coverage"
]);

function fail(message, status = 400, code = "") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  throw error;
}

function cleanCoverageInterests(value) {
  const list = Array.isArray(value) ? value : [value].filter(Boolean);
  const cleaned = list
    .map((item) => cleanAthleteText(item, 60))
    .filter((item) => COVERAGE_OPTIONS.has(item));
  return [...new Set(cleaned)];
}

// --- public entry point: a student applying, no account needed -----------

export async function submitInternApplication(input) {
  // Honeypot: a field real applicants never see or fill in. Report success
  // without doing any real work, so a bot gets no signal it was caught --
  // exact same convention as every other public submission on this site.
  if (cleanAthleteText(input.website, 200)) {
    return { accepted: true, application_id: null };
  }

  const fullName = cleanAthleteText(input.fullName, 200);
  const email = cleanAthleteText(input.email, 320).toLowerCase();
  const phone = cleanAthleteText(input.phone, 40) || null;
  const school = cleanAthleteText(input.school, 200);
  const grade = cleanAthleteText(input.grade, 20);
  const parentName = cleanAthleteText(input.parentName, 200);
  const parentEmail = cleanAthleteText(input.parentEmail, 320).toLowerCase();
  const parentConsent = Boolean(input.parentConsent);
  const coverageInterests = cleanCoverageInterests(input.coverageInterests);
  const availability = cleanAthleteText(input.availability, 300) || null;
  const whyInterested = cleanAthleteText(input.whyInterested, 3000);
  const writingSample = cleanAthleteText(input.writingSample, 8000);
  const portfolioLink = cleanUrl(input.portfolioLink);

  if (!fullName) fail("Full name is required.");
  if (!EMAIL_PATTERN.test(email)) fail("A valid email address is required.");
  if (!school) fail("School is required.");
  if (!GRADE_OPTIONS.has(grade)) fail("Choose a valid grade.");
  // Applicants are minors -- required and re-checked here regardless of
  // what the public form itself enforces client-side.
  if (!parentName) fail("Parent/guardian name is required.");
  if (!EMAIL_PATTERN.test(parentEmail)) fail("A valid parent/guardian email address is required.");
  if (!parentConsent) fail("Parent/guardian consent is required.");
  if (!whyInterested) fail("Please tell us why you want to write for Podium Watch.");
  if (writingSample.length < 50) fail("Writing sample must be at least a few sentences.");

  const ipHash = cleanAthleteText(input.ipHash, 100);
  if (ipHash) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabaseAdmin
      .from("intern_applications")
      .select("id", { count: "exact", head: true })
      .eq("submitter_ip_hash", ipHash)
      .gte("created_at", since);
    if (countError) throw countError;
    if ((count || 0) >= APPLICATION_DAILY_LIMIT) {
      fail("Too many applications from this connection in the last day. Please try again tomorrow, or contact Podium Watch directly if this is a mistake.", 429, "RATE_LIMITED");
    }
  }

  const { data, error } = await supabaseAdmin
    .from("intern_applications")
    .insert({
      full_name: fullName,
      email,
      phone,
      school,
      grade,
      parent_name: parentName,
      parent_email: parentEmail,
      parent_consent: parentConsent,
      coverage_interests: coverageInterests,
      availability,
      why_interested: whyInterested,
      writing_sample: writingSample,
      portfolio_link: portfolioLink,
      submitter_ip_hash: ipHash || null,
      status: "pending"
    })
    .select("id")
    .single();

  if (error) throw error;

  return { accepted: true, application_id: data.id };
}

function cleanUrl(value) {
  const cleaned = cleanAthleteText(value, 2000);
  if (!cleaned) return null;
  try {
    const prepared = /^[a-z][a-z0-9+.-]*:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
    const url = new URL(prepared);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

// --- admin: review queue ----------------------------------------------------

export async function listInternApplications({ status = "pending" } = {}) {
  let query = supabaseAdmin
    .from("intern_applications")
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

export async function reviewInternApplication({ applicationId, status, note = "", actor = "Podium Watch Admin" }) {
  const cleanedId = cleanAthleteText(applicationId, 100);
  if (!cleanedId) fail("Choose an application.");
  if (!["reviewed", "accepted", "rejected"].includes(status)) fail("Invalid application review status.");

  const { data, error } = await supabaseAdmin
    .from("intern_applications")
    .update({
      status,
      review_note: cleanAthleteText(note, 2000) || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: actor
    })
    .eq("id", cleanedId)
    .neq("status", status)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) fail("This application is already in that state.", 409);
  return data;
}
