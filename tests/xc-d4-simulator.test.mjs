import test from "node:test";
import assert from "node:assert/strict";
import {
  attachFieldEstimates,
  buildD4TargetField,
  evaluateSimulation,
  fitCourseAdjustedModel,
  prepareSimulatorRecords,
  scoreFinishOrder,
  selectProvisionalLineups,
  selectTopTeams,
  simulateMeet
} from "../lib/xc_d4_simulator.mjs";

function performance(overrides = {}) {
  return {
    provider_athlete_id: "a1",
    provider_team_id: "t1",
    provider_meet_id: "m1",
    athlete_name: "Runner One",
    team_name: "Team One",
    gender: "Boys",
    grade: 11,
    season: 2026,
    meet_date: "2026-09-01",
    distance_meters: 5000,
    time_seconds: 1000,
    place: 1,
    ...overrides
  };
}

test("predictor preparation excludes the target meet and cutoff date", () => {
  const prepared = prepareSimulatorRecords([
    performance(),
    performance({ provider_meet_id: "target", meet_date: "2026-09-20" }),
    performance({ provider_meet_id: "m2", meet_date: "2026-10-10" })
  ], { cutoff: "2026-10-10", targetMeetId: "target" });
  assert.equal(prepared.records.length, 1);
  assert.deepEqual(prepared.exclusions.map((row) => row.reason).sort(), ["cutoff_excluded", "target_meet_excluded"]);
});

test("same athlete and meet duplicates collapse while conflicting times are excluded", () => {
  const exact = performance();
  const prepared = prepareSimulatorRecords([
    exact,
    { ...exact, place: 2 },
    performance({ provider_athlete_id: "a2", time_seconds: 1010 }),
    performance({ provider_athlete_id: "a2", time_seconds: 1020 })
  ], { cutoff: "2026-10-10" });
  assert.equal(prepared.records.length, 1);
  assert.equal(prepared.duplicateGroups[0].status, "same_time_conflicting_places_collapsed");
  assert.equal(prepared.duplicateGroups[1].status, "conflicting_times_excluded");
});

test("meet adjustment recognizes a consistently slower meet through crossover athletes", () => {
  const rows = [];
  for (let index = 0; index < 30; index += 1) {
    rows.push(performance({ provider_athlete_id: `a${index}`, provider_team_id: `t${index % 5}`, provider_meet_id: "fast", meet_date: "2026-09-01", time_seconds: 900 + index }));
    rows.push(performance({ provider_athlete_id: `a${index}`, provider_team_id: `t${index % 5}`, provider_meet_id: "slow", meet_date: "2026-09-08", time_seconds: 940 + index }));
  }
  const fitted = fitCourseAdjustedModel(rows, { cutoff: "2026-10-10", meetPriorCount: 1 });
  assert.ok(fitted.meetEffects.get("slow|2026-09-08") > fitted.meetEffects.get("fast|2026-09-01") + 25);
});

test("athlete ability uses only the best four course-adjusted performances", () => {
  const rows = [];
  for (let meetIndex = 0; meetIndex < 5; meetIndex += 1) {
    for (let anchor = 0; anchor < 20; anchor += 1) {
      rows.push(performance({
        provider_athlete_id: `anchor-${anchor}`,
        provider_team_id: `anchor-team-${anchor % 4}`,
        provider_meet_id: `m${meetIndex}`,
        meet_date: `2026-09-${String(meetIndex + 1).padStart(2, "0")}`,
        time_seconds: 1000 + anchor
      }));
    }
    rows.push(performance({
      provider_athlete_id: "target",
      provider_team_id: "target-team",
      provider_meet_id: `m${meetIndex}`,
      meet_date: `2026-09-${String(meetIndex + 1).padStart(2, "0")}`,
      time_seconds: meetIndex === 4 ? 1300 : 990 + meetIndex
    }));
  }
  const bestFour = fitCourseAdjustedModel(rows, { cutoff: "2026-10-10", bestPerformanceCount: 4 });
  const allFive = fitCourseAdjustedModel(rows, { cutoff: "2026-10-10", bestPerformanceCount: 5 });
  const selected = bestFour.athleteModels.get("target");
  assert.equal(selected.history_count, 5);
  assert.equal(selected.ability_performance_count, 4);
  assert.equal(selected.discarded_performance_count, 1);
  assert.ok(selected.mean_seconds < 1000);
  assert.ok(selected.mean_seconds < allFive.athleteModels.get("target").mean_seconds - 10);
});

