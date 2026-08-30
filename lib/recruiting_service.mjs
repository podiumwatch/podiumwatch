import { createHash } from "node:crypto";
import { supabaseAdmin } from "./supabase-admin.mjs";
import {
  cleanAthleteText,
  deriveGraduationYearFromGrade,
  isMissingAthleteFoundationError,
  normalizeAthleteGender,
  normalizeAthleteName,
  slugifyAthlete
} from "./athlete_foundation_service.mjs";

export const EVENT_GROUPS = new Set([
  "cross_country",
  "distance",
  "middle_distance",
  "sprints",
  "hurdles",
  "jumps",
  "pole_vault",
  "throws",
  "combined_events",
  "other"
]);

export const RECRUIT_ACTIVITY_TYPES = new Set([
  "interest",
  "offer",
  "visit",
  "commitment",
  "signing",
  "other"
]);

export const RECRUIT_ACTIVITY_STATUSES = new Set([
  "reported",
  "confirmed_by_athlete",
  "confirmed_by_coach",
  "publicly_announced",
  "disputed"
]);

export const RATING_STATUSES = new Set([
  "draft",
  "published",
  "archived"
]);

export const PERFORMANCE_SOURCE_TYPES = new Set([
  "official",
  "supplied_reference",
  "editorial",
  "community"
]);

export const PERFORMANCE_VERIFICATION = new Set([
  "unverified",
  "source_linked",
  "verified",
  "disputed"
]);

const EVENT_DEFINITIONS = [
  ["xc_2_mile", "Cross Country 2 Mile", "cross_country", "time", "asc", ["2 mile xc", "2 mile cross country"]],
  ["xc_3k", "Cross Country 3K", "cross_country", "time", "asc", ["3k xc", "3k cross country"]],
  ["xc_3200", "Cross Country 3200", "cross_country", "time", "asc", ["3200 xc", "3200 cross country"]],
  ["xc_5k", "Cross Country 5K", "cross_country", "time", "asc", ["5k", "5k xc", "5000 cross country"]],
  ["track_60", "60 Meters", "sprints", "time", "asc", ["60", "60m"]],
  ["track_100", "100 Meters", "sprints", "time", "asc", ["100", "100m"]],
  ["track_200", "200 Meters", "sprints", "time", "asc", ["200", "200m"]],
  ["track_300", "300 Meters", "sprints", "time", "asc", ["300", "300m"]],
  ["track_400", "400 Meters", "sprints", "time", "asc", ["400", "400m"]],
  ["track_500", "500 Meters", "sprints", "time", "asc", ["500", "500m"]],
  ["track_600", "600 Meters", "sprints", "time", "asc", ["600", "600m"]],
  ["track_800", "800 Meters", "middle_distance", "time", "asc", ["800", "800m"]],
  ["track_1000", "1000 Meters", "middle_distance", "time", "asc", ["1000", "1000m"]],
  ["track_1600", "1600 Meters", "middle_distance", "time", "asc", ["1600", "1600m"]],
  ["track_mile", "One Mile", "middle_distance", "time", "asc", ["mile", "1 mile"]],
  ["track_3200", "3200 Meters", "distance", "time", "asc", ["3200", "3200m"]],
  ["track_2_mile", "Two Mile", "distance", "time", "asc", ["2 mile", "two mile"]],
  ["track_5000", "5000 Meters", "distance", "time", "asc", ["5000", "5000m"]],
  ["hurdles_60", "60 Meter Hurdles", "hurdles", "time", "asc", ["60h", "60 hurdles"]],
  ["hurdles_100", "100 Meter Hurdles", "hurdles", "time", "asc", ["100h", "100 hurdles"]],
  ["hurdles_110", "110 Meter Hurdles", "hurdles", "time", "asc", ["110h", "110 hurdles"]],
  ["hurdles_300", "300 Meter Hurdles", "hurdles", "time", "asc", ["300h", "300 hurdles"]],
  ["hurdles_400", "400 Meter Hurdles", "hurdles", "time", "asc", ["400h", "400 hurdles"]],
  ["high_jump", "High Jump", "jumps", "height", "desc", ["high jump", "hj"]],
  ["long_jump", "Long Jump", "jumps", "distance", "desc", ["long jump", "lj"]],
  ["triple_jump", "Triple Jump", "jumps", "distance", "desc", ["triple jump", "tj"]],
  ["pole_vault", "Pole Vault", "pole_vault", "height", "desc", ["pole vault", "pv"]],
  ["shot_put", "Shot Put", "throws", "distance", "desc", ["shot put", "shot"]],
  ["discus", "Discus", "throws", "distance", "desc", ["discus"]],
  ["weight_throw", "Weight Throw", "throws", "distance", "desc", ["weight throw", "weight"]],
  ["hammer", "Hammer Throw", "throws", "distance", "desc", ["hammer", "hammer throw"]],
  ["javelin", "Javelin", "throws", "distance", "desc", ["javelin"]],
  ["pentathlon", "Pentathlon", "combined_events", "points", "desc", ["pentathlon"]],
  ["heptathlon", "Heptathlon", "combined_events", "points", "desc", ["heptathlon"]],
  ["decathlon", "Decathlon", "combined_events", "points", "desc", ["decathlon"]]
].map(([eventKey, displayName, eventGroup, measurementType, sortDirection, aliases]) => ({
  event_key: eventKey,
  display_name: displayName,
  event_group: eventGroup,
  measurement_type: measurementType,
  sort_direction: sortDirection,
  aliases
}));

const EVENT_ALIAS_MAP = new Map();

for (const event of EVENT_DEFINITIONS) {
  for (const alias of [event.event_key, event.display_name, ...event.aliases]) {
    EVENT_ALIAS_MAP.set(normalizeEventAlias(alias), event);
  }
}

