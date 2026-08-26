// Split Watch's timer engine. This is the one piece of the
// feature with zero existing precedent anywhere in this codebase --
// nothing else here uses performance.now() -- so this file is intentionally
// small, self-contained, and built to be directly unit-testable from Node
// with injected time sources (see scripts/test-split-watch.mjs),
// matching the pattern already established for public/scripts/race-math.js.
//
// Core design (see install/11_RACE_COMMAND_CENTER.sql's header comment
// for the schema side of this):
//   - The browser's monotonic performance.now() is the source of truth
//     for elapsed time WHILE the race is live in this tab. It is immune
//     to system clock adjustments and is never itself persisted -- it
//     resets to 0 on every page load and is meaningless across sessions.
//   - Date.now() (wall clock) is recorded ONCE, at the instant the coach
//     performs the deliberate race-start action, purely as a recovery
//     anchor for after a refresh/reload/crash, when the monotonic value
//     from before the reload no longer exists.
//   - Recovered elapsed time (derived from the wall clock anchor after a
//     reload) is explicitly lower precision than the live monotonic path
//     -- subject to system clock skew and scheduling jitter -- and every
//     caller of recoverElapsed()/elapsedOrRecovered() gets that fact back
//     in the return value's `precision` field so the UI can show a
//     "timing based on device clock" note rather than presenting it as
//     identical to live-session precision.
//
// Exposed as window.PodiumRaceTimer.createRaceTimer(), a factory rather
// than a single shared instance, so a live race and a recovery check can
// never accidentally share state, and so tests can inject fake time
// sources instead of touching the real clock.
(() => {
  function createRaceTimer({
    nowMs = () => Date.now(),
    perfNowMs = () => performance.now()
  } = {}) {
    let raceStartWallClockMs = null;
    // Only ever set while this tab has been live since the race started.
    // Deliberately null (not 0) after a page reload -- 0 would be
    // indistinguishable from "just started".
    let raceStartPerfMs = null;
    // Race day feedback (2026-08-25): the recovered/wall-clock path is
    // only ever as accurate as THIS device's own Date.now() -- two real
    // phones at the same real meet are not guaranteed to agree on what
    // time it is. clockOffsetMs is a lightweight correction (this
    // device's best estimate of serverTimeNow - Date.now()), supplied by
    // the caller from a server timestamp bracketed by a request/response
    // round trip (see split-watch-live.js's updateClockOffset()) -- never
    // computed in here, since this file has no network access of its
    // own. Deliberately does NOT touch the monotonic path at all: a live
    // performance.now() session never needed wall-clock agreement in the
    // first place, and never should.
    let clockOffsetMs = 0;

    // Called only on the coach's deliberate, explicit confirm action --
    // never automatically.
    function startRace() {
      raceStartWallClockMs = nowMs();
      raceStartPerfMs = perfNowMs();
      return { raceStartWallClockMs };
    }

    function isLive() {
      return raceStartPerfMs !== null;
    }

    // The monotonic, jitter-free elapsed time, in seconds. Null if this
    // tab has no live in-session anchor (e.g. after a reload, before
    // recoverFromWallClock() is called).
    function elapsedNow() {
      if (raceStartPerfMs === null) {
        return null;
      }
      return (perfNowMs() - raceStartPerfMs) / 1000;
    }

    // Called synchronously inside a tap/click handler itself -- never
    // after an await, animation frame, or network call -- so the recorded
    // time reflects the instant of the tap, not whenever some later
    // callback happens to run.
    function captureElapsedAtTap() {
      return elapsedNow();
    }

    // Restores the wall-clock anchor from a persisted race_started_at
    // value after a reload. Does NOT restore a monotonic anchor -- that
    // is impossible by definition (performance.now() resets on every
    // page load) -- so isLive() stays false afterward and only the
    // lower-precision recovery path is available for the rest of this
    // tab's life, even though the underlying race is still genuinely in
    // progress.
    function recoverFromWallClock(persistedRaceStartWallClockMs) {
      raceStartWallClockMs = persistedRaceStartWallClockMs;
      raceStartPerfMs = null;
    }

    // Lower-precision elapsed time derived from the wall-clock anchor,
    // corrected by this device's current best estimate of its own clock
    // offset from server time (see clockOffsetMs above). Null if no
    // anchor (wall clock or otherwise) has ever been set.
    function recoverElapsed() {
      if (raceStartWallClockMs === null) {
        return null;
      }
      return (nowMs() + clockOffsetMs - raceStartWallClockMs) / 1000;
    }

    // Called whenever the caller has a fresh estimate (a new server
    // round trip) -- safe to call as often as every sync, since it's
    // just replacing one number, never accumulating.
    function setClockOffsetMs(offsetMs) {
      clockOffsetMs = Number.isFinite(offsetMs) ? offsetMs : 0;
    }

    // The single function UI code should actually call: prefers the live
    // monotonic path whenever it's available, falls back to the
    // wall-clock recovery path otherwise, and always tags which one was
    // used so the UI can be honest about precision.
    function elapsedOrRecovered() {
      const live = elapsedNow();
      if (live !== null) {
        return { elapsedSeconds: live, precision: "monotonic" };
      }
      const recovered = recoverElapsed();
      if (recovered !== null) {
        return { elapsedSeconds: recovered, precision: "recovered" };
      }
      return null;
    }

    function getRaceStartWallClockMs() {
      return raceStartWallClockMs;
    }

    function reset() {
      raceStartWallClockMs = null;
      raceStartPerfMs = null;
      clockOffsetMs = 0;
    }

    return {
      startRace,
      isLive,
      elapsedNow,
      captureElapsedAtTap,
      recoverFromWallClock,
      recoverElapsed,
      elapsedOrRecovered,
      getRaceStartWallClockMs,
      setClockOffsetMs,
      reset
    };
  }

  window.PodiumRaceTimer = { createRaceTimer };
})();
