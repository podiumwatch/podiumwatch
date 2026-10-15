import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const privateRoot = path.join(
  root,
  "private",
  "audits",
  "d4-state-mock-2026-before-2026-10-13",
  "workbook-only-best4-site-field-five-history-minimum"
);
const outputPath = path.join(root, "public", "data", "d4-state-simulator-2026.json");
const divisionIds = ["boys-d4", "girls-d4"];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const divisions = {};
let generatedAt = null;

for (const divisionId of divisionIds) {
  const divisionDir = path.join(privateRoot, divisionId);
  const [diagnostics, fieldReport, simulation] = await Promise.all([
    fs.readFile(path.join(divisionDir, "model-diagnostics.json"), "utf8").then(JSON.parse),
    fs.readFile(path.join(divisionDir, "field-and-identity-report.json"), "utf8").then(JSON.parse),
    fs.readFile(path.join(divisionDir, "simulation-results.json"), "utf8").then(JSON.parse)
  ]);
  generatedAt = generatedAt || diagnostics.generated_at;
  const fieldAthletes = [...fieldReport.athletes, ...fieldReport.individuals];
  const fieldByAthleteId = new Map(fieldAthletes.map((athlete) => [String(athlete.provider_athlete_id), athlete]));
  const athletes = simulation.athletes.map((estimate) => {
    const field = fieldByAthleteId.get(String(estimate.provider_athlete_id));
    assert(field, `${divisionId}: missing field metadata for athlete ${estimate.provider_athlete_id}.`);
    return {
      athlete_id: String(estimate.provider_athlete_id),
      athlete_name: estimate.athlete_name,
      team_id: field.provider_team_id ? String(field.provider_team_id) : null,
      school_name: field.team_name,
      region: field.region,
      field_role: field.field_status === "website_mock_individual_qualifier" ? "individual_qualifier" : "team_roster",
      estimated_seconds: estimate.estimated_neutral_5k_seconds,
      standard_deviation_seconds: estimate.predictive_standard_deviation_seconds,
      history_count: estimate.history_count,
      ability_performance_count: estimate.ability_performance_count
    };
  });
  const teams = fieldReport.teams.map((team) => ({
    team_id: String(team.provider_team_id),
    team_name: team.team_name,
    region: team.region,
    regional_rank: team.website_regional_rank,
    selection_status: team.selection_status,
    roster_size: team.eligible_roster_size
  }));
  const teamIds = new Set(teams.map((team) => team.team_id));
  const athleteIds = athletes.map((athlete) => athlete.athlete_id);
  const teamRosterCounts = new Map(teams.map((team) => [team.team_id, 0]));
  for (const athlete of athletes) {
    assert(Number.isFinite(athlete.estimated_seconds), `${divisionId}: invalid estimate for ${athlete.athlete_name}.`);
    assert(Number.isFinite(athlete.standard_deviation_seconds), `${divisionId}: invalid uncertainty for ${athlete.athlete_name}.`);
    assert(athlete.history_count > 0, `${divisionId}: no-history athlete reached the public bundle.`);
    if (athlete.team_id) {
      assert(teamIds.has(athlete.team_id), `${divisionId}: athlete references a team outside the 24-team field.`);
      teamRosterCounts.set(athlete.team_id, teamRosterCounts.get(athlete.team_id) + 1);
    }
  }
  assert(teams.length === 24, `${divisionId}: expected 24 teams; found ${teams.length}.`);
  assert(new Set(athleteIds).size === athleteIds.length, `${divisionId}: duplicate athlete IDs in public bundle.`);
  assert([...teamRosterCounts.values()].every((count) => count >= 5), `${divisionId}: a public team has fewer than five athletes.`);
  assert(athletes.filter((athlete) => athlete.field_role === "individual_qualifier").length === 48, `${divisionId}: expected 48 individual qualifiers.`);

  divisions[divisionId] = {
    label: divisionId === "boys-d4" ? "Boys Division IV" : "Girls Division IV",
    team_day_standard_deviation_seconds: diagnostics.fit.team_day_standard_deviation_seconds,
    teams,
    athletes,
    rejected_teams: fieldReport.rejected_teams.map((team) => ({
      team_name: team.team_name,
      region: team.region,
      eligible_athletes: team.eligible_athletes,
      required_athletes: team.required_eligible_athletes
    })),
    rejected_individual_candidate_count: fieldReport.rejected_individual_candidates.length
  };
}

const publicBundle = {
  schema_version: 1,
  generated_at: generatedAt,
  season: 2026,
  exclusive_cutoff: "2026-10-13",
  status: "Podium Watch projection",
  model: {
    athlete_ability: "Best four course-adjusted eligible 2026 5K performances, or all eligible performances when fewer than four exist.",
    race_variation: "Athlete uncertainty plus one shared team-day adjustment per scoring team.",
    scoring: "Five runners score; the sixth runner breaks an equal team score.",
    field: "Twenty-four history-eligible teams plus 48 history-eligible projected individual qualifiers."
  },
  divisions
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(publicBundle, null, 2)}\n`);
console.log(`Wrote ${outputPath}`);
for (const [divisionId, division] of Object.entries(divisions)) {
  console.log(`${divisionId}: ${division.teams.length} teams, ${division.athletes.length} athletes`);
}
