import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY ||= "test-service-role-key";

const {
  articleLabelForStage,
  buildAthletePathView,
  buildPathToState,
  defaultStatusForStage,
  findThreshold,
  hasDistrictRound,
  isMissingPathToStateError,
  pickCurrentNodeKey,
  pickStatusForStage,
  qualifyingText,
  resolveRegionalName,
  resolveSeasonYear,
  resolveThresholdForStage,
  scopeForStage,
  stageSequenceFor,
  statusLabel,
  statusTone,
  transitionStageFor
} = await import("../lib/path_to_state_service.mjs");

// public/scripts/path-to-state.js is a plain classic script (matching
// every other file in public/scripts/ -- see its own header comment), so
// it attaches its functions to window rather than using export. A
// minimal window stub is all Node needs to load it directly here, the
// same pattern scripts/test-pace-calculator.mjs uses for pace-splits.js.
global.window = {};
await import("../public/scripts/path-to-state.js");
const { roadmapMarkup } = global.window.PodiumPathToState;

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), "utf8");
}

function includesAll(text, values, label) {
  for (const value of values) {
    assert.ok(text.includes(value), `${label} is missing ${value}`);
  }
}

// --- hasDistrictRound / stageSequenceFor ------------------------------------
// Division 1 skipping the district round entirely (OHSAA regulation 3.1)
// is the single most important structural fact this whole feature has to
// get right -- a wrong node count here means a fabricated tournament round.

assert.equal(hasDistrictRound(1), false, "Division 1 has no district round.");
assert.equal(hasDistrictRound(2), true);
assert.equal(hasDistrictRound(3), true);
assert.equal(hasDistrictRound(4), true);
assert.equal(hasDistrictRound(5), true, "A hypothetical Division 5 (track) defaults to having a district round unless proven otherwise.");
assert.equal(hasDistrictRound(0), null);

assert.deepEqual(stageSequenceFor(1), ["regular_season", "regional", "state"], "Division 1 must be exactly 3 nodes with no district stage.");
assert.deepEqual(stageSequenceFor(2), ["regular_season", "district", "regional", "state"]);
assert.deepEqual(stageSequenceFor(3), ["regular_season", "district", "regional", "state"]);
assert.deepEqual(stageSequenceFor(4), ["regular_season", "district", "regional", "state"]);
assert.equal(stageSequenceFor(null), null);
assert.equal(stageSequenceFor(0), null);
assert.equal(stageSequenceFor(6), null);
assert.equal(stageSequenceFor(2.5), null, "A non-integer division number must never produce a sequence.");

// --- articleLabelForStage / transitionStageFor / scopeForStage -------------

assert.equal(articleLabelForStage("district"), "the district");
assert.equal(articleLabelForStage("regional"), "the regional");
assert.equal(articleLabelForStage("state"), "the state championship");
assert.equal(articleLabelForStage("regular_season"), null);

assert.equal(transitionStageFor("district"), "district_to_regional");
assert.equal(transitionStageFor("regional"), "regional_to_state");
assert.equal(transitionStageFor("regular_season"), null);
assert.equal(transitionStageFor("state"), null);

assert.deepEqual(scopeForStage({ stageKey: "district", athleticDistrict: "Central" }), { scope_type: "athletic_district", scope_name: "Central" });
assert.equal(scopeForStage({ stageKey: "district", athleticDistrict: null }), null);
assert.deepEqual(scopeForStage({ stageKey: "regional", regionalName: "Northeast" }), { scope_type: "regional", scope_name: "Northeast" });
assert.equal(scopeForStage({ stageKey: "state" }), null);

// --- resolveRegionalName -----------------------------------------------------

{
  const assignmentRows = [
    { sport: "cross_country", season_year: 2026, division_number: 2, athletic_district: "Central", regional_name: "Central", assignment_status: "published" },
    { sport: "cross_country", season_year: 2026, division_number: 1, athletic_district: "Northwest", regional_name: null, assignment_status: "unknown" }
  ];

  assert.equal(
    resolveRegionalName({ assignmentRows, seasonYear: 2026, divisionNumber: 2, athleticDistrict: "Central" }),
    "Central"
  );
  assert.equal(
    resolveRegionalName({ assignmentRows, seasonYear: 2026, divisionNumber: 1, athleticDistrict: "Northwest" }),
    null,
    "An 'unknown' assignment row must never surface a regional name -- this is the real Division 1 / Northwest gap."
  );
  assert.equal(
    resolveRegionalName({ assignmentRows, seasonYear: 2026, divisionNumber: 4, athleticDistrict: "East" }),
    null,
    "No matching row at all must resolve to null, not throw."
  );
  assert.equal(resolveRegionalName({ assignmentRows, seasonYear: 2026, divisionNumber: 2, athleticDistrict: null }), null);
}

