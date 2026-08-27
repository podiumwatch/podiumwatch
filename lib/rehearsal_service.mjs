// Split Watch Rehearsal Mode (race day build plan, Project 1). A
// rehearsal is a genuinely separate race_sessions row (is_rehearsal:
// true, rehearsal_of_session_id pointing back at the real race), not a
// shared-row "environment" flag -- see
// install/25_SPLIT_WATCH_REHEARSAL_MODE.sql's header comment for why.
// Every existing timing function in lib/split_watch_service.mjs
// (startRace, finishRace, restartRace, pushSplits, pullState,
// getSessionDetail) is reused completely unchanged for a rehearsal row --
// they already just operate on a sessionId + teamId with no idea, or
// need to know, whether that id is official or practice.
//
// Every function here is scoped by an explicit teamId, matching every
// other Split Watch service file's own convention.
import { supabaseAdmin } from "./supabase-admin.mjs";
import { loadTeam } from "./split_watch_service.mjs";

function fail(message, status = 400, code = "") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  throw error;
}

async function loadSourceSessionOrFail(teamId, sourceSessionId) {
  const { data, error } = await supabaseAdmin
    .from("race_sessions")
    .select("*")
    .eq("id", sourceSessionId)
    .eq("team_id", teamId)
    .maybeSingle();
  if (error) throw error;
  if (!data) fail("Race not found.", 404);
  // A rehearsal's own source must always be a real, official race --
  // never another practice run. This keeps rehearsal_of_session_id a
  // one-level pointer, never a chain, and matches the product's own
  // framing: you practice a race, you don't practice a practice.
  if (data.is_rehearsal) fail("This race is itself a rehearsal -- rehearsals cannot be rehearsed.", 400);
  return data;
}

