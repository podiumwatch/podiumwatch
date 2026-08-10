// Reusable pace/split math for the race pace calculator (and anything
// else that later wants the same checkpoint math -- see
// src/pages/pacecalculator.mjs's page-level comment for why this lives in
// its own file). Exposed as window.PodiumPaceSplits, matching the same
// namespacing pattern public/scripts/team-auth-client.js already uses for
// window.PodiumTeamAuth. No DOM access here -- this file is pure
// calculation, which is also what lets scripts/test-pace-calculator.mjs
// exercise it directly from Node with only a minimal window stub.
(() => {
  const MILE_METERS = 1609.344;

  function formatSplitTime(totalSeconds) {
    if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
      return "--:--";
    }

    let minutes = Math.floor(totalSeconds / 60);
    let seconds = Math.round((totalSeconds - minutes * 60) * 10) / 10;

    if (seconds >= 60) {
      minutes += 1;
      seconds -= 60;
    }

    const secondsText = seconds < 10
      ? "0" + seconds.toFixed(1)
      : seconds.toFixed(1);

    return minutes + ":" + secondsText;
  }

  function formatWholeTime(totalSeconds) {
    let minutes = Math.floor(totalSeconds / 60);
    let seconds = Math.round(totalSeconds - minutes * 60);

    if (seconds === 60) {
      minutes += 1;
      seconds = 0;
    }

    return minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
  }

  // The distances a goal pace is reported in, regardless of the event's
  // own distance -- every event shows both a per-mile and a per-km pace.
  function paceForUnit(goalSeconds, eventDistanceMeters, unitMeters) {
    return goalSeconds * (unitMeters / eventDistanceMeters);
  }

  // Builds the checkpoint table for one event at one step size (400m for
  // a track lap table, 1000m for a kilometer table, MILE_METERS for a
  // mile table). Every full step up to the event distance gets its own
  // checkpoint; if the event distance isn't an exact multiple of the
  // step, one final partial checkpoint is added at the true finish so the
  // table always ends exactly at the goal time, never short of it. The
  // 0.5m epsilon guard avoids a redundant, essentially-zero-length final
  // checkpoint when a distance lands almost exactly on a step boundary
  // (for example a 5K's 5th kilometer is also its finish).
  function buildCheckpoints({ distanceMeters, goalSeconds, stepMeters }) {
    const checkpointDistances = [];
    let distance = stepMeters;

    while (distance < distanceMeters - 0.5) {
      checkpointDistances.push(distance);
      distance += stepMeters;
    }

    checkpointDistances.push(distanceMeters);

    let previousCumulative = 0;

    return checkpointDistances.map((checkpointDistance, index) => {
      const cumulativeSeconds = goalSeconds * (checkpointDistance / distanceMeters);
      const splitSeconds = cumulativeSeconds - previousCumulative;
      previousCumulative = cumulativeSeconds;

      // A checkpoint is "partial" when it doesn't land on a full step
      // multiple -- always true for a table's final entry when the event
      // distance isn't an exact multiple of the step, and never true
      // otherwise, since every earlier checkpoint is built from an exact
      // step multiple by construction.
      const stepMultiple = (index + 1) * stepMeters;
      const isPartial = Math.abs(checkpointDistance - stepMultiple) > 0.5;

      return {
        distanceMeters: checkpointDistance,
        index,
        cumulativeSeconds,
        splitSeconds,
        isPartial
      };
    });
  }

  window.PodiumPaceSplits = {
    MILE_METERS,
    formatSplitTime,
    formatWholeTime,
    paceForUnit,
    buildCheckpoints
  };
})();
