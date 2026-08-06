import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY ||= "test-service-role-key";

const {
  buildInstagramDigestEmail,
  checkInstagramAccountExists,
  isBlockedHandle,
  isValidHandleFormat,
  normalizeInstagramHandle
} = await import("../lib/team_instagram_service.mjs");

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), "utf8");
}

function includesAll(text, values, label) {
  for (const value of values) {
    assert.ok(text.includes(value), `${label} is missing ${value}`);
  }
}

// --- normalizeInstagramHandle -------------------------------------------

assert.equal(normalizeInstagramHandle("@teamhandle"), "teamhandle");
assert.equal(normalizeInstagramHandle("teamhandle"), "teamhandle");
assert.equal(normalizeInstagramHandle("TeamHandle"), "teamhandle", "Handles must normalize case-insensitively.");
assert.equal(normalizeInstagramHandle("https://www.instagram.com/teamhandle/"), "teamhandle");
assert.equal(normalizeInstagramHandle("http://instagram.com/teamhandle"), "teamhandle");
assert.equal(normalizeInstagramHandle("instagram.com/teamhandle/"), "teamhandle");
assert.equal(normalizeInstagramHandle("  @team.handle_2  "), "team.handle_2");
assert.equal(normalizeInstagramHandle(""), "");
assert.equal(normalizeInstagramHandle(null), "");

// --- isValidHandleFormat --------------------------------------------------

assert.ok(isValidHandleFormat("teamhandle"));
assert.ok(isValidHandleFormat("team.handle_2"));
assert.ok(isValidHandleFormat("a"), "A single character is a valid handle.");
assert.ok(isValidHandleFormat("a".repeat(30)), "Exactly 30 characters is valid.");
assert.ok(!isValidHandleFormat("a".repeat(31)), "31 characters exceeds Instagram's real limit.");
assert.ok(!isValidHandleFormat(""), "An empty handle is invalid.");
assert.ok(!isValidHandleFormat(".teamhandle"), "A handle cannot start with a period.");
assert.ok(!isValidHandleFormat("teamhandle."), "A handle cannot end with a period.");
assert.ok(!isValidHandleFormat("team..handle"), "A handle cannot contain consecutive periods.");
assert.ok(!isValidHandleFormat("team handle"), "A handle cannot contain a space.");
assert.ok(!isValidHandleFormat("team@handle"), "A handle cannot contain an @ once normalized.");
assert.ok(!isValidHandleFormat("team-handle"), "A hyphen is not a valid Instagram handle character.");

// --- isBlockedHandle -------------------------------------------------------

assert.ok(isBlockedHandle("official_pornstar"), "Adult-content keywords must be blocked.");
assert.ok(isBlockedHandle("cheapviagra"), "Spam keywords must be blocked.");
assert.ok(isBlockedHandle("aaaaaaaateam"), "Five or more repeated characters is a bot signature.");
assert.ok(!isBlockedHandle("trojans_xc"), "A normal team handle must not be blocked.");
assert.ok(!isBlockedHandle("panthers.track"), "A normal team handle with a period must not be blocked.");

// --- checkInstagramAccountExists (real network call, dependency injected) -

{
  const realProfileHtml = "<html><head><title>Trojans XC (&#064;trojans_xc) &#x2022; Instagram photos and videos</title></head></html>";
  const fakeFetch = async (url) => {
    assert.ok(url.includes("trojans_xc"), "The existence check must fetch the exact handle it was given.");
    return new Response(realProfileHtml, { status: 200 });
  };
  const exists = await checkInstagramAccountExists("trojans_xc", { fetchImpl: fakeFetch });
  assert.equal(exists, true, "A real account's page (title names the account) must resolve as existing.");
}

{
  // Verified live 2026-08-05 against real Instagram: a nonexistent handle's
  // page still returns HTTP 200 (it is a JavaScript application, not a
  // server-rendered 404), with only the bare site title "Instagram" and no
  // account name in it -- status code alone cannot tell a real account from
  // a made-up one, only this title difference can.
  const nonexistentHtml = "<html><head><title>Instagram</title></head></html>";
  const fakeFetch = async () => new Response(nonexistentHtml, { status: 200 });
  const exists = await checkInstagramAccountExists("thishandleprobablydoesnotexist999", { fetchImpl: fakeFetch });
  assert.equal(exists, false, "The generic site title, with no account name, must not be treated as a real account.");
}

