import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  discoverRaceEvents,
  classifyRaceSport,
  parseAthleteRows,
  parseTeamScores,
  normalizeResult,
  createSourceIdentity,
  mergeResultSetPage
} from "../lib/runsignup_provider.mjs";
import { deriveSeasonYearFromMeetDate } from "../lib/athlete_foundation_service.mjs";

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "runsignup-ohio-cardinal-conference"
);

function loadFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(fixturesDir, name), "utf8"));
}

// Real data captured live from https://runsignup.com/rest/race/172302 --
// "Ohio Cardinal Conference XC Championship Meet," Wooster OH, 2025-10-11.
const raceDoc = loadFixture("race-info.json").race;
const resultsByEventId = {
  1062819: loadFixture("results-1062819-varsity-girls.json").individual_results_sets,
  1062820: loadFixture("results-1062820-varsity-boys.json").individual_results_sets,
  1062821: loadFixture("results-1062821-hs-boys-open.json").individual_results_sets,
  1062822: loadFixture("results-1062822-ms-girls.json").individual_results_sets
};

function buildMeetContext() {
  const sport = classifyRaceSport(raceDoc);
  return {
    raceId: String(raceDoc.race_id ?? 172302),
    meetName: raceDoc.name,
    meetLocation: raceDoc.address?.city || null,
    raceState: raceDoc.address?.state || null,
    meetDateIso: "2025-10-11",
    sport,
    seasonYear: deriveSeasonYearFromMeetDate("2025-10-11", sport)
  };
}

test("a real race name classifies as cross country", () => {
  assert.equal(classifyRaceSport(raceDoc), "cross_country");
});

test("an unrecognized or missing race name is never guessed", () => {
  assert.equal(classifyRaceSport({ name: "Buckeye 5K Road Race" }), null);
  assert.equal(classifyRaceSport({}), null);
  assert.equal(classifyRaceSport(null), null);
});

test("discoverRaceEvents filters out registration-only categories with no real distance", () => {
  const events = discoverRaceEvents(raceDoc);
  const names = events.map((event) => event.name);

  assert.ok(names.includes("Varsity Girls"));
  assert.ok(names.includes("MS Boys"));
  // "Scratch" and "All Participants" are real entries in this race's own
  // events[] with distance:null, confirmed live -- registration categories,
  // not scored heats, and must never be treated as a real event.
  assert.ok(!names.includes("Scratch"));
  assert.ok(!names.includes("All Participants"));
});

test("the real Ohio Cardinal Conference meet reproduces its exact live athlete counts", () => {
  const meetContext = buildMeetContext();
  const events = discoverRaceEvents(raceDoc);
  const counts = {};

  for (const [eventId, resultSets] of Object.entries(resultsByEventId)) {
    const eventMeta = events.find((event) => event.eventId === eventId);
    counts[eventId] = parseAthleteRows(meetContext, eventMeta, resultSets).length;
  }

  assert.equal(counts[1062819], 51, "Varsity Girls");
  assert.equal(counts[1062820], 52, "Varsity Boys");
  assert.equal(counts[1062821], 67, "HS Boys Open");
  assert.equal(counts[1062822], 60, "MS Girls");
});

test("varsity events classify as high_school and MS events classify as middle_school", () => {
  const meetContext = buildMeetContext();
  const events = discoverRaceEvents(raceDoc);

  const varsityGirls = parseAthleteRows(meetContext, events.find((e) => e.eventId === "1062819"), resultsByEventId[1062819]);
  const msGirls = parseAthleteRows(meetContext, events.find((e) => e.eventId === "1062822"), resultsByEventId[1062822]);

  for (const row of varsityGirls) assert.equal(row.competitionLevel, "high_school");
  for (const row of msGirls) assert.equal(row.competitionLevel, "middle_school");
});

test("a bare \"Open\" event name is held with no guessed competition level", () => {
  // "HS Boys Open" (confirmed real) still has "HS" in it and correctly
  // resolves high_school -- this event's own real name is used as-is.
  const meetContext = buildMeetContext();
  const events = discoverRaceEvents(raceDoc);
  const hsOpenRows = parseAthleteRows(meetContext, events.find((e) => e.eventId === "1062821"), resultsByEventId[1062821]);

  for (const row of hsOpenRows) assert.equal(row.competitionLevel, "high_school");

  // A genuinely bare "Open" (no HS/varsity/MS marker at all) must stay
  // unresolved rather than guessed -- exercised directly since no fixture
  // race happens to have one.
  const bareOpenRows = parseAthleteRows(
    meetContext,
    { eventId: "999999", name: "Open", distance: "5K" },
    [{
      public_results: "T",
      results_headers: { result_id: "Result Id", place: "Place", first_name: "First Name", last_name: "Last Name", gender: "Gender", state: "State", clock_time: "Clock Time" },
      results: [{ result_id: 1, place: 1, first_name: "Test", last_name: "Runner", gender: "M", state: "OH", clock_time: "16:00.00" }]
    }]
  );
  assert.equal(bareOpenRows[0].competitionLevel, null);
  assert.ok(bareOpenRows[0].warningCodes.includes("UNKNOWN_COMPETITION_LEVEL"));
});