export function normalizeEventAlias(value) {
  return cleanAthleteText(value, 150)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/meters?|metres?/g, "m")
    .replace(/cross country/g, "xc")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function resolveEvent(value, sport = "") {
  const normalized = normalizeEventAlias(value);
  const normalizedSport = normalizeSport(sport);

  if (normalizedSport === "cross_country") {
    const crossCountryEventKeys = {
      "5k": "xc_5k",
      "5k xc": "xc_5k",
      "5000": "xc_5k",
      "5000m": "xc_5k",
      "5000 xc": "xc_5k",
      "2 mile": "xc_2_mile",
      "two mile": "xc_2_mile",
      "2 mile xc": "xc_2_mile",
      "3k": "xc_3k",
      "3000": "xc_3k",
      "3000m": "xc_3k",
      "3200": "xc_3200",
      "3200m": "xc_3200",
      "3200 xc": "xc_3200"
    };
    const crossCountryEventKey = crossCountryEventKeys[normalized];

    if (crossCountryEventKey) {
      return EVENT_DEFINITIONS.find(
        (item) => item.event_key === crossCountryEventKey
      ) || null;
    }
  }

  return EVENT_ALIAS_MAP.get(normalized) || null;
}

export function starRatingForScore(value) {
  const score = Number(value);

  if (!Number.isFinite(score) || score < 70 || score > 100) {
    return null;
  }

  if (score >= 95) return 5;
  if (score >= 90) return 4;
  if (score >= 84) return 3;
  if (score >= 78) return 2;
  return 1;
}

export function starLabel(stars) {
  return {
    5: "National level recruit",
    4: "High level Division I prospect",
    3: "Strong college prospect",
    2: "Developing college prospect",
    1: "Recruiting watch list"
  }[Number(stars)] || "Not rated";
}

