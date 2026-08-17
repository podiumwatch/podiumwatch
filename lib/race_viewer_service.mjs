// Shared "who gets to see what" projection for Race Command Center data
// (Team Workspace Phase Three). Three different read paths each need a
// different slice of the same underlying tables:
//   - Athlete tier (lib/athlete_access_service.mjs): an athlete's own
//     goals/targets/splits across every race they're rostered in.
//   - Guardian tier (lib/guardian_access_service.mjs): identical to the
//     Athlete tier for a guardian's own linked athlete(s), plus the
//     full spectator-safe leaderboard for a race once the coach has
//     turned race_sessions.spectator_visible on.
//   - Anonymous/spectator tier (api/race/public.js): checkpoints, real
//     participant names, and times only for a single spectator_visible
//     race -- never goals, targets, coach notes, or any internal/device
//     column.
//
// Centralizing this here (rather than each caller writing its own
// select("*")) fixes two real, confirmed problems in one place:
//   1. lib/athlete_access_service.mjs's getAthleteRaces() previously did
//      select("*") on race_sessions/race_goals/race_targets/race_splits/
//      race_checkpoints, over-exposing internal columns (device_id,
//      created_by_user_id, client_split_id, unbounded metadata) to an
//      athlete's own browser.
//   2. lib/race_command_center_service.mjs's getSessionDetail() did
//      select("*") on race_participants with no join back to
//      team_athletes, so display_name never existed on the row -- every
//      roster-linked participant showed as "Runner" on the coach's own
//      Live Race Mode and Review pages. resolveParticipantNames() below
//      is the fix, used both by this module and directly by
//      race_command_center_service.mjs.
import { supabaseAdmin } from "./supabase-admin.mjs";

function fail(message, status = 400, code = "") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  throw error;
}

// --- explicit field allow-lists -- never select("*") on these tables ------

const SESSION_FIELDS =
  "id, team_id, meet_id, name, sport, race_type, distance_meters, distance_unit_display, " +
  "race_date, scheduled_start_time, status, race_started_at, race_ended_at, spectator_visible";

const CHECKPOINT_FIELDS = "id, race_session_id, label, distance_meters, sort_order, is_finish";

// Own-tier participants (athlete/guardian viewing their own athlete) get
// `strategy` too -- it's their own plan, not sensitive. Spectators don't
// need it.
const PARTICIPANT_OWN_FIELDS =
  "id, race_session_id, team_athlete_id, manual_name, race_group, status, strategy, sort_order";
const PARTICIPANT_SPECTATOR_FIELDS =
  "id, race_session_id, team_athlete_id, manual_name, race_group, status, sort_order";

const SPLIT_FIELDS =
  "id, race_participant_id, race_checkpoint_id, elapsed_seconds, wall_clock_captured_at, is_dns, is_dnf";

const GOAL_FIELDS = "id, race_participant_id, goal_slot, goal_seconds";
const TARGET_FIELDS = "id, race_participant_id, race_checkpoint_id, goal_slot, target_elapsed_seconds";

// --- real participant names, fixing the "Runner" bug -----------------------

// Resolves the real display name for every participant, joining
// team_athlete_id -> team_athletes for roster-linked participants and
// falling back to manual_name for ad hoc entries. "Runner" is now only
// ever shown for the genuinely-impossible case of a row with neither
// (the database's own check constraint should prevent that).
export async function resolveParticipantNames(participants) {
  const athleteIds = [...new Set(
    (participants || []).filter((p) => p.team_athlete_id).map((p) => p.team_athlete_id)
  )];

  let athletesById = new Map();
  if (athleteIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("team_athletes")
      .select("id, first_name, last_name, display_name")
      .in("id", athleteIds);
    if (error) throw error;
    athletesById = new Map((data || []).map((a) => [a.id, a]));
  }

  const namesByParticipantId = new Map();
  for (const participant of participants || []) {
    const athlete = participant.team_athlete_id ? athletesById.get(participant.team_athlete_id) : null;
    const name =
      participant.manual_name ||
      athlete?.display_name ||
      (athlete ? `${athlete.first_name} ${athlete.last_name}`.trim() : "") ||
      "Runner";
    namesByParticipantId.set(participant.id, name);
  }
  return namesByParticipantId;
}

// --- Athlete / Guardian "own data" tier -------------------------------------

