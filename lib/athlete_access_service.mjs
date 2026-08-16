// Athlete Access (Team Workspace Phase Two) database-backed service.
// Invite lifecycle (generate/validate/redeem/revoke) plus the athlete's
// own "my races" read path. Every caller here is assumed to already be
// authorized by its API handler (team_members ownership for invite
// management, requireAthleteAccess for an athlete's own data) --
// matching this project's established layering (see
// lib/race_command_center_service.mjs).
import { supabaseAdmin } from "./supabase-admin.mjs";
import {
  createToken,
  hashToken,
  validateEmail,
  sendResendEmail,
  escapeHtml,
  getSiteUrl
} from "./engagement_service.mjs";
import { loadActiveAthleteLinks } from "./athlete_auth.mjs";

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
  const name = cleanText(invitedName, 200) ||
    athlete.display_name ||
    `${athlete.first_name} ${athlete.last_name}`.trim();

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
    .from("athlete_invites")
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

  const inviteUrl = `${getSiteUrl()}/athlete-login/?invite=${rawToken}`;
  const teamName = team?.school_name || "Your coach";

  let emailSent = false;
  try {
    await sendResendEmail({
      to: email,
      subject: `${teamName} invited you to Podium Watch`,
      html:
        `<p>Hi ${escapeHtml(name)},</p>` +
        `<p>${escapeHtml(teamName)} invited you to see your own race plans and results on Podium Watch.</p>` +
        `<p><a href="${escapeHtml(inviteUrl)}">Set up your account</a></p>` +
        `<p>This link expires in ${INVITE_EXPIRY_DAYS} days.</p>`,
      text:
        `${name}, ${teamName} invited you to Podium Watch. ` +
        `Set up your account: ${inviteUrl} (expires in ${INVITE_EXPIRY_DAYS} days.)`
    });
    emailSent = true;
  } catch (emailError) {
    // A failed email must never fail the invite itself -- the coach can
    // still copy/share inviteUrl directly. Logged, not thrown.
    console.error("Athlete invite email could not be sent.", emailError);
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
    .from("athlete_invites")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) throw error;
  if (!invite) fail("This invite link is invalid or has already been used.", 404);
  if (invite.status !== "pending") fail("This invite has already been used or is no longer active.", 409);
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    fail("This invite has expired. Ask your coach to send a new one.", 410);
  }

  return invite;
}

// Read-only, unauthenticated (no account exists yet at this point) --
// shows just enough for the athlete to recognize the invite before
// creating an account.
export async function validateInviteToken(rawToken) {
  const invite = await loadPendingInviteByToken(rawToken);

  const { data: team, error: teamError } = await supabaseAdmin
    .from("team_pages")
    .select("school_name")
    .eq("id", invite.team_id)
    .maybeSingle();
  if (teamError) throw teamError;

  return { invited_name: invite.invited_name, team_name: team?.school_name || "your team" };
}

export async function redeemInvite({ rawToken, userId, consentConfirmedBy }) {
  const invite = await loadPendingInviteByToken(rawToken);

  const consentBy = cleanText(consentConfirmedBy, 200);
  if (!consentBy) fail("Confirm the consent statement to continue.", 400);

  const nowIso = new Date().toISOString();

  const { data: link, error: linkError } = await supabaseAdmin
    .from("athlete_accounts")
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
    .from("athlete_invites")
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
    .from("athlete_invites")
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
    .from("athlete_invites")
    .select("*")
    .eq("id", cleanedInviteId)
    .eq("team_id", teamId)
    .maybeSingle();

  if (error) throw error;
  if (!invite) fail("Invite not found.", 404);
  if (invite.status !== "pending") fail("Only a pending invite can be revoked.", 409);

  const { data, error: updateError } = await supabaseAdmin
    .from("athlete_invites")
    .update({ status: "revoked", revoked_at: new Date().toISOString(), revoked_by_user_id: actorUserId })
    .eq("id", cleanedInviteId)
    .select("*")
    .single();

  if (updateError) throw updateError;
  return data;
}

