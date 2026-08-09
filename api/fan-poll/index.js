import {
  getEligibleTeams,
  getPollResults,
  isValidDivisionNumber,
  isValidGender,
  isValidSport
} from "../../lib/fan_poll_service.mjs";

// Public, read-only endpoint: returns everything one Fan Poll division
// page needs in a single request -- the current week, the previous
// week's identity (for movement context), this week's ranked results,
// and the real teams eligible to appear on a ballot for this
// sport/gender/division. No login required, matches the POST-for-reads
// convention already used throughout this project's public API (see
// api/teams/index.js, api/athletes/index.js).

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The request is invalid.");
      error.status = 400;
      throw error;
    }
  }

  return request.body || {};
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const body = parseBody(request);
    const sport = String(body.sport || "cross_country");
    const gender = String(body.gender || "");
    const divisionNumber = Number(body.division_number);

    if (!isValidSport(sport)) {
      return response.status(400).json({ error: "Choose a real sport." });
    }

    if (!isValidGender(gender)) {
      return response.status(400).json({ error: "Choose boys or girls." });
    }

    if (!isValidDivisionNumber(divisionNumber)) {
      return response.status(400).json({ error: "Choose a real division." });
    }

    const [{ week, previousWeek, results }, eligibleTeams] = await Promise.all([
      getPollResults({ sport, gender, divisionNumber }),
      getEligibleTeams({ sport, gender, divisionNumber })
    ]);

    return response.status(200).json({
      week,
      previous_week: previousWeek
        ? { id: previousWeek.id, week_slug: previousWeek.week_slug, voting_closes: previousWeek.voting_closes }
        : null,
      results,
      eligible_teams: eligibleTeams
    });
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Fan poll results error:", error);
    }

    return response.status(status).json({
      error: status < 500 ? error.message : "The fan poll could not be loaded right now."
    });
  }
}
