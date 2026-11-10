import { supabaseAdmin } from "./supabase-admin.mjs";
import { writeTeamChange } from "./team_audit.mjs";
import { escapeHtml, getSiteUrl, sendResendEmail } from "./engagement_service.mjs";

// 2026-11-09: submissions now wait for admin approval
// (team_instagram_requests, install/81) because the automatic account
// check below can't work from Vercel. The original design notes follow.
//
// This feature was originally different from every other public
// submission in this project: it went live immediately, with no
// hidden-until-approved review step. That is only safe because every
// submission passes real automated validation first (format, a basic
// blocklist, and confirmation the handle is a real Instagram account), is
// rate limited per team per address, and every change -- including who
// (or what hashed address) made it -- is fully logged in the existing
// public.team_change_log table and instantly revertible. See
// docs/DECISIONS.md, 2026-08-06.

const RATE_LIMIT_HOURS = 4;

// WO-44: a school can list several accounts, each with one of these labels.
export const INSTAGRAM_LABELS = ["Boys XC", "Girls XC", "XC & Track", "Boys Track", "Girls Track", "Athletics"];
export function normalizeInstagramLabel(value) {
  const text = String(value ?? "").trim().toLowerCase().replace(/\s+and\s+/g, " & ").replace(/\s+/g, " ");
  const aliases = { "boys cross country": "Boys XC", "girls cross country": "Girls XC", "xc/track": "XC & Track", "xc & tf": "XC & Track", "cross country & track": "XC & Track", "boys track & field": "Boys Track", "girls track & field": "Girls Track", "athletic department": "Athletics" };
  return INSTAGRAM_LABELS.find((label) => label.toLowerCase() === text) || aliases[text] || null;
}
export const isInstagramLink = (link) => /instagram/i.test(String(link?.platform || "")) || /instagram\.com\//i.test(String(link?.url || ""));
export const handleFromUrl = (url) => (String(url || "").match(/instagram\.com\/([A-Za-z0-9._]{1,30})/i) || [])[1]?.toLowerCase() || null;
const cleanEmail = (value) => { const text = clean(value, 320).toLowerCase(); return text && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? text : null; };
const ACTION_SUBMIT = "public_instagram_submission";
const ACTION_REVERT = "admin_instagram_revert";

function error(message, status = 400, code = "TEAM_INSTAGRAM_ERROR") {
  const value = new Error(message);
  value.status = status;
  value.code = code;
  return value;
}

function clean(value, max = 500) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

