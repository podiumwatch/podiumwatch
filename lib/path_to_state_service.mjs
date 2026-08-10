import { divisionNumber as parseDivisionNumber, canonicalDivision } from "./ohio_foundation_service.mjs";
import { supabaseAdmin } from "./supabase-admin.mjs";

// Podium Watch's cross country tournament advancement roadmap: Regular
// Season -> District -> Regional -> State for Divisions 2/3/4, or Regular
// Season -> Regional -> State for Division 1 (OHSAA regulation 3.1 --
// Division 1 has no district round). See install/10_PATH_TO_STATE.sql for
// the schema this reads from and docs/DECISIONS.md for the three scope
// decisions this launch made: advancement status is manually set by an
// admin (not auto-computed from results ingestion), district/regional site
// logistics are out of scope, and cross country only for now.
//
// Split into a pure half (this section -- directly unit-testable with no
// database, see scripts/test-path-to-state.mjs) and a database-backed half
// below the divider, matching lib/fan_poll_service.mjs's
// computeMovement/countBallotsByWeekId pattern.

export const PATH_SPORT = "cross_country";

export const STAGE_LABELS = {
  regular_season: "Regular Season",
  district: "District",
  regional: "Regional",
  state: "State Championship"
};

const STAGE_ARTICLE_LABELS = {
  district: "the district",
  regional: "the regional",
  state: "the state championship"
};

export const STATUS_VALUES = ["not_started", "upcoming", "qualified_team", "qualified_individuals", "eliminated"];

export const STATUS_LABELS = {
  not_started: "Not started",
  upcoming: "Upcoming",
  qualified_team: "Qualified as a team",
  qualified_individuals: "Individual qualifiers advanced",
  eliminated: "Season ended here"
};

export const STATUS_TONES = {
  not_started: "muted",
  upcoming: "pending",
  qualified_team: "qualified",
  qualified_individuals: "partial",
  eliminated: "ended"
};

// Only Division 1 skips the district round -- a real OHSAA cross country
// rule (regulation 3.1), not a guess. If track and field is ever added to
// this feature, its own structure should be verified separately rather
// than assumed to match.
export function hasDistrictRound(divisionNumber) {
  if (divisionNumber === 1) return false;
  if ([2, 3, 4, 5].includes(divisionNumber)) return true;
  return null;
}

export function stageSequenceFor(divisionNumber) {
  if (!Number.isInteger(divisionNumber) || divisionNumber < 1 || divisionNumber > 5) {
    return null;
  }

  return hasDistrictRound(divisionNumber) === false
    ? ["regular_season", "regional", "state"]
    : ["regular_season", "district", "regional", "state"];
}

export function articleLabelForStage(stageKey) {
  return STAGE_ARTICLE_LABELS[stageKey] || null;
}

// The threshold table's own vocabulary describes a TRANSITION (advancing
// out of a round), not the round itself -- district's transition is
// "district_to_regional", regional's is "regional_to_state". The regular
// season and state have no transition row (there's nothing to qualify out
// of the regular season into except the first tournament round, and
// nothing past state).
export function transitionStageFor(stageKey) {
  if (stageKey === "district") return "district_to_regional";
  if (stageKey === "regional") return "regional_to_state";
  return null;
}

export function scopeForStage({ stageKey, athleticDistrict, regionalName }) {
  if (stageKey === "district") {
    return athleticDistrict ? { scope_type: "athletic_district", scope_name: athleticDistrict } : null;
  }
  if (stageKey === "regional") {
    return regionalName ? { scope_type: "regional", scope_name: regionalName } : null;
  }
  return null;
}

// Which named regional a (division, athletic_district) feeds into.
// Returns null (never a guess) when there's no row, or the row exists but
// isn't confirmed ("unknown" status) -- see install/10_PATH_TO_STATE.sql's
// design note on why Division 1's East/Southeast/Northwest mapping is
// intentionally left unknown rather than inferred.
export function resolveRegionalName({ assignmentRows, sport = PATH_SPORT, seasonYear, divisionNumber, athleticDistrict }) {
  if (!athleticDistrict) return null;

  const row = (assignmentRows || []).find((candidate) =>
    candidate.sport === sport &&
    candidate.season_year === seasonYear &&
    candidate.division_number === divisionNumber &&
    candidate.athletic_district === athleticDistrict
  );

  if (!row || row.assignment_status !== "published") {
    return null;
  }

  return row.regional_name || null;
}