export function parseMark(markText, eventDefinition) {
  const text = cleanAthleteText(markText, 100);
  const measurementType = eventDefinition?.measurement_type || "other";

  if (!text) {
    return { valid: false, error: "Mark is required." };
  }

  if (measurementType === "time") {
    const cleaned = text
      .toLowerCase()
      .replace(/\s/g, "")
      .replace(/[a-z]+/g, "");
    const parts = cleaned.split(":").map((part) => Number(part));

    if (parts.some((part) => !Number.isFinite(part) || part < 0)) {
      return { valid: false, error: "Time mark is not valid." };
    }

    if (
      (parts.length === 2 && parts[1] >= 60) ||
      (parts.length === 3 && (parts[1] >= 60 || parts[2] >= 60))
    ) {
      return {
        valid: false,
        error: "Minutes and seconds must be less than 60."
      };
    }

    let seconds;

    if (parts.length === 1) {
      seconds = parts[0];
    } else if (parts.length === 2) {
      seconds = parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else {
      return { valid: false, error: "Time mark is not valid." };
    }

    if (!Number.isFinite(seconds) || seconds <= 0) {
      return { valid: false, error: "Time mark must be greater than zero." };
    }

    return {
      valid: true,
      mark_sort_value: Number(seconds.toFixed(4)),
      mark_value: Number(seconds.toFixed(4)),
      mark_unit: "seconds"
    };
  }

  if (["distance", "height"].includes(measurementType)) {
    const decimal = Number(text.replace(/m$/i, "").trim());

    if (Number.isFinite(decimal) && decimal > 0) {
      return {
        valid: true,
        mark_sort_value: Number(decimal.toFixed(4)),
        mark_value: Number(decimal.toFixed(4)),
        mark_unit: "meters"
      };
    }

    const feetInches = text.match(/^\s*(\d+)\s*(?:'|ft|-)\s*(\d+(?:\.\d+)?)?\s*(?:"|in)?\s*$/i);

    if (feetInches) {
      const feet = Number(feetInches[1]);
      const inches = Number(feetInches[2] || 0);

      if (inches >= 12) {
        return {
          valid: false,
          error: "Inches must be less than 12."
        };
      }

      const meters = (feet * 12 + inches) * 0.0254;

      if (meters > 0) {
        return {
          valid: true,
          mark_sort_value: Number(meters.toFixed(4)),
          mark_value: Number(meters.toFixed(4)),
          mark_unit: "meters"
        };
      }
    }

    return {
      valid: false,
      error: "Use meters or a feet and inches mark such as 14-6 or 6'4."
    };
  }

  if (measurementType === "points") {
    const points = Number(text.replace(/,/g, ""));

    if (!Number.isFinite(points) || points <= 0) {
      return { valid: false, error: "Points mark is not valid." };
    }

    return {
      valid: true,
      mark_sort_value: points,
      mark_value: points,
      mark_unit: "points"
    };
  }

  const numeric = Number(text.replace(/,/g, ""));

  return Number.isFinite(numeric)
    ? {
        valid: true,
        mark_sort_value: numeric,
        mark_value: numeric,
        mark_unit: null
      }
    : {
        valid: false,
        error: "The mark could not be converted into a sortable value."
      };
}

export function normalizeSport(value) {
  const cleaned = cleanAthleteText(value, 100)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (["cross_country", "xc"].includes(cleaned)) {
    return "cross_country";
  }

  if (["indoor", "indoor_track", "indoor_track_and_field"].includes(cleaned)) {
    return "indoor_track";
  }

  if (["outdoor", "track", "outdoor_track", "track_and_field"].includes(cleaned)) {
    return "outdoor_track";
  }

  return "";
}

export function performanceDuplicateKey(row) {
  return [
    row.profile_id,
    row.school_id || row.team_id || row.normalized_school || row.school_name,
    row.event_key,
    row.mark_sort_value ?? row.mark_text,
    row.meet_name,
    row.meet_date,
    row.place
  ].map((value) => cleanAthleteText(value, 1000).toLowerCase()).join("|");
}

export function performanceSourceKey(row) {
  return `pw-performance-${createHash("sha256")
    .update(performanceDuplicateKey(row))
    .digest("hex")}`;
}

function profileMatchKey(profile, schoolName) {
  return [
    normalizeAthleteName(profile.display_name),
    normalizeAthleteGender(profile.gender),
    Number(profile.graduation_year) || 0,
    normalizeAthleteName(schoolName)
  ].join("|");
}

function normalizeOptionalBoolean(value, fallback = null) {
  if (typeof value === "boolean") return value;

  const cleaned = cleanAthleteText(value, 20).toLowerCase();

  if (!cleaned) return fallback;
  if (["1", "true", "yes", "on"].includes(cleaned)) return true;
  if (["0", "false", "no", "off"].includes(cleaned)) return false;
  return fallback;
}

function normalizeHttpUrl(value) {
  const cleaned = cleanAthleteText(value, 2000);

  if (!cleaned) {
    return { value: null, error: "" };
  }

  try {
    const prepared = /^[a-z][a-z0-9+.-]*:\/\//i.test(cleaned)
      ? cleaned
      : `https://${cleaned}`;
    const url = new URL(prepared);

    if (!["http:", "https:"].includes(url.protocol)) {
      return {
        value: null,
        error: "Source URL must use http or https."
      };
    }

    return { value: url.href, error: "" };
  } catch {
    return {
      value: null,
      error: "Source URL is not valid."
    };
  }
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);

  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export function normalizePerformanceImportRow(row, index, defaults = {}) {
  const athleteName = cleanAthleteText(
    row.athlete_name ?? row.athlete ?? row.name,
    200
  );
  const schoolName = cleanAthleteText(
    row.school_name ?? row.school ?? row.team,
    200
  );
  const gender = normalizeAthleteGender(row.gender || defaults.gender);
  const graduationYear = Number(
    row.graduation_year ?? row.class_year ?? row.grad_year
  ) || null;
  const sport = normalizeSport(row.sport || defaults.sport);
  const seasonYear = Number(
    row.season_year || row.year || defaults.season_year
  ) || null;
  const eventName = cleanAthleteText(
    row.event_name || row.event || defaults.event_name,
    150
  );
  const event = resolveEvent(eventName, sport);
  const markText = cleanAthleteText(row.mark_text ?? row.mark ?? row.time ?? row.performance, 100);
  const mark = event ? parseMark(markText, event) : { valid: false, error: "Event is not recognized." };
  const meetName = cleanAthleteText(
    row.meet_name || row.meet || defaults.meet_name,
    300
  ) || null;
  const meetDate = cleanAthleteText(
    row.meet_date || row.date || defaults.meet_date,
    30
  ) || null;
  const rawPlace = cleanAthleteText(row.place, 30);
  const place = rawPlace ? Number(rawPlace) : null;
  const sourceLabel = cleanAthleteText(
    row.source_label || defaults.source_label,
    300
  );
  const sourceUrlResult = normalizeHttpUrl(
    row.source_url || row.results_url || defaults.source_url
  );
  const sourceUrl = sourceUrlResult.value;
  const sourceType = cleanAthleteText(
    row.source_type || defaults.source_type || "official",
    50
  ).toLowerCase();
  const verificationStatus = cleanAthleteText(
    row.verification_status || defaults.verification_status || "source_linked",
    50
  ).toLowerCase();

  return {
    row_number: index + 1,
    athlete_name: athleteName,
    normalized_name: normalizeAthleteName(athleteName),
    // Set by the admin import preview UI when a row that came back
    // ambiguous or unmatched is manually resolved to a specific profile --
    // see previewPerformanceImport's resolved_profile_id handling below.
    resolved_profile_id: cleanAthleteText(row.resolved_profile_id, 100) || null,
    school_name: schoolName,
    normalized_school: normalizeAthleteName(schoolName),
    gender,
    graduation_year: graduationYear,
    sport,
    season_year: seasonYear,
    event_name: event?.display_name || eventName,
    event_key: event?.event_key || "",
    event_group: event?.event_group || "",
    measurement_type: event?.measurement_type || "",
    sort_direction: event?.sort_direction || "",
    mark_text: markText,
    mark_value: mark.valid ? mark.mark_value : null,
    mark_sort_value: mark.valid ? mark.mark_sort_value : null,
    mark_unit: mark.valid ? mark.mark_unit : null,
    meet_name: meetName,
    meet_date: meetDate,
    place,
    source_label: sourceLabel,
    source_url: sourceUrl,
    source_type: PERFORMANCE_SOURCE_TYPES.has(sourceType) ? sourceType : "",
    verification_status: PERFORMANCE_VERIFICATION.has(verificationStatus)
      ? verificationStatus
      : "",
    public_visible: false,
    course_context: cleanAthleteText(row.course_context, 500) || null,
    wind_text: cleanAthleteText(row.wind_text ?? row.wind, 80) || null,
    wind_legal: normalizeOptionalBoolean(row.wind_legal, null),
    notes: cleanAthleteText(row.notes, 2000) || null,
    mark_error: mark.valid ? "" : mark.error,
    source_url_error: sourceUrlResult.error
  };
}

export function validatePerformanceImportRow(row) {
  const errors = [];

  if (!row.athlete_name) errors.push("Athlete name is required.");
  if (!row.school_name) errors.push("School is required for safe matching.");
  if (row.gender === "unspecified") errors.push("Gender must be boys or girls.");
  if (!row.graduation_year || row.graduation_year < 2000 || row.graduation_year > 2200) {
    errors.push("Graduation year is required.");
  }
  if (!row.sport) errors.push("Sport is not recognized.");
  if (!row.season_year || row.season_year < 2000 || row.season_year > 2200) {
    errors.push("Season year is required.");
  }
  if (!row.event_key) errors.push("Event is not recognized.");
  if (row.mark_error) errors.push(row.mark_error);
  if (!row.meet_name) errors.push("Meet name is required.");
  if (!row.meet_date) errors.push("Meet date is required.");
  if (row.place === null) errors.push("Place is required.");
  if (!row.source_label) errors.push("Source label is required.");
  if (!row.source_type) errors.push("Source type is not valid.");
  if (!row.verification_status) errors.push("Verification status is not valid.");
  if (row.source_url_error) errors.push(row.source_url_error);

  if (row.place !== null && (!Number.isInteger(row.place) || row.place < 1)) {
    errors.push("Place must be a positive whole number.");
  }

  if (row.meet_date && !isValidIsoDate(row.meet_date)) {
    errors.push("Meet date must be a real date using YYYY-MM-DD.");
  }

  return errors;
}

async function loadPerformanceImportProfiles() {
  const [
    profilesResult,
    schoolsResult,
    teamsResult,
    aliasesResult
  ] = await Promise.all([
    supabaseAdmin
      .from("athlete_profiles")
      .select(`
        id,
        display_name,
        normalized_name,
        gender,
        graduation_year,
        current_school_id,
        current_team_id,
        archived_at,
        merged_into_profile_id
      `)
      .is("archived_at", null)
      .is("merged_into_profile_id", null)
      .limit(10000),
    supabaseAdmin
      .from("ohio_schools")
      .select("id, school_name")
      .limit(5000),
    supabaseAdmin
      .from("team_pages")
      .select("id, school_name")
      .limit(5000),
    // Only alias_type "name" rows ever feed matching -- an external
    // provider id is never a name a results page would print. Tolerates
    // install/32 not yet being run (a missing alias_type column just
    // means alias-aware matching isn't available yet, not a broken
    // import).
    supabaseAdmin
      .from("athlete_profile_aliases")
      .select("profile_id, normalized_alias")
      .eq("alias_type", "name")
      .limit(20000)
  ]);

  for (const result of [profilesResult, schoolsResult, teamsResult]) {
    if (result.error) throw result.error;
  }

  if (aliasesResult.error && !isMissingAthleteFoundationError(aliasesResult.error)) {
    throw aliasesResult.error;
  }

  const schools = new Map((schoolsResult.data || []).map((row) => [row.id, row.school_name]));
  const teams = new Map((teamsResult.data || []).map((row) => [row.id, row.school_name]));
  const profiles = (profilesResult.data || []).map((profile) => ({
    ...profile,
    school_name:
      schools.get(profile.current_school_id) ||
      teams.get(profile.current_team_id) ||
      ""
  }));
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const byKey = new Map();

  for (const profile of profiles) {
    const key = profileMatchKey(profile, profile.school_name);
    const list = byKey.get(key) || [];
    list.push(profile);
    byKey.set(key, list);
  }

  // Alias-aware matching: a row spelled using a known alias (a
  // corrected/alternate spelling, e.g. "Phlipot" for a canonical
  // "Philpot") exact-matches the same profile its canonical name would,
  // provided gender, graduation year, and school still all agree. This
  // never weakens the "never match on name alone" rule -- only the *name*
  // half of the match key gets an alias-aware alternative; every other
  // field still has to agree exactly, using the same profileMatchKey
  // shape a canonical-name match uses.
  const aliasRows = aliasesResult.error ? [] : (aliasesResult.data || []);

  for (const alias of aliasRows) {
    const profile = profileById.get(alias.profile_id);

    if (!profile || !alias.normalized_alias) {
      continue;
    }

    const key = [
      alias.normalized_alias,
      normalizeAthleteGender(profile.gender),
      Number(profile.graduation_year) || 0,
      normalizeAthleteName(profile.school_name)
    ].join("|");
    const list = byKey.get(key) || [];

    if (!list.some((item) => item.id === profile.id)) {
      list.push(profile);
    }

    byKey.set(key, list);
  }

  return { profiles, byKey };
}

// Resolves a school name as printed on a results page (e.g. "Con. Crestview")
// to an official ohio_schools row, using the same exact-normalized-name and
// alias matching already used for the statewide school foundation. Returns
// null when there is no match or more than one candidate -- this never
// guesses, matching the "intentionally exact" rule used everywhere else in
// this importer.
async function loadOhioSchoolLookup() {
  const [schoolsResult, aliasesResult] = await Promise.all([
    supabaseAdmin
      .from("ohio_schools")
      .select("id, school_name, normalized_name")
      .eq("status", "active")
      .limit(5000),
    supabaseAdmin
      .from("ohio_school_aliases")
      .select("school_id, normalized_alias")
      .limit(10000)
  ]);

  for (const result of [schoolsResult, aliasesResult]) {
    if (result.error) throw result.error;
  }

  const schoolsById = new Map((schoolsResult.data || []).map((row) => [row.id, row]));
  const byNormalizedName = new Map();

  const add = (normalized, school) => {
    if (!normalized || !school) return;
    const list = byNormalizedName.get(normalized) || [];
    if (!list.some((item) => item.id === school.id)) list.push(school);
    byNormalizedName.set(normalized, list);
  };

  for (const school of schoolsResult.data || []) {
    add(school.normalized_name, school);
  }

  for (const alias of aliasesResult.data || []) {
    add(alias.normalized_alias, schoolsById.get(alias.school_id));
  }

  return {
    resolve(schoolName) {
      const candidates = byNormalizedName.get(normalizeAthleteName(schoolName)) || [];
      return candidates.length === 1 ? candidates[0] : null;
    }
  };
}

export async function previewPerformanceImport(rows, defaults = {}, options = {}) {
  if (!Array.isArray(rows) || !rows.length) {
    const error = new Error("Add at least one performance row.");
    error.status = 400;
    throw error;
  }

  if (rows.length > 500) {
    const error = new Error("Import no more than 500 performance rows at one time.");
    error.status = 400;
    throw error;
  }

  const normalizedRows = rows.map((row, index) =>
    normalizePerformanceImportRow(row || {}, index, defaults)
  );
  const { profiles, byKey } = await loadPerformanceImportProfiles();
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const createProfiles = Boolean(options.createProfilesForUnmatchedOfficialRows);
  // Loaded unconditionally, not just when profile creation is enabled: an
  // existing profile is linked to a school by its official name (for
  // example "Thomas Worthington"), but a results page often prints an
  // abbreviated form ("Thom. Worthington"). Without resolving that
  // abbreviation before matching, an already-existing profile is missed
  // entirely and the row is treated as brand new -- this is what a school
  // alias is for, and it must help matching, not only profile creation.
  const schoolLookup = await loadOhioSchoolLookup();
  const candidateProfileIds = [];
  const previewRows = normalizedRows.map((row) => {
    const errors = validatePerformanceImportRow(row);

    if (errors.length) {
      return {
        ...row,
        row_status: "invalid",
        errors,
        matches: []
      };
    }

    // A row an admin manually resolved to a specific profile (via the
    // "resolve and learn" UI, for a row that previously came back
    // ambiguous or unmatched) skips ordinary key matching entirely --
    // but the safety floor is never skipped: gender and graduation year
    // must still agree exactly, or the resolution is refused rather than
    // trusted blindly.
    if (row.resolved_profile_id) {
      const resolvedProfile = profileById.get(row.resolved_profile_id);

      if (!resolvedProfile) {
        return {
          ...row,
          row_status: "unmatched",
          errors: ["The selected athlete profile could not be found. It may have since been merged or archived."],
          matches: []
        };
      }

      if (
        resolvedProfile.gender !== row.gender ||
        Number(resolvedProfile.graduation_year) !== Number(row.graduation_year)
      ) {
        return {
          ...row,
          row_status: "unmatched",
          errors: ["The selected athlete profile's gender or graduation year no longer matches this row. Choose a profile that agrees with the row exactly."],
          matches: []
        };
      }

      const normalized = {
        ...row,
        profile_id: resolvedProfile.id,
        school_id: resolvedProfile.current_school_id || null,
        team_id: resolvedProfile.current_team_id || null,
        athlete_display_name: resolvedProfile.display_name,
        matched_school_name: resolvedProfile.school_name,
        // Only true when this row's own spelling genuinely differs from
        // the profile's canonical name -- an admin resolving a row that
        // was ambiguous for some other reason (not a spelling variant)
        // shouldn't create a needless duplicate alias.
        learn_alias: row.normalized_name !== resolvedProfile.normalized_name
      };
      const resolvedDuplicateKey = performanceDuplicateKey(normalized);
      const resolvedSourceKey = performanceSourceKey(normalized);
      candidateProfileIds.push(resolvedProfile.id);

      return {
        ...normalized,
        duplicate_key: resolvedDuplicateKey,
        source_key: resolvedSourceKey,
        row_status: "ready",
        errors: [],
        matches: [{
          id: resolvedProfile.id,
          display_name: resolvedProfile.display_name,
          school_name: resolvedProfile.school_name
        }]
      };
    }

    const resolvedSchool = schoolLookup.resolve(row.school_name);
    const keyCandidates = [
      [row.normalized_name, row.gender, row.graduation_year, row.normalized_school].join("|")
    ];

    if (resolvedSchool) {
      keyCandidates.push(
        [
          row.normalized_name,
          row.gender,
          row.graduation_year,
          normalizeAthleteName(resolvedSchool.school_name)
        ].join("|")
      );
    }

    const matches = keyCandidates
      .flatMap((key) => byKey.get(key) || [])
      .filter((profile, index, all) => all.findIndex((item) => item.id === profile.id) === index);

    if (!matches.length) {
      // Every profile creation in this project requires either a team
      // roster or, here, an exact official source match -- never a fuzzy
      // guess. Only offered when the admin explicitly enabled it for this
      // import and the row is sourced as official.
      if (createProfiles && row.source_type === "official" && resolvedSchool) {
        return {
          ...row,
          row_status: "creatable",
          errors: [],
          resolved_school_id: resolvedSchool.id,
          resolved_school_name: resolvedSchool.school_name,
          matches: []
        };
      }

      return {
        ...row,
        row_status: "unmatched",
        errors: ["No exact athlete, school, graduation year, and gender match was found."],
        matches: []
      };
    }

    if (matches.length > 1) {
      return {
        ...row,
        row_status: "ambiguous",
        errors: ["More than one athlete profile matched this row."],
        matches: matches.map((item) => ({
          id: item.id,
          display_name: item.display_name,
          school_name: item.school_name
        }))
      };
    }

    const profile = matches[0];
    const normalized = {
      ...row,
      profile_id: profile.id,
      school_id: profile.current_school_id || null,
      team_id: profile.current_team_id || null,
      athlete_display_name: profile.display_name,
      matched_school_name: profile.school_name
    };
    const duplicateKey = performanceDuplicateKey(normalized);
    const sourceKey = performanceSourceKey(normalized);
    candidateProfileIds.push(profile.id);

    return {
      ...normalized,
      duplicate_key: duplicateKey,
      source_key: sourceKey,
      row_status: "ready",
      errors: [],
      matches: [{
        id: profile.id,
        display_name: profile.display_name,
        school_name: profile.school_name
      }]
    };
  });

  const existingDuplicateKeys = new Set();
  const uniqueProfileIds = [...new Set(candidateProfileIds)];

  for (let index = 0; index < uniqueProfileIds.length; index += 100) {
    const profileIds = uniqueProfileIds.slice(index, index + 100);
    const { data, error } = await supabaseAdmin
      .from("athlete_performances")
      .select("profile_id, school_id, team_id, event_key, mark_text, mark_sort_value, meet_name, meet_date, place")
      .in("profile_id", profileIds)
      .limit(10000);

    if (error) throw error;

    for (const performance of data || []) {
      existingDuplicateKeys.add(performanceDuplicateKey(performance));
    }
  }

  const seen = new Set();
  const finalizedRows = previewRows.map((row) => {
    if (row.row_status !== "ready") return row;

    if (
      existingDuplicateKeys.has(row.duplicate_key) ||
      seen.has(row.duplicate_key)
    ) {
      return {
        ...row,
        row_status: "duplicate",
        errors: ["This exact sourced performance already exists in the database or import file."]
      };
    }

    seen.add(row.duplicate_key);
    return row;
  });

  const summary = {
    total: finalizedRows.length,
    ready: finalizedRows.filter((row) => row.row_status === "ready").length,
    duplicate: finalizedRows.filter((row) => row.row_status === "duplicate").length,
    unmatched: finalizedRows.filter((row) => row.row_status === "unmatched").length,
    ambiguous: finalizedRows.filter((row) => row.row_status === "ambiguous").length,
    invalid: finalizedRows.filter((row) => row.row_status === "invalid").length,
    creatable: finalizedRows.filter((row) => row.row_status === "creatable").length
  };

  return {
    rows: finalizedRows,
    summary
  };
}

// Creates a new, permanently hidden athlete profile from a row that matched
// no existing profile but resolved to exactly one official school -- the
// narrow exception described in docs/DECISIONS.md (2026-08-05). Looks up by
// source_identity_key first and reuses that row untouched if it already
// exists, the same defensive pattern athlete_foundation_service.mjs already
// uses for team rosters, so a later re-import of the same athlete never
// clobbers anything an admin has since reviewed, verified, or published.
async function createOfficialSourceProfile(row, { actor, batchId }) {
  const sourceIdentityKey = [
    "official-results-import",
    row.normalized_name,
    row.gender,
    row.graduation_year,
    row.resolved_school_id
  ].join("|");

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("athlete_profiles")
    .select("id")
    .eq("source_identity_key", sourceIdentityKey)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing.id;

  const nameParts = cleanAthleteText(row.athlete_name, 200).split(/\s+/).filter(Boolean);
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0] || row.athlete_name;
  const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : nameParts[0] || row.athlete_name;
  const baseSlug = slugifyAthlete(`${row.athlete_name} ${row.resolved_school_name} ${row.graduation_year}`);
  const payload = {
    source_identity_key: sourceIdentityKey,
    first_name: firstName,
    last_name: lastName,
    display_name: cleanAthleteText(row.athlete_name, 200),
    normalized_name: row.normalized_name,
    gender: row.gender,
    graduation_year: row.graduation_year,
    graduation_year_source: "Derived from grade in an official results import",
    current_school_id: row.resolved_school_id,
    athlete_status: "active",
    public_visible: false,
    verification_status: "unverified",
    last_source_reviewed_at: new Date().toISOString(),
    created_by: actor,
    updated_by: actor,
    metadata: {
      created_from: "official_results_import",
      import_batch_id: batchId
    }
  };

  // Two attempts: the plain slug first, then a disambiguated one if that
  // exact slug is already taken by an unrelated profile (for example, an
  // athlete with the same name, school, and graduation year already exists
  // from the editorial seed or a team roster, under a different identity
  // key than this import uses). A source_identity_key collision is handled
  // separately below by reusing that existing profile instead of retrying.
  for (const slug of [baseSlug, `${baseSlug}-${Date.now().toString(36)}`]) {
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("athlete_profiles")
      .insert({ ...payload, slug })
      .select("id")
      .single();

    if (!insertError) return inserted.id;

    if (insertError.code !== "23505") throw insertError;

    const { data: retry, error: retryError } = await supabaseAdmin
      .from("athlete_profiles")
      .select("id")
      .eq("source_identity_key", sourceIdentityKey)
      .maybeSingle();

    if (retryError) throw retryError;
    if (retry) return retry.id;
    // Otherwise the conflict was on the slug specifically (not this row's
    // own identity key) -- loop once more with a disambiguated slug.
  }

  const error = new Error(`A profile could not be created for ${row.athlete_name} after retrying with a disambiguated slug.`);
  error.status = 500;
  throw error;
}

export async function commitPerformanceImport({
  rows,
  defaults = {},
  actor = "Podium Watch Admin",
  createProfilesForUnmatchedOfficialRows = false
}) {
  const preview = await previewPerformanceImport(rows, defaults, {
    createProfilesForUnmatchedOfficialRows
  });
  const readyRows = preview.rows.filter((row) => row.row_status === "ready");
  const creatableRows = preview.rows.filter((row) => row.row_status === "creatable");

  if (!readyRows.length && !creatableRows.length) {
    const error = new Error("No safe performance rows are ready to import.");
    error.status = 409;
    throw error;
  }

  const importKey = `performance-import-${Date.now()}`;
  const { data: batch, error: batchError } = await supabaseAdmin
    .from("athlete_performance_import_batches")
    .insert({
      import_key: importKey,
      source_label: cleanAthleteText(defaults.source_label, 300) || "Performance import",
      source_url: cleanAthleteText(defaults.source_url, 2000) || null,
      source_type: PERFORMANCE_SOURCE_TYPES.has(defaults.source_type)
        ? defaults.source_type
        : "official",
      requested_by: actor,
      options: {
        submitted_rows: rows.length,
        ready_rows: readyRows.length,
        creatable_rows: creatableRows.length
      }
    })
    .select("*")
    .single();

  if (batchError) throw batchError;

  try {
    // Multiple rows in one batch can be the same real athlete (for example,
    // listed in more than one event). Reuse the same newly created profile
    // for all of them instead of creating a duplicate per row.
    const createdProfileIdByIdentity = new Map();
    const finalizedCreatableRows = [];

    for (const row of creatableRows) {
      const identityKey = [
        row.normalized_name,
        row.gender,
        row.graduation_year,
        row.resolved_school_id
      ].join("|");
      let profileId = createdProfileIdByIdentity.get(identityKey);

      if (!profileId) {
        profileId = await createOfficialSourceProfile(row, { actor, batchId: batch.id });
        createdProfileIdByIdentity.set(identityKey, profileId);
      }

      const withProfile = {
        ...row,
        profile_id: profileId,
        school_id: row.resolved_school_id,
        team_id: null
      };

      finalizedCreatableRows.push({
        ...withProfile,
        duplicate_key: performanceDuplicateKey(withProfile),
        source_key: performanceSourceKey(withProfile)
      });
    }

    const payload = [...readyRows, ...finalizedCreatableRows].map((row) => ({
      profile_id: row.profile_id,
      school_id: row.school_id,
      team_id: row.team_id,
      sport: row.sport,
      season_year: row.season_year,
      event_name: row.event_name,
      event_key: row.event_key,
      event_group: row.event_group,
      measurement_type: row.measurement_type,
      sort_direction: row.sort_direction,
      mark_text: row.mark_text,
      mark_value: row.mark_value,
      mark_sort_value: row.mark_sort_value,
      mark_unit: row.mark_unit,
      record_type: "race_result",
      meet_name: row.meet_name,
      meet_date: row.meet_date,
      place: row.place,
      wind_text: row.wind_text,
      wind_legal: row.wind_legal,
      course_context: row.course_context,
      source_key: row.source_key,
      source_label: row.source_label,
      source_url: row.source_url,
      source_type: row.source_type,
      verification_status: row.verification_status,
      public_visible: row.public_visible,
      result_status: row.source_type === "official"
        ? "official_result"
        : "reviewed_result",
      import_batch_id: batch.id,
      verified_at: row.verification_status === "verified"
        ? new Date().toISOString()
        : null,
      verified_by: row.verification_status === "verified"
        ? actor
        : null,
      notes: row.notes
    }));

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("athlete_performances")
      .insert(payload)
      .select("id, source_key");

    if (insertError) throw insertError;

    // A row an admin resolved to a specific profile whose own spelling
    // differed from that profile's canonical name (see previewPerformanceImport's
    // resolved_profile_id handling) writes a new alias here -- this is
    // what makes the same spelling auto-match on every future import
    // without a repeated manual step. Best-effort: never fails an
    // otherwise-successful import, and tolerates install/32 not yet
    // being run.
    const aliasCandidates = readyRows.filter((row) => row.learn_alias);

    if (aliasCandidates.length) {
      const aliasPayload = aliasCandidates
        .filter((row, index, all) =>
          all.findIndex((item) => item.profile_id === row.profile_id && item.normalized_name === row.normalized_name) === index
        )
        .map((row) => ({
          profile_id: row.profile_id,
          alias: row.athlete_name,
          normalized_alias: row.normalized_name,
          alias_type: "name",
          notes: `Learned from resolving an ambiguous or unmatched performance import row on ${new Date().toISOString().slice(0, 10)}.`
        }));

      const { error: aliasError } = await supabaseAdmin
        .from("athlete_profile_aliases")
        .upsert(aliasPayload, { onConflict: "profile_id,normalized_alias" });

      if (aliasError && !isMissingAthleteFoundationError(aliasError)) {
        console.error("Unable to save a learned athlete alias during import:", aliasError);
      }
    }

    const performanceByKey = new Map((inserted || []).map((item) => [item.source_key, item.id]));
    const finalizedByRowNumber = new Map(finalizedCreatableRows.map((row) => [row.row_number, row]));
    const rowAudit = preview.rows.map((originalRow) => {
      const row = finalizedByRowNumber.get(originalRow.row_number) || originalRow;

      return {
        batch_id: batch.id,
        row_number: row.row_number,
        row_status: (row.row_status === "ready" || row.row_status === "creatable") ? "imported" : row.row_status,
        profile_id: row.profile_id || null,
        performance_id: row.source_key ? performanceByKey.get(row.source_key) || null : null,
        original_row: rows[row.row_number - 1] || {},
        normalized_row: row,
        match_summary: {
          matches: row.matches || []
        },
        error_message: row.errors?.join(" ") || null
      };
    });

    const { error: auditError } = await supabaseAdmin
      .from("athlete_performance_import_rows")
      .insert(rowAudit);

    if (auditError) throw auditError;

    const summary = {
      ...preview.summary,
      imported: inserted?.length || 0
    };

    const { error: completeError } = await supabaseAdmin
      .from("athlete_performance_import_batches")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        summary
      })
      .eq("id", batch.id);

    if (completeError) throw completeError;

    return {
      batch_id: batch.id,
      summary,
      rows: preview.rows
    };
  } catch (error) {
    await supabaseAdmin
      .from("athlete_performance_import_batches")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: cleanAthleteText(error.message, 2000),
        summary: preview.summary
      })
      .eq("id", batch.id);

    throw error;
  }
}

