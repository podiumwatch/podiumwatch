import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY ||= "test-service-role-key";
process.env.VOTE_HASH_SECRET ||= "test-vote-hash-secret-at-least-32-characters-long";

const {
  computeMovement,
  countBallotsByWeekId,
  createVoterEmailHash,
  divisionColumnFor,
  divisionLabel,
  genderLabel,
  isValidDivisionNumber,
  isValidEmailFormat,
  isValidGender,
  isValidSport,
  maxDivisionForSport,
  normalizeEmail,
  sportLabel
} = await import("../lib/fan_poll_service.mjs");

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), "utf8");
}

function includesAll(text, values, label) {
  for (const value of values) {
    assert.ok(text.includes(value), `${label} is missing ${value}`);
  }
}

// --- divisionLabel / sportLabel / genderLabel -------------------------------

assert.equal(divisionLabel(1), "Division I");
assert.equal(divisionLabel(2), "Division II");
assert.equal(divisionLabel(3), "Division III");
assert.equal(divisionLabel(4), "Division IV");
assert.equal(divisionLabel(5), "Division V", "Track and field's 5th division must already work even though it isn't turned on for voters yet.");
assert.equal(sportLabel("cross_country"), "Cross Country");
assert.equal(sportLabel("outdoor_track"), "Track and Field");
assert.equal(genderLabel("boys"), "Boys");
assert.equal(genderLabel("girls"), "Girls");

// --- divisionColumnFor -------------------------------------------------------
// This is the exact mapping that determines which real team_pages column
// a ballot's eligible-team list is pulled from -- getting this wrong
// would mean a boys ballot could accidentally show girls teams or vice
// versa.

assert.equal(divisionColumnFor("cross_country", "boys"), "cross_country_boys_division");
assert.equal(divisionColumnFor("cross_country", "girls"), "cross_country_girls_division");
assert.equal(divisionColumnFor("indoor_track", "boys"), "track_boys_division");
assert.equal(divisionColumnFor("outdoor_track", "girls"), "track_girls_division");

// --- isValidSport / isValidGender / isValidDivisionNumber / maxDivisionForSport --

assert.ok(isValidSport("cross_country"));
assert.ok(isValidSport("indoor_track"));
assert.ok(!isValidSport("swimming"));
assert.ok(isValidGender("boys"));
assert.ok(isValidGender("girls"));
assert.ok(!isValidGender("mixed"));
assert.ok(isValidDivisionNumber(1));
assert.ok(isValidDivisionNumber(5));
assert.ok(!isValidDivisionNumber(0));
assert.ok(!isValidDivisionNumber(6));
assert.ok(!isValidDivisionNumber(2.5));
assert.equal(maxDivisionForSport("cross_country"), 4, "Cross country has 4 divisions on this site.");
assert.equal(maxDivisionForSport("indoor_track"), 5, "Track and field has 5 divisions on this site, not 4.");
assert.equal(maxDivisionForSport("outdoor_track"), 5);

// --- normalizeEmail / isValidEmailFormat ------------------------------------

assert.equal(normalizeEmail("  Coach@Example.COM  "), "coach@example.com");
assert.ok(isValidEmailFormat("coach@example.com"));
assert.ok(!isValidEmailFormat("not-an-email"));
assert.ok(!isValidEmailFormat(""));

// --- createVoterEmailHash ----------------------------------------------------
// Same principle as AOTW/TOTW's voter token hash: deterministic for the
// same input, different for different input, and the raw email is never
// recoverable from it (a hash, not an encoding).

{
  const hashA = createVoterEmailHash("coach@example.com");
  const hashB = createVoterEmailHash("coach@example.com");
  const hashC = createVoterEmailHash("COACH@EXAMPLE.COM");
  const hashD = createVoterEmailHash("other@example.com");

  assert.equal(hashA, hashB, "The same email must always hash the same way.");
  assert.equal(hashA, hashC, "Hashing must normalize case, the same as normalizeEmail does.");
  assert.notEqual(hashA, hashD, "Different emails must hash differently.");
  assert.equal(hashA.length, 64, "Must be a full SHA-256 hex digest.");
  assert.ok(!hashA.includes("@"), "The hash must never contain the raw email.");
}

