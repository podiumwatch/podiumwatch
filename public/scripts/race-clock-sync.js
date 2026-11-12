// Split Watch clock sync (track build Phase 1, race clock accuracy,
// 2026-11-12). Works out how far this phone's clock is from the server's,
// so every phone times the race against the same clock.
//
// Why: a live cross country test ended about 15 s off the official clock,
// sometimes ahead, sometimes behind. One cause was the old correction: a
// single sample per request, replaced every few seconds, with the
// server's own processing time inside it. One slow or lopsided round trip
// on stadium wifi moved it by seconds.
//
// How (NTP-style): each sample has four times -- sent (phone), received
// by the server, sent by the server, received (phone). Then
//   offset = ((serverReceived - sent) + (serverSent - received)) / 2
//   round trip = (received - sent) - (serverSent - serverReceived)
// so the server's processing time is not part of the measurement. The
// offset's worst-case error is half the round trip, so the sample with
// the SHORTEST round trip wins, and slow samples (over MAX_RTT_MS) are
// thrown away. Samples older than SAMPLE_MAX_AGE_MS drop out. If a fresh
// good sample disagrees with the kept one by far more than both of their
// error bars, the phone's own clock was changed (the phone synced its
// time, or someone set it), so the old samples are dropped.
//
// Pure and injectable (nowMs), so it is unit-tested from Node; the live
// page does the actual requests. Exposed as window.PodiumRaceClockSync.
(() => {
  const MAX_RTT_MS = 1500;
  const KEEP_SAMPLES = 16;
  const SAMPLE_MAX_AGE_MS = 10 * 60 * 1000;
  const JUMP_MARGIN_MS = 250;

  function createClockSync({ nowMs = () => Date.now(), maxRttMs = MAX_RTT_MS, maxAgeMs = SAMPLE_MAX_AGE_MS } = {}) {
    let samples = [];

    // Old samples drop out only when newer ones exist: offline for a long
    // stretch, the last good correction is still far better than none.
    function prune() {
      const now = nowMs();
      const fresh = samples.filter((s) => now - s.atMs <= maxAgeMs);
      if (fresh.length) {
        samples = fresh.slice(-KEEP_SAMPLES);
      } else if (samples.length > 1) {
        samples = [samples.reduce((a, b) => (b.rttMs < a.rttMs || (b.rttMs === a.rttMs && b.atMs > a.atMs) ? b : a))];
      }
    }

    function best() {
      prune();
      let pick = null;
      for (const s of samples) {
        if (!pick || s.rttMs < pick.rttMs || (s.rttMs === pick.rttMs && s.atMs > pick.atMs)) pick = s;
      }
      return pick;
    }

    // { sentMs, serverReceivedMs, serverSentMs, receivedMs } -> the sample,
    // with accepted true/false, or null if the numbers don't make sense.
    function addSample({ sentMs, serverReceivedMs, serverSentMs, receivedMs }) {
      const values = [sentMs, serverReceivedMs, serverSentMs, receivedMs].map(Number);
      if (!values.every(Number.isFinite)) return null;
      const [t0, t1, t2, t3] = values;
      const serverTime = Math.max(0, t2 - t1);
      const rttMs = (t3 - t0) - serverTime;
      if (rttMs < 0 || t3 < t0) return null;
      const sample = { offsetMs: ((t1 - t0) + (t2 - t3)) / 2, rttMs, atMs: t3 };
      if (rttMs > maxRttMs) return { ...sample, accepted: false };
      const current = best();
      if (current && Math.abs(sample.offsetMs - current.offsetMs) > current.rttMs / 2 + sample.rttMs / 2 + JUMP_MARGIN_MS) {
        samples = []; // this phone's clock changed; start over from this sample
      }
      samples.push(sample);
      prune();
      return { ...sample, accepted: true };
    }

    function offsetMs() {
      const pick = best();
      return pick ? pick.offsetMs : null;
    }

    // What the live page shows: synced or not, the error bar (half the
    // best round trip) and how long since that sample.
    function status() {
      const pick = best();
      if (!pick) return { synced: false, offsetMs: null, uncertaintyMs: null, ageMs: null, samples: 0 };
      return { synced: true, offsetMs: pick.offsetMs, uncertaintyMs: pick.rttMs / 2, ageMs: nowMs() - pick.atMs, samples: samples.length };
    }

    // For saving with the race on the phone, and restoring after a reload.
    function snapshot() {
      const pick = best();
      return pick ? { ...pick } : null;
    }
    function restore(saved) {
      if (!saved || !Number.isFinite(saved.offsetMs) || !Number.isFinite(saved.rttMs) || !Number.isFinite(saved.atMs)) return false;
      samples = [{ offsetMs: saved.offsetMs, rttMs: saved.rttMs, atMs: saved.atMs }];
      return true;
    }

    return { addSample, offsetMs, status, snapshot, restore, best };
  }

  // "Clock synced (±0.1 s)" and friends, for the live page.
  function describeStatus(status, { offline = false } = {}) {
    if (!status || !status.synced) return "Clock not synced yet -- using this phone's time";
    const plusMinus = Math.max(0.1, Math.round((status.uncertaintyMs / 1000) * 10) / 10).toFixed(1);
    const minutes = Math.floor((status.ageMs || 0) / 60000);
    if (offline || minutes >= 3) return "Clock synced " + (minutes >= 1 ? minutes + " min ago" : "just now") + " (±" + plusMinus + " s)" + (offline ? " -- working offline" : "");
    return "Clock synced (±" + plusMinus + " s)";
  }

  window.PodiumRaceClockSync = { createClockSync, describeStatus, MAX_RTT_MS, SAMPLE_MAX_AGE_MS };
})();