export function isMissingRecruitingFoundationError(error) {
  const code = cleanAthleteText(error?.code, 80);
  const message = cleanAthleteText(error?.message, 1000);

  return (
    code === "42P01" ||
    code === "PGRST205" ||
    /athlete_recruit_ratings|athlete_event_catalog|athlete_performance_import_batches/i.test(message) &&
      /does not exist|could not find/i.test(message)
  );
}

export function eventDefinitions() {
  return EVENT_DEFINITIONS.map(({ aliases, ...event }) => event);
}

// Converts results copied straight out of a browser (MileSplit, SEO Timing,
// and similar official meet pages) into rows shaped for the performance
// importer above. These pages render results with client-side JavaScript,
// so the raw HTTP response never contains a parseable table -- copy-pasting
// the rendered page is the reliable route, and this is the parser for what
// that paste actually looks like: single-space-separated tokens with the
// athlete's grade squeezed between their name and their school, for example
// "17 Lincoln Smith SR Con. Crestview 16:07.37 5". Team-score summary blocks
// (aggregate team points, not individual marks) are recognized and skipped.
// Grade/graduation-year derivation moved to the shared, sport-aware
// deriveGraduationYearFromGrade() in athlete_foundation_service.mjs --
// this file's own copy assumed every season was fall cross country and
// disagreed with the two other copies that used to exist elsewhere in
// this project for indoor/outdoor track. See that function's own
// comment for the full academic-year reasoning.