// --- findThreshold / resolveThresholdForStage -------------------------------

const REAL_THRESHOLD_ROWS = [
  // Division 3 boys' real district-to-regional counts genuinely differ
  // per athletic district (9/3/11/26/17/21) -- seeded here as more than
  // one row specifically so a team with no known athletic district
  // correctly resolves to "unavailable" (real districts disagree),
  // never accidentally "division_uniform" from a too-sparse fixture.
  { division_number: 3, gender: "boys", stage: "district_to_regional", scope_type: "athletic_district", scope_name: "Central", qualifying_teams: 9, qualifying_individuals: 18, min_scoring_finishers: 5 },
  { division_number: 3, gender: "boys", stage: "district_to_regional", scope_type: "athletic_district", scope_name: "East", qualifying_teams: 12, qualifying_individuals: 24, min_scoring_finishers: 5 },
  { division_number: 3, gender: "boys", stage: "district_to_regional", scope_type: "athletic_district", scope_name: "Southeast", qualifying_teams: 11, qualifying_individuals: 22, min_scoring_finishers: 5 },
  { division_number: 3, gender: "girls", stage: "district_to_regional", scope_type: "athletic_district", scope_name: "Central", qualifying_teams: 6, qualifying_individuals: 12, min_scoring_finishers: 5 },
  { division_number: 3, gender: "boys", stage: "regional_to_state", scope_type: "regional", scope_name: "Central", qualifying_teams: 8, qualifying_individuals: 16, min_scoring_finishers: 5 },
  // Division 1 regional_to_state: Central, Northeast, Southwest only --
  // Northwest is the real, intentional gap (no Division 1 Northwest regional exists).
  { division_number: 1, gender: "boys", stage: "regional_to_state", scope_type: "regional", scope_name: "Central", qualifying_teams: 8, qualifying_individuals: 16, min_scoring_finishers: 5 },
  { division_number: 1, gender: "boys", stage: "regional_to_state", scope_type: "regional", scope_name: "Northeast", qualifying_teams: 5, qualifying_individuals: 10, min_scoring_finishers: 5 },
  { division_number: 1, gender: "boys", stage: "regional_to_state", scope_type: "regional", scope_name: "Southwest", qualifying_teams: 7, qualifying_individuals: 14, min_scoring_finishers: 5 }
];

assert.deepEqual(
  findThreshold({ thresholdRows: REAL_THRESHOLD_ROWS, divisionNumber: 3, gender: "boys", stage: "district_to_regional", scopeType: "athletic_district", scopeName: "Central" }),
  REAL_THRESHOLD_ROWS[0]
);
assert.equal(findThreshold({ thresholdRows: REAL_THRESHOLD_ROWS, divisionNumber: 3, gender: "boys", stage: "district_to_regional", scopeType: "athletic_district", scopeName: "Southwest" }), null);

{
  const result = resolveThresholdForStage({ thresholdRows: REAL_THRESHOLD_ROWS, divisionNumber: 3, gender: "boys", stageKey: "district", athleticDistrict: "Central", regionalName: null });
  assert.equal(result.resolution, "exact");
  assert.equal(result.qualifying_teams, 9);
  assert.equal(result.qualifying_individuals, 18);
  assert.equal(result.scope_label, "Central");
}

// The real, concrete gap: Division 1 Northwest has no regional at all.
{
  const result = resolveThresholdForStage({ thresholdRows: REAL_THRESHOLD_ROWS, divisionNumber: 1, gender: "boys", stageKey: "regional", athleticDistrict: "Northwest", regionalName: null });
  assert.equal(result.resolution, "unavailable", "No regional resolved and the 3 real Division 1 regionals disagree (8/16, 5/10, 7/14) -- must be unavailable, never a guess.");
  assert.equal(result.qualifying_teams, null);
  assert.equal(result.qualifying_individuals, null);
}

// "division_uniform": every row for the division+gender+stage agrees.
{
  const uniformRows = [
    { division_number: 2, gender: "boys", stage: "regional_to_state", scope_type: "regional", scope_name: "Central", qualifying_teams: 5, qualifying_individuals: 10, min_scoring_finishers: 5 },
    { division_number: 2, gender: "boys", stage: "regional_to_state", scope_type: "regional", scope_name: "Northeast", qualifying_teams: 5, qualifying_individuals: 10, min_scoring_finishers: 5 }
  ];
  const result = resolveThresholdForStage({ thresholdRows: uniformRows, divisionNumber: 2, gender: "boys", stageKey: "regional", athleticDistrict: null, regionalName: null });
  assert.equal(result.resolution, "division_uniform");
  assert.equal(result.qualifying_teams, 5);
  assert.equal(result.qualifying_individuals, 10);
}

