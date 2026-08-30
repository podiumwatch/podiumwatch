import test from "node:test";
import assert from "node:assert/strict";
import { evaluateFinishTimingEligibility } from "../lib/finish_timing_ingestion_service.mjs";

function safeRow(overrides = {}) {
  return {
    competition_level: "high_school",
    matched_athlete_id: "11111111-1111-1111-1111-111111111111",
    matched_school_id: "22222222-2222-2222-2222-222222222222",
    gender: "girls",
    event_code: "xc_2_mile",
    result_status: "OFFICIAL",
    mark_value: 900.4,
    place: 23,
    meet_date: "2026-08-25",
    season_year: 2026,
    sport: "cross_country",
    warning_codes: [],
    ...overrides
  };
}

test("a fully safe row is eligible with no reasons", () => {
  const result = evaluateFinishTimingEligibility(safeRow());
  assert.equal(result.eligible, true);
  assert.deepEqual(result.reasons, []);
});

test("a junior high row is never eligible", () => {
  const result = evaluateFinishTimingEligibility(safeRow({ competition_level: "middle_school" }));
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("NOT_CONFIDENTLY_HIGH_SCHOOL"));
});

test("an unresolved competition level is never eligible", () => {
  const result = evaluateFinishTimingEligibility(safeRow({ competition_level: null }));
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("NOT_CONFIDENTLY_HIGH_SCHOOL"));
});

test("no confidently matched athlete blocks eligibility", () => {
  const result = evaluateFinishTimingEligibility(safeRow({ matched_athlete_id: null }));
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("ATHLETE_NOT_CONFIDENTLY_MATCHED"));
});

test("no confidently matched school blocks eligibility", () => {
  const result = evaluateFinishTimingEligibility(safeRow({ matched_school_id: null }));
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("SCHOOL_NOT_CONFIDENTLY_MATCHED"));
});

test("an unknown gender blocks eligibility", () => {
  const result = evaluateFinishTimingEligibility(safeRow({ gender: "unspecified" }));
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("GENDER_UNKNOWN"));
});

test("an unresolved event blocks eligibility", () => {
  const result = evaluateFinishTimingEligibility(safeRow({ event_code: null }));
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("EVENT_UNRESOLVED"));
});

test("a missing mark on an official result blocks eligibility", () => {
  const result = evaluateFinishTimingEligibility(safeRow({ mark_value: null }));
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("INVALID_MARK"));
});

test("a zero or negative mark value blocks eligibility", () => {
  assert.equal(evaluateFinishTimingEligibility(safeRow({ mark_value: 0 })).eligible, false);
  assert.equal(evaluateFinishTimingEligibility(safeRow({ mark_value: -5 })).eligible, false);
});

test("a DNF or DNS status is eligible with no mark value -- it is a real, legitimate status, not an invalid row", () => {
  assert.equal(evaluateFinishTimingEligibility(safeRow({ result_status: "DNF", mark_value: null })).eligible, true);
  assert.equal(evaluateFinishTimingEligibility(safeRow({ result_status: "DNS", mark_value: null })).eligible, true);
});

test("place is optional -- a missing place never blocks eligibility on its own", () => {
  const result = evaluateFinishTimingEligibility(safeRow({ place: null }));
  assert.equal(result.eligible, true);
});

test("an invalid place blocks eligibility when one is present", () => {
  assert.equal(evaluateFinishTimingEligibility(safeRow({ place: 0 })).eligible, false);
  assert.equal(evaluateFinishTimingEligibility(safeRow({ place: -1 })).eligible, false);
  assert.equal(evaluateFinishTimingEligibility(safeRow({ place: 1.5 })).eligible, false);
});

test("an unparseable meet date blocks eligibility", () => {
  const result = evaluateFinishTimingEligibility(safeRow({ meet_date: "not-a-date" }));
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("INVALID_MEET_DATE"));
});

test("a missing season year blocks eligibility", () => {
  const result = evaluateFinishTimingEligibility(safeRow({ season_year: null }));
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("SEASON_YEAR_UNRESOLVED"));
});

test("track sport rows are held until a future pass confirms real track data", () => {
  const result = evaluateFinishTimingEligibility(safeRow({ sport: "outdoor_track" }));
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("SPORT_NOT_YET_SUPPORTED"));
});

test("a non-Ohio or state-unconfirmed warning always blocks eligibility", () => {
  assert.equal(evaluateFinishTimingEligibility(safeRow({ warning_codes: ["NON_OHIO_ATHLETE"] })).eligible, false);
  assert.equal(evaluateFinishTimingEligibility(safeRow({ warning_codes: ["STATE_UNCONFIRMED"] })).eligible, false);
});

test("an ambiguous or unmatched identity warning always blocks eligibility", () => {
  assert.equal(evaluateFinishTimingEligibility(safeRow({ warning_codes: ["AMBIGUOUS_IDENTITY"] })).eligible, false);
  assert.equal(evaluateFinishTimingEligibility(safeRow({ warning_codes: ["IDENTITY_UNMATCHED"] })).eligible, false);
});

test("an inconsistent level signal or unverified track event name always blocks eligibility", () => {
  assert.equal(evaluateFinishTimingEligibility(safeRow({ warning_codes: ["INCONSISTENT_LEVEL_SIGNAL"] })).eligible, false);
  assert.equal(evaluateFinishTimingEligibility(safeRow({ warning_codes: ["TRACK_EVENT_NAME_UNVERIFIED"] })).eligible, false);
});

test("reasons never contain duplicates even when multiple rules overlap", () => {
  const result = evaluateFinishTimingEligibility(safeRow({
    competition_level: null,
    matched_athlete_id: null,
    matched_school_id: null,
    warning_codes: ["AMBIGUOUS_IDENTITY", "NON_OHIO_ATHLETE"]
  }));
  assert.equal(result.reasons.length, new Set(result.reasons).size);
});