export function findThreshold({ thresholdRows, divisionNumber, gender, stage, scopeType, scopeName }) {
  return (thresholdRows || []).find((row) =>
    row.division_number === divisionNumber &&
    row.gender === gender &&
    row.stage === stage &&
    row.scope_type === scopeType &&
    row.scope_name === scopeName
  ) || null;
}

// The honest-degradation core of this feature. Three possible outcomes,
// in order of preference:
//   "exact"            -- a real seeded row for this exact scope (this
//                          team's specific athletic district or regional).
//   "division_uniform" -- the exact scope isn't known (e.g. no regional
//                          resolved yet), but every seeded row for this
//                          division+gender+stage agrees on both numbers,
//                          so the number is a fact about the whole
//                          division, not a guess about this one team.
//   "unavailable"       -- no row, or rows disagree. Both counts come back
//                          null. Never averaged, never maxed, never
//                          falls back across a different division or
//                          gender.
export function resolveThresholdForStage({ thresholdRows, divisionNumber, gender, stageKey, athleticDistrict, regionalName }) {
  const transition = transitionStageFor(stageKey);

  if (!transition) {
    return { qualifying_teams: null, qualifying_individuals: null, scope_label: null, min_scoring_finishers: null, resolution: "not_applicable" };
  }

  const scope = scopeForStage({ stageKey, athleticDistrict, regionalName });

  if (scope) {
    const row = findThreshold({ thresholdRows, divisionNumber, gender, stage: transition, scopeType: scope.scope_type, scopeName: scope.scope_name });
    if (row) {
      return {
        qualifying_teams: row.qualifying_teams ?? null,
        qualifying_individuals: row.qualifying_individuals ?? null,
        scope_label: scope.scope_name,
        min_scoring_finishers: row.min_scoring_finishers ?? null,
        resolution: "exact"
      };
    }
  }

  const candidateScopeType = stageKey === "district" ? "athletic_district" : "regional";
  const matchingRows = (thresholdRows || []).filter((row) =>
    row.division_number === divisionNumber &&
    row.gender === gender &&
    row.stage === transition &&
    row.scope_type === candidateScopeType
  );

  if (matchingRows.length > 0) {
    const firstTeams = matchingRows[0].qualifying_teams ?? null;
    const firstIndividuals = matchingRows[0].qualifying_individuals ?? null;
    const allAgree = matchingRows.every((row) =>
      (row.qualifying_teams ?? null) === firstTeams && (row.qualifying_individuals ?? null) === firstIndividuals
    );

    if (allAgree) {
      return {
        qualifying_teams: firstTeams,
        qualifying_individuals: firstIndividuals,
        scope_label: null,
        min_scoring_finishers: matchingRows[0].min_scoring_finishers ?? null,
        resolution: "division_uniform"
      };
    }
  }

  return { qualifying_teams: null, qualifying_individuals: null, scope_label: null, min_scoring_finishers: null, resolution: "unavailable" };
}

// Builds the real, exact copy string for a stage -- and returns null,
// never a fabricated "Top 0", whenever a real number isn't available.
export function qualifyingText({ stageKey, qualifyingTeams, qualifyingIndividuals, nextStageLabel, minScoringFinishers }) {
  if (stageKey === "regular_season") {
    const min = Number.isInteger(minScoringFinishers) && minScoringFinishers > 0 ? minScoringFinishers : 5;
    return `At least ${min} runners must finish and score for a team result.`;
  }

  if (stageKey === "state") {
    return "Final round. Team and individual state placement.";
  }

  const teams = Number.isInteger(qualifyingTeams) && qualifyingTeams > 0 ? qualifyingTeams : null;
  const individuals = Number.isInteger(qualifyingIndividuals) && qualifyingIndividuals > 0 ? qualifyingIndividuals : null;
  const nextLabel = nextStageLabel || "the next round";

  if (teams && individuals) {
    return `Top ${teams} teams and the next ${individuals} individuals advance to ${nextLabel}.`;
  }
  if (teams) {
    return `Top ${teams} teams advance to ${nextLabel}.`;
  }
  return null;
}

