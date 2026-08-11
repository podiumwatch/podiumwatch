// Race Command Center's pure calculation engine. Every function here is
// plain data in, plain data out -- no DOM access, no timers, no network --
// which is what makes it directly unit-testable from Node
// (scripts/test-race-command-center.mjs) with only a minimal window stub,
// matching the pattern already established by public/scripts/pace-splits.js
// and scripts/test-pace-calculator.mjs.
//
// Pages that load this file MUST load /scripts/pace-splits.js first (see
// src/pages/pacecalculator.mjs for the <script> tag order this mirrors) --
// this file reuses window.PodiumPaceSplits's conversion/formatting helpers
// directly rather than duplicating them.
//
// Exposed as window.PodiumRaceMath, matching the window.PodiumPaceSplits /
// window.PodiumTeamAuth namespacing convention.
(() => {
  const PaceSplits = window.PodiumPaceSplits;

  // ---------------------------------------------------------------------
  // Plan-time target generation
  // ---------------------------------------------------------------------

  // Generalizes pace-splits.js's buildCheckpoints() proportional formula
  // (cumulativeSeconds = goalSeconds * (checkpointDistance / distanceMeters))
  // to Race Command Center's coach-defined, irregularly-spaced checkpoints
  // -- buildCheckpoints() itself assumes a uniform step size, which does not
  // fit a coach's real checkpoint layout, but the underlying formula is
  // reused exactly, not reinvented.
  //
  // checkpoints: [{ id, distanceMeters, sortOrder }, ...] in ascending
  // distance order (the finish is just the checkpoint with the largest
  // distanceMeters -- there is no special-cased "finish" branch here).
  // Returns [{ checkpointId, cumulativeSeconds }, ...] in the same order.
  function computeEvenPaceTargets({ distanceMeters, goalSeconds, checkpoints }) {
    if (!(distanceMeters > 0) || !(goalSeconds > 0) || !Array.isArray(checkpoints)) {
      return [];
    }

    return checkpoints.map((checkpoint) => ({
      checkpointId: checkpoint.id,
      cumulativeSeconds: goalSeconds * (checkpoint.distanceMeters / distanceMeters)
    }));
  }

  // Custom Pace targets are exactly what the coach entered -- this
  // function never modifies them, it only validates. Returns
  // { valid: true } or { valid: false, firstInvalidIndex }, where
  // firstInvalidIndex points at the first entry that is not strictly
  // greater than the one before it (checkpoint times must always
  // increase -- a runner cannot arrive at checkpoint 2 before checkpoint 1).
  function validateCustomPaceTargets(checkpointSecondsInOrder) {
    if (!Array.isArray(checkpointSecondsInOrder) || checkpointSecondsInOrder.length === 0) {
      return { valid: false, firstInvalidIndex: 0 };
    }

    let previous = 0;
    for (let i = 0; i < checkpointSecondsInOrder.length; i += 1) {
      const value = checkpointSecondsInOrder[i];
      if (!(Number.isFinite(value) && value > previous)) {
        return { valid: false, firstInvalidIndex: i };
      }
      previous = value;
    }

    return { valid: true };
  }

  // ---------------------------------------------------------------------
  // Live-race math
  // ---------------------------------------------------------------------

  function computeSegmentTime(cumulativeSecondsA, cumulativeSecondsB) {
    return cumulativeSecondsB - cumulativeSecondsA;
  }

  // Average pace over a distance, expressed per unitMeters (mile or km) --
  // thin wrapper so callers don't re-derive the ratio themselves.
  function computeAveragePace(elapsedSeconds, distanceMeters, unitMeters) {
    if (!(distanceMeters > 0)) {
      return null;
    }
    return elapsedSeconds * (unitMeters / distanceMeters);
  }

  // Positive = ahead of target (faster than planned), negative = behind.
  function computeDiffFromTarget(actualElapsedSeconds, targetElapsedSeconds) {
    return targetElapsedSeconds - actualElapsedSeconds;
  }

  // Per-goal-slot status. Computed independently for each goal (A/B/C) --
  // never merged across goals into one summary status, since a runner can
  // be on pace for Goal B while already behind Goal A.
  //   ahead:    already faster than target at this checkpoint
  //   on_pace:  within the tolerance band of target
  //   at_risk:  behind target but the goal is still mathematically alive
  //   missed:   behind by enough, with too little race left, that the
  //             goal cannot realistically still happen
  function computeGoalStatus({ diffFromTargetSeconds, distanceRemainingMeters, toleranceSeconds = 3 }) {
    if (diffFromTargetSeconds >= 0) {
      return diffFromTargetSeconds <= toleranceSeconds ? "on_pace" : "ahead";
    }

    // Behind target. Still "at_risk" unless there's essentially no race
    // left to make up the deficit in.
    if (distanceRemainingMeters <= 0 && diffFromTargetSeconds < 0) {
      return "missed";
    }

    return Math.abs(diffFromTargetSeconds) <= toleranceSeconds ? "on_pace" : "at_risk";
  }

  // The "required pace to hit goal" statement -- deliberately a SEPARATE
  // function from computeCurrentPaceProjection() below, and their return
  // shapes intentionally share no field name, so the UI can never
  // accidentally merge "current pace projects X" and "required pace to
  // hit goal is Y" into one misleading number.
  function computeRequiredRemaining({ goalSeconds, elapsedSoFarSeconds, distanceRemainingMeters }) {
    const requiredSeconds = goalSeconds - elapsedSoFarSeconds;
    if (!(distanceRemainingMeters > 0)) {
      return { requiredSeconds, requiredPacePerMile: null, requiredPacePerKm: null };
    }

    return {
      requiredSeconds,
      requiredPacePerMile: requiredSeconds * (PaceSplits.MILE_METERS / distanceRemainingMeters),
      requiredPacePerKm: requiredSeconds * (PaceSplits.KM_METERS / distanceRemainingMeters)
    };
  }

  // The "current pace projects a finish of X" statement -- a straight-line
  // projection of the pace run SO FAR across the remaining distance. Never
  // combined with computeRequiredRemaining()'s output (see note above).
  function computeCurrentPaceProjection({ elapsedSoFarSeconds, distanceCompletedMeters, distanceTotalMeters }) {
    if (!(distanceCompletedMeters > 0) || !(distanceTotalMeters > 0)) {
      return { projectedFinishSeconds: null };
    }

    const paceSecondsPerMeter = elapsedSoFarSeconds / distanceCompletedMeters;
    return { projectedFinishSeconds: paceSecondsPerMeter * distanceTotalMeters };
  }

  // Purely advisory ordering -- sorts participants by their target
  // cumulative time at the given checkpoint. Never gates which runner a
  // coach can record a split for; Live Race Mode always allows recording
  // any runner at any time regardless of this order.
  function computeExpectedOrder(participantsWithTargets, checkpointId) {
    return [...participantsWithTargets]
      .filter((p) => p.targetsByCheckpoint && p.targetsByCheckpoint[checkpointId] != null)
      .sort((a, b) => a.targetsByCheckpoint[checkpointId] - b.targetsByCheckpoint[checkpointId]);
  }

  // Deterministic, non-AI, fully offline coaching cue. A fixed rule table,
  // not a model -- callers can disable cues entirely simply by not calling
  // this function.
  function deriveCoachingCue({ diffFromTargetSeconds, distanceRemainingMeters, goalStatus }) {
    if (goalStatus === "missed") {
      return "race_by_feel";
    }
    if (goalStatus === "ahead") {
      return "stay_patient";
    }
    if (goalStatus === "on_pace") {
      return "on_plan";
    }
    // at_risk
    if (distanceRemainingMeters > 0 && distanceRemainingMeters <= 400) {
      return "start_closing";
    }
    return "on_plan";
  }

  // ---------------------------------------------------------------------
  // Team-level math. Deliberately no team-score function exists anywhere
  // in this file -- one team's own split times cannot determine a real
  // cross country team score without actual field-position data this
  // project does not yet capture (see install/11_RACE_COMMAND_CENTER.sql's
  // header comment).
  // ---------------------------------------------------------------------

  function computeTeamAverageDiff(diffsFromTargetSeconds) {
    const finite = diffsFromTargetSeconds.filter((d) => Number.isFinite(d));
    if (finite.length === 0) {
      return null;
    }
    return finite.reduce((sum, d) => sum + d, 0) / finite.length;
  }

  // The gap between the fastest runner and the Nth-fastest (e.g. R1-R5,
  // R1-R7 spread), a standard team-tightness indicator. finishSecondsAsc
  // must already be sorted ascending (fastest first).
  function computeRunnerGap(finishSecondsAsc, n) {
    if (!Array.isArray(finishSecondsAsc) || finishSecondsAsc.length < n) {
      return null;
    }
    return finishSecondsAsc[n - 1] - finishSecondsAsc[0];
  }

  function computeGoalTierCounts(goalStatuses) {
    const counts = { ahead: 0, on_pace: 0, at_risk: 0, missed: 0 };
    for (const status of goalStatuses) {
      if (Object.prototype.hasOwnProperty.call(counts, status)) {
        counts[status] += 1;
      }
    }
    return counts;
  }

  window.PodiumRaceMath = {
    computeEvenPaceTargets,
    validateCustomPaceTargets,
    computeSegmentTime,
    computeAveragePace,
    computeDiffFromTarget,
    computeGoalStatus,
    computeRequiredRemaining,
    computeCurrentPaceProjection,
    computeExpectedOrder,
    deriveCoachingCue,
    computeTeamAverageDiff,
    computeRunnerGap,
    computeGoalTierCounts
  };
})();
