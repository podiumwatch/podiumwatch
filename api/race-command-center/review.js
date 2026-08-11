import {
  requireTeamUser,
  teamApiError
} from "../../lib/team_auth.mjs";
import {
  parseRaceBody,
  requireTeamMembership,
  getIndividualReview,
  getTeamReview
} from "../../lib/race_command_center_service.mjs";

function cleanText(value) {
  return String(value ?? "").trim();
}

// Review is always computed on demand from race_splits + race_targets +
// race_participants -- there is no stored review table (see
// install/11_RACE_COMMAND_CENTER.sql's header comment), so this is a
// pure-read endpoint.
export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const user = await requireTeamUser(request);
    const body = parseRaceBody(request);
    const teamId = cleanText(body.team_id);
    const action = cleanText(body.action).toLowerCase();

    if (!teamId) {
      const error = new Error("Choose a team page.");
      error.status = 400;
      throw error;
    }

    await requireTeamMembership(user.id, teamId);

    const sessionId = cleanText(body.session_id);
    let data;

    switch (action) {
      case "get_individual":
        data = await getIndividualReview({
          teamId,
          sessionId,
          participantId: cleanText(body.participant_id)
        });
        break;
      case "get_team":
        data = await getTeamReview({ teamId, sessionId });
        break;
      default: {
        const error = new Error("Unknown review action.");
        error.status = 400;
        throw error;
      }
    }

    return response.status(200).json(data);
  } catch (error) {
    return teamApiError(
      response,
      error,
      "The race review request could not be completed."
    );
  }
}