export function statusLabel(status) {
  return STATUS_LABELS[status] || STATUS_LABELS.not_started;
}

export function statusTone(status) {
  return STATUS_TONES[status] || STATUS_TONES.not_started;
}

// A stage with no recorded status yet defaults to "upcoming" if its date
// hasn't happened, otherwise "not_started" -- a neutral placeholder, never
// a claim about a real result. Returns null when the stage doesn't apply
// to this division at all (callers should skip it, not display a default).
export function defaultStatusForStage({ stageDate, stageApplies = true, today = new Date() }) {
  if (stageApplies === false) {
    return null;
  }
  if (!stageDate) {
    return "not_started";
  }
  const date = new Date(`${stageDate}T23:59:59`);
  if (Number.isNaN(date.getTime())) {
    return "not_started";
  }
  return date.getTime() >= today.getTime() ? "upcoming" : "not_started";
}

// Resolution order: an athlete-specific status row (the forward hook --
// always an empty array in this launch) beats the team-wide admin-set
// status, which beats the neutral date-based default.
export function pickStatusForStage({ stageKey, teamStatusRows, athleteStatusRows, calendarRow, today = new Date() }) {
  const athleteRow = (athleteStatusRows || []).find((row) => row.stage === stageKey);
  if (athleteRow) {
    return {
      status: athleteRow.status,
      status_source: "athlete",
      note: athleteRow.note || null,
      individual_qualifier_count: athleteRow.individual_qualifier_count ?? null
    };
  }

  const teamRow = (teamStatusRows || []).find((row) => row.stage === stageKey);
  if (teamRow) {
    return {
      status: teamRow.status,
      status_source: "admin",
      note: teamRow.note || null,
      individual_qualifier_count: teamRow.individual_qualifier_count ?? null
    };
  }

  const fallback = defaultStatusForStage({
    stageDate: calendarRow?.stage_date || null,
    stageApplies: calendarRow?.stage_applies !== false,
    today
  });

  return { status: fallback || "not_started", status_source: "default", note: null, individual_qualifier_count: null };
}

const DECIDED_STATUSES = new Set(["qualified_team", "qualified_individuals", "eliminated"]);

// The furthest node the team's own path actually reaches. Finds the LAST
// stage (in order) with a real, decided outcome -- not_started/upcoming
// are neutral placeholders, never "decided." If that last decided stage
// is a full "qualified_team", the current marker moves one stage further
// (they advanced and are now sitting at the next round); eliminated and
// qualified_individuals both mean the TEAM's own path stops right there
// (individuals may continue, tracked separately). If nothing has been
// decided anywhere yet, the current marker sits at the very first node
// (regular_season) -- the season simply hasn't reached a real outcome.
export function pickCurrentNodeKey(nodes) {
  if (!nodes || !nodes.length) {
    return null;
  }

  let lastDecidedIndex = -1;
  nodes.forEach((node, index) => {
    if (DECIDED_STATUSES.has(node.status)) {
      lastDecidedIndex = index;
    }
  });

  if (lastDecidedIndex === -1) {
    return nodes[0].key;
  }

  const lastDecidedNode = nodes[lastDecidedIndex];
  const currentIndex = lastDecidedNode.status === "qualified_team"
    ? Math.min(lastDecidedIndex + 1, nodes.length - 1)
    : lastDecidedIndex;

  return nodes[currentIndex].key;
}

// Cross country season runs August-November. Picks the current season if
// it's seeded, otherwise the most recent seeded season at or before today
// -- never jumps ahead to a future season seeded early.
export function resolveSeasonYear({ availableSeasonYears, today = new Date() }) {
  const years = (availableSeasonYears || []).filter((year) => Number.isInteger(year)).sort((a, b) => b - a);
  if (!years.length) {
    return null;
  }

  const currentYear = today.getFullYear();
  if (years.includes(currentYear)) {
    return currentYear;
  }

  return years.find((year) => year <= currentYear) || years[years.length - 1];
}

function formatStageDateLabel(dateStr) {
  if (!dateStr) return null;
  const date = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(date);
}

