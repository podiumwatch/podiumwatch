// Team Workspace Phase One: a read-mostly aggregation layer over systems
// that already exist -- team roster (lib/team_roster_service.mjs), team
// schedule (team_meet_connections, matching api/team/schedule.js's exact
// query patterns), and Split Watch (race_sessions/race_participants/
// race_goals). This file deliberately owns no new tables and writes
// nothing except by calling Split Watch's own, already-tested
// createSession() -- Team Meet Center's "create a race for this meet"
// action is a thin pass-through, not a duplicate write path.
import { supabaseAdmin } from "./supabase-admin.mjs";
import { todayDateString } from "./todays_race_service.mjs";

function fail(message, status = 400, code = "") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  throw error;
}

function cleanUuid(value, label = "ID") {
  const cleaned = String(value ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleaned)) {
    fail(`${label} is invalid.`);
  }
  return cleaned;
}

// Matches api/team/schedule.js's MEET_FIELDS exactly, so both callers
// stay in sync with the same real meets columns.
const MEET_FIELDS = `
  id,
  name,
  slug,
  sport,
  meet_date,
  start_time,
  end_date,
  venue_name,
  address,
  city,
  state,
  zip_code,
  host_school,
  meet_type,
  division,
  results_url,
  athleticnet_url,
  milesplit_url,
  registration_url,
  official_website_url,
  google_maps_url,
  published,
  featured
`;

// Mirrors api/team/schedule.js's requireMembership() exactly -- same
// suspended/archived/merged/editing-locked checks -- since Team Workspace
// pages need the identical authorization guarantees as every other coach
// tool, not a lighter version of them.
export async function requireTeamMembership(userId, teamId, { write = false } = {}) {
  const [membershipResult, teamResult] = await Promise.all([
    supabaseAdmin
      .from("team_members")
      .select("id, team_id, user_id, role, status, display_name")
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle(),
    supabaseAdmin
      .from("team_pages")
      .select("id, school_name, slug, published, suspended, archived_at, merged_into_team_id, editing_locked, editing_lock_reason")
      .eq("id", teamId)
      .maybeSingle()
  ]);

  if (membershipResult.error) throw membershipResult.error;
  if (teamResult.error) throw teamResult.error;

  if (!membershipResult.data) {
    fail("You do not have permission to view this team's workspace.", 403);
  }

  if (!teamResult.data) {
    fail("Team profile not found.", 404);
  }

  const team = teamResult.data;

  if (team.merged_into_team_id || team.archived_at || team.suspended) {
    fail("Merged, archived, or suspended team profiles cannot use the team workspace.", 409);
  }

  if (write && team.editing_locked) {
    fail(team.editing_lock_reason || "Podium Watch has temporarily locked editing for this team.", 423);
  }

  return { membership: membershipResult.data, team };
}

async function getMeetsByIds(ids) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const { data, error } = await supabaseAdmin.from("meets").select(MEET_FIELDS).in("id", uniqueIds);
  if (error) throw error;

  return new Map((data || []).map((meet) => [meet.id, meet]));
}

// Current-season roster count -- summed across every team_seasons row
// currently marked is_current for this team (there can be more than one:
// e.g. boys and girls cross country each have their own is_current row,
// scoped by (team_id, sport, program_scope) -- see
// lib/team_roster_service.mjs's saveSeason()/rolloverSeason()).
async function getRosterSummary(teamId) {
  const { data: seasons, error: seasonError } = await supabaseAdmin
    .from("team_seasons")
    .select("id, sport, program_scope, name, season_year")
    .eq("team_id", teamId)
    .eq("is_current", true);

  if (seasonError) throw seasonError;

  const seasonIds = (seasons || []).map((s) => s.id);
  if (seasonIds.length === 0) {
    return { rosterCount: 0, currentSeasons: [] };
  }

  const { count, error: countError } = await supabaseAdmin
    .from("team_roster_entries")
    .select("id", { count: "exact", head: true })
    .in("season_id", seasonIds);

  if (countError) throw countError;

  return { rosterCount: count || 0, currentSeasons: seasons };
}

