// Shared "who gets to see what" projection for Split Watch data
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
//   2. lib/split_watch_service.mjs's getSessionDetail() did
//      select("*") on race_participants with no join back to
//      team_athletes, so display_name never existed on the row -- every
//      roster-linked participant showed as "Runner" on the coach's own
//      Live Race Mode and Review pages. resolveParticipantNames() below
//      is the fix, used both by this module and directly by
//      split_watch_service.mjs.
import { supabaseAdmin } from "./supabase-admin.mjs";
import { classifyRaceDay, todayDateString } from "./todays_race_service.mjs";

function fail(message, status = 400, code = "") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  throw error;
}

// --- explicit field allow-lists -- never select("*") on these tables ------

const SESSION_FIELDS =
  "id, team_id, meet_id, name, sport, race_type, distance_meters, distance_unit_display, " +
  "race_date, scheduled_start_time, status, race_started_at, race_ended_at, spectator_visible, " +
  "is_rehearsal";

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

  const { data: rawParticipants, error: participantError } = await supabaseAdmin
    .from("race_participants")
    .select(PARTICIPANT_OWN_FIELDS)
    .in("team_athlete_id", teamAthleteIds);

  if (participantError) throw participantError;
  if (!rawParticipants || rawParticipants.length === 0) {
    return [];
  }

  const rawSessionIds = [...new Set(rawParticipants.map((p) => p.race_session_id))];

  // Rehearsal Mode (install/25): a rehearsal copies its source race's
  // roster into brand-new race_participants rows that still carry the
  // SAME team_athlete_id -- without this filter, an athlete's or
  // guardian's own race list would show a coach's practice run as if it
  // were one more real race. Rehearsal rows are excluded here at the
  // session level, before goals/targets/splits are ever fetched for
  // their (practice) participants.
  const { data: rawSessions, error: rawSessionError } = await supabaseAdmin
    .from("race_sessions")
    .select(SESSION_FIELDS)
    .in("id", rawSessionIds);
  if (rawSessionError) throw rawSessionError;

  const officialSessions = (rawSessions || []).filter((s) => !s.is_rehearsal);
  const officialSessionIds = new Set(officialSessions.map((s) => s.id));
  const participants = rawParticipants.filter((p) => officialSessionIds.has(p.race_session_id));

  if (participants.length === 0) {
    return [];
  }

  const participantIds = participants.map((p) => p.id);
  const sessionIds = [...officialSessionIds];

  const [
    { data: goals, error: goalError },
    { data: targets, error: targetError },
    { data: splits, error: splitError },
    { data: checkpoints, error: checkpointError }
  ] = await Promise.all([
    supabaseAdmin.from("race_goals").select(GOAL_FIELDS).in("race_participant_id", participantIds),
    supabaseAdmin.from("race_targets").select(TARGET_FIELDS).in("race_participant_id", participantIds),
    supabaseAdmin.from("race_splits").select(SPLIT_FIELDS).in("race_participant_id", participantIds),
    supabaseAdmin.from("race_checkpoints").select(CHECKPOINT_FIELDS).in("race_session_id", sessionIds)
  ]);

  if (goalError) throw goalError;
  if (targetError) throw targetError;
  if (splitError) throw splitError;
  if (checkpointError) throw checkpointError;

  const sessionsById = new Map(officialSessions.map((s) => [s.id, s]));
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
// session is an already-validated, already-visible race_sessions row
// (the caller -- loadSpectatorDay() below -- is the one place that
// decides visibility) -- this just loads the full checkpoint/
// participant/split detail for it.
async function loadSpectatorRaceDetail(session) {
  const sessionId = session.id;

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
          // Was fetched from the database (SPLIT_FIELDS) but silently
          // dropped here -- the spectator page had no way to show "this
          // split was captured 3 minutes ago" per runner, only one global
          // "page last polled at" timestamp, which can look fresh while a
          // runner's own data is stale (they're between checkpoints). See
          // docs/LIVE_TRACKING_UX_AUDIT.md.
          wall_clock_captured_at: s.wall_clock_captured_at,
          is_dns: s.is_dns,
          is_dnf: s.is_dnf
        }))
    }))
  };
}

