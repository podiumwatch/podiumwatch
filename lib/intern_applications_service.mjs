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
import { sendResendEmail, escapeHtml } from "./engagement_service.mjs";
import { provisionWriterAccountForWelcome } from "./writer_portal_service.mjs";

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

// --- admin: welcome email for accepted applicants ---------------------------
//
// A separate, deliberate step from "accepted" above -- accepting an
// application never sends anything on its own. This is the one place that
// actually emails an applicant: a single message that welcomes them,
// explains the program and its rules, and hands them their real Writer
// Portal account setup link (via provisionWriterAccountForWelcome, which
// creates the account without Supabase's own separate default invite email
// firing, so this custom email is the only thing that goes out).

const PODIUM_WATCH_LOGO_URL = "https://podiumwatch.site/images/branding/podium_watch_logo_light.png";
const WRITER_LOGIN_URL = "https://podiumwatch.site/writer-login/";

function firstNameOf(fullName) {
  return String(fullName || "").trim().split(/\s+/)[0] || "there";
}

function buildInternWelcomeEmail({ fullName, actionLink, existingAccount }) {
  const first = escapeHtml(firstNameOf(fullName));
  const ctaUrl = actionLink || WRITER_LOGIN_URL;
  const ctaLabel = existingAccount ? "Sign in to the Writer Portal" : "Set up your account";

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f6f4ee;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f4ee;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;">

<tr><td style="background:#090909;padding:28px 32px;text-align:center;">
<img src="${PODIUM_WATCH_LOGO_URL}" width="56" height="56" alt="Podium Watch" style="display:block;margin:0 auto 10px;">
<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;letter-spacing:.12em;color:#ffffff;">
PODIUM <span style="color:#0faf68;">WATCH</span>
</div>
</td></tr>

<tr><td style="height:4px;background:#0faf68;font-size:0;line-height:0;">&nbsp;</td></tr>

<tr><td style="padding:36px 32px 8px;font-family:Arial,Helvetica,sans-serif;">
<p style="margin:0 0 20px;font-size:22px;font-weight:bold;color:#171717;">Welcome to Podium Watch, ${first}!</p>

<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#171717;">
Congratulations, you've been selected as a Podium Watch intern! We really liked your application and we're excited to have you covering Ohio high school running with us this season.
</p>

<p style="margin:24px 0 8px;font-size:12px;font-weight:bold;letter-spacing:.08em;color:#0faf68;text-transform:uppercase;">How it works</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#171717;">
Once you set up your account below, you'll have access to the Writer Portal. That's where you'll do all your writing, from your first draft to the finished piece. Check the Editorial Calendar for story ideas you can claim, or bring your own idea to an editor. When you're ready to write, the portal saves your work automatically, so you can step away and pick it back up anytime. Submit your draft when it's done, and an editor will read it over before anything goes on the site. Sometimes we'll ask for a revision, and you'll see our notes right in the portal. Once a piece is approved, we publish it with your byline for everyone to see.
</p>

<p style="margin:24px 0 8px;font-size:12px;font-weight:bold;letter-spacing:.08em;color:#0faf68;text-transform:uppercase;">A few rules to keep in mind</p>
<ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.7;color:#171717;">
<li>Every article gets reviewed before it's published. Nothing goes live without an editor reading it first.</li>
<li>Write your own work. Don't copy other outlets, and always credit your sources and quotes.</li>
<li>Get your facts right. Double check names, times, and places before you submit.</li>
<li>Cover athletes, coaches, and teams fairly and respectfully, no matter what school they're from.</li>
<li>Hit your deadlines. If you can't, tell us as soon as you know.</li>
<li>Check the portal regularly and respond to editor feedback when you get it.</li>
<li>Keep drafts and anything from the review side of the portal to yourself until it's actually published.</li>
</ul>

<p style="margin:24px 0 8px;font-size:12px;font-weight:bold;letter-spacing:.08em;color:#0faf68;text-transform:uppercase;">On AI</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#171717;">
We're not banning it. Tools like ChatGPT can be genuinely useful for brainstorming an angle or cleaning up a sentence. But they can't replace you. The reporting, the voice, and the words need to be yours. If a piece reads like it was written entirely by AI, we'll ask you to rewrite it.
</p>

<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
<tr><td style="background:#0faf68;">
<a href="${ctaUrl}" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">${ctaLabel} &rarr;</a>
</td></tr>
</table>

<p style="margin:0 0 4px;font-size:15px;line-height:1.6;color:#171717;">Questions? Just reply to this email.</p>
<p style="margin:24px 0 0;font-size:15px;line-height:1.6;color:#171717;">Welcome aboard,<br>The Podium Watch Team</p>
</td></tr>

<tr><td style="padding:24px 32px;border-top:1px solid #dedede;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#626262;">
Podium Watch &middot; Ohio high school running, all in one place.
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  const text = `Welcome to Podium Watch, ${firstNameOf(fullName)}!

Congratulations, you've been selected as a Podium Watch intern! We really liked your application and we're excited to have you covering Ohio high school running with us this season.

HOW IT WORKS
Once you set up your account, you'll have access to the Writer Portal. That's where you'll do all your writing, from your first draft to the finished piece. Check the Editorial Calendar for story ideas you can claim, or bring your own idea to an editor. When you're ready to write, the portal saves your work automatically, so you can step away and pick it back up anytime. Submit your draft when it's done, and an editor will read it over before anything goes on the site. Sometimes we'll ask for a revision, and you'll see our notes right in the portal. Once a piece is approved, we publish it with your byline for everyone to see.

A FEW RULES TO KEEP IN MIND
- Every article gets reviewed before it's published. Nothing goes live without an editor reading it first.
- Write your own work. Don't copy other outlets, and always credit your sources and quotes.
- Get your facts right. Double check names, times, and places before you submit.
- Cover athletes, coaches, and teams fairly and respectfully, no matter what school they're from.
- Hit your deadlines. If you can't, tell us as soon as you know.
- Check the portal regularly and respond to editor feedback when you get it.
- Keep drafts and anything from the review side of the portal to yourself until it's actually published.

ON AI
We're not banning it. Tools like ChatGPT can be genuinely useful for brainstorming an angle or cleaning up a sentence. But they can't replace you. The reporting, the voice, and the words need to be yours. If a piece reads like it was written entirely by AI, we'll ask you to rewrite it.

${ctaLabel}: ${ctaUrl}

Questions? Just reply to this email.

Welcome aboard,
The Podium Watch Team

Podium Watch -- Ohio high school running, all in one place.`;

  return { subject: `Welcome to Podium Watch, ${firstNameOf(fullName)}!`, html, text };
}

