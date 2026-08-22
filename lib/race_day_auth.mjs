// Race Day Access: a second, lighter-weight way into Split
// Watch alongside the existing full Podium Watch coach account
// (Supabase Auth + team_members, lib/team_auth.mjs). A team owner/editor
// generates a short code (regenerateRaceDayCode, below) and shares it
// with race-day volunteers -- people at a mile marker who may never
// want a full account. Entering the code (verifyRaceDayCode) issues an
// opaque session, remembered on that device via an HttpOnly cookie for
// 30 days, same hash-only-stored pattern already established for
// athlete_invites/guardian_invites tokens -- not a Supabase Auth
// session, no real identity behind it, just "this browser was recently
// shown this team's current code."
//
// requireSplitWatchAccess() (the one export every
// api/split-watch/*.js handler actually calls) is deliberately
// the ONLY integration point -- it accepts either a real team_user
// bearer token OR a valid race-day cookie and resolves both to the same
// { actor } shape the service layer already expects. Nothing else
// (roster, schedule, content editing) reads this module at all -- a
// race-day code grants Split Watch access and nothing else.
import crypto from "node:crypto";
import { supabaseAdmin } from "./supabase-admin.mjs";
import { requireTeamUser } from "./team_auth.mjs";
import { requireTeamMembership } from "./split_watch_service.mjs";

const SESSION_COOKIE_NAME = "podium_race_day_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30; // 30 days -- a volunteer's own phone should stay recognized for a whole season, not require re-entry every meet.
// Excludes 0/O/1/I/L -- the exact characters people misread off a
// whiteboard or a hastily-texted message.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;
const MAX_FAILED_ATTEMPTS_PER_HOUR = 8;

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function randomSessionToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function generateRaceDayCode() {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return code;
}

function normalizeCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function parseCookies(cookieHeader = "") {
  return String(cookieHeader).split(";").reduce((cookies, item) => {
    const separator = item.indexOf("=");
    if (separator === -1) return cookies;
    const name = item.slice(0, separator).trim();
    const value = item.slice(separator + 1).trim();
    if (name) cookies[name] = value;
    return cookies;
  }, {});
}

function requestIsSecure(request) {
  const forwardedProtocol = request.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProtocol) ? forwardedProtocol[0] : forwardedProtocol;
  return protocol === "https" || process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview";
}

