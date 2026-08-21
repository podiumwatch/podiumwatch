// Split Watch's local-first persistence layer. A thin, hand-rolled
// Promise wrapper around the browser's native IndexedDB -- no new
// dependency, matching this project's zero-external-library browser-script
// philosophy (every other file in public/scripts/ is a plain classic
// script with no bundler and no npm-installed browser library).
//
// This file has zero precedent anywhere in this codebase to follow --
// IndexedDB is used nowhere else in Podium Watch -- so it is kept
// deliberately small and single-purpose: store/retrieve plain objects that
// public/scripts/race-math.js and the UI scripts produce and consume. It
// never contains calculation logic itself.
//
// Testing boundary (see scripts/test-split-watch.mjs): Node has no
// real IndexedDB and this project adds no polyfill dependency to fake one,
// so the actual open/get/put/delete calls below are verified separately
// with Playwright against a real Chromium instance. What CAN run in Node
// are the plain-object "record builder" functions at the top of this file
// -- they never touch indexedDB, so their exact output shape (what would
// be persisted/restored) is fully unit-tested there.
//
// Exposed as window.PodiumRaceStore, matching the window.PodiumRaceMath /
// window.PodiumPaceSplits / window.PodiumTeamAuth namespacing convention.
(() => {
  const DB_NAME = "podium_race_command_center";
  const DB_VERSION = 1;
  const STATE_STORE = "race_state";
  const SPLITS_STORE = "race_splits_local";
  const REVISIONS_STORE = "race_revisions_local";

  // ---------------------------------------------------------------------
  // Pure record builders -- no indexedDB access, fully Node-testable.
  // ---------------------------------------------------------------------

  // Mints a client-side idempotency key for a new split. Matches the
  // install/11_RACE_COMMAND_CENTER.sql check constraint
  // (^pw_rcc_[a-zA-Z0-9._-]{16,80}$) and the pw_-prefixed style already
  // established by the AOTW/TOTW voter-token pattern elsewhere in this
  // codebase.
  function generateClientSplitId() {
    const uuid = (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
    return "pw_rcc_" + uuid.replace(/-/g, "");
  }

  // The exact plain-object shape persisted for a whole race's working
  // state -- everything Live Race Mode needs to resume after a refresh
  // without a network round trip. race_started_at is the wall-clock
  // recovery anchor described in public/scripts/race-timer.js; the
  // in-session monotonic value is never part of this object because it is
  // meaningless across page loads.
  function buildRaceStateRecord({
    raceSessionId,
    session,
    checkpoints,
    participants,
    goals,
    targets,
    currentCheckpointIndex = 0,
    raceStartedAtWallClockMs = null,
    savedAtMs = Date.now()
  }) {
    return {
      race_session_id: raceSessionId,
      session: session || null,
      checkpoints: checkpoints || [],
      participants: participants || [],
      goals: goals || [],
      targets: targets || [],
      current_checkpoint_index: currentCheckpointIndex,
      race_started_at_wall_clock_ms: raceStartedAtWallClockMs,
      saved_at_ms: savedAtMs
    };
  }

  // The exact plain-object shape persisted for one locally recorded
  // split. `synced` is deliberately the ONLY sync-state field anywhere in
  // this feature (see install/11_RACE_COMMAND_CENTER.sql's header comment
  // -- the server schema has no sync-state column at all; a row existing
  // there already means synced).
  function buildSplitRecord({
    clientSplitId,
    raceSessionId,
    raceParticipantId,
    raceCheckpointId,
    elapsedSeconds = null,
    wallClockCapturedAtMs,
    captureMethod,
    packCaptureId = null,
    deviceId,
    revision = 1,
    isDns = false,
    isDnf = false,
    synced = false
  }) {
    return {
      client_split_id: clientSplitId,
      race_session_id: raceSessionId,
      race_participant_id: raceParticipantId,
      race_checkpoint_id: raceCheckpointId,
      elapsed_seconds: elapsedSeconds,
      wall_clock_captured_at_ms: wallClockCapturedAtMs,
      capture_method: captureMethod,
      pack_capture_id: packCaptureId,
      device_id: deviceId,
      revision,
      is_dns: isDns,
      is_dnf: isDnf,
      synced
    };
  }

  // The exact plain-object shape persisted for one local revision entry
  // -- mirrors race_split_revisions' shape before it is synced, so
  // pushing it to the server later is a direct field mapping.
  function buildRevisionRecord({
    clientSplitId,
    revision,
    elapsedSeconds,
    wallClockCapturedAtMs,
    captureMethod,
    changeReason,
    deviceId,
    recordedAtMs = Date.now()
  }) {
    return {
      client_split_id: clientSplitId,
      revision,
      elapsed_seconds: elapsedSeconds,
      wall_clock_captured_at_ms: wallClockCapturedAtMs,
      capture_method: captureMethod,
      change_reason: changeReason,
      device_id: deviceId,
      recorded_at_ms: recordedAtMs
    };
  }

  // ---------------------------------------------------------------------
  // IndexedDB access -- browser-only, verified with Playwright, not Node.
  // ---------------------------------------------------------------------

  let dbPromise = null;

  function openDatabase() {
    if (dbPromise) {
      return dbPromise;
    }

    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(STATE_STORE)) {
          db.createObjectStore(STATE_STORE, { keyPath: "race_session_id" });
        }

        if (!db.objectStoreNames.contains(SPLITS_STORE)) {
          const splits = db.createObjectStore(SPLITS_STORE, { keyPath: "client_split_id" });
          // Indexed on race_session_id only -- IndexedDB keys cannot be
          // booleans, so `synced` is never used as an index key. A race's
          // full split set is small (a handful of checkpoints times up
          // to a couple dozen runners), so filtering unsynced splits in
          // JS after fetching by session (see getUnsyncedSplits below) is
          // simple and fast enough, and avoids an invalid-key surprise.
          splits.createIndex("race_session_id", "race_session_id", { unique: false });
        }

        if (!db.objectStoreNames.contains(REVISIONS_STORE)) {
          const revisions = db.createObjectStore(REVISIONS_STORE, { keyPath: "id", autoIncrement: true });
          revisions.createIndex("client_split_id", "client_split_id", { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return dbPromise;
  }

  function runTransaction(storeName, mode, work) {
    return openDatabase().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      let result;

      Promise.resolve(work(store))
        .then((value) => { result = value; })
        .catch(reject);

      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    }));
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // -- race_state ----------------------------------------------------------

  function saveRaceState(stateRecord) {
    return runTransaction(STATE_STORE, "readwrite", (store) => requestToPromise(store.put(stateRecord)));
  }

  function getRaceState(raceSessionId) {
    return runTransaction(STATE_STORE, "readonly", (store) => requestToPromise(store.get(raceSessionId)));
  }

  function listRaceStates() {
    return runTransaction(STATE_STORE, "readonly", (store) => requestToPromise(store.getAll()));
  }

  function deleteRaceState(raceSessionId) {
    return runTransaction(STATE_STORE, "readwrite", (store) => requestToPromise(store.delete(raceSessionId)));
  }

  // -- race_splits_local -----------------------------------------------------

  function saveSplitLocal(splitRecord) {
    return runTransaction(SPLITS_STORE, "readwrite", (store) => requestToPromise(store.put(splitRecord)));
  }

  function getSplitsForSession(raceSessionId) {
    return runTransaction(SPLITS_STORE, "readonly", (store) => {
      const index = store.index("race_session_id");
      return requestToPromise(index.getAll(raceSessionId));
    });
  }

  function getUnsyncedSplits(raceSessionId) {
    return getSplitsForSession(raceSessionId).then((splits) => splits.filter((s) => !s.synced));
  }

  // Reads the single current local record for one split, by its
  // idempotency key. Used to re-check whether a record has changed
  // since a sync push was built from an earlier snapshot of it -- see
  // split-watch-live.js's triggerSync() for why this matters:
  // a push that was already in flight when a correction happened must
  // never let that correction get marked "synced" just because it
  // happens to be what's sitting in the local store when the earlier
  // push's response comes back.
  function getSplitLocal(clientSplitId) {
    return runTransaction(SPLITS_STORE, "readonly", (store) => requestToPromise(store.get(clientSplitId)));
  }

  function markSplitSynced(clientSplitId) {
    return runTransaction(SPLITS_STORE, "readwrite", (store) => {
      const getReq = store.get(clientSplitId);
      return requestToPromise(getReq).then((record) => {
        if (!record) {
          return null;
        }
        record.synced = true;
        return requestToPromise(store.put(record));
      });
    });
  }

  function deleteSplitsForSession(raceSessionId) {
    return getSplitsForSession(raceSessionId).then((splits) =>
      runTransaction(SPLITS_STORE, "readwrite", (store) => {
        splits.forEach((s) => store.delete(s.client_split_id));
        return Promise.resolve();
      })
    );
  }

  // -- race_revisions_local ---------------------------------------------------

  function saveRevisionLocal(revisionRecord) {
    return runTransaction(REVISIONS_STORE, "readwrite", (store) => requestToPromise(store.add(revisionRecord)));
  }

  function getRevisionsForSplit(clientSplitId) {
    return runTransaction(REVISIONS_STORE, "readonly", (store) => {
      const index = store.index("client_split_id");
      return requestToPromise(index.getAll(clientSplitId));
    });
  }

  // Full wipe -- used for the required manual test-race cleanup (delete
  // or isolate TEST data per the project's test conventions) and for a
  // coach explicitly discarding a stale local race.
  function clearAll() {
    return openDatabase().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction([STATE_STORE, SPLITS_STORE, REVISIONS_STORE], "readwrite");
      tx.objectStore(STATE_STORE).clear();
      tx.objectStore(SPLITS_STORE).clear();
      tx.objectStore(REVISIONS_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    }));
  }

  window.PodiumRaceStore = {
    generateClientSplitId,
    buildRaceStateRecord,
    buildSplitRecord,
    buildRevisionRecord,
    openDatabase,
    saveRaceState,
    getRaceState,
    listRaceStates,
    deleteRaceState,
    saveSplitLocal,
    getSplitsForSession,
    getUnsyncedSplits,
    getSplitLocal,
    markSplitSynced,
    deleteSplitsForSession,
    saveRevisionLocal,
    getRevisionsForSplit,
    clearAll
  };
})();
