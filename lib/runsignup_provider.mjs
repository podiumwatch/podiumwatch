// RunSignup provider adapter -- a sibling to lib/finish_timing_provider.mjs,
// the only file in this codebase that knows RunSignup's specific data
// shape. Same extension-seam idea: nothing else in the results pipeline
// needs to change to add a provider.
//
// RunSignup (runsignup.com) is a real race-registration/timing platform.
// Speedy Feet, a real Ohio timing company, is built entirely on it
// (confirmed: speedy-feet.com serves runsignup.com's own CDN, help center,
// and the /w/SpeedyFeet club-microsite URL pattern) -- but RunSignup hosts
// many other Ohio school meets and conference championships directly, not
// just Speedy Feet's races. Unlike Finish Timing, RunSignup exposes a real,
// official, documented public REST API. Unlike MileSplit/Athletic.net
// (both confirmed access-controlled, not integrated), RunSignup's
// results-reading endpoints need NO credentials at all for public race
// data -- confirmed live against two real Ohio HS XC conference
// championship meets (race 172302 "Ohio Cardinal Conference XC
// Championship Meet", race 101288 "Northern Lakes League Cross Country
// Championships") with a plain unauthenticated HTTPS GET.
//
// Base: https://runsignup.com/rest/
//   race/{raceId}?format=json
//     -> { race: { name, address, events: [{ event_id, name, distance, start_time }, ...] } }
//     events[] bundles every year's races AND non-race registration
//     categories ("Scratch", "All Participants") into one flat list, with
//     no distance set on the non-race ones -- confirmed live. Filtering to
//     entries that carry a real distance is the only reliable "is this an
//     actual scored heat" signal available before fetching results.
//   race/{raceId}/results/get-results?format=json&event_id=...
//     -> { individual_results_sets: [{ results_headers, results: [...] }] }
//
// RunSignup returns HTTP 200 with a JSON {"error":{...}} envelope for bad
// input (confirmed live: a missing event_id returns error_code 3,
// "Invalid parameters") -- NOT a network failure, and every fetch below
// checks for it explicitly.
//
// Each race director configures their own custom result fields (grade,
// team name, team score, team place), so the underlying JSON key differs
// PER RACE even for the identical field -- confirmed live: "Year" lived at
// "custom-field-560775" on one race and "custom-field-561293" on another.
// Every row is read through that race's own results_headers label map,
// never a hardcoded field key.
//
// RunSignup's results endpoint also silently caps a single page at 50 rows
// with ZERO signal more exist -- no total-count field, no "has more" flag
// -- confirmed live against a real 51-finisher race (row 51 only appeared
// on page 2). The exact same silent-truncation shape as this codebase's
// own PostgREST 1,000-row vote-count bug (see docs/DECISIONS.md), fixed
// the same way in fetchEventResults() below: never trust a single page,
// always page until a page comes back short of the requested size.
// RunSignup's own real ceiling for results_per_page is 2,500 (2,501 is
// rejected as an invalid parameter, confirmed live) -- no real Ohio HS XC
// field will ever approach that, so paging is defense-in-depth, not a
// realistic requirement.

import { fetchPage } from "./result_ingestion_engine.mjs";
import { cleanAthleteText } from "./athlete_foundation_service.mjs";
import { resolveEvent } from "./recruiting_service.mjs";

export const RUNSIGNUP_PROVIDER_KEY = "runsignup";
export const RUNSIGNUP_PARSER_VERSION = "runsignup-v1.0.0";

const RUNSIGNUP_BASE = "https://runsignup.com/rest/";
const MAX_RESULTS_PER_PAGE = 2500;
// Race/event ids are always plain numeric strings, confirmed live -- the
// only variable path segments here, always sourced from RunSignup's own
// JSON or an admin-supplied race id, never arbitrary request input.
const SAFE_ID_PATTERN = /^[0-9]{1,15}$/;

function assertSafeId(value, label) {
  const text = String(value ?? "");

  if (!SAFE_ID_PATTERN.test(text)) {
    const error = new Error(`${label} is not a valid RunSignup identifier.`);
    error.status = 422;
    error.code = "INVALID_RUNSIGNUP_ID";
    throw error;
  }

  return text;
}

