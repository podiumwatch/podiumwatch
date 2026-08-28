// My Podium account authentication (Project 5, Slice B) -- structurally
// identical to lib/team_auth.mjs and lib/photographer_auth.mjs (same
// underlying mechanism: a My Podium account is just a real Supabase
// Auth account in the same shared user pool, validated the same way --
// supabaseAdmin.auth.getUser(bearerToken)). This is the OPEN self-serve
// tier (no invite required), matching team/photographer accounts, not
// the coach-invite-only pattern used by athlete/guardian access -- a
// My Podium account only ever grants a signed-in user access to their
// own synced preferences, never another person's data. Kept as its own
// file, not merged into team_auth.mjs, matching this project's existing
// convention of separate, purpose-specific auth modules so error copy
// stays audience-appropriate.
import { supabaseAdmin } from "./supabase-admin.mjs";

function getBearerToken(request) {
  const authorization = request.headers?.authorization || request.headers?.Authorization || "";
  const match = String(authorization).match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

export async function requireMyPodiumUser(request) {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    const error = new Error("Sign in to sync My Podium.");
    error.status = 401;
    throw error;
  }

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);

  if (error || !data.user) {
    const authError = new Error("Your My Podium session is no longer valid. Sign in again.");
    authError.status = 401;
    throw authError;
  }

  if (!data.user.email_confirmed_at && !data.user.confirmed_at) {
    const confirmationError = new Error("Confirm your email before syncing My Podium.");
    confirmationError.status = 403;
    throw confirmationError;
  }

  return data.user;
}

export function myPodiumApiError(response, error, fallbackMessage) {
  const status = Number(error?.status) || 500;

  if (status >= 500) {
    console.error(fallbackMessage, error);
  }

  return response.status(status).json({
    error: status < 500 ? error.message : fallbackMessage
  });
}
