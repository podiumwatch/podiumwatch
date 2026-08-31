// Finish Timing provider adapter -- the ONLY file in this codebase that
// knows Finish Timing's specific data shape. A second timing company gets
// a sibling file exporting the same 8 function names; nothing else in the
// results pipeline needs to change to add one.
//
// Finish Timing's visible pages (finishtiming.trackscoreboard.com) are a
// client-rendered Angular app with zero server-rendered data -- confirmed
// directly, there is nothing to scrape there. The app itself is powered by
// a public, unauthenticated, structured JSON API on Google Firebase
// Realtime Database, confirmed reachable with a plain HTTPS GET (no
// cookies, no JS execution, no auth token):
//
//   https://track-scoreboard-default-rtdb.firebaseio.com/trackscoreboard/finishtiming/
//
// Every acceptance-test count (290 total athlete rows split 46/55/94/95,
// 34 team score rows split 8/9/9/8, for meet 20276747 "Shelby County
// Preview") was reproduced live, byte for byte, against this API before
// any of this file was written.
//
// Firebase returns HTTP 200 with a literal JSON `null` body for any path
// that does not exist yet -- this is NOT a 404, and every fetch below
// checks for it explicitly rather than treating it as an error.

import { fetchPage } from "./result_ingestion_engine.mjs";
import { cleanAthleteText } from "./athlete_foundation_service.mjs";
import { resolveEvent } from "./recruiting_service.mjs";

export const FINISH_TIMING_PROVIDER_KEY = "finish_timing";
export const FINISH_TIMING_PARSER_VERSION = "finish-timing-v1.0.0";

const FINISH_TIMING_BASE = "https://track-scoreboard-default-rtdb.firebaseio.com/trackscoreboard/finishtiming/";
// Meet/event ids are the only variable path segments, and they only ever
// come from Finish Timing's own JSON (discoverMeets/discoverEvents),
// never from admin or request input -- validated anyway before ever being
// interpolated into a URL, so this file can never be used to fetch an
// arbitrary path even if a caller misbehaved.
const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

function assertSafeId(value, label) {
  const text = String(value ?? "");

  if (!SAFE_ID_PATTERN.test(text)) {
    const error = new Error(`${label} is not a valid Finish Timing identifier.`);
    error.status = 422;
    error.code = "INVALID_FINISH_TIMING_ID";
    throw error;
  }

  return text;
}

async function fetchFinishTimingJson(path) {
  const loaded = await fetchPage(`${FINISH_TIMING_BASE}${path}`);
  const text = loaded.bytes.toString("utf8");
  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch {
    const error = new Error(`Finish Timing returned an unparseable response for ${path}.`);
    error.status = 502;
    error.code = "FINISH_TIMING_INVALID_JSON";
    throw error;
  }

  // Firebase's own convention for "this path does not exist" -- not an
  // error, just nothing there yet (a meet not posted, an event not run).
  return parsed === null ? null : parsed;
}

export async function discoverMeets() {
  const index = await fetchFinishTimingJson("meets.json?shallow=true");
  return index ? Object.keys(index) : [];
}

export async function fetchMeet(meetId) {
  const id = assertSafeId(meetId, "Meet id");
  return fetchFinishTimingJson(`meets/${id}/meet/meet.json`);
}

export async function discoverEvents(meetId) {
  const id = assertSafeId(meetId, "Meet id");
  const teamsIndex = await fetchFinishTimingJson(`meets/${id}/meet/teamsIndex.json`);

  if (!teamsIndex?.teams) {
    return null;
  }

  // The union of every team's own event-participation keys across the
  // whole meet IS the event list -- there is no separate "list events"
  // endpoint, confirmed directly against real data.
  const eventIds = new Set();

  for (const team of Object.values(teamsIndex.teams)) {
    for (const eventId of Object.keys(team?.events || {})) {
      eventIds.add(eventId);
    }
  }

  return [...eventIds];
}

export async function fetchEventResults(meetId, eventId) {
  const meetIdSafe = assertSafeId(meetId, "Meet id");
  const eventIdSafe = assertSafeId(eventId, "Event id");
  return fetchFinishTimingJson(`meets/${meetIdSafe}/meet/results/${eventIdSafe}.json`);
}

