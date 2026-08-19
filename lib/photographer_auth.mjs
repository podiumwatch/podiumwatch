// Photographer authentication (Team Workspace... well, Photographer
// Network -- Phase Two). Structurally identical to lib/team_auth.mjs
// (same mechanism: a real Supabase Auth user, bearer token,
// getUser()) -- matching this project's established convention of
// separate, purpose-specific auth modules rather than one shared
// generic one, so error copy stays audience-appropriate.
//
// Unlike athlete/guardian access (coach-invite-only), a photographer
// account is OPEN self-serve signup -- there's no one to invite a
// photographer, mirroring team/coach signup instead (see
// public/scripts/photographer-auth.js / api/photographer/create.js).
import { supabaseAdmin } from "./supabase-admin.mjs";

function getBearerToken(request) {
  const authorization = request.headers?.authorization || request.headers?.Authorization || "";
  const match = String(authorization).match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

export async function requirePhotographerUser(request) {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    const error = new Error("Photographer account sign in required.");
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

export function photographerApiError(response, error, fallbackMessage) {
  const status = Number(error?.status) || 500;

  if (status >= 500) {
    console.error(fallbackMessage, error);
  }

  return response.status(status).json({
    error: status < 500 ? error.message : fallbackMessage
  });
}

// An explicit, per-request ownership check, never inferred from the
// auth token alone -- requires an ACTIVE (non-revoked)
// photographer_members row linking this user to this exact
// photographers.id.
export async function requirePhotographerOwnership(userId, photographerId) {
  const { data, error } = await supabaseAdmin
    .from("photographer_members")
    .select("id, user_id, photographer_id, role, status")
    .eq("user_id", userId)
    .eq("photographer_id", photographerId)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const accessError = new Error("You do not have access to this photographer listing.");
    accessError.status = 403;
    throw accessError;
  }

  return data;
}

// Every active photographer_members row for this signed-in user.
export async function loadActivePhotographerMemberships(userId) {
  const { data, error } = await supabaseAdmin
    .from("photographer_members")
    .select("id, photographer_id, role")
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) throw error;
  return data || [];
}
