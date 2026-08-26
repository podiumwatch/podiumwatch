import assert from "node:assert/strict";
import fs from "node:fs";
import process from "node:process";

// lib/race_day_auth.mjs imports lib/supabase-admin.mjs, which calls
// createClient() at module load time and throws if these env vars are
// absent -- this suite only exercises the module's pure, no-database
// functions directly, but importing the module at all still triggers
// that top-level call. Matches the same fallback pattern
// scripts/test-split-watch.mjs already uses for the same reason.
process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY ||= "test-service-role-key";

const {
  generateRaceDayCode,
  clearRaceDaySessionCookie,
  assertActionAllowedForActor
} = await import("../lib/race_day_auth.mjs");

function readSource(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

// --- generateRaceDayCode: pure, safe to call directly -----------------------
// Race day feedback (2026-08-25): shrunk from 8-character alphanumeric to
// 4-digit numeric for fast mobile entry (see lib/race_day_auth.mjs's own
// header comment for why the keyspace shrinking to 10,000 changes how
// uniqueness/expiry has to work -- checked at the source level further
// below, since that requires a live database).

{
  for (let i = 0; i < 500; i += 1) {
    const code = generateRaceDayCode();
    assert.equal(typeof code, "string");
    assert.match(code, /^\d{4}$/, "every generated code is exactly 4 digits");
  }
  console.log("generateRaceDayCode() checked: always exactly 4 digits, across 500 samples.");
}

{
  // Loose sanity check that the generator isn't broken (e.g. always
  // returning the same value) -- NOT a uniqueness check. Unlike the old
  // 8-character code (32^8 possible values, a real collision was
  // astronomically unlikely), a 4-digit code has only 10,000 possible
  // values on purpose -- a handful of samples colliding is completely
  // expected and is exactly why regenerateRaceDayCode() has its own
  // collision-retry loop (checked at the source level below), not
  // something this generator itself is responsible for.
  const seen = new Set();
  for (let i = 0; i < 20; i += 1) seen.add(generateRaceDayCode());
  assert.ok(seen.size > 1, "20 samples from a 10,000-value keyspace must not all be identical");
  console.log("generateRaceDayCode() checked to not be a broken generator that always returns one value (real uniqueness is regenerateRaceDayCode()'s collision-retry loop's job, not this function's).");
}

// --- assertActionAllowedForActor: the permission boundary a helper ---------
// code can never cross. Race day feedback (2026-08-25) / the confirmed
// root cause of a real ~10-second timing error: a helper session used to
// be allowed to call start_race/finish_race/restart_race, which is
// exactly how a helper's device ended up establishing its own,
// divergent race clock. "One race, one canonical start" now means a
// race-day-code actor can only read, never start/finish/restart/adjust.

{
  const helperActor = { type: "race_day_code", userId: null, label: "Race day access" };
  const coachActor = { type: "team_user", userId: "user-1", label: "Coach" };

  // A real coach account is never restricted by this function at all --
  // it's a no-op for any actor type other than race_day_code.
  assert.doesNotThrow(() => assertActionAllowedForActor(coachActor, "sessions", "start_race"));
  assert.doesNotThrow(() => assertActionAllowedForActor(coachActor, "sync", "adjust_clock"));

  // A helper may only read -- list/detail/today.
  assert.doesNotThrow(() => assertActionAllowedForActor(helperActor, "sessions", "list"));
  assert.doesNotThrow(() => assertActionAllowedForActor(helperActor, "sessions", "today"));

  // A helper must never be able to start, finish, restart, or adjust the
  // clock of a race -- these are exactly the actions that let a
  // helper's device establish its own divergent race clock.
  for (const action of ["start_race", "finish_race", "restart_race", "create", "update", "delete"]) {
    assert.throws(() => assertActionAllowedForActor(helperActor, "sessions", action), `a helper must be refused "${action}" on sessions`);
  }
  assert.throws(() => assertActionAllowedForActor(helperActor, "sync", "adjust_clock"), "a helper must never be able to adjust the race clock");

  // A helper's actual timing actions must still work -- this permission
  // boundary is about the race's canonical lifecycle, not timing itself.
  for (const action of ["create_pack_capture", "push_splits", "pull_state", "set_participant_status"]) {
    assert.doesNotThrow(() => assertActionAllowedForActor(helperActor, "sync", action), `a helper must still be allowed "${action}" on sync`);
  }

  console.log("assertActionAllowedForActor() checked: a real coach account is never restricted; a race-day-code helper can read races and record timing (splits/pack capture/status) but can never start, finish, restart, or adjust the clock of a race.");
}

// --- clearRaceDaySessionCookie: pure, builds a cookie-clearing header -------

{
  const insecureRequest = { headers: {} };
  const cookie = clearRaceDaySessionCookie(insecureRequest);
  assert.match(cookie, /^podium_race_day_session=;/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Max-Age=0/);
  assert.match(cookie, /Expires=/);
  assert.ok(!cookie.includes("Secure"), "no Secure flag over a plain, non-forwarded-https request");

  const secureRequest = { headers: { "x-forwarded-proto": "https" } };
  assert.match(clearRaceDaySessionCookie(secureRequest), /Secure/);
  console.log("clearRaceDaySessionCookie() checked: correct clearing attributes, and Secure only added when the request is actually HTTPS.");
}

// --- structural checks: the parts that need a live Supabase call ------------
// Matches this codebase's established convention (see test-team-instagram.mjs,
// test-fan-poll.mjs, test-photographer-billing.mjs) of asserting the real
// source code has the right shape when the function itself can't be safely
// exercised without a live database in an automated suite.

{
  const source = readSource("../lib/race_day_auth.mjs");

  // Privacy: verifyRaceDayCode must never let a caller distinguish "no such
  // code" from "code exists but is deactivated" from "code has expired" --
  // all three take the same failure path with the same message/status.
  const deniedMatch = source.match(/if \(!codeRow \|\| !codeRow\.active \|\| isExpired\) \{([\s\S]{0,200}?)\}/);
  assert.ok(deniedMatch, "verifyRaceDayCode has a single combined not-found-or-inactive-or-expired branch");
  assert.match(deniedMatch[1], /fail\(/, "the combined branch calls fail() with one shared message");

  // Rate limiting is checked before any DB lookup of the submitted code,
  // and a correct code is never itself logged as an attempt.
  const verifyBody = source.slice(source.indexOf("export async function verifyRaceDayCode"));
  const rateLimitIndex = verifyBody.indexOf("checkRateLimit(hashedIp)");
  const codeLookupIndex = verifyBody.indexOf("team_race_day_codes");
  assert.ok(rateLimitIndex !== -1 && rateLimitIndex < codeLookupIndex, "rate limit is checked before the code is looked up");

  // Regenerating must both replace the code (upsert on team_id) AND
  // invalidate every session issued under the old code -- otherwise a
  // "the code leaked, make a new one" response wouldn't actually work.
  const regenBody = source.slice(source.indexOf("export async function regenerateRaceDayCode"), source.indexOf("export async function revokeRaceDayCode"));
  assert.match(regenBody, /onConflict:\s*"team_id"/, "regenerate upserts on team_id -- one active code per team");
  assert.match(regenBody, /race_day_sessions.*\.delete\(\)/s, "regenerate deletes all existing race_day_sessions for the team");
  assert.match(regenBody, /expiresAt/, "regenerate sets an expiry on the new code");
  assert.match(regenBody, /codeHashIsTaken/, "regenerate checks for a collision against other teams' currently-active codes before accepting a candidate -- required now that the keyspace is only 10,000 values");

  // The collision check must only ever compare against OTHER teams (this
  // team's own current code is about to be overwritten by this exact
  // call, so it can never collide with itself), and only against codes
  // that are both active AND not yet expired -- an expired code's value
  // must be freely reusable.
  const collisionCheckBody = source.slice(source.indexOf("async function codeHashIsTaken"), source.indexOf("export async function regenerateRaceDayCode"));
  assert.match(collisionCheckBody, /neq\("team_id"/, "the collision check excludes this team's own row");
  assert.match(collisionCheckBody, /eq\("active",\s*true\)/, "the collision check only considers active codes");
  assert.match(collisionCheckBody, /gt\("expires_at"/, "the collision check only considers unexpired codes -- an expired code's value must be reusable");

  // A verified code must also be rejected once it's past its own
  // expires_at, using the same shared not-recognized error as a wrong or
  // deactivated code (never a distinguishable "expired" message).
  const verifyBody2 = source.slice(source.indexOf("export async function verifyRaceDayCode"), source.indexOf("async function resolveRaceDaySession"));
  assert.match(verifyBody2, /isExpired/, "verifyRaceDayCode checks the code's own expiry, not just active/inactive");

  // Revoking must also kill any live sessions, not just flip a flag no one
  // else checks.
  const revokeBody = source.slice(source.indexOf("export async function revokeRaceDayCode"));
  assert.match(revokeBody, /active:\s*false/, "revoke marks the code inactive");
  assert.match(revokeBody, /race_day_sessions.*\.delete\(\)/s, "revoke also deletes all existing race_day_sessions for the team");

  // requireSplitWatchAccess: bearer token path checked first, cookie
  // fallback second, reject (401) only if neither resolves -- and the
  // cookie path must confirm the session's own team_id matches the
  // requested team, never trusting the URL's team id alone.
  const accessBody = source.slice(source.indexOf("export async function requireSplitWatchAccess"));
  const bearerIndex = accessBody.indexOf("requireTeamUser(request)");
  const cookieIndex = accessBody.indexOf("resolveRaceDaySession(request)");
  const failIndex = accessBody.indexOf("fail(", cookieIndex);
  assert.ok(bearerIndex !== -1 && cookieIndex !== -1 && bearerIndex < cookieIndex, "bearer token is tried before the race-day cookie");
  assert.ok(failIndex > cookieIndex, "rejection only happens after both credential types have been tried");
  assert.match(accessBody.slice(cookieIndex, failIndex), /session\.teamId\s*===\s*teamId/, "cookie session's own team id must match the requested team id");

  console.log("lib/race_day_auth.mjs checked at the source level: same-error privacy for wrong vs. deactivated vs. expired codes, rate-limit-before-lookup ordering, regenerate's collision-retry against other teams' active+unexpired codes only, regenerate/revoke both invalidate live sessions, and dual-credential resolution order in requireSplitWatchAccess (live database verification still required after install/24 is run).");
}

{
  // Every Split Watch API handler must route through the one
  // unified access function -- not the old two-step
  // requireTeamUser+requireTeamMembership pattern, which would silently
  // exclude race-day-code visitors.
  const handlers = [
    "../api/split-watch/sessions.js",
    "../api/split-watch/sync.js",
    "../api/split-watch/plan.js",
    "../api/split-watch/review.js"
  ];
  for (const handlerPath of handlers) {
    const source = readSource(handlerPath);
    assert.match(source, /requireSplitWatchAccess/, `${handlerPath} calls the unified access function`);
    assert.ok(!/requireTeamMembership/.test(source), `${handlerPath} no longer calls requireTeamMembership directly (that's now inside requireSplitWatchAccess)`);
  }
  console.log("All four api/split-watch/*.js handlers checked to route through requireSplitWatchAccess(), not the old direct membership check.");
}

{
  // The public join endpoint must be reachable with no auth guard at all
  // (it IS the auth step) and must actually set a cookie on success.
  const source = readSource("../api/split-watch/join.js");
  assert.ok(!/requireTeamUser|requireTeamMembership|requireSplitWatchAccess/.test(source), "join.js has no auth guard of its own -- it's the public entry point");
  assert.match(source, /verifyRaceDayCode/);
  assert.match(source, /Set-Cookie/);

  // The owner-management endpoint is the opposite -- always a real coach
  // account, never accepts the race-day session as authorization for
  // managing the code itself.
  const manageSource = readSource("../api/team/race-day-code.js");
  assert.match(manageSource, /requireTeamUser/);
  assert.match(manageSource, /requireTeamMembership/);
  assert.ok(!/verifyRaceDayCode|resolveRaceDaySession/.test(manageSource), "race-day-code.js never accepts a race-day session as its own credential");
  console.log("api/split-watch/join.js (public, no guard) and api/team/race-day-code.js (real coach account required) checked for correct, opposite auth postures.");
}

{
  // The four existing Split Watch client scripts must no longer hard-redirect
  // before attempting a fetch just because there's no Supabase access
  // token -- a race-day-code visitor never has one, but does have a
  // cookie the server will accept. They should only redirect on an
  // actual 401 response.
  const clientScripts = [
    "../public/scripts/split-watch-hub.js",
    "../public/scripts/split-watch-plan.js",
    "../public/scripts/split-watch-live.js",
    "../public/scripts/split-watch-review.js"
  ];
  for (const scriptPath of clientScripts) {
    const source = readSource(scriptPath);
    assert.ok(!/if \(!accessToken\)/.test(source), `${scriptPath} no longer hard-blocks apiFetch on a missing access token`);
    assert.match(source, /response\.status === 401/, `${scriptPath} still redirects on an actual 401 response`);
    assert.match(source, /split-watch\/join/, `${scriptPath} redirects to the join page, not the coach login, on 401`);
  }
  console.log("All four split-watch-*.js client scripts checked: no pre-emptive redirect on a missing Supabase token, still redirect (to the join page) on a real 401.");
}

{
  // The join page must be a real, publicly reachable route -- registered
  // in the build, and reachable from the header's Split Watch nav
  // dropdown (rebuilt 2026-08-21, NAVIGATION_REBUILD_SPEC.md -- the
  // dropdown is now hardcoded directly in html.mjs's header()/
  // splitWatchNavDropdown() rather than driven from
  // site.mjs's navigation array, since it lives in the header's separate
  // utility cluster, not the content nav's grouped dropdowns).
  const buildSource = readSource("../scripts/build.mjs");
  assert.match(buildSource, /split-watch\/join\//);
  assert.match(buildSource, /splitWatchJoinPage/);

  const htmlLibSource = readSource("../src/lib/html.mjs");
  assert.match(htmlLibSource, /splitWatchNavDropdown/, "the header still renders the Split Watch nav dropdown");
  assert.match(htmlLibSource, /href="\/split-watch\/join\/"/, "the dropdown's trigger still links to the real join page");

  console.log("Split Watch join page checked: registered in the build, and reachable from the header's Split Watch nav dropdown.");
}

console.log("Race Day Access Code feature validation passed.");
