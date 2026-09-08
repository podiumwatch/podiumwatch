// Writer Portal auth -- modeled directly on lib/team_auth.mjs's exact
// pattern (real Supabase Auth, a bearer token verified server-side via
// supabaseAdmin.auth.getUser()). Deliberately NOT the site's separate
// shared admin password (lib/admin_auth.mjs, isAdminRequest) -- a portal
// "editor" or "admin" role can review writer submissions without ever
// holding that password, which is the reason the role exists at all.
import { supabaseAdmin } from "./supabase-admin.mjs";

function getBearerToken(request) {
  const authorization = request.headers?.authorization || request.headers?.Authorization || "";
  const match = String(authorization).match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

export async function requirePortalUser(request) {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    const error = new Error("Writer Portal sign in required.");
    error.status = 401;
    throw error;
  }

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);

  if (error || !data.user) {
    const authError = new Error("Your Writer Portal session is no longer valid.");
    authError.status = 401;
    throw authError;
  }

  if (!data.user.email_confirmed_at && !data.user.confirmed_at) {
    const confirmationError = new Error("Confirm your email before using the Writer Portal.");
    confirmationError.status = 403;
    throw confirmationError;
  }

  touchLastActive(data.user.id);

  return data.user;
}

// Fire-and-forget, never awaited by a caller -- this is the one choke
// point every single Writer Portal action already passes through
// (unlike getOrCreatePortalProfile(), which several actions skip
// entirely), so it's the only place that can answer "when did this
// person actually last use the portal" for every action, not just one.
// The WHERE clause throttles this to roughly once per 2 minutes per
// user without a separate read first -- a write that matches nothing
// (because it was already updated recently) is harmless.
function touchLastActive(userId) {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  supabaseAdmin
    .from("portal_profiles")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", userId)
    .or(`last_active_at.is.null,last_active_at.lt.${twoMinutesAgo}`)
    .then(({ error }) => {
      if (error) console.error("touchLastActive error:", error);
    });
}

// Fetches (and creates, if somehow missing -- the auth trigger should
// always beat this to it, but a race or a manually-created auth user
// shouldn't hard-fail the request) this user's portal_profiles row.
export async function getOrCreatePortalProfile(userId) {
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("portal_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (existing) return existing;

  const { data: created, error: createError } = await supabaseAdmin
    .from("portal_profiles")
    .insert({ id: userId })
    .select("*")
    .single();
  if (createError) throw createError;
  return created;
}

// Requires the caller be portal staff (editor or admin role) -- separate
// from requirePortalUser, since most portal actions only need "signed in
// as someone," not "signed in as staff."
export async function requirePortalStaff(request) {
  const user = await requirePortalUser(request);
  const profile = await getOrCreatePortalProfile(user.id);

  if (!["editor", "admin"].includes(profile.role)) {
    const error = new Error("Writer Portal staff access required.");
    error.status = 403;
    throw error;
  }

  return { user, profile };
}

export function portalApiError(response, error, fallbackMessage) {
  const status = Number(error?.status) || 500;

  if (status >= 500) {
    console.error(fallbackMessage, error);
  }

  return response.status(status).json({
    error: status < 500 ? error.message : fallbackMessage
  });
}
