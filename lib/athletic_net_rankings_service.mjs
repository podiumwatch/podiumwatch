// Ohio XC 2026 Athletic.net season-best rankings import (8,001 rows: Boys
// and Girls Divisions I-IV, 5,000m cross country). A supplied reference
// dataset (docs/DATA_SOURCES.md category 2) -- not a single governing
// body's own result page, so it is source_type "supplied_reference", not
// "official". Per the user's explicit decision for this import (not the
// project-wide default): an unmatched row is allowed to create a new,
// permanently hidden athlete profile, the same way the existing
// "official results" importer in lib/recruiting_service.mjs does, but
// scoped to this dataset only -- that existing importer's own
// source_type === "official" gate is untouched.
//
// athlete_url is treated as the strongest available identity signal,
// stronger than name+gender+graduation_year+school: Athletic.net
// guarantees it is unique per real athlete (docs instruction #4/#6), so an
// exact athlete_url match short-circuits ordinary name-based matching
// entirely and two different athlete_urls are never merged into one
// profile automatically. It is stored as an athlete_profile_aliases row
// (alias_type = 'external_id', external_source = 'athletic.net'),
// protected at the database layer by a partial unique index
// (install/71_ATHLETIC_NET_EXTERNAL_ID_UNIQUE.sql) so two different
// profiles can never claim the same real athlete_url.
//
// Idempotency: this is season-best data, not a single race result -- the
// same athlete's mark legitimately changes from one week's export to the
// next. So the dedup/upsert key (athleticNetRankingSourceKey) is built
// from (normalized athlete_url, event_key, season_year) only -- never from
// the mark, meet, or date -- and every commit is an upsert on that key.
// Re-running the same or a refreshed export updates the existing
// athlete_performances row in place; it never creates a duplicate.
//
// Never invents data: source_rank is Athletic.net's own statewide ranking
// position (ties can skip positions), not a meet finishing place, so it is
// never written to athlete_performances.place -- place stays null, the
// same "never infer a missing place" rule this project applies everywhere
// else (see AGENTS.md rule 5 / docs/DECISIONS.md 2026-09-30). source_rank
// is preserved in metadata instead. result_status is "reviewed_result"
// (matches the existing performance_marks_only precedent), never
// "official_result".
import { createHash } from "node:crypto";
import { supabaseAdmin, fetchInChunks } from "./supabase-admin.mjs";
import {
  cleanAthleteText,
  deriveGraduationYearFromGrade,
  isMissingAthleteFoundationError,
  normalizeAthleteGender,
  normalizeAthleteName,
  slugifyAthlete
} from "./athlete_foundation_service.mjs";
import {
  loadOhioSchoolLookup,
  resolveEvent
} from "./recruiting_service.mjs";

export const EXPECTED_COLUMNS = [
  "gender",
  "division",
  "source_rank",
  "athlete_name",
  "grade_displayed",
  "grade_normalized",
  "school_name",
  "time_displayed",
  "time_seconds",
  "meet_name",
  "meet_date",
  "athlete_url",
  "school_url",
  "meet_url",
  "rankings_page_url",
  "collected_at_eastern"
];

export const EXPECTED_GENDERS = new Set(["Boys", "Girls"]);
export const EXPECTED_DIVISIONS = new Set(["Division I", "Division II", "Division III", "Division IV"]);
export const DEFAULT_SEASON_YEAR = 2026;
export const SOURCE_TYPE = "supplied_reference";
export const EXTERNAL_SOURCE = "athletic.net";

// The dataset's own documented shape: every (gender, division) list is
// expected to hold exactly this many rows, with the two real tied-rank
// exceptions called out explicitly rather than silently tolerated.
export const EXPECTED_LIST_COUNTS = {
  "Boys|Division I": 1000,
  "Boys|Division II": 1000,
  "Boys|Division III": 1000,
  "Boys|Division IV": 1000,
  "Girls|Division I": 1000,
  "Girls|Division II": 1000,
  "Girls|Division III": 1001,
  "Girls|Division IV": 1000
};
export const EXPECTED_TOTAL = 8001;

const MONTH_NUMBERS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};