test("target field builder ignores result-only athletes and copies no outcome fields", () => {
  const field = buildD4TargetField([
    { official_entry: true, division_status: "ohio_d4_2026", provider_athlete_id: 1, provider_team_id: 2, athlete_name: "A", team_name: "T", grade: 10, observed_outcome: { finished: true, place: 1 } },
    { official_entry: false, division_status: "ohio_d4_2026", provider_athlete_id: 3, provider_team_id: 2, athlete_name: "B", team_name: "T" },
    { official_entry: true, division_status: "not_d4_2026", provider_athlete_id: 4, provider_team_id: 5, athlete_name: "C", team_name: "U" }
  ]);
  assert.equal(field.length, 1);
  assert.equal("observed_outcome" in field[0], false);
  assert.equal("place" in field[0], false);
});

test("provisional lineup uses model estimates and never target place", () => {
  const athletes = Array.from({ length: 9 }, (_, index) => ({
    provider_athlete_id: `a${index}`,
    provider_team_id: "t1",
    athlete_name: `Runner ${index}`,
    team_name: "Team",
    mean_seconds: 1000 + index,
    predictive_standard_deviation_seconds: 20,
    target_place: 9 - index
  }));
  const selected = selectProvisionalLineups(athletes, 7).athletes.filter((row) => row.provisional_lineup);
  assert.deepEqual(selected.map((row) => row.provider_athlete_id), ["a0", "a1", "a2", "a3", "a4", "a5", "a6"]);
});

test("a no-history prior does not displace an evidence-backed athlete", () => {
  const athletes = Array.from({ length: 8 }, (_, index) => ({
    provider_athlete_id: `a${index}`,
    provider_team_id: "t1",
    athlete_name: `Runner ${index}`,
    team_name: "Team",
    mean_seconds: index === 7 ? 900 : 1000 + index,
    history_count: index === 7 ? 0 : 1,
    predictive_standard_deviation_seconds: 20
  }));
  const selected = selectProvisionalLineups(athletes, 7).athletes.filter((row) => row.provisional_lineup);
  assert.equal(selected.some((row) => row.provider_athlete_id === "a7"), false);
});

test("team field keeps at most the 24 strongest scoring teams", () => {
  const athletes = [];
  for (let teamIndex = 0; teamIndex < 26; teamIndex += 1) {
    for (let athleteIndex = 0; athleteIndex < 5; athleteIndex += 1) {
      athletes.push({
        provider_athlete_id: `a-${teamIndex}-${athleteIndex}`,
        provider_team_id: `t-${teamIndex}`,
        athlete_name: `Runner ${teamIndex}-${athleteIndex}`,
        team_name: `Team ${String(teamIndex).padStart(2, "0")}`,
        mean_seconds: 900 + teamIndex * 10 + athleteIndex,
        history_count: 4,
        predictive_standard_deviation_seconds: 20
      });
    }
  }
  const lineups = selectProvisionalLineups(athletes, 7);
  const field = selectTopTeams(lineups, 24);
  assert.equal(field.lineups.length, 24);
  assert.equal(field.athletes.length, 120);
  assert.equal(field.teamSelection.excluded_scoring_teams, 2);
  assert.ok(field.lineups.some((team) => team.provider_team_id === "t-23"));
  assert.ok(!field.lineups.some((team) => team.provider_team_id === "t-24"));
  assert.ok(!field.lineups.some((team) => team.provider_team_id === "t-25"));
});

test("missing-history athlete uses a wider grade prior", () => {
  const rows = Array.from({ length: 25 }, (_, index) => performance({
    provider_athlete_id: `a${index}`,
    provider_team_id: `t${index % 5}`,
    time_seconds: 950 + index,
    grade: 10
  }));
  const fitted = fitCourseAdjustedModel(rows, { cutoff: "2026-10-10" });
  const attached = attachFieldEstimates([{ provider_athlete_id: "missing", provider_team_id: "t9", athlete_name: "Missing", team_name: "Team", grade: 10 }], fitted);
  assert.equal(attached[0].estimate_source, "grade_prior_no_history");
  assert.ok(attached[0].predictive_standard_deviation_seconds > fitted.diagnostics.global_individual_standard_deviation_seconds);
});

test("team score uses five runners and the sixth runner breaks a score tie", () => {
  const finishOrder = [
    ...[1, 2, 3, 4, 25, 27].map((place) => ({ provider_team_id: "a", team_name: "A", place })),
    ...[5, 6, 7, 8, 9, 26].map((place) => ({ provider_team_id: "b", team_name: "B", place }))
  ];
  const scored = scoreFinishOrder(finishOrder);
  assert.equal(scored.ranked[0].score, scored.ranked[1].score);
  assert.equal(scored.ranked[0].provider_team_id, "b");
  assert.equal(scored.ranked[0].sixth_place, 26);
  assert.equal(scored.ranked[1].sixth_place, 27);
});