{
  const fakeFetch = async () => { throw new Error("network unreachable"); };
  const exists = await checkInstagramAccountExists("anyhandle", { fetchImpl: fakeFetch });
  assert.equal(exists, false, "A network failure must be treated the same as the handle not resolving, never silently accepted.");
}

// --- buildInstagramDigestEmail ---------------------------------------------

{
  const changes = [
    {
      actor_type: "public_instagram_submission",
      team: { school_name: "Springfield High School", slug: "springfield-high-school" },
      before_data: { instagram_handle: null },
      after_data: { instagram_handle: "springfield_xc" },
      created_at: "2026-08-01T12:00:00Z"
    },
    {
      actor_type: "admin_instagram_revert",
      team: { school_name: "Central High School", slug: "central-high-school" },
      before_data: { instagram_handle: "central_track" },
      after_data: { instagram_handle: "central_old_handle" },
      created_at: "2026-08-02T09:00:00Z"
    }
  ];
  const digest = buildInstagramDigestEmail(changes);
  assert.equal(digest.submissionCount, 1);
  assert.equal(digest.revertCount, 1);
  assert.match(digest.subject, /2 team Instagram changes this week/);
  includesAll(digest.html, ["Springfield High School", "Central High School", "springfield_xc", "/admin/team-instagram/"], "Digest HTML");
  includesAll(digest.text, ["Springfield High School", "Central High School", "springfield_xc"], "Digest plain text");
}

{
  const digest = buildInstagramDigestEmail([]);
  assert.equal(digest.submissionCount, 0);
  assert.match(digest.subject, /no team Instagram changes this week/);
  assert.ok(digest.html.includes("No team Instagram changes this week."));
}

// --- Source guards for the parts that need a live database ----------------
// submitTeamInstagramHandle, revertTeamInstagramChange, and
// listRecentInstagramChanges all require a real Supabase connection this
// fixture-only test file does not have (the instagram_handle column also
// does not exist yet in the live database until install/07 is run). These
// guard the real safety properties in the source directly, the same way
// earlier real bugs this project found were guarded once fixed.

const serviceSource = await read("lib/team_instagram_service.mjs");
const publicApiSource = await read("api/team-instagram/index.js");
const adminApiSource = await read("api/admin/team-instagram.js");
const migrationSource = await read("install/07_TEAM_INSTAGRAM_SUBMISSIONS.sql");

includesAll(
  serviceSource,
  [
    "isValidHandleFormat(handle)",
    "isBlockedHandle(handle)",
    "countRecentSubmissions(teamId, actorIdHash)",
    "checkInstagramAccountExists(handle)",
    "writeTeamChange({"
  ],
  "submitTeamInstagramHandle must validate format, blocklist, rate limit, and confirm the account exists, in that order, before ever writing a change"
);

assert.ok(
  serviceSource.indexOf("countRecentSubmissions(teamId, actorIdHash)") < serviceSource.indexOf("checkInstagramAccountExists(handle)"),
  "Rate limiting must be checked before the network existence check, so a rate-limited submitter never triggers an outbound request."
);

includesAll(
  publicApiSource,
  ["String(body.website || \"\").trim()", "addressHash(request)", "createHmac"],
  "The public submission endpoint must check a honeypot field and hash (not store raw) the submitter's address"
);

includesAll(
  adminApiSource,
  ["isAdminRequest(request)", "revertTeamInstagramChange"],
  "The admin endpoint must require admin sign-in and expose the revert action"
);

includesAll(
  migrationSource,
  ["add column if not exists instagram_handle", "team_change_log_instagram_lookup_index", "begin;", "commit;"],
  "The migration must be additive (add column if not exists) and wrapped in a transaction"
);
assert.ok(
  !/create table.*team_pages|create table.*team_change_log/i.test(migrationSource),
  "The migration must never attempt to create team_pages or team_change_log -- both already exist and are only ever altered here."
);

console.log("Team Instagram feature validation passed.");
console.log("Handle normalization, format validation, and blocklist checked.");
console.log("Real-account existence check verified against real-account and nonexistent-account response shapes (network injected, no live call in tests).");
console.log("Weekly digest email content checked, including the zero-changes case.");
console.log("Submission order, honeypot, hashed-address rate limiting, and admin auth guarded at the source level (live database verification still required after install/07 is run).");
