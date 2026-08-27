import {
  teamApiError
} from "../../lib/team_auth.mjs";
import {
  requireSplitWatchAccess,
  assertActionAllowedForActor
} from "../../lib/race_day_auth.mjs";
import {
  listPositions,
  createPosition,
  updatePosition,
  deletePosition,
  listCrew,
  reassignHelper,
  revokeHelper
} from "../../lib/timing_crew_service.mjs";

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

// Timing Crew system (race day build plan, Project 3): position setup
// and the crew panel. Everything here is coach-only -- absent entirely
// from race_day_auth.mjs's RACE_DAY_CODE_ALLOWED_ACTIONS, so a helper
// session gets the same clean 403 as create_rehearsal/archive/etc. A
// helper's own self-assignment (picking/confirming their OWN position)
// is a separate, narrower action on api/split-watch/join.js -- it needs
// no coach authority at all, just the race-day cookie already set at
// code entry, so it doesn't belong on this coach-only endpoint.
export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const body = parseBody(request);
    const teamId = cleanText(body.team_id);
    const action = cleanText(body.action).toLowerCase();

    if (!teamId) {
      const error = new Error("Choose a team page.");
      error.status = 400;
      throw error;
    }

    const { actor } = await requireSplitWatchAccess(request, teamId);
    assertActionAllowedForActor(actor, "crew", action);

    const sessionId = cleanText(body.session_id);
    let data;

    switch (action) {
      case "list_positions":
        data = await listPositions({ teamId, sessionId });
        break;
      case "create_position":
        data = await createPosition({
          teamId,
          sessionId,
          label: body.label,
          checkpointId: body.checkpoint_id,
          capability: body.capability,
          instructions: body.instructions
        });
        break;
      case "update_position":
        data = await updatePosition({
          teamId,
          positionId: cleanText(body.position_id),
          label: body.label,
          checkpointId: body.checkpoint_id,
          capability: body.capability,
          instructions: body.instructions
        });
        break;
      case "delete_position":
        data = await deletePosition({ teamId, positionId: cleanText(body.position_id) });
        break;
      case "list_crew":
        data = await listCrew({ teamId, sessionId });
        break;
      case "reassign":
        data = await reassignHelper({
          teamId,
          raceDaySessionId: cleanText(body.race_day_session_id),
          positionId: body.position_id
        });
        break;
      case "revoke":
        data = await revokeHelper({ teamId, raceDaySessionId: cleanText(body.race_day_session_id) });
        break;
      default: {
        const error = new Error("Unknown crew action.");
        error.status = 400;
        throw error;
      }
    }

    return response.status(200).json({ ...data, viewer: { type: actor.type, label: actor.label } });
  } catch (error) {
    return teamApiError(
      response,
      error,
      "The timing crew request could not be completed."
    );
  }
}
