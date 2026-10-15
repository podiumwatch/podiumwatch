import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  createSeededRandom,
  formatSimulatedTime,
  scoreSimulatedFinishers,
  simulateRace
} from "../public/scripts/d4-state-simulator.js";

const bundle = JSON.parse(await fs.readFile(new URL("../public/data/d4-state-simulator-2026.json", import.meta.url), "utf8"));

test("seeded browser simulation returns one complete deterministic race", () => {
  const division = bundle.divisions["boys-d4"];
  const first = simulateRace(division, { seed: 42 });
  const second = simulateRace(division, { seed: 42 });
  assert.deepEqual(first, second);
  assert.equal(first.finishers.length, division.athletes.length);
  assert.equal(first.teams.length, 24);
  assert.deepEqual(first.finishers.map((athlete) => athlete.place), Array.from({ length: division.athletes.length }, (_, index) => index + 1));
});

test("individual qualifiers occupy places without creating a scoring team", () => {
  const finishers = [
    { athlete_id: "i", team_id: null, place: 1 },
    ...Array.from({ length: 5 }, (_, index) => ({ athlete_id: `a${index}`, team_id: "a", place: index + 2 }))
  ];
  const standings = scoreSimulatedFinishers(finishers, [{ team_id: "a", team_name: "A", region: "Central" }]);
  assert.equal(standings.length, 1);
  assert.equal(standings[0].score, 20);
  assert.equal(finishers[0].scoring_role, "Individual qualifier");
});

test("sixth and seventh runners displace opposing scorers while only five score", () => {
  const finishers = [
    ...Array.from({ length: 7 }, (_, index) => ({ athlete_id: `a${index + 1}`, team_id: "a", place: index + 1 })),
    ...Array.from({ length: 7 }, (_, index) => ({ athlete_id: `b${index + 1}`, team_id: "b", place: index + 8 }))
  ];
  const standings = scoreSimulatedFinishers(finishers, [
    { team_id: "a", team_name: "A", region: "Central" },
    { team_id: "b", team_name: "B", region: "Central" }
  ]);
  assert.equal(standings[0].score, 15);
  assert.equal(standings[0].sixth_place, 6);
  assert.equal(standings[0].seventh_place, 7);
  assert.equal(standings[1].score, 50);
  assert.equal(finishers[5].scoring_role, "Sixth runner");
  assert.equal(finishers[6].scoring_role, "Seventh runner");
});

test("public bundle contains only history-backed complete D4 fields", () => {
  for (const [divisionId, division] of Object.entries(bundle.divisions)) {
    assert.match(divisionId, /^(boys|girls)-d4$/);
    assert.equal(division.teams.length, 24);
    assert.equal(division.athletes.filter((athlete) => athlete.field_role === "individual_qualifier").length, 48);
    assert.equal(division.athletes.some((athlete) => athlete.history_count < 1), false);
    assert.equal(new Set(division.athletes.map((athlete) => athlete.athlete_id)).size, division.athletes.length);
    for (const team of division.teams) {
      assert.ok(division.athletes.filter((athlete) => athlete.team_id === team.team_id).length >= 5);
    }
  }
  const serialized = JSON.stringify(bundle);
  assert.equal(serialized.includes("source_url"), false);
  assert.equal(serialized.includes("supporting_performances"), false);
  assert.equal(serialized.includes("http"), false);
});

test("public bundle explains any team removed by the five-runner history gate", () => {
  const boys = bundle.divisions["boys-d4"];
  assert.deepEqual(boys.rejected_teams, [{
    team_name: "Cardington-Lincoln",
    region: "Central",
    eligible_athletes: 3,
    required_athletes: 5
  }]);
  assert.equal(
    boys.teams.some((team) => team.team_name === "Northmor" && team.selection_status === "replacement_after_history_gate"),
    true
  );
});

test("time formatting and random generation are stable", () => {
  assert.equal(formatSimulatedTime(999.96), "16:40.0");
  const random = createSeededRandom(7);
  assert.deepEqual([random(), random(), random()], [
    0.011704753153026104,
    0.06195825757458806,
    0.97690763277933
  ]);
});

test("Mock Meets has a separate simulator route with division controls", async () => {
  const source = await fs.readFile(new URL("../src/pages/mockregionals.mjs", import.meta.url), "utf8");
  assert.match(source, />Simulate<\/button>/);
  assert.match(source, /pathname: "\/mock-meets\/simulate\/"/);
  assert.match(source, /data-d4sim-division="boys-d4"/);
  assert.match(source, /data-d4sim-division="girls-d4"/);
  assert.match(source, /data-d4sim-team-rows/);
  assert.match(source, /data-d4sim-finisher-rows/);
  assert.match(source, /data-d4sim-field-note/);
  assert.match(source, /d4-state-simulator-2026\.json/);
});

test("primary navigation lists Simulate under Mock Meets", async () => {
  const source = await fs.readFile(new URL("../src/config/site.mjs", import.meta.url), "utf8");
  assert.match(source, /label: "Mock Meets", items:/);
  assert.match(source, /label: "Simulate", href: "\/mock-meets\/simulate\/"/);
});
