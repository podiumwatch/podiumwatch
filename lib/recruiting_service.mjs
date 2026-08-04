import { createHash } from "node:crypto";
import { supabaseAdmin } from "./supabase-admin.mjs";
import {
  cleanAthleteText,
  normalizeAthleteGender,
  normalizeAthleteName
} from "./athlete_foundation_service.mjs";

export const EVENT_GROUPS = new Set([
  "distance",
  "sprints",
  "hurdles",
  "jumps",
  "pole_vault",
  "throws",
  "multis",
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
  ["xc_2_mile", "Cross Country 2 Mile", "distance", "time", "asc", ["2 mile xc", "2 mile cross country"]],
  ["xc_3k", "Cross Country 3K", "distance", "time", "asc", ["3k xc", "3k cross country"]],
  ["xc_3200", "Cross Country 3200", "distance", "time", "asc", ["3200 xc", "3200 cross country"]],
  ["xc_5k", "Cross Country 5K", "distance", "time", "asc", ["5k", "5k xc", "5000 cross country"]],
  ["track_60", "60 Meters", "sprints", "time", "asc", ["60", "60m"]],
  ["track_100", "100 Meters", "sprints", "time", "asc", ["100", "100m"]],
  ["track_200", "200 Meters", "sprints", "time", "asc", ["200", "200m"]],
  ["track_300", "300 Meters", "sprints", "time", "asc", ["300", "300m"]],
  ["track_400", "400 Meters", "sprints", "time", "asc", ["400", "400m"]],
  ["track_500", "500 Meters", "sprints", "time", "asc", ["500", "500m"]],
  ["track_600", "600 Meters", "distance", "time", "asc", ["600", "600m"]],
  ["track_800", "800 Meters", "distance", "time", "asc", ["800", "800m"]],
  ["track_1000", "1000 Meters", "distance", "time", "asc", ["1000", "1000m"]],
  ["track_1600", "1600 Meters", "distance", "time", "asc", ["1600", "1600m"]],
  ["track_mile", "One Mile", "distance", "time", "asc", ["mile", "1 mile"]],
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
  ["pentathlon", "Pentathlon", "multis", "points", "desc", ["pentathlon"]],
  ["heptathlon", "Heptathlon", "multis", "points", "desc", ["heptathlon"]],
  ["decathlon", "Decathlon", "multis", "points", "desc", ["decathlon"]]
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

export function performanceSourceKey(row) {
  const raw = [
    row.profile_id,
    row.sport,
    row.season_year,
    row.event_key,
    row.mark_text,
    row.meet_name,
    row.meet_date,
    row.source_url,
    row.source_label
  ].map((value) => cleanAthleteText(value, 1000).toLowerCase()).join("|");

  return `pw-performance-${createHash("sha256").update(raw).digest("hex")}`;
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

function normalizeImportRow(row, index, defaults = {}) {
  const athleteName = cleanAthleteText(
    row.athlete_name ?? row.athlete ?? row.name,
    200
  );
  const schoolName = cleanAthleteText(
    row.school_name ?? row.school ?? row.team,
    200
  );
  const gender = normalizeAthleteGender(row.gender);
  const graduationYear = Number(
    row.graduation_year ?? row.class_year ?? row.grad_year
  ) || null;
  const sport = normalizeSport(row.sport ?? defaults.sport);
  const seasonYear = Number(row.season_year ?? row.year ?? defaults.season_year) || null;
  const eventName = cleanAthleteText(row.event_name ?? row.event, 150);
  const event = resolveEvent(eventName, sport);
  const markText = cleanAthleteText(row.mark_text ?? row.mark ?? row.time ?? row.performance, 100);
  const mark = event ? parseMark(markText, event) : { valid: false, error: "Event is not recognized." };
  const meetName = cleanAthleteText(row.meet_name ?? row.meet, 300) || null;
  const meetDate = cleanAthleteText(row.meet_date ?? row.date, 30) || null;
  const rawPlace = cleanAthleteText(row.place, 30);
  const place = rawPlace ? Number(rawPlace) : null;
  const sourceLabel = cleanAthleteText(
    row.source_label ?? defaults.source_label,
    300
  );
  const sourceUrlResult = normalizeHttpUrl(
    row.source_url ?? row.results_url ?? defaults.source_url
  );
  const sourceUrl = sourceUrlResult.value;
  const sourceType = cleanAthleteText(
    row.source_type ?? defaults.source_type ?? "official",
    50
  ).toLowerCase();
  const verificationStatus = cleanAthleteText(
    row.verification_status ?? defaults.verification_status ?? "source_linked",
    50
  ).toLowerCase();

  return {
    row_number: index + 1,
    athlete_name: athleteName,
    normalized_name: normalizeAthleteName(athleteName),
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
    public_visible: normalizeOptionalBoolean(row.public_visible, true),
    course_context: cleanAthleteText(row.course_context, 500) || null,
    wind_text: cleanAthleteText(row.wind_text ?? row.wind, 80) || null,
    wind_legal: normalizeOptionalBoolean(row.wind_legal, null),
    notes: cleanAthleteText(row.notes, 2000) || null,
    mark_error: mark.valid ? "" : mark.error,
    source_url_error: sourceUrlResult.error
  };
}

function validateNormalizedRow(row) {
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
  if (!row.source_label) errors.push("Source label is required.");
  if (!row.source_type) errors.push("Source type is not valid.");
  if (!row.verification_status) errors.push("Verification status is not valid.");
  if (row.source_url_error) errors.push(row.source_url_error);

  if (
    row.place !== null &&
    (!Number.isInteger(row.place) || row.place < 1)
  ) {
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
    teamsResult
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
      .limit(5000)
  ]);

  for (const result of [profilesResult, schoolsResult, teamsResult]) {
    if (result.error) throw result.error;
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
  const byKey = new Map();

  for (const profile of profiles) {
    const key = profileMatchKey(profile, profile.school_name);
    const list = byKey.get(key) || [];
    list.push(profile);
    byKey.set(key, list);
  }

  return { profiles, byKey };
}

export async function previewPerformanceImport(rows, defaults = {}) {
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
    normalizeImportRow(row || {}, index, defaults)
  );
  const { byKey } = await loadPerformanceImportProfiles();
  const candidateSourceKeys = [];
  const previewRows = normalizedRows.map((row) => {
    const errors = validateNormalizedRow(row);

    if (errors.length) {
      return {
        ...row,
        row_status: "invalid",
        errors,
        matches: []
      };
    }

    const key = [
      row.normalized_name,
      row.gender,
      row.graduation_year,
      row.normalized_school
    ].join("|");
    const matches = byKey.get(key) || [];

    if (!matches.length) {
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
    const sourceKey = performanceSourceKey(normalized);
    candidateSourceKeys.push(sourceKey);

    return {
      ...normalized,
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

  let existingKeys = new Set();

  if (candidateSourceKeys.length) {
    const { data, error } = await supabaseAdmin
      .from("athlete_performances")
      .select("source_key")
      .in("source_key", candidateSourceKeys);

    if (error) throw error;
    existingKeys = new Set((data || []).map((item) => item.source_key));
  }

  const seen = new Set();
  const finalizedRows = previewRows.map((row) => {
    if (row.row_status !== "ready") return row;

    if (existingKeys.has(row.source_key) || seen.has(row.source_key)) {
      return {
        ...row,
        row_status: "duplicate",
        errors: ["This exact sourced performance already exists in the database or import file."]
      };
    }

    seen.add(row.source_key);
    return row;
  });

  const summary = {
    total: finalizedRows.length,
    ready: finalizedRows.filter((row) => row.row_status === "ready").length,
    duplicate: finalizedRows.filter((row) => row.row_status === "duplicate").length,
    unmatched: finalizedRows.filter((row) => row.row_status === "unmatched").length,
    ambiguous: finalizedRows.filter((row) => row.row_status === "ambiguous").length,
    invalid: finalizedRows.filter((row) => row.row_status === "invalid").length
  };

  return {
    rows: finalizedRows,
    summary
  };
}

export async function commitPerformanceImport({
  rows,
  defaults = {},
  actor = "Podium Watch Admin"
}) {
  const preview = await previewPerformanceImport(rows, defaults);
  const readyRows = preview.rows.filter((row) => row.row_status === "ready");

  if (!readyRows.length) {
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
        ready_rows: readyRows.length
      }
    })
    .select("*")
    .single();

  if (batchError) throw batchError;

  try {
    const payload = readyRows.map((row) => ({
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

    const performanceByKey = new Map((inserted || []).map((item) => [item.source_key, item.id]));
    const rowAudit = preview.rows.map((row) => ({
      batch_id: batch.id,
      row_number: row.row_number,
      row_status: row.row_status === "ready" ? "imported" : row.row_status,
      profile_id: row.profile_id || null,
      performance_id: row.source_key ? performanceByKey.get(row.source_key) || null : null,
      original_row: rows[row.row_number - 1] || {},
      normalized_row: row,
      match_summary: {
        matches: row.matches || []
      },
      error_message: row.errors?.join(" ") || null
    }));

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