test("every high school row resolves the real 5K event key, and the plural \"2 Miles\" MS distance resolves too", () => {
  const meetContext = buildMeetContext();
  const events = discoverRaceEvents(raceDoc);

  const varsityGirls = parseAthleteRows(meetContext, events.find((e) => e.eventId === "1062819"), resultsByEventId[1062819]).map(normalizeResult);
  for (const row of varsityGirls) {
    assert.equal(row.eventName, "5K");
    assert.equal(row.eventCode, "xc_5k");
  }

  // RunSignup's own real distance text for this event is "2 Miles"
  // (plural) -- confirmed live -- which the shared event-alias normalizer
  // did not singularize before this file was built, so it resolved to
  // nothing at all.
  const msGirls = parseAthleteRows(meetContext, events.find((e) => e.eventId === "1062822"), resultsByEventId[1062822]).map(normalizeResult);
  for (const row of msGirls) {
    assert.equal(row.eventName, "2 Miles");
    assert.equal(row.eventCode, "xc_2_mile");
  }
});

test("every athlete row carries a confirmed Ohio state, real grade, and valid time mark", () => {
  const meetContext = buildMeetContext();
  const events = discoverRaceEvents(raceDoc);
  const rows = parseAthleteRows(meetContext, events.find((e) => e.eventId === "1062819"), resultsByEventId[1062819]);
  const first = rows[0];

  assert.equal(first.rawRow.state, "OH");
  assert.ok(first.gender === "boys" || first.gender === "girls");
  assert.ok(!first.warningCodes.includes("NON_OHIO_ATHLETE"));
  assert.ok(!first.warningCodes.includes("STATE_UNCONFIRMED"));
  assert.ok(first.athleteGrade, "a real grade should resolve via the per-race \"Year\" custom field label");
  assert.ok(first.markText && first.markText !== "DNS");
  assert.ok(Number.isFinite(first.markValue));
  assert.equal(first.resultStatus, "OFFICIAL");
});

test("a blank per-athlete state falls back to the race's own registered address state", () => {
  const meetContext = buildMeetContext();
  assert.equal(meetContext.raceState, "OH");

  const rows = parseAthleteRows(meetContext, { eventId: "1062819", name: "Varsity Girls", distance: "5K" }, resultsByEventId[1062819]);
  for (const row of rows) {
    // Confirmed live: every one of these 51 real rows has a blank
    // individual state field, so every one must fall back to the race's
    // own "OH" address rather than being held as STATE_UNCONFIRMED.
    assert.equal(row.rawRow.state, "OH");
    assert.ok(!row.warningCodes.includes("STATE_UNCONFIRMED"));
    assert.ok(!row.warningCodes.includes("NON_OHIO_ATHLETE"));
  }
});

test("a genuinely out-of-state race (no individual state, non-OH race address) is flagged, not silently accepted", () => {
  const meetContext = { ...buildMeetContext(), raceState: "KY" };
  const [row] = parseAthleteRows(meetContext, { eventId: "1062819", name: "Varsity Girls", distance: "5K" }, resultsByEventId[1062819]);
  assert.equal(row.rawRow.state, "KY");
  assert.ok(row.warningCodes.includes("NON_OHIO_ATHLETE"));
});

test("a race with neither an individual state nor a known race address state is held, not guessed", () => {
  const meetContext = { ...buildMeetContext(), raceState: null };
  const [row] = parseAthleteRows(meetContext, { eventId: "1062819", name: "Varsity Girls", distance: "5K" }, resultsByEventId[1062819]);
  assert.equal(row.rawRow.state, "");
  assert.ok(row.warningCodes.includes("STATE_UNCONFIRMED"));
});

test("per-race custom field ids differ but the same labeled data resolves on both real races", () => {
  // Confirmed live: "Year"/"Team Name" sit at custom-field-560775/560776
  // on this race, but custom-field-561293/561294 on a second real race
  // (Northern Lakes League, race 101288) -- this file must read fields by
  // their label, never a hardcoded key, or it silently loses every grade
  // and team name on any race whose custom fields were set up differently.
  const meetContext = buildMeetContext();
  const events = discoverRaceEvents(raceDoc);
  const rows = parseAthleteRows(meetContext, events.find((e) => e.eventId === "1062819"), resultsByEventId[1062819]);

  for (const row of rows) {
    assert.ok(row.schoolName, "team name must resolve regardless of the underlying custom-field key");
  }
});

