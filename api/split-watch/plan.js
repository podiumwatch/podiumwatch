import {
  teamApiError
} from "../../lib/team_auth.mjs";
import {
  requireSplitWatchAccess
} from "../../lib/race_day_auth.mjs";
import {
  parseRaceBody,
  listTeamRoster,
  saveParticipants,
  saveGoals,
  saveStrategy,
  saveTargets,
  bulkApplyGoal,
  saveGoalsBulk
} from "../../lib/split_watch_service.mjs";

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

    await requireSplitWatchAccess(request, teamId);

    const sessionId = cleanText(body.session_id);
    let data;

    switch (action) {
      case "list_roster":
        data = await listTeamRoster({ teamId, sport: body.sport || "cross_country" });
        break;
      case "save_participants":
        data = await saveParticipants({ teamId, sessionId, participants: body.participants });
        break;
      case "save_goals":
        data = await saveGoals({
          teamId,
          sessionId,
          participantId: cleanText(body.participant_id),
          goals: body.goals
        });
        break;
      case "save_strategy":
        data = await saveStrategy({
          teamId,
          sessionId,
          participantId: cleanText(body.participant_id),
          strategy: body.strategy
        });
        break;
      case "save_targets":
        data = await saveTargets({
          teamId,
          sessionId,
          participantId: cleanText(body.participant_id),
          goalSlot: body.goal_slot,
          mode: body.mode,
          goalSeconds: body.goal_seconds,
          checkpointSeconds: body.checkpoint_seconds
        });
        break;
      case "bulk_apply_goal":
        data = await bulkApplyGoal({
          teamId,
          sessionId,
          participantIds: body.participant_ids,
          goalSlot: body.goal_slot,
          goalSeconds: body.goal_seconds
        });
        break;
      case "save_goals_bulk":
        data = await saveGoalsBulk({
          teamId,
          sessionId,
          entries: body.entries
        });
        break;
      default: {
        const error = new Error("Unknown plan action.");
        error.status = 400;
        throw error;
      }
    }

    return response.status(200).json(data);
  } catch (error) {
    return teamApiError(
      response,
      error,
      "The race plan request could not be completed."
    );
  }
}
