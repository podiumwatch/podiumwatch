// Recruiting Activity Tips: the public, no-login entry point that lets an
// athlete, coach, or fan report interest/offers/visits/commitments/signings
// for Podium Watch to review -- matching the same "held for review, never
// public on its own" pattern already used by public results submissions
// (lib/result_ingestion_engine.mjs's createPublicResultsSubmission).
//
// A tip is NOT an athlete_recruiting_activity row. It carries whatever free
// text the submitter typed (name/school, since there's no login and no
// guarantee the athlete already has a profile) and sits in
// recruiting_activity_tips until an admin matches it to a real profile and
// promotes it -- see promoteRecruitingActivityTip() below. Nothing in this
// file ever writes to athlete_recruiting_activity or athlete_profiles
// directly.
import { supabaseAdmin } from "./supabase-admin.mjs";
import {
  cleanAthleteText,
  normalizeAthleteGender
} from "./athlete_foundation_service.mjs";
import { RECRUIT_ACTIVITY_TYPES } from "./recruiting_service.mjs";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUBMITTER_ROLES = new Set(["athlete", "coach", "family", "fan", "other"]);
const TIP_DAILY_LIMIT = 20;

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

// --- public entry point: anyone reporting a tip, no account needed --------

export async function submitRecruitingActivityTip(input) {
  // Honeypot: a field real submitters never see or fill in. Report success
  // without doing any real work, so a bot gets no signal it was caught --
  // exact same convention as createPublicResultsSubmission's own honeypot.
  if (cleanAthleteText(input.website, 200)) {
    return { accepted: true, tip_id: null };
  }

  const athleteName = cleanAthleteText(input.athleteName, 200);
  const schoolName = cleanAthleteText(input.schoolName, 200);
  const activityType = cleanAthleteText(input.activityType, 60).toLowerCase();
  const collegeName = cleanAthleteText(input.collegeName, 250);
  const submitterName = cleanAthleteText(input.submitterName, 200);
  const submitterEmail = cleanAthleteText(input.submitterEmail, 320).toLowerCase();
  const submitterRole = cleanAthleteText(input.submitterRole, 30).toLowerCase();
  const graduationYear = Number(input.graduationYear) || null;
  const gender = input.gender ? normalizeAthleteGender(input.gender) : null;

  if (!athleteName) fail("The athlete's name is required.");
  if (!schoolName) fail("The athlete's school is required, so we can find the right profile.");
  if (!RECRUIT_ACTIVITY_TYPES.has(activityType)) fail("Choose a valid recruiting activity type.");
  if (!collegeName) fail("The college name is required.");
  if (!submitterName) fail("Your name is required, so we can follow up with any questions.");
  if (!EMAIL_PATTERN.test(submitterEmail)) fail("A valid email address is required, so we can follow up with any questions.");
  if (graduationYear && (graduationYear < 2000 || graduationYear > 2200)) fail("Graduation year is not valid.");

  // The caller (the public API route) hashes the submitter's address
  // before this ever sees it, matching createPublicResultsSubmission's
  // exact pattern -- rate limits without retaining anyone's raw IP.
  const ipHash = cleanAthleteText(input.ipHash, 100);
  if (ipHash) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabaseAdmin
      .from("recruiting_activity_tips")
      .select("id", { count: "exact", head: true })
      .eq("submitter_ip_hash", ipHash)
      .gte("created_at", since);
    if (countError) throw countError;
    if ((count || 0) >= TIP_DAILY_LIMIT) {
      fail("Too many submissions from this connection in the last day. Please try again tomorrow, or contact us directly if this is a mistake.", 429, "RATE_LIMITED");
    }
  }

  const { data, error } = await supabaseAdmin
    .from("recruiting_activity_tips")
    .insert({
      submitted_athlete_name: athleteName,
      submitted_school_name: schoolName,
      submitted_graduation_year: graduationYear,
      submitted_gender: gender && gender !== "unspecified" ? gender : null,
      activity_type: activityType,
      college_name: collegeName,
      college_division: cleanAthleteText(input.collegeDivision, 100) || null,
      activity_date: cleanDate(input.activityDate),
      notes: cleanAthleteText(input.notes, 2000) || null,
      source_url: cleanUrl(input.sourceUrl),
      submitter_name: submitterName,
      submitter_email: submitterEmail,
      submitter_role: SUBMITTER_ROLES.has(submitterRole) ? submitterRole : null,
      submitter_ip_hash: ipHash || null,
      status: "pending"
    })
    .select("id")
    .single();

  if (error) throw error;

  return { accepted: true, tip_id: data.id };
}

// --- admin: review queue ----------------------------------------------------

export async function listRecruitingActivityTips({ status = "pending" } = {}) {
  let query = supabaseAdmin
    .from("recruiting_activity_tips")
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

export async function rejectRecruitingActivityTip({ tipId, status = "rejected", note = "", actor = "Podium Watch Admin" }) {
  const cleanedId = cleanAthleteText(tipId, 100);
  if (!cleanedId) fail("Choose a tip.");
  if (!["rejected", "spam"].includes(status)) fail("Invalid tip resolution status.");

  const { data, error } = await supabaseAdmin
    .from("recruiting_activity_tips")
    .update({
      status,
      review_note: cleanAthleteText(note, 2000) || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: actor
    })
    .eq("id", cleanedId)
    .in("status", ["pending"])
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) fail("This tip has already been reviewed.", 409);
  return data;
}

// Called by api/admin/recruiting.js's saveActivity() once the resulting
// athlete_recruiting_activity row is actually created -- this file never
// writes that table itself, so a tip can only ever be marked "promoted"
// alongside a real activity record actually existing, never on its own.
export async function markRecruitingActivityTipPromoted({ tipId, profileId, activityId, actor = "Podium Watch Admin" }) {
  const cleanedId = cleanAthleteText(tipId, 100);
  if (!cleanedId) return null;

  const { data, error } = await supabaseAdmin
    .from("recruiting_activity_tips")
    .update({
      status: "promoted",
      resolved_profile_id: profileId,
      promoted_activity_id: activityId,
      reviewed_at: new Date().toISOString(),
      reviewed_by: actor
    })
    .eq("id", cleanedId)
    .in("status", ["pending"])
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data;
}