// fetchMeet()'s own meet.json gives the meet date as a human-readable
// string ("August 25, 2026"), not ISO -- confirmed directly against real
// data. Returns null rather than guessing on anything unparseable.
export function parseMeetDateToIso(dateText) {
  const cleaned = cleanAthleteText(dateText, 60);

  if (!cleaned) {
    return null;
  }

  const parsed = new Date(cleaned);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

// meet.json's own "type" field ("xc" confirmed for cross country) is the
// only sport signal available before any event has been fetched. Indoor
// vs. outdoor track was never confirmed live -- both map to null here
// (deliberately unresolved) rather than a guess, matching the track
// auto-publish deferral throughout this file.
export function classifyMeetSport(meetDoc) {
  const type = cleanAthleteText(meetDoc?.type, 20).toLowerCase();
  return type === "xc" ? "cross_country" : null;
}

function classifyCompetitionLevel(eventDoc) {
  const text = `${eventDoc?.name || ""} ${eventDoc?.fileNameOverride || ""} ${eventDoc?.division || ""}`.toLowerCase();

  if (/\bjh\b|\bms\b|middle school|junior high/.test(text)) {
    return "middle_school";
  }

  // HS/"high school"/"varsity" is checked before a standalone JV mention
  // -- a real event name like "HS Girls JV/Open" (confirmed live,
  // Moeller Primetime 2026-08-31) is a high-school-level race whose heat
  // happens to be JV/Open, not a genuinely separate JV program; every
  // one of its 340 rows was misclassified junior_varsity before this
  // fix, because the JV check ran first and matched "JV" inside that
  // same name. The more explicit HS marker wins when both appear.
  if (/\bhs\b|high school|varsity/.test(text)) {
    return "high_school";
  }

  if (/\bjv\b|junior varsity/.test(text)) {
    return "junior_varsity";
  }

  return null;
}

// A team name ending in a junior-high marker is a strong secondary signal
// used only for the school-matching cache (lib/finish_timing_ingestion_service.mjs),
// never as the primary competition-level classifier -- that's always the
// event-level name/fileNameOverride/division text above, per the explicit
// instruction never to classify from distance or team-name guessing alone.
export function looksLikeJuniorHighTeamName(teamName) {
  return /\bMS$|\bJH$|middle school|junior high/i.test(String(teamName || ""));
}

function normalizeGender(value) {
  const text = String(value || "").trim().toUpperCase();

  if (text === "F") return "girls";
  if (text === "M") return "boys";
  return null;
}

function markFromSplit(split) {
  if (!split) {
    return { markText: "DNS", markValue: null, resultTag: "DNS" };
  }

  if (split.dnf === 1 || split.dnf === true) {
    return { markText: "DNF", markValue: null, resultTag: "DNF" };
  }

  const timeText = cleanAthleteText(split.timeOriginal || split.time, 30);

  if (!timeText) {
    return { markText: "DNS", markValue: null, resultTag: "DNS" };
  }

  const seconds = Number(split.timeSeconds);
  return {
    markText: timeText,
    markValue: Number.isFinite(seconds) ? seconds : null,
    resultTag: "OFFICIAL"
  };
}

// eventDoc.distance is a bare number whose UNIT depends entirely on
// eventDoc.measure -- confirmed against two real meets, not guessed:
// Shelby County Preview's HS/JH events use measure "E" (English/miles;
// distance=2 is a real 2-mile race), but Moeller Primetime's HS events
// use measure "M" (metric/kilometers; distance=5 is a real 5K -- NOT "5
// Mile", which parseAthleteRows literally produced before this fix,
// since the acceptance test that shipped this file only ever exercised
// a meet using "E"). A middle-school event with no recognized measure
// (seen as "S") already carries its distance in meters (3200 = a real
// 3200m race), matching resolveEvent()'s own "3200"/"3200m" aliases
// directly with no conversion. Found live 2026-08-31 importing a real
// Moeller Primetime paste, where every HS row came back with a null
// event_code because "5 Mile" resolves to nothing in the event catalog.
function buildCrossCountryEventName(eventDoc) {
  const distance = Number(eventDoc?.distance);

  if (!Number.isFinite(distance) || distance <= 0) {
    return "";
  }

  const measure = String(eventDoc?.measure || "").toUpperCase();

  if (measure === "E") {
    return `${distance} Mile`;
  }

  if (measure === "M") {
    return `${distance}K`;
  }

  return `${distance}m`;
}

// Pure -- no fetch. meetContext: { meetId, meetName, meetDateIso, sport,
// seasonYear } (sport/seasonYear already derived by the caller from
// fetchMeet()'s own type/date fields -- only cross_country is confidently
// supported today, see the sport check below). eventId is the same id
// passed to fetchEventResults() -- taken as an explicit parameter rather
// than read from eventDoc's own (unverified to match) internal id field.
export function parseAthleteRows(meetContext, eventId, eventDoc) {
  if (!eventDoc || !Array.isArray(eventDoc.groups)) {
    return [];
  }

  const competitionLevel = classifyCompetitionLevel(eventDoc);
  const eventGender = normalizeGender(eventDoc.gender);
  const isCrossCountry = meetContext.sport === "cross_country";
  // Track event names were never confirmed against real Finish Timing
  // data (only cross country was) -- every row from a non-cross-country
  // meet is deliberately given an empty event name and the
  // TRACK_EVENT_NAME_UNVERIFIED warning below, which forces it ineligible
  // for auto-publish rather than guessing at a name.
  const eventName = isCrossCountry ? buildCrossCountryEventName(eventDoc) : "";

  const rows = [];

  for (const group of eventDoc.groups) {
    for (const athlete of group.athletes || []) {
      const warningCodes = [];

      if (!isCrossCountry) {
        warningCodes.push("TRACK_EVENT_NAME_UNVERIFIED");
      }

      if (!competitionLevel) {
        warningCodes.push("UNKNOWN_COMPETITION_LEVEL");
      }

      // A prior version of this file cross-checked athlete.division/
      // divisionAthlete against the event's own name text, expecting a
      // level echo (e.g. "HS" on both), and flagged INCONSISTENT_LEVEL_
      // SIGNAL on any mismatch. Removed: confirmed live 2026-08-31 on a
      // real Moeller Primetime import that this field actually holds the
      // school's OHSAA competitive division number ("1"-"4"), not a
      // level echo at all -- a completely different piece of information
      // this event's own name was never going to contain, so the check
      // fired on 626 of 628 real rows and carried no signal whatsoever.

      const state = cleanAthleteText(athlete.state, 10).toUpperCase();

      if (!state) {
        warningCodes.push("STATE_UNCONFIRMED");
      } else if (state !== "OH") {
        warningCodes.push("NON_OHIO_ATHLETE");
      }

      const gender = normalizeGender(athlete.gender) || eventGender;

      if (!gender) {
        warningCodes.push("MISSING_GENDER");
      }

      const finishSplit = Array.isArray(athlete.splits) ? athlete.splits[athlete.splits.length - 1] : null;
      const { markText, markValue, resultTag } = markFromSplit(finishSplit);
      const athleteName = cleanAthleteText(`${athlete.first_name || ""} ${athlete.last_name || ""}`, 200);
      const schoolName = cleanAthleteText(athlete.team, 200);

      if (!athleteName) {
        warningCodes.push("ATHLETE_OR_RELAY_MISSING");
      }

      if (!schoolName) {
        warningCodes.push("SCHOOL_MISSING");
      }

      if (!eventName) {
        warningCodes.push("EVENT_MISSING");
      }

      if (!markText) {
        warningCodes.push("MARK_MISSING");
      }

      const identity = [
        meetContext.meetName,
        meetContext.meetDateIso,
        eventName,
        athleteName,
        schoolName,
        markText,
        finishSplit?.place ?? ""
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
        division: athlete.division || athlete.divisionAthlete || null,
        eventName,
        eventCode: eventName ? resolveEvent(eventName, meetContext.sport)?.event_key || null : null,
        athleteName,
        athleteGrade: cleanAthleteText(athlete.year, 10) || null,
        schoolName,
        relayTeam: null,
        relayMembers: [],
        place: Number.isInteger(finishSplit?.place) ? finishSplit.place : null,
        markText,
        markValue,
        points: Number.isFinite(Number(finishSplit?.points)) ? Number(finishSplit.points) : null,
        windText: null,
        resultStatus: resultTag,
        parserConfidence: Math.max(10, 100 - warningCodes.length * 20),
        matchConfidence: 0,
        warningCodes,
        rawRow: {
          providerKey: FINISH_TIMING_PROVIDER_KEY,
          providerMeetId: String(meetContext.meetId),
          providerEventId: String(eventId),
          providerAthleteId: String(athlete.athlete_id ?? athlete.bib ?? ""),
          providerTeamId: String(athlete.team_id ?? ""),
          providerTeamName: athlete.team || null,
          bib: athlete.bib ?? null,
          registrationId: athlete.registration_id || null,
          state
        },
        sourceFingerprint: cleanAthleteText(JSON.stringify(athlete), 4000),
        resultFingerprint: identity
      });
    }
  }

  return rows;
}