function buildSessionCookie(token, request) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${token}`,
    "HttpOnly",
    "Path=/",
    // Lax, not Strict -- unlike the admin session (only ever set via a
    // same-site form post), this cookie needs to survive a top-level
    // navigation straight from a shared link or a scanned QR code.
    "SameSite=Lax",
    `Max-Age=${SESSION_SECONDS}`
  ];
  if (requestIsSecure(request)) parts.push("Secure");
  return parts.join("; ");
}

export function clearRaceDaySessionCookie(request) {
  const parts = [`${SESSION_COOKIE_NAME}=`, "HttpOnly", "Path=/", "SameSite=Lax", "Max-Age=0", "Expires=Thu, 01 Jan 1970 00:00:00 GMT"];
  if (requestIsSecure(request)) parts.push("Secure");
  return parts.join("; ");
}

function getClientIpHash(request) {
  const forwarded = request.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const ip = String(raw || "").split(",")[0].trim() || request.socket?.remoteAddress || "unknown";
  return sha256(ip);
}

// Rate limited on FAILED attempts only, by hashed IP -- never the raw
// address (matches lib/team_instagram_service.mjs's existing
// convention). A correct code is never recorded here at all.
async function checkRateLimit(hashedIp) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabaseAdmin
    .from("race_day_code_attempts")
    .select("id", { count: "exact", head: true })
    .eq("hashed_ip", hashedIp)
    .gte("created_at", since);
  if (error) throw error;
  if ((count || 0) >= MAX_FAILED_ATTEMPTS_PER_HOUR) {
    fail("Too many attempts. Try again in a bit.", 429);
  }
}

async function recordFailedAttempt(hashedIp) {
  const { error } = await supabaseAdmin.from("race_day_code_attempts").insert({ hashed_ip: hashedIp });
  if (error) throw error;
}

// --- public entry point: a volunteer typing in a code -------------------------

export async function verifyRaceDayCode(request, { code }) {
  const hashedIp = getClientIpHash(request);
  await checkRateLimit(hashedIp);

  const cleanedCode = normalizeCode(code);
  if (!cleanedCode) {
    await recordFailedAttempt(hashedIp);
    fail("Enter your team's race day code.");
  }

  const codeHash = sha256(cleanedCode);
  const { data: codeRow, error } = await supabaseAdmin
    .from("team_race_day_codes")
    .select("team_id, active")
    .eq("code_hash", codeHash)
    .maybeSingle();
  if (error) throw error;

  // Deliberately the same error either way -- never reveals whether a
  // code was simply wrong vs. correct-but-deactivated.
  if (!codeRow || !codeRow.active) {
    await recordFailedAttempt(hashedIp);
    fail("That code wasn't recognized. Check with your coach for the current one.", 401);
  }

  const { data: team, error: teamError } = await supabaseAdmin
    .from("team_pages")
    .select("id, school_name, slug, archived_at, merged_into_team_id, suspended")
    .eq("id", codeRow.team_id)
    .maybeSingle();
  if (teamError) throw teamError;
  if (!team || team.archived_at || team.merged_into_team_id || team.suspended) {
    fail("This team's race day access is not currently available.", 403);
  }

  const rawToken = randomSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();

  const { error: insertError } = await supabaseAdmin
    .from("race_day_sessions")
    .insert({ team_id: codeRow.team_id, session_token_hash: sha256(rawToken), expires_at: expiresAt });
  if (insertError) throw insertError;

  await supabaseAdmin.from("team_race_day_codes").update({ last_used_at: new Date().toISOString() }).eq("team_id", codeRow.team_id);

  return {
    cookie: buildSessionCookie(rawToken, request),
    team: { id: team.id, school_name: team.school_name, slug: team.slug }
  };
}

// Resolves an already-issued race-day cookie to its team, or null if
// none/expired/unknown. Deliberately never throws -- callers combine
// this with the existing Supabase-Auth path and only reject if BOTH
// come back empty.
async function resolveRaceDaySession(request) {
  const cookies = parseCookies(request.headers.cookie || "");
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return null;

  const { data, error } = await supabaseAdmin
    .from("race_day_sessions")
    .select("id, team_id, expires_at")
    .eq("session_token_hash", sha256(token))
    .maybeSingle();
  if (error || !data) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) return null;

  // Best-effort activity stamp -- never blocks the request on failure.
  supabaseAdmin.from("race_day_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", data.id).then(
    () => {},
    () => {}
  );

  return { teamId: data.team_id };
}

// --- the one function every api/split-watch/*.js handler calls -------
// Replaces the old requireTeamUser(request) + requireTeamMembership(user.id,
// teamId) two-step with a single call that accepts either credential and
// returns the same { actor } shape createSession/pushSplits/etc. already
// expect (actor.userId is null for race-day access -- every write path
// already treats created_by_user_id as nullable).
export async function requireSplitWatchAccess(request, teamId) {
  const authorization = request.headers?.authorization || request.headers?.Authorization || "";
  if (/^Bearer\s+.+/i.test(String(authorization))) {
    const user = await requireTeamUser(request);
    const membership = await requireTeamMembership(user.id, teamId);
    return { actor: { type: "team_user", userId: user.id, label: membership.display_name || user.email || "Coach" } };
  }

  const session = await resolveRaceDaySession(request);
  if (session && session.teamId === teamId) {
    return { actor: { type: "race_day_code", userId: null, label: "Race day access" } };
  }

  fail("Sign in or enter your team's race day code to continue.", 401);
}

// --- what a race-day code is actually allowed to call ------------------------
// requireSplitWatchAccess() above deliberately resolves a race-day code to the
// exact same { actor } shape a real coach gets -- every api/split-watch/*.js
// handler still calls the same service functions with the same
// authorization. This is the narrower layer on top: a race-day code is for
// TIMING a race (its own copy, everywhere: "share this code with anyone
// timing a race for you"), not planning or administering one, and the pages
// reachable by a race-day code (splitwatchraces.mjs -> the Live timing
// screen, or a finished race's read-only Review) already reflect that. This
// closes the gap flagged in SPLIT_WATCH_OVERNIGHT_REPORT.md: without it, a
// race-day code could still reach every one of those actions by calling the
// API directly, bypassing what the UI shows entirely.
//
// Keyed by the same module name each handler already passes as a plain
// string (matches the file's own name under api/split-watch/) -- deliberately
// NOT auto-derived from the request, so adding a new action anywhere requires
// a human to explicitly decide which side of this list it belongs on.
const RACE_DAY_CODE_ALLOWED_ACTIONS = {
  // Read/switch/run the race itself -- exactly what the races-selection page
  // and the Live page's own start/finish/restart controls already expose to
  // a race-day-code visitor today.
  sessions: new Set(["list", "detail", "start_race", "finish_race", "restart_race"]),
  // Planning (roster, goals, pacing strategy) and deleting a race are coach-
  // only actions -- the Plan page itself already redirects a race-day-code
  // visitor away before ever calling any of these, so this is enforced twice
  // on purpose (defense in depth, not redundant).
  plan: new Set([]),
  // Both actions are pure reads -- reviewing a finished race is explicitly
  // still allowed for a race-day code (splitwatchraces.mjs links finished
  // races here), and there is nothing destructive on this endpoint at all.
  review: new Set(["get_individual", "get_team"]),
  // Everything here IS the timing workflow a race-day code exists for.
  sync: new Set(["create_pack_capture", "push_splits", "pull_state", "set_participant_status"])
};

export function assertActionAllowedForActor(actor, moduleName, action) {
  if (actor.type !== "race_day_code") {
    return;
  }
  const allowed = RACE_DAY_CODE_ALLOWED_ACTIONS[moduleName];
  if (!allowed || !allowed.has(action)) {
    fail("This race day code can't do that -- sign in with a coach account instead.", 403);
  }
}

// --- owner-side: generate/view/revoke your team's code (real Supabase Auth only, never the race-day session itself) ---

export async function getRaceDayCodeStatus(teamId) {
  const { data, error } = await supabaseAdmin
    .from("team_race_day_codes")
    .select("team_id, active, created_at, last_used_at")
    .eq("team_id", teamId)
    .maybeSingle();
  if (error) throw error;
  return data; // null if this team has never generated one
}

// The ONE time the raw code is ever returned -- if it isn't copied down
// now, the only recovery is generating a new one (never re-displayed,
// matching how every hashed secret in this codebase already works).
export async function regenerateRaceDayCode(teamId, userId) {
  const rawCode = generateRaceDayCode();

  const { error: upsertError } = await supabaseAdmin
    .from("team_race_day_codes")
    .upsert(
      { team_id: teamId, code_hash: sha256(rawCode), active: true, created_by_user_id: userId, last_used_at: null },
      { onConflict: "team_id" }
    );
  if (upsertError) throw upsertError;

  // Invalidates every session issued from the OLD code immediately --
  // a coach regenerating because a code leaked needs this to actually work.
  const { error: deleteError } = await supabaseAdmin.from("race_day_sessions").delete().eq("team_id", teamId);
  if (deleteError) throw deleteError;

  return { code: rawCode };
}

export async function revokeRaceDayCode(teamId) {
  const { error } = await supabaseAdmin.from("team_race_day_codes").update({ active: false }).eq("team_id", teamId);
  if (error) throw error;
  const { error: deleteError } = await supabaseAdmin.from("race_day_sessions").delete().eq("team_id", teamId);
  if (deleteError) throw deleteError;
}
