// Timing Crew system (race day build plan, Project 3). A coach-defined
// list of timing positions for one race (install/27_SPLIT_WATCH_TIMING_
// CREW.sql's race_positions), plus the helper-facing self-assignment
// flow and the coach-facing crew panel (one card per connected helper:
// name, position, presence, reassign, revoke).
//
// Deliberately NOT a parallel authorization system: a race_day_sessions
// row is still the one and only helper credential (lib/race_day_auth.mjs),
// exactly as before Project 3. This file only adds what that row is
// ASSIGNED to (a position, in a specific race) and who it belongs to (a
// display name) -- lib/race_day_auth.mjs is still the only place that
// decides whether a request is authorized at all.
import { supabaseAdmin } from "./supabase-admin.mjs";
import { loadTeam } from "./split_watch_service.mjs";

function fail(message, status = 400, code = "") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  throw error;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanUuid(value, label) {
  const cleaned = String(value ?? "").trim();
  if (!UUID_PATTERN.test(cleaned)) fail(`${label} is invalid.`);
  return cleaned;
}

function cleanNullableUuid(value, label) {
  if (value === undefined || value === null || value === "") return null;
  return cleanUuid(value, label);
}

function cleanText(value, maxLength = 200) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

const CAPABILITIES = ["checkpoint", "pack_capture", "backup"];

function cleanCapability(value) {
  const cleaned = String(value ?? "checkpoint").trim();
  if (!CAPABILITIES.includes(cleaned)) fail("Capability must be checkpoint, pack_capture, or backup.");
  return cleaned;
}

async function loadPositionOrFail(teamId, positionId) {
  const { data, error } = await supabaseAdmin
    .from("race_positions")
    .select("*, race_sessions!inner(team_id)")
    .eq("id", positionId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.race_sessions.team_id !== teamId) fail("Position not found.", 404);
  const { race_sessions, ...position } = data;
  return position;
}

// --- coach: position setup -------------------------------------------------