// Accepts a bare handle, an "@handle", or a pasted profile URL
// (instagram.com/handle, with or without scheme, www, or trailing slash),
// and returns just the lowercase handle. Instagram handle matching is not
// case sensitive.
export function normalizeInstagramHandle(value) {
  let text = clean(value, 300);
  if (!text) return "";
  text = text.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  if (/^instagram\.com\//i.test(text)) text = text.slice("instagram.com/".length);
  text = text.split(/[?#]/)[0];
  text = text.replace(/\/+$/, "");
  text = text.replace(/^@/, "");
  return text.toLowerCase();
}

// Real Instagram username rules: 1-30 characters, letters, numbers, periods,
// and underscores only, never starting or ending with a period, and never
// two periods in a row.
export function isValidHandleFormat(handle) {
  if (!handle || handle.length > 30) return false;
  if (!/^[a-z0-9._]+$/i.test(handle)) return false;
  if (handle.startsWith(".") || handle.endsWith(".")) return false;
  if (handle.includes("..")) return false;
  return true;
}

// A basic blocklist, not an exhaustive profanity filter: obvious slurs,
// explicit-content and scam/spam keywords, and repeated-character spam
// patterns. Rejections are reported to the submitter as one generic
// message (see submitTeamInstagramHandle) so this list is never confirmed
// or narrowed down by trial and error.
const BLOCKED_SUBSTRINGS = [
  "nigger", "nigga", "faggot", "retard", "kike", "spic", "chink",
  "porn", "pornhub", "xxx", "sex", "nude", "nudes", "onlyfans", "escort",
  "viagra", "cialis", "casino", "bet365", "forex", "crypto", "bitcoin",
  "loan", "payday", "rolex", "replica"
];

export function isBlockedHandle(handle) {
  const lower = handle.toLowerCase();
  if (BLOCKED_SUBSTRINGS.some((word) => lower.includes(word))) return true;
  // Five or more of the same character in a row (aaaaaaa, 111111) is not a
  // real handle pattern seen on legitimate accounts and is a common bot
  // signature.
  if (/(.)\1{4,}/.test(lower)) return true;
  return false;
}

// Confirms the handle is a real, existing Instagram account before it is
// ever accepted. Instagram's profile page is a JavaScript application and
// returns HTTP 200 for both real and nonexistent handles, so status code
// alone cannot tell them apart -- verified live 2026-08-06 against several
// known-real accounts and several made-up ones. The page's <title> tag is
// still rendered server side (Instagram needs it for search engines and
// link previews) and reliably differs: a real account's title names the
// account ("Name (@handle) • Instagram photos and videos"); a nonexistent
// one is just the bare site title "Instagram". That difference, not the
// HTTP status, is the actual signal used here.
export async function checkInstagramAccountExists(handle, { timeoutMs = 8000, fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`https://www.instagram.com/${encodeURIComponent(handle)}/`, {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) PodiumWatch/1.0"
      },
      redirect: "follow",
      signal: controller.signal
    });

    if (!response.ok) return false;

    const html = await response.text();
    const title = clean((html.match(/<title>([^<]*)<\/title>/i) || [])[1] || "", 300);
    return Boolean(title) && title.toLowerCase() !== "instagram";
  } catch {
    // A network failure or timeout is treated the same as "does not
    // resolve": this feature never accepts a handle it could not actually
    // confirm exists, even if the reason is Instagram being unreachable.
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function loadTeam(teamId) {
  const { data, error: dbError } = await supabaseAdmin
    .from("team_pages")
    .select("id, school_name, slug, instagram_handle, instagram_handle_updated_at")
    .eq("id", teamId)
    .maybeSingle();
  if (dbError) throw dbError;
  if (!data) throw error("Team not found.", 404, "TEAM_NOT_FOUND");
  return data;
}

// The public submission path (changed 2026-11-09): validate format and
// the blocklist, rate limit, then queue the handle for admin review in
// public.team_instagram_requests (install/81). Nothing goes live until an
// admin approves it. The old "is this a real account?" check is no longer
// called: Instagram serves Vercel a login wall, so it rejected every real
// account and no submission ever saved (2026-11-09 audit: @archboldxctf,
// @miamisburgxc). Every rejection reason below is safe to show a real
// submitter (they describe the rule, not which pattern tripped the
// blocklist).
export async function submitTeamInstagramHandle({ teamId, handleInput, label: labelInput, email, actorIdHash, source = "public" }) {
  await loadTeam(teamId);
  const handle = normalizeInstagramHandle(handleInput);
  const label = normalizeInstagramLabel(labelInput);

  if (!handle) throw error("Enter an Instagram handle.");
  if (!isValidHandleFormat(handle)) throw error("That doesn't look like a valid Instagram handle. Use only letters, numbers, periods, and underscores.");
  // Deliberately the same generic message a real formatting mistake would
  // get, so a bad-faith submitter can't learn what tripped the filter.
  if (isBlockedHandle(handle)) throw error("That handle could not be accepted. Double-check it and try again.");
  if (!label) throw error(`Choose which account this is: ${INSTAGRAM_LABELS.join(", ")}.`);
  if (email && !cleanEmail(email)) throw error("That email address doesn't look right. It's optional; leave it blank if you like.");
  if (source === "public" && !actorIdHash) throw error("This submission could not be verified. Please try again.", 400, "MISSING_ACTOR");

  // Already approved on this team (any label): nothing to do.
  const { data: links, error: linksError } = await supabaseAdmin.from("team_social_links").select("url, platform, label").eq("team_id", teamId);
  if (linksError) throw linksError;
  if ((links || []).some((link) => isInstagramLink(link) && handleFromUrl(link.url) === handle)) return { handle, label, status: "already_listed" };

  // The same handle already waiting for review is one request, not two.
  const { data: waiting, error: waitingError } = await supabaseAdmin
    .from("team_instagram_requests")
    .select("id")
    .eq("team_id", teamId)
    .eq("status", "pending")
    .ilike("handle", handle)
    .limit(1);
  if (waitingError) throw waitingError;
  if (waiting && waiting.length) return { handle, label, status: "pending" };

  if (source === "public" && (await countRecentRequests(teamId, actorIdHash, label)) > 0) {
    throw error(`Only one ${label} submission is accepted per team every ${RATE_LIMIT_HOURS} hours. Please try again later.`, 429, "RATE_LIMITED");
  }

  const { error: insertError } = await supabaseAdmin
    .from("team_instagram_requests")
    .insert({ team_id: teamId, handle, label, submitter_email: cleanEmail(email), source, actor_hash: actorIdHash || null });
  if (insertError) throw insertError;
  return { handle, label, status: "pending" };
}

async function countRecentRequests(teamId, actorId, label = null) {
  const since = new Date(Date.now() - RATE_LIMIT_HOURS * 60 * 60 * 1000).toISOString();
  const { count, error: dbError } = await supabaseAdmin
    .from("team_instagram_requests")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId)
    .eq("actor_hash", actorId)
    .eq("label", label)
    .gte("created_at", since);
  if (dbError) throw dbError;
  return count || 0;
}

// Admin: requests waiting for review, oldest first, with the team's name.
export async function listPendingInstagramRequests({ limit = 200 } = {}) {
  const { data, error: dbError } = await supabaseAdmin
    .from("team_instagram_requests")
    .select("id, created_at, team_id, handle, label, source, previous_handle, team_pages(school_name, slug, city, instagram_handle)")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (dbError) throw dbError;
  return data || [];
}

export async function countPendingInstagramRequests() {
  const { count, error: dbError } = await supabaseAdmin
    .from("team_instagram_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (dbError) throw dbError;
  return count || 0;
}

// WO-44: approving puts the account on the team page with its label. A
// team can have several; the same label is one account (a new handle for
// it replaces the old one), and the same handle under a new label is
// relabeled rather than listed twice.
async function upsertLabeledInstagramLink(teamId, handle, label) {
  const url = `https://www.instagram.com/${handle}/`;
  const { data: links, error: readError } = await supabaseAdmin.from("team_social_links").select("id, url, platform, label, sort_order").eq("team_id", teamId);
  if (readError) throw readError;
  const instagram = (links || []).filter(isInstagramLink);
  const sameHandle = instagram.find((link) => handleFromUrl(link.url) === handle);
  const sameLabel = instagram.find((link) => link.label === label);
  const target = sameHandle || sameLabel;
  const now = new Date().toISOString();
  if (target) {
    const { error: updateError } = await supabaseAdmin.from("team_social_links").update({ url, label, platform: "Instagram", published: true, updated_at: now }).eq("id", target.id);
    if (updateError) throw updateError;
    return { before: { url: target.url, label: target.label }, after: { url, label } };
  }
  const order = INSTAGRAM_LABELS.indexOf(label);
  const sportScope = label.includes("Track") && !label.includes("XC") ? "Track and Field" : label.includes("XC") && !label.includes("Track") ? "Cross Country" : "All";
  const programScope = label.startsWith("Boys") ? "boys" : label.startsWith("Girls") ? "girls" : "combined";
  const { error: insertError } = await supabaseAdmin.from("team_social_links").insert({ team_id: teamId, platform: "Instagram", label, url, sport_scope: sportScope, program_scope: programScope, published: true, sort_order: order < 0 ? 50 : order });
  if (insertError) throw insertError;
  return { before: null, after: { url, label } };
}

// Admin: approve (sets the handle live and logs it like the old flow, so
// history and revert keep working) or reject a pending request.
export async function reviewInstagramRequest({ requestId, decision, adminName = "Podium Watch Admin", note = "", label: labelOverride = null }) {
  if (!["approve", "reject"].includes(decision)) throw error("Choose approve or reject.", 400, "INVALID_DECISION");
  const { data: request, error: requestError } = await supabaseAdmin
    .from("team_instagram_requests")
    .select("id, team_id, handle, label, actor_hash, status")
    .eq("id", String(requestId || "").trim())
    .maybeSingle();
  if (requestError) throw requestError;
  if (!request) throw error("That request could not be found.", 404, "REQUEST_NOT_FOUND");
  if (request.status !== "pending") throw error(`That request was already ${request.status}.`, 409, "ALREADY_REVIEWED");

  const reviewer = clean(adminName, 200) || "Podium Watch Admin";
  const label = normalizeInstagramLabel(labelOverride) || request.label || "XC & Track";
  if (decision === "approve") {
    const team = await loadTeam(request.team_id);
    const change = await upsertLabeledInstagramLink(request.team_id, request.handle, label);
    // The first approved account also fills the team's primary handle.
    if (!team.instagram_handle) {
      const { error: updateError } = await supabaseAdmin.from("team_pages").update({ instagram_handle: request.handle, instagram_handle_updated_at: new Date().toISOString() }).eq("id", request.team_id);
      if (updateError) throw updateError;
    }
    await writeTeamChange({
      teamId: request.team_id,
      actorType: ACTION_SUBMIT,
      actorId: request.actor_hash || "admin",
      action: ACTION_SUBMIT,
      summary: change.before ? `Instagram (${label}) changed from ${change.before.url} to @${request.handle} (approved by ${reviewer}).` : `Instagram (${label}) @${request.handle} added (approved by ${reviewer}).`,
      changedFields: ["social_links"],
      beforeData: change.before,
      afterData: change.after,
      metadata: { request_id: request.id, approved_by: reviewer, label }
    });
  }

  const { error: markError } = await supabaseAdmin
    .from("team_instagram_requests")
    .update({ status: decision === "approve" ? "approved" : "rejected", label, reviewed_at: new Date().toISOString(), reviewed_by: reviewer, review_note: clean(note, 300) || null })
    .eq("id", request.id)
    .eq("status", "pending");
  if (markError) throw markError;
  return { id: request.id, status: decision === "approve" ? "approved" : "rejected", handle: request.handle, label };
}

// Reverts a team's Instagram handle to whatever value a specific change
// log entry recorded *before* that change, and logs the revert itself as
// a new entry -- the history is never edited or deleted, only added to.
export async function revertTeamInstagramChange({ changeLogId, adminName }) {
  const { data: entry, error: entryError } = await supabaseAdmin
    .from("team_change_log")
    .select("id, team_id, before_data, after_data, changed_fields")
    .eq("id", changeLogId)
    .in("actor_type", [ACTION_SUBMIT, ACTION_REVERT])
    .maybeSingle();
  if (entryError) throw entryError;
  if (!entry) throw error("That change could not be found.", 404, "CHANGE_NOT_FOUND");
  if (!Array.isArray(entry.changed_fields) || !entry.changed_fields.includes("instagram_handle")) {
    throw error("That change is not an Instagram change.", 422, "NOT_INSTAGRAM_CHANGE");
  }

  const team = await loadTeam(entry.team_id);
  const revertToHandle = entry.before_data?.instagram_handle ?? null;
  const updatedAt = new Date().toISOString();

  const { error: updateError } = await supabaseAdmin
    .from("team_pages")
    .update({ instagram_handle: revertToHandle, instagram_handle_updated_at: updatedAt })
    .eq("id", entry.team_id);
  if (updateError) throw updateError;

  await writeTeamChange({
    teamId: entry.team_id,
    actorType: ACTION_REVERT,
    actorId: clean(adminName, 200) || "Podium Watch Admin",
    action: ACTION_REVERT,
    summary: revertToHandle
      ? `Instagram handle reverted to @${revertToHandle}, undoing change ${entry.id}.`
      : `Instagram handle cleared, undoing change ${entry.id}.`,
    changedFields: ["instagram_handle"],
    beforeData: { instagram_handle: team.instagram_handle },
    afterData: { instagram_handle: revertToHandle },
    metadata: { reverted_change_id: entry.id }
  });

  return { teamId: entry.team_id, handle: revertToHandle };
}

// The cross-team list the admin review page and the weekly digest both use.
export async function listRecentInstagramChanges({ since = null, limit = 200 } = {}) {
  let query = supabaseAdmin
    .from("team_change_log")
    .select("id, team_id, actor_type, actor_id, summary, before_data, after_data, created_at")
    .in("actor_type", [ACTION_SUBMIT, ACTION_REVERT])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (since) query = query.gte("created_at", since);

  const { data, error: dbError } = await query;
  if (dbError) throw dbError;

  const teamIds = [...new Set((data || []).map((row) => row.team_id).filter(Boolean))];
  const teamsById = new Map();
  if (teamIds.length) {
    const { data: teams, error: teamsError } = await supabaseAdmin
      .from("team_pages")
      .select("id, school_name, slug")
      .in("id", teamIds);
    if (teamsError) throw teamsError;
    for (const team of teams || []) teamsById.set(team.id, team);
  }

  return (data || []).map((row) => ({
    ...row,
    team: teamsById.get(row.team_id) || null
  }));
}

// Builds the weekly email content from the same data the admin review page
// shows, so the digest and the page never disagree. Pure and DB-free by
// itself -- callers pass in the changes to summarize -- so it can be unit
// tested without a live Supabase connection.
export function buildInstagramDigestEmail(changes) {
  const submissions = changes.filter((entry) => entry.actor_type === ACTION_SUBMIT);
  const reverts = changes.filter((entry) => entry.actor_type === ACTION_REVERT);
  const siteUrl = getSiteUrl();
  const reviewUrl = `${siteUrl}/admin/team-instagram/`;

  const rowsHtml = changes.length
    ? changes
        .map((entry) => {
          const teamName = entry.team?.school_name || "Unknown team";
          const before = entry.before_data?.instagram_handle;
          const after = entry.after_data?.instagram_handle;
          const kind = entry.actor_type === ACTION_REVERT ? "Reverted" : "Submitted";
          const changeText = `${before ? "@" + escapeHtml(before) : "(none)"} &rarr; ${after ? "@" + escapeHtml(after) : "(cleared)"}`;
          const when = new Date(entry.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
          return `<tr><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(teamName)}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${kind}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${changeText}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(when)}</td></tr>`;
        })
        .join("")
    : '<tr><td colspan="4" style="padding:10px;">No team Instagram changes this week.</td></tr>';

  const subject = changes.length
    ? `Podium Watch: ${changes.length} team Instagram change${changes.length === 1 ? "" : "s"} this week`
    : "Podium Watch: no team Instagram changes this week";

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
      <h2 style="margin-bottom:4px;">Team Instagram weekly digest</h2>
      <p style="margin-top:0;color:#475569;">${submissions.length} public submission${submissions.length === 1 ? "" : "s"} and ${reverts.length} admin revert${reverts.length === 1 ? "" : "s"} in the last 7 days. Every change below already took effect automatically -- this is a review summary, not an approval queue.</p>
      <table style="border-collapse:collapse;width:100%;max-width:640px;">
        <thead><tr><th style="text-align:left;padding:6px 10px;background:#111;color:#fff;">Team</th><th style="text-align:left;padding:6px 10px;background:#111;color:#fff;">Type</th><th style="text-align:left;padding:6px 10px;background:#111;color:#fff;">Change</th><th style="text-align:left;padding:6px 10px;background:#111;color:#fff;">Date</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <p style="margin-top:18px;"><a href="${escapeHtml(reviewUrl)}" style="color:#00bf63;font-weight:700;">Review or revert any of these &rarr;</a></p>
    </div>
  `;

  const text = [
    "Team Instagram weekly digest",
    `${submissions.length} public submission(s) and ${reverts.length} admin revert(s) in the last 7 days.`,
    "",
    ...changes.map((entry) => {
      const teamName = entry.team?.school_name || "Unknown team";
      const before = entry.before_data?.instagram_handle;
      const after = entry.after_data?.instagram_handle;
      const kind = entry.actor_type === ACTION_REVERT ? "Reverted" : "Submitted";
      return `- ${teamName}: ${kind}, ${before ? "@" + before : "(none)"} -> ${after ? "@" + after : "(cleared)"}`;
    }),
    "",
    `Review or revert: ${reviewUrl}`
  ].join("\n");

  return { subject, html, text, submissionCount: submissions.length, revertCount: reverts.length };
}

// The cron entry point: gathers the last 7 days of changes and emails the
// digest through the same Resend integration the follower digest already
// uses. Requires TEAM_INSTAGRAM_DIGEST_EMAIL (the recipient) in addition to
// the RESEND_API_KEY / RESEND_FROM_EMAIL this project already needs for any
// email to send at all.
export async function sendWeeklyInstagramDigest({ recipientEmail } = {}) {
  const to = recipientEmail || process.env.TEAM_INSTAGRAM_DIGEST_EMAIL;
  if (!to) {
    throw error(
      "Set TEAM_INSTAGRAM_DIGEST_EMAIL (the address that should receive this digest) in Vercel.",
      503,
      "DIGEST_EMAIL_NOT_CONFIGURED"
    );
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const changes = await listRecentInstagramChanges({ since, limit: 500 });
  const digest = buildInstagramDigestEmail(changes);

  await sendResendEmail({
    to,
    subject: digest.subject,
    html: digest.html,
    text: digest.text,
    idempotencyKey: `team-instagram-digest-${new Date().toISOString().slice(0, 10)}`
  });

  return { sent: true, changeCount: changes.length, submissionCount: digest.submissionCount, revertCount: digest.revertCount };
}