// --- computeMovement ---------------------------------------------------------

assert.equal(
  computeMovement({ previousRank: null, currentRank: 3, hasPreviousWeek: false }),
  null,
  "No previous week at all (the division's first poll ever) must show no movement context, not \"new\"."
);
assert.equal(
  computeMovement({ previousRank: null, currentRank: 3, hasPreviousWeek: true }),
  "new",
  "A team not ranked last week but ranked this week must show as new."
);
assert.equal(
  computeMovement({ previousRank: 5, currentRank: 2, hasPreviousWeek: true }),
  3,
  "Moving from rank 5 to rank 2 is up 3 spots."
);
assert.equal(
  computeMovement({ previousRank: 2, currentRank: 5, hasPreviousWeek: true }),
  -3,
  "Moving from rank 2 to rank 5 is down 3 spots."
);
assert.equal(
  computeMovement({ previousRank: 4, currentRank: 4, hasPreviousWeek: true }),
  0,
  "Staying at the same rank is zero movement, not null or \"new\"."
);

// --- countBallotsByWeekId ----------------------------------------------------
// The admin dashboard's "how many ballots per division" count -- a
// different number than fan_poll_week_results.ballot_count, which counts
// (per team) how many ballots included that specific team, not the total
// number of voters who voted in that week/division at all.

{
  const counts = countBallotsByWeekId([
    { week_id: "week-a" },
    { week_id: "week-b" },
    { week_id: "week-a" },
    { week_id: "week-a" }
  ]);

  assert.equal(counts.get("week-a"), 3, "Three ballot rows for week-a must count as 3, not deduplicated or overwritten.");
  assert.equal(counts.get("week-b"), 1);
  assert.equal(counts.get("week-c"), undefined, "A week with no ballot rows at all must simply be absent from the map, not zero.");
}

assert.deepEqual(
  [...countBallotsByWeekId([]).entries()],
  [],
  "An empty ballot list must produce an empty map, not throw."
);

assert.deepEqual(
  [...countBallotsByWeekId(null).entries()],
  [],
  "A null/missing ballot list must be treated the same as empty, never throw."
);

{
  const counts = countBallotsByWeekId([{ week_id: "week-a" }, { week_id: null }, {}, { week_id: "week-a" }]);
  assert.equal(counts.get("week-a"), 2);
  assert.equal(counts.size, 1, "Rows with a missing/null week_id must be skipped entirely, never counted under a fake key.");
}

// --- Source guards for the parts that need a live database ----------------
// getEligibleTeams, submitBallot, and the admin week-management functions
// all require a real Supabase connection this fixture-only test file does
// not have (the fan poll tables also don't exist yet until install/09 is
// run). These guard the real safety properties in the source directly,
// the same way this project's other recent features do.

const serviceSource = await read("lib/fan_poll_service.mjs");
const ballotApiSource = await read("api/fan-poll/ballot.js");
const resultsApiSource = await read("api/fan-poll/index.js");
const adminApiSource = await read("api/admin/fan-poll.js");
const adminPageSource = await read("src/pages/adminfanpoll.mjs");
const adminScriptSource = await read("public/scripts/admin-fan-poll.js");
const migrationSource = await read("install/09_FAN_POLL.sql");

includesAll(
  serviceSource,
  ["getBallotCountsByWeek(weeks.map", "ballot_count: ballotCounts.get(week.id) || 0"],
  "listWeeks must attach a real per-week ballot_count -- the admin dashboard's \"ballots per division\" figure -- to every week it returns"
);

includesAll(
  adminPageSource,
  ["<th>Ballots</th>"],
  "The admin fan poll table must have a Ballots column header"
);

includesAll(
  adminScriptSource,
  ["Number(week.ballot_count) || 0"],
  "The admin fan poll table must render each week's real ballot_count, defaulting safely to 0 rather than showing \"undefined\""
);