async function fetchRunSignupJson(path) {
  const loaded = await fetchPage(`${RUNSIGNUP_BASE}${path}`);
  const text = loaded.bytes.toString("utf8");
  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch {
    const error = new Error(`RunSignup returned an unparseable response for ${path}.`);
    error.status = 502;
    error.code = "RUNSIGNUP_INVALID_JSON";
    throw error;
  }

  // RunSignup's own convention for "this input isn't valid" -- an HTTP 200
  // body shaped {"error":{...}}, confirmed live. Handed back to the caller
  // rather than thrown here, since what a given error code means differs
  // by endpoint (e.g. "race not found" vs. "no results posted yet").
  if (parsed && typeof parsed === "object" && parsed.error) {
    return { runsignupError: parsed.error };
  }

  return parsed;
}

export async function fetchRaceInfo(raceId) {
  const id = assertSafeId(raceId, "Race id");
  const result = await fetchRunSignupJson(`race/${id}?format=json`);
  return result?.runsignupError ? null : result?.race || null;
}

export function discoverRaceEvents(raceDoc) {
  if (!raceDoc || !Array.isArray(raceDoc.events)) {
    return [];
  }

  return raceDoc.events
    .filter((event) => cleanAthleteText(event?.distance, 20))
    .map((event) => ({
      eventId: String(event.event_id),
      name: cleanAthleteText(event.name, 200),
      distance: cleanAthleteText(event.distance, 20),
      startTime: event.start_time || null
    }));
}

// Pure merge step for one page of fetchEventResults() -- pulled out and
// exported so the real silent-truncation shape (RunSignup's default page
// size caps a result set at 50 rows with no total-count field anywhere in
// the response, confirmed live against a real 51-finisher race) can be
// regression-tested directly against real captured page data, the same
// discipline this codebase already applies to its own PostgREST
// 1,000-row vote-count bug (see docs/DECISIONS.md). Mutates setsById in
// place (merging same-set-id results across pages) and returns whether
// any set in this page came back exactly full -- the signal to fetch
// another page rather than stop.
export function mergeResultSetPage(setsById, pageSets, requestedPageSize) {
  let anyFullPage = false;

  for (const set of pageSets || []) {
    const pageResults = Array.isArray(set?.results) ? set.results : [];
    const existing = setsById.get(set.individual_result_set_id);

    if (existing) {
      existing.results.push(...pageResults);
    } else {
      setsById.set(set.individual_result_set_id, { ...set, results: [...pageResults] });
    }

    if (pageResults.length >= requestedPageSize) {
      anyFullPage = true;
    }
  }

  return anyFullPage;
}

export async function fetchEventResults(raceId, eventId) {
  const raceIdSafe = assertSafeId(raceId, "Race id");
  const eventIdSafe = assertSafeId(eventId, "Event id");

  let page = 1;
  const setsById = new Map();

  for (;;) {
    const result = await fetchRunSignupJson(
      `race/${raceIdSafe}/results/get-results?format=json&event_id=${eventIdSafe}&results_per_page=${MAX_RESULTS_PER_PAGE}&page=${page}`
    );

    if (result?.runsignupError) {
      // "No results posted yet" and genuinely bad input both land here.
      // The first page failing means nothing usable exists; a later page
      // failing (should not happen in practice, since paging stops once a
      // page comes back short) just means stop and return what was found.
      return page === 1 ? null : [...setsById.values()];
    }

    const pageSets = Array.isArray(result?.individual_results_sets) ? result.individual_results_sets : [];

    if (pageSets.length === 0 || pageSets.every((set) => !(set?.results || []).length)) {
      break;
    }

    const anyFullPage = mergeResultSetPage(setsById, pageSets, MAX_RESULTS_PER_PAGE);

    if (!anyFullPage) {
      break;
    }

    page += 1;
  }

  return [...setsById.values()];
}

