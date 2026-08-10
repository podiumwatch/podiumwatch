// Reusable pace/split math, shared by the race pace calculator
// (src/pages/pacecalculator.mjs, 6 preset track/XC events) and the splits
// calculator (src/pages/splitscalculator.mjs, any custom distance/time --
// this is exactly the reuse this file was built for). Exposed as
// window.PodiumPaceSplits, matching the same namespacing pattern
// public/scripts/team-auth-client.js already uses for
// window.PodiumTeamAuth. No DOM access here -- this file is pure
// calculation, which is also what lets scripts/test-pace-calculator.mjs
// exercise it directly from Node with only a minimal window stub.
(() => {
  const MILE_METERS = 1609.344;
  const KM_METERS = 1000;

  function milesToMeters(miles) {
    return (Number(miles) || 0) * MILE_METERS;
  }

  function kmToMeters(km) {
    return (Number(km) || 0) * KM_METERS;
  }

  // Combines an hours/minutes/seconds goal-time entry into total seconds.
  // Splits calculators for longer distances (a half marathon or marathon)
  // need an hours field the original 6-event pace calculator never did,
  // since none of those events take an hour to finish.
  function totalSecondsFromParts({ hours = 0, minutes = 0, seconds = 0 }) {
    return (Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60 + (Number(seconds) || 0);
  }

  // Also used for a splits table's cumulative "Total" column, which for
  // the splits calculator's longer goal times (a marathon's total can
  // pass 3 hours) needs the same H:MM:SS.s rollover formatWholeTime got
  // above, for the same reason -- without it, a marathon's late-mile
  // cumulative times would show as a meaningless "210:00.0" instead of
  // "3:30:00.0". Individual split lengths (one mile, one 400m) never
  // reach an hour in practice, so this only ever engages for totals.
  function formatSplitTime(totalSeconds) {
    if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
      return "--:--";
    }

    let hours = Math.floor(totalSeconds / 3600);
    let minutes = Math.floor((totalSeconds % 3600) / 60);
    let seconds = Math.round((totalSeconds - hours * 3600 - minutes * 60) * 10) / 10;

    if (seconds >= 60) {
      minutes += 1;
      seconds -= 60;
    }
    if (minutes === 60) {
      hours += 1;
      minutes = 0;
    }

    const secondsText = seconds < 10
      ? "0" + seconds.toFixed(1)
      : seconds.toFixed(1);

    if (hours > 0) {
      return hours + ":" + String(minutes).padStart(2, "0") + ":" + secondsText;
    }

    return minutes + ":" + secondsText;
  }

  // Under an hour this returns plain M:SS (matching the original pace
  // calculator's quick-pick buttons, none of which ever reach an hour).
  // The splits calculator's goal times regularly do (a marathon, a half
  // marathon), so an hour-or-longer time rolls into H:MM:SS instead --
  // without this, a 1:45:00 half marathon goal would display as the
  // meaningless "105:00".
  function formatWholeTime(totalSeconds) {
    let hours = Math.floor(totalSeconds / 3600);
    let minutes = Math.floor((totalSeconds % 3600) / 60);
    let seconds = Math.round(totalSeconds - hours * 3600 - minutes * 60);

    if (seconds === 60) {
      minutes += 1;
      seconds = 0;
    }
    if (minutes === 60) {
      hours += 1;
      minutes = 0;
    }

    const secondsText = (seconds < 10 ? "0" : "") + seconds;

    if (hours > 0) {
      return hours + ":" + String(minutes).padStart(2, "0") + ":" + secondsText;
    }

    return minutes + ":" + secondsText;
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
    KM_METERS,
    milesToMeters,
    kmToMeters,
    totalSecondsFromParts,
    formatSplitTime,
    formatWholeTime,
    paceForUnit,
    buildCheckpoints
  };
})();
