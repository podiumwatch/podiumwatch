// Race Command Center's database-backed service layer, matching the
// structure of lib/team_roster_service.mjs (validators, a fail() helper,
// team ownership checks, then one section per concern). Every function
// here is scoped to an explicit teamId passed in by the caller -- there
// is no server-side "current team" concept anywhere in this codebase
// (see api/team/roster.js for the authorization pattern every
// api/race-command-center/*.js handler copies).
//
// Pure, no-database helper functions (diffParticipants, buildFinishCheckpoint)
// live here too but are exported separately so
// scripts/test-race-command-center.mjs can unit test them directly,
// matching how lib/path_to_state_service.mjs splits into a pure half and
// a database-backed half.
import { supabaseAdmin } from "./supabase-admin.mjs";
import { computeEvenPaceTargets, validateCustomPaceTargets } from "./race_math.mjs";
import { resolveParticipantNames } from "./race_viewer_service.mjs";
import { queueTeamNotification } from "./engagement_service.mjs";

const GOAL_SLOTS = ["A", "B", "C"];
const CHANGE_REASONS = ["recorded", "undo", "manual_correction", "pack_capture_correction"];
const CAPTURE_METHODS = ["single_tap", "pack_capture", "manual_entry", "edited"];

function fail(message, status = 400, code = "") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  throw error;
}

export function parseRaceBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      fail("The submitted race request is invalid.");
    }
  }

  return request.body || {};
}

// --- validators, matching lib/team_roster_service.mjs's style exactly ------

function cleanText(value, maxLength = 500) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function cleanNullableText(value, maxLength = 500) {
  const cleaned = cleanText(value, maxLength);
  return cleaned || null;
}

function cleanUuid(value, label = "ID") {
  const cleaned = cleanText(value, 100);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleaned)) {
    fail(`${label} is invalid.`);
  }
  return cleaned;
}

function cleanNullableUuid(value, label = "ID") {
  const cleaned = cleanText(value, 100);
  return cleaned ? cleanUuid(cleaned, label) : null;
}

function cleanDate(value, label) {
  const cleaned = cleanText(value, 30);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    fail(`${label} must use the format YYYY-MM-DD.`);
  }
  return cleaned;
}

function cleanPositiveNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    fail(`${label} must be a positive number.`);
  }
  return number;
}

function cleanNonNegativeNumberOrNull(value, label) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    fail(`${label} must be zero or a positive number.`);
  }
  return number;
}

function cleanEnum(value, allowed, label) {
  const cleaned = cleanText(value, 50);
  if (!allowed.includes(cleaned)) {
    fail(`${label} must be one of: ${allowed.join(", ")}.`);
  }
  return cleaned;
}

function cleanIsoTimestamp(value, label) {
  const cleaned = cleanText(value, 60);
  const ms = Date.parse(cleaned);
  if (!cleaned || Number.isNaN(ms)) {
    fail(`${label} must be a valid timestamp.`);
  }
  return new Date(ms).toISOString();
}

function cleanBoolean(value) {
  return value === true || value === "true" || value === 1;
}

// --- shared authorization helper for every api/race-command-center/*.js ----
// handler -- matches api/team/roster.js's inline team_members check
// exactly, factored out here since 4 separate handler files need it.

export async function requireTeamMembership(userId, teamId) {
  const { data: membership, error } = await supabaseAdmin
    .from("team_members")
    .select("id, team_id, user_id, role, status, display_name")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!membership) {
    fail("You do not have permission to manage this team's races.", 403);
  }

  return membership;
}

// --- team / session ownership -----------------------------------------------

const TEAM_FIELDS = "id, school_name, slug, published, archived_at, merged_into_team_id";

export async function loadTeam(teamId) {
  const { data, error } = await supabaseAdmin
    .from("team_pages")
    .select(TEAM_FIELDS)
    .eq("id", teamId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data || data.archived_at || data.merged_into_team_id) {
    fail("This team page is not available.", 404);
  }

  return data;
}

async function loadSessionOrFail(teamId, sessionId) {
  const { data, error } = await supabaseAdmin
    .from("race_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("team_id", teamId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    fail("Race not found.", 404);
  }

  return data;
}

