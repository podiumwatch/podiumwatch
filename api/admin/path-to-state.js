import crypto from "node:crypto";
import { isAdminRequest } from "../../lib/admin_auth.mjs";
import {
  clearTeamAdvancementStatus,
  getTeamAdvancementRows,
  listPathAdminTeams,
  listQualificationThresholds,
  setTeamAdvancementStatus
} from "../../lib/path_to_state_service.mjs";

// Admin team search and manual advancement-status control for Path to
// State. Shaped consistent with this project's other small, focused admin
// action files -- api/admin/fan-poll.js is the closest recent precedent
// (same auth guard, same POST-only/405, same error envelope).

function bodyOf(request) {
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

  if (!isAdminRequest(request)) {
    return response.status(401).json({ error: "Podium Watch admin sign in required." });
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const body = bodyOf(request);
    const action = String(body.action || "list_teams").trim().toLowerCase();
    let data;

    if (action === "list_teams") {
      data = {
        teams: await listPathAdminTeams({
          search: body.search || "",
          limit: Number(body.limit) || 40
        })
      };
    } else if (action === "get_team_path") {
      if (!body.team_id) {
        const error = new Error("Choose a team.");
        error.status = 400;
        throw error;
      }

      data = await getTeamAdvancementRows({
        teamId: body.team_id,
        seasonYear: body.season_year ? Number(body.season_year) : null
      });
    } else if (action === "set_status") {
      if (!body.team_id) {
        const error = new Error("Choose a team.");
        error.status = 400;
        throw error;
      }

      data = {
        status_row: await setTeamAdvancementStatus({
          teamId: body.team_id,
          gender: body.gender,
          seasonYear: Number(body.season_year),
          stage: body.stage,
          status: body.status,
          individualQualifierCount: body.individual_qualifier_count ? Number(body.individual_qualifier_count) : null,
          note: body.note || null,
          actor: "Podium Watch Admin"
        })
      };
    } else if (action === "clear_status") {
      if (!body.team_id) {
        const error = new Error("Choose a team.");
        error.status = 400;
        throw error;
      }

      data = await clearTeamAdvancementStatus({
        teamId: body.team_id,
        gender: body.gender,
        seasonYear: Number(body.season_year),
        stage: body.stage
      });
    } else if (action === "list_thresholds") {
      if (!body.season_year) {
        const error = new Error("Choose a season year.");
        error.status = 400;
        throw error;
      }

      data = {
        thresholds: await listQualificationThresholds({
          seasonYear: Number(body.season_year),
          divisionNumber: body.division_number ? Number(body.division_number) : null,
          gender: body.gender || null
        })
      };
    } else {
      const error = new Error("Unsupported Path to State action.");
      error.status = 400;
      throw error;
    }

    return response.status(200).json(data);
  } catch (error) {
    const status = Number(error?.status) || 500;
    const requestId = crypto.randomUUID();

    if (status >= 500) {
      console.error("Path to State admin error", { requestId, message: error?.message || String(error) });
    }

    return response.status(status).json({
      error: status < 500 ? error.message : `The Path to State admin request could not be completed. Request ${requestId}.`,
      request_id: requestId
    });
  }
}