// Disagreeing rows must never be averaged or maxed.
{
  const disagreeingRows = [
    { division_number: 2, gender: "boys", stage: "regional_to_state", scope_type: "regional", scope_name: "Central", qualifying_teams: 5, qualifying_individuals: 10, min_scoring_finishers: 5 },
    { division_number: 2, gender: "boys", stage: "regional_to_state", scope_type: "regional", scope_name: "Northeast", qualifying_teams: 10, qualifying_individuals: 20, min_scoring_finishers: 5 }
  ];
  const result = resolveThresholdForStage({ thresholdRows: disagreeingRows, divisionNumber: 2, gender: "boys", stageKey: "regional", athleticDistrict: null, regionalName: null });
  assert.equal(result.resolution, "unavailable", "Disagreeing division-wide rows must never resolve to an averaged or maxed number.");
  assert.equal(result.qualifying_teams, null);
}

assert.deepEqual(
  resolveThresholdForStage({ thresholdRows: REAL_THRESHOLD_ROWS, divisionNumber: 1, gender: "boys", stageKey: "regular_season", athleticDistrict: null, regionalName: null }),
  { qualifying_teams: null, qualifying_individuals: null, scope_label: null, min_scoring_finishers: null, resolution: "not_applicable" },
  "regular_season and state have no transition to resolve a threshold for."
);

// --- qualifyingText: the never-render-zero guarantee ------------------------

assert.equal(qualifyingText({ stageKey: "regular_season", minScoringFinishers: 5 }), "At least 5 runners must finish and score for a team result.");
assert.equal(qualifyingText({ stageKey: "regular_season" }), "At least 5 runners must finish and score for a team result.", "A missing min-scoring-finishers value must fall back to the real default of 5, never crash.");
assert.equal(qualifyingText({ stageKey: "state" }), "Final round. Team and individual state placement.");
assert.equal(
  qualifyingText({ stageKey: "district", qualifyingTeams: 9, qualifyingIndividuals: 18, nextStageLabel: "the regional" }),
  "Top 9 teams and the next 18 individuals advance to the regional."
);
assert.equal(
  qualifyingText({ stageKey: "regional", qualifyingTeams: 8, qualifyingIndividuals: null, nextStageLabel: "the state championship" }),
  "Top 8 teams advance to the state championship.",
  "A teams-only threshold (no individual count) must still produce real, ungarbled text."
);

assert.equal(qualifyingText({ stageKey: "district", qualifyingTeams: 0, qualifyingIndividuals: 0, nextStageLabel: "the regional" }), null, "A qualifyingTeams of exactly 0 must never render as \"Top 0 teams\" -- 0 is treated as absent.");
assert.equal(qualifyingText({ stageKey: "district", qualifyingTeams: null, qualifyingIndividuals: null, nextStageLabel: "the regional" }), null);
assert.equal(qualifyingText({ stageKey: "district", qualifyingTeams: -1, nextStageLabel: "the regional" }), null, "A negative count must never render either.");

// --- statusLabel / statusTone ------------------------------------------------

for (const status of ["not_started", "upcoming", "qualified_team", "qualified_individuals", "eliminated"]) {
  assert.ok(typeof statusLabel(status) === "string" && statusLabel(status).length > 0);
  assert.ok(typeof statusTone(status) === "string" && statusTone(status).length > 0);
}
assert.equal(statusLabel("literally_invalid"), statusLabel("not_started"), "An unknown status must fall back to the neutral label, never crash or show \"undefined\".");
assert.equal(statusTone("literally_invalid"), statusTone("not_started"));

// --- defaultStatusForStage ---------------------------------------------------

assert.equal(defaultStatusForStage({ stageDate: "2099-01-01", today: new Date("2026-10-20") }), "upcoming");
assert.equal(defaultStatusForStage({ stageDate: "2020-01-01", today: new Date("2026-10-20") }), "not_started");
assert.equal(defaultStatusForStage({ stageDate: null, today: new Date("2026-10-20") }), "not_started");
assert.equal(defaultStatusForStage({ stageDate: "2026-10-24", stageApplies: false, today: new Date("2026-10-20") }), null, "A stage that does not apply to this division (Division 1's district) must return null, not a fake default.");

// --- pickStatusForStage: resolution order -----------------------------------

