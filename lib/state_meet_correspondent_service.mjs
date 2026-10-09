// State Meet Media Correspondent Applications: the public, no-login entry
// point at /apply/state-meet-correspondent/ where someone can apply for
// the paid Podium Watch State Meet Media Correspondent role covering the
// 2026 OHSAA State Cross Country Championships -- matches the same "held
// for review, never public on its own" pattern already used by every
// other public submission on this site (submitInternApplication,
// recruiting_activity_tips, timing_submissions). A submission here is
// never auto-accepted and never an OHSAA media credential -- an admin
// reviews it by hand in the Operations Center, and Podium Watch submits
// only the person it selects through OHSAA's own credential process.
import { supabaseAdmin } from "./supabase-admin.mjs";
import { cleanAthleteText } from "./athlete_foundation_service.mjs";
import { sendResendEmail, escapeHtml } from "./engagement_service.mjs";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const APPLICATION_DAILY_LIMIT = 5;
const NOTIFY_EMAIL = "podiumwatchohio@gmail.com";

const COLLEGE_YEAR_OPTIONS = new Set([
  "Freshman",
  "Sophomore",
  "Junior",
  "Senior",
  "Graduate Student",
  "Other"
]);

const FAMILIARITY_OPTIONS = new Set([
  "Very familiar",
  "Somewhat familiar",
  "A little familiar",
  "Not familiar yet"
]);

const STATUS_OPTIONS = new Set([
  "new",
  "reviewing",
  "contacted",
  "interview",
  "selected",
  "declined"
]);

function fail(message, status = 400, code = "") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  throw error;
}

function cleanBoolean(value) {
  return value === true || value === "true" || value === "on" || value === "yes";
}