// Deliberately case-sensitive: a real name suffix like "Kenneth Morgan Jr"
// would otherwise be misread as the grade marker (a case-insensitive match
// on "Jr" collides with the literal grade token "JR"). Every provider in
// practice renders the actual grade marker and status codes in all caps, so
// requiring exact case here is what correctly tells a name suffix apart
// from a grade.
const RESULT_ROW_PATTERN = new RegExp(
  "^(\\d{1,4})\\s+(.+?)\\s+(FR|SO|JR|SR)\\s+(.+?)\\s+" +
  "((?:(?:\\d{1,2}:)?\\d{1,2}\\.\\d{1,2})" +
  "|(?:\\d{1,3}[-'′]\\d{1,2}(?:\\.\\d+)?)" +
  "|(?:\\d+(?:\\.\\d+)?m?)" +
  "|DQ|DNF|DNS|SCR|NM|NT)" +
  "(?:\\s+[\\d.]+)?\\s*$"
);
const SECTION_GENDER_PATTERN = /\b(boys|girls)\b/i;
const TEAM_SCORES_SECTION_PATTERN = /team\s+scores/i;
const TEAM_SCORES_HEADER_PATTERN = /^place\s+team\s+pts/i;
const RESULT_HEADER_PATTERN = /^place\b/i;