{
  const calendarRow = { stage_date: "2026-10-24", stage_applies: true };
  const teamStatusRows = [{ stage: "district", status: "qualified_team", note: "Won districts", individual_qualifier_count: null }];
  const athleteStatusRows = [];

  const result = pickStatusForStage({ stageKey: "district", teamStatusRows, athleteStatusRows, calendarRow, today: new Date("2026-10-25") });
  assert.equal(result.status, "qualified_team");
  assert.equal(result.status_source, "admin");
  assert.equal(result.note, "Won districts");
}

{
  // The forward hook: an athlete-specific row must override the team row.
  const calendarRow = { stage_date: "2026-10-24", stage_applies: true };
  const teamStatusRows = [{ stage: "district", status: "eliminated", note: null, individual_qualifier_count: null }];
  const athleteStatusRows = [{ stage: "district", status: "qualified_individuals", note: "Advanced individually", individual_qualifier_count: 1 }];

  const result = pickStatusForStage({ stageKey: "district", teamStatusRows, athleteStatusRows, calendarRow, today: new Date("2026-10-25") });
  assert.equal(result.status, "qualified_individuals");
  assert.equal(result.status_source, "athlete", "An athlete-specific status row must win over the team-wide row.");
}

{
  // No admin row at all -- falls back to the date-based default.
  const calendarRow = { stage_date: "2099-01-01", stage_applies: true };
  const result = pickStatusForStage({ stageKey: "regional", teamStatusRows: [], athleteStatusRows: [], calendarRow, today: new Date("2026-10-25") });
  assert.equal(result.status, "upcoming");
  assert.equal(result.status_source, "default");
}

// --- pickCurrentNodeKey ------------------------------------------------------

{
  const allDefault = [
    { key: "regular_season", status: "not_started" },
    { key: "district", status: "upcoming" },
    { key: "regional", status: "upcoming" },
    { key: "state", status: "upcoming" }
  ];
  assert.equal(pickCurrentNodeKey(allDefault), "regular_season", "With nothing resolved yet, the current node is the very first one.");
}

{
  const qualifiedThroughDistrict = [
    { key: "regular_season", status: "not_started" },
    { key: "district", status: "qualified_team" },
    { key: "regional", status: "upcoming" },
    { key: "state", status: "upcoming" }
  ];
  assert.equal(pickCurrentNodeKey(qualifiedThroughDistrict), "regional", "A qualified_team status advances the current marker to the NEXT stage.");
}

{
  const eliminatedAtDistrict = [
    { key: "regular_season", status: "not_started" },
    { key: "district", status: "eliminated" },
    { key: "regional", status: "upcoming" },
    { key: "state", status: "upcoming" }
  ];
  assert.equal(pickCurrentNodeKey(eliminatedAtDistrict), "district", "eliminated is a TERMINAL status for the team's own path -- the current marker must stop there, not continue past it.");
}

{
  const partialAtDistrict = [
    { key: "regular_season", status: "not_started" },
    { key: "district", status: "qualified_individuals" },
    { key: "regional", status: "upcoming" },
    { key: "state", status: "upcoming" }
  ];
  assert.equal(pickCurrentNodeKey(partialAtDistrict), "district", "qualified_individuals means the team itself did not continue -- current marker stops here too.");
}

assert.equal(pickCurrentNodeKey([]), null);

// --- resolveSeasonYear --------------------------------------------------------

assert.equal(resolveSeasonYear({ availableSeasonYears: [2026, 2025], today: new Date("2026-10-20") }), 2026);
assert.equal(resolveSeasonYear({ availableSeasonYears: [2025], today: new Date("2026-10-20") }), 2025, "No 2026 data seeded yet -- falls back to the most recent past season.");
assert.equal(resolveSeasonYear({ availableSeasonYears: [2027], today: new Date("2026-10-20") }), 2027, "A single future season (seeded early) is still the only real option available.");
assert.equal(resolveSeasonYear({ availableSeasonYears: [], today: new Date("2026-10-20") }), null);

// --- isMissingPathToStateError ------------------------------------------------

assert.equal(isMissingPathToStateError({ code: "42P01" }), true, "Raw Postgres undefined_table.");
assert.equal(isMissingPathToStateError({ message: 'relation "public.team_advancement_status" does not exist' }), true);
assert.equal(
  isMissingPathToStateError({ code: "PGRST205", message: "Could not find the table 'public.ohio_tournament_stage_calendar' in the schema cache" }),
  true,
  "The REAL shape this error arrives in, confirmed by calling the real production Supabase project directly before the migration was run: PostgREST's own PGRST205, not raw Postgres 42P01."
);
assert.equal(isMissingPathToStateError({ code: "23505", message: "duplicate key" }), false, "A real, unrelated database error must never be swallowed as \"migration not run yet\".");
assert.equal(isMissingPathToStateError(null), false);

