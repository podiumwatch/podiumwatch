// Split Watch's race clock.
//
// Race clock accuracy (track build Phase 1, 2026-11-12): ONE time source
// for every phone. Elapsed time is always
//
//     (this phone's clock + its correction to server time) - official start
//
// where the official start is in server time. This replaces the old
// design, in which the phone that pressed Start timed from
// performance.now() while every other phone (and that same phone after a
// reload) timed from its own clock plus a correction, measured against a
// start stored in the starting phone's UNcorrected clock. In live testing
// that left the clock about 15 s off the official clock by the finish,
// sometimes ahead, sometimes behind:
//   - the start was stored in the starting phone's own clock, so every
//     other phone was off by however far that phone's clock was off;
//   - performance.now() can stop while an Android phone sleeps, so the
//     starting phone fell behind after a screen lock;
//   - the correction was one noisy sample, replaced on every request.
// The correction now comes from public/scripts/race-clock-sync.js (best
// of several samples, slow ones thrown away), and the start is the
// moment of the tap converted to server time.
//
// A wall-clock change on the phone during a race (it synced its time, or
// someone set it) is caught by the clock sync, which then measures a new
// correction, so elapsed time stays right.
//
// Exposed as window.PodiumRaceTimer.createRaceTimer(), a factory so tests
// can inject a fake clock. perfNowMs is still accepted (ignored) so older
// callers don't break.
(() => {
  function createRaceTimer({
    nowMs = () => Date.now()
  } = {}) {
    // The official start, in SERVER time (ms).
    let raceStartServerMs = null;
    // This phone's best estimate of serverTime - Date.now().
    let clockOffsetMs = 0;
    let offsetKnown = false;

    // localTapMs: the phone's clock at the moment Start was tapped (taken
    // before any confirm box). Returns the official start in server time;
    // the name raceStartWallClockMs is kept for existing callers.
    function startRace(localTapMs = nowMs()) {
      raceStartServerMs = localTapMs + clockOffsetMs;
      return { raceStartWallClockMs: raceStartServerMs };
    }

    function isLive() {
      return raceStartServerMs !== null;
    }

    // Server time now, as this phone best knows it.
    function serverNowMs(atLocalMs = nowMs()) {
      return atLocalMs + clockOffsetMs;
    }

    function elapsedNow(atLocalMs = nowMs()) {
      if (raceStartServerMs === null) return null;
      return (serverNowMs(atLocalMs) - raceStartServerMs) / 1000;
    }

    function captureElapsedAtTap(atLocalMs = nowMs()) {
      return elapsedNow(atLocalMs);
    }

    // After a reload, or on any phone that didn't press Start: take the
    // official start (server time) from the server or the saved copy.
    function recoverFromWallClock(officialStartServerMs) {
      raceStartServerMs = Number.isFinite(officialStartServerMs) ? officialStartServerMs : null;
    }

    function recoverElapsed() {
      return elapsedNow();
    }

    function setClockOffsetMs(offsetMs) {
      if (Number.isFinite(offsetMs)) {
        clockOffsetMs = offsetMs;
        offsetKnown = true;
      }
    }

    function getClockOffsetMs() {
      return offsetKnown ? clockOffsetMs : null;
    }

    // precision: "synced" once a correction from the server is in use,
    // "device_clock" before that (this phone's time taken as-is).
    function elapsedOrRecovered(atLocalMs = nowMs()) {
      const elapsedSeconds = elapsedNow(atLocalMs);
      if (elapsedSeconds === null) return null;
      return { elapsedSeconds, precision: offsetKnown ? "synced" : "device_clock", clockOffsetMs: offsetKnown ? clockOffsetMs : null };
    }

    function getRaceStartWallClockMs() {
      return raceStartServerMs;
    }

    function reset() {
      raceStartServerMs = null;
    }

    return {
      startRace,
      isLive,
      serverNowMs,
      elapsedNow,
      captureElapsedAtTap,
      recoverFromWallClock,
      recoverElapsed,
      elapsedOrRecovered,
      getRaceStartWallClockMs,
      setClockOffsetMs,
      getClockOffsetMs,
      reset
    };
  }

  window.PodiumRaceTimer = { createRaceTimer };
})();
