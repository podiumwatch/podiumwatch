import {
  teamApiError
} from "../../lib/team_auth.mjs";
import {
  requireSplitWatchAccess,
  assertActionAllowedForActor
} from "../../lib/race_day_auth.mjs";
import {
  parseRaceBody,
  createPackCapture,
  pushSplits,
  pullState,
  setParticipantStatus
} from "../../lib/split_watch_service.mjs";

function cleanText(value) {
  return String(value ?? "").trim();
}

// This endpoint is the one Live Race Mode calls repeatedly while
// offline-first recording is happening. Every action here is designed to
// be safely retried: push_splits upserts on the client-minted
// client_split_id (see install/11_RACE_COMMAND_CENTER.sql), and
// pull_state is a pure read used for post-refresh/multi-tab recovery.
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

    const { actor } = await requireSplitWatchAccess(request, teamId);
    assertActionAllowedForActor(actor, "sync", action);

    const sessionId = cleanText(body.session_id);
    let data;

    switch (action) {
      case "create_pack_capture":
        data = await createPackCapture({
          teamId,
          sessionId,
          checkpointId: cleanText(body.checkpoint_id),
          capturedAt: body.captured_at,
          deviceId: body.device_id
        });
        break;
      case "push_splits":
        data = await pushSplits({ teamId, sessionId, splits: body.splits });
        break;
      case "pull_state":
        data = await pullState({ teamId, sessionId });
        break;
      case "set_participant_status":
        data = await setParticipantStatus({
          teamId,
          sessionId,
          participantId: cleanText(body.participant_id),
          status: body.status
        });
        break;
      default: {
        const error = new Error("Unknown sync action.");
        error.status = 400;
        throw error;
      }
    }

    return response.status(200).json(data);
  } catch (error) {
    return teamApiError(
      response,
      error,
      "The race sync request could not be completed."
    );
  }
}
