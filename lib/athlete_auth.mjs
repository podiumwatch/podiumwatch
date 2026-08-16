// Athlete authentication -- structurally identical to lib/team_auth.mjs
// (same underlying mechanism: athletes and coaches are both just real
// Supabase Auth accounts in the same project, validated the same way --
// supabaseAdmin.auth.getUser(bearerToken)). What's different is the
// AUTHORIZATION layer: a coach's access to a team is checked against
// team_members; an athlete's access to their own data is checked against
// athlete_accounts (see requireAthleteAccess below). Kept as its own
// file, not a shared generic module, so error copy stays athlete-
// appropriate ("your account" rather than "your team account") --
// matching this project's existing convention of separate,
// purpose-specific auth modules (lib/admin_auth.mjs vs lib/team_auth.mjs)
// rather than one shared generic one.
import { supabaseAdmin } from "./supabase-admin.mjs";

function getBearerToken(request) {
  const authorization = request.headers?.authorization || request.headers?.Authorization || "";
  const match = String(authorization).match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

export async function requireAthleteUser(request) {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    const error = new Error("Sign in required.");
    error.status = 401;
    throw error;
  }

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);

  if (error || !data.user) {
    const authError = new Error("Your session is no longer valid. Sign in again.");
    authError.status = 401;
    throw authError;
  }

  if (!data.user.email_confirmed_at && !data.user.confirmed_at) {
    const confirmationError = new Error("Confirm your email before continuing.");
    confirmationError.status = 403;
    throw confirmationError;
  }

  return data.user;
}

export function athleteApiError(response, error, fallbackMessage) {
  const status = Number(error?.status) || 500;

  if (status >= 500) {
    console.error(fallbackMessage, error);
  }

  return response.status(status).json({
    error: status < 500 ? error.message : fallbackMessage
  });
}

// Mirrors api/team/schedule.js's requireMembership()/lib/team_workspace_service.mjs's
// requireTeamMembership() shape: an explicit, per-request authorization
// check, never inferred from the auth token alone. Requires an ACTIVE
// (non-revoked) athlete_accounts row linking this user to this exact
// team_athletes.id.
export async function requireAthleteAccess(userId, teamAthleteId) {
  const { data, error } = await supabaseAdmin
    .from("athlete_accounts")
    .select("id, user_id, team_athlete_id, team_id, status")
    .eq("user_id", userId)
    .eq("team_athlete_id", teamAthleteId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    const accessError = new Error("You do not have access to this athlete's data.");
    accessError.status = 403;
    throw accessError;
  }

  return data;
}

// Every active athlete_accounts row for this signed-in user -- the set
// of team_athletes.id values their view is allowed to aggregate across.
// Never assumes exactly one -- a real athlete can be linked from more
// than one team_athletes row (e.g. invited by two different teams over
// their career after a transfer -- see install/12_ATHLETE_ACCESS.sql's
// header comment for why that's the correct, unforced shape).
export async function loadActiveAthleteLinks(userId) {
  const { data, error } = await supabaseAdmin
    .from("athlete_accounts")
    .select("id, team_athlete_id, team_id, linked_at")
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) {
    throw error;
  }

  return data || [];
}
