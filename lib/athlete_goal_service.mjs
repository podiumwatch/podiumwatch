// The athlete "goal book" -- one goal per athlete PER STANDARD DISTANCE,
// independent of any single race. Exists specifically to fix a real bug:
// split_watch_service.mjs's old goal-carryover logic sorted an
// athlete's prior races by date only, with zero idea what distance any
// of them were -- silently porting a 2-mile goal forward as a "5K goal."
// This table is the actual fix: a coach (and eventually the athlete, via
// Athlete Access) sets a goal once per distance, and the right one gets
// looked up whenever that distance comes up again. See
// install/21_ATHLETE_STANDARD_GOALS.sql for the schema and full reasoning.
import { supabaseAdmin } from "./supabase-admin.mjs";

function fail(message, status = 400, code = "") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  throw error;
}

// Ohio HS/JH cross country and track's actual common race distances --
// not exact meters, since a certified "5K" course is rarely literally
// 5000.00m and a coach thinks in "5K"/"2 Mile", not raw meters. 1600m and
// the Mile share one bucket (0.6% apart -- meaningless for pacing);
// same for 3200m and 2 Mile. Ordered by distance for display purposes.
export const DISTANCE_BUCKETS = [
  { key: "800m", meters: 800, label: "800m" },
  { key: "1600m", meters: 1609.344, label: "Mile / 1600m" },
  { key: "3000m", meters: 3000, label: "3K" },
  { key: "3200m", meters: 3218.688, label: "2 Mile / 3200m" },
  { key: "4000m", meters: 4000, label: "4K" },
  { key: "5000m", meters: 5000, label: "5K" },
  { key: "8000m", meters: 8000, label: "8K" }
];

const BUCKET_KEYS = new Set(DISTANCE_BUCKETS.map((b) => b.key));

// The one place a real race's distance_meters gets mapped to a goal-book
// bucket -- always resolves to whichever bucket is numerically closest,
// no tolerance cutoff, since the buckets themselves are spread far
// enough apart (800/1600/3000/3200/4000/5000/8000) that "nearest" is
// never ambiguous for a real course distance.
export function nearestDistanceBucket(distanceMeters) {
  const distance = Number(distanceMeters);
  if (!Number.isFinite(distance) || distance <= 0) {
    return null;
  }

  let closest = DISTANCE_BUCKETS[0];
  let closestDiff = Math.abs(distance - closest.meters);

  for (const bucket of DISTANCE_BUCKETS.slice(1)) {
    const diff = Math.abs(distance - bucket.meters);
    if (diff < closestDiff) {
      closest = bucket;
      closestDiff = diff;
    }
  }

  return closest.key;
}

async function loadTeamAthlete(teamId, teamAthleteId) {
  const { data, error } = await supabaseAdmin
    .from("team_athletes")
    .select("id")
    .eq("id", teamAthleteId)
    .eq("team_id", teamId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    fail("Athlete not found.", 404);
  }
  return data;
}

// Used by the Team Roster athlete dialog -- every bucket for one athlete,
// including empty ones the UI can render as blank inputs.
export async function getStandardGoalsForAthlete({ teamId, teamAthleteId }) {
  await loadTeamAthlete(teamId, teamAthleteId);

  const { data, error } = await supabaseAdmin
    .from("athlete_standard_goals")
    .select("distance_bucket, goal_seconds")
    .eq("team_athlete_id", teamAthleteId);

  if (error) {
    throw error;
  }

  return { goals: data || [] };
}

// Used by split_watch_service.mjs when adding participants to a
// race -- goal-book rows for many athletes in one query, scoped to this
// team so one team's roster can never read into another's.
export async function getStandardGoalsForAthletes({ teamId, athleteIds }) {
  if (!athleteIds || athleteIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabaseAdmin
    .from("athlete_standard_goals")
    .select("team_athlete_id, distance_bucket, goal_seconds, team_athletes!inner(team_id)")
    .in("team_athlete_id", athleteIds)
    .eq("team_athletes.team_id", teamId);

  if (error) {
    throw error;
  }

  const byAthleteId = new Map();
  for (const row of data || []) {
    if (!byAthleteId.has(row.team_athlete_id)) {
      byAthleteId.set(row.team_athlete_id, new Map());
    }
    byAthleteId.get(row.team_athlete_id).set(row.distance_bucket, row.goal_seconds);
  }
  return byAthleteId;
}

// One athlete, every bucket at once -- a bucket with a null/blank seconds
// value is deleted (this is how a coach clears a goal they no longer
// want), never stored as a fake zero.
export async function saveStandardGoals({ teamId, teamAthleteId, goalsByBucket, actor }) {
  await loadTeamAthlete(teamId, teamAthleteId);

  const toUpsert = [];
  const bucketsToClear = [];

  for (const [bucket, rawSeconds] of Object.entries(goalsByBucket || {})) {
    if (!BUCKET_KEYS.has(bucket)) {
      continue;
    }

    const seconds = Number(rawSeconds);
    if (Number.isFinite(seconds) && seconds > 0) {
      toUpsert.push({
        team_athlete_id: teamAthleteId,
        distance_bucket: bucket,
        goal_seconds: seconds,
        // Both a coach (team_user) and, since Phase 3, the athlete
        // themselves (athlete_user) can be the one who actually set this
        // -- the column just tracks who touched it last, not "which
        // coach" specifically. Only a real actor id is ever recorded.
        updated_by_user_id: (actor?.type === "team_user" || actor?.type === "athlete_user") ? actor.userId : null
      });
    } else {
      bucketsToClear.push(bucket);
    }
  }

  if (toUpsert.length > 0) {
    const { error } = await supabaseAdmin
      .from("athlete_standard_goals")
      .upsert(toUpsert, { onConflict: "team_athlete_id,distance_bucket" });

    if (error) {
      throw error;
    }
  }

  if (bucketsToClear.length > 0) {
    const { error } = await supabaseAdmin
      .from("athlete_standard_goals")
      .delete()
      .eq("team_athlete_id", teamAthleteId)
      .in("distance_bucket", bucketsToClear);

    if (error) {
      throw error;
    }
  }

  return getStandardGoalsForAthlete({ teamId, teamAthleteId });
}

// Fire-and-forget-shaped by design: called as a side effect of a coach
// saving a real per-race Goal A (see saveGoals() in
// split_watch_service.mjs), so the goal book quietly builds
// itself up from normal coaching workflow instead of needing a whole
// separate data-entry pass. Never validates teamId against the athlete
// itself (the caller already resolved and owns that athlete within this
// same request) -- this is an internal write path, not an API boundary.
export async function upsertStandardGoalFromRace({ teamAthleteId, distanceMeters, goalSeconds }) {
  const bucket = nearestDistanceBucket(distanceMeters);
  if (!bucket || !Number.isFinite(goalSeconds) || goalSeconds <= 0) {
    return;
  }

  const { error } = await supabaseAdmin
    .from("athlete_standard_goals")
    .upsert(
      { team_athlete_id: teamAthleteId, distance_bucket: bucket, goal_seconds: goalSeconds },
      { onConflict: "team_athlete_id,distance_bucket" }
    );

  if (error) {
    throw error;
  }
}