async function loadCheckpoints(sessionId) {
  const { data, error } = await supabaseAdmin
    .from("race_checkpoints")
    .select("*")
    .eq("race_session_id", sessionId)
    .order("sort_order", { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}

// --- pure helpers (unit tested directly from Node, no database access) -----

// Ensures the checkpoint list the coach entered always has exactly one
// checkpoint marked as the finish, at exactly the race's own distance --
// never an invented interior checkpoint, and never a race with no finish
// marker at all. If the coach's own last checkpoint already lands at the
// full race distance, it becomes the finish; otherwise one final "Finish"
// checkpoint is appended at exactly distanceMeters.
export function buildCheckpointsWithFinish(distanceMeters, checkpointsInput) {
  const sorted = [...checkpointsInput]
    .map((c) => ({ label: cleanText(c.label, 120) || "Checkpoint", distanceMeters: Number(c.distanceMeters) }))
    .filter((c) => Number.isFinite(c.distanceMeters) && c.distanceMeters > 0)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  const last = sorted[sorted.length - 1];
  const hasFinish = last && Math.abs(last.distanceMeters - distanceMeters) < 0.5;

  const withFinish = hasFinish
    ? sorted
    : [...sorted, { label: "Finish", distanceMeters }];

  return withFinish.map((c, index) => ({
    label: c.label,
    distance_meters: c.distanceMeters,
    sort_order: index + 1,
    is_finish: index === withFinish.length - 1
  }));
}

// A pure diff between a session's existing participants and the desired
// full list a coach just submitted -- the "bulk roster save" always
// sends the complete desired state and the server computes exactly what
// changes, rather than the client trying to track incremental deltas
// itself (see the spec's requirement that bulk actions never produce
// confusing hidden changes).
export function diffParticipants(existingRows, desiredList) {
  const existingById = new Map(existingRows.map((r) => [r.id, r]));
  const existingByAthleteId = new Map(
    existingRows.filter((r) => r.team_athlete_id).map((r) => [r.team_athlete_id, r])
  );
  const matched = new Set();
  const toInsert = [];
  const toUpdate = [];

  desiredList.forEach((desired, index) => {
    const sortOrder = Number.isFinite(desired.sortOrder) ? desired.sortOrder : index;
    let match = null;

    if (desired.id && existingById.has(desired.id)) {
      match = existingById.get(desired.id);
    } else if (desired.teamAthleteId && existingByAthleteId.has(desired.teamAthleteId)) {
      match = existingByAthleteId.get(desired.teamAthleteId);
    }

    if (match) {
      matched.add(match.id);
      toUpdate.push({
        id: match.id,
        race_group: desired.raceGroup || null,
        sort_order: sortOrder
      });
    } else {
      toInsert.push({
        team_athlete_id: desired.teamAthleteId || null,
        manual_name: desired.teamAthleteId ? null : (desired.manualName || null),
        race_group: desired.raceGroup || null,
        sort_order: sortOrder
      });
    }
  });

  const toDelete = existingRows.filter((r) => !matched.has(r.id)).map((r) => r.id);

  return { toInsert, toUpdate, toDelete };
}

// Decides whether an incoming split payload actually differs from what's
// already stored -- an identical retry of an already-synced split must
// be a true no-op (no new revision row, no revision number bump), which
// is what makes sync genuinely idempotent rather than merely
// non-erroring.
export function splitPayloadChanged(existing, incoming) {
  if (!existing) {
    return true;
  }

  // Postgres `numeric` columns come back through PostgREST as STRINGS
  // (to avoid float precision loss), never JS numbers -- a naive `!==`
  // against a freshly-computed JS number would see every retried sync as
  // "changed" even when nothing actually changed. Comparing as numbers
  // (with null handled explicitly, since a DNS/DNF split's elapsed time
  // is genuinely null, never 0) avoids that false positive.
  const existingElapsed = existing.elapsed_seconds === null || existing.elapsed_seconds === undefined
    ? null
    : Number(existing.elapsed_seconds);
  const incomingElapsed = incoming.elapsedSeconds === null || incoming.elapsedSeconds === undefined
    ? null
    : Number(incoming.elapsedSeconds);
  const elapsedChanged = existingElapsed === null || incomingElapsed === null
    ? existingElapsed !== incomingElapsed
    : Math.abs(existingElapsed - incomingElapsed) > 0.0001;

  // Similarly, two ISO timestamp strings can represent the identical
  // instant without being byte-identical strings (Postgres may return a
  // "+00:00" offset where the client sent "Z", or a different fractional-
  // second length) -- compare as parsed instants, not raw strings.
  const existingMs = existing.wall_clock_captured_at ? Date.parse(existing.wall_clock_captured_at) : null;
  const incomingMs = incoming.wallClockCapturedAt ? Date.parse(incoming.wallClockCapturedAt) : null;
  const capturedAtChanged = existingMs !== incomingMs;

  return (
    elapsedChanged ||
    capturedAtChanged ||
    existing.is_dns !== Boolean(incoming.isDns) ||
    existing.is_dnf !== Boolean(incoming.isDnf)
  );
}

// --- sessions ----------------------------------------------------------------

export async function listSessions({ teamId }) {
  const team = await loadTeam(teamId);

  const { data, error } = await supabaseAdmin
    .from("race_sessions")
    .select("*")
    .eq("team_id", teamId)
    .order("race_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return { team, sessions: data || [] };
}

export async function createSession({ teamId, actor, body }) {
  await loadTeam(teamId);

  const name = cleanText(body.name, 200);
  if (!name) {
    fail("Give this race a name.");
  }

  const distanceMeters = cleanPositiveNumber(body.distance_meters, "Distance");
  const raceDate = cleanDate(body.race_date, "Race date");
  const sport = cleanEnum(body.sport || "cross_country", ["cross_country", "track"], "Sport");
  const distanceUnitDisplay = cleanEnum(
    body.distance_unit_display || "miles",
    ["miles", "km", "meters"],
    "Distance unit"
  );
  const raceType = cleanNullableText(body.race_type, 100);
  const meetId = cleanNullableUuid(body.meet_id, "Meet");
  const checkpointsInput = Array.isArray(body.checkpoints) ? body.checkpoints : [];

  const { data: session, error } = await supabaseAdmin
    .from("race_sessions")
    .insert({
      team_id: teamId,
      created_by_user_id: actor?.userId || null,
      name,
      sport,
      race_type: raceType,
      distance_meters: distanceMeters,
      distance_unit_display: distanceUnitDisplay,
      race_date: raceDate,
      meet_id: meetId,
      status: "draft"
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const checkpointRows = buildCheckpointsWithFinish(distanceMeters, checkpointsInput)
    .map((c) => ({ ...c, race_session_id: session.id }));

  const { data: checkpoints, error: cpError } = await supabaseAdmin
    .from("race_checkpoints")
    .insert(checkpointRows)
    .select("*");

  if (cpError) {
    throw cpError;
  }

  return { session, checkpoints: checkpoints || [] };
}

export async function getSessionDetail({ teamId, sessionId }) {
  const team = await loadTeam(teamId);
  const session = await loadSessionOrFail(teamId, sessionId);
  const checkpoints = await loadCheckpoints(sessionId);

  const [{ data: participants, error: partError }, { data: goals, error: goalError }, { data: targets, error: targetError }] =
    await Promise.all([
      supabaseAdmin.from("race_participants").select("*").eq("race_session_id", sessionId).order("sort_order", { ascending: true }),
      supabaseAdmin.from("race_goals").select("*, race_participants!inner(race_session_id)").eq("race_participants.race_session_id", sessionId),
      supabaseAdmin.from("race_targets").select("*, race_participants!inner(race_session_id)").eq("race_participants.race_session_id", sessionId)
    ]);

  if (partError) throw partError;
  if (goalError) throw goalError;
  if (targetError) throw targetError;

  // Resolves each roster-linked participant's real name via
  // team_athletes -- previously missing entirely (this select("*") never
  // joined team_athletes, so display_name never existed on the row),
  // which made Live Race Mode and Review display "Runner" for every
  // rostered runner. See lib/race_viewer_service.mjs's header comment.
  const namesByParticipantId = await resolveParticipantNames(participants || []);

  return {
    team,
    session,
    checkpoints,
    participants: (participants || []).map((participant) => ({
      ...participant,
      display_name: namesByParticipantId.get(participant.id) || participant.manual_name || "Runner"
    })),
    goals: (goals || []).map(({ race_participants, ...rest }) => rest),
    targets: (targets || []).map(({ race_participants, ...rest }) => rest)
  };
}

export async function updateSessionDetails({ teamId, sessionId, body }) {
  await loadTeam(teamId);
  await loadSessionOrFail(teamId, sessionId);

  const updates = {};
  if (body.name !== undefined) updates.name = cleanText(body.name, 200) || fail("Give this race a name.");
  if (body.race_date !== undefined) updates.race_date = cleanDate(body.race_date, "Race date");
  if (body.race_type !== undefined) updates.race_type = cleanNullableText(body.race_type, 100);
  if (body.meet_id !== undefined) updates.meet_id = cleanNullableUuid(body.meet_id, "Meet");
  if (body.distance_unit_display !== undefined) {
    updates.distance_unit_display = cleanEnum(body.distance_unit_display, ["miles", "km", "meters"], "Distance unit");
  }
  // Coach opt-in, off by default (install/13_GUARDIAN_AND_SPECTATOR_ACCESS.sql).
  // Lets anyone with the /race/?race=<id> link watch this specific race
  // live -- never turned on implicitly.
  if (body.spectator_visible !== undefined) {
    updates.spectator_visible = cleanBoolean(body.spectator_visible);
  }

  const { data, error } = await supabaseAdmin
    .from("race_sessions")
    .update(updates)
    .eq("id", sessionId)
    .eq("team_id", teamId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return { session: data };
}

// Queues a "results" category notification for a spectator_visible race
// going live or finishing -- reaches the existing anonymous
// team_followers/team_follows audience who opted into alert_results
// (see lib/engagement_service.mjs). Never queued for a private race, and
// a notification failure must never fail the race-status transition
// itself, matching how a failed invite email never fails the invite in
// lib/athlete_access_service.mjs.
async function notifyRaceStatus(team, session, kind, createdBy) {
  if (!session.spectator_visible) {
    return;
  }

  const label = kind === "live" ? "is racing live now" : "results are final";
  try {
    await queueTeamNotification({
      teamId: team.id,
      category: "results",
      title: `${session.name} ${label}`,
      summary: team.school_name ? `${team.school_name} -- watch live at /race/?race=${session.id}` : undefined,
      destinationUrl: `/race/?race=${session.id}`,
      sourceType: "race_session",
      sourceId: session.id,
      dedupeKey: `race:${session.id}:${kind}`,
      createdBy
    });
  } catch (notificationError) {
    console.error(`Race ${kind} notification could not be queued.`, notificationError);
  }
}

export async function startRace({ teamId, sessionId, raceStartedAt, createdBy }) {
  const team = await loadTeam(teamId);
  const session = await loadSessionOrFail(teamId, sessionId);

  if (session.status === "live") {
    return { session };
  }
  if (session.status === "finished" || session.status === "reviewed") {
    fail("This race has already finished.", 409);
  }

  const startedAt = cleanIsoTimestamp(raceStartedAt, "Race start time");

  const { data, error } = await supabaseAdmin
    .from("race_sessions")
    .update({ status: "live", race_started_at: startedAt })
    .eq("id", sessionId)
    .eq("team_id", teamId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await notifyRaceStatus(team, data, "live", createdBy);

  return { session: data };
}

export async function finishRace({ teamId, sessionId, createdBy }) {
  const team = await loadTeam(teamId);
  await loadSessionOrFail(teamId, sessionId);

  const { data, error } = await supabaseAdmin
    .from("race_sessions")
    .update({ status: "finished", race_ended_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("team_id", teamId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await notifyRaceStatus(team, data, "finished", createdBy);

  return { session: data };
}

export async function duplicateSession({ teamId, sessionId, actor, raceDate }) {
  await loadTeam(teamId);
  const source = await loadSessionOrFail(teamId, sessionId);
  const checkpoints = await loadCheckpoints(sessionId);

  const { data: session, error } = await supabaseAdmin
    .from("race_sessions")
    .insert({
      team_id: teamId,
      created_by_user_id: actor?.userId || null,
      name: source.name,
      sport: source.sport,
      race_type: source.race_type,
      distance_meters: source.distance_meters,
      distance_unit_display: source.distance_unit_display,
      race_date: cleanDate(raceDate || source.race_date, "Race date"),
      meet_id: null,
      status: "draft",
      duplicated_from_session_id: source.id
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const checkpointRows = checkpoints.map((c) => ({
    race_session_id: session.id,
    label: c.label,
    distance_meters: c.distance_meters,
    sort_order: c.sort_order,
    is_finish: c.is_finish
  }));

  const { data: newCheckpoints, error: cpError } = checkpointRows.length
    ? await supabaseAdmin.from("race_checkpoints").insert(checkpointRows).select("*")
    : { data: [], error: null };

  if (cpError) {
    throw cpError;
  }

  return { session, checkpoints: newCheckpoints || [] };
}

export async function deleteSession({ teamId, sessionId }) {
  await loadTeam(teamId);
  const session = await loadSessionOrFail(teamId, sessionId);

  if (session.status !== "draft") {
    fail("Only a draft race that hasn't started can be deleted.", 409);
  }

  const { error } = await supabaseAdmin.from("race_sessions").delete().eq("id", sessionId).eq("team_id", teamId);
  if (error) {
    throw error;
  }

  return { deleted: true };
}

// --- roster / plan -------------------------------------------------------------

// race_sessions.sport (this file's own enum, see the cleanEnum() call
// around line 340) is only ever "cross_country" or "track" -- Race Command
// Center never distinguishes indoor/outdoor. team_roster_service.mjs's
// team_seasons.sport is a different, Title-Case, three-value enum
// ("Cross Country" / "Indoor Track" / "Outdoor Track"). These two enums
// never share a value in any casing, so a plain .eq("sport", sport) never
// matched a real season -- confirmed directly against production: a real,
// successfully-imported 24-athlete roster was completely invisible here
// before this map. "track" deliberately maps to BOTH track seasons since
// Race Command Center has no way to know which one a coach means.
const RACE_SPORT_TO_SEASON_SPORTS = {
  cross_country: ["Cross Country"],
  track: ["Indoor Track", "Outdoor Track"]
};

export async function listTeamRoster({ teamId, sport = "cross_country" }) {
  await loadTeam(teamId);

  const seasonSports = RACE_SPORT_TO_SEASON_SPORTS[sport] || [sport];

  const { data: seasons, error: seasonError } = await supabaseAdmin
    .from("team_seasons")
    .select("id, name")
    .eq("team_id", teamId)
    .in("sport", seasonSports)
    .eq("is_current", true);

  if (seasonError) {
    throw seasonError;
  }

  const seasonIds = (seasons || []).map((s) => s.id);
  if (seasonIds.length === 0) {
    return { athletes: [] };
  }

  const { data: entries, error: entryError } = await supabaseAdmin
    .from("team_roster_entries")
    .select("athlete_id")
    .in("season_id", seasonIds);

  if (entryError) {
    throw entryError;
  }

  const athleteIds = [...new Set((entries || []).map((e) => e.athlete_id))];
  if (athleteIds.length === 0) {
    return { athletes: [] };
  }

  const { data: athletes, error: athleteError } = await supabaseAdmin
    .from("team_athletes")
    .select("id, first_name, last_name, display_name, graduation_year, gender, status")
    .eq("team_id", teamId)
    .in("id", athleteIds)
    .order("last_name", { ascending: true });

  if (athleteError) {
    throw athleteError;
  }

  return { athletes: (athletes || []).filter((a) => a.status !== "graduated") };
}

export async function saveParticipants({ teamId, sessionId, participants }) {
  await loadTeam(teamId);
  await loadSessionOrFail(teamId, sessionId);

  if (!Array.isArray(participants)) {
    fail("A participant list is required.");
  }

  const desired = participants.map((p, index) => ({
    id: cleanNullableUuid(p.id, "Participant"),
    teamAthleteId: cleanNullableUuid(p.team_athlete_id, "Athlete"),
    manualName: cleanNullableText(p.manual_name, 150),
    raceGroup: cleanNullableText(p.race_group, 100),
    sortOrder: Number.isFinite(Number(p.sort_order)) ? Number(p.sort_order) : index
  }));

  // Only a genuinely NEW participant (no existing row id) must carry an
  // identity (a roster athlete or a manual name) -- an entry that
  // references an existing row by id is just updating that row's
  // race_group/sort_order and doesn't need to resupply identity info
  // that's already stored.
  for (const p of desired) {
    if (!p.id && !p.teamAthleteId && !p.manualName) {
      fail("Every new participant needs either a roster athlete or a manually entered name.");
    }
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("race_participants")
    .select("id, team_athlete_id, manual_name")
    .eq("race_session_id", sessionId);

  if (existingError) {
    throw existingError;
  }

  const { toInsert, toUpdate, toDelete } = diffParticipants(existing || [], desired);

  if (toDelete.length) {
    const { error } = await supabaseAdmin.from("race_participants").delete().in("id", toDelete);
    if (error) throw error;
  }

  for (const update of toUpdate) {
    const { error } = await supabaseAdmin.from("race_participants").update(update).eq("id", update.id);
    if (error) throw error;
  }

  if (toInsert.length) {
    const { error } = await supabaseAdmin
      .from("race_participants")
      .insert(toInsert.map((row) => ({ ...row, race_session_id: sessionId })));
    if (error) throw error;
  }

  const { data: finalParticipants, error: finalError } = await supabaseAdmin
    .from("race_participants")
    .select("*")
    .eq("race_session_id", sessionId)
    .order("sort_order", { ascending: true });

  if (finalError) {
    throw finalError;
  }

  return {
    participants: finalParticipants || [],
    summary: { added: toInsert.length, updated: toUpdate.length, removed: toDelete.length }
  };
}

async function assertParticipantInSession(sessionId, participantId) {
  const { data, error } = await supabaseAdmin
    .from("race_participants")
    .select("id")
    .eq("id", participantId)
    .eq("race_session_id", sessionId)
    .maybeSingle();

  if (error) throw error;
  if (!data) fail("Participant not found in this race.", 404);
}

export async function saveGoals({ teamId, sessionId, participantId, goals }) {
  await loadTeam(teamId);
  await loadSessionOrFail(teamId, sessionId);
  await assertParticipantInSession(sessionId, cleanUuid(participantId, "Participant"));

  if (!Array.isArray(goals) || goals.length === 0) {
    fail("At least one goal (A, B, or C) is required.");
  }

  const cleanedGoals = goals.map((g) => ({
    goal_slot: cleanEnum(g.goal_slot, GOAL_SLOTS, "Goal slot"),
    goal_seconds: cleanPositiveNumber(g.goal_seconds, "Goal time")
  }));

  const slotsPresent = cleanedGoals.map((g) => g.goal_slot);
  const slotsToRemove = GOAL_SLOTS.filter((s) => !slotsPresent.includes(s));

  if (slotsToRemove.length) {
    const { error } = await supabaseAdmin
      .from("race_goals")
      .delete()
      .eq("race_participant_id", participantId)
      .in("goal_slot", slotsToRemove);
    if (error) throw error;
  }

  const { data, error } = await supabaseAdmin
    .from("race_goals")
    .upsert(
      cleanedGoals.map((g) => ({ ...g, race_participant_id: participantId })),
      { onConflict: "race_participant_id,goal_slot" }
    )
    .select("*");

  if (error) {
    throw error;
  }

  return { goals: data || [] };
}

export async function saveStrategy({ teamId, sessionId, participantId, strategy }) {
  await loadTeam(teamId);
  await loadSessionOrFail(teamId, sessionId);
  const cleanedId = cleanUuid(participantId, "Participant");
  await assertParticipantInSession(sessionId, cleanedId);

  const cleanedStrategy = cleanEnum(strategy, ["even_pace", "custom_pace"], "Strategy");

  const { data, error } = await supabaseAdmin
    .from("race_participants")
    .update({ strategy: cleanedStrategy })
    .eq("id", cleanedId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return { participant: data };
}

// Deliberate, explicit status control -- DNS/DNF (and reversing either,
// e.g. a wrong tap corrected before the race starts) via a coach action,
// never inferred automatically. This is distinct from the automatic
// scheduled->started->finished side-effect chain in pushSplits(), which
// only ever moves a runner forward as real splits land.
export async function setParticipantStatus({ teamId, sessionId, participantId, status }) {
  await loadTeam(teamId);
  await loadSessionOrFail(teamId, sessionId);
  const cleanedId = cleanUuid(participantId, "Participant");
  await assertParticipantInSession(sessionId, cleanedId);

  const cleanedStatus = cleanEnum(
    status,
    ["scheduled", "started", "active", "finished", "dns", "dnf"],
    "Status"
  );

  const { data, error } = await supabaseAdmin
    .from("race_participants")
    .update({ status: cleanedStatus })
    .eq("id", cleanedId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return { participant: data };
}

// Saves the per-checkpoint targets for one participant's one goal slot.
// Even Pace computes targets from the already-saved goal time via
// computeEvenPaceTargets(); Custom Pace takes the coach's own entered
// per-checkpoint times, re-validates them as strictly increasing on the
// server (never trusting client-side validation alone), and persists
// them exactly as entered -- and derives the goal time itself from
// whatever the coach put at the finish checkpoint, so race_goals and
// race_targets can never disagree about the finish time.
export async function saveTargets({ teamId, sessionId, participantId, goalSlot, mode, goalSeconds, checkpointSeconds }) {
  await loadTeam(teamId);
  await loadSessionOrFail(teamId, sessionId);
  const cleanedId = cleanUuid(participantId, "Participant");
  await assertParticipantInSession(sessionId, cleanedId);

  const cleanedSlot = cleanEnum(goalSlot, GOAL_SLOTS, "Goal slot");
  const cleanedMode = cleanEnum(mode, ["even_pace", "custom_pace"], "Strategy");
  const checkpoints = await loadCheckpoints(sessionId);

  if (checkpoints.length === 0) {
    fail("This race has no checkpoints yet.");
  }

  const { data: session } = await supabaseAdmin
    .from("race_sessions")
    .select("distance_meters")
    .eq("id", sessionId)
    .single();

  let targetRows;
  let finalGoalSeconds;

  if (cleanedMode === "even_pace") {
    finalGoalSeconds = cleanPositiveNumber(goalSeconds, "Goal time");
    const computed = computeEvenPaceTargets({
      distanceMeters: session.distance_meters,
      goalSeconds: finalGoalSeconds,
      checkpoints: checkpoints.map((c) => ({ id: c.id, distanceMeters: c.distance_meters }))
    });
    targetRows = computed.map((t) => ({
      race_participant_id: cleanedId,
      race_checkpoint_id: t.checkpointId,
      goal_slot: cleanedSlot,
      target_elapsed_seconds: t.cumulativeSeconds
    }));
  } else {
    if (!Array.isArray(checkpointSeconds) || checkpointSeconds.length !== checkpoints.length) {
      fail("A target time is required for every checkpoint.");
    }
    const seconds = checkpointSeconds.map((v) => Number(v));
    const validation = validateCustomPaceTargets(seconds);
    if (!validation.valid) {
      fail(
        `Checkpoint target times must strictly increase (problem at checkpoint ${validation.firstInvalidIndex + 1}).`,
        400,
        "invalid_custom_targets"
      );
    }
    targetRows = checkpoints.map((c, index) => ({
      race_participant_id: cleanedId,
      race_checkpoint_id: c.id,
      goal_slot: cleanedSlot,
      target_elapsed_seconds: seconds[index]
    }));
    finalGoalSeconds = seconds[seconds.length - 1];
  }

  const { data, error } = await supabaseAdmin
    .from("race_targets")
    .upsert(targetRows, { onConflict: "race_participant_id,race_checkpoint_id,goal_slot" })
    .select("*");

  if (error) {
    throw error;
  }

  const { error: goalError } = await supabaseAdmin
    .from("race_goals")
    .upsert(
      [{ race_participant_id: cleanedId, goal_slot: cleanedSlot, goal_seconds: finalGoalSeconds }],
      { onConflict: "race_participant_id,goal_slot" }
    );

  if (goalError) {
    throw goalError;
  }

  return { targets: data || [], goal_seconds: finalGoalSeconds };
}

// Applies the same goal time (and resulting Even Pace targets) to several
// participants in one action, and always returns the complete resulting
// state for every participant touched so the UI can show an
// immediately-understandable "here's exactly what changed" summary,
// never a silent bulk change.
export async function bulkApplyGoal({ teamId, sessionId, participantIds, goalSlot, goalSeconds }) {
  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    fail("Select at least one participant.");
  }

  const results = [];
  for (const participantId of participantIds) {
    const result = await saveTargets({
      teamId,
      sessionId,
      participantId,
      goalSlot,
      mode: "even_pace",
      goalSeconds
    });
    results.push({ participant_id: participantId, ...result });
  }

  return { results };
}

// --- sync ------------------------------------------------------------------

export async function createPackCapture({ teamId, sessionId, checkpointId, capturedAt, deviceId }) {
  await loadTeam(teamId);
  await loadSessionOrFail(teamId, sessionId);
  const cleanedCheckpointId = cleanUuid(checkpointId, "Checkpoint");

  const { data, error } = await supabaseAdmin
    .from("race_pack_captures")
    .insert({
      race_session_id: sessionId,
      race_checkpoint_id: cleanedCheckpointId,
      captured_wall_clock_at: cleanIsoTimestamp(capturedAt, "Capture time"),
      device_id: cleanNullableText(deviceId, 100)
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return { pack_capture: data };
}

// Upserts every split by its client-minted client_split_id -- always
// safe to retry. Only writes a new race_split_revisions row (and bumps
// the split's revision counter) when the incoming payload actually
// differs from what's already stored, so a retried, byte-identical sync
// is a true no-op rather than fabricated correction history.
export async function pushSplits({ teamId, sessionId, splits }) {
  await loadTeam(teamId);
  await loadSessionOrFail(teamId, sessionId);

  if (!Array.isArray(splits) || splits.length === 0) {
    fail("At least one split is required.");
  }

  // Both participant and checkpoint must genuinely belong to THIS
  // session -- their foreign keys alone only guarantee they exist
  // somewhere, not that they're scoped to this race, which would
  // otherwise let a split be attributed to the wrong session.
  const [{ data: sessionParticipants, error: participantsError }, checkpoints] = await Promise.all([
    supabaseAdmin.from("race_participants").select("id, status").eq("race_session_id", sessionId),
    loadCheckpoints(sessionId)
  ]);
  if (participantsError) throw participantsError;

  const participantsById = new Map((sessionParticipants || []).map((p) => [p.id, p]));
  const checkpointsById = new Map(checkpoints.map((c) => [c.id, c]));

  const clientSplitIds = splits.map((s) => cleanText(s.client_split_id, 100));
  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from("race_splits")
    .select("*")
    .in("client_split_id", clientSplitIds);

  if (existingError) {
    throw existingError;
  }

  const existingByClientId = new Map((existingRows || []).map((r) => [r.client_split_id, r]));
  const results = [];
  // Tracks the participant status this call should end with, applied
  // once per participant after the loop so multiple splits for the same
  // runner in one push never fight each other over status.
  const statusUpdates = new Map();

  for (const raw of splits) {
    const clientSplitId = cleanText(raw.client_split_id, 100);
    if (!/^pw_rcc_[a-zA-Z0-9._-]{16,80}$/.test(clientSplitId)) {
      fail(`Invalid split id: ${clientSplitId}`);
    }

    const incoming = {
      raceParticipantId: cleanUuid(raw.race_participant_id, "Participant"),
      raceCheckpointId: cleanUuid(raw.race_checkpoint_id, "Checkpoint"),
      elapsedSeconds: cleanNonNegativeNumberOrNull(raw.elapsed_seconds, "Elapsed time"),
      wallClockCapturedAt: cleanIsoTimestamp(raw.wall_clock_captured_at, "Capture time"),
      captureMethod: cleanEnum(raw.capture_method, CAPTURE_METHODS, "Capture method"),
      packCaptureId: cleanNullableUuid(raw.pack_capture_id, "Pack capture"),
      deviceId: cleanNullableText(raw.device_id, 100),
      isDns: cleanBoolean(raw.is_dns),
      isDnf: cleanBoolean(raw.is_dnf),
      changeReason: raw.change_reason ? cleanEnum(raw.change_reason, CHANGE_REASONS, "Change reason") : "recorded"
    };

    const participant = participantsById.get(incoming.raceParticipantId);
    if (!participant) {
      fail(`Participant ${incoming.raceParticipantId} is not in this race.`, 404);
    }
    const checkpoint = checkpointsById.get(incoming.raceCheckpointId);
    if (!checkpoint) {
      fail(`Checkpoint ${incoming.raceCheckpointId} is not in this race.`, 404);
    }

    const existing = existingByClientId.get(clientSplitId);
    const changed = splitPayloadChanged(existing, incoming);

    if (!changed && existing) {
      results.push({ client_split_id: clientSplitId, split: existing, revision_written: false });
      continue;
    }

    const nextRevision = existing ? existing.revision + 1 : 1;

    const { data: split, error } = await supabaseAdmin
      .from("race_splits")
      .upsert(
        {
          client_split_id: clientSplitId,
          race_session_id: sessionId,
          race_participant_id: incoming.raceParticipantId,
          race_checkpoint_id: incoming.raceCheckpointId,
          elapsed_seconds: incoming.elapsedSeconds,
          wall_clock_captured_at: incoming.wallClockCapturedAt,
          capture_method: incoming.captureMethod,
          pack_capture_id: incoming.packCaptureId,
          device_id: incoming.deviceId,
          is_dns: incoming.isDns,
          is_dnf: incoming.isDnf,
          revision: nextRevision
        },
        { onConflict: "client_split_id" }
      )
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    const { error: revisionError } = await supabaseAdmin.from("race_split_revisions").insert({
      race_split_id: split.id,
      revision: nextRevision,
      elapsed_seconds: incoming.elapsedSeconds,
      wall_clock_captured_at: incoming.wallClockCapturedAt,
      capture_method: incoming.captureMethod,
      change_reason: existing ? incoming.changeReason : "recorded",
      device_id: incoming.deviceId
    });

    if (revisionError) {
      throw revisionError;
    }

    results.push({ client_split_id: clientSplitId, split, revision_written: true });

    // Defined side-effect chain for a real (non-DNS/DNF, non-undo) split:
    // the finish checkpoint marks a runner finished; any other checkpoint
    // advances a runner to "started". A cleared split (Undo --
    // elapsed_seconds null, change_reason 'undo') never changes status on
    // its own. Note this only records INTENT here -- see below for why
    // the actual write is a guarded, atomic conditional update rather
    // than trusting this function's own in-memory participant snapshot.
    if (incoming.elapsedSeconds !== null && !incoming.isDns && !incoming.isDnf) {
      if (checkpoint.is_finish) {
        statusUpdates.set(incoming.raceParticipantId, "finished");
      } else if (statusUpdates.get(incoming.raceParticipantId) !== "finished") {
        statusUpdates.set(incoming.raceParticipantId, "started");
      }
    }
  }

  // These writes are deliberately ATOMIC, GUARDED conditional updates --
  // never a plain "read participant.status earlier, then write" -- because
  // this function can be called concurrently (a background sync retry
  // racing a coach's explicit DNS/DNF call, for example), and an
  // in-memory status snapshot taken at the top of this call can be stale
  // by the time this write actually runs. A live bug was caught exactly
  // this way: a delayed/retried split push silently reverted an explicit
  // DNF back to "started" because it trusted a stale snapshot instead of
  // asking the database "is this still true right now?".
  for (const [participantId, status] of statusUpdates) {
    let query = supabaseAdmin.from("race_participants").update({ status }).eq("id", participantId);

    if (status === "started") {
      // Only advances a runner still genuinely at the starting point --
      // never downgrades a runner already started/finished/dns/dnf.
      query = query.eq("status", "scheduled");
    } else if (status === "finished") {
      // Never silently overwrites an explicit DNS/DNF call with an
      // automatic finish-checkpoint side effect.
      query = query.not("status", "in", "(dns,dnf)");
    }

    const { error: statusError } = await query;
    if (statusError) {
      throw statusError;
    }
  }

  return { results };
}

export async function pullState({ teamId, sessionId }) {
  const detail = await getSessionDetail({ teamId, sessionId });

  const { data: splits, error } = await supabaseAdmin
    .from("race_splits")
    .select("*")
    .eq("race_session_id", sessionId);

  if (error) {
    throw error;
  }

  return { ...detail, splits: splits || [] };
}

// --- review ------------------------------------------------------------------
// Deliberately computed on demand, never stored -- see
// install/11_RACE_COMMAND_CENTER.sql's header comment.

export async function getIndividualReview({ teamId, sessionId, participantId }) {
  const detail = await pullState({ teamId, sessionId });
  const cleanedId = cleanUuid(participantId, "Participant");
  const participant = detail.participants.find((p) => p.id === cleanedId);

  if (!participant) {
    fail("Participant not found in this race.", 404);
  }

  const targets = detail.targets.filter((t) => t.race_participant_id === cleanedId);
  const splits = detail.splits.filter((s) => s.race_participant_id === cleanedId);
  const goals = detail.goals.filter((g) => g.race_participant_id === cleanedId);

  const checkpointRows = detail.checkpoints.map((checkpoint) => {
    const split = splits.find((s) => s.race_checkpoint_id === checkpoint.id) || null;
    const targetsForCheckpoint = GOAL_SLOTS.reduce((acc, slot) => {
      const t = targets.find((tg) => tg.race_checkpoint_id === checkpoint.id && tg.goal_slot === slot);
      if (t) acc[slot] = t.target_elapsed_seconds;
      return acc;
    }, {});

    return {
      checkpoint,
      split,
      targets: targetsForCheckpoint
    };
  });

  return { participant, goals, checkpoints: checkpointRows };
}

export async function getTeamReview({ teamId, sessionId }) {
  const detail = await pullState({ teamId, sessionId });
  const finishCheckpoint = detail.checkpoints.find((c) => c.is_finish);

  const rows = detail.participants.map((participant) => {
    const finishSplit = finishCheckpoint
      ? detail.splits.find((s) => s.race_participant_id === participant.id && s.race_checkpoint_id === finishCheckpoint.id)
      : null;
    const goalA = detail.goals.find((g) => g.race_participant_id === participant.id && g.goal_slot === "A");
    const targetA = finishCheckpoint
      ? detail.targets.find((t) => t.race_participant_id === participant.id && t.race_checkpoint_id === finishCheckpoint.id && t.goal_slot === "A")
      : null;

    return {
      participant,
      finish_elapsed_seconds: finishSplit ? finishSplit.elapsed_seconds : null,
      goal_a_seconds: goalA ? goalA.goal_seconds : null,
      target_a_at_finish: targetA ? targetA.target_elapsed_seconds : null
    };
  });

  return { rows };
}