function buildSummaryText({ nodes, currentNodeKey, athleticDistrict, regionalName }) {
  const currentNode = nodes.find((node) => node.key === currentNodeKey) || null;
  if (!currentNode) return null;

  const scopeBit = currentNode.key === "district" && athleticDistrict
    ? ` out of the ${athleticDistrict} District`
    : currentNode.key === "regional" && regionalName
      ? ` at the ${regionalName} Regional`
      : "";

  if (currentNode.status === "qualified_team") {
    return `Qualified as a team${scopeBit} -- next up: ${currentNode.date_label || currentNode.label}.`;
  }
  if (currentNode.status === "qualified_individuals") {
    return `Individual qualifiers advanced${scopeBit}; the team's season ended here.`;
  }
  if (currentNode.status === "eliminated") {
    return `Season ended at ${currentNode.label}${scopeBit}.`;
  }
  if (currentNode.status === "upcoming" && currentNode.date_label) {
    return `${currentNode.label} is ${currentNode.date_label}${scopeBit}.`;
  }
  return `${currentNode.label}${scopeBit}.`;
}

const SOURCE_NOTE = "Qualifying counts come from the 2026 OHSAA Cross Country Tournament Regulations, adopted June 11, 2026. Advancement status is entered by Podium Watch and is not an official OHSAA result.";

// The main builder. Every input is plain data (rows already loaded from
// the database, or a test fixture) -- this function never queries
// anything itself, which is what makes it directly unit-testable. Returns
// { available: false, reason, nodes: [] } whenever a real roadmap can't
// be built; callers must hide the section entirely rather than render a
// half-populated one.
export function buildPathToState({
  sport = PATH_SPORT,
  seasonYear,
  gender,
  divisionNumber,
  divisionLabel = null,
  divisionSource = null,
  athleticDistrict = null,
  calendarRows = [],
  thresholdRows = [],
  assignmentRows = [],
  teamStatusRows = [],
  athleteStatusRows = [],
  today = new Date()
}) {
  if (sport !== PATH_SPORT) {
    return { available: false, reason: "unsupported_sport", nodes: [] };
  }
  if (gender !== "boys" && gender !== "girls") {
    return { available: false, reason: "missing_gender", nodes: [] };
  }
  if (!Number.isInteger(seasonYear)) {
    return { available: false, reason: "missing_season_data", nodes: [] };
  }

  const stageKeys = stageSequenceFor(divisionNumber);
  if (!stageKeys) {
    return { available: false, reason: "missing_division", nodes: [] };
  }

  const seasonCalendarRows = (calendarRows || []).filter((row) =>
    row.sport === sport && row.season_year === seasonYear && row.division_number === divisionNumber
  );

  if (!seasonCalendarRows.length) {
    return { available: false, reason: "missing_season_data", nodes: [] };
  }

  const regionalName = resolveRegionalName({ assignmentRows, sport, seasonYear, divisionNumber, athleticDistrict });

  const rawNodes = stageKeys.map((stageKey, index) => {
    const calendarRow = seasonCalendarRows.find((row) => row.stage === stageKey) || null;
    const threshold = resolveThresholdForStage({ thresholdRows, divisionNumber, gender, stageKey, athleticDistrict, regionalName });
    const nextStageKey = stageKeys[index + 1] || null;
    const text = qualifyingText({
      stageKey,
      qualifyingTeams: threshold.qualifying_teams,
      qualifyingIndividuals: threshold.qualifying_individuals,
      nextStageLabel: nextStageKey ? articleLabelForStage(nextStageKey) : null,
      minScoringFinishers: threshold.min_scoring_finishers
    });

    const picked = pickStatusForStage({ stageKey, teamStatusRows, athleteStatusRows, calendarRow, today });

    return {
      key: stageKey,
      label: STAGE_LABELS[stageKey],
      order: index + 1,
      is_final: stageKey === "state",
      date: calendarRow?.stage_date || null,
      date_label: formatStageDateLabel(calendarRow?.stage_date || null),
      entry_deadline: calendarRow?.entry_deadline || null,
      qualifying_teams: threshold.qualifying_teams,
      qualifying_individuals: threshold.qualifying_individuals,
      qualifying_text: text,
      threshold_scope_label: threshold.scope_label,
      threshold_resolution: threshold.resolution,
      status: picked.status,
      status_label: statusLabel(picked.status),
      status_tone: statusTone(picked.status),
      status_source: picked.status_source,
      individual_qualifier_count: picked.individual_qualifier_count,
      note: picked.note
    };
  });

  const currentNodeKey = pickCurrentNodeKey(rawNodes);
  const currentIndex = rawNodes.findIndex((node) => node.key === currentNodeKey);
  const nodes = rawNodes.map((node, index) => ({
    ...node,
    reached: currentIndex === -1 ? false : index <= currentIndex
  }));

  return {
    available: true,
    reason: null,
    sport,
    season_year: seasonYear,
    gender,
    division_number: divisionNumber,
    division_label: divisionLabel || canonicalDivision(String(divisionNumber)),
    division_source: divisionSource,
    athletic_district: athleticDistrict,
    regional_name: regionalName,
    has_district_round: stageKeys.includes("district"),
    current_node_key: currentNodeKey,
    nodes,
    summary: buildSummaryText({ nodes, currentNodeKey, athleticDistrict, regionalName }),
    source_note: SOURCE_NOTE
  };
}