includesAll(
  serviceSource,
  ["validateBallotShape(entries)", "eligibleTeamIds.has", "cast_fan_poll_ballot_v1"],
  "submitBallot must validate ballot shape and real team eligibility before ever calling the atomic vote-cast RPC"
);

assert.ok(
  serviceSource.indexOf("validateBallotShape(entries)") < serviceSource.indexOf('.rpc(\n    "cast_fan_poll_ballot_v1"'.trim()) ||
  serviceSource.indexOf("const teamIds = validateBallotShape(entries);") < serviceSource.indexOf("cast_fan_poll_ballot_v1"),
  "Ballot shape must be validated before the atomic RPC is ever called, the same order AOTW/TOTW validate their finalist/voter token before calling their own RPC."
);

includesAll(
  serviceSource,
  ["createHmac", "fanpoll-email:", "VOTE_HASH_SECRET"],
  "The voter email hash must use the same HMAC approach and secret as AOTW/TOTW's voter tokens"
);

assert.ok(
  !/fan_poll_ballots["'`]?\s*\)\s*\.insert\([^)]*\bemail\b/s.test(serviceSource),
  "fan_poll_ballots must never receive a raw email field -- only voter_email_hash."
);

includesAll(
  serviceSource,
  ["fan_poll_email_subscribers", "wantsResultsEmail === true"],
  "A real, sendable email must only ever be written to fan_poll_email_subscribers, and only when the opt-in box was actually checked"
);

includesAll(
  ballotApiSource,
  ["String(body.website || \"\").trim()", "addressHash(request)", "createHmac"],
  "The public ballot endpoint must check a honeypot field and hash (not store raw) the submitter's address"
);

includesAll(
  resultsApiSource,
  ["request.method !== \"POST\"", "getPollResults", "getEligibleTeams"],
  "The public results endpoint must be POST (matching this project's read convention) and return both results and eligible teams"
);

includesAll(
  adminApiSource,
  ["isAdminRequest(request)", "createWeek", "openVoting", "closeVoting", "listWeeks"],
  "The admin endpoint must require admin sign-in and expose week scheduling and open/close actions"
);

includesAll(
  migrationSource,
  [
    "create table if not exists public.fan_poll_weeks",
    "create table if not exists public.fan_poll_ballots",
    "create table if not exists public.fan_poll_ballot_entries",
    "create table if not exists public.fan_poll_email_subscribers",
    "unique (week_id, voter_email_hash)",
    "cast_fan_poll_ballot_v1",
    "begin;",
    "commit;"
  ],
  "The migration must create all four fan poll tables, the one-ballot-per-email-per-week constraint, and the atomic vote-cast function, wrapped in a transaction"
);

assert.ok(
  !/create table.*team_pages/i.test(migrationSource),
  "The migration must never attempt to create team_pages -- it already exists and is only ever referenced by foreign key here."
);

assert.ok(
  /division_number integer not null check \(\s*division_number between 1 and 5\s*\)/.test(migrationSource),
  "division_number must already allow up to 5 so track and field can be turned on later with no schema change, even though only divisions 1-4 (cross country) are used right now."
);

assert.ok(
  /17 - \(v_entry->>'rank_position'\)::integer/.test(migrationSource),
  "Points must be computed from rank_position inside the database function itself, never trusted from the caller -- the same principle as never trusting client-supplied scoring anywhere else in this project."
);

console.log("Fan Poll feature validation passed.");
console.log("Division/sport/gender labeling, division-to-column mapping, and division bounds (cross country 4, track 5) checked.");
console.log("Email normalization and HMAC voter-hash determinism/case-insensitivity checked.");
console.log("Movement math checked: first-ever week, newly ranked, up, down, and unchanged.");
console.log("Ballot validation order, hashed-not-raw email in the vote table, opt-in email separation, honeypot, and admin auth guarded at the source level (live database verification still required after install/09 is run).");