// Every race a set of team_athletes.id values is rostered in, with full
// goals/targets/splits/checkpoints -- the athlete's (or a guardian's own
// linked athlete's) complete plan-and-result view. Shared by
// lib/athlete_access_service.mjs and lib/guardian_access_service.mjs so
// the two tiers can never silently drift apart.
export async function loadAthleteViewRaces(teamAthleteIds) {
  if (!teamAthleteIds || teamAthleteIds.length === 0) {
    return [];
  }

  const { data: participants, error: participantError } = await supabaseAdmin
    .from("race_participants")
    .select(PARTICIPANT_OWN_FIELDS)
    .in("team_athlete_id", teamAthleteIds);

  if (participantError) throw participantError;
  if (!participants || participants.length === 0) {
    return [];
  }

  const participantIds = participants.map((p) => p.id);
  const sessionIds = [...new Set(participants.map((p) => p.race_session_id))];

  const [
    { data: sessions, error: sessionError },
    { data: goals, error: goalError },
    { data: targets, error: targetError },
    { data: splits, error: splitError },
    { data: checkpoints, error: checkpointError }
  ] = await Promise.all([
    supabaseAdmin.from("race_sessions").select(SESSION_FIELDS).in("id", sessionIds),
    supabaseAdmin.from("race_goals").select(GOAL_FIELDS).in("race_participant_id", participantIds),
    supabaseAdmin.from("race_targets").select(TARGET_FIELDS).in("race_participant_id", participantIds),
    supabaseAdmin.from("race_splits").select(SPLIT_FIELDS).in("race_participant_id", participantIds),
    supabaseAdmin.from("race_checkpoints").select(CHECKPOINT_FIELDS).in("race_session_id", sessionIds)
  ]);

  if (sessionError) throw sessionError;
  if (goalError) throw goalError;
  if (targetError) throw targetError;
  if (splitError) throw splitError;
  if (checkpointError) throw checkpointError;

  const sessionsById = new Map((sessions || []).map((s) => [s.id, s]));
  const namesByParticipantId = await resolveParticipantNames(participants);

  return participants
    .map((participant) => {
      const session = sessionsById.get(participant.race_session_id);
      if (!session) return null; // defensive -- should never happen, never surface an orphaned row

      const sessionCheckpoints = (checkpoints || [])
        .filter((c) => c.race_session_id === participant.race_session_id)
        .sort((a, b) => a.sort_order - b.sort_order);
      const participantGoals = (goals || []).filter((g) => g.race_participant_id === participant.id);
      const participantTargets = (targets || []).filter((t) => t.race_participant_id === participant.id);
      const participantSplits = (splits || []).filter((s) => s.race_participant_id === participant.id);

      return {
        session,
        participant: { ...participant, display_name: namesByParticipantId.get(participant.id) },
        goals: participantGoals,
        checkpoints: sessionCheckpoints.map((checkpoint) => ({
          checkpoint,
          split: participantSplits.find((s) => s.race_checkpoint_id === checkpoint.id) || null,
          targets: Object.fromEntries(
            participantTargets
              .filter((t) => t.race_checkpoint_id === checkpoint.id)
              .map((t) => [t.goal_slot, t.target_elapsed_seconds])
          )
        }))
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(b.session.race_date).localeCompare(String(a.session.race_date)));
}

// --- Anonymous / spectator tier ---------------------------------------------

// A single spectator_visible race: real names, times, checkpoints only.
// Never goals, targets, coach notes, or any internal/device column.
// Throws (404) for a race that doesn't exist or isn't spectator_visible --
// callers that already have a stronger reason to see the race (a
// guardian viewing their own athlete) should check
// session.spectator_visible themselves before calling this, rather than
// relying on the throw.
export async function loadSpectatorRace(sessionId) {
  const { data: session, error: sessionError } = await supabaseAdmin
    .from("race_sessions")
    .select(SESSION_FIELDS)
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) throw sessionError;
  if (!session || !session.spectator_visible) {
    fail("This race isn't available to watch.", 404);
  }

  const { data: team, error: teamError } = await supabaseAdmin
    .from("team_pages")
    .select("id, school_name, slug")
    .eq("id", session.team_id)
    .maybeSingle();
  if (teamError) throw teamError;

  const [
    { data: checkpoints, error: checkpointError },
    { data: participants, error: participantError }
  ] = await Promise.all([
    supabaseAdmin
      .from("race_checkpoints")
      .select(CHECKPOINT_FIELDS)
      .eq("race_session_id", sessionId)
      .order("sort_order", { ascending: true }),
    supabaseAdmin
      .from("race_participants")
      .select(PARTICIPANT_SPECTATOR_FIELDS)
      .eq("race_session_id", sessionId)
      .order("sort_order", { ascending: true })
  ]);

  if (checkpointError) throw checkpointError;
  if (participantError) throw participantError;

  const participantIds = (participants || []).map((p) => p.id);
  let splits = [];
  if (participantIds.length > 0) {
    const { data, error: splitError } = await supabaseAdmin
      .from("race_splits")
      .select(SPLIT_FIELDS)
      .in("race_participant_id", participantIds);
    if (splitError) throw splitError;
    splits = data || [];
  }

  const namesByParticipantId = await resolveParticipantNames(participants || []);

  return {
    session,
    team: team || null,
    checkpoints: checkpoints || [],
    participants: (participants || []).map((participant) => ({
      id: participant.id,
      display_name: namesByParticipantId.get(participant.id),
      race_group: participant.race_group,
      status: participant.status,
      sort_order: participant.sort_order,
      splits: splits
        .filter((s) => s.race_participant_id === participant.id)
        .map((s) => ({
          race_checkpoint_id: s.race_checkpoint_id,
          elapsed_seconds: s.elapsed_seconds,
          is_dns: s.is_dns,
          is_dnf: s.is_dnf
        }))
    }))
  };
}
