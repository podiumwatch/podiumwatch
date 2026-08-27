// Race Day Command Center (build plan Project 2) -- the ONE readiness
// evaluation shared by the coach-facing checklist (Team Home's Today's
// Split Watch card) and the server-side official start gate in
// lib/split_watch_service.mjs's startRace(). The spec is explicit that
// these must never disagree: "The Command Center must not say ready
// while the start operation later rejects an already known critical
// condition." Both callers pass this function the same shape of
// pre-fetched counts; it does no I/O itself, so it's fully unit
// testable (see scripts/test-command-center.mjs) without a database.
//
// Visible statuses are exactly the three the spec calls for: complete,
// recommended (a non-blocking suggestion), and attention (a real
// problem -- blocking ones prevent the official start; a rehearsal is
// never gated by any of this, see below).
//
// Item coverage vs. the spec's 14-item list, and why it's not literally
// 14 rendered rows:
//   - Race name / date / distance confirmed: a race_sessions row cannot
//     exist without these (createSession() requires them), so all three
//     are trivially "complete" for any real session. Still evaluated
//     explicitly (not just assumed) so a future relaxation of that
//     requirement would be caught here, not silently assumed forever.
//   - Helper assignments completed / Helper code active: collapsed into
//     one "Timing crew" item. There is no per-checkpoint assignment or
//     presence concept yet anywhere in this codebase -- that's Project
//     3, Timing Crew. Inventing fake assignment data here would be
//     exactly the "never present unknown data as zero" problem the spec
//     itself warns against, just inverted (presenting invented data as
//     real). The only real, honest signal available today is whether
//     the team's one shared 4-digit code is currently active.
//   - Parent page enabled / Parent link copied: collapsed into one
//     "Parent page" item. Whether a coach has actually copied the link
//     to their clipboard has never been tracked anywhere (no such
//     column exists, and adding one is out of proportion to this
//     project) -- the item instead surfaces the link directly so a
//     coach can copy it right from the checklist, which satisfies the
//     spec's actual intent (get the link into the coach's hands) without
//     fabricating a "copied" flag no code can honestly know.
//   - "No unresolved synchronization or clock problem for this race" is
//     DELIBERATELY OMITTED, not faked. No health/sync/clock-integrity
//     signal exists anywhere in this codebase yet -- that model is
//     Project 5, Race Day Health. Showing this as "Complete" here would
//     be a false, unearned claim of safety; showing it as "Attention"
//     unconditionally would be equally dishonest in the other direction.
//     Recorded here as a known limitation, not silently dropped.
//   - "Device ready for durable local capture" cannot be evaluated on
//     the server at all -- it's a property of one specific coach's own
//     phone. See public/scripts/device-readiness.js for the client-side
//     counterpart check; this file only reserves the item id and
//     blocking semantics so both surfaces agree on what it means.

export const READINESS_ITEM_IDS = Object.freeze({
  NAME: "name",
  DATE: "date",
  DISTANCE: "distance",
  ROSTER: "roster",
  CHECKPOINTS: "checkpoints",
  FINISH_CHECKPOINT: "finish_checkpoint",
  GOALS: "goals",
  TIMING_CREW: "timing_crew",
  PARENT_PAGE: "parent_page",
  REHEARSAL: "rehearsal",
  DEVICE_STORAGE: "device_storage"
});

function item({ id, label, status, blocking, explanation, actionLabel = null, actionHref = null }) {
  return { id, label, status, blocking, explanation, actionLabel, actionHref };
}

