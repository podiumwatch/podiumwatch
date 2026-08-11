import {
  requireTeamUser,
  teamApiError
} from "../../lib/team_auth.mjs";
import {
  requireTeamMembership,
  getMeetCenterContext
} from "../../lib/team_workspace_service.mjs";

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

// The operational page for one meet: meet info, this team's schedule
// connection if any, and every Race Command Center race session tied to
// it (with readiness counts). Creating a new race for this meet is
// deliberately NOT a separate action here -- the client calls Race
// Command Center's own, already-tested api/race-command-center/sessions.js
// "create" action directly with meet_id pre-filled, so there is exactly
// one code path that creates a race_sessions row, not two.
export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const user = await requireTeamUser(request);
    const body = parseBody(request);
    const teamId = cleanText(body.team_id);
    const meetId = cleanText(body.meet_id);

    if (!teamId) {
      const error = new Error("Choose a team page.");
      error.status = 400;
      throw error;
    }

    if (!meetId) {
      const error = new Error("Choose a meet.");
      error.status = 400;
      throw error;
    }

    const { team } = await requireTeamMembership(user.id, teamId);
    const context = await getMeetCenterContext({ teamId, meetId });

    return response.status(200).json({ team, ...context });
  } catch (error) {
    return teamApiError(
      response,
      error,
      "The meet center request could not be completed."
    );
  }
}