// The single currently-active (non-cancelled) rehearsal for a source
// race, if one exists. Only ever one at a time by construction -- a
// reset cancels the old one before a new one is created.
async function loadActiveRehearsal(teamId, sourceSessionId) {
  const { data, error } = await supabaseAdmin
    .from("race_sessions")
    .select("*")
    .eq("team_id", teamId)
    .eq("rehearsal_of_session_id", sourceSessionId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Full plan snapshot -- checkpoints, participants, goals, and per-
// checkpoint targets -- copied fresh from the source race into a new
// row. duplicateSession() in split_watch_service.mjs already copies
// checkpoints alone, for a completely different purpose (planning a
// similar meet next week, tracked by its own duplicated_from_session_id
// column) -- a rehearsal additionally needs the SAME roster and goals
// the coach already planned, so practice actually exercises the real
// day's participant list, not an empty one.
async function copyPlanIntoNewSession({ sourceSessionId, newSessionId }) {
  const [{ data: checkpoints, error: cpErr }, { data: participants, error: partErr }] = await Promise.all([
    supabaseAdmin.from("race_checkpoints").select("*").eq("race_session_id", sourceSessionId).order("sort_order", { ascending: true }),
    supabaseAdmin.from("race_participants").select("*").eq("race_session_id", sourceSessionId).order("sort_order", { ascending: true })
  ]);
  if (cpErr) throw cpErr;
  if (partErr) throw partErr;

  const checkpointRows = (checkpoints || []).map((c) => ({
    race_session_id: newSessionId,
    label: c.label,
    distance_meters: c.distance_meters,
    sort_order: c.sort_order,
    is_finish: c.is_finish
  }));
  const { data: newCheckpoints, error: cpInsertErr } = checkpointRows.length
    ? await supabaseAdmin.from("race_checkpoints").insert(checkpointRows).select("*").order("sort_order", { ascending: true })
    : { data: [], error: null };
  if (cpInsertErr) throw cpInsertErr;

  // Old checkpoint id -> new checkpoint id, needed to remap race_targets
  // below -- both lists are ordered by sort_order, so position i in one
  // always corresponds to position i in the other.
  const checkpointIdMap = new Map((checkpoints || []).map((c, i) => [c.id, (newCheckpoints || [])[i]?.id]));

  const participantRows = (participants || []).map((p) => ({
    race_session_id: newSessionId,
    team_athlete_id: p.team_athlete_id,
    manual_name: p.manual_name,
    race_group: p.race_group,
    // Always a clean "scheduled" start regardless of the source's own
    // current per-participant status -- a rehearsal is a fresh attempt,
    // never a copy of whatever runtime state the source happens to be in.
    status: "scheduled",
    strategy: p.strategy,
    sort_order: p.sort_order
  }));
  const { data: newParticipants, error: partInsertErr } = participantRows.length
    ? await supabaseAdmin.from("race_participants").insert(participantRows).select("*").order("sort_order", { ascending: true })
    : { data: [], error: null };
  if (partInsertErr) throw partInsertErr;

  const participantIdMap = new Map((participants || []).map((p, i) => [p.id, (newParticipants || [])[i]?.id]));
  const oldParticipantIds = (participants || []).map((p) => p.id);

  if (oldParticipantIds.length === 0) {
    return { checkpoints: newCheckpoints || [], participants: newParticipants || [] };
  }

  const [{ data: goals, error: goalErr }, { data: targets, error: targetErr }] = await Promise.all([
    supabaseAdmin.from("race_goals").select("*").in("race_participant_id", oldParticipantIds),
    supabaseAdmin.from("race_targets").select("*").in("race_participant_id", oldParticipantIds)
  ]);
  if (goalErr) throw goalErr;
  if (targetErr) throw targetErr;

  const goalRows = (goals || [])
    .map((g) => ({
      race_participant_id: participantIdMap.get(g.race_participant_id),
      goal_slot: g.goal_slot,
      goal_seconds: g.goal_seconds
    }))
    .filter((g) => g.race_participant_id);
  if (goalRows.length) {
    const { error } = await supabaseAdmin.from("race_goals").insert(goalRows);
    if (error) throw error;
  }

  const targetRows = (targets || [])
    .map((t) => ({
      race_participant_id: participantIdMap.get(t.race_participant_id),
      race_checkpoint_id: checkpointIdMap.get(t.race_checkpoint_id),
      goal_slot: t.goal_slot,
      target_elapsed_seconds: t.target_elapsed_seconds
    }))
    .filter((t) => t.race_participant_id && t.race_checkpoint_id);
  if (targetRows.length) {
    const { error } = await supabaseAdmin.from("race_targets").insert(targetRows);
    if (error) throw error;
  }

  return { checkpoints: newCheckpoints || [], participants: newParticipants || [] };
}

// The coach's "Practice This Race" entry point. Resumes an already
// in-progress rehearsal if one exists (so leaving and returning finds
// the same practice run, per the product spec); otherwise builds a
// brand-new rehearsal row from the source race's CURRENT plan.
export async function getOrCreateActiveRehearsal({ teamId, sourceSessionId, actor }) {
  await loadTeam(teamId);
  const source = await loadSourceSessionOrFail(teamId, sourceSessionId);

  // Rehearsal only makes sense before the real race has actually begun --
  // once it's live, finished, reviewed, or cancelled, "practicing" it no
  // longer fits the "test the night before" purpose it exists for.
  if (source.status !== "draft" && source.status !== "scheduled") {
    fail("Rehearsal is only available while this race is still being prepared, before it goes live.", 409);
  }

  const existing = await loadActiveRehearsal(teamId, sourceSessionId);
  if (existing) {
    return { session: existing, resumed: true };
  }

  const { data: rehearsal, error } = await supabaseAdmin
    .from("race_sessions")
    .insert({
      team_id: teamId,
      created_by_user_id: actor?.userId || null,
      name: source.name,
      sport: source.sport,
      race_type: source.race_type,
      distance_meters: source.distance_meters,
      distance_unit_display: source.distance_unit_display,
      race_date: source.race_date,
      meet_id: null,
      status: "draft",
      is_rehearsal: true,
      rehearsal_of_session_id: source.id
    })
    .select("*")
    .single();
  if (error) throw error;

  await copyPlanIntoNewSession({ sourceSessionId: source.id, newSessionId: rehearsal.id });

  return { session: rehearsal, resumed: false };
}

// "Reset Rehearsal": archives the current rehearsal (cancelled, never
// deleted -- its clock and splits stay exactly as they were, just no
// longer the active attempt) and creates a genuinely new row for the
// next attempt. A fresh session id, not an in-place restart, is what
// actually makes this safe: no device's local cache can ever confuse
// the new attempt with the old one, because they are different ids,
// not just different data under the same id.
export async function resetRehearsal({ teamId, rehearsalSessionId, actor }) {
  await loadTeam(teamId);

  const { data: rehearsal, error } = await supabaseAdmin
    .from("race_sessions")
    .select("*")
    .eq("id", rehearsalSessionId)
    .eq("team_id", teamId)
    .maybeSingle();
  if (error) throw error;
  if (!rehearsal) fail("Rehearsal not found.", 404);
  if (!rehearsal.is_rehearsal) fail("Only a rehearsal can be reset through this action.", 400);

  const { error: archiveError } = await supabaseAdmin
    .from("race_sessions")
    .update({ status: "cancelled" })
    .eq("id", rehearsal.id)
    .eq("team_id", teamId);
  if (archiveError) throw archiveError;

  return getOrCreateActiveRehearsal({ teamId, sourceSessionId: rehearsal.rehearsal_of_session_id, actor });
}

// Powers the Plan page's "Rehearsal completed yesterday at 7:42 PM" /
// "Rehearsal setup has changed since your last practice" status line.
export async function getRehearsalStatus({ teamId, sourceSessionId }) {
  await loadTeam(teamId);
  const source = await loadSourceSessionOrFail(teamId, sourceSessionId);
  const rehearsal = await loadActiveRehearsal(teamId, sourceSessionId);

  if (!rehearsal) {
    return { has_rehearsal: false };
  }

  // "Outdated" means the source plan's own timing-relevant shape --
  // roster size or race distance -- has changed since this rehearsal
  // was created. Deliberately narrow: a coach fixing a typo in a
  // runner's name should not invalidate a completed rehearsal, but
  // adding or removing a runner, or changing the distance, genuinely
  // could change what timing this race actually needs.
  const [{ count: currentParticipantCount }, { count: rehearsalParticipantCount }] = await Promise.all([
    supabaseAdmin.from("race_participants").select("id", { count: "exact", head: true }).eq("race_session_id", source.id),
    supabaseAdmin.from("race_participants").select("id", { count: "exact", head: true }).eq("race_session_id", rehearsal.id)
  ]);

  const outdated =
    source.distance_meters !== rehearsal.distance_meters ||
    (currentParticipantCount || 0) !== (rehearsalParticipantCount || 0);

  return {
    has_rehearsal: true,
    session_id: rehearsal.id,
    status: rehearsal.status,
    race_started_at: rehearsal.race_started_at,
    race_ended_at: rehearsal.race_ended_at,
    created_at: rehearsal.created_at,
    outdated
  };
}