export async function listPositions({ teamId, sessionId }) {
  await loadTeam(teamId);
  const { data, error } = await supabaseAdmin
    .from("race_positions")
    .select("*")
    .eq("race_session_id", sessionId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return { positions: data || [] };
}

// Every position a race has at all, across every session for a team --
// used by lib/race_day_auth.mjs to decide, cheaply, whether checkpoint-
// scoped enforcement applies to a given race at all (a race with zero
// positions stays fully open, matching every race before this project).
export async function sessionHasPositions(sessionId) {
  const { count, error } = await supabaseAdmin
    .from("race_positions")
    .select("id", { count: "exact", head: true })
    .eq("race_session_id", sessionId);
  if (error) throw error;
  return (count || 0) > 0;
}

export async function createPosition({ teamId, sessionId, label, checkpointId, capability, instructions }) {
  await loadTeam(teamId);

  const cleanedLabel = cleanText(label, 120) || fail("Give this position a label.");
  const cleanedCapability = cleanCapability(capability);
  const cleanedCheckpointId = cleanNullableUuid(checkpointId, "Checkpoint");

  if (cleanedCapability !== "backup" && !cleanedCheckpointId) {
    fail("Choose a checkpoint for this position, or use Backup timer for no fixed checkpoint.");
  }

  if (cleanedCheckpointId) {
    const { data: checkpoint, error: cpError } = await supabaseAdmin
      .from("race_checkpoints")
      .select("id, race_session_id")
      .eq("id", cleanedCheckpointId)
      .maybeSingle();
    if (cpError) throw cpError;
    if (!checkpoint || checkpoint.race_session_id !== sessionId) fail("That checkpoint isn't part of this race.", 404);
  }

  const { count } = await supabaseAdmin
    .from("race_positions")
    .select("id", { count: "exact", head: true })
    .eq("race_session_id", sessionId);

  const { data, error } = await supabaseAdmin
    .from("race_positions")
    .insert({
      race_session_id: sessionId,
      label: cleanedLabel,
      race_checkpoint_id: cleanedCheckpointId,
      capability: cleanedCapability,
      instructions: cleanText(instructions, 500) || null,
      sort_order: count || 0
    })
    .select("*")
    .single();
  if (error) throw error;
  return { position: data };
}

export async function updatePosition({ teamId, positionId, label, checkpointId, capability, instructions }) {
  await loadTeam(teamId);
  const existing = await loadPositionOrFail(teamId, positionId);

  const updates = {};
  if (label !== undefined) updates.label = cleanText(label, 120) || fail("Give this position a label.");
  if (capability !== undefined) updates.capability = cleanCapability(capability);
  if (checkpointId !== undefined) {
    const cleanedCheckpointId = cleanNullableUuid(checkpointId, "Checkpoint");
    if (cleanedCheckpointId) {
      const { data: checkpoint, error: cpError } = await supabaseAdmin
        .from("race_checkpoints")
        .select("id, race_session_id")
        .eq("id", cleanedCheckpointId)
        .maybeSingle();
      if (cpError) throw cpError;
      if (!checkpoint || checkpoint.race_session_id !== existing.race_session_id) fail("That checkpoint isn't part of this race.", 404);
    }
    updates.race_checkpoint_id = cleanedCheckpointId;
  }
  if (instructions !== undefined) updates.instructions = cleanText(instructions, 500) || null;

  const finalCapability = updates.capability || existing.capability;
  const finalCheckpointId = updates.race_checkpoint_id !== undefined ? updates.race_checkpoint_id : existing.race_checkpoint_id;
  if (finalCapability !== "backup" && !finalCheckpointId) {
    fail("Choose a checkpoint for this position, or use Backup timer for no fixed checkpoint.");
  }

  const { data, error } = await supabaseAdmin
    .from("race_positions")
    .update(updates)
    .eq("id", positionId)
    .select("*")
    .single();
  if (error) throw error;
  return { position: data };
}

// Closing a position never touches whoever was assigned to it as a
// PERSON -- their race_day_sessions row simply loses its position
// reference (on delete set null) and falls back to "waiting to be
// assigned," the same state a helper starts in before ever being given
// one. Their access itself is untouched; only revoke actually ends it.
export async function deletePosition({ teamId, positionId }) {
  await loadTeam(teamId);
  await loadPositionOrFail(teamId, positionId);
  const { error } = await supabaseAdmin.from("race_positions").delete().eq("id", positionId);
  if (error) throw error;
  return { deleted: true };
}

// --- coach: the crew panel -------------------------------------------------

const CONNECTED_THRESHOLD_MS = 90 * 1000;
const RECENT_THRESHOLD_MS = 10 * 60 * 1000;

// Presence is a recent-communication estimate, never proof of physical
// location (spec, "Presence behavior") -- pure so it's directly unit
// testable (scripts/test-timing-crew.mjs) without a database or a clock
// mock beyond passing `now` in.
export function presenceLabel(lastSeenAt, { revoked = false, now = Date.now() } = {}) {
  if (revoked) return "Access revoked";
  if (!lastSeenAt) return "Not connected yet";
  const ageMs = now - new Date(lastSeenAt).getTime();
  if (ageMs < 0) return "Connected now";
  if (ageMs < CONNECTED_THRESHOLD_MS) return "Connected now";
  if (ageMs < RECENT_THRESHOLD_MS) {
    const minutes = Math.max(1, Math.round(ageMs / 60000));
    return `Last seen ${minutes} min ago`;
  }
  return "Offline, captures stored locally";
}

export async function listCrew({ teamId, sessionId }) {
  await loadTeam(teamId);

  const [{ data: helpers, error: helperError }, { data: positions, error: positionError }] = await Promise.all([
    supabaseAdmin
      .from("race_day_sessions")
      .select("id, display_name, race_position_id, last_seen_at, revoked_at, expires_at, created_at")
      .eq("race_session_id", sessionId)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString()),
    supabaseAdmin
      .from("race_positions")
      .select("*")
      .eq("race_session_id", sessionId)
      .order("sort_order", { ascending: true })
  ]);
  if (helperError) throw helperError;
  if (positionError) throw positionError;

  const helpersByPosition = new Map();
  const unassignedHelpers = [];
  for (const helper of helpers || []) {
    const withPresence = { ...helper, presence: presenceLabel(helper.last_seen_at, { revoked: false }) };
    if (helper.race_position_id) {
      helpersByPosition.set(helper.race_position_id, withPresence);
    } else {
      unassignedHelpers.push(withPresence);
    }
  }

  return {
    positions: (positions || []).map((position) => ({
      ...position,
      helper: helpersByPosition.get(position.id) || null
    })),
    waitingHelpers: unassignedHelpers
  };
}

