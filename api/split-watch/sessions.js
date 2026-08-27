import {
  teamApiError
} from "../../lib/team_auth.mjs";
import {
  requireSplitWatchAccess,
  assertActionAllowedForActor
} from "../../lib/race_day_auth.mjs";
import {
  parseRaceBody,
  listSessions,
  createSession,
  getSessionDetail,
  updateSessionDetails,
  startRace,
  finishRace,
  restartRace,
  duplicateSession,
  deleteSession
} from "../../lib/split_watch_service.mjs";
import { buildCommandCenterContext } from "../../lib/race_day_command_center_service.mjs";
import { getRaceDayContext } from "../../lib/todays_race_service.mjs";
import {
  getOrCreateActiveRehearsal,
  resetRehearsal,
  getRehearsalStatus
} from "../../lib/rehearsal_service.mjs";

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

    const { actor } = await requireSplitWatchAccess(request, teamId);
    assertActionAllowedForActor(actor, "sessions", action);
    let data;

    switch (action) {
      case "list":
        data = await listSessions({ teamId });
        break;
      // Smart routing read (Section 9/3 of the race day spec; extended by
      // Race Day Command Center, build plan Project 2): the one relevant
      // race right now, if there is one, plus enough context to show a
      // short live-race list on the rare occasion there isn't. Used by
      // both the coach's Today's Split Watch card and the helper-code
      // join flow -- one shared answer, not two. Readiness detail (the
      // checklist + primary action) is only computed for a real coach --
      // a helper has no use for it, and it's several extra queries a
      // helper's join flow shouldn't pay for on every load.
      case "today": {
        const { team } = await listSessions({ teamId });
        const context = actor.type === "team_user"
          ? await buildCommandCenterContext({ teamId })
          : { ...(await getRaceDayContext(teamId)), readiness: null, primaryAction: null };
        data = { team, ...context };
        break;
      }
      case "create":
        data = await createSession({ teamId, actor, body });
        break;
      case "detail":
        data = await getSessionDetail({ teamId, sessionId: cleanText(body.session_id) });
        break;
      case "update":
        data = await updateSessionDetails({ teamId, sessionId: cleanText(body.session_id), body });
        break;
      case "start_race":
        data = await startRace({
          teamId,
          sessionId: cleanText(body.session_id),
          raceStartedAt: body.race_started_at,
          createdBy: actor.label
        });
        break;
      case "finish_race":
        data = await finishRace({ teamId, sessionId: cleanText(body.session_id), createdBy: actor.label });
        break;
      case "restart_race":
        data = await restartRace({ teamId, sessionId: cleanText(body.session_id) });
        break;
      case "duplicate":
        data = await duplicateSession({
          teamId,
          sessionId: cleanText(body.session_id),
          actor,
          raceDate: body.race_date
        });
        break;
      case "delete":
        data = await deleteSession({ teamId, sessionId: cleanText(body.session_id) });
        break;
      // Rehearsal Mode (install/25) -- coach-only, enforced below via
      // assertActionAllowedForActor (not in a race-day code's allowed
      // set, so a helper session gets a clean 403 attempting any of
      // these; a helper may only JOIN a rehearsal a coach already
      // started, via the same Live page every official race uses).
      case "create_rehearsal":
        data = await getOrCreateActiveRehearsal({
          teamId,
          sourceSessionId: cleanText(body.session_id),
          actor
        });
        break;
      case "reset_rehearsal":
        data = await resetRehearsal({
          teamId,
          rehearsalSessionId: cleanText(body.session_id),
          actor
        });
        break;
      case "rehearsal_status":
        data = await getRehearsalStatus({ teamId, sourceSessionId: cleanText(body.session_id) });
        break;
      default: {
        const error = new Error("Unknown race action.");
        error.status = 400;
        throw error;
      }
    }

    // Lets the client tell a real coach account apart from a race-day-code
    // helper without guessing from what actions happened to succeed --
    // used to hide Start/Finish/Restart entirely for a helper (server-side
    // enforcement already blocks them via assertActionAllowedForActor
    // above; this is the matching, honest UI, not a second gate).
    return response.status(200).json({ ...data, viewer: { type: actor.type, label: actor.label } });
  } catch (error) {
    return teamApiError(
      response,
      error,
      "The race request could not be completed."
    );
  }
}