// Revokes every currently-active account link for this athlete on this
// team -- a status flip, never a delete, matching this project's
// established "traceable, not destructive" pattern.
export async function revokeAthleteAccess({ teamId, teamAthleteId, actorUserId }) {
  const { data, error } = await supabaseAdmin
    .from("athlete_accounts")
    .update({ status: "revoked", revoked_at: new Date().toISOString(), revoked_by_user_id: actorUserId })
    .eq("team_id", teamId)
    .eq("team_athlete_id", cleanUuid(teamAthleteId, "Athlete"))
    .eq("status", "active")
    .select("*");

  if (error) throw error;
  return data || [];
}

// --- the athlete's own read path ---------------------------------------------

export async function getAthleteMe(userId) {
  const links = await loadActiveAthleteLinks(userId);
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

// The confirmed join path: athlete_accounts -> team_athletes.id ->
// race_participants.team_athlete_id -> race_sessions/race_goals/
// race_targets/race_splits/race_checkpoints. Deliberately never touches
// race_coach_notes -- there is no visibility/approval mechanism for that
// table yet (see install/12_ATHLETE_ACCESS.sql's header comment).
export async function getAthleteRaces(userId) {
  const links = await loadActiveAthleteLinks(userId);
  if (links.length === 0) {
    return { races: [] };
  }

  const teamAthleteIds = links.map((l) => l.team_athlete_id);

  const { data: participants, error: participantError } = await supabaseAdmin
    .from("race_participants")
    .select("*")
    .in("team_athlete_id", teamAthleteIds);

  if (participantError) throw participantError;
  if (!participants || participants.length === 0) {
    return { races: [] };
  }

  const participantIds = participants.map((p) => p.id);
  const sessionIds = [...new Set(participants.map((p) => p.race_session_id))];

  const [
    { data: sessions, error: sessionError },
    { data: goals, error: goalError },
    { data: targets, error: targetError },
    { data: splits, error: splitError },
    { data: checkpoints, error: checkpointError }
  ] = await Promise.all([
    supabaseAdmin.from("race_sessions").select("*").in("id", sessionIds),
    supabaseAdmin.from("race_goals").select("*").in("race_participant_id", participantIds),
    supabaseAdmin.from("race_targets").select("*").in("race_participant_id", participantIds),
    supabaseAdmin.from("race_splits").select("*").in("race_participant_id", participantIds),
    supabaseAdmin.from("race_checkpoints").select("*").in("race_session_id", sessionIds)
  ]);

  if (sessionError) throw sessionError;
  if (goalError) throw goalError;
  if (targetError) throw targetError;
  if (splitError) throw splitError;
  if (checkpointError) throw checkpointError;

  const sessionsById = new Map((sessions || []).map((s) => [s.id, s]));

  const races = participants
    .map((participant) => {
      const session = sessionsById.get(participant.race_session_id);
      if (!session) return null; // defensive -- should never happen, never surface an orphaned row

      const sessionCheckpoints = (checkpoints || [])
        .filter((c) => c.race_session_id === participant.race_session_id)
        .sort((a, b) => a.sort_order - b.sort_order);
      const participantGoals = (goals || []).filter((g) => g.race_participant_id === participant.id);
      const participantTargets = (targets || []).filter((t) => t.race_participant_id === participant.id);
      const participantSplits = (splits || []).filter((s) => s.race_participant_id === participant.id);

      return {
        session,
        participant,
        goals: participantGoals,
        checkpoints: sessionCheckpoints.map((checkpoint) => ({
          checkpoint,
          split: participantSplits.find((s) => s.race_checkpoint_id === checkpoint.id) || null,
          targets: Object.fromEntries(
            participantTargets
              .filter((t) => t.race_checkpoint_id === checkpoint.id)
              .map((t) => [t.goal_slot, t.target_elapsed_seconds])
          )
        }))
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(b.session.race_date).localeCompare(String(a.session.race_date)));

  return { races };
}