// race.name is the only sport signal available before results are
// fetched -- RunSignup has no explicit "type":"xc" field the way Finish
// Timing's meet.json does. Deliberately returns null (unresolved) rather
// than guessing from distance alone, matching this codebase's established
// rule against exactly that kind of guess.
export function classifyRaceSport(raceDoc) {
  const text = cleanAthleteText(raceDoc?.name, 300).toLowerCase();
  return /\bcross country\b|\bxc\b/.test(text) ? "cross_country" : null;
}

function classifyCompetitionLevel(eventName) {
  const text = String(eventName || "").toLowerCase();

  if (/\bms\b|middle school|junior high/.test(text)) {
    return "middle_school";
  }

  if (/\bhs\b|high school|varsity/.test(text)) {
    return "high_school";
  }

  if (/\bjv\b|junior varsity/.test(text)) {
    return "junior_varsity";
  }

  // A bare "Open" with no other qualifier is genuinely ambiguous from the
  // name alone -- confirmed live, real HS conference championship meets
  // use it for the non-varsity HIGH SCHOOL heat ("Open Boys"/"Open Girls"
  // run alongside "Varsity Boys"/"Varsity Girls" at the same meet), but
  // nothing in the bare word itself rules out an unattached/open-to-the-
  // public heat at some other race. Left unresolved (held for manual
  // review) rather than guessed -- the same discipline that caught the
  // real JV/HS Finish Timing misclassification earlier in this project.
  return null;
}

function normalizeGender(value) {
  const text = String(value || "").trim().toUpperCase();
  if (text === "F") return "girls";
  if (text === "M") return "boys";
  return null;
}

// RunSignup's clock_time/chip_time text is always "M:SS.hh" or
// "H:MM:SS.hh" -- confirmed live -- with no separate seconds field the way
// Finish Timing provides (timeSeconds). No existing helper in this
// codebase parses this exact shape, so it's parsed directly here.
function timeTextToSeconds(text) {
  const cleaned = cleanAthleteText(text, 30);

  if (!cleaned) {
    return null;
  }

  const parts = cleaned.split(":").map((part) => Number(part));

  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }

  const seconds = parts.reduce((total, part) => total * 60 + part, 0);
  return Number.isFinite(seconds) ? seconds : null;
}

// { label (lowercased) -> field key } for one result set's own
// results_headers -- required because each race director's custom fields
// carry a different literal JSON key even for the identical label
// ("Year"/"Team Name"/"Score"/"Team Score"/"Team Place" are the labels
// this file looks for; confirmed stable text across two real races even
// though the underlying "custom-field-NNNNNN" keys differed on every one).
function buildFieldKeyByLabel(resultSet) {
  const map = new Map();

  for (const [key, label] of Object.entries(resultSet?.results_headers || {})) {
    map.set(String(label || "").trim().toLowerCase(), key);
  }

  return map;
}

function fieldValue(row, fieldKeyByLabel, label) {
  const key = fieldKeyByLabel.get(label);

  if (!key) {
    return null;
  }

  const value = row?.[key];
  return value === "" || value === null || value === undefined ? null : value;
}