export function parseOfficialResultsText(text, { season_year, sport } = {}) {
  const withoutCarriageReturns = String(text ?? "").split(String.fromCharCode(13)).join("");
  const lines = withoutCarriageReturns
    .split(String.fromCharCode(10))
    .map((line) => line.split(String.fromCharCode(160)).join(" ").trim());

  const rows = [];
  let gender = "";
  let inTeamScores = false;

  for (const line of lines) {
    if (!line) continue;

    if (TEAM_SCORES_SECTION_PATTERN.test(line)) {
      inTeamScores = true;
      continue;
    }

    const sectionGenderMatch = line.match(SECTION_GENDER_PATTERN);

    if (sectionGenderMatch && line.length < 150 && !/^\d/.test(line)) {
      gender = sectionGenderMatch[1].toLowerCase();
      inTeamScores = false;
      continue;
    }

    if (inTeamScores || TEAM_SCORES_HEADER_PATTERN.test(line) || RESULT_HEADER_PATTERN.test(line)) {
      continue;
    }

    const match = line.match(RESULT_ROW_PATTERN);

    if (!match) continue;

    const [, place, athleteName, grade, teamName, markText] = match;

    rows.push({
      place: Number(place),
      athlete_name: cleanAthleteText(athleteName, 200),
      school_name: cleanAthleteText(teamName, 200),
      gender,
      graduation_year: deriveGraduationYearFromGrade(grade, season_year, sport),
      mark_text: cleanAthleteText(markText, 100)
    });
  }

  return rows;
}