// Must be called with that same event's already-parsed athlete rows --
// Finish Timing's team-scoring entries carry no team id of their own
// (confirmed directly against real data), so a team name -> provider team
// id map is built from the athlete rows first. eventId is the same id
// passed to fetchEventResults()/parseAthleteRows(), for the same reason.
export function parseTeamScores(meetContext, eventId, eventDoc, athleteRows) {
  if (!eventDoc || !Array.isArray(eventDoc.groups)) {
    return [];
  }

  const competitionLevel = classifyCompetitionLevel(eventDoc);
  const eventGender = normalizeGender(eventDoc.gender);
  const isCrossCountry = meetContext.sport === "cross_country";
  const eventName = isCrossCountry ? buildCrossCountryEventName(eventDoc) : "";

  const teamIdByName = new Map();
  for (const row of athleteRows || []) {
    if (row.schoolName && row.rawRow?.providerTeamId) {
      teamIdByName.set(row.schoolName, row.rawRow.providerTeamId);
    }
  }

  const rows = [];

  for (const group of eventDoc.groups) {
    for (const team of group.teams || []) {
      const teamName = cleanAthleteText(team.name, 200);
      // The real place/score/scoring-breakdown fields live inside
      // team.splits[last] -- confirmed directly against real data, the
      // exact same shape individual athletes use (splits[0] is always
      // null/unused for this meet type; the top-level team object itself
      // only reliably carries name/numRunners/division, not the actual
      // scoring result).
      const finish = Array.isArray(team.splits) ? team.splits[team.splits.length - 1] : null;
      const rawPlace = finish?.place;
      const isDnp = String(rawPlace ?? "").trim().toUpperCase() === "DNP";
      const placeNumeric = !isDnp && Number.isInteger(Number(rawPlace)) ? Number(rawPlace) : null;
      const rawScore = finish?.score;
      const score = rawScore === "" || rawScore === null || rawScore === undefined
        ? null
        : Number.isFinite(Number(rawScore)) ? Number(rawScore) : null;
      const finishAthletes = finish?.athletes;

      rows.push({
        providerMeetId: String(meetContext.meetId),
        providerEventId: String(eventId),
        providerTeamId: teamIdByName.get(teamName) || null,
        meetName: meetContext.meetName,
        meetDate: meetContext.meetDateIso,
        sport: meetContext.sport,
        seasonYear: meetContext.seasonYear,
        competitionLevel,
        gender: eventGender,
        division: eventDoc.division || null,
        eventName,
        teamName,
        placeText: isDnp ? "DNP" : (rawPlace ?? null) === null ? null : String(rawPlace),
        placeNumeric,
        didNotPlace: isDnp,
        score,
        numRunners: Number.isFinite(Number(finish?.numRunners ?? team.numRunners)) ? Number(finish?.numRunners ?? team.numRunners) : null,
        scoringBreakdown: {
          scoringPlaces: finish?.scoringPlaces || null,
          finishPlaces: finish?.finishPlaces || null,
          teamTime: finish?.teamTime || null,
          teamTimeSeconds: Number.isFinite(Number(finish?.teamTimeSeconds)) ? Number(finish.teamTimeSeconds) : null,
          scorers: Array.isArray(finishAthletes) ? finishAthletes : []
        }
      });
    }
  }

  return rows;
}

// Final cleanup pass -- resolves the event via the shared event catalog
// (resolveEvent, already extended for "1 Mile"/"2 Mile" cross country) and
// re-cleans text fields, so a row is ready to hand to
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

// The stable identity for one athlete in one event of one meet --
// deliberately distinct from resultFingerprint above (which intentionally
// changes when a mark is corrected, by the existing engine's own design,
// and only ever serves staging-row dedup). This string is what
// lib/result_ingestion_engine.mjs's importFinishTimingApprovedRows() uses
// for athlete_performances.source_key, so a correction updates the
// existing performance row instead of creating a duplicate or silently
// being dropped.
export function createSourceIdentity({ meetId, eventId, athleteId }) {
  return `finish-timing:meet:${meetId}:event:${eventId}:athlete:${athleteId}`;
}