// --- buildPathToState: full node generation ----------------------------------

const FULL_SEASON_FIXTURE = {
  calendarRows: [
    { sport: "cross_country", season_year: 2026, division_number: 1, stage: "regular_season", stage_applies: true, stage_date: null, entry_deadline: null },
    { sport: "cross_country", season_year: 2026, division_number: 1, stage: "district", stage_applies: false, stage_date: null, entry_deadline: null },
    { sport: "cross_country", season_year: 2026, division_number: 1, stage: "regional", stage_applies: true, stage_date: "2026-10-31", entry_deadline: "2026-10-25" },
    { sport: "cross_country", season_year: 2026, division_number: 1, stage: "state", stage_applies: true, stage_date: "2026-11-07", entry_deadline: null },
    { sport: "cross_country", season_year: 2026, division_number: 3, stage: "regular_season", stage_applies: true, stage_date: null, entry_deadline: null },
    { sport: "cross_country", season_year: 2026, division_number: 3, stage: "district", stage_applies: true, stage_date: "2026-10-24", entry_deadline: "2026-10-18" },
    { sport: "cross_country", season_year: 2026, division_number: 3, stage: "regional", stage_applies: true, stage_date: "2026-10-31", entry_deadline: null },
    { sport: "cross_country", season_year: 2026, division_number: 3, stage: "state", stage_applies: true, stage_date: "2026-11-07", entry_deadline: null }
  ],
  thresholdRows: REAL_THRESHOLD_ROWS,
  assignmentRows: [
    { sport: "cross_country", season_year: 2026, division_number: 3, athletic_district: "Central", regional_name: "Central", assignment_status: "published" },
    { sport: "cross_country", season_year: 2026, division_number: 1, athletic_district: "Central", regional_name: "Central", assignment_status: "published" },
    { sport: "cross_country", season_year: 2026, division_number: 1, athletic_district: "Northwest", regional_name: null, assignment_status: "unknown" }
  ]
};

{
  const path = buildPathToState({
    seasonYear: 2026,
    gender: "boys",
    divisionNumber: 3,
    athleticDistrict: "Central",
    teamStatusRows: [{ stage: "district", status: "qualified_team" }],
    today: new Date("2026-10-25"),
    ...FULL_SEASON_FIXTURE
  });

  assert.equal(path.available, true);
  assert.equal(path.has_district_round, true);
  assert.equal(path.nodes.length, 4);
  assert.deepEqual(path.nodes.map((node) => node.key), ["regular_season", "district", "regional", "state"]);
  assert.equal(path.nodes[3].is_final, true);
  assert.equal(path.nodes[1].date, "2026-10-24");
  assert.equal(path.nodes[1].qualifying_text, "Top 9 teams and the next 18 individuals advance to the regional.");
  assert.equal(path.regional_name, "Central");
  assert.equal(path.current_node_key, "regional", "qualified_team at district must advance the current marker to regional.");
  assert.equal(path.nodes[0].reached, true);
  assert.equal(path.nodes[1].reached, true);
  assert.equal(path.nodes[2].reached, true);
  assert.equal(path.nodes[3].reached, false, "state has not been reached yet.");
}

{
  const path = buildPathToState({
    seasonYear: 2026,
    gender: "boys",
    divisionNumber: 1,
    athleticDistrict: "Central",
    today: new Date("2026-10-20"),
    ...FULL_SEASON_FIXTURE
  });

  assert.equal(path.available, true);
  assert.equal(path.has_district_round, false);
  assert.equal(path.nodes.length, 3, "Division 1 must have exactly 3 nodes.");
  assert.deepEqual(path.nodes.map((node) => node.key), ["regular_season", "regional", "state"]);
  assert.ok(!path.nodes.some((node) => node.key === "district"), "No node may have key \"district\" for a Division 1 team.");
  assert.equal(path.nodes[1].entry_deadline, "2026-10-25", "Division 1's regional carries the real entry deadline since it's their first tournament round.");
}