export const CONTENT_ITEM_TYPES = new Set([
  "photo",
  "video",
  "article",
  "other"
]);

export const CONTENT_ITEM_STATUSES = new Set([
  "draft",
  "published",
  "hidden",
  "archived"
]);

// Writes one rank snapshot row per (event group) the profile currently has a
// published rating in. Called after a rating is saved so a later read can
// compare the live computed rank against the most recent stored snapshot to
// show movement, the same way athlete_ranking_entries.previous_rank already
// works for editorial rankings. Safe to call even when the profile has no
// published ratings yet (writes nothing).
export async function recordRecruitRatingRankSnapshots(profileId) {
  const { data, error } = await supabaseAdmin
    .from("athlete_published_recruit_ratings")
    .select(
      "profile_id, methodology_id, event_group, graduation_year, gender, state_class_rank, event_group_rank"
    )
    .eq("profile_id", profileId);

  if (error) throw error;
  if (!data || !data.length) return [];

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("athlete_recruit_rating_rank_snapshots")
    .insert(
      data.map((row) => ({
        profile_id: row.profile_id,
        methodology_id: row.methodology_id,
        event_group: row.event_group,
        graduation_year: row.graduation_year,
        gender: row.gender,
        state_class_rank: row.state_class_rank,
        event_group_rank: row.event_group_rank
      }))
    )
    .select("id");

  if (insertError) throw insertError;
  return inserted || [];
}

// Returns the most recently stored snapshot for a profile's rating in one
// event group, or null when no snapshot has been recorded yet (for example,
// the first time a rating is ever published).
export async function loadLatestRankSnapshots(profileIds) {
  if (!profileIds.length) return new Map();

  const { data, error } = await supabaseAdmin
    .from("athlete_recruit_rating_rank_snapshots")
    .select("profile_id, event_group, state_class_rank, event_group_rank, captured_at")
    .in("profile_id", profileIds)
    .order("captured_at", { ascending: false })
    .limit(profileIds.length * 20);

  if (error) throw error;

  const latestByKey = new Map();

  for (const row of data || []) {
    const key = `${row.profile_id}|${row.event_group}`;

    if (!latestByKey.has(key)) {
      latestByKey.set(key, row);
    }
  }

  return latestByKey;
}