// The athlete page's "divergence" view: a short note when the athlete's
// team didn't fully advance as a team but the roadmap continues (either
// because individuals qualified on, or the season simply ended). An
// admin-entered note on the relevant status row always overrides this
// derived default -- this function only ever supplies the fallback.
export function buildAthletePathView({ path, overrideNote = null }) {
  if (!path || !path.available) {
    return { available: false, note: null };
  }

  if (overrideNote) {
    return { available: true, note: overrideNote };
  }

  const divergentNode = path.nodes.slice().reverse().find((node) =>
    node.status === "qualified_individuals" || node.status === "eliminated"
  ) || null;

  if (!divergentNode) {
    return { available: true, note: null };
  }

  if (divergentNode.status === "qualified_individuals") {
    return {
      available: true,
      note: "This team did not advance as a team from this round. Individual qualifiers advance on their own and are not eligible to score as a team at the next round."
    };
  }

  return {
    available: true,
    note: `This team's season ended at the ${divergentNode.label}. Any individual qualifier's own advancement is tracked separately.`
  };
}

// The two real shapes this error actually arrives in before
// install/10_PATH_TO_STATE.sql has been run, confirmed by calling the
// real production Supabase project directly (not guessed): raw Postgres
// 42P01 (undefined_table), and Supabase's REST layer (PostgREST)
// wrapping the same condition as its own PGRST205 with a completely
// different message ("Could not find the table '...' in the schema
// cache") -- supabaseAdmin goes through PostgREST, so PGRST205 is what
// actually shows up in practice, not 42P01. Callers use this to degrade
// to path_to_state: null instead of ever 500ing a whole team or athlete
// page over a migration that hasn't landed yet.
export function isMissingPathToStateError(error) {
  return Boolean(error) && (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /relation .* does not exist/i.test(String(error?.message || "")) ||
    /could not find the table/i.test(String(error?.message || ""))
  );
}

// --- Database-backed --------------------------------------------------------
// Everything below actually queries Supabase. Kept separate from the pure
// functions above so scripts/test-path-to-state.mjs can exercise all of
// the real business logic (the D1/D2/D3/D4 node shape, the honest
// threshold degradation, the never-render-zero guarantee, status
// resolution order) without a live database connection -- the same split
// lib/fan_poll_service.mjs uses for computeMovement/getPollResults.

function error(message, status = 400) {
  const value = new Error(message);
  value.status = status;
  return value;
}

export async function loadSeasonReference({ sport = PATH_SPORT, seasonYear }) {
  const [calendarResult, thresholdResult, assignmentResult] = await Promise.all([
    supabaseAdmin.from("ohio_tournament_stage_calendar").select("*").eq("sport", sport).eq("season_year", seasonYear),
    supabaseAdmin.from("ohio_tournament_qualification_thresholds").select("*").eq("sport", sport).eq("season_year", seasonYear),
    supabaseAdmin.from("ohio_tournament_regional_assignments").select("*").eq("sport", sport).eq("season_year", seasonYear)
  ]);

  if (calendarResult.error) throw calendarResult.error;
  if (thresholdResult.error) throw thresholdResult.error;
  if (assignmentResult.error) throw assignmentResult.error;

  return {
    calendarRows: calendarResult.data || [],
    thresholdRows: thresholdResult.data || [],
    assignmentRows: assignmentResult.data || []
  };
}

