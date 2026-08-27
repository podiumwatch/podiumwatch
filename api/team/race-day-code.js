import {
  requireTeamUser,
  teamApiError
} from "../../lib/team_auth.mjs";
import {
  requireTeamMembership
} from "../../lib/split_watch_service.mjs";
import {
  getRaceDayCodeStatus,
  regenerateRaceDayCode,
  revokeRaceDayCode
} from "../../lib/race_day_auth.mjs";

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

// Owner/editor management of a team's race day code -- requires a real
// signed-in Podium Watch coach account, same membership check every
// other Split Watch action already uses. Never accepts or
// returns the race-day SESSION itself (lib/race_day_auth.mjs's other
// cookie) -- this is exclusively the "manage the code" side.
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
    const action = cleanText(body.action).toLowerCase();

    if (!teamId) {
      const error = new Error("Choose a team page.");
      error.status = 400;
      throw error;
    }

    await requireTeamMembership(user.id, teamId);

    let data;
    switch (action) {
      case "status":
        data = { status: await getRaceDayCodeStatus(teamId) };
        break;
      case "regenerate":
        data = await regenerateRaceDayCode(teamId, user.id, { revokeExistingHelpers: Boolean(body.revoke_existing_helpers) });
        break;
      case "revoke":
        await revokeRaceDayCode(teamId);
        data = { revoked: true };
        break;
      default: {
        const error = new Error("Unknown race day code action.");
        error.status = 400;
        throw error;
      }
    }

    return response.status(200).json(data);
  } catch (error) {
    return teamApiError(response, error, "The race day code request could not be completed.");
  }
}
