// State Leaders: a real, data-driven cross country 5K leaderboard --
// Podium Watch's own equivalent of MileSplit's "Rankings" leaders list,
// built from this project's own athlete_performances/athlete_profiles/
// ohio_school_divisions tables rather than borrowed from anywhere else.
// Cross country only ranks the 5K right now (the sport's one common
// distance across the state); track is not wired in yet.
//
// One row per athlete per filter combination -- their single fastest
// qualifying mark, not every race they've run. Only public, verified-
// visible performances from public, non-suspended, non-merged profiles
// are ever considered, matching the same gates the athlete directory
// (api/athletes/index.js) and athlete profile page already use.

import { supabaseAdmin } from "./supabase-admin.mjs";

export const LEADERS_EVENT_KEY = "xc_5k";
export const LEADERS_SPORT = "cross_country";

function error(message, status = 400, code = "LEADERS_ERROR") {
  const value = new Error(message);
  value.status = status;
  value.code = code;
  return value;
}

function isValidGender(value) {
  return value === "boys" || value === "girls";
}

// PostgREST sends .in(column, values) as a URL query parameter, so a
// large id list blows past the request's URL length limit and the
// whole query fails outright (confirmed live: an unfiltered "all
// divisions/grades" query already exceeds it with this project's real
// current data). Same fix already used for this exact failure mode in
// api/athletes/index.js -- batches under that limit and merges the
// results back into one array.
const ID_BATCH_SIZE = 150;

function chunk(values, size) {
  const batches = [];
  for (let index = 0; index < values.length; index += size) {
    batches.push(values.slice(index, index + size));
  }
  return batches;
}

async function selectInBatches(table, select, column, ids, extra) {
  if (!ids.length) return [];

  const batches = await Promise.all(
    chunk(ids, ID_BATCH_SIZE).map((batchIds) => {
      let query = supabaseAdmin.from(table).select(select).in(column, batchIds);
      if (extra) query = extra(query);
      return query;
    })
  );

  const rows = [];
  for (const batch of batches) {
    if (batch.error) throw batch.error;
    rows.push(...(batch.data || []));
  }
  return rows;
}

const DIVISION_LABELS = {
  1: "Division I",
  2: "Division II",
  3: "Division III",
  4: "Division IV"
};

// Pure -- unit-testable with no Supabase connection. Keeps only the
// fastest (lowest mark_value) performance per athlete, since a
// leaderboard shows each athlete's best mark once, not every race.
// Ties keep whichever row was seen first (stable, deterministic given
// a consistent input order).
export function keepFastestPerAthlete(performances) {
  const byProfile = new Map();

  for (const row of performances || []) {
    // Number(null) is 0, not NaN -- a real bug this exact check caught:
    // a missing mark_value would otherwise coerce to 0 and win every
    // comparison as the "fastest" time. null/undefined/'' must be
    // rejected before the numeric check, not left to it.
    if (!row?.profile_id || row.mark_value === null || row.mark_value === undefined || row.mark_value === "") continue;
    if (!Number.isFinite(Number(row.mark_value))) continue;
    const current = byProfile.get(row.profile_id);
    if (!current || Number(row.mark_value) < Number(current.mark_value)) {
      byProfile.set(row.profile_id, row);
    }
  }

  return [...byProfile.values()].sort((first, second) => Number(first.mark_value) - Number(second.mark_value));
}

// Pure -- given a school's set of official division rows for the
// requested sport/gender, finds the one whose season range covers the
// requested season_year. Returns null when no official record exists
// for that school/season (a real, current data gap for any season
// before 2026 -- ohio_school_divisions only covers 2026-2027 today),
// which correctly excludes that performance from a SPECIFIC division
// filter without guessing at a division nobody has confirmed.
export function findDivisionForSeason(divisionRows, seasonYear) {
  const match = (divisionRows || []).find(
    (row) => Number(row.season_start_year) <= Number(seasonYear) && Number(seasonYear) <= Number(row.season_end_year)
  );
  return match ? match.division : null;
}

export async function getLeadersFilters() {
  const { data: years, error: yearsError } = await supabaseAdmin
    .from("athlete_performances")
    .select("season_year")
    .eq("event_key", LEADERS_EVENT_KEY)
    .eq("sport", LEADERS_SPORT)
    .eq("public_visible", true)
    .is("archived_at", null)
    .limit(5000);
  if (yearsError) throw yearsError;

  const distinctYears = [...new Set((years || []).map((row) => row.season_year))].sort((first, second) => second - first);

  return {
    years: distinctYears,
    divisions: Object.entries(DIVISION_LABELS).map(([number, label]) => ({ number: Number(number), label }))
  };
}