export async function loadAvailableSeasonYears({ sport = PATH_SPORT } = {}) {
  const { data, error: queryError } = await supabaseAdmin
    .from("ohio_tournament_stage_calendar")
    .select("season_year")
    .eq("sport", sport);

  if (queryError) throw queryError;

  return [...new Set((data || []).map((row) => row.season_year))];
}

// Real, verified division per gender for a school -- prefers the official
// ohio_school_divisions record (current = true) over anything else. A
// school can have more than one "current" row across season boundaries;
// the row matching the requested seasonYear wins if there's ever a tie.
export async function loadOfficialDivisions({ ohioSchoolId, sport = PATH_SPORT, seasonYear }) {
  if (!ohioSchoolId) {
    return new Map();
  }

  const { data, error: queryError } = await supabaseAdmin
    .from("ohio_school_divisions")
    .select("gender, division, season_start_year")
    .eq("school_id", ohioSchoolId)
    .eq("sport", sport)
    .eq("current", true);

  if (queryError) throw queryError;

  const map = new Map();
  for (const row of data || []) {
    if (!map.has(row.gender) || row.season_start_year === seasonYear) {
      map.set(row.gender, row.division);
    }
  }
  return map;
}

export async function loadTeamStatusRows({ teamId, sport = PATH_SPORT, seasonYear, gender = null }) {
  if (!teamId) {
    return [];
  }

  let query = supabaseAdmin
    .from("team_advancement_status")
    .select("*")
    .eq("team_id", teamId)
    .eq("sport", sport)
    .eq("season_year", seasonYear);

  if (gender) {
    query = query.eq("gender", gender);
  }

  const { data, error: queryError } = await query;
  if (queryError) throw queryError;
  return data || [];
}

// Shared glue between loadTeamPathToState (called once per gender) and
// loadAthletePathToState (called once for the athlete's own gender) --
// resolves the real division (official first, self-reported fallback)
// and hands everything to the pure buildPathToState().
function buildGenderPathFromSources({
  gender,
  sport,
  seasonYear,
  calendarRows,
  thresholdRows,
  assignmentRows,
  officialDivisions,
  teamStatusRows,
  athleticDistrict,
  selfReportedDivisionLabel
}) {
  const officialDivisionLabel = officialDivisions.get(gender) || null;
  const divisionLabel = officialDivisionLabel || selfReportedDivisionLabel || null;
  const divisionSource = officialDivisionLabel
    ? "ohio_school_divisions"
    : (selfReportedDivisionLabel ? "team_pages_self_reported" : null);
  const divisionNum = divisionLabel ? parseDivisionNumber(divisionLabel) : null;

  return buildPathToState({
    sport,
    seasonYear,
    gender,
    divisionNumber: divisionNum,
    divisionLabel,
    divisionSource,
    athleticDistrict,
    calendarRows,
    thresholdRows,
    assignmentRows,
    teamStatusRows: (teamStatusRows || []).filter((row) => row.gender === gender)
  });
}

// The team page's own loader -- both genders at once, since the page
// shows a toggle when both exist. team must at minimum carry
// { id, ohio_school_id, cross_country_boys_division, cross_country_girls_division }.
export async function loadTeamPathToState({ team, sport = PATH_SPORT, seasonYear = null }) {
  if (!team) {
    return null;
  }

  const availableYears = await loadAvailableSeasonYears({ sport });
  const resolvedYear = seasonYear || resolveSeasonYear({ availableSeasonYears: availableYears });
  if (!resolvedYear) {
    return null;
  }

  let athleticDistrict = null;
  if (team.ohio_school_id) {
    const { data: schoolRow, error: schoolError } = await supabaseAdmin
      .from("ohio_schools")
      .select("athletic_district")
      .eq("id", team.ohio_school_id)
      .maybeSingle();
    if (schoolError) throw schoolError;
    athleticDistrict = schoolRow?.athletic_district || null;
  }

  const [{ calendarRows, thresholdRows, assignmentRows }, officialDivisions, teamStatusRows] = await Promise.all([
    loadSeasonReference({ sport, seasonYear: resolvedYear }),
    loadOfficialDivisions({ ohioSchoolId: team.ohio_school_id, sport, seasonYear: resolvedYear }),
    loadTeamStatusRows({ teamId: team.id, sport, seasonYear: resolvedYear })
  ]);

  const shared = { sport, seasonYear: resolvedYear, calendarRows, thresholdRows, assignmentRows, officialDivisions, teamStatusRows, athleticDistrict };

  return {
    season_year: resolvedYear,
    athletic_district: athleticDistrict,
    boys: buildGenderPathFromSources({ ...shared, gender: "boys", selfReportedDivisionLabel: team.cross_country_boys_division }),
    girls: buildGenderPathFromSources({ ...shared, gender: "girls", selfReportedDivisionLabel: team.cross_country_girls_division })
  };
}