test("sixth and seventh runners keep their finish places and displace later team scorers", () => {
  const finishOrder = [
    ...Array.from({ length: 7 }, (_, index) => ({ provider_team_id: "a", team_name: "A", place: index + 1 })),
    ...Array.from({ length: 7 }, (_, index) => ({ provider_team_id: "b", team_name: "B", place: index + 8 }))
  ];
  const scored = scoreFinishOrder(finishOrder);
  assert.equal(scored.ranked[0].score, 15);
  assert.equal(scored.ranked[0].sixth_place, 6);
  assert.equal(scored.ranked[0].seventh_place, 7);
  assert.equal(scored.ranked[1].score, 50);
});

test("individual qualifiers displace team scorers without forming a team", () => {
  const finishOrder = [
    { provider_athlete_id: "individual-1", provider_team_id: null, team_name: "Independent", place: 1 },
    ...Array.from({ length: 5 }, (_, index) => ({
      provider_athlete_id: `a-${index}`,
      provider_team_id: "team-a",
      team_name: "Team A",
      place: index + 2
    }))
  ];
  const scored = scoreFinishOrder(finishOrder);
  assert.equal(scored.ranked.length, 1);
  assert.equal(scored.ranked[0].provider_team_id, "team-a");
  assert.equal(scored.ranked[0].score, 20);
  assert.equal(scored.incomplete.length, 0);
});

test("history attachment preserves an individual qualifier's non-scoring field status", () => {
  const fittedModel = {
    athleteModels: new Map([["individual-1", {
      provider_athlete_id: "individual-1",
      provider_team_id: "source-school",
      team_name: "Source School",
      history_count: 4,
      mean_seconds: 1000,
      predictive_standard_deviation_seconds: 20
    }]]),
    gradePriors: new Map(),
    diagnostics: { global_individual_standard_deviation_seconds: 20 }
  };
  const [estimate] = attachFieldEstimates([{
    provider_athlete_id: "individual-1",
    provider_team_id: null,
    team_name: "Source School",
    athlete_name: "Runner One"
  }], fittedModel);
  assert.equal(estimate.provider_team_id, null);
  assert.equal(estimate.estimate_source, "workbook_history");
});

test("seeded simulation is deterministic", () => {
  const athletes = [];
  const lineups = [];
  for (const teamId of ["a", "b"]) {
    const ids = [];
    for (let index = 0; index < 5; index += 1) {
      const id = `${teamId}${index}`;
      ids.push(id);
      athletes.push({ provider_athlete_id: id, provider_team_id: teamId, athlete_name: id, team_name: teamId.toUpperCase(), mean_seconds: 1000 + index, predictive_standard_deviation_seconds: 15, provisional_lineup: true, history_count: 3, estimate_source: "workbook_history" });
    }
    lineups.push({ provider_team_id: teamId, team_name: teamId.toUpperCase(), selected_athletes: 5, entered_athletes: 5, can_score: true, athlete_ids: ids });
  }
  const first = simulateMeet({ athletes, lineups }, { iterations: 100, seed: 7, teamDaySigma: 2 });
  const second = simulateMeet({ athletes, lineups }, { iterations: 100, seed: 7, teamDaySigma: 2 });
  assert.deepEqual(first, second);
  assert.ok(first.teamResults.every((team) => team.top_5_probability === 1));
});

test("predictor preparation supports a girls-only model without changing the boys default", () => {
  const girls = performance({ gender: "Girls" });
  const boysDefault = prepareSimulatorRecords([performance(), girls], { cutoff: "2026-10-10" });
  const girlsOnly = prepareSimulatorRecords([performance(), girls], { cutoff: "2026-10-10", gender: "Girls" });
  assert.equal(boysDefault.records.length, 1);
  assert.equal(boysDefault.records[0].gender, "Boys");
  assert.equal(girlsOnly.records.length, 1);
  assert.equal(girlsOnly.records[0].gender, "Girls");
});

test("evaluation uses only selected athletes with held-out finishes", () => {
  const simulation = {
    athletes: [
      { provider_athlete_id: "a1", provider_team_id: "t1", athlete_name: "A", team_name: "T", mean_place: 1 },
      { provider_athlete_id: "a2", provider_team_id: "t1", athlete_name: "B", team_name: "T", mean_place: 2 }
    ],
    teams: []
  };
  const report = evaluateSimulation(simulation, [
    { provider_athlete_id: "a1", provider_team_id: "t1", athlete_name: "A", team_name: "T", observed_outcome: { finished: true, place: 10, time_display: "16:00" } },
    { provider_athlete_id: "a2", provider_team_id: "t1", athlete_name: "B", team_name: "T", observed_outcome: { finished: false } },
    { provider_athlete_id: "not-selected", provider_team_id: "t1", athlete_name: "C", team_name: "T", observed_outcome: { finished: true, place: 1, time_display: "15:00" } }
  ]);
  assert.equal(report.selected_athletes_with_target_finish, 1);
  assert.equal(report.actual_d4_selected_lineup_finishers[0].provider_athlete_id, "a1");
});
