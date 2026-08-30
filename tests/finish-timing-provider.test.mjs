import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseAthleteRows,
  parseTeamScores,
  normalizeResult,
  createSourceIdentity,
  parseMeetDateToIso,
  classifyMeetSport,
  looksLikeJuniorHighTeamName
} from "../lib/finish_timing_provider.mjs";
import { deriveSeasonYearFromMeetDate } from "../lib/athlete_foundation_service.mjs";

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "finish-timing-shelby-county-preview"
);

function loadFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(fixturesDir, name), "utf8"));
}

const meetDoc = loadFixture("meet.json");
const events = {
  2736: loadFixture("results-2736-jh-girls.json"),
  2737: loadFixture("results-2737-hs-girls.json"),
  2738: loadFixture("results-2738-jh-boys.json"),
  2739: loadFixture("results-2739-hs-boys.json")
};

test("meet.json's human-readable date parses to a real ISO date", () => {
  assert.equal(parseMeetDateToIso(meetDoc.date), "2026-08-25");
});

test("meet.json's type field classifies as cross country", () => {
  assert.equal(classifyMeetSport(meetDoc), "cross_country");
});

test("an unrecognized meet type is never guessed", () => {
  assert.equal(classifyMeetSport({ type: "track" }), null);
  assert.equal(classifyMeetSport({}), null);
});

function buildMeetContext() {
  const meetDateIso = parseMeetDateToIso(meetDoc.date);
  const sport = classifyMeetSport(meetDoc);
  return {
    meetId: String(meetDoc.meet_id),
    meetName: meetDoc.name,
    meetLocation: meetDoc.city,
    meetDateIso,
    sport,
    seasonYear: deriveSeasonYearFromMeetDate(meetDateIso, sport)
  };
}

test("the real Shelby County Preview meet reproduces the exact acceptance-test athlete counts", () => {
  const meetContext = buildMeetContext();
  const counts = {};

  for (const [eventId, eventDoc] of Object.entries(events)) {
    const rows = parseAthleteRows(meetContext, eventId, eventDoc);
    counts[eventId] = rows.length;
  }

  assert.equal(counts[2736], 46, "JH girls 1 mile");
  assert.equal(counts[2737], 55, "HS girls 2 mile");
  assert.equal(counts[2738], 94, "JH boys 1 mile");
  assert.equal(counts[2739], 95, "HS boys 2 mile");

  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  assert.equal(total, 290, "total athlete rows across all four events");
});

test("the real meet reproduces the exact acceptance-test team score counts", () => {
  const meetContext = buildMeetContext();
  const counts = {};

  for (const [eventId, eventDoc] of Object.entries(events)) {
    const athleteRows = parseAthleteRows(meetContext, eventId, eventDoc);
    const teamRows = parseTeamScores(meetContext, eventId, eventDoc, athleteRows);
    counts[eventId] = teamRows.length;
  }

  assert.equal(counts[2736], 8, "JH girls team rows");
  assert.equal(counts[2737], 9, "HS girls team rows");
  assert.equal(counts[2738], 9, "JH boys team rows");
  assert.equal(counts[2739], 8, "HS boys team rows");

  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  assert.equal(total, 34, "total team score rows across all four events");
});

test("junior high events classify as middle_school and high school events as high_school", () => {
  const meetContext = buildMeetContext();
  const jhGirlsRows = parseAthleteRows(meetContext, "2736", events["2736"]);
  const hsGirlsRows = parseAthleteRows(meetContext, "2737", events["2737"]);
  const jhBoysRows = parseAthleteRows(meetContext, "2738", events["2738"]);
  const hsBoysRows = parseAthleteRows(meetContext, "2739", events["2739"]);

  for (const row of jhGirlsRows) assert.equal(row.competitionLevel, "middle_school");
  for (const row of jhBoysRows) assert.equal(row.competitionLevel, "middle_school");
  for (const row of hsGirlsRows) assert.equal(row.competitionLevel, "high_school");
  for (const row of hsBoysRows) assert.equal(row.competitionLevel, "high_school");
});

test("every high school row resolves a real event key for 2 Mile cross country", () => {
  const meetContext = buildMeetContext();
  const hsGirlsRows = parseAthleteRows(meetContext, "2737", events["2737"]).map(normalizeResult);

  for (const row of hsGirlsRows) {
    assert.equal(row.eventName, "2 Mile");
    assert.equal(row.eventCode, "xc_2_mile");
  }
});

test("every junior high row resolves a real event key for 1 Mile cross country", () => {
  const meetContext = buildMeetContext();
  const jhBoysRows = parseAthleteRows(meetContext, "2738", events["2738"]).map(normalizeResult);

  for (const row of jhBoysRows) {
    assert.equal(row.eventName, "1 Mile");
    assert.equal(row.eventCode, "xc_1_mile");
  }
});

test("every athlete row carries a confirmed Ohio state and gender", () => {
  const meetContext = buildMeetContext();
  const rows = parseAthleteRows(meetContext, "2737", events["2737"]);

  for (const row of rows) {
    assert.equal(row.rawRow.state, "OH");
    assert.ok(row.gender === "boys" || row.gender === "girls");
    assert.ok(!row.warningCodes.includes("NON_OHIO_ATHLETE"));
    assert.ok(!row.warningCodes.includes("STATE_UNCONFIRMED"));
  }
});