// The athlete page's loader -- one gender only (the athlete's own).
// Accepts the school/team records the athlete API has already queried
// (see api/athletes/detail.js) rather than re-querying ohio_schools
// itself. Skips entirely (returns null) for profile.gender === "unspecified".
export async function loadAthletePathToState({ profile, school, team, sport = PATH_SPORT, seasonYear = null }) {
  if (!profile || (profile.gender !== "boys" && profile.gender !== "girls")) {
    return null;
  }
  if (!school && !team) {
    return null;
  }

  const gender = profile.gender;
  const ohioSchoolId = team?.ohio_school_id || school?.id || null;
  const athleticDistrict = school?.athletic_district || null;

  const availableYears = await loadAvailableSeasonYears({ sport });
  const resolvedYear = seasonYear || resolveSeasonYear({ availableSeasonYears: availableYears });
  if (!resolvedYear) {
    return null;
  }

  const [{ calendarRows, thresholdRows, assignmentRows }, officialDivisions, teamStatusRows] = await Promise.all([
    loadSeasonReference({ sport, seasonYear: resolvedYear }),
    loadOfficialDivisions({ ohioSchoolId, sport, seasonYear: resolvedYear }),
    loadTeamStatusRows({ teamId: team?.id || null, sport, seasonYear: resolvedYear, gender })
  ]);

  const selfReportedDivisionLabel = gender === "boys" ? team?.cross_country_boys_division : team?.cross_country_girls_division;

  const path = buildGenderPathFromSources({
    gender,
    sport,
    seasonYear: resolvedYear,
    calendarRows,
    thresholdRows,
    assignmentRows,
    officialDivisions,
    teamStatusRows,
    athleticDistrict,
    selfReportedDivisionLabel
  });

  return { path, athlete_view: buildAthletePathView({ path }) };
}

// --- Admin: team search and manual status control ---------------------------
// Shaped consistent with lib/fan_poll_service.mjs's admin section (small,
// explicit, auditable functions), the closest recent precedent for a
// focused admin tool in this project.

export async function listPathAdminTeams({ search = "", limit = 40 } = {}) {
  let query = supabaseAdmin
    .from("team_pages")
    .select("id, school_name, slug, ohio_school_id, cross_country_boys_division, cross_country_girls_division")
    .eq("published", true)
    .eq("suspended", false)
    .is("archived_at", null)
    .is("merged_into_team_id", null)
    .order("school_name", { ascending: true })
    .limit(limit);

  const cleanSearch = String(search || "").trim();
  if (cleanSearch) {
    query = query.ilike("school_name", `%${cleanSearch}%`);
  }

  const { data, error: queryError } = await query;
  if (queryError) throw queryError;

  const schoolIds = [...new Set((data || []).map((team) => team.ohio_school_id).filter(Boolean))];
  let districtBySchoolId = new Map();

  if (schoolIds.length) {
    const { data: schools, error: schoolsError } = await supabaseAdmin
      .from("ohio_schools")
      .select("id, athletic_district")
      .in("id", schoolIds);
    if (schoolsError) throw schoolsError;
    districtBySchoolId = new Map((schools || []).map((school) => [school.id, school.athletic_district]));
  }

  return (data || []).map((team) => ({
    id: team.id,
    school_name: team.school_name,
    slug: team.slug,
    ohio_school_id: team.ohio_school_id,
    boys_division: team.cross_country_boys_division,
    girls_division: team.cross_country_girls_division,
    athletic_district: team.ohio_school_id ? (districtBySchoolId.get(team.ohio_school_id) || null) : null
  }));
}