// Pure. No database access, no fetch, no clock reads (device storage is
// evaluated separately, client-side) -- exactly what makes this safely
// shareable between a server request handler and a unit test.
export function evaluateRaceReadiness({
  session,
  checkpoints,
  participantCount,
  readyGoalCount,
  raceDayCodeActive,
  rehearsalStatus,
  planHref: planUrl,
  rosterHref
}) {
  const hasFinishCheckpoint = (checkpoints || []).some((c) => c.is_finish);
  const items = [];

  items.push(item({
    id: READINESS_ITEM_IDS.NAME,
    label: "Race name confirmed",
    status: session.name ? "complete" : "attention",
    blocking: false,
    explanation: session.name ? `"${session.name}"` : "This race has no name yet."
  }));

  items.push(item({
    id: READINESS_ITEM_IDS.DATE,
    label: "Race date and time confirmed",
    status: session.race_date ? "complete" : "attention",
    blocking: false,
    explanation: session.race_date ? "Date is set." : "No race date set yet."
  }));

  items.push(item({
    id: READINESS_ITEM_IDS.DISTANCE,
    label: "Distance confirmed",
    status: session.distance_meters > 0 ? "complete" : "attention",
    blocking: false,
    explanation: session.distance_meters > 0 ? "Distance is set." : "No race distance set yet."
  }));

  items.push(item({
    id: READINESS_ITEM_IDS.ROSTER,
    label: "Roster confirmed",
    status: participantCount > 0 ? "complete" : "attention",
    blocking: true,
    explanation: participantCount > 0
      ? `${participantCount} runner${participantCount === 1 ? "" : "s"} on the roster.`
      : "No runners have been added to this race yet.",
    actionLabel: participantCount > 0 ? null : "Add runners",
    actionHref: participantCount > 0 ? null : (rosterHref || planUrl)
  }));

  items.push(item({
    id: READINESS_ITEM_IDS.CHECKPOINTS,
    label: "Checkpoints confirmed",
    status: (checkpoints || []).length > 0 ? "complete" : "attention",
    blocking: false,
    explanation: (checkpoints || []).length > 0
      ? `${checkpoints.length} checkpoint${checkpoints.length === 1 ? "" : "s"} set.`
      : "No checkpoints have been set up yet.",
    actionLabel: (checkpoints || []).length > 0 ? null : "Set up checkpoints",
    actionHref: (checkpoints || []).length > 0 ? null : planUrl
  }));

  items.push(item({
    id: READINESS_ITEM_IDS.FINISH_CHECKPOINT,
    label: "Finish checkpoint confirmed",
    status: hasFinishCheckpoint ? "complete" : "attention",
    blocking: true,
    explanation: hasFinishCheckpoint ? "A finish checkpoint is set." : "This race has no finish checkpoint yet.",
    actionLabel: hasFinishCheckpoint ? null : "Set up checkpoints",
    actionHref: hasFinishCheckpoint ? null : planUrl
  }));

  const goalsComplete = participantCount > 0 && readyGoalCount >= participantCount;
  items.push(item({
    id: READINESS_ITEM_IDS.GOALS,
    label: "Athlete goals entered",
    status: goalsComplete ? "complete" : "recommended",
    blocking: false,
    explanation: participantCount > 0
      ? `${readyGoalCount} of ${participantCount} runners have a goal set.`
      : "Add runners first to set goals.",
    actionLabel: goalsComplete ? null : "Enter goals",
    actionHref: goalsComplete ? null : planUrl
  }));

  items.push(item({
    id: READINESS_ITEM_IDS.TIMING_CREW,
    label: "Timing crew code",
    status: raceDayCodeActive ? "complete" : "recommended",
    blocking: false,
    explanation: raceDayCodeActive
      ? "The 4-digit timing helper code is active for your team."
      : "No timing helper code is active yet -- fine if you're timing alone.",
    actionLabel: raceDayCodeActive ? null : "Generate code",
    actionHref: null
  }));

  items.push(item({
    id: READINESS_ITEM_IDS.PARENT_PAGE,
    label: "Parent page",
    status: session.spectator_visible ? "complete" : "recommended",
    blocking: false,
    explanation: session.spectator_visible
      ? "Parents and fans can watch this race live."
      : "Parent live viewing is off for this race (fine if that's intentional).",
    actionLabel: "Open parent link",
    actionHref: planUrl
  }));

  const rehearsalComplete = Boolean(rehearsalStatus?.has_rehearsal) &&
    rehearsalStatus.status === "finished" && !rehearsalStatus.outdated;
  items.push(item({
    id: READINESS_ITEM_IDS.REHEARSAL,
    label: "Rehearsal completed",
    status: rehearsalComplete ? "complete" : "recommended",
    blocking: false,
    explanation: !rehearsalStatus?.has_rehearsal
      ? "This race hasn't been practiced yet."
      : rehearsalStatus.outdated
        ? "The roster or checkpoints changed since the last rehearsal -- consider practicing again."
        : rehearsalStatus.status === "finished"
          ? "Rehearsal completed against the current setup."
          : "A rehearsal is in progress but hasn't been finished yet.",
    actionLabel: rehearsalComplete ? null : "Practice this race",
    actionHref: planUrl
  }));

  // Device storage is added by the caller (server-side callers omit it
  // entirely -- see evaluateServerBlockingIssues below -- since only the
  // browser itself can know its own IndexedDB health; the Command
  // Center attaches the client-checked result into this same array
  // client-side so it renders in the same list).

  const blockingIssues = items.filter((i) => i.blocking && i.status !== "complete");
  const attentionCount = items.filter((i) => i.status !== "complete").length;

  return {
    items,
    hasBlockingIssue: blockingIssues.length > 0,
    blockingIssues,
    attentionCount,
    summaryLabel: attentionCount === 0
      ? "Ready for race day"
      : `${attentionCount} item${attentionCount === 1 ? "" : "s"} need${attentionCount === 1 ? "s" : ""} attention`
  };
}

// The server-side half of "must not say ready while start rejects" --
// called from startRace() for official (non-rehearsal) sessions only.
// Deliberately narrower than the full checklist above: only the two
// items that are actually BLOCKING are re-checked here, using the exact
// same evaluateRaceReadiness() so the thresholds can never drift apart
// from what the Command Center displayed a moment earlier.
export function findBlockingReadinessIssues({ session, checkpoints, participantCount }) {
  const evaluation = evaluateRaceReadiness({
    session,
    checkpoints,
    participantCount,
    readyGoalCount: 0,
    raceDayCodeActive: true,
    rehearsalStatus: { has_rehearsal: false },
    planHref: "",
    rosterHref: ""
  });
  return evaluation.blockingIssues;
}

// Primary action rules (spec, "Primary action rules"). Both "Go to Race
// Day Screen" and "Return to Live Timing" route to the same
// /split-watch/live/ page -- this codebase's Live page already handles
// both the pre-start and in-progress states on one route (see
// applyViewerModeToStartScreen()/beginLiveScreen() in
// public/scripts/split-watch-live.js), so there is no separate "race
// day screen" route to build.
export function primaryActionForCommandCenter({ session, hasBlockingIssue, liveHref, planHref: planUrl, reviewHref }) {
  if (session.status === "live") {
    return { label: "Return to Live Timing", href: liveHref };
  }
  if (session.status === "draft" || hasBlockingIssue) {
    return { label: "Open Race Setup", href: planUrl };
  }
  if (session.status === "scheduled") {
    return { label: "Go to Race Day Screen", href: liveHref };
  }
  if (session.status === "finished" || session.status === "reviewed") {
    return { label: "Review Results", href: reviewHref };
  }
  return { label: "Open Race Setup", href: planUrl };
}
