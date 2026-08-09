import crypto from "node:crypto";
import { isAdminRequest } from "../../lib/admin_auth.mjs";
import {
  closeVoting,
  createWeek,
  listWeeks,
  openVoting
} from "../../lib/fan_poll_service.mjs";

// Admin scheduling and voting-window control for the Fan Poll. There is
// no existing AOTW/TOTW admin action to model this file on --
// api/admin/operations.js only ever reads aotw_weeks/totw_weeks for its
// status dashboard, it never opens or closes them. This is a new,
// original design, shaped consistent with this project's other admin
// action files (api/admin/team-instagram.js). See docs/DECISIONS.md,
// 2026-08-06.

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
    const action = String(body.action || "list_weeks").trim().toLowerCase();
    let data;

    if (action === "list_weeks") {
      const divisionNumber = body.division_number === undefined || body.division_number === ""
        ? undefined
        : Number(body.division_number);

      data = {
        weeks: await listWeeks({
          sport: body.sport || undefined,
          gender: body.gender || undefined,
          divisionNumber,
          limit: Number(body.limit) || 40
        })
      };
    } else if (action === "create_week") {
      data = {
        week: await createWeek({
          sport: body.sport,
          gender: body.gender,
          divisionNumber: Number(body.division_number),
          seasonYear: Number(body.season_year),
          votingOpens: body.voting_opens,
          votingCloses: body.voting_closes,
          actor: "Podium Watch Admin"
        })
      };
    } else if (action === "open_voting") {
      if (!body.week_id) {
        const error = new Error("Choose a poll week.");
        error.status = 400;
        throw error;
      }

      data = { week: await openVoting({ weekId: body.week_id, actor: "Podium Watch Admin" }) };
    } else if (action === "close_voting") {
      if (!body.week_id) {
        const error = new Error("Choose a poll week.");
        error.status = 400;
        throw error;
      }

      data = { week: await closeVoting({ weekId: body.week_id, actor: "Podium Watch Admin" }) };
    } else {
      const error = new Error("Unsupported fan poll action.");
      error.status = 400;
      throw error;
    }

    return response.status(200).json(data);
  } catch (error) {
    const status = Number(error?.status) || 500;
    const requestId = crypto.randomUUID();

    if (status >= 500) {
      console.error("Fan poll admin error", { requestId, code: error?.code || null, message: error?.message || String(error) });
    }

    return response.status(status).json({
      error: status < 500 ? error.message : `The fan poll admin request could not be completed. Request ${requestId}.`,
      request_id: requestId,
      code: error?.code || null
    });
  }
}