// The concrete real gap: a Division 1 Northwest team.
{
  const path = buildPathToState({
    seasonYear: 2026,
    gender: "boys",
    divisionNumber: 1,
    athleticDistrict: "Northwest",
    today: new Date("2026-10-20"),
    ...FULL_SEASON_FIXTURE
  });

  assert.equal(path.available, true);
  assert.equal(path.regional_name, null, "Northwest Division 1 has no confirmed regional assignment -- must stay null, never guessed.");
  const regionalNode = path.nodes.find((node) => node.key === "regional");
  assert.equal(regionalNode.threshold_resolution, "unavailable");
  assert.equal(regionalNode.qualifying_text, null);

  const serialized = JSON.stringify(path);
  assert.ok(!serialized.includes("Top 0"), "The fully serialized path must never contain the literal string \"Top 0\".");
  assert.ok(!/"qualifying_teams":0/.test(serialized), "qualifying_teams must never serialize as a literal 0 when the real number isn't known.");
}

// --- buildPathToState: edge cases -------------------------------------------

assert.equal(buildPathToState({ seasonYear: 2026, gender: "unspecified", divisionNumber: 3, ...FULL_SEASON_FIXTURE }).available, false);
assert.equal(buildPathToState({ seasonYear: 2026, gender: "unspecified", divisionNumber: 3, ...FULL_SEASON_FIXTURE }).reason, "missing_gender");

assert.equal(buildPathToState({ seasonYear: 2026, gender: "boys", divisionNumber: null, ...FULL_SEASON_FIXTURE }).reason, "missing_division", "A team with no known division at all must degrade cleanly, not throw.");

assert.equal(buildPathToState({ seasonYear: 2099, gender: "boys", divisionNumber: 3, ...FULL_SEASON_FIXTURE }).reason, "missing_season_data", "A season with no seeded calendar rows must degrade cleanly, never render blank dates.");

{
  // No ohio_school_id linked -- athleticDistrict is null, but the path
  // still builds off the (self-reported) division; the district node
  // simply carries no real qualifying number.
  const path = buildPathToState({ seasonYear: 2026, gender: "boys", divisionNumber: 3, athleticDistrict: null, divisionSource: "team_pages_self_reported", ...FULL_SEASON_FIXTURE });
  assert.equal(path.available, true);
  assert.equal(path.division_source, "team_pages_self_reported");
  const districtNode = path.nodes.find((node) => node.key === "district");
  assert.equal(districtNode.qualifying_text, null);
}

// --- buildAthletePathView -----------------------------------------------------

{
  const unavailable = buildAthletePathView({ path: { available: false } });
  assert.equal(unavailable.available, false);
  assert.equal(unavailable.note, null);
}

{
  const path = buildPathToState({
    seasonYear: 2026,
    gender: "boys",
    divisionNumber: 3,
    athleticDistrict: "Central",
    teamStatusRows: [{ stage: "district", status: "qualified_individuals" }],
    today: new Date("2026-10-25"),
    ...FULL_SEASON_FIXTURE
  });

  const view = buildAthletePathView({ path });
  assert.equal(view.available, true);
  assert.ok(view.note.includes("did not advance as a team"), "qualified_individuals must produce the derived divergence note.");
}

{
  const path = buildPathToState({
    seasonYear: 2026,
    gender: "boys",
    divisionNumber: 3,
    athleticDistrict: "Central",
    teamStatusRows: [{ stage: "district", status: "qualified_individuals" }],
    today: new Date("2026-10-25"),
    ...FULL_SEASON_FIXTURE
  });

  const view = buildAthletePathView({ path, overrideNote: "A custom admin note." });
  assert.equal(view.note, "A custom admin note.", "An explicit admin note must override the derived default text.");
}

// --- shared renderer (public/scripts/path-to-state.js) -----------------------

{
  const d1Path = buildPathToState({
    seasonYear: 2026,
    gender: "boys",
    divisionNumber: 1,
    athleticDistrict: "Central",
    today: new Date("2026-10-20"),
    ...FULL_SEASON_FIXTURE
  });
  const markup = roadmapMarkup(d1Path);
  assert.equal((markup.match(/class="path-to-state-node"/g) || []).length, 3, "A Division 1 path must render exactly 3 <li> nodes.");
  assert.ok(!markup.includes('data-stage="district"'), "No rendered node may carry data-stage=\"district\" for a Division 1 team.");
}

{
  const d3Path = buildPathToState({
    seasonYear: 2026,
    gender: "boys",
    divisionNumber: 3,
    athleticDistrict: "Central",
    teamStatusRows: [{ stage: "district", status: "qualified_team" }],
    today: new Date("2026-10-25"),
    ...FULL_SEASON_FIXTURE
  });
  const markup = roadmapMarkup(d3Path);
  assert.equal((markup.match(/class="path-to-state-node"/g) || []).length, 4, "A Division 2/3/4 path must render exactly 4 <li> nodes.");
  assert.ok(markup.includes('data-status="qualified_team"'), "The qualified_team node's status must be reflected in the rendered markup.");
  assert.ok(markup.includes('data-reached="true"'), "reached nodes must be marked in the rendered markup, driving the connector fill.");
}