export async function reassignHelper({ teamId, raceDaySessionId, positionId }) {
  await loadTeam(teamId);

  const { data: helper, error: helperError } = await supabaseAdmin
    .from("race_day_sessions")
    .select("id, team_id, race_session_id")
    .eq("id", raceDaySessionId)
    .maybeSingle();
  if (helperError) throw helperError;
  if (!helper || helper.team_id !== teamId) fail("Helper not found.", 404);

  const cleanedPositionId = cleanNullableUuid(positionId, "Position");
  if (cleanedPositionId) {
    const position = await loadPositionOrFail(teamId, cleanedPositionId);
    if (position.race_session_id !== helper.race_session_id) {
      fail("That position belongs to a different race.", 409);
    }
  }

  const { data, error } = await supabaseAdmin
    .from("race_day_sessions")
    .update({ race_position_id: cleanedPositionId })
    .eq("id", raceDaySessionId)
    .select("id, display_name, race_position_id")
    .single();
  if (error) throw error;
  return { helper: data };
}

// Ends ONE helper's access -- every other active session for the team
// is untouched. Their already-confirmed captures stay exactly as
// recorded (revoking is not a delete of anything they already did);
// this only stops FUTURE requests from that session (lib/race_day_auth.mjs's
// resolveRaceDaySession() must treat revoked_at as equivalent to expired).
export async function revokeHelper({ teamId, raceDaySessionId }) {
  await loadTeam(teamId);

  const { data: helper, error: helperError } = await supabaseAdmin
    .from("race_day_sessions")
    .select("id, team_id")
    .eq("id", raceDaySessionId)
    .maybeSingle();
  if (helperError) throw helperError;
  if (!helper || helper.team_id !== teamId) fail("Helper not found.", 404);

  const { error } = await supabaseAdmin
    .from("race_day_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", raceDaySessionId);
  if (error) throw error;
  return { revoked: true };
}

// --- helper: the self-service assignment step (join.js's confirm_position) -

// Called with the ALREADY-resolved race_day_sessions row (the caller
// authenticates via the race-day cookie, not a coach account, and passes
// in whatever resolveRaceDaySession() already found -- this function
// never re-derives identity, it only acts on the session it's handed).
export async function confirmHelperPosition({ raceDaySession, teamId, sessionId, positionId, displayName }) {
  if (raceDaySession.team_id !== teamId) fail("This code isn't valid for that team.", 403);

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("race_sessions")
    .select("id, team_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError) throw sessionError;
  if (!session || session.team_id !== teamId) fail("Race not found.", 404);

  const cleanedPositionId = cleanNullableUuid(positionId, "Position");
  if (cleanedPositionId) {
    const { data: position, error: positionError } = await supabaseAdmin
      .from("race_positions")
      .select("id, race_session_id")
      .eq("id", cleanedPositionId)
      .maybeSingle();
    if (positionError) throw positionError;
    if (!position || position.race_session_id !== sessionId) fail("That position isn't part of this race.", 404);
  }

  const cleanedName = cleanText(displayName, 80) || fail("Enter your name so the coach knows who's timing.");

  const { data, error } = await supabaseAdmin
    .from("race_day_sessions")
    .update({
      display_name: cleanedName,
      race_session_id: sessionId,
      race_position_id: cleanedPositionId
    })
    .eq("id", raceDaySession.id)
    .select("id, display_name, race_session_id, race_position_id")
    .single();
  if (error) throw error;
  return { helper: data };
}