// A real-looking domain (labels of letters/digits/hyphens, at least one
// dot) or "localhost" -- the WHATWG URL constructor on its own is far
// looser than this (it accepts hosts like "ht!tp" with no dot at all,
// confirmed directly), so it's not enough by itself to catch a typo'd or
// garbage link.
const HOSTNAME_PATTERN = /^(localhost|([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63})$/i;

function cleanUrl(value) {
  const cleaned = cleanAthleteText(value, 2000);
  if (!cleaned) return null;
  try {
    const prepared = /^[a-z][a-z0-9+.-]*:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
    const url = new URL(prepared);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (!HOSTNAME_PATTERN.test(url.hostname)) return null;
    return url.href;
  } catch {
    return null;
  }
}

// Notifies podiumwatchohio@gmail.com of every new application, by name --
// a fixed recipient rather than a configurable setting, since this is the
// one inbox that reviews this one specific role. Deliberately a short,
// plain-text-style email (not a branded HTML template like the intern
// welcome email) since this is an internal heads-up to the site owner,
// not applicant-facing communication.
async function notifyNewApplication({ firstName, lastName, email, phone, college, major, collegeYear }) {
  const name = `${firstName} ${lastName}`;
  const adminUrl = "https://www.podiumwatch.site/admin/operations/";

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f6f4ee;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f4ee;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;">
<tr><td style="background:#090909;padding:20px 28px;">
<span style="color:#ffffff;font-size:13px;letter-spacing:.1em;">PODIUM <span style="color:#0faf68;">WATCH</span></span>
</td></tr>
<tr><td style="height:4px;background:#0faf68;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:28px;">
<p style="margin:0 0 16px;font-size:18px;font-weight:bold;color:#171717;">New State Meet Correspondent application</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#171717;">
<strong>${escapeHtml(name)}</strong><br>
${escapeHtml(email)}<br>
${escapeHtml(phone)}
</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#171717;">
${escapeHtml(college)} &middot; ${escapeHtml(major)} &middot; ${escapeHtml(collegeYear)}
</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#0faf68;">
<a href="${adminUrl}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;">Review in the Operations Center &rarr;</a>
</td></tr></table>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = `New State Meet Correspondent application

${name}
${email}
${phone}

${college} - ${major} - ${collegeYear}

Review it here: ${adminUrl}`;

  await sendResendEmail({
    to: NOTIFY_EMAIL,
    subject: `New State Meet Correspondent application: ${name}`,
    html,
    text
  });
}

// --- public entry point: no account needed --------------------------------

export async function submitStateMeetCorrespondentApplication(input) {
  // Honeypot: a field real applicants never see or fill in. Report success
  // without doing any real work, so a bot gets no signal it was caught --
  // exact same convention as every other public submission on this site.
  if (cleanAthleteText(input.website, 200)) {
    return { accepted: true, application_id: null };
  }

  const firstName = cleanAthleteText(input.firstName, 100);
  const lastName = cleanAthleteText(input.lastName, 100);
  const email = cleanAthleteText(input.email, 320).toLowerCase();
  const phone = cleanAthleteText(input.phone, 40);
  const college = cleanAthleteText(input.college, 200);
  const major = cleanAthleteText(input.major, 200);
  const collegeYear = cleanAthleteText(input.collegeYear, 40);

  const is18OrOlder = cleanBoolean(input.is18OrOlder);
  const availableNov7 = cleanBoolean(input.availableNov7);
  const availableFullDay = cleanBoolean(input.availableFullDay);

  const interestReason = cleanAthleteText(input.interestReason, 3000);
  const experience = cleanAthleteText(input.experience, 3000) || null;

  const comfortableInterviewing = cleanBoolean(input.comfortableInterviewing);
  const comfortableVideo = cleanBoolean(input.comfortableVideo);
  const xcTrackFamiliarity = cleanAthleteText(input.xcTrackFamiliarity, 40);

  // Unlike a few older public forms on this site that quietly drop a
  // malformed optional URL to null, this one rejects it explicitly --
  // the applicant typed something into a link field and almost certainly
  // meant it to go somewhere real, so silently discarding it would hide a
  // mistake rather than catch it.
  function requireValidOptionalUrl(rawValue, label) {
    const raw = cleanAthleteText(rawValue, 2000);
    if (!raw) return null;
    const cleaned = cleanUrl(rawValue);
    if (!cleaned) fail(`Enter a valid ${label} URL, or leave it blank.`);
    return cleaned;
  }

  const portfolioUrl = requireValidOptionalUrl(input.portfolioUrl, "portfolio");
  const linkedinUrl = requireValidOptionalUrl(input.linkedinUrl, "LinkedIn");
  const socialHandle = cleanAthleteText(input.socialHandle, 200) || null;
  const videoUrl = requireValidOptionalUrl(input.videoUrl, "video");
  const otherUrl = requireValidOptionalUrl(input.otherUrl, "other link");
  const additionalNotes = cleanAthleteText(input.additionalNotes, 3000) || null;

  const credentialAcknowledgement = cleanBoolean(input.credentialAcknowledgement);

  if (!firstName) fail("First name is required.");
  if (!lastName) fail("Last name is required.");
  if (!EMAIL_PATTERN.test(email)) fail("A valid email address is required.");
  if (!phone) fail("Phone number is required.");
  if (!college) fail("College or university is required.");
  if (!major) fail("Major or area of study is required.");
  if (!COLLEGE_YEAR_OPTIONS.has(collegeYear)) fail("Choose a valid current year in college.");
  if (typeof input.is18OrOlder === "undefined") fail("Please confirm whether you are at least 18 years old.");
  if (!is18OrOlder) fail("You must be at least 18 years old to apply for this role.");
  if (typeof input.availableNov7 === "undefined") fail("Please confirm your availability for November 7.");
  if (!availableNov7) fail("This role requires availability on Saturday, November 7, 2026 at Fortress Obetz.");
  if (typeof input.availableFullDay === "undefined") fail("Please confirm your availability for the full event.");
  if (!availableFullDay) fail("This role requires availability for most or all of the event, morning through final awards.");
  if (!interestReason) fail("Please tell us why you're interested in this opportunity.");
  if (typeof input.comfortableInterviewing === "undefined") fail("Please confirm whether you're comfortable approaching athletes and coaches for interviews.");
  if (typeof input.comfortableVideo === "undefined") fail("Please confirm whether you're comfortable recording vertical video interviews.");
  if (!FAMILIARITY_OPTIONS.has(xcTrackFamiliarity)) fail("Choose a valid cross country and track and field familiarity level.");
  if (!credentialAcknowledgement) fail("You must acknowledge that submitting this application does not guarantee selection or an OHSAA media credential.");

  const ipHash = cleanAthleteText(input.ipHash, 100);
  if (ipHash) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabaseAdmin
      .from("state_meet_correspondent_applications")
      .select("id", { count: "exact", head: true })
      .eq("submitter_ip_hash", ipHash)
      .gte("created_at", since);
    if (countError) throw countError;
    if ((count || 0) >= APPLICATION_DAILY_LIMIT) {
      fail("Too many applications from this connection in the last day. Please try again tomorrow, or contact Podium Watch directly if this is a mistake.", 429, "RATE_LIMITED");
    }
  }

  const { data, error } = await supabaseAdmin
    .from("state_meet_correspondent_applications")
    .insert({
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      college,
      major,
      college_year: collegeYear,
      is_18_or_older: is18OrOlder,
      available_nov_7: availableNov7,
      available_full_day: availableFullDay,
      interest_reason: interestReason,
      experience,
      comfortable_interviewing: comfortableInterviewing,
      comfortable_video: comfortableVideo,
      xc_track_familiarity: xcTrackFamiliarity,
      portfolio_url: portfolioUrl,
      linkedin_url: linkedinUrl,
      social_handle: socialHandle,
      video_url: videoUrl,
      other_url: otherUrl,
      additional_notes: additionalNotes,
      credential_acknowledgement: credentialAcknowledgement,
      submitter_ip_hash: ipHash || null,
      status: "new"
    })
    .select("id")
    .single();

  if (error) throw error;

  // Fire-and-forget, same as every other secondary side effect on this
  // site (view-count increments, orphaned-image cleanup): a notification
  // email is never allowed to fail or slow down the applicant's own
  // submission, which has already fully succeeded by this point. If
  // Resend isn't configured, sendResendEmail() throws immediately --
  // caught here and logged, nothing more.
  notifyNewApplication({
    firstName,
    lastName,
    email,
    phone,
    college,
    major,
    collegeYear
  }).catch((notifyError) => {
    console.error("State meet correspondent notification email failed:", notifyError);
  });

  return { accepted: true, application_id: data.id };
}

// --- admin: review queue ----------------------------------------------------

export async function listStateMeetCorrespondentApplications({ status = "new" } = {}) {
  let query = supabaseAdmin
    .from("state_meet_correspondent_applications")
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

export async function reviewStateMeetCorrespondentApplication({ applicationId, status, note = "", actor = "Podium Watch Admin" }) {
  const cleanedId = cleanAthleteText(applicationId, 100);
  if (!cleanedId) fail("Choose an application.");
  if (!STATUS_OPTIONS.has(status)) fail("Invalid application status.");

  const { data, error } = await supabaseAdmin
    .from("state_meet_correspondent_applications")
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
