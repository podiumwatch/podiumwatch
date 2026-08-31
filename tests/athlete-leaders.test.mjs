import test from "node:test";
import assert from "node:assert/strict";
import { keepFastestPerAthlete, findDivisionForSeason } from "../lib/athlete_leaders_service.mjs";

test("keeps only the fastest mark per athlete", () => {
  const rows = [
    { profile_id: "a", mark_value: 950, mark_text: "15:50" },
    { profile_id: "a", mark_value: 920, mark_text: "15:20" },
    { profile_id: "b", mark_value: 900, mark_text: "15:00" }
  ];
  const result = keepFastestPerAthlete(rows);
  assert.equal(result.length, 2);
  assert.equal(result.find((row) => row.profile_id === "a").mark_value, 920);
});

test("sorts the result fastest (lowest mark_value) first", () => {
  const rows = [
    { profile_id: "a", mark_value: 1000, mark_text: "16:40" },
    { profile_id: "b", mark_value: 900, mark_text: "15:00" },
    { profile_id: "c", mark_value: 950, mark_text: "15:50" }
  ];
  const result = keepFastestPerAthlete(rows);
  assert.deepEqual(result.map((row) => row.profile_id), ["b", "c", "a"]);
});

test("rows with no profile_id or a non-numeric mark_value are dropped, not crashed on", () => {
  const rows = [
    { profile_id: null, mark_value: 900 },
    { profile_id: "a", mark_value: null },
    { profile_id: "b", mark_value: 950, mark_text: "15:50" }
  ];
  const result = keepFastestPerAthlete(rows);
  assert.equal(result.length, 1);
  assert.equal(result[0].profile_id, "b");
});

test("an empty or missing list returns an empty array", () => {
  assert.deepEqual(keepFastestPerAthlete([]), []);
  assert.deepEqual(keepFastestPerAthlete(undefined), []);
});

test("findDivisionForSeason matches a row whose season range covers the requested year", () => {
  const rows = [{ division: "Division II", season_start_year: 2026, season_end_year: 2027 }];
  assert.equal(findDivisionForSeason(rows, 2026), "Division II");
  assert.equal(findDivisionForSeason(rows, 2027), "Division II");
});

test("findDivisionForSeason returns null when no row covers the requested year (a real, current data gap for pre-2026 seasons)", () => {
  const rows = [{ division: "Division II", season_start_year: 2026, season_end_year: 2027 }];
  assert.equal(findDivisionForSeason(rows, 2024), null);
});

test("findDivisionForSeason returns null for an empty or missing list", () => {
  assert.equal(findDivisionForSeason([], 2026), null);
  assert.equal(findDivisionForSeason(undefined, 2026), null);
});