// Pure -- no fetch. meetContext: { raceId, meetName, meetDateIso,
// meetLocation, raceState, sport, seasonYear } -- raceState is the race's
// own registered address.state (from fetchRaceInfo()'s raceDoc), used as
// the Ohio-relevance fallback when an individual result's own state field
// is blank (see below). eventMeta: one entry from
// discoverRaceEvents() (eventId/name/distance). resultSets: the array
// fetchEventResults() returned for that event -- a single event can carry
// more than one result set (RunSignup allows overall + secondary result
// sets on one event), so every set's rows are parsed; deduplication is
// left to the existing staging upsert's resultFingerprint keying.
export function parseAthleteRows(meetContext, eventMeta, resultSets) {
  if (!Array.isArray(resultSets) || resultSets.length === 0) {
    return [];
  }

  const competitionLevel = classifyCompetitionLevel(eventMeta?.name);
  const isCrossCountry = meetContext.sport === "cross_country";
  const eventName = isCrossCountry ? cleanAthleteText(eventMeta?.distance, 20) : "";
  const eventCode = eventName ? resolveEvent(eventName, meetContext.sport)?.event_key || null : null;

  const rows = [];

  for (const resultSet of resultSets) {
    // A race director can mark a whole result set non-public -- confirmed
    // real field ("public_results":"T"/"F"). Never staged at all, matching
    // "only ever touch data the source itself marks public."
    if (String(resultSet?.public_results || "").toUpperCase() !== "T") {
      continue;
    }

    const fieldKeyByLabel = buildFieldKeyByLabel(resultSet);

    for (const result of resultSet.results || []) {
      const warningCodes = [];

      if (!isCrossCountry) {
        warningCodes.push("TRACK_EVENT_NAME_UNVERIFIED");
      }

      if (!competitionLevel) {
        warningCodes.push("UNKNOWN_COMPETITION_LEVEL");
      }

      // RunSignup's own per-athlete "state" field is registration-form
      // dependent and frequently blank on a real school-team meet --
      // confirmed live: every one of 51 real rows at the Ohio Cardinal
      // Conference Championship had a null state, even though every team
      // is a genuine Ohio school. The race's own registered address
      // (meetContext.raceState) is a far more reliable per-meet signal in
      // that case; the athlete's own field, when present, still wins (it's
      // the real, specific signal for an out-of-state qualifier at a
      // boundary meet, confirmed present and populated on a second real
      // race checked live).
      const athleteState = cleanAthleteText(result.state, 10).toUpperCase();
      const raceState = cleanAthleteText(meetContext.raceState, 10).toUpperCase();
      let state;

      if (athleteState) {
        state = athleteState;
        if (athleteState !== "OH") warningCodes.push("NON_OHIO_ATHLETE");
      } else if (raceState) {
        state = raceState;
        if (raceState !== "OH") warningCodes.push("NON_OHIO_ATHLETE");
      } else {
        state = "";
        warningCodes.push("STATE_UNCONFIRMED");
      }

      const gender = normalizeGender(result.gender);

      if (!gender) {
        warningCodes.push("MISSING_GENDER");
      }

      const athleteName = cleanAthleteText(`${result.first_name || ""} ${result.last_name || ""}`, 200);
      const schoolName = cleanAthleteText(fieldValue(result, fieldKeyByLabel, "team name"), 200);
      const grade = cleanAthleteText(fieldValue(result, fieldKeyByLabel, "year"), 10);

      if (!athleteName) warningCodes.push("ATHLETE_OR_RELAY_MISSING");
      if (!schoolName) warningCodes.push("SCHOOL_MISSING");
      if (!eventName) warningCodes.push("EVENT_MISSING");

      const timeText = cleanAthleteText(result.chip_time || result.clock_time, 30);
      const markText = timeText || "DNS";
      const markValue = timeText ? timeTextToSeconds(timeText) : null;

      if (!timeText) warningCodes.push("MARK_MISSING");

      const identity = [
        meetContext.meetName,
        meetContext.meetDateIso,
        eventName,
        athleteName,
        schoolName,
        markText,
        result.place ?? ""
      ].map((value) => cleanAthleteText(value, 200).toLowerCase()).join("|");

      rows.push({
        rowNumber: rows.length + 1,
        meetName: meetContext.meetName,
        meetDate: meetContext.meetDateIso,
        meetLocation: meetContext.meetLocation || null,
        sport: meetContext.sport,
        seasonYear: meetContext.seasonYear,
        competitionLevel,
        gender,
        division: null,
        eventName,
        eventCode,
        athleteName,
        athleteGrade: grade || null,
        schoolName,
        relayTeam: null,
        relayMembers: [],
        place: Number.isInteger(Number(result.place)) ? Number(result.place) : null,
        markText,
        markValue,
        points: null,
        windText: null,
        resultStatus: timeText ? "OFFICIAL" : "DNS",
        parserConfidence: Math.max(10, 100 - warningCodes.length * 20),
        matchConfidence: 0,
        warningCodes,
        rawRow: {
          providerKey: RUNSIGNUP_PROVIDER_KEY,
          providerRaceId: String(meetContext.raceId),
          providerEventId: String(eventMeta.eventId),
          providerResultId: String(result.result_id ?? ""),
          providerBib: result.bib ?? null,
          teamScore: fieldValue(result, fieldKeyByLabel, "team score"),
          teamPlace: fieldValue(result, fieldKeyByLabel, "team place"),
          individualScore: fieldValue(result, fieldKeyByLabel, "score"),
          state
        },
        sourceFingerprint: cleanAthleteText(JSON.stringify(result), 4000),
        resultFingerprint: identity
      });
    }
  }

  return rows;
}