{
  // The Division 1 / Northwest gap, rendered end to end through the
  // actual shared renderer -- the presentation-layer half of the
  // never-render-zero guarantee (the pure-logic half was already checked
  // directly against buildPathToState above).
  const gapPath = buildPathToState({
    seasonYear: 2026,
    gender: "boys",
    divisionNumber: 1,
    athleticDistrict: "Northwest",
    today: new Date("2026-10-20"),
    ...FULL_SEASON_FIXTURE
  });
  const markup = roadmapMarkup(gapPath);
  assert.ok(!markup.includes("Top 0"), "The rendered markup must never contain the literal string \"Top 0\".");
  assert.ok(markup.includes('data-unpublished="true"'), "The unresolved regional node must render the \"not published yet\" placeholder, not a fabricated number.");
}

assert.equal(roadmapMarkup({ available: false, nodes: [] }), "", "An unavailable path must render nothing at all, never an empty or half-built list.");
assert.equal(roadmapMarkup(null), "");

{
  // XSS: a team/status note containing markup must come out escaped.
  const xssPath = buildPathToState({
    seasonYear: 2026,
    gender: "boys",
    divisionNumber: 3,
    athleticDistrict: "Central",
    teamStatusRows: [{ stage: "district", status: "qualified_team", note: "<script>alert(1)</script>" }],
    today: new Date("2026-10-20"),
    ...FULL_SEASON_FIXTURE
  });
  const markup = roadmapMarkup(xssPath);
  assert.ok(markup.includes("path-to-state-note-text"), "A real admin note must actually be rendered, not silently dropped.");
  assert.ok(!markup.includes("<script>alert(1)</script>"), "Raw HTML in an admin-entered note must never appear unescaped in the output.");
  assert.ok(markup.includes("&lt;script&gt;alert(1)&lt;/script&gt;"), "The note's HTML must be escaped, not stripped -- the visible text should still read as the (harmless) literal characters.");
}

// --- Source guards for the parts that need a live database or a real
// browser DOM this test file doesn't have -- the same pattern this
// project's other recent features use (see scripts/test-fan-poll.mjs).

const migrationSource = await read("install/10_PATH_TO_STATE.sql");
const serviceSource = await read("lib/path_to_state_service.mjs");
const teamsApiSource = await read("api/teams/detail.js");
const athletesApiSource = await read("api/athletes/detail.js");
const adminApiSource = await read("api/admin/path-to-state.js");
const teamPageSource = await read("src/pages/teamprofile.mjs");
const athletePageSource = await read("src/pages/athletedetail.mjs");
const teamScriptSource = await read("public/scripts/team-profile.js");
const athleteScriptSource = await read("public/scripts/athlete-profile.js");
const cssSource = await read("src/styles/main.css");

includesAll(
  migrationSource,
  [
    "create table if not exists public.ohio_tournament_stage_calendar",
    "create table if not exists public.ohio_tournament_qualification_thresholds",
    "create table if not exists public.ohio_tournament_regional_assignments",
    "create table if not exists public.team_advancement_status",
    "begin;",
    "commit;",
    "unique (sport, season_year, division_number, stage)",
    "unique (sport, season_year, division_number, gender, stage, scope_type, scope_name)",
    "unique (sport, season_year, division_number, athletic_district)",
    "unique (team_id, sport, gender, season_year, stage)"
  ],
  "The migration must create all 4 tables with begin;/commit; and their real unique keys"
);

includesAll(
  migrationSource,
  [
    "enable row level security",
    "revoke all on table public.ohio_tournament_stage_calendar from anon, authenticated",
    "revoke all on table public.ohio_tournament_qualification_thresholds from anon, authenticated",
    "revoke all on table public.ohio_tournament_regional_assignments from anon, authenticated",
    "revoke all on table public.team_advancement_status from anon, authenticated",
    "grant all on table public.ohio_tournament_stage_calendar to service_role",
    "grant all on table public.ohio_tournament_qualification_thresholds to service_role",
    "grant all on table public.ohio_tournament_regional_assignments to service_role",
    "grant all on table public.team_advancement_status to service_role"
  ],
  "Every new table must be RLS-protected, revoked from anon/authenticated, and granted to service_role only"
);

assert.ok(
  migrationSource.includes("qualifying_teams integer check (qualifying_teams is null or qualifying_teams > 0)"),
  "qualifying_teams must be constrained > 0, never >= 0, so a nonexistent qualifying combination can never be stored as a real-looking zero."
);
assert.ok(
  migrationSource.includes("qualifying_individuals integer check (qualifying_individuals is null or qualifying_individuals > 0)"),
  "qualifying_individuals must carry the same > 0 (never >= 0) guarantee."
);

