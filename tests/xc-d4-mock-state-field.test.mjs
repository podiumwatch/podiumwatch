import test from "node:test";
import assert from "node:assert/strict";
import { buildMockStateRosterField } from "../lib/xc_d4_mock_state_field.mjs";

function team(name, id, runners, timeOffset = 0) {
  return {
    name,
    ohsaaSchoolId: id,
    city: name,
    athleticDistrict: "Central",
    region: "Central",
    runners: runners.map((runnerName, index) => ({
      name: runnerName,
      grade: "10",
      graduationYear: 2029,
      seasonBest: `17:0${index}.00`,
      timeCentiseconds: 102000 + timeOffset + index * 100
    }))
  };
}

function syntheticDivision(teamCount = 24) {
  const runners = ["One", "Two", "Three", "Four", "Five", "Six", "Seven"];
  return {
    id: "boys-d4",
    gender: "boys",
    division: 4,
    regions: {
      central: {
        stateQualifiers: 24,
        individualQualifiers: 0,
        teams: Array.from({ length: teamCount }, (_, index) => team(
          `Team ${index + 1}`,
          1000 + index,
          runners.map((name) => `${name} ${index + 1}`),
          index * 10000
        )),
        individuals: []
      }
    }
  };
}

test("mock-state field preserves exactly 24 qualifying teams and uses stable workbook IDs", () => {
  const division = syntheticDivision();
  const workbookRows = division.regions.central.teams.flatMap((entry, teamIndex) => entry.runners.map((runner, runnerIndex) => ({
    gender: "Boys",
    team_name: entry.name,
    athlete_name: runner.name,
    provider_team_id: `team-${teamIndex}`,
    provider_athlete_id: `athlete-${teamIndex}-${runnerIndex}`
  })));
  const result = buildMockStateRosterField(division, workbookRows);
  assert.equal(result.teams.length, 24);
  assert.equal(result.field.length, 168);
  assert.equal(result.diagnostics.exact_identity_matches, 168);
  assert.equal(result.diagnostics.excluded_selected_roster_athletes, 0);
  assert.equal(result.field[0].provider_athlete_id, "athlete-0-0");
});

test("a selected team keeps scoring with six histories but the missing runner is excluded", () => {
  const division = syntheticDivision();
  const workbookRows = division.regions.central.teams.flatMap((entry, teamIndex) => entry.runners.map((runner, runnerIndex) => ({
    gender: "Boys",
    team_name: entry.name,
    athlete_name: runner.name,
    provider_team_id: `team-${teamIndex}`,
    provider_athlete_id: `athlete-${teamIndex}-${runnerIndex}`
  })));
  workbookRows.splice(0, 1);
  const result = buildMockStateRosterField(division, workbookRows);
  assert.equal(result.teams.length, 24);
  assert.equal(result.field.length, 167);
  assert.equal(result.diagnostics.excluded_selected_roster_athletes, 1);
  assert.equal(result.field.some((row) => row.provider_athlete_id === null), false);
  assert.equal(result.teams.find((entry) => entry.team_name === "Team 1").eligible_roster_size, 6);
});

test("a regional team with only four eligible histories cannot advance and the next eligible team replaces it", () => {
  const division = syntheticDivision(25);
  const workbookRows = division.regions.central.teams.flatMap((entry, teamIndex) => entry.runners.map((runner, runnerIndex) => ({
    gender: "Boys",
    team_name: entry.name,
    athlete_name: runner.name,
    provider_team_id: `team-${teamIndex}`,
    provider_athlete_id: `athlete-${teamIndex}-${runnerIndex}`
  })));
  const eligibleIds = new Set(workbookRows.map((row) => row.provider_athlete_id));
  eligibleIds.delete("athlete-0-4");
  eligibleIds.delete("athlete-0-5");
  eligibleIds.delete("athlete-0-6");
  const result = buildMockStateRosterField(division, workbookRows, { eligibleAthleteIds: eligibleIds });
  assert.equal(result.teams.length, 24);
  assert.equal(result.teams.some((entry) => entry.team_name === "Team 1"), false);
  assert.equal(result.teams.some((entry) => entry.team_name === "Team 25"), true);
  assert.equal(result.rejectedTeams.length, 1);
  assert.equal(result.rejectedTeams[0].team_name, "Team 1");
  assert.equal(result.rejectedTeams[0].eligible_athletes, 4);
  assert.equal(result.diagnostics.replacement_state_teams, 1);
});

test("history-backed individual qualifiers come from non-advancing teams", () => {
  const division = syntheticDivision(25);
  division.regions.central.individualQualifiers = 1;
  const workbookRows = division.regions.central.teams.flatMap((entry, teamIndex) => entry.runners.map((runner, runnerIndex) => ({
    gender: "Boys",
    team_name: entry.name,
    athlete_name: runner.name,
    provider_team_id: `team-${teamIndex}`,
    provider_athlete_id: `athlete-${teamIndex}-${runnerIndex}`
  })));
  const result = buildMockStateRosterField(division, workbookRows);
  assert.equal(result.individuals.length, 1);
  assert.equal(result.individuals[0].athlete_name, "One 25");
  assert.equal(result.individuals[0].team_name, "Team 25");
  assert.equal(result.individuals[0].provider_team_id, null);
  assert.equal(result.individuals[0].source_provider_team_id, "team-24");
});
