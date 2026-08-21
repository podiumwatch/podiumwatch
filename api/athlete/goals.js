import {
  requireAthleteUser,
  requireAthleteAccess,
  athleteApiError
} from "../../lib/athlete_auth.mjs";
import {
  getStandardGoalsForAthlete,
  saveStandardGoals
} from "../../lib/athlete_goal_service.mjs";

function cleanText(value) {
  return String(value ?? "").trim();
}

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The submitted request is invalid.");
      error.status = 400;
      throw error;
    }
  }
  return request.body || {};
}

// Phase 3 of the athlete goal book: an athlete edits their OWN goal book
// directly, through the same get/saveStandardGoals() functions a coach's
// Team Roster page already uses (lib/athlete_goal_service.mjs) -- one
// shared implementation, two different authorization entry points.
// requireAthleteAccess() (not team membership) is what proves this user
// may touch this specific team_athlete_id's data, exactly like
// api/athlete/me.js and races.js already do for read-only data; its
// returned row's team_id is what lets the shared goal-book functions'
// existing team-ownership check pass, without needing a parallel
// athlete-scoped copy of that check.
export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const user = await requireAthleteUser(request);
    const body = parseBody(request);
    const action = cleanText(body.action).toLowerCase();
    const teamAthleteId = cleanText(body.team_athlete_id);

    const access = await requireAthleteAccess(user.id, teamAthleteId);

    if (action === "get_standard_goals") {
      const data = await getStandardGoalsForAthlete({ teamId: access.team_id, teamAthleteId });
      return response.status(200).json(data);
    }

    if (action === "save_standard_goals") {
      const data = await saveStandardGoals({
        teamId: access.team_id,
        teamAthleteId,
        goalsByBucket: body.goals_by_bucket,
        actor: { type: "athlete_user", userId: user.id }
      });
      return response.status(200).json(data);
    }

    const error = new Error("Unknown goals action.");
    error.status = 400;
    throw error;
  } catch (error) {
    return athleteApiError(
      response,
      error,
      "The goals request could not be completed."
    );
  }
}