export async function getLeaders({ gender, seasonYear, grade, divisionNumber, limit = 100 } = {}) {
  if (!isValidGender(gender)) throw error("Choose boys or girls.", 400, "INVALID_GENDER");

  const cleanYear = Number(seasonYear);
  if (!Number.isInteger(cleanYear) || cleanYear < 2000 || cleanYear > 2200) throw error("Choose a real season year.", 400, "INVALID_SEASON_YEAR");

  const cleanGrade = grade === undefined || grade === null || grade === "" || grade === "all" ? null : Number(grade);
  if (cleanGrade !== null && (!Number.isInteger(cleanGrade) || cleanGrade < 9 || cleanGrade > 12)) {
    throw error("Choose a real grade.", 400, "INVALID_GRADE");
  }

  const cleanDivision = divisionNumber === undefined || divisionNumber === null || divisionNumber === "" || divisionNumber === "all"
    ? null
    : Number(divisionNumber);
  if (cleanDivision !== null && !DIVISION_LABELS[cleanDivision]) throw error("Choose a real division.", 400, "INVALID_DIVISION");

  let query = supabaseAdmin
    .from("athlete_performances")
    .select("id, profile_id, school_id, mark_text, mark_value, meet_name, meet_date, place, grade")
    .eq("event_key", LEADERS_EVENT_KEY)
    .eq("sport", LEADERS_SPORT)
    .eq("season_year", cleanYear)
    .eq("public_visible", true)
    .is("archived_at", null)
    .limit(20000);
  if (cleanGrade !== null) query = query.eq("grade", cleanGrade);

  const { data: performances, error: performanceError } = await query;
  if (performanceError) throw performanceError;

  if (!performances?.length) {
    return { entries: [], total_before_limit: 0 };
  }

  const profileIds = [...new Set(performances.map((row) => row.profile_id))];
  const profiles = await selectInBatches(
    "athlete_profiles",
    "id, slug, display_name, gender, graduation_year",
    "id",
    profileIds,
    (query) => query.eq("gender", gender).eq("public_visible", true).eq("suspended", false).is("archived_at", null).is("merged_into_profile_id", null)
  );

  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const eligiblePerformances = performances.filter((row) => profileMap.has(row.profile_id));

  const schoolIds = [...new Set(eligiblePerformances.map((row) => row.school_id).filter(Boolean))];
  const [schoolRows, divisionRows] = await Promise.all([
    selectInBatches("ohio_schools", "id, school_name, city", "id", schoolIds),
    // Fetched whenever there are any schools to look up, not just when
    // actively filtering by division -- the "All Divisions" view still
    // shows each row's real division as context, it just doesn't
    // exclude anyone based on it.
    selectInBatches(
      "ohio_school_divisions",
      "school_id, division, season_start_year, season_end_year",
      "school_id",
      schoolIds,
      (query) => query.eq("sport", LEADERS_SPORT).eq("gender", gender)
    )
  ]);

  const schoolMap = new Map(schoolRows.map((school) => [school.id, school]));
  const divisionsBySchool = new Map();
  for (const row of divisionRows) {
    const list = divisionsBySchool.get(row.school_id) || [];
    list.push(row);
    divisionsBySchool.set(row.school_id, list);
  }

  let scoped = eligiblePerformances;
  if (cleanDivision !== null) {
    const targetLabel = DIVISION_LABELS[cleanDivision];
    scoped = scoped.filter((row) => findDivisionForSeason(divisionsBySchool.get(row.school_id), cleanYear) === targetLabel);
  }

  const fastestPerAthlete = keepFastestPerAthlete(scoped);
  const limited = fastestPerAthlete.slice(0, limit);

  const entries = limited.map((row, index) => {
    const profile = profileMap.get(row.profile_id);
    const school = schoolMap.get(row.school_id);
    const officialDivision = findDivisionForSeason(divisionsBySchool.get(row.school_id), cleanYear);

    return {
      rank: index + 1,
      athlete_name: profile.display_name,
      athlete_slug: profile.slug,
      school_name: school?.school_name || "Unattached",
      school_city: school?.city || null,
      grade: row.grade,
      mark_text: row.mark_text,
      mark_value: row.mark_value,
      meet_name: row.meet_name,
      meet_date: row.meet_date,
      division: officialDivision
    };
  });

  return { entries, total_before_limit: fastestPerAthlete.length };
}
