import test from "node:test";
import assert from "node:assert/strict";
import { loadStatePicksField, picksLocked, tallyPicks, validateEntry } from "../lib/state_picks_service.mjs";

// Pure checks only (no database): lib/state_picks_service.mjs loads
// Supabase lazily, so none of these touch it.

const field = await loadStatePicksField();
const allPicks = Object.fromEntries(field.races.map((race) => [race.key, race.teams[0]]));

test("field has the eight state races with real qualifying teams", () => {
  assert.equal(field.races.length, 8);
  for (const race of field.races) assert.ok(race.teams.length === 20 || race.teams.length === 24, race.key);
});

test("a full entry validates and the name is cleaned", () => {
  const entry = validateEntry(field, { name: "  Jamie   <b>Rivera</b> ", picks: { ...allPicks, extra: "x" } });
  assert.equal(entry.displayName, "Jamie bRivera/b");
  assert.deepEqual(entry.picks, allPicks);
});

test("missing or invented picks are rejected", () => {
  const missing = { ...allPicks };
  delete missing.girls_D4;
  assert.throws(() => validateEntry(field, { name: "Jamie", picks: missing }), /Girls Division IV/);
  assert.throws(() => validateEntry(field, { name: "Jamie", picks: { ...allPicks, boys_D1: "Not A School" } }), /not in the Boys Division I field/);
  assert.throws(() => validateEntry(field, { name: "J", picks: allPicks }), /name/);
});

test("picks lock at 10:00 AM ET on Nov. 7, 2026", () => {
  assert.equal(picksLocked(field, new Date("2026-11-07T14:59:59Z")), false);
  assert.equal(picksLocked(field, new Date("2026-11-07T15:00:00Z")), true);
});

test("tally counts each team per race, most picked first", () => {
  const [a, b] = field.races[0].teams;
  const tallies = tallyPicks(field, [{ picks: { [field.races[0].key]: b } }, { picks: { [field.races[0].key]: a } }, { picks: { [field.races[0].key]: b } }]);
  assert.deepEqual(tallies[0].teams, [{ team: b, count: 2 }, { team: a, count: 1 }]);
  assert.deepEqual(tallies[1].teams, []);
});
