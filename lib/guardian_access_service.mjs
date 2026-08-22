// Guardian Access (Team Workspace Phase Three) database-backed service.
// Invite lifecycle (generate/validate/redeem/revoke) plus a guardian's
// own "my athlete's races" read path. Structurally a mirror of
// lib/athlete_access_service.mjs, retargeted to guardian_invites /
// guardian_accounts -- see install/13_GUARDIAN_AND_SPECTATOR_ACCESS.sql
// for why that's a deliberate, near-exact copy of athlete_invites /
// athlete_accounts rather than a shared generic table.
import { supabaseAdmin } from "./supabase-admin.mjs";
import {
  createToken,
  hashToken,
  validateEmail,
  sendResendEmail,
  escapeHtml,
  getSiteUrl
} from "./engagement_service.mjs";
import { loadActiveGuardianLinks } from "./guardian_auth.mjs";
import { loadAthleteViewRaces } from "./race_viewer_service.mjs";

const INVITE_EXPIRY_DAYS = 14;
const MIN_TOKEN_LENGTH = 20;

function fail(message, status = 400, code = "") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  throw error;
}

function cleanText(value, maxLength = 500) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function cleanUuid(value, label = "ID") {
  const cleaned = cleanText(value, 100);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleaned)) {
    fail(`${label} is invalid.`);
  }
  return cleaned;
}

// --- invite lifecycle --------------------------------------------------------

export async function generateInvite({ teamId, teamAthleteId, invitedEmail, invitedName, actor }) {
  const cleanedAthleteId = cleanUuid(teamAthleteId, "Athlete");

  const { data: athlete, error: athleteError } = await supabaseAdmin
    .from("team_athletes")
    .select("id, team_id, first_name, last_name, display_name")
    .eq("id", cleanedAthleteId)
    .eq("team_id", teamId)
    .maybeSingle();

  if (athleteError) throw athleteError;
  if (!athlete) fail("Athlete not found on this team.", 404);

  const email = validateEmail(invitedEmail);
  const name = cleanText(invitedName, 200) || "Parent/Guardian";
  const athleteName = athlete.display_name || `${athlete.first_name} ${athlete.last_name}`.trim();

  const { data: team, error: teamError } = await supabaseAdmin
    .from("team_pages")
    .select("id, school_name")
    .eq("id", teamId)
    .maybeSingle();
  if (teamError) throw teamError;

  const rawToken = createToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: invite, error: insertError } = await supabaseAdmin
    .from("guardian_invites")
    .insert({
      team_id: teamId,
      team_athlete_id: cleanedAthleteId,
      invited_email: email,
      invited_name: name,
      token_hash: tokenHash,
      status: "pending",
      created_by_user_id: actor?.userId || null,
      expires_at: expiresAt
    })
    .select("*")
    .single();

  if (insertError) throw insertError;

  const inviteUrl = `${getSiteUrl()}/guardian-login/?invite=${rawToken}`;
  const teamName = team?.school_name || "Your athlete's coach";

  let emailSent = false;
  try {
    await sendResendEmail({
      to: email,
      subject: `${teamName} invited you to follow ${athleteName} on Podium Watch`,
      html:
        `<p>Hi ${escapeHtml(name)},</p>` +
        `<p>${escapeHtml(teamName)} invited you to see ${escapeHtml(athleteName)}'s race plans and results on Podium Watch.</p>` +
        `<p><a href="${escapeHtml(inviteUrl)}">Set up your account</a></p>` +
        `<p>This link expires in ${INVITE_EXPIRY_DAYS} days.</p>`,
      text:
        `${name}, ${teamName} invited you to follow ${athleteName} on Podium Watch. ` +
        `Set up your account: ${inviteUrl} (expires in ${INVITE_EXPIRY_DAYS} days.)`
    });
    emailSent = true;
  } catch (emailError) {
    // A failed email must never fail the invite itself -- the coach can
    // still copy/share inviteUrl directly. Logged, not thrown.
    console.error("Guardian invite email could not be sent.", emailError);
  }

  return { invite, inviteUrl, emailSent };
}

function validateTokenFormat(rawToken) {
  const cleaned = cleanText(rawToken, 300);
  if (!cleaned || cleaned.length < MIN_TOKEN_LENGTH) {
    fail("This invite link is invalid.", 400);
  }
  return cleaned;
}

async function loadPendingInviteByToken(rawToken) {
  const cleaned = validateTokenFormat(rawToken);
  const tokenHash = hashToken(cleaned);

  const { data: invite, error } = await supabaseAdmin
    .from("guardian_invites")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) throw error;
  if (!invite) fail("This invite link is invalid or has already been used.", 404);
  if (invite.status !== "pending") fail("This invite has already been used or is no longer active.", 409);
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    fail("This invite has expired. Ask the coach to send a new one.", 410);
  }

  return invite;
}

// Read-only, unauthenticated (no account exists yet at this point) --
// shows just enough for the guardian to recognize the invite before
// creating an account.
export async function validateInviteToken(rawToken) {
  const invite = await loadPendingInviteByToken(rawToken);

  const { data: team, error: teamError } = await supabaseAdmin
    .from("team_pages")
    .select("school_name")
    .eq("id", invite.team_id)
    .maybeSingle();
  if (teamError) throw teamError;

  return { invited_name: invite.invited_name, team_name: team?.school_name || "the team" };
}