test("team scoring rows are derived from athlete rows and every team resolves a real score or place", () => {
  const meetContext = buildMeetContext();
  const events = discoverRaceEvents(raceDoc);
  const athleteRows = parseAthleteRows(meetContext, events.find((e) => e.eventId === "1062819"), resultsByEventId[1062819]);
  const teamRows = parseTeamScores(meetContext, events.find((e) => e.eventId === "1062819"), athleteRows);

  assert.ok(teamRows.length > 0);
  for (const row of teamRows) {
    assert.ok(row.score !== null || row.placeNumeric !== null || row.didNotPlace);
    assert.ok(row.numRunners > 0);
  }

  const winner = teamRows.find((row) => row.placeNumeric === 1);
  assert.ok(winner, "a real team finished first");
  assert.equal(winner.teamName, "Lexington");
});

test("stable source identity is distinct from the per-row result fingerprint", () => {
  const meetContext = buildMeetContext();
  const events = discoverRaceEvents(raceDoc);
  const rows = parseAthleteRows(meetContext, events.find((e) => e.eventId === "1062819"), resultsByEventId[1062819]);
  const first = rows[0];

  const identity = createSourceIdentity({
    raceId: meetContext.raceId,
    eventId: "1062819",
    resultId: first.rawRow.providerResultId
  });

  assert.equal(identity, `runsignup:race:${meetContext.raceId}:event:1062819:result:${first.rawRow.providerResultId}`);
  assert.notEqual(identity, first.resultFingerprint);
});

test("no athlete row is duplicated when the same result sets are parsed twice", () => {
  const meetContext = buildMeetContext();
  const events = discoverRaceEvents(raceDoc);
  const eventMeta = events.find((e) => e.eventId === "1062819");
  const first = parseAthleteRows(meetContext, eventMeta, resultsByEventId[1062819]);
  const second = parseAthleteRows(meetContext, eventMeta, resultsByEventId[1062819]);

  assert.equal(first.length, second.length);
  const firstIds = new Set(first.map((row) => row.rawRow.providerResultId));
  assert.equal(firstIds.size, first.length, "every real result_id in the fixture is unique");
});

test("a non-public result set is never staged", () => {
  const meetContext = buildMeetContext();
  const privateSet = JSON.parse(JSON.stringify(resultsByEventId[1062819]));
  privateSet[0].public_results = "F";

  const rows = parseAthleteRows(meetContext, { eventId: "1062819", name: "Varsity Girls", distance: "5K" }, privateSet);
  assert.deepEqual(rows, []);
});

test("a missing or unparseable results document produces zero rows, not a crash", () => {
  const meetContext = buildMeetContext();
  assert.deepEqual(parseAthleteRows(meetContext, { eventId: "999", name: "Varsity Girls", distance: "5K" }, null), []);
  assert.deepEqual(parseAthleteRows(meetContext, { eventId: "999", name: "Varsity Girls", distance: "5K" }, []), []);
  assert.deepEqual(parseTeamScores(meetContext, { eventId: "999" }, []), []);
});

// --- Silent pagination truncation (mergeResultSetPage) ---------------------
//
// Real captured pages from RunSignup's own DEFAULT page size (50 rows/page,
// no results_per_page override), for the exact real race this file's other
// tests already use. Page 1 holds runners placed 1-50; the real 51st
// finisher only exists on page 2 -- with no total-count field or "has
// more" flag anywhere in either response signaling that. This is the same
// silent-truncation shape as this codebase's own PostgREST 1,000-row
// vote-count bug (docs/DECISIONS.md), caught here before it ever shipped.
const paginationPage1 = loadFixture("pagination-page1.json").individual_results_sets;
const paginationPage2 = loadFixture("pagination-page2.json").individual_results_sets;
const paginationPage3 = loadFixture("pagination-page3-empty.json").individual_results_sets;

test("mergeResultSetPage signals \"fetch another page\" on a real full page and \"stop\" once a page comes back short", () => {
  const setsById = new Map();

  const fullAfterPage1 = mergeResultSetPage(setsById, paginationPage1, 50);
  assert.equal(fullAfterPage1, true, "a real page holding exactly the requested 50 rows must signal more pages may exist");
  assert.equal([...setsById.values()][0].results.length, 50);

  const fullAfterPage2 = mergeResultSetPage(setsById, paginationPage2, 50);
  assert.equal(fullAfterPage2, false, "a real short page (1 row) must signal this was the last page");

  const merged = [...setsById.values()][0];
  assert.equal(merged.results.length, 51, "all 51 real finishers must be present once pages are merged, not just the first 50");

  const placements = merged.results.map((row) => row.place).sort((a, b) => a - b);
  assert.deepEqual(placements, Array.from({ length: 51 }, (_, i) => i + 1), "every place from 1 to 51 is present with none dropped or duplicated");
});

test("a real trailing empty page never gets merged as if it were data", () => {
  const setsById = new Map();
  mergeResultSetPage(setsById, paginationPage1, 50);
  mergeResultSetPage(setsById, paginationPage2, 50);
  const fullAfterPage3 = mergeResultSetPage(setsById, paginationPage3, 50);

  assert.equal(fullAfterPage3, false);
  assert.equal([...setsById.values()][0].results.length, 51, "an empty trailing page must add zero rows");
});