test("a real Ohio athlete row carries a valid time mark and no missing-field warnings", () => {
  const meetContext = buildMeetContext();
  const rows = parseAthleteRows(meetContext, "2737", events["2737"]);
  const first = rows[0];

  assert.ok(first.markText);
  assert.ok(Number.isFinite(first.markValue));
  assert.ok(Number.isInteger(first.place));
  assert.equal(first.resultStatus, "OFFICIAL");
  assert.deepEqual(
    first.warningCodes.filter((code) => ["ATHLETE_OR_RELAY_MISSING", "SCHOOL_MISSING", "EVENT_MISSING", "MARK_MISSING"].includes(code)),
    []
  );
});

test("stable source identity is distinct from the per-row result fingerprint", () => {
  const meetContext = buildMeetContext();
  const rows = parseAthleteRows(meetContext, "2737", events["2737"]);
  const first = rows[0];
  const identity = createSourceIdentity({
    meetId: meetContext.meetId,
    eventId: "2737",
    athleteId: first.rawRow.providerAthleteId
  });

  assert.equal(identity, `finish-timing:meet:${meetContext.meetId}:event:2737:athlete:${first.rawRow.providerAthleteId}`);
  assert.notEqual(identity, first.resultFingerprint);
});

test("a corrected mark changes the result fingerprint but not the stable source identity", () => {
  const meetContext = buildMeetContext();
  const original = parseAthleteRows(meetContext, "2737", events["2737"])[0];

  const correctedEventDoc = JSON.parse(JSON.stringify(events["2737"]));
  const athleteIndex = correctedEventDoc.groups[0].athletes.findIndex(
    (athlete) => String(athlete.athlete_id) === original.rawRow.providerAthleteId
  );
  correctedEventDoc.groups[0].athletes[athleteIndex].splits[
    correctedEventDoc.groups[0].athletes[athleteIndex].splits.length - 1
  ].timeOriginal = "99:99.9";

  const corrected = parseAthleteRows(meetContext, "2737", correctedEventDoc).find(
    (row) => row.rawRow.providerAthleteId === original.rawRow.providerAthleteId
  );

  assert.notEqual(corrected.resultFingerprint, original.resultFingerprint);

  const originalIdentity = createSourceIdentity({ meetId: meetContext.meetId, eventId: "2737", athleteId: original.rawRow.providerAthleteId });
  const correctedIdentity = createSourceIdentity({ meetId: meetContext.meetId, eventId: "2737", athleteId: corrected.rawRow.providerAthleteId });
  assert.equal(originalIdentity, correctedIdentity);
});

test("team scoring rows preserve the real DNP place and blank score", () => {
  const meetContext = buildMeetContext();
  const athleteRows = parseAthleteRows(meetContext, "2736", events["2736"]);
  const teamRows = parseTeamScores(meetContext, "2736", events["2736"], athleteRows);
  const dnpRow = teamRows.find((row) => row.didNotPlace);

  assert.ok(dnpRow, "expected at least one real DNP team row in the JH girls event");
  assert.equal(dnpRow.placeText, "DNP");
  assert.equal(dnpRow.placeNumeric, null);
  assert.equal(dnpRow.score, null);
});

test("team scoring rows resolve a provider team id via the athlete rows", () => {
  const meetContext = buildMeetContext();
  const athleteRows = parseAthleteRows(meetContext, "2737", events["2737"]);
  const teamRows = parseTeamScores(meetContext, "2737", events["2737"], athleteRows);

  for (const row of teamRows) {
    assert.ok(row.providerTeamId, `team "${row.teamName}" should resolve a provider team id from its own athlete rows`);
  }
});

test("junior-high team names are detected by the shared suffix heuristic", () => {
  assert.ok(looksLikeJuniorHighTeamName("Anna MS"));
  assert.ok(looksLikeJuniorHighTeamName("Russia MS"));
  assert.ok(!looksLikeJuniorHighTeamName("Anna"));
  assert.ok(!looksLikeJuniorHighTeamName("Russia"));
});

test("no athlete row is duplicated when the same event document is parsed twice", () => {
  const meetContext = buildMeetContext();
  const first = parseAthleteRows(meetContext, "2737", events["2737"]);
  const second = parseAthleteRows(meetContext, "2737", events["2737"]);

  assert.equal(first.length, second.length);
  const firstFingerprints = new Set(first.map((row) => row.resultFingerprint));
  const secondFingerprints = new Set(second.map((row) => row.resultFingerprint));
  assert.equal(firstFingerprints.size, first.length, "every fingerprint in the first parse is unique");
  assert.deepEqual([...firstFingerprints].sort(), [...secondFingerprints].sort(), "re-parsing the identical document produces identical fingerprints");
});

test("a missing or unparseable results document produces zero rows, not a crash", () => {
  const meetContext = buildMeetContext();
  assert.deepEqual(parseAthleteRows(meetContext, "9999", null), []);
  assert.deepEqual(parseAthleteRows(meetContext, "9999", {}), []);
  assert.deepEqual(parseTeamScores(meetContext, "9999", null, []), []);
});
