import {
  requireTeamUser,
  teamApiError
} from "../../lib/team_auth.mjs";
import {
  requireTeamMembership,
  buildTeamHomeSummary
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

// Team Home's single read: a season-at-a-glance summary assembled from
// existing roster/schedule/Split Watch data -- see
// lib/team_workspace_service.mjs for exactly what it reads.
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

    if (!teamId) {
      const error = new Error("Choose a team page.");
      error.status = 400;
      throw error;
    }

    const { team } = await requireTeamMembership(user.id, teamId);
    const summary = await buildTeamHomeSummary({ teamId });

    return response.status(200).json({ team, ...summary });
  } catch (error) {
    return teamApiError(
      response,
      error,
      "The team home request could not be completed."
    );
  }
}
