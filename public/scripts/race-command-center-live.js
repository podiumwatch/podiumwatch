(() => {
  const loadingBox = document.querySelector("[data-rcc-loading]");
  const root = document.querySelector("[data-rcc-root]");
  const raceNameEl = document.querySelector("[data-rcc-race-name]");
  const syncStatusPill = document.querySelector("[data-rcc-sync-status]");
  const syncStatusText = document.querySelector("[data-rcc-sync-status-text]");
  const clockEl = document.querySelector("[data-rcc-clock]");
  const clockNoteEl = document.querySelector("[data-rcc-clock-note]");
  const messageBox = document.querySelector("[data-rcc-message]");
  const startScreen = document.querySelector("[data-rcc-start-screen]");
  const startButton = document.querySelector("[data-rcc-start-button]");
  const liveScreen = document.querySelector("[data-rcc-live-screen]");
  const checkpointTabs = document.querySelector("[data-rcc-checkpoint-tabs]");
  const checkpointIndicator = document.querySelector("[data-rcc-checkpoint-indicator]");
  const checkpointIndicatorValue = document.querySelector("[data-rcc-checkpoint-indicator-value]");
  const packToggle = document.querySelector("[data-rcc-pack-toggle]");
  const finishRaceButton = document.querySelector("[data-rcc-finish-race]");
  const restartRaceButton = document.querySelector("[data-rcc-restart-race]");
  const packBar = document.querySelector("[data-rcc-pack-bar]");
  const packCount = document.querySelector("[data-rcc-pack-count]");
  const packConfirm = document.querySelector("[data-rcc-pack-confirm]");
  const packCancel = document.querySelector("[data-rcc-pack-cancel]");
  const runnerList = document.querySelector("[data-rcc-runner-list]");
  const backLink = document.querySelector("[data-rcc-back-link]");
  const raceSwitcherWrap = document.querySelector("[data-rcc-race-switcher-wrap]");
  const raceSwitcher = document.querySelector("[data-rcc-race-switcher]");
  const stillCountEl = document.querySelector("[data-rcc-still-count]");
  const stillEmptyNote = document.querySelector("[data-rcc-still-empty]");
  const recordedHeading = document.querySelector("[data-rcc-recorded-heading]");
  const recordedCountEl = document.querySelector("[data-rcc-recorded-count]");
  const recordedList = document.querySelector("[data-rcc-recorded-list]");
  const raceDayOpenButton = document.querySelector("[data-rcc-race-day-open]");
  const raceDayDialog = document.querySelector("[data-rcc-race-day-dialog]");
  const raceDayCloseButton = document.querySelector("[data-rcc-race-day-close]");
  const raceDayReveal = document.querySelector("[data-rcc-race-day-reveal]");
  const raceDayRevealCode = document.querySelector("[data-rcc-race-day-reveal-code]");
  const raceDayCopyButton = document.querySelector("[data-rcc-race-day-copy]");
  const raceDayStatusEl = document.querySelector("[data-rcc-race-day-status]");
  const raceDayGenerateButton = document.querySelector("[data-rcc-race-day-generate]");
  const raceDayRevokeButton = document.querySelector("[data-rcc-race-day-revoke]");

  const requiredElements = [
    loadingBox, root, raceNameEl, syncStatusPill, syncStatusText, clockEl, clockNoteEl,
    messageBox, startScreen, startButton, liveScreen, checkpointTabs, checkpointIndicator,
    checkpointIndicatorValue, packToggle, finishRaceButton, restartRaceButton, packBar, packCount, packConfirm,
    packCancel, runnerList, backLink, raceSwitcherWrap, raceSwitcher, stillCountEl, stillEmptyNote, recordedHeading,
    recordedCountEl, recordedList, raceDayOpenButton, raceDayDialog, raceDayCloseButton,
    raceDayReveal, raceDayRevealCode, raceDayCopyButton, raceDayStatusEl,
    raceDayGenerateButton, raceDayRevokeButton
  ];
  if (requiredElements.some((el) => !el)) return;

  const params = new URLSearchParams(window.location.search);
  const teamId = String(params.get("id") || "").trim();
  const sessionId = String(params.get("race") || "").trim();
  if (teamId) backLink.href = "/race-command-center/?id=" + encodeURIComponent(teamId);

  const SESSIONS_ENDPOINT = "/api/race-command-center/sessions/";
  const SYNC_ENDPOINT = "/api/race-command-center/sync/";

  const Store = window.PodiumRaceStore;
  const Timer = window.PodiumRaceTimer.createRaceTimer();
  const RaceMath = window.PodiumRaceMath;
  const PaceSplits = window.PodiumPaceSplits;

  // A stable per-browser device identity, matching the pw_ prefix
  // convention -- persisted in localStorage so every split from this
  // device carries the same device_id across a whole race.
  const DEVICE_ID_KEY = "podium_rcc_device_id";
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = "pw_rcc_device_" + (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : String(Date.now()));
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }

  let detail = null;
  let splitsByClientId = new Map(); // client_split_id -> split record (local shape)
  let currentCheckpointIndex = 0;
  let packMode = false;
  let packSelected = new Set();
  // Which "still need a time" cards have their manual-entry/DNS/DNF row
  // expanded -- tracked outside the render function so it survives every
  // re-render (polling, a tap elsewhere) instead of silently re-collapsing
  // mid-use, matching the same reasoning as snapshotManualInputs() below.
  let expandedRunnerIds = new Set();
  let syncing = false;
  let wakeLockSentinel = null;
  let preRacePollHandle = null;
  let raceSwitcherSessions = [];

  const RACE_SWITCHER_STATUS_LABELS = {
    draft: "Draft", scheduled: "Scheduled", live: "Live",
    finished: "Finished", reviewed: "Reviewed"
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function showMessage(text, isError = false) {
    messageBox.textContent = text;
    messageBox.hidden = !text;
    messageBox.style.background = isError ? "rgba(220, 38, 38, 0.25)" : "rgba(255, 255, 255, 0.1)";
  }

  function parseClockToSeconds(text) {
    const cleaned = String(text ?? "").trim();
    if (!cleaned) return null;
    const parts = cleaned.split(":").map((p) => p.trim());
    if (parts.some((p) => p === "" || Number.isNaN(Number(p)))) return null;
    let seconds;
    if (parts.length === 3) seconds = Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
    else if (parts.length === 2) seconds = Number(parts[0]) * 60 + Number(parts[1]);
    else if (parts.length === 1) seconds = Number(parts[0]);
    else return null;
    return seconds >= 0 ? seconds : null;
  }

  function formatSecondsToClock(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
    if (PaceSplits && typeof PaceSplits.formatWholeTime === "function") return PaceSplits.formatWholeTime(seconds);
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return m + ":" + String(s).padStart(2, "0");
  }

  function parseResponse(response, fallback) {
    return response.json().catch(() => ({})).then((data) => {
      if (!response.ok) throw new Error(data.error || fallback);
      return data;
    });
  }

  async function apiFetch(endpoint, payload) {
    // Don't gate on a Supabase access token here -- a race-day access code
    // visitor has no Supabase session at all, but does have an HttpOnly
    // cookie the server will accept. Send the bearer token when we have one
    // (a real coach account) and let the browser send the cookie either way;
    // only redirect if the server actually says the request isn't allowed.
    const accessToken = await window.PodiumTeamAuth.getAccessToken();
    const headers = { Accept: "application/json", "Content-Type": "application/json" };
    if (accessToken) headers.Authorization = "Bearer " + accessToken;
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ team_id: teamId, session_id: sessionId, ...payload })
    });
    if (response.status === 401) window.location.replace("/race-command-center/join/");
    return parseResponse(response, "The request could not be completed.");
  }

  // ---- sync status display ---------------------------------------------------

  function setSyncStatus(status) {
    syncStatusPill.className = "rcc-status-pill rcc-status-" + status;
    const labels = {
      synced: "Synced", syncing: "Syncing...", saved: "Saved on device",
      offline: "Offline -- saved on device", needs_attention: "Sync needs attention"
    };
    syncStatusText.textContent = labels[status] || status;
  }

  // A new capture that arrives WHILE a sync is already in flight must
  // never be silently left waiting for the next 8-second interval tick --
  // resyncRequested records that intent and drains it the instant the
  // current sync finishes, so a rapid tap-then-correction sequence is
  // never coalesced away by an unlucky guard collision.
  let resyncRequested = false;

  function triggerSync() {
    if (syncing) {
      resyncRequested = true;
      return;
    }
    syncing = true;
    setSyncStatus("syncing");

    function finish(nextStatus) {
      setSyncStatus(nextStatus);
      syncing = false;
      if (resyncRequested) {
        resyncRequested = false;
        triggerSync();
      }
    }

    Store.getUnsyncedSplits(sessionId).then((unsynced) => {
      if (unsynced.length === 0) {
        finish(navigator.onLine ? "synced" : "offline");
        return;
      }

      return apiFetch(SYNC_ENDPOINT, {
        action: "push_splits",
        splits: unsynced.map((s) => ({
          client_split_id: s.client_split_id,
          race_participant_id: s.race_participant_id,
          race_checkpoint_id: s.race_checkpoint_id,
          elapsed_seconds: s.elapsed_seconds,
          wall_clock_captured_at: new Date(s.wall_clock_captured_at_ms).toISOString(),
          capture_method: s.capture_method,
          pack_capture_id: s.pack_capture_id,
          device_id: s.device_id,
          is_dns: s.is_dns,
          is_dnf: s.is_dnf,
          change_reason: s.change_reason || undefined
        }))
      }).then((result) => {
        // Only mark a split synced if its LOCAL record still matches
        // what was actually just sent -- not merely "whatever happens to
        // be stored under that id right now". If a correction (Undo, a
        // manual re-entry) landed locally WHILE this push was already in
        // flight, the local record has since moved on past the snapshot
        // this push was built from; blindly marking it synced would
        // silently swallow that correction forever, leaving the server
        // stuck on the stale value even though the UI believes
        // everything is synced. A real, live-verified bug was caught
        // exactly this way (see docs/DECISIONS.md).
        const sentByClientId = new Map(unsynced.map((s) => [s.client_split_id, s]));
        return Promise.all(result.results.map((r) => {
          const sent = sentByClientId.get(r.client_split_id);
          return Store.getSplitLocal(r.client_split_id).then((current) => {
            if (!current || !sent) return;
            const stillMatches =
              current.elapsed_seconds === sent.elapsed_seconds &&
              current.wall_clock_captured_at_ms === sent.wall_clock_captured_at_ms &&
              current.is_dns === sent.is_dns &&
              current.is_dnf === sent.is_dnf;
            if (stillMatches) {
              return Store.markSplitSynced(r.client_split_id);
            }
            // Leave it unsynced -- the next sync cycle (the drain this
            // very push triggers via resyncRequested, or the periodic
            // interval) will push the newer value for real.
          });
        }));
      })
        .then(() => finish("synced"))
        .catch(() => finish(navigator.onLine ? "needs_attention" : "offline"));
    }).catch(() => finish(navigator.onLine ? "needs_attention" : "offline"));
  }

  window.addEventListener("online", triggerSync);
  window.addEventListener("offline", () => setSyncStatus("offline"));
  setInterval(triggerSync, 8000);

  // ---- multi-device live sync --------------------------------------------------
  // triggerSync() above only ever PUSHES this device's own local splits up
  // -- it never pulls in what a DIFFERENT device (a second coach at
  // another checkpoint, a volunteer's phone) has captured. Without this,
  // two people timing the same live race would never see each other's
  // splits until someone fully reloads the page. Participants/
  // checkpoints/goals/targets are never locally queued offline, so the
  // fresh server copy is always safe to take directly; splits go through
  // the same loadMergedSplits() merge used at initial load, which
  // already guarantees a LOCAL unsynced record (this device's own
  // pending correction) always wins over whatever the server currently
  // has for that same client_split_id.
  let lastMergedFingerprint = "";

  function fingerprintCurrentState() {
    const splitsPart = [...splitsByClientId.values()]
      .map((s) => s.client_split_id + ":" + s.elapsed_seconds + ":" + s.wall_clock_captured_at_ms)
      .sort().join("|");
    const statusPart = detail.participants.map((p) => p.id + ":" + p.status).sort().join("|");
    return splitsPart + "##" + statusPart;
  }

  async function pullRemoteUpdates() {
    if (!detail || detail.session.status !== "live" || syncing) return;
    try {
      const fresh = await apiFetch(SYNC_ENDPOINT, { action: "pull_state" });

      // Another device restarted this race (false start) -- this
      // device's own in-memory/local state is now for the wrong start
      // moment. A full reload is the same deliberate, simple reset the
      // device that clicked Restart itself does; initialize() will see
      // the fresh non-live status and correctly show the pre-race screen.
      if (fresh.session.status !== "live") {
        window.location.reload();
        return;
      }

      detail.checkpoints = fresh.checkpoints;
      detail.participants = fresh.participants;
      detail.goals = fresh.goals;
      detail.targets = fresh.targets;
      detail.splits = fresh.splits;
      await loadMergedSplits();
      const fingerprint = fingerprintCurrentState();
      if (fingerprint !== lastMergedFingerprint) {
        lastMergedFingerprint = fingerprint;
        renderRunnerList();
      }
    } catch {
      // A failed background pull must never interrupt live timing --
      // the next interval tick tries again, and this device's own
      // recording/push path is completely unaffected either way.
    }
  }

  setInterval(pullRemoteUpdates, 11000);

  // A device sitting on the pre-race "waiting to start" screen never runs
  // pullRemoteUpdates above (it bails immediately when the session isn't
  // live yet), so without this a volunteer's phone would sit there forever
  // once the coach starts the race from a different device -- they'd have
  // to notice and manually refresh. Polls faster than the live-race sync
  // above since nothing expensive is happening yet (no splits to merge),
  // and stops itself the moment it sees the race go live.
  async function pollForRaceStart() {
    if (!detail || detail.session.status === "live" || syncing) return;
    try {
      const fresh = await apiFetch(SYNC_ENDPOINT, { action: "pull_state" });
      if (fresh.session.status !== "live") return;

      clearInterval(preRacePollHandle);
      preRacePollHandle = null;
      detail = fresh;
      const localState = await Store.getRaceState(sessionId);
      const anchorMs = localState?.race_started_at_wall_clock_ms || Date.parse(fresh.session.race_started_at);
      currentCheckpointIndex = localState?.current_checkpoint_index || 0;
      Timer.recoverFromWallClock(anchorMs);
      await beginLiveScreen("Recovered -- timing based on device clock");
    } catch {
      // A failed background check just tries again next tick.
    }
  }

  // ---- wake lock (feature-detected, never mandatory) -------------------------

  async function acquireWakeLock() {
    if (!("wakeLock" in navigator)) return;
    try {
      wakeLockSentinel = await navigator.wakeLock.request("screen");
    } catch {
      wakeLockSentinel = null;
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && liveScreen && !liveScreen.hidden) {
      acquireWakeLock();
    }
  });

  // ---- clock display (display-only -- never the source of a capture) --------

  function tickClock() {
    const result = Timer.elapsedOrRecovered();
    if (!result) return;
    clockEl.textContent = formatSecondsToClock(result.elapsedSeconds);
    clockNoteEl.textContent = result.precision === "recovered" ? "Recovered -- timing based on device clock" : "";
  }
  setInterval(tickClock, 200);

  // ---- data helpers -----------------------------------------------------------

  function currentCheckpoint() {
    return detail.checkpoints[currentCheckpointIndex];
  }

  function splitFor(participantId, checkpointId) {
    for (const split of splitsByClientId.values()) {
      if (split.race_participant_id === participantId && split.race_checkpoint_id === checkpointId && split.elapsed_seconds !== null) {
        return split;
      }
    }
    return null;
  }

  // Unlike splitFor(), this also matches an UNDONE record (elapsed_seconds
  // null). The schema allows only one race_splits row per
  // (participant, checkpoint) pair -- every re-record for a pair that
  // already has a row (undone or not) MUST reuse that row's
  // client_split_id, or the unique constraint rejects a second row.
  function rawSplitFor(participantId, checkpointId) {
    for (const split of splitsByClientId.values()) {
      if (split.race_participant_id === participantId && split.race_checkpoint_id === checkpointId) {
        return split;
      }
    }
    return null;
  }

  function goalAFor(participantId) {
    return detail.goals.find((g) => g.race_participant_id === participantId && g.goal_slot === "A");
  }

  function targetAtCheckpoint(participantId, checkpointId) {
    const t = detail.targets.find((t) => t.race_participant_id === participantId && t.race_checkpoint_id === checkpointId && t.goal_slot === "A");
    return t ? t.target_elapsed_seconds : null;
  }

  function loadMergedSplits() {
    splitsByClientId = new Map();
    (detail.splits || []).forEach((s) => {
      splitsByClientId.set(s.client_split_id, {
        client_split_id: s.client_split_id, race_session_id: sessionId,
        race_participant_id: s.race_participant_id, race_checkpoint_id: s.race_checkpoint_id,
        elapsed_seconds: s.elapsed_seconds, wall_clock_captured_at_ms: Date.parse(s.wall_clock_captured_at),
        capture_method: s.capture_method, pack_capture_id: s.pack_capture_id, device_id: s.device_id,
        is_dns: s.is_dns, is_dnf: s.is_dnf, synced: true
      });
    });

    return Store.getSplitsForSession(sessionId).then((localSplits) => {
      localSplits.forEach((s) => {
        if (!s.synced) splitsByClientId.set(s.client_split_id, s);
      });
    });
  }

  // ---- capture actions ---------------------------------------------------------

  function recordSplit({ participantId, checkpointId, elapsedSeconds, captureMethod, packCaptureId = null, wallClockCapturedAtMs = Date.now(), clientSplitId = null, changeReason = "recorded" }) {
    const finalClientSplitId = clientSplitId || Store.generateClientSplitId();
    const record = Store.buildSplitRecord({
      clientSplitId: finalClientSplitId, raceSessionId: sessionId, raceParticipantId: participantId,
      raceCheckpointId: checkpointId, elapsedSeconds, wallClockCapturedAtMs, captureMethod,
      packCaptureId, deviceId: deviceId, synced: false
    });
    record.change_reason = changeReason;

    // Update in-memory state and re-render IMMEDIATELY -- the tap is
    // acknowledged before anything touches IndexedDB or the network.
    splitsByClientId.set(finalClientSplitId, record);
    renderRunnerList();

    Store.saveSplitLocal(record).then(() => triggerSync());
    return finalClientSplitId;
  }

  function handleTap(participant) {
    const elapsedResult = Timer.elapsedOrRecovered();
    if (!elapsedResult) {
      showMessage("The race clock is not running yet.", true);
      return;
    }
    const checkpoint = currentCheckpoint();
    // Reuse an existing (possibly undone) row's client_split_id for this
    // exact participant+checkpoint pair -- the schema allows only one
    // race_splits row per pair, so a re-tap after Undo must correct that
    // same row, never mint a second one.
    const existing = rawSplitFor(participant.id, checkpoint.id);
    recordSplit({
      participantId: participant.id, checkpointId: checkpoint.id,
      elapsedSeconds: elapsedResult.elapsedSeconds, captureMethod: "single_tap",
      clientSplitId: existing ? existing.client_split_id : null,
      changeReason: existing ? "manual_correction" : "recorded"
    });
  }

  function handleUndo(participant) {
    const checkpoint = currentCheckpoint();
    const existing = splitFor(participant.id, checkpoint.id);
    if (!existing) return;
    recordSplit({
      participantId: participant.id, checkpointId: checkpoint.id, elapsedSeconds: null,
      captureMethod: "edited", clientSplitId: existing.client_split_id, changeReason: "undo"
    });
  }

  function handleManualEntry(participant, text) {
    const seconds = parseClockToSeconds(text);
    if (seconds === null) {
      showMessage("Enter a valid time (format m:ss).", true);
      return;
    }
    const checkpoint = currentCheckpoint();
    const anchorMs = Timer.getRaceStartWallClockMs();
    const wallClockCapturedAtMs = anchorMs ? anchorMs + Math.round(seconds * 1000) : Date.now();
    // rawSplitFor(), not splitFor() -- an existing but UNDONE row for this
    // pair must still be reused, never left to collide with a fresh insert.
    const existing = rawSplitFor(participant.id, checkpoint.id);
    recordSplit({
      participantId: participant.id, checkpointId: checkpoint.id, elapsedSeconds: seconds,
      captureMethod: existing ? "edited" : "manual_entry", wallClockCapturedAtMs,
      clientSplitId: existing ? existing.client_split_id : null,
      changeReason: existing ? "manual_correction" : "recorded"
    });
    showMessage("Manual time recorded for " + participantName(participant) + ".");
  }

  async function handleStatusChange(participant, status) {
    const labels = { dns: "mark this runner Did Not Start", dnf: "mark this runner Did Not Finish" };
    if (!window.confirm("Are you sure you want to " + (labels[status] || "change this runner's status") + "?")) return;
    try {
      await apiFetch(SYNC_ENDPOINT, { action: "set_participant_status", participant_id: participant.id, status });
      participant.status = status;
      renderRunnerList();
    } catch (error) {
      showMessage(error.message || "Status could not be updated.", true);
    }
  }

  function participantName(participant) {
    return participant.manual_name || participant.display_name || "Runner";
  }

  // ---- pack capture -------------------------------------------------------------

  packToggle.addEventListener("click", () => {
    packMode = !packMode;
    packSelected = new Set();
    packBar.hidden = !packMode;
    packToggle.textContent = packMode ? "Exit Pack Capture" : "Pack Capture";
    renderRunnerList();
  });

  packCancel.addEventListener("click", () => {
    packMode = false;
    packSelected = new Set();
    packBar.hidden = true;
    packToggle.textContent = "Pack Capture";
    renderRunnerList();
  });

  packConfirm.addEventListener("click", async () => {
    // The timestamp is frozen HERE, synchronously, before any network
    // call -- so network latency to mint the audit pack_capture row can
    // never affect the recorded time.
    const elapsedResult = Timer.elapsedOrRecovered();
    if (!elapsedResult) {
      showMessage("The race clock is not running yet.", true);
      return;
    }
    const capturedAtMs = Date.now();
    const checkpoint = currentCheckpoint();
    const selectedIds = [...packSelected];
    if (selectedIds.length === 0) return;

    selectedIds.forEach((participantId) => {
      const existing = rawSplitFor(participantId, checkpoint.id);
      recordSplit({
        participantId, checkpointId: checkpoint.id, elapsedSeconds: elapsedResult.elapsedSeconds,
        captureMethod: "pack_capture", wallClockCapturedAtMs: capturedAtMs,
        clientSplitId: existing ? existing.client_split_id : null,
        changeReason: existing ? "pack_capture_correction" : "recorded"
      });
    });

    showMessage("Captured " + selectedIds.length + " runner" + (selectedIds.length === 1 ? "" : "s") + " at " + formatSecondsToClock(elapsedResult.elapsedSeconds) + ".");

    packMode = false;
    packSelected = new Set();
    packBar.hidden = true;
    packToggle.textContent = "Pack Capture";
    renderRunnerList();

    // Best-effort audit linkage -- never blocks the already-recorded splits.
    try {
      await apiFetch(SYNC_ENDPOINT, {
        action: "create_pack_capture", checkpoint_id: checkpoint.id,
        captured_at: new Date(capturedAtMs).toISOString(), device_id: deviceId
      });
    } catch {
      // Splits are already recorded locally and will still sync; the
      // pack_capture audit row is a nice-to-have, not a requirement.
    }
  });

  // ---- checkpoint selection / finish -------------------------------------------
  // Which checkpoint THIS device is recording is a purely local,
  // per-device setting (see race-timer.js/race-local-store.js's own
  // design notes) -- never synced to the server or any other device.
  // That's deliberate: it's exactly what lets one phone sit on Mile 1
  // the whole race while a second phone sits on Mile 2, independently
  // and simultaneously. Switching is instant and freely reversible --
  // no confirmation dialog -- since it never discards or loses any
  // already-recorded split; it only changes which checkpoint's runner
  // list this device is currently looking at.

  function selectCheckpoint(index) {
    if (index < 0 || index >= detail.checkpoints.length || index === currentCheckpointIndex) return;
    currentCheckpointIndex = index;
    Store.saveRaceState(Store.buildRaceStateRecord({
      raceSessionId: sessionId, session: detail.session, checkpoints: detail.checkpoints,
      participants: detail.participants, goals: detail.goals, targets: detail.targets,
      currentCheckpointIndex, raceStartedAtWallClockMs: Timer.getRaceStartWallClockMs()
    }));
    renderRunnerList();
  }

  checkpointTabs.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-checkpoint-select]");
    if (!tab) return;
    const index = detail.checkpoints.findIndex((cp) => cp.id === tab.dataset.checkpointSelect);
    if (index !== -1) selectCheckpoint(index);
  });

  function renderCheckpointTabs() {
    const activeId = currentCheckpoint().id;
    checkpointIndicator.hidden = false;
    checkpointIndicatorValue.textContent = currentCheckpoint().label + (currentCheckpoint().is_finish ? " (Finish)" : "");

    checkpointTabs.innerHTML = detail.checkpoints.map((cp) => {
      const remaining = detail.participants.filter((p) => {
        if (p.status === "dns" || p.status === "dnf") return false;
        return !splitFor(p.id, cp.id);
      }).length;
      const active = cp.id === activeId;
      return (
        '<button class="rcc-checkpoint-tab' + (active ? " rcc-checkpoint-tab-active" : "") + '" type="button" data-checkpoint-select="' + escapeHtml(cp.id) + '">' +
          '<span class="rcc-checkpoint-tab-label">' + escapeHtml(cp.label) + (cp.is_finish ? " (Finish)" : "") + '</span>' +
          '<span class="rcc-checkpoint-tab-count">' + remaining + " still needed</span>" +
        '</button>'
      );
    }).join("");
  }

  finishRaceButton.addEventListener("click", async () => {
    if (!window.confirm("Finish this race? You can still review and correct splits afterward.")) return;
    try {
      await apiFetch(SESSIONS_ENDPOINT, { action: "finish_race" });
      window.location.href = "/race-command-center/review/?id=" + encodeURIComponent(teamId) + "&race=" + encodeURIComponent(sessionId);
    } catch (error) {
      showMessage(error.message || "This race could not be finished.", true);
    }
  });

  // A false start, or Start Race getting pressed too early -- wipes every
  // split recorded so far (they're relative to the wrong start moment)
  // and puts the race back on the pre-race screen for a clean real start.
  // A full reload afterward is deliberate: it's the simplest reliable way
  // to guarantee every piece of in-memory/local state (timer anchors,
  // checkpoint index, local IndexedDB record) resets to genuinely nothing,
  // matching how Finish Race already just navigates away rather than
  // trying to patch live state in place.
  restartRaceButton.addEventListener("click", async () => {
    if (!window.confirm("Restart this race? Every time recorded so far will be permanently lost, and the race goes back to \"Ready to start.\" Use this for a false start.")) return;
    restartRaceButton.disabled = true;
    try {
      await apiFetch(SESSIONS_ENDPOINT, { action: "restart_race" });
      await Store.deleteSplitsForSession(sessionId);
      await Store.deleteRaceState(sessionId);
      window.location.reload();
    } catch (error) {
      showMessage(error.message || "This race could not be restarted.", true);
      restartRaceButton.disabled = false;
    }
  });

  // ---- rendering -----------------------------------------------------------------

  // A full innerHTML rebuild wipes any in-progress typing in every OTHER
  // runner's manual-entry box, not just the one that changed -- a real
  // bug found during the live-timing diagnostic (tap Runner A while
  // mid-typing a manual correction for Runner B, and Runner B's
  // half-typed value and focus both vanish). Snapshotting non-empty
  // values (and which one was focused) before a rebuild and restoring
  // them after closes that gap without needing a full DOM-diffing
  // rewrite of the renderer.
  function snapshotManualInputs() {
    const snapshot = {};
    runnerList.querySelectorAll("[data-manual-input]").forEach((input) => {
      if (input.value) {
        snapshot[input.dataset.manualInput] = { value: input.value, focused: document.activeElement === input, selectionStart: input.selectionStart };
      }
    });
    return snapshot;
  }

  function restoreManualInputs(snapshot) {
    for (const [participantId, state] of Object.entries(snapshot)) {
      const input = runnerList.querySelector('[data-manual-input="' + CSS.escape(participantId) + '"]');
      if (!input) continue;
      input.value = state.value;
      if (state.focused) {
        input.focus();
        input.setSelectionRange(state.selectionStart, state.selectionStart);
      }
    }
  }

  function renderRunnerList() {
    const checkpoint = currentCheckpoint();
    renderCheckpointTabs();

    const participantsWithTargets = detail.participants.map((p) => ({
      id: p.id,
      targetsByCheckpoint: { [checkpoint.id]: targetAtCheckpoint(p.id, checkpoint.id) }
    })).filter((p) => p.targetsByCheckpoint[checkpoint.id] != null);

    const targetOrderIds = RaceMath.computeExpectedOrder(participantsWithTargets, checkpoint.id).map((p) => p.id);

    // A runner without a per-checkpoint pacing target yet (no Strategy
    // saved for them on the Plan page) still has a raw Goal A finish time
    // most of the time -- sort those by that instead of leaving them in
    // arbitrary roster order. Fastest goal first is the point: a volunteer
    // watching runners cross a checkpoint shouldn't have to scroll past a
    // pile of unsorted names to find whoever's arriving next.
    const goalOnlyOrderIds = detail.participants
      .filter((p) => !targetOrderIds.includes(p.id))
      .map((p) => ({ id: p.id, goalSeconds: goalAFor(p.id)?.goal_seconds }))
      .filter((p) => p.goalSeconds != null)
      .sort((a, b) => a.goalSeconds - b.goalSeconds)
      .map((p) => p.id);

    const orderIds = [...targetOrderIds, ...goalOnlyOrderIds];
    const ordered = [...detail.participants].sort((a, b) => {
      const ai = orderIds.indexOf(a.id);
      const bi = orderIds.indexOf(b.id);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

    if (packMode) {
      // Pack Capture stays one unified list, everyone selectable --
      // splitting recorded/unrecorded doesn't make sense for "select
      // everyone crossing right now."
      stillEmptyNote.hidden = true;
      stillCountEl.textContent = "";
      recordedHeading.hidden = true;
      recordedList.innerHTML = "";

      runnerList.innerHTML = ordered.map((participant) => {
        const excluded = participant.status === "dns" || participant.status === "dnf";
        const checked = packSelected.has(participant.id) ? " checked" : "";
        return (
          '<div class="rcc-runner-card' + (excluded ? " rcc-runner-card-excluded" : "") + '" data-runner-card="' + escapeHtml(participant.id) + '">' +
            '<div class="rcc-runner-top"><h3>' + escapeHtml(participantName(participant)) + '</h3><span class="rcc-runner-meta">' + escapeHtml(participant.status) + '</span></div>' +
            '<label class="rcc-runner-tap" style="display:flex;align-items:center;justify-content:center;gap:10px;background:transparent;border:2px solid rgba(255,255,255,0.4);color:#fff;">' +
              '<input type="checkbox" class="rcc-pack-checkbox" data-pack-select="' + escapeHtml(participant.id) + '"' + checked + '> Select</label>' +
          '</div>'
        );
      }).join("");
      packCount.textContent = packSelected.size + " selected";
      return;
    }

    const stillNeed = [];
    const recorded = [];
    ordered.forEach((participant) => {
      const split = splitFor(participant.id, checkpoint.id);
      if (split) recorded.push({ participant, split }); else stillNeed.push(participant);
    });
    // Most-recently-captured first -- the natural order for "let me
    // glance at what I just did," not the pre-race target order (which
    // is unstable to scan against once a race is genuinely underway).
    recorded.sort((a, b) => b.split.wall_clock_captured_at_ms - a.split.wall_clock_captured_at_ms);

    const inputSnapshot = snapshotManualInputs();

    stillCountEl.textContent = stillNeed.length + (stillNeed.length === 1 ? " runner" : " runners");
    stillEmptyNote.hidden = stillNeed.length > 0;

    // One compact row per runner -- name and the big Tap button side by
    // side, not stacked -- so 8+ runners fit on screen at once instead of
    // 2-3. Goal/target isn't needed to just record a split (it's for
    // pacing review, not live capture) so it's dropped from this view
    // entirely. Manual entry and DNS/DNF are still fully available, just
    // tucked behind the small "more" toggle instead of always-open rows,
    // since they're the exception case, not the common tap.
    runnerList.innerHTML = stillNeed.map((participant) => {
      const excluded = participant.status === "dns" || participant.status === "dnf";
      const expanded = expandedRunnerIds.has(participant.id);
      return (
        '<div class="rcc-runner-card' + (excluded ? " rcc-runner-card-excluded" : "") + '" data-runner-card="' + escapeHtml(participant.id) + '">' +
          '<div class="rcc-runner-row">' +
            '<span class="rcc-runner-name">' + escapeHtml(participantName(participant)) + (excluded ? " (" + escapeHtml(participant.status.toUpperCase()) + ")" : "") + '</span>' +
            '<button class="rcc-runner-tap" type="button" data-tap="' + escapeHtml(participant.id) + '">Tap</button>' +
            '<button class="rcc-runner-more" type="button" data-more-toggle="' + escapeHtml(participant.id) + '" aria-label="More options for ' + escapeHtml(participantName(participant)) + '" aria-expanded="' + expanded + '">&ctdot;</button>' +
          '</div>' +
          '<div class="rcc-runner-expand" data-runner-expand="' + escapeHtml(participant.id) + '"' + (expanded ? "" : " hidden") + '>' +
            '<div class="rcc-manual-entry"><input type="text" placeholder="Manual time m:ss" data-manual-input="' + escapeHtml(participant.id) + '">' +
            '<button class="rcc-runner-small-btn" type="button" data-manual-save="' + escapeHtml(participant.id) + '">Save</button></div>' +
            '<div class="rcc-runner-row-actions">' +
              '<button class="rcc-runner-small-btn" type="button" data-dns="' + escapeHtml(participant.id) + '">DNS</button>' +
              '<button class="rcc-runner-small-btn" type="button" data-dnf="' + escapeHtml(participant.id) + '">DNF</button>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }).join("");

    restoreManualInputs(inputSnapshot);

    recordedHeading.hidden = recorded.length === 0;
    recordedCountEl.textContent = recorded.length + (recorded.length === 1 ? " runner" : " runners");
    recordedList.innerHTML = recorded.map(({ participant, split }) => {
      const isManual = split.capture_method === "manual_entry" || split.capture_method === "edited";
      return (
        '<div class="rcc-recorded-row' + (isManual ? " rcc-recorded-row-manual" : "") + '" data-runner-card="' + escapeHtml(participant.id) + '">' +
          '<span class="rcc-recorded-row-name">' + escapeHtml(participantName(participant)) + '</span>' +
          '<span class="rcc-recorded-row-right">' +
            '<span class="rcc-recorded-row-value">' + escapeHtml(formatSecondsToClock(split.elapsed_seconds)) + (isManual ? " (manual)" : "") + '</span>' +
            '<button class="rcc-runner-small-btn" type="button" data-undo="' + escapeHtml(participant.id) + '">Undo</button>' +
          '</span>' +
        '</div>'
      );
    }).join("");
  }

  runnerList.addEventListener("click", (event) => {
    const tap = event.target.closest("[data-tap]");
    if (tap) {
      const participant = detail.participants.find((p) => p.id === tap.dataset.tap);
      if (participant) handleTap(participant);
      return;
    }
    const moreToggle = event.target.closest("[data-more-toggle]");
    if (moreToggle) {
      const id = moreToggle.dataset.moreToggle;
      const expand = runnerList.querySelector('[data-runner-expand="' + CSS.escape(id) + '"]');
      if (!expand) return;
      const nowExpanded = expand.hidden;
      expand.hidden = !nowExpanded;
      moreToggle.setAttribute("aria-expanded", String(nowExpanded));
      if (nowExpanded) expandedRunnerIds.add(id); else expandedRunnerIds.delete(id);
      return;
    }
    const manualSave = event.target.closest("[data-manual-save]");
    if (manualSave) {
      const participant = detail.participants.find((p) => p.id === manualSave.dataset.manualSave);
      const input = runnerList.querySelector('[data-manual-input="' + CSS.escape(manualSave.dataset.manualSave) + '"]');
      if (participant && input) handleManualEntry(participant, input.value);
      return;
    }
    const dns = event.target.closest("[data-dns]");
    if (dns) {
      const participant = detail.participants.find((p) => p.id === dns.dataset.dns);
      if (participant) handleStatusChange(participant, "dns");
      return;
    }
    const dnf = event.target.closest("[data-dnf]");
    if (dnf) {
      const participant = detail.participants.find((p) => p.id === dnf.dataset.dnf);
      if (participant) handleStatusChange(participant, "dnf");
    }
  });

  // Undo lives in the compact Recorded list now, not the "still need a
  // time" list -- same handler, separate delegation root.
  recordedList.addEventListener("click", (event) => {
    const undo = event.target.closest("[data-undo]");
    if (!undo) return;
    const participant = detail.participants.find((p) => p.id === undo.dataset.undo);
    if (participant) handleUndo(participant);
  });

  runnerList.addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-pack-select]");
    if (!checkbox) return;
    const id = checkbox.dataset.packSelect;
    if (checkbox.checked) packSelected.add(id); else packSelected.delete(id);
    packCount.textContent = packSelected.size + " selected";
  });

  // ---- start / recovery -----------------------------------------------------------

  async function beginLiveScreen(clockNote) {
    startScreen.hidden = true;
    liveScreen.hidden = false;
    clockNoteEl.textContent = clockNote || "";
    await loadMergedSplits();
    renderRunnerList();
    lastMergedFingerprint = fingerprintCurrentState();
    triggerSync();
    acquireWakeLock();
  }

  // --- race day access (share this team's code with a volunteer timer) ------
  // Same generate/status/reveal-once/revoke pattern as Team Home, the RCC
  // hub, and the Plan page -- reachable here too since "I need help timing
  // this" is exactly a pre-race-screen thought. See docs/DECISIONS.md,
  // 2026-08-20.

  function formatDateTime(isoText) {
    const date = new Date(String(isoText || ""));
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      " at " + date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  function renderRaceDayStatus(status, keepReveal = false) {
    if (!keepReveal) raceDayReveal.hidden = true;

    if (!status || !status.active) {
      raceDayStatusEl.innerHTML =
        '<strong>Race day access is off.</strong>' +
        '<div class="rcc-item-meta">No volunteer code is active for this team right now.</div>';
      raceDayGenerateButton.textContent = "Generate code";
      raceDayRevokeButton.hidden = true;
      return;
    }

    const created = formatDateTime(status.created_at);
    const lastUsed = formatDateTime(status.last_used_at);
    raceDayStatusEl.innerHTML =
      '<strong>Race day access is on.</strong>' +
      '<div class="rcc-item-meta">' +
        (created ? "Created " + created : "Active") +
        " · " + (lastUsed ? "Last used " + lastUsed : "Not used yet") +
      '</div>';
    raceDayGenerateButton.textContent = "Regenerate code";
    raceDayRevokeButton.hidden = false;
  }

  raceDayOpenButton.addEventListener("click", async () => {
    raceDayDialog.showModal();
    try {
      const statusData = await apiFetch("/api/team/race-day-code/", { action: "status" });
      renderRaceDayStatus(statusData.status);
    } catch (error) {
      raceDayStatusEl.textContent = error.message || "Race day access status could not be loaded.";
    }
  });

  raceDayCloseButton.addEventListener("click", () => raceDayDialog.close());

  raceDayGenerateButton.addEventListener("click", async () => {
    raceDayGenerateButton.disabled = true;
    try {
      const generated = await apiFetch("/api/team/race-day-code/", { action: "regenerate" });
      raceDayRevealCode.textContent = generated.code;
      raceDayReveal.hidden = false;
      raceDayCopyButton.textContent = "Copy";
      const statusData = await apiFetch("/api/team/race-day-code/", { action: "status" });
      renderRaceDayStatus(statusData.status, true);
    } catch (error) {
      showMessage(error.message || "The code could not be generated.", true);
    } finally {
      raceDayGenerateButton.disabled = false;
    }
  });

  raceDayRevokeButton.addEventListener("click", async () => {
    if (!window.confirm("Turn off race day access? Anyone currently using the code will be signed out.")) return;
    raceDayRevokeButton.disabled = true;
    try {
      await apiFetch("/api/team/race-day-code/", { action: "revoke" });
      const statusData = await apiFetch("/api/team/race-day-code/", { action: "status" });
      renderRaceDayStatus(statusData.status);
    } catch (error) {
      showMessage(error.message || "Race day access could not be turned off.", true);
    } finally {
      raceDayRevokeButton.disabled = false;
    }
  });

  raceDayCopyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(raceDayRevealCode.textContent || "");
      raceDayCopyButton.textContent = "Copied";
      setTimeout(() => { raceDayCopyButton.textContent = "Copy"; }, 2000);
    } catch {
      // Clipboard API can fail (permissions, non-secure context) -- the
      // code is already visible on screen, so this is a soft failure.
    }
  });

  startButton.addEventListener("click", async () => {
    startButton.disabled = true;
    try {
      const { raceStartWallClockMs } = Timer.startRace();
      await Store.saveRaceState(Store.buildRaceStateRecord({
        raceSessionId: sessionId, session: detail.session, checkpoints: detail.checkpoints,
        participants: detail.participants, goals: detail.goals, targets: detail.targets,
        currentCheckpointIndex: 0, raceStartedAtWallClockMs: raceStartWallClockMs
      }));
      await apiFetch(SESSIONS_ENDPOINT, { action: "start_race", race_started_at: new Date(raceStartWallClockMs).toISOString() });
      detail.session.status = "live";
      // This device is starting the race itself with a fresh monotonic
      // clock -- stop the pre-race poll so a stray in-flight tick can't
      // clobber that with a lower-precision wall-clock "recovered" anchor.
      if (preRacePollHandle) { clearInterval(preRacePollHandle); preRacePollHandle = null; }
      await beginLiveScreen("");
    } catch (error) {
      showMessage(error.message || "The race could not be started.", true);
      startButton.disabled = false;
    }
  });

  // A team running JH/HS boys/girls races on the same day previously had
  // to back all the way out to the full race list to jump from one live
  // race to another. This surfaces just today's other races right at the
  // top -- live ones first -- so switching is one tap, not a full detour.
  // Available to a race-day volunteer too, not just a signed-in coach --
  // listing/switching races needs no more privilege than timing already
  // requires.
  async function populateRaceSwitcher() {
    try {
      const data = await apiFetch(SESSIONS_ENDPOINT, { action: "list" });
      const today = detail.session.race_date;
      raceSwitcherSessions = (data.sessions || [])
        .filter((s) => s.id !== sessionId && s.race_date === today && s.status !== "cancelled")
        .sort((a, b) => {
          const rank = (s) => (s.status === "live" ? 0 : 1);
          const diff = rank(a) - rank(b);
          return diff !== 0 ? diff : a.name.localeCompare(b.name);
        });

      if (raceSwitcherSessions.length === 0) return;

      raceSwitcher.innerHTML =
        '<option value="">This race -- ' + escapeHtml(detail.session.name) + '</option>' +
        raceSwitcherSessions.map((s) => (
          '<option value="' + escapeHtml(s.id) + '">' + escapeHtml(s.name) + ' (' + escapeHtml(RACE_SWITCHER_STATUS_LABELS[s.status] || s.status) + ')</option>'
        )).join("");
      raceSwitcherWrap.hidden = false;
    } catch {
      // A switcher that fails to populate just stays hidden -- it must
      // never block or interrupt the race this device is actually here
      // to time.
    }
  }

  raceSwitcher.addEventListener("change", () => {
    const targetId = raceSwitcher.value;
    if (!targetId) return;
    const target = raceSwitcherSessions.find((s) => s.id === targetId);
    if (!target) return;
    const idPart = "?id=" + encodeURIComponent(teamId) + "&race=" + encodeURIComponent(target.id);
    if (target.status === "live") {
      window.location.href = "/race-command-center/live/" + idPart;
    } else if (target.status === "finished" || target.status === "reviewed") {
      window.location.href = "/race-command-center/review/" + idPart;
    } else {
      window.location.href = "/race-command-center/plan/" + idPart;
    }
  });

  async function initialize() {
    if (!teamId || !sessionId) {
      loadingBox.innerHTML = "<h2>Race not found</h2><p>This link is missing a team or race id.</p>";
      return;
    }

    try {
      // Don't hard-gate on a Supabase user here -- a race-day access code
      // visitor never has one. Let the actual API call (authorized via
      // bearer token OR the race-day cookie, server-side) decide.
      detail = await apiFetch(SYNC_ENDPOINT, { action: "pull_state" });

      if (detail.session.status === "finished" || detail.session.status === "reviewed") {
        window.location.replace("/race-command-center/review/?id=" + encodeURIComponent(teamId) + "&race=" + encodeURIComponent(sessionId));
        return;
      }

      raceNameEl.textContent = detail.session.name;
      loadingBox.hidden = true;
      root.hidden = false;
      populateRaceSwitcher();

      // Managing the race day code always requires a real coach account
      // (api/team/race-day-code.js), never the race-day cookie a
      // volunteer may have landed here with -- only show the button at
      // all for a signed-in coach.
      const user = await window.PodiumTeamAuth.getUser();
      if (user) raceDayOpenButton.hidden = false;

      if (detail.session.status === "live") {
        const localState = await Store.getRaceState(sessionId);
        const anchorMs = localState?.race_started_at_wall_clock_ms || Date.parse(detail.session.race_started_at);
        currentCheckpointIndex = localState?.current_checkpoint_index || 0;
        Timer.recoverFromWallClock(anchorMs);
        await beginLiveScreen("Recovered -- timing based on device clock");
      } else {
        startScreen.hidden = false;
        preRacePollHandle = setInterval(pollForRaceStart, 4000);
      }
    } catch (error) {
      loadingBox.innerHTML =
        "<h2>This race could not be loaded</h2><p>" + escapeHtml(error.message || "Please try again.") + "</p>" +
        '<p><a class="rcc-live-btn rcc-live-btn-primary" href="/race-command-center/?id=' + encodeURIComponent(teamId) + '">Back to Race Command Center</a></p>';
    }
  }

  initialize();
})();
