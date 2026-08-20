import assert from "node:assert/strict";
import fs from "node:fs";
import process from "node:process";

// lib/race_day_auth.mjs imports lib/supabase-admin.mjs, which calls
// createClient() at module load time and throws if these env vars are
// absent -- this suite only exercises the module's pure, no-database
// functions directly, but importing the module at all still triggers
// that top-level call. Matches the same fallback pattern
// scripts/test-race-command-center.mjs already uses for the same reason.
process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY ||= "test-service-role-key";

const {
  generateRaceDayCode,
  clearRaceDaySessionCookie
} = await import("../lib/race_day_auth.mjs");

function readSource(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

// --- generateRaceDayCode: pure, safe to call directly -----------------------

{
  const ALLOWED = new Set("ABCDEFGHJKMNPQRSTUVWXYZ23456789".split(""));
  const EXCLUDED = new Set("0O1IL".split(""));

  for (let i = 0; i < 500; i += 1) {
    const code = generateRaceDayCode();
    assert.equal(typeof code, "string");
    assert.equal(code.length, 8, "every generated code is exactly 8 characters");
    for (const char of code) {
      assert.ok(ALLOWED.has(char), `character '${char}' is in the allowed alphabet`);
      assert.ok(!EXCLUDED.has(char), `character '${char}' (easily misread) is never used`);
    }
  }
  console.log("generateRaceDayCode() checked: always 8 characters, always from the misread-safe alphabet (no 0/O/1/I/L), across 500 samples.");
}

{
  // Loose collision sanity check -- not a proof of uniqueness (32^8 space
  // makes a real collision astronomically unlikely), just a guard against
  // a broken generator that always returns the same code.
  const seen = new Set();
  for (let i = 0; i < 200; i += 1) seen.add(generateRaceDayCode());
  assert.equal(seen.size, 200, "200 generated codes are all distinct");
  console.log("generateRaceDayCode() checked for basic non-collision across 200 samples.");
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
  // code" from "code exists but is deactivated" -- both take the same
  // failure path with the same message/status.
  const deniedMatch = source.match(/if \(!codeRow \|\| !codeRow\.active\) \{([\s\S]{0,200}?)\}/);
  assert.ok(deniedMatch, "verifyRaceDayCode has a single combined not-found-or-inactive branch");
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

  // Revoking must also kill any live sessions, not just flip a flag no one
  // else checks.
  const revokeBody = source.slice(source.indexOf("export async function revokeRaceDayCode"));
  assert.match(revokeBody, /active:\s*false/, "revoke marks the code inactive");
  assert.match(revokeBody, /race_day_sessions.*\.delete\(\)/s, "revoke also deletes all existing race_day_sessions for the team");

  // requireRaceCommandCenterAccess: bearer token path checked first, cookie
  // fallback second, reject (401) only if neither resolves -- and the
  // cookie path must confirm the session's own team_id matches the
  // requested team, never trusting the URL's team id alone.
  const accessBody = source.slice(source.indexOf("export async function requireRaceCommandCenterAccess"));
  const bearerIndex = accessBody.indexOf("requireTeamUser(request)");
  const cookieIndex = accessBody.indexOf("resolveRaceDaySession(request)");
  const failIndex = accessBody.indexOf("fail(", cookieIndex);
  assert.ok(bearerIndex !== -1 && cookieIndex !== -1 && bearerIndex < cookieIndex, "bearer token is tried before the race-day cookie");
  assert.ok(failIndex > cookieIndex, "rejection only happens after both credential types have been tried");
  assert.match(accessBody.slice(cookieIndex, failIndex), /session\.teamId\s*===\s*teamId/, "cookie session's own team id must match the requested team id");

  console.log("lib/race_day_auth.mjs checked at the source level: same-error privacy for wrong vs. deactivated codes, rate-limit-before-lookup ordering, regenerate/revoke both invalidate live sessions, and dual-credential resolution order in requireRaceCommandCenterAccess (live database verification still required after install/19 is run).");
}

{
  // Every Race Command Center API handler must route through the one
  // unified access function -- not the old two-step
  // requireTeamUser+requireTeamMembership pattern, which would silently
  // exclude race-day-code visitors.
  const handlers = [
    "../api/race-command-center/sessions.js",
    "../api/race-command-center/sync.js",
    "../api/race-command-center/plan.js",
    "../api/race-command-center/review.js"
  ];
  for (const handlerPath of handlers) {
    const source = readSource(handlerPath);
    assert.match(source, /requireRaceCommandCenterAccess/, `${handlerPath} calls the unified access function`);
    assert.ok(!/requireTeamMembership/.test(source), `${handlerPath} no longer calls requireTeamMembership directly (that's now inside requireRaceCommandCenterAccess)`);
  }
  console.log("All four api/race-command-center/*.js handlers checked to route through requireRaceCommandCenterAccess(), not the old direct membership check.");
}

{
  // The public join endpoint must be reachable with no auth guard at all
  // (it IS the auth step) and must actually set a cookie on success.
  const source = readSource("../api/race-command-center/join.js");
  assert.ok(!/requireTeamUser|requireTeamMembership|requireRaceCommandCenterAccess/.test(source), "join.js has no auth guard of its own -- it's the public entry point");
  assert.match(source, /verifyRaceDayCode/);
  assert.match(source, /Set-Cookie/);

  // The owner-management endpoint is the opposite -- always a real coach
  // account, never accepts the race-day session as authorization for
  // managing the code itself.
  const manageSource = readSource("../api/team/race-day-code.js");
  assert.match(manageSource, /requireTeamUser/);
  assert.match(manageSource, /requireTeamMembership/);
  assert.ok(!/verifyRaceDayCode|resolveRaceDaySession/.test(manageSource), "race-day-code.js never accepts a race-day session as its own credential");
  console.log("api/race-command-center/join.js (public, no guard) and api/team/race-day-code.js (real coach account required) checked for correct, opposite auth postures.");
}

{
  // The four existing RCC client scripts must no longer hard-redirect
  // before attempting a fetch just because there's no Supabase access
  // token -- a race-day-code visitor never has one, but does have a
  // cookie the server will accept. They should only redirect on an
  // actual 401 response.
  const clientScripts = [
    "../public/scripts/race-command-center-hub.js",
    "../public/scripts/race-command-center-plan.js",
    "../public/scripts/race-command-center-live.js",
    "../public/scripts/race-command-center-review.js"
  ];
  for (const scriptPath of clientScripts) {
    const source = readSource(scriptPath);
    assert.ok(!/if \(!accessToken\)/.test(source), `${scriptPath} no longer hard-blocks apiFetch on a missing access token`);
    assert.match(source, /response\.status === 401/, `${scriptPath} still redirects on an actual 401 response`);
    assert.match(source, /race-command-center\/join/, `${scriptPath} redirects to the join page, not the coach login, on 401`);
  }
  console.log("All four race-command-center-*.js client scripts checked: no pre-emptive redirect on a missing Supabase token, still redirect (to the join page) on a real 401.");
}

{
  // The join page must be a real, publicly reachable route -- registered
  // in the build, present in site navigation and in the header's
  // primaryLabels filter (src/lib/html.mjs silently drops any nav entry
  // not also listed there), and NOT present in any of the private-route
  // lists that would make it require sign-in.
  const buildSource = readSource("../scripts/build.mjs");
  assert.match(buildSource, /race-command-center\/join\//);
  assert.match(buildSource, /raceCommandCenterJoinPage/);

  const siteSource = readSource("../src/config/site.mjs");
  assert.match(siteSource, /label:\s*"Race Command Center"/);

  const htmlLibSource = readSource("../src/lib/html.mjs");
  assert.match(htmlLibSource, /"Race Command Center"/, "primaryLabels includes the new nav entry, or it silently won't render in the header");

  console.log("Race Command Center join page checked: registered in the build, present in site nav, and included in the header's primaryLabels filter.");
}

console.log("Race Day Access Code feature validation passed.");