// RunSignup embeds each finisher's own team score/place directly on their
// individual result row (custom fields "Team Score"/"Team Place", labels
// confirmed stable across races) rather than a separate per-team scoring
// array the way Finish Timing provides -- so team rows are DERIVED from
// already-parsed athlete rows here, one per distinct school name that
// carries a team score or place, taking the first (RunSignup repeats the
// identical team total on every one of that team's own rows, confirmed
// live). numRunners counts every one of that team's rows carrying a team
// score/place -- confirmed live that this total is echoed on every
// finisher's row, not only the scoring 5, so this is "how many of this
// team's runners finished," not strictly "how many scored."
export function parseTeamScores(meetContext, eventMeta, athleteRows) {
  const bySchool = new Map();

  for (const row of athleteRows || []) {
    const teamScore = row.rawRow?.teamScore;
    const teamPlace = row.rawRow?.teamPlace;

    if (!row.schoolName || (teamScore === null && teamPlace === null)) {
      continue;
    }

    if (!bySchool.has(row.schoolName)) {
      bySchool.set(row.schoolName, { row, count: 0 });
    }

    bySchool.get(row.schoolName).count += 1;
  }

  const rows = [];

  for (const [teamName, { row, count }] of bySchool) {
    const rawPlace = row.rawRow.teamPlace;
    const isDnp = String(rawPlace ?? "").trim().toUpperCase() === "DNP";
    const placeNumeric = !isDnp && Number.isInteger(Number(rawPlace)) ? Number(rawPlace) : null;
    const rawScore = row.rawRow.teamScore;
    const score = rawScore === null ? null : Number.isFinite(Number(rawScore)) ? Number(rawScore) : null;

    rows.push({
      providerRaceId: String(meetContext.raceId),
      providerEventId: String(eventMeta.eventId),
      // RunSignup gives no stable per-team id anywhere in this response,
      // only the team name -- confirmed live, unlike Finish Timing's
      // team_id. School matching downstream must go by name alone here.
      providerTeamId: null,
      meetName: meetContext.meetName,
      meetDate: meetContext.meetDateIso,
      sport: meetContext.sport,
      seasonYear: meetContext.seasonYear,
      competitionLevel: row.competitionLevel,
      gender: row.gender,
      division: null,
      eventName: row.eventName,
      teamName,
      placeText: isDnp ? "DNP" : (rawPlace ?? null) === null ? null : String(rawPlace),
      placeNumeric,
      didNotPlace: isDnp,
      score,
      numRunners: count,
      scoringBreakdown: {}
    });
  }

  return rows;
}

// Final cleanup pass -- resolves the event via the shared event catalog
// and re-cleans text fields, so a row is ready to hand to
// lib/result_ingestion_engine.mjs's existing stagingValue() unchanged.
export function normalizeResult(row) {
  return {
    ...row,
    meetName: cleanAthleteText(row.meetName, 300),
    athleteName: cleanAthleteText(row.athleteName, 200),
    schoolName: cleanAthleteText(row.schoolName, 200),
    eventCode: row.eventName ? resolveEvent(row.eventName, row.sport)?.event_key || row.eventCode || null : row.eventCode
  };
}

// The stable identity for one athlete's result in one event of one race.
// RunSignup's own result_id is already a stable per-result primary key
// (confirmed live), used the same way Finish Timing's athlete_id is --
// this is what athlete_performances.source_key ends up as, so a correction
// updates the existing performance row instead of duplicating it.
export function createSourceIdentity({ raceId, eventId, resultId }) {
  return `runsignup:race:${raceId}:event:${eventId}:result:${resultId}`;
}
