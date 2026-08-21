import {
  teamApiError
} from "../../lib/team_auth.mjs";
import {
  requireRaceCommandCenterAccess
} from "../../lib/race_day_auth.mjs";
import {
  parseRaceBody,
  listSessions,
  createSession,
  getSessionDetail,
  updateSessionDetails,
  startRace,
  finishRace,
  restartRace,
  duplicateSession,
  deleteSession
} from "../../lib/race_command_center_service.mjs";

function cleanText(value) {
  return String(value ?? "").trim();
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const body = parseRaceBody(request);
    const teamId = cleanText(body.team_id);
    const action = cleanText(body.action).toLowerCase();

    if (!teamId) {
      const error = new Error("Choose a team page.");
      error.status = 400;
      throw error;
    }

    const { actor } = await requireRaceCommandCenterAccess(request, teamId);
    let data;

    switch (action) {
      case "list":
        data = await listSessions({ teamId });
        break;
      case "create":
        data = await createSession({ teamId, actor, body });
        break;
      case "detail":
        data = await getSessionDetail({ teamId, sessionId: cleanText(body.session_id) });
        break;
      case "update":
        data = await updateSessionDetails({ teamId, sessionId: cleanText(body.session_id), body });
        break;
      case "start_race":
        data = await startRace({
          teamId,
          sessionId: cleanText(body.session_id),
          raceStartedAt: body.race_started_at,
          createdBy: actor.label
        });
        break;
      case "finish_race":
        data = await finishRace({ teamId, sessionId: cleanText(body.session_id), createdBy: actor.label });
        break;
      case "restart_race":
        data = await restartRace({ teamId, sessionId: cleanText(body.session_id) });
        break;
      case "duplicate":
        data = await duplicateSession({
          teamId,
          sessionId: cleanText(body.session_id),
          actor,
          raceDate: body.race_date
        });
        break;
      case "delete":
        data = await deleteSession({ teamId, sessionId: cleanText(body.session_id) });
        break;
      default: {
        const error = new Error("Unknown race action.");
        error.status = 400;
        throw error;
      }
    }

    return response.status(200).json(data);
  } catch (error) {
    return teamApiError(
      response,
      error,
      "The race request could not be completed."
    );
  }
}