assert.ok(
  !/create table if not exists public\.(team_pages|ohio_schools|ohio_school_divisions|ohio_tournament_sites)\b/i.test(migrationSource),
  "This migration must be purely additive -- it must never recreate an existing table."
);

assert.ok(
  migrationSource.includes("'cross_country', 2026, 1, 'district', false"),
  "The seed data must record Division 1's district round as stage_applies = false -- a real regulation encoded as data, not assumed by application code alone."
);

includesAll(
  serviceSource,
  ["from \"./ohio_foundation_service.mjs\"", "parseDivisionNumber"],
  "Division parsing must be reused from lib/ohio_foundation_service.mjs, not re-implemented"
);

includesAll(
  teamsApiSource,
  ["ohio_school_id,", "loadTeamPathToState", "isMissingPathToStateError", "path_to_state: pathToState"],
  "api/teams/detail.js must select ohio_school_id, load the path guarded against a not-yet-run migration, and return it in the response"
);

includesAll(
  athletesApiSource,
  ["loadAthletePathToState", "isMissingPathToStateError", "path_to_state: pathToState"],
  "api/athletes/detail.js must load the athlete's path guarded the same way and return it in the response"
);

includesAll(
  adminApiSource,
  ["isAdminRequest(request)", "list_teams", "get_team_path", "set_status", "clear_status", "list_thresholds", "\"Podium Watch Admin\""],
  "The admin endpoint must require admin sign-in and expose team search, status get/set/clear, and seed verification"
);

includesAll(
  teamPageSource,
  ["data-team-path-section", "/scripts/path-to-state.js"],
  "The team page must have the Path to State section and load the shared renderer script"
);

includesAll(
  athletePageSource,
  ["data-athlete-path-panel", "/scripts/path-to-state.js"],
  "The athlete page must have the Path to State panel and load the shared renderer script"
);

assert.ok(
  teamPageSource.indexOf("/scripts/path-to-state.js") < teamPageSource.indexOf("/scripts/team-profile.js"),
  "The shared renderer must be loaded before team-profile.js, which calls into it"
);
assert.ok(
  athletePageSource.indexOf("/scripts/path-to-state.js") < athletePageSource.indexOf("/scripts/athlete-profile.js"),
  "The shared renderer must be loaded before athlete-profile.js, which calls into it"
);

includesAll(teamScriptSource, ["renderPathToState", "window.PodiumPathToState"], "team-profile.js must render the roadmap via the shared renderer, not reimplement it");
includesAll(athleteScriptSource, ["renderPath(data)", "window.PodiumPathToState"], "athlete-profile.js must render the roadmap via the shared renderer, not reimplement it");

includesAll(cssSource, [".path-to-state {", "@media (max-width: 700px)"], "The shared stepper CSS must exist once in main.css and collapse to vertical at the site's existing 700px breakpoint");

assert.ok(
  !teamPageSource.includes(".path-to-state-dot {") && !athletePageSource.includes(".path-to-state-dot {"),
  "The stepper's CSS must live in main.css once -- never duplicated into either page's own <style> block."
);

console.log("Path to State validation passed.");
console.log("Division 1's 3-node (no district round) shape checked against a full Division 2/3/4 4-node comparison, including a direct assertion that no Division 1 node ever carries the key \"district\".");
console.log("The never-render-zero guarantee checked directly against the real Division 1 / Northwest gap (no such regional exists): resolution=\"unavailable\", both counts null, qualifying_text null, and the fully serialized path checked to never contain the string \"Top 0\".");
console.log("Threshold resolution checked for all three outcomes (exact, division_uniform, unavailable), including that disagreeing division-wide rows are never averaged or maxed.");
console.log("Status resolution order checked: an athlete-specific row beats an admin team row beats the neutral date-based default -- proving the future per-athlete forward hook already works even though it's always empty in this launch.");
console.log("pickCurrentNodeKey checked: only a full qualified_team status advances the current marker past a node; eliminated and qualified_individuals both correctly stop it there.");
console.log("Edge cases checked: missing gender, missing division, missing season data, and no linked official school (self-reported division) all degrade cleanly instead of crashing or rendering fake data.");
console.log("The shared renderer (public/scripts/path-to-state.js) checked directly from Node: correct node counts for both the 3-node and 4-node shapes, the never-render-zero guarantee at the presentation layer, an unavailable path rendering nothing at all, and a real admin note rendering escaped rather than stripped or left vulnerable to injection.");
