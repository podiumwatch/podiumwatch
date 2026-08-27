// Race Day Command Center (build plan Project 2). Orchestrates the
// shared race-day selection (lib/todays_race_service.mjs) with the
// readiness checklist (lib/race_readiness_service.mjs) to answer, in one
// call, "what race matters right now, is it ready, and what's the one
// thing to click." Consumed by api/split-watch/sessions.js's existing
// "today" action -- deliberately extending that action rather than
// adding a new endpoint, since its own header comment already claims to
// be the shared read for both the coach's Today's Split Watch card and
// the helper-code join flow (previously only half true -- Team Home
// actually read a separate, slower aggregate call; this makes the
// comment accurate).
//
// Readiness detail is only computed for a real coach actor. A race-day
// helper calling the same "today" action gets the plain race-day
// context only (unchanged from before this project) -- a helper has no
// use for a roster/goals/parent-page checklist, and computing it would
// be wasted queries on every helper page load for data they can't act on.
import { getRaceDayContext } from "./todays_race_service.mjs";
import { getRaceDayCodeStatus } from "./race_day_auth.mjs";
import { getRehearsalStatus } from "./rehearsal_service.mjs";
import { evaluateRaceReadiness, primaryActionForCommandCenter } from "./race_readiness_service.mjs";
import { supabaseAdmin } from "./supabase-admin.mjs";

async function loadReadinessInputsForSession(teamId, session) {
  const [{ data: checkpoints, error: cpError }, { count: participantCount, error: partError }] = await Promise.all([
    supabaseAdmin.from("race_checkpoints").select("id, is_finish").eq("race_session_id", session.id),
    supabaseAdmin.from("race_participants").select("id", { count: "exact", head: true }).eq("race_session_id", session.id)
  ]);
  if (cpError) throw cpError;
  if (partError) throw partError;

  let readyGoalCount = 0;
  if ((participantCount || 0) > 0) {
    const { data: participantIds, error: pidError } = await supabaseAdmin
      .from("race_participants")
      .select("id")
      .eq("race_session_id", session.id);
    if (pidError) throw pidError;
    const ids = (participantIds || []).map((p) => p.id);
    if (ids.length > 0) {
      const { data: goals, error: goalError } = await supabaseAdmin
        .from("race_goals")
        .select("race_participant_id")
        .eq("goal_slot", "A")
        .in("race_participant_id", ids);
      if (goalError) throw goalError;
      readyGoalCount = new Set((goals || []).map((g) => g.race_participant_id)).size;
    }
  }

  // A rehearsal has no rehearsal-of-itself, and it's never the session
  // handed to this function anyway (rehearsals are excluded from every
  // race-day query -- see todays_race_service.mjs) -- session.id here is
  // always an official race, matching getRehearsalStatus()'s expectation.
  const rehearsalStatus = await getRehearsalStatus({ teamId, sourceSessionId: session.id }).catch(() => ({ has_rehearsal: false }));
  const raceDayCodeStatus = await getRaceDayCodeStatus(teamId).catch(() => null);

  return {
    checkpoints: checkpoints || [],
    participantCount: participantCount || 0,
    readyGoalCount,
    raceDayCodeActive: Boolean(raceDayCodeStatus?.active),
    rehearsalStatus
  };
}

function hrefsFor(teamId, session) {
  const idPart = "?id=" + encodeURIComponent(teamId) + "&race=" + encodeURIComponent(session.id);
  return {
    planHref: "/split-watch/plan/" + idPart,
    liveHref: "/split-watch/live/" + idPart,
    reviewHref: "/split-watch/review/" + idPart
  };
}

// Full Command Center payload for a real coach actor: the shared
// race-day context (live/upcoming/finished/nearestUpcoming/needsChoice)
// plus, when there's exactly one relevant race, its full readiness
// checklist and primary action.
export async function buildCommandCenterContext({ teamId }) {
  const context = await getRaceDayContext(teamId);

  if (context.needsChoice) {
    // Spec: "Do not select one silently... show both race names, start
    // times, and team context... Do not offer to start another race."
    // The choice list itself (liveRaces) is already part of context.
    return { ...context, readiness: null, primaryAction: null };
  }

  const race = context.singleRelevantRace;
  if (!race) {
    return { ...context, readiness: null, primaryAction: null };
  }

  const inputs = await loadReadinessInputsForSession(teamId, race);
  const hrefs = hrefsFor(teamId, race);
  const readiness = evaluateRaceReadiness({
    session: race,
    checkpoints: inputs.checkpoints,
    participantCount: inputs.participantCount,
    readyGoalCount: inputs.readyGoalCount,
    raceDayCodeActive: inputs.raceDayCodeActive,
    rehearsalStatus: inputs.rehearsalStatus,
    planHref: hrefs.planHref,
    rosterHref: hrefs.planHref
  });
  const primaryAction = primaryActionForCommandCenter({
    session: race,
    hasBlockingIssue: readiness.hasBlockingIssue,
    liveHref: hrefs.liveHref,
    planHref: hrefs.planHref,
    reviewHref: hrefs.reviewHref
  });

  return { ...context, readiness, primaryAction };
}