export async function redeemInvite({ rawToken, userId, consentConfirmedBy }) {
  const invite = await loadPendingInviteByToken(rawToken);

  const consentBy = cleanText(consentConfirmedBy, 200);
  if (!consentBy) fail("Confirm the consent statement to continue.", 400);

  const nowIso = new Date().toISOString();

  const { data: link, error: linkError } = await supabaseAdmin
    .from("guardian_accounts")
    .upsert(
      {
        user_id: userId,
        team_athlete_id: invite.team_athlete_id,
        team_id: invite.team_id,
        linked_at: nowIso,
        linked_via_invite_id: invite.id,
        status: "active",
        revoked_at: null,
        revoked_by_user_id: null
      },
      { onConflict: "user_id,team_athlete_id" }
    )
    .select("*")
    .single();

  if (linkError) throw linkError;

  const { error: updateError } = await supabaseAdmin
    .from("guardian_invites")
    .update({
      status: "redeemed",
      redeemed_at: nowIso,
      redeemed_by_user_id: userId,
      consent_confirmed_at: nowIso,
      consent_confirmed_by: consentBy
    })
    .eq("id", invite.id);

  if (updateError) throw updateError;

  return { link };
}

export async function listInvitesForAthlete({ teamId, teamAthleteId }) {
  const { data, error } = await supabaseAdmin
    .from("guardian_invites")
    .select("id, invited_email, invited_name, status, created_at, expires_at, redeemed_at")
    .eq("team_id", teamId)
    .eq("team_athlete_id", cleanUuid(teamAthleteId, "Athlete"))
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function revokeInvite({ teamId, inviteId, actorUserId }) {
  const cleanedInviteId = cleanUuid(inviteId, "Invite");

  const { data: invite, error } = await supabaseAdmin
    .from("guardian_invites")
    .select("*")
    .eq("id", cleanedInviteId)
    .eq("team_id", teamId)
    .maybeSingle();

  if (error) throw error;
  if (!invite) fail("Invite not found.", 404);
  if (invite.status !== "pending") fail("Only a pending invite can be revoked.", 409);

  const { data, error: updateError } = await supabaseAdmin
    .from("guardian_invites")
    .update({ status: "revoked", revoked_at: new Date().toISOString(), revoked_by_user_id: actorUserId })
    .eq("id", cleanedInviteId)
    .select("*")
    .single();

  if (updateError) throw updateError;
  return data;
}

// Revokes the ONE guardian_accounts row linked via this specific invite
// -- a status flip, never a delete, matching this project's established
// "traceable, not destructive" pattern. Deliberately scoped to a single
// invite, not the whole team_athlete_id (unlike
// lib/athlete_access_service.mjs's revokeAthleteAccess): more than one
// guardian per athlete is the normal case here (two parents), so
// revoking "by athlete" would silently remove every guardian's access
// at once instead of just the one the coach meant to revoke.
export async function revokeGuardianAccess({ teamId, inviteId, actorUserId }) {
  const cleanedInviteId = cleanUuid(inviteId, "Invite");

  const { data, error } = await supabaseAdmin
    .from("guardian_accounts")
    .update({ status: "revoked", revoked_at: new Date().toISOString(), revoked_by_user_id: actorUserId })
    .eq("team_id", teamId)
    .eq("linked_via_invite_id", cleanedInviteId)
    .eq("status", "active")
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) fail("This guardian's access could not be found.", 404);
  return data;
}

// --- the guardian's own read path --------------------------------------------

export async function getGuardianMe(userId) {
  const links = await loadActiveGuardianLinks(userId);
  if (links.length === 0) {
    return { athletes: [] };
  }

  const teamAthleteIds = links.map((l) => l.team_athlete_id);
  const teamIds = [...new Set(links.map((l) => l.team_id))];

  const [{ data: teamAthletes, error: taError }, { data: teams, error: teamError }] = await Promise.all([
    supabaseAdmin
      .from("team_athletes")
      .select("id, team_id, first_name, last_name, display_name, graduation_year")
      .in("id", teamAthleteIds),
    supabaseAdmin.from("team_pages").select("id, school_name, slug").in("id", teamIds)
  ]);

  if (taError) throw taError;
  if (teamError) throw teamError;

  const teamsById = new Map((teams || []).map((t) => [t.id, t]));

  return {
    athletes: (teamAthletes || []).map((ta) => ({ ...ta, team: teamsById.get(ta.team_id) || null }))
  };
}

// A guardian's own linked athlete(s) get the exact same
// goals/targets/splits/checkpoints projection an athlete gets for
// themselves (lib/race_viewer_service.mjs's loadAthleteViewRaces) --
// never another participant's plan. Guardian Home links out to the
// public /race/?race=<id> leaderboard itself (watchLiveLink() in
// guardian-home.js) for a spectator_visible race rather than duplicating
// that table here -- this function previously ALSO fetched a full
// loadSpectatorRace() per spectator_visible race and attached it as a
// `leaderboard` field, but the client never read that field at all.
// Found during the overnight audit: a real, silently wasted extra
// database query and JSON payload on every Guardian Home load. Removed
// rather than left in place, since nothing consumes it.
export async function getGuardianRaces(userId) {
  const links = await loadActiveGuardianLinks(userId);
  if (links.length === 0) {
    return { races: [] };
  }

  const teamAthleteIds = links.map((l) => l.team_athlete_id);
  const races = await loadAthleteViewRaces(teamAthleteIds);

  return { races };
}