// Pure grouping/selection math for loadSpectatorDay() below -- kept
// separate from the database reads so it's directly unit-testable (see
// scripts/test-archive-and-day-link.mjs) without a live Supabase
// connection, matching lib/todays_race_service.mjs's classifyRaceDay()
// convention. `visible` is every spectator_visible/non-rehearsal/non-
// archived/non-cancelled race for one team, any date.
export function groupAndSelectSpectatorDay({ visible, anchorRaceDate, requestedSessionId, today }) {
  const anchorDate = anchorRaceDate ||
    (classifyRaceDay(visible, today).singleRelevantRace || visible[0])?.race_date;

  const daySessions = visible
    .filter((s) => s.race_date === anchorDate)
    .sort((a, b) => {
      if ((a.status === "live") !== (b.status === "live")) return a.status === "live" ? -1 : 1;
      return String(a.scheduled_start_time || "").localeCompare(String(b.scheduled_start_time || "")) || a.name.localeCompare(b.name);
    });

  const requestedSession = requestedSessionId ? daySessions.find((s) => s.id === requestedSessionId) : null;
  const selected = requestedSession || classifyRaceDay(daySessions, anchorDate).singleRelevantRace || daySessions[0] || null;

  return { anchorDate, daySessions, selected };
}

// One team-day parent link (2026-08-27 feature request): a coach used to
// have to send a different /race/?race=<id> link for every race on a
// meet day (an HS and a JH race, or boys and girls, each spectator_
// visible on their own). This groups every spectator_visible,
// non-rehearsal, non-archived race a team has for ONE calendar day and
// lets the public page switch between them without a new link.
//
// Two ways in:
//   - sessionId given (an existing per-race link, or a parent tapping a
//     sibling in the switcher): anchors on THAT race's own race_date --
//     an old link to a since-finished race must keep showing exactly
//     what it always showed, siblings included, never redirect to a
//     different day's races.
//   - only teamId given (the new team-wide link, ?team=<id>): anchors on
//     whichever date the team's own smart selection would pick right
//     now -- live wins, else the next scheduled spectator_visible race,
//     else the most recently finished one -- reusing classifyRaceDay(),
//     the exact same priority the coach's own Command Center uses,
//     scoped down to only the races this coach actually made public.
//
// Fails the same generic "This race isn't available to watch." either
// way whether nothing exists, nothing is spectator_visible, or a given
// sessionId doesn't resolve -- never reveals which case it was.
export async function loadSpectatorDay({ teamId, sessionId }) {
  let resolvedTeamId = teamId ? String(teamId).trim() : "";
  let anchorSession = null;

  if (sessionId) {
    const { data: s, error } = await supabaseAdmin
      .from("race_sessions")
      .select(SESSION_FIELDS)
      .eq("id", sessionId)
      .maybeSingle();
    if (error) throw error;
    if (!s) fail("This race isn't available to watch.", 404);
    // Defense in depth: updateSessionDetails() already refuses to ever
    // set spectator_visible=true on a rehearsal (install/25), and the
    // candidates query below filters is_rehearsal=false too -- checked
    // explicitly here as well, since an official-only boundary should
    // never rely on a single upstream guard.
    if (s.is_rehearsal) fail("This race isn't available to watch.", 404);
    anchorSession = s;
    resolvedTeamId = s.team_id;
  }

  if (!resolvedTeamId) {
    fail("This race isn't available to watch.", 404);
  }

  const { data: candidates, error: candError } = await supabaseAdmin
    .from("race_sessions")
    .select(SESSION_FIELDS)
    .eq("team_id", resolvedTeamId)
    .eq("spectator_visible", true)
    .eq("is_rehearsal", false)
    .is("archived_at", null)
    .neq("status", "cancelled");
  if (candError) throw candError;

  const visible = candidates || [];
  if (visible.length === 0) {
    fail("This race isn't available to watch.", 404);
  }

  const { anchorDate, daySessions, selected } = groupAndSelectSpectatorDay({
    visible,
    anchorRaceDate: anchorSession ? anchorSession.race_date : null,
    requestedSessionId: sessionId,
    today: todayDateString()
  });

  if (daySessions.length === 0) {
    fail("This race isn't available to watch.", 404);
  }

  const detail = await loadSpectatorRaceDetail(selected);

  return {
    team: detail.team,
    date: anchorDate,
    races: daySessions.map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      race_date: s.race_date,
      scheduled_start_time: s.scheduled_start_time
    })),
    selected_session_id: selected.id,
    session: detail.session,
    checkpoints: detail.checkpoints,
    participants: detail.participants
  };
}