export async function getTeamAdvancementRows({ teamId, sport = PATH_SPORT, seasonYear = null }) {
  if (!teamId) {
    throw error("Choose a team.", 400);
  }

  const { data: team, error: teamError } = await supabaseAdmin
    .from("team_pages")
    .select("id, school_name, slug, ohio_school_id, cross_country_boys_division, cross_country_girls_division")
    .eq("id", teamId)
    .maybeSingle();

  if (teamError) throw teamError;
  if (!team) {
    throw error("That team could not be found.", 404);
  }

  const pathData = await loadTeamPathToState({ team, sport, seasonYear });

  return {
    team,
    season_year: pathData?.season_year || seasonYear,
    boys: pathData?.boys || null,
    girls: pathData?.girls || null
  };
}

// Validates the stage server-side against the team's REAL division
// sequence before writing anything -- this is what makes it impossible to
// set a District status on a Division 1 team, not just a UI convenience.
export async function setTeamAdvancementStatus({
  teamId,
  sport = PATH_SPORT,
  gender,
  seasonYear,
  stage,
  status,
  individualQualifierCount = null,
  note = null,
  actor
}) {
  if (!teamId) throw error("Choose a team.", 400);
  if (gender !== "boys" && gender !== "girls") throw error("Choose boys or girls.", 400);
  if (!STATUS_VALUES.includes(status)) throw error("Choose a real status.", 400);
  if (!Number.isInteger(seasonYear)) throw error("Choose a real season year.", 400);

  const { data: team, error: teamError } = await supabaseAdmin
    .from("team_pages")
    .select("id, ohio_school_id, cross_country_boys_division, cross_country_girls_division")
    .eq("id", teamId)
    .maybeSingle();

  if (teamError) throw teamError;
  if (!team) throw error("That team could not be found.", 404);

  const officialDivisions = await loadOfficialDivisions({ ohioSchoolId: team.ohio_school_id, sport, seasonYear });
  const selfReportedDivisionLabel = gender === "boys" ? team.cross_country_boys_division : team.cross_country_girls_division;
  const divisionLabel = officialDivisions.get(gender) || selfReportedDivisionLabel || null;
  const divisionNum = divisionLabel ? parseDivisionNumber(divisionLabel) : null;
  const validStages = stageSequenceFor(divisionNum);

  if (!validStages || !validStages.includes(stage)) {
    throw error(`This team's division does not have a "${STAGE_LABELS[stage] || stage}" stage.`, 400);
  }

  const { data, error: upsertError } = await supabaseAdmin
    .from("team_advancement_status")
    .upsert(
      {
        team_id: teamId,
        sport,
        gender,
        season_year: seasonYear,
        stage,
        status,
        individual_qualifier_count: individualQualifierCount,
        note,
        set_by: actor,
        set_at: new Date().toISOString()
      },
      { onConflict: "team_id,sport,gender,season_year,stage" }
    )
    .select("*")
    .single();

  if (upsertError) throw upsertError;
  return data;
}

export async function clearTeamAdvancementStatus({ teamId, sport = PATH_SPORT, gender, seasonYear, stage }) {
  if (!teamId) throw error("Choose a team.", 400);

  const { error: deleteError } = await supabaseAdmin
    .from("team_advancement_status")
    .delete()
    .eq("team_id", teamId)
    .eq("sport", sport)
    .eq("gender", gender)
    .eq("season_year", seasonYear)
    .eq("stage", stage);

  if (deleteError) throw deleteError;
  return { cleared: true };
}

export async function listQualificationThresholds({ sport = PATH_SPORT, seasonYear, divisionNumber = null, gender = null }) {
  if (!Number.isInteger(seasonYear)) throw error("Choose a real season year.", 400);

  let query = supabaseAdmin
    .from("ohio_tournament_qualification_thresholds")
    .select("*")
    .eq("sport", sport)
    .eq("season_year", seasonYear)
    .order("division_number", { ascending: true })
    .order("gender", { ascending: true })
    .order("scope_name", { ascending: true });

  if (Number.isInteger(divisionNumber)) query = query.eq("division_number", divisionNumber);
  if (gender) query = query.eq("gender", gender);

  const { data, error: queryError } = await query;
  if (queryError) throw queryError;
  return data || [];
}
