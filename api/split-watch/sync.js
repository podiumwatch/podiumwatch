import {
  teamApiError
} from "../../lib/team_auth.mjs";
import {
  requireSplitWatchAccess,
  assertActionAllowedForActor,
  assertHelperCanCaptureAt
} from "../../lib/race_day_auth.mjs";
import {
  parseRaceBody,
  createPackCapture,
  pushSplits,
  pullState,
  setParticipantStatus,
  adjustRaceClock
} from "../../lib/split_watch_service.mjs";
import { sessionHasPositions } from "../../lib/timing_crew_service.mjs";

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

    // Timing Crew (Project 3): checkpoint-scoped enforcement only turns
    // on for a race that actually has positions defined -- sessionHasPositions()
    // is one cheap indexed count, and every race before this project (or
    // any team that never sets positions up) has zero rows here, so this
    // is a no-op for them. See assertHelperCanCaptureAt()'s own header
    // comment for the exact rule once positions DO exist.
    if (actor.type === "race_day_code" && (action === "push_splits" || action === "create_pack_capture")) {
      if (await sessionHasPositions(sessionId)) {
        const checkpointIds = action === "push_splits"
          ? (Array.isArray(body.splits) ? body.splits.map((s) => cleanText(s?.race_checkpoint_id)) : [])
          : [cleanText(body.checkpoint_id)];
        assertHelperCanCaptureAt(actor, { sessionId, checkpointIds });
      }
    }

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
      // Coach-only (enforced above via assertActionAllowedForActor -- not
      // in RACE_DAY_CODE_ALLOWED_ACTIONS.sync, so a helper session gets a
      // clean 403, never silently no-ops). See lib/split_watch_service.mjs's
      // adjustRaceClock() for why this recalculates existing splits rather
      // than shifting a start-time reference.
      case "adjust_clock":
        data = await adjustRaceClock({
          teamId,
          sessionId,
          officialElapsedSeconds: body.official_elapsed_seconds
        });
        break;
      default: {
        const error = new Error("Unknown sync action.");
        error.status = 400;
        throw error;
      }
    }

    // server_now lets every device correct for its own wall clock being
    // off from true time -- see public/scripts/race-timer.js's
    // setClockOffsetMs(). Included on every response (not just pull_state)
    // since it costs nothing and any round trip is a valid offset sample.
    // viewer lets the client tell a coach apart from a race-day-code
    // helper -- used to hide Start/Finish/Restart/Adjust Clock entirely
    // for a helper (the server already refuses those calls; this is the
    // matching, honest UI). position is Timing Crew's own assignment
    // (see api/split-watch/sessions.js's matching comment).
    const position = actor.type === "race_day_code"
      ? { capability: actor.capability, checkpointId: actor.checkpointId, raceSessionId: actor.raceSessionId }
      : null;
    return response.status(200).json({ ...data, server_now: new Date().toISOString(), viewer: { type: actor.type, label: actor.label, position } });
  } catch (error) {
    return teamApiError(
      response,
      error,
      "The race sync request could not be completed."
    );
  }
}
