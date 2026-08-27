// Race Day Command Center (build plan Project 2) -- "Device readiness
// check." Tests the ACTUAL storage abstraction the live capture pipeline
// uses (window.PodiumRaceStore, public/scripts/race-local-store.js),
// not merely whether indexedDB exists as a browser API name, matching
// the spec's explicit "should test the actual storage abstraction used
// by the capture queue... not merely test whether the browser exposes
// an API name."
//
// Writes one small, clearly-reserved sentinel record into the SAME
// race_state store real races use, reads it back, then removes it.
// "__device_readiness_check__" can never collide with a real
// race_session_id (every real one is a UUID), so this can never touch,
// let alone delete, an actual pending race's local state -- matching
// the spec's "avoid deleting or changing real pending captures."
//
// Shared by two callers: Team Home's Today's Split Watch card (informs
// the "Device ready for durable local capture" checklist item) and the
// Live page's pre-start screen (which uses the same check to warn
// before an official start -- see public/scripts/split-watch-live.js).
// One shared check, not two separately-maintained implementations.
//
// Exposed as window.PodiumDeviceReadiness, matching this project's
// existing window.PodiumRaceStore / window.PodiumRaceMath / etc.
// namespacing convention.
(() => {
  const SENTINEL_ID = "__device_readiness_check__";

  async function check() {
    if (!window.PodiumRaceStore || typeof indexedDB === "undefined") {
      return { ok: false, reason: "This browser does not support the storage Split Watch needs to time a race safely." };
    }

    try {
      const record = { race_session_id: SENTINEL_ID, checked_at: new Date().toISOString() };
      await window.PodiumRaceStore.saveRaceState(record);
      const readBack = await window.PodiumRaceStore.getRaceState(SENTINEL_ID);
      await window.PodiumRaceStore.deleteRaceState(SENTINEL_ID);

      if (!readBack || readBack.race_session_id !== SENTINEL_ID) {
        return { ok: false, reason: "This device could not reliably read back stored race data." };
      }
      return { ok: true, reason: null };
    } catch {
      return { ok: false, reason: "This device could not safely store race data (private browsing or storage may be blocked)." };
    }
  }

  window.PodiumDeviceReadiness = { check };
})();
