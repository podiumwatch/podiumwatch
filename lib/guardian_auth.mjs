// Guardian authentication (Team Workspace Phase Three) -- structurally
// identical to lib/athlete_auth.mjs (same underlying mechanism: guardians
// are just real Supabase Auth accounts in the same project, validated
// the same way -- supabaseAdmin.auth.getUser(bearerToken)). What's
// different is the AUTHORIZATION layer: a guardian's access to an
// athlete's data is checked against guardian_accounts, never
// athlete_accounts. Kept as its own file, not merged into
// lib/athlete_auth.mjs, matching this project's existing convention of
// separate, purpose-specific auth modules (lib/admin_auth.mjs vs
// lib/team_auth.mjs vs lib/athlete_auth.mjs) so error copy stays
// audience-appropriate.
import { supabaseAdmin } from "./supabase-admin.mjs";

function getBearerToken(request) {
  const authorization = request.headers?.authorization || request.headers?.Authorization || "";
  const match = String(authorization).match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

export async function requireGuardianUser(request) {
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

export function guardianApiError(response, error, fallbackMessage) {
  const status = Number(error?.status) || 500;

  if (status >= 500) {
    console.error(fallbackMessage, error);
  }

  return response.status(status).json({
    error: status < 500 ? error.message : fallbackMessage
  });
}

// An explicit, per-request authorization check, never inferred from the
// auth token alone. Requires an ACTIVE (non-revoked) guardian_accounts
// row linking this user to this exact team_athletes.id.
export async function requireGuardianAccess(userId, teamAthleteId) {
  const { data, error } = await supabaseAdmin
    .from("guardian_accounts")
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

// Every active guardian_accounts row for this signed-in user -- the set
// of team_athletes.id values their view is allowed to aggregate across.
// Never assumes exactly one -- a guardian with more than one athlete on
// Podium Watch (siblings on the same or different teams) is a normal
// case, not an edge case.
export async function loadActiveGuardianLinks(userId) {
  const { data, error } = await supabaseAdmin
    .from("guardian_accounts")
    .select("id, team_athlete_id, team_id, linked_at")
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) {
    throw error;
  }

  return data || [];
}