// Every race_sessions row for this team that is still upcoming or in
// progress (draft/scheduled/live), soonest first -- the "next race"
// signal for Team Home.
async function getUpcomingRaceSessions(teamId, { limit = 5 } = {}) {
  // Rehearsal Mode (install/25): a rehearsal never appears as an
  // "upcoming race" -- it's practice data, not a peer entry. Archiving
  // (install/26): an archived race is a coach's own "I'm done managing
  // this one" signal -- it stays reachable by direct link, but drops out
  // of every working list, including this one.
  const { data, error } = await supabaseAdmin
    .from("race_sessions")
    .select("*")
    .eq("team_id", teamId)
    .eq("is_rehearsal", false)
    .is("archived_at", null)
    .in("status", ["draft", "scheduled", "live"])
    .order("race_date", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

async function getRecentRaceSessions(teamId, { limit = 5 } = {}) {
  const { data, error } = await supabaseAdmin
    .from("race_sessions")
    .select("*")
    .eq("team_id", teamId)
    .eq("is_rehearsal", false)
    .is("archived_at", null)
    .in("status", ["finished", "reviewed"])
    .order("race_date", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// Readiness = participants with at least a Goal A set, per race_session.
// Never invents a number for a race with zero participants -- returns
// 0/0, not a misleading 100%.
async function attachReadiness(sessions) {
  if (sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);
  const { data: participants, error: participantError } = await supabaseAdmin
    .from("race_participants")
    .select("id, race_session_id")
    .in("race_session_id", sessionIds);

  if (participantError) throw participantError;

  const participantIds = (participants || []).map((p) => p.id);
  let goalParticipantIds = new Set();

  if (participantIds.length > 0) {
    const { data: goals, error: goalError } = await supabaseAdmin
      .from("race_goals")
      .select("race_participant_id")
      .eq("goal_slot", "A")
      .in("race_participant_id", participantIds);

    if (goalError) throw goalError;
    goalParticipantIds = new Set((goals || []).map((g) => g.race_participant_id));
  }

  const participantsBySession = new Map();
  for (const p of participants || []) {
    const list = participantsBySession.get(p.race_session_id) || [];
    list.push(p);
    participantsBySession.set(p.race_session_id, list);
  }

  return sessions.map((session) => {
    const sessionParticipants = participantsBySession.get(session.id) || [];
    const readyCount = sessionParticipants.filter((p) => goalParticipantIds.has(p.id)).length;
    return {
      ...session,
      participant_count: sessionParticipants.length,
      ready_count: readyCount
    };
  });
}

// --- next-race lookup, batched across teams (for /team-dashboard/) -----------
// A lighter, batched sibling to buildTeamHomeSummary's own nextRace logic
// below -- one query covers every team a coach owns/edits at once,
// rather than a full per-team Team Home summary (roster counts, recent
// races, meet connections) for data /team-dashboard/'s team cards don't
// otherwise need. A LIVE race always wins regardless of date -- a coach
// mid-race needs "Open live timing" to be the loudest thing on the
// screen the moment they sign in, not something date-sorting could bury
// behind an earlier-dated but not-yet-started race.
function isBetterNextRace(candidate, current) {
  const candidateLive = candidate.status === "live";
  const currentLive = current.status === "live";
  if (candidateLive !== currentLive) return candidateLive;
  return String(candidate.race_date) < String(current.race_date);
}

export async function getNextRacesForTeams(teamIds) {
  const byTeam = new Map();
  if (!teamIds || teamIds.length === 0) return byTeam;

  // Rehearsal Mode (install/25): excluded here too, for the same reason
  // as getUpcomingRaceSessions() above -- this batched lookup feeds
  // /team-dashboard/'s per-team "next race" preview across every team a
  // coach owns.
  const { data, error } = await supabaseAdmin
    .from("race_sessions")
    .select("id, team_id, name, race_date, status")
    .in("team_id", teamIds)
    .eq("is_rehearsal", false)
    .is("archived_at", null)
    .in("status", ["draft", "scheduled", "live"]);
  if (error) throw error;

  for (const session of data || []) {
    const current = byTeam.get(session.team_id);
    if (!current || isBetterNextRace(session, current)) {
      byTeam.set(session.team_id, session);
    }
  }
  return byTeam;
}

// --- Team Home ----------------------------------------------------------------

export async function buildTeamHomeSummary({ teamId }) {
  const [rosterSummary, upcomingRaceSessionsRaw, recentRaceSessionsRaw, connectionsResult] = await Promise.all([
    getRosterSummary(teamId),
    getUpcomingRaceSessions(teamId, { limit: 5 }),
    getRecentRaceSessions(teamId, { limit: 5 }),
    supabaseAdmin
      .from("team_meet_connections")
      .select("*")
      .eq("team_id", teamId)
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
  ]);

  if (connectionsResult.error) throw connectionsResult.error;

  const connections = connectionsResult.data || [];
  const meetMap = await getMeetsByIds(connections.map((c) => c.meet_id));

  // A coach's own Eastern calendar date, not the server process's UTC
  // date -- see lib/todays_race_service.mjs's header comment. This was
  // previously new Date().toISOString().slice(0, 10) (raw UTC), which
  // rolls over to the wrong day for several hours every evening.
  const today = todayDateString();
  const upcomingConnections = connections
    .map((c) => ({ ...c, meet: meetMap.get(c.meet_id) || null }))
    .filter((c) => c.meet && c.meet.meet_date >= today)
    .sort((a, b) => String(a.meet.meet_date).localeCompare(String(b.meet.meet_date)))
    .slice(0, 5);

  const upcomingRaceSessions = await attachReadiness(upcomingRaceSessionsRaw);
  const recentRaceSessions = await attachReadiness(recentRaceSessionsRaw);

  // "Next meet" is the soonest upcoming connected meet, if any; "next
  // race" is the soonest draft/scheduled/live race session -- these are
  // reported separately since a team can have an upcoming meet with no
  // race session created yet, or a race session with no linked meet
  // (an ad hoc time trial).
  const nextMeet = upcomingConnections[0] || null;
  const nextRace = upcomingRaceSessions[0] || null;

  // Race Day Command Center (build plan Project 2) now owns "what's
  // happening right now" as its own independently-loaded call (see
  // api/split-watch/sessions.js's "today" action and
  // public/scripts/team-home.js, which fetches it in parallel with this
  // summary rather than waiting on it) -- this aggregate summary no
  // longer computes it, so a slow roster/schedule query here can never
  // hide the race-day card behind Team Home's overall loading state.
  return {
    rosterCount: rosterSummary.rosterCount,
    currentSeasons: rosterSummary.currentSeasons,
    nextMeet,
    nextRace,
    upcomingMeets: upcomingConnections,
    upcomingRaceSessions,
    recentRaceSessions
  };
}

// --- Team Meet Center -----------------------------------------------------------

export async function getMeetCenterContext({ teamId, meetId }) {
  const cleanedMeetId = cleanUuid(meetId, "Meet");

  const [meetResult, connectionResult, sessionsResult] = await Promise.all([
    supabaseAdmin.from("meets").select(MEET_FIELDS).eq("id", cleanedMeetId).maybeSingle(),
    supabaseAdmin
      .from("team_meet_connections")
      .select("*")
      .eq("team_id", teamId)
      .eq("meet_id", cleanedMeetId)
      .maybeSingle(),
    supabaseAdmin
      .from("race_sessions")
      .select("*")
      .eq("team_id", teamId)
      .eq("meet_id", cleanedMeetId)
      .order("race_date", { ascending: true })
      .order("created_at", { ascending: true })
  ]);

  if (meetResult.error) throw meetResult.error;
  if (connectionResult.error) throw connectionResult.error;
  if (sessionsResult.error) throw sessionsResult.error;

  if (!meetResult.data) {
    fail("Meet not found.", 404);
  }

  const raceSessions = await attachReadiness(sessionsResult.data || []);

  return {
    meet: meetResult.data,
    connection: connectionResult.data || null,
    raceSessions
  };
}