// A minimal, state-machine, quote-aware CSV parser (handles embedded
// commas, quotes, and CRLF/LF line endings) -- the same shape this
// project's other CSV importers already use, generalized to return
// header-keyed row objects instead of raw column arrays.
export function parseAthleticNetRankingsCsv(csvText) {
  const text = String(csvText ?? "");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const pushField = () => { row.push(field); field = ""; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };

  while (i < text.length) {
    const c = text[i];

    if (inQuotes) {
      if (c === "\"" && text[i + 1] === "\"") { field += "\""; i += 2; continue; }
      if (c === "\"") { inQuotes = false; i++; continue; }
      field += c;
      i++;
      continue;
    }

    if (c === "\"") { inQuotes = true; i++; continue; }
    if (c === ",") { pushField(); i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") { pushRow(); i++; continue; }
    field += c;
    i++;
  }

  if (field !== "" || row.length) pushRow();

  const nonEmptyRows = rows.filter((cols) => cols.some((cell) => cell !== ""));
  if (!nonEmptyRows.length) return [];

  const header = nonEmptyRows[0].map((h) => cleanAthleteText(h, 100));

  return nonEmptyRows.slice(1).map((cols) => {
    const record = {};
    header.forEach((name, index) => { record[name] = cols[index] ?? ""; });
    return record;
  });
}

export function validateCsvHeader(header) {
  const errors = [];
  const missing = EXPECTED_COLUMNS.filter((name) => !header.includes(name));
  const unexpected = header.filter((name) => !EXPECTED_COLUMNS.includes(name));

  if (missing.length) errors.push(`Missing expected column(s): ${missing.join(", ")}`);
  if (unexpected.length) errors.push(`Unexpected column(s) present: ${unexpected.join(", ")}`);

  return errors;
}

// Normalizes an Athletic.net URL for stable identity comparison: lowercase
// scheme/host, strip a trailing slash, query string, and fragment. Never
// changes the athlete id itself -- two different ids are never merged.
export function normalizeAthleticNetUrl(value) {
  const cleaned = cleanAthleteText(value, 500);
  if (!cleaned) return "";

  try {
    const prepared = /^[a-z][a-z0-9+.-]*:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
    const url = new URL(prepared);
    return `${url.protocol.toLowerCase()}//${url.hostname.toLowerCase()}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return cleaned.toLowerCase().replace(/\/+$/, "").replace(/[?#].*$/, "");
  }
}

// "Oct 10" + season year 2026 -> "2026-10-10". Never guesses: an
// unrecognized month or day returns null rather than a wrong date.
export function normalizeMeetDate(meetDate, seasonYear) {
  const cleaned = cleanAthleteText(meetDate, 30);
  const match = cleaned.match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})$/);
  if (!match) return null;

  const month = MONTH_NUMBERS[match[1].slice(0, 3).toLowerCase()];
  const day = Number(match[2]);
  const year = Number(seasonYear);

  if (!month || !day || day < 1 || day > 31 || !seasonYear || !Number.isFinite(year) || year < 2000) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseIntOrNull(value) {
  const cleaned = cleanAthleteText(value, 20);
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isInteger(n) ? n : null;
}

function parseFloatOrNull(value) {
  const cleaned = cleanAthleteText(value, 30);
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function normalizeHttpUrl(value) {
  const cleaned = cleanAthleteText(value, 2000);
  if (!cleaned) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function normalizeRankingRow(raw, index, options = {}) {
  const seasonYear = Number(options.seasonYear) || DEFAULT_SEASON_YEAR;
  const gender = cleanAthleteText(raw.gender, 20);
  const division = cleanAthleteText(raw.division, 20);
  const sourceRank = parseIntOrNull(raw.source_rank);
  const athleteName = cleanAthleteText(raw.athlete_name, 200);
  const gradeDisplayed = cleanAthleteText(raw.grade_displayed, 20);
  const gradeNormalizedRaw = parseIntOrNull(raw.grade_normalized);
  const gradeNormalized = gradeNormalizedRaw !== null && gradeNormalizedRaw >= 6 && gradeNormalizedRaw <= 12
    ? gradeNormalizedRaw
    : null;
  const schoolName = cleanAthleteText(raw.school_name, 200);
  const timeDisplayed = cleanAthleteText(raw.time_displayed, 30);
  const timeSeconds = parseFloatOrNull(raw.time_seconds);
  const meetName = cleanAthleteText(raw.meet_name, 300);
  const meetDateDisplayed = cleanAthleteText(raw.meet_date, 30);
  const meetDateIso = normalizeMeetDate(meetDateDisplayed, seasonYear);
  const athleteUrl = normalizeHttpUrl(raw.athlete_url);
  const schoolUrl = normalizeHttpUrl(raw.school_url);
  const meetUrl = normalizeHttpUrl(raw.meet_url);
  const rankingsPageUrl = normalizeHttpUrl(raw.rankings_page_url);
  const collectedAtEastern = cleanAthleteText(raw.collected_at_eastern, 60);
  const genderNormalized = normalizeAthleteGender(gender);
  const event = resolveEvent("xc_5k", "cross_country");
  const graduationYear = gradeNormalized
    ? deriveGraduationYearFromGrade(gradeNormalized, seasonYear, "cross_country")
    : null;

  return {
    row_number: index + 1,
    gender,
    gender_normalized: genderNormalized,
    division,
    season_year: seasonYear,
    source_rank: sourceRank,
    athlete_name: athleteName,
    normalized_name: normalizeAthleteName(athleteName),
    grade_displayed: gradeDisplayed,
    grade_normalized: gradeNormalized,
    graduation_year: graduationYear,
    school_name: schoolName,
    normalized_school: normalizeAthleteName(schoolName),
    time_displayed: timeDisplayed,
    time_seconds: timeSeconds,
    meet_name: meetName || null,
    meet_date_displayed: meetDateDisplayed,
    meet_date: meetDateIso,
    athlete_url: athleteUrl,
    normalized_athlete_url: athleteUrl ? normalizeAthleticNetUrl(athleteUrl) : "",
    school_url: schoolUrl,
    meet_url: meetUrl,
    rankings_page_url: rankingsPageUrl,
    collected_at_eastern: collectedAtEastern,
    event_name: event?.display_name || "Cross Country 5K",
    event_key: event?.event_key || "xc_5k",
    event_group: event?.event_group || "cross_country"
  };
}

export function validateRankingRow(row) {
  const errors = [];

  if (!EXPECTED_GENDERS.has(row.gender)) errors.push(`Gender must be Boys or Girls (got "${row.gender}").`);
  if (!EXPECTED_DIVISIONS.has(row.division)) errors.push(`Division must be Division I-IV (got "${row.division}").`);
  if (!row.source_rank || row.source_rank < 1) errors.push("source_rank is required and must be a positive integer.");
  if (!row.athlete_name) errors.push("athlete_name is required.");
  if (!row.school_name) errors.push("school_name is required.");
  if (row.time_seconds === null || row.time_seconds <= 0) errors.push("time_seconds must be a positive number.");
  if (!row.time_displayed) errors.push("time_displayed is required.");
  if (!row.athlete_url) errors.push("athlete_url is required and must be a valid URL.");
  if (!row.school_url) errors.push("school_url is required and must be a valid URL.");
  if (!row.meet_url) errors.push("meet_url is required and must be a valid URL.");
  if (!row.rankings_page_url) errors.push("rankings_page_url is required and must be a valid URL.");
  if (row.athlete_url && !/^https:\/\/www\.athletic\.net\/athlete\//.test(row.athlete_url)) {
    errors.push("athlete_url does not look like an Athletic.net athlete URL.");
  }

  return errors;
}

// Cross-row validation against the dataset's own documented shape: exact
// per-(gender, division) counts, the two known tied-rank exceptions, and
// the overall total. Also flags any exact-duplicate athlete_url within the
// dataset itself (the same real athlete should never appear twice in one
// division list) -- reported, never silently dropped.
export function validateRankingDataset(rows) {
  const errors = [];
  const counts = {};

  for (const row of rows) {
    const key = `${row.gender}|${row.division}`;
    counts[key] = (counts[key] || 0) + 1;
  }

  for (const [key, expected] of Object.entries(EXPECTED_LIST_COUNTS)) {
    const actual = counts[key] || 0;
    if (actual !== expected) {
      errors.push(`${key}: expected ${expected} rows, found ${actual}.`);
    }
  }

  for (const key of Object.keys(counts)) {
    if (!(key in EXPECTED_LIST_COUNTS)) {
      errors.push(`Unexpected (gender, division) group in dataset: ${key} (${counts[key]} rows).`);
    }
  }

  if (rows.length !== EXPECTED_TOTAL) {
    errors.push(`Expected ${EXPECTED_TOTAL} total rows, found ${rows.length}.`);
  }

  const urlCounts = new Map();
  for (const row of rows) {
    if (!row.normalized_athlete_url) continue;
    const dupeKey = `${row.gender}|${row.division}|${row.normalized_athlete_url}`;
    urlCounts.set(dupeKey, (urlCounts.get(dupeKey) || 0) + 1);
  }
  const duplicateUrls = [...urlCounts.entries()].filter(([, count]) => count > 1);
  if (duplicateUrls.length) {
    errors.push(`${duplicateUrls.length} athlete_url value(s) appear more than once in the same (gender, division) list.`);
  }

  return { errors, counts, total: rows.length };
}

// Stable per-athlete-per-event-per-season upsert key. Deliberately excludes
// the mark, meet, and date -- those legitimately change week to week for
// the same real athlete's season-best record, and a re-import should
// update that one row in place, never add another.
export function athleticNetRankingSourceKey(normalizedAthleteUrl, eventKey, seasonYear) {
  const basis = [normalizedAthleteUrl, eventKey, seasonYear].join("|").toLowerCase();
  return `pw-xc-rankings-${createHash("sha256").update(basis).digest("hex")}`;
}

// One stable identity key per real athlete (by athlete_url), independent
// of any particular week's export -- so a profile created from this
// dataset is found and reused, never recreated, on every later run.
export function athleticNetProfileIdentityKey(normalizedAthleteUrl) {
  return `athletic-net-xc-rankings|${normalizedAthleteUrl}`;
}

async function loadExternalIdProfileMap() {
  const { data, error } = await supabaseAdmin
    .from("athlete_profile_aliases")
    .select("profile_id, normalized_alias")
    .eq("alias_type", "external_id")
    .eq("external_source", EXTERNAL_SOURCE)
    .limit(20000);

  if (error && !isMissingAthleteFoundationError(error)) throw error;

  const map = new Map();
  for (const row of data || []) {
    map.set(row.normalized_alias, row.profile_id);
  }
  return map;
}

async function loadNameMatchProfiles() {
  const { data, error } = await supabaseAdmin
    .from("athlete_profiles")
    .select("id, display_name, normalized_name, gender, graduation_year, current_school_id, current_team_id")
    .is("archived_at", null)
    .is("merged_into_profile_id", null)
    .limit(10000);

  if (error) throw error;

  const schoolIds = [...new Set((data || []).map((p) => p.current_school_id).filter(Boolean))];
  const teamIds = [...new Set((data || []).map((p) => p.current_team_id).filter(Boolean))];

  const [schools, teams] = await Promise.all([
    fetchInChunks("ohio_schools", "id, school_name", "id", schoolIds),
    fetchInChunks("team_pages", "id, school_name", "id", teamIds)
  ]);
  const schoolNameById = new Map((schools || []).map((s) => [s.id, s.school_name]));
  const teamNameById = new Map((teams || []).map((t) => [t.id, t.school_name]));

  const byKey = new Map();
  for (const profile of data || []) {
    const schoolName = schoolNameById.get(profile.current_school_id) || teamNameById.get(profile.current_team_id) || "";
    const key = [
      profile.normalized_name,
      normalizeAthleteGender(profile.gender),
      Number(profile.graduation_year) || 0,
      normalizeAthleteName(schoolName)
    ].join("|");
    const list = byKey.get(key) || [];
    list.push(profile);
    byKey.set(key, list);
  }

  return byKey;
}

async function loadExistingSourceKeys(sourceKeys) {
  const existing = new Set();
  for (let i = 0; i < sourceKeys.length; i += 150) {
    const chunk = sourceKeys.slice(i, i + 150);
    const { data, error } = await supabaseAdmin
      .from("athlete_performances")
      .select("source_key")
      .in("source_key", chunk)
      .limit(1000);
    if (error) throw error;
    for (const row of data || []) existing.add(row.source_key);
  }
  return existing;
}

// Runs matching against the live database but writes nothing -- safe to
// call any number of times. Row statuses: "invalid" (failed per-row
// validation), "matched" (an existing profile was found, by athlete_url
// first, then by name+gender+graduation_year+school), "creatable" (no
// existing profile, but the school resolved to exactly one official Ohio
// school, so a new hidden profile can be created), "unmatched" (neither).
export async function previewAthleticNetRankingsImport(rawRows, options = {}) {
  const seasonYear = Number(options.seasonYear) || DEFAULT_SEASON_YEAR;
  const normalizedRows = rawRows.map((row, index) => normalizeRankingRow(row, index, { seasonYear }));
  const datasetCheck = validateRankingDataset(normalizedRows);

  const [externalIdMap, nameMatchByKey, schoolLookup] = await Promise.all([
    loadExternalIdProfileMap(),
    loadNameMatchProfiles(),
    loadOhioSchoolLookup()
  ]);

  const candidateSourceKeys = [];
  const previewRows = normalizedRows.map((row) => {
    const errors = validateRankingRow(row);
    if (errors.length) {
      return { ...row, row_status: "invalid", errors, match_type: null };
    }

    const sourceKey = athleticNetRankingSourceKey(row.normalized_athlete_url, row.event_key, row.season_year);
    const byExternalId = externalIdMap.get(row.normalized_athlete_url);

    if (byExternalId) {
      candidateSourceKeys.push(sourceKey);
      return {
        ...row,
        row_status: "matched",
        match_type: "athlete_url",
        profile_id: byExternalId,
        source_key: sourceKey,
        errors: []
      };
    }

    const resolvedSchool = schoolLookup.resolve(row.school_name);
    const nameKeyCandidates = [
      [row.normalized_name, row.gender_normalized, row.graduation_year || 0, row.normalized_school].join("|")
    ];
    if (resolvedSchool) {
      nameKeyCandidates.push(
        [row.normalized_name, row.gender_normalized, row.graduation_year || 0, normalizeAthleteName(resolvedSchool.school_name)].join("|")
      );
    }
    const matches = nameKeyCandidates
      .flatMap((key) => nameMatchByKey.get(key) || [])
      .filter((profile, index, all) => all.findIndex((item) => item.id === profile.id) === index);

    if (matches.length === 1) {
      candidateSourceKeys.push(sourceKey);
      return {
        ...row,
        row_status: "matched",
        match_type: "name_gender_grad_school",
        profile_id: matches[0].id,
        source_key: sourceKey,
        errors: []
      };
    }

    if (matches.length > 1) {
      return {
        ...row,
        row_status: "ambiguous",
        match_type: null,
        errors: ["More than one existing athlete profile matched this row by name, gender, graduation year, and school."]
      };
    }

    if (resolvedSchool) {
      candidateSourceKeys.push(sourceKey);
      return {
        ...row,
        row_status: "creatable",
        match_type: null,
        resolved_school_id: resolvedSchool.id,
        resolved_school_name: resolvedSchool.school_name,
        source_key: sourceKey,
        errors: []
      };
    }

    return {
      ...row,
      row_status: "unmatched",
      match_type: null,
      errors: [`School "${row.school_name}" did not resolve to exactly one official Ohio school.`]
    };
  });

  const existingSourceKeys = await loadExistingSourceKeys([...new Set(candidateSourceKeys)]);
  const finalizedRows = previewRows.map((row) => {
    if (row.row_status !== "matched" && row.row_status !== "creatable") return row;
    return { ...row, will_update_existing: existingSourceKeys.has(row.source_key) };
  });

  const summary = {
    total: finalizedRows.length,
    matched: finalizedRows.filter((r) => r.row_status === "matched").length,
    matched_by_athlete_url: finalizedRows.filter((r) => r.match_type === "athlete_url").length,
    matched_by_name: finalizedRows.filter((r) => r.match_type === "name_gender_grad_school").length,
    creatable: finalizedRows.filter((r) => r.row_status === "creatable").length,
    unmatched: finalizedRows.filter((r) => r.row_status === "unmatched").length,
    ambiguous: finalizedRows.filter((r) => r.row_status === "ambiguous").length,
    invalid: finalizedRows.filter((r) => r.row_status === "invalid").length,
    will_insert: finalizedRows.filter((r) => (r.row_status === "matched" || r.row_status === "creatable") && !r.will_update_existing).length,
    will_update: finalizedRows.filter((r) => (r.row_status === "matched" || r.row_status === "creatable") && r.will_update_existing).length
  };

  return { rows: finalizedRows, summary, dataset_check: datasetCheck };
}

async function createSuppliedReferenceProfile(row, { actor, batchId }) {
  const identityKey = athleticNetProfileIdentityKey(row.normalized_athlete_url);
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("athlete_profiles")
    .select("id")
    .eq("source_identity_key", identityKey)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing.id;

  const nameParts = cleanAthleteText(row.athlete_name, 200).split(/\s+/).filter(Boolean);
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0] || row.athlete_name;
  const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : nameParts[0] || row.athlete_name;
  const baseSlug = slugifyAthlete(`${row.athlete_name} ${row.resolved_school_name} ${row.graduation_year || ""}`);
  const payload = {
    source_identity_key: identityKey,
    first_name: firstName,
    last_name: lastName,
    display_name: cleanAthleteText(row.athlete_name, 200),
    normalized_name: row.normalized_name,
    gender: row.gender_normalized,
    graduation_year: row.graduation_year,
    graduation_year_source: row.graduation_year ? "Derived from grade_normalized in the Ohio XC 2026 Athletic.net rankings import" : null,
    current_school_id: row.resolved_school_id,
    athlete_status: "active",
    public_visible: false,
    verification_status: "unverified",
    last_source_reviewed_at: new Date().toISOString(),
    created_by: actor,
    updated_by: actor,
    metadata: { created_from: "athletic_net_xc_rankings_import", import_batch_id: batchId }
  };

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
      .eq("source_identity_key", identityKey)
      .maybeSingle();
    if (retryError) throw retryError;
    if (retry) return retry.id;
  }

  const error = new Error(`A profile could not be created for ${row.athlete_name} after retrying with a disambiguated slug.`);
  error.status = 500;
  throw error;
}

// Writes one alias row linking this athlete_url to this profile, so a
// future run matches it on the strongest (athlete_url) path on the first
// try instead of falling through to name matching again. Best-effort: a
// 23505 against the partial unique index (install/71) means a different
// profile already claims this exact athlete_url -- that is a real data
// conflict (the "never merge different athlete URLs automatically" rule
// working as intended), logged and skipped, never overwritten.
async function learnExternalIdAlias(profileId, row, warnings) {
  const { error } = await supabaseAdmin
    .from("athlete_profile_aliases")
    .upsert(
      {
        profile_id: profileId,
        alias: row.athlete_url,
        normalized_alias: row.normalized_athlete_url,
        alias_type: "external_id",
        external_source: EXTERNAL_SOURCE,
        notes: `Learned from the Ohio XC 2026 Athletic.net rankings import on ${new Date().toISOString().slice(0, 10)}.`
      },
      { onConflict: "profile_id,normalized_alias" }
    );

  if (error) {
    if (error.code === "23505" || isMissingAthleteFoundationError(error)) {
      warnings.push(`athlete_url ${row.athlete_url} is already linked to a different athlete profile; left unchanged for row ${row.row_number}.`);
      return;
    }
    throw error;
  }
}

// Writes real rows. profileCreation is always enabled for this importer
// (per the user's explicit decision for this dataset) -- there is no flag
// to disable it, unlike the stricter project-wide default in
// commitPerformanceImport, which this function does not touch or share
// state with.
export async function commitAthleticNetRankingsImport(rawRows, options = {}) {
  const seasonYear = Number(options.seasonYear) || DEFAULT_SEASON_YEAR;
  const actor = options.actor || "Podium Watch Admin";
  // Two separate labels, deliberately: athlete-profile.js renders a
  // performance's source_label and source_url directly on the PUBLIC
  // athlete page ("Source: <label>", with the URL as the link target) the
  // moment an admin ever publishes it -- so that one is kept generic,
  // matching this project's own established precedent for a compiled
  // rankings source (the original athlete-seed import's public
  // source_label is "Published results and Podium Watch analysis", never
  // naming the provider). batchSourceLabel is for
  // athlete_performance_import_batches only, an admin/internal audit
  // table never rendered publicly, so it keeps the real provenance.
  const batchSourceLabel = options.sourceLabel || "Ohio XC 2026 Athletic.net season-best rankings (Week 7)";
  const publicSourceLabel = options.publicSourceLabel || "Published results and Podium Watch analysis";
  const sourceUrl = options.sourceUrl || null;

  const preview = await previewAthleticNetRankingsImport(rawRows, { seasonYear });
  const actionableRows = preview.rows.filter((r) => r.row_status === "matched" || r.row_status === "creatable");

  if (!actionableRows.length) {
    const error = new Error("No rows are ready to import.");
    error.status = 409;
    throw error;
  }

  const { data: batch, error: batchError } = await supabaseAdmin
    .from("athlete_performance_import_batches")
    .insert({
      import_key: `athletic-net-xc-rankings-${Date.now()}`,
      source_label: batchSourceLabel,
      source_url: sourceUrl,
      source_type: SOURCE_TYPE,
      requested_by: actor,
      options: { submitted_rows: rawRows.length, ...preview.summary }
    })
    .select("*")
    .single();
  if (batchError) throw batchError;

  const warnings = [];

  try {
    const createdProfileIdByIdentity = new Map();
    const finalizedRows = [];

    for (const row of actionableRows) {
      let profileId = row.profile_id;
      let learnedFromMatch = row.row_status === "matched" && row.match_type !== "athlete_url";

      if (row.row_status === "creatable") {
        const identityKey = athleticNetProfileIdentityKey(row.normalized_athlete_url);
        profileId = createdProfileIdByIdentity.get(identityKey);
        if (!profileId) {
          profileId = await createSuppliedReferenceProfile(row, { actor, batchId: batch.id });
          createdProfileIdByIdentity.set(identityKey, profileId);
        }
        learnedFromMatch = true;
      }

      if (learnedFromMatch) {
        await learnExternalIdAlias(profileId, row, warnings);
      }

      finalizedRows.push({ ...row, profile_id: profileId });
    }

    const payload = finalizedRows.map((row) => ({
      profile_id: row.profile_id,
      school_id: row.resolved_school_id || null,
      sport: "cross_country",
      season_year: row.season_year,
      event_name: row.event_name,
      event_key: row.event_key,
      event_group: row.event_group,
      measurement_type: "time",
      sort_direction: "asc",
      mark_text: row.time_displayed,
      mark_value: row.time_seconds,
      mark_sort_value: row.time_seconds,
      mark_unit: "seconds",
      record_type: "season_best",
      meet_name: row.meet_name,
      meet_date: row.meet_date,
      place: null,
      grade: row.grade_normalized,
      source_key: row.source_key,
      source_label: publicSourceLabel,
      // Deliberately null, not row.rankings_page_url: athlete-profile.js
      // turns a performance's source_url into a clickable public link the
      // moment it is ever published, and the real athletic.net link should
      // never be a public href -- only the generic publicSourceLabel text
      // above. The real URL is still preserved for traceability, just in
      // metadata (confirmed never rendered on any public page) instead.
      source_url: null,
      source_type: SOURCE_TYPE,
      verification_status: "unverified",
      public_visible: false,
      result_status: "reviewed_result",
      import_batch_id: batch.id,
      notes: null,
      metadata: {
        source_rank: row.source_rank,
        grade_displayed: row.grade_displayed,
        athlete_url: row.athlete_url,
        school_url: row.school_url,
        meet_url: row.meet_url,
        rankings_page_url: row.rankings_page_url,
        collected_at_eastern: row.collected_at_eastern,
        meet_date_displayed: row.meet_date_displayed
      }
    }));

    const { data: upserted, error: upsertError } = await supabaseAdmin
      .from("athlete_performances")
      .upsert(payload, { onConflict: "source_key" })
      .select("id, source_key");
    if (upsertError) throw upsertError;

    const performanceIdByKey = new Map((upserted || []).map((item) => [item.source_key, item.id]));
    const rowAudit = preview.rows.map((originalRow) => {
      const finalized = finalizedRows.find((r) => r.row_number === originalRow.row_number);
      const row = finalized || originalRow;
      const isActionable = row.row_status === "matched" || row.row_status === "creatable";

      return {
        batch_id: batch.id,
        row_number: row.row_number,
        row_status: isActionable ? "imported" : row.row_status,
        profile_id: row.profile_id || null,
        performance_id: row.source_key ? performanceIdByKey.get(row.source_key) || null : null,
        original_row: rawRows[row.row_number - 1] || {},
        normalized_row: row,
        match_summary: { match_type: row.match_type || null },
        error_message: row.errors?.join(" ") || null
      };
    });

    const { error: auditError } = await supabaseAdmin
      .from("athlete_performance_import_rows")
      .insert(rowAudit);
    if (auditError) throw auditError;

    const summary = { ...preview.summary, imported: upserted?.length || 0, warnings };
    const { error: completeError } = await supabaseAdmin
      .from("athlete_performance_import_batches")
      .update({ status: "completed", completed_at: new Date().toISOString(), summary })
      .eq("id", batch.id);
    if (completeError) throw completeError;

    return { batch_id: batch.id, summary, dataset_check: preview.dataset_check, warnings };
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