export async function sendInternWelcomeTestEmail({ toEmail, actor = "Podium Watch Admin" }) {
  const cleanedTo = cleanAthleteText(toEmail, 320).toLowerCase();
  if (!EMAIL_PATTERN.test(cleanedTo)) fail("A valid email address is required.");

  const { subject, html, text } = buildInternWelcomeEmail({
    fullName: "Test Intern",
    actionLink: null,
    existingAccount: false
  });

  await sendResendEmail({
    to: cleanedTo,
    subject: `[TEST] ${subject}`,
    html,
    text
  });

  return { sent: true, to: cleanedTo };
}

export async function listInternsPendingWelcome() {
  const { data, error } = await supabaseAdmin
    .from("intern_applications")
    .select("id, full_name, email")
    .eq("status", "accepted")
    .is("welcomed_at", null)
    .order("reviewed_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function sendInternWelcomeEmails({ actor = "Podium Watch Admin" } = {}) {
  const pending = await listInternsPendingWelcome();
  const sent = [];
  const failed = [];

  // Sequential, not Promise.all -- these hit Supabase Auth's admin API
  // (rate-limited, confirmed earlier this session) and a real email
  // provider per recipient; a slow/failed one should never take the rest
  // of the batch down with it.
  for (const applicant of pending) {
    try {
      const account = await provisionWriterAccountForWelcome({
        email: applicant.email,
        fullName: applicant.full_name
      });

      const { subject, html, text } = buildInternWelcomeEmail({
        fullName: applicant.full_name,
        actionLink: account.actionLink,
        existingAccount: account.existingAccount
      });

      await sendResendEmail({
        to: applicant.email,
        subject,
        html,
        text,
        idempotencyKey: `intern-welcome-${applicant.id}`
      });

      const { error: updateError } = await supabaseAdmin
        .from("intern_applications")
        .update({ welcomed_at: new Date().toISOString() })
        .eq("id", applicant.id);
      if (updateError) throw updateError;

      sent.push({ id: applicant.id, email: applicant.email });
    } catch (error) {
      failed.push({ id: applicant.id, email: applicant.email, error: error.message || "Unknown error" });
    }
  }

  return { sent, failed, total: pending.length };
}
