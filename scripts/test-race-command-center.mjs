import assert from "node:assert/strict";
import process from "node:process";

// lib/race_command_center_service.mjs imports lib/supabase-admin.mjs,
// which calls createClient() at module load time and throws if these
// env vars are absent -- this test suite only exercises that service
// file's pure, no-database functions, but importing the module at all
// still triggers that top-level call. Matches the same fallback pattern
// scripts/test-path-to-state.mjs already uses for the same reason.
process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY ||= "test-service-role-key";

// public/scripts/race-math.js and public/scripts/pace-splits.js are plain
// classic scripts (see pace-splits.js's own header for why), so they
// attach their functions to window rather than using export. A minimal
// window stub is all Node needs to load them directly here, matching
// scripts/test-pace-calculator.mjs's established pattern. pace-splits.js
// must load first -- race-math.js reads window.PodiumPaceSplits at
// module-init time, mirroring the real page <script> tag order
// (src/pages/pacecalculator.mjs loads pace-splits.js before any script
// that depends on it).
global.window = {};
await import("../public/scripts/pace-splits.js");
await import("../public/scripts/race-math.js");
await import("../public/scripts/race-timer.js");
// race-local-store.js only touches indexedDB inside functions that get
// called, never at module-load time, so it can be imported in Node with
// no indexedDB global present at all -- see the record-builder tests
// below, which are the only part of this file this suite exercises. The
// actual IndexedDB read/write calls are verified separately with a
// one-off Playwright harness against a real Chromium instance (matching
// how public/scripts/path-to-state.js's rendering was verified), not as
// part of this automated suite, since Node has no real IndexedDB.
await import("../public/scripts/race-local-store.js");

const {
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
} = global.window.PodiumRaceMath;

const { MILE_METERS, KM_METERS } = global.window.PodiumPaceSplits;
const { createRaceTimer } = global.window.PodiumRaceTimer;
const {
  generateClientSplitId,
  buildRaceStateRecord,
  buildSplitRecord,
  buildRevisionRecord
} = global.window.PodiumRaceStore;

// --- computeEvenPaceTargets --------------------------------------------------
// A 5K (5000m) with three coach-defined, irregularly-spaced checkpoints and
// a 17:00 (1020s) goal.

{
  const checkpoints = [
    { id: "cp1", distanceMeters: 1600 },
    { id: "cp2", distanceMeters: 3200 },
    { id: "cp3", distanceMeters: 5000 }
  ];
  const targets = computeEvenPaceTargets({ distanceMeters: 5000, goalSeconds: 1020, checkpoints });

  assert.equal(targets.length, 3);
  assert.ok(Math.abs(targets[0].cumulativeSeconds - 1020 * (1600 / 5000)) < 0.0001, "First checkpoint target must follow the proportional formula.");
  assert.ok(Math.abs(targets[1].cumulativeSeconds - 1020 * (3200 / 5000)) < 0.0001, "Second checkpoint target must follow the proportional formula.");
  assert.ok(Math.abs(targets[2].cumulativeSeconds - 1020) < 0.0001, "The final checkpoint's target must equal the full goal time exactly.");
  assert.equal(targets[0].checkpointId, "cp1", "Each target must carry its checkpoint's id through unchanged.");

  assert.deepEqual(computeEvenPaceTargets({ distanceMeters: 0, goalSeconds: 1020, checkpoints }), [], "Zero distance must return no targets, never NaN targets.");
  assert.deepEqual(computeEvenPaceTargets({ distanceMeters: 5000, goalSeconds: -1, checkpoints }), [], "A non-positive goal time must return no targets.");
  assert.deepEqual(computeEvenPaceTargets({ distanceMeters: 5000, goalSeconds: 1020, checkpoints: null }), [], "A missing checkpoints array must never throw.");
}

// --- validateCustomPaceTargets ----------------------------------------------
// Custom Pace targets must be strictly increasing and are never
// auto-corrected -- only validated.

{
  assert.deepEqual(validateCustomPaceTargets([320, 640, 1020]), { valid: true }, "Strictly increasing checkpoint times must be valid.");

  const tie = validateCustomPaceTargets([320, 320, 1020]);
  assert.equal(tie.valid, false, "Two equal checkpoint times must be invalid -- a runner cannot arrive at two checkpoints at once.");
  assert.equal(tie.firstInvalidIndex, 1, "The invalid index must point at the offending entry, not the one before it.");

  const outOfOrder = validateCustomPaceTargets([320, 200, 1020]);
  assert.equal(outOfOrder.valid, false, "A checkpoint time that goes backward must be invalid.");
  assert.equal(outOfOrder.firstInvalidIndex, 1);

  assert.equal(validateCustomPaceTargets([]).valid, false, "An empty target list must be invalid, never treated as trivially valid.");
  assert.equal(validateCustomPaceTargets([0, 100]).valid, false, "The first checkpoint must be strictly after the start (time 0), not at it.");
  assert.equal(validateCustomPaceTargets([NaN, 100]).valid, false, "A non-finite entry must be invalid, never silently pass.");
}

// --- computeSegmentTime / computeAveragePace --------------------------------

{
  assert.equal(computeSegmentTime(320, 640), 320, "A segment is simply the difference of two cumulative times.");
  assert.equal(computeAveragePace(1020, 5000, MILE_METERS), 1020 * (MILE_METERS / 5000), "Average pace must scale by the unit/distance ratio, matching pace-splits.js's paceForUnit formula.");
  assert.equal(computeAveragePace(1020, 5000, KM_METERS), 1020 * (KM_METERS / 5000));
  assert.equal(computeAveragePace(1020, 0, KM_METERS), null, "Zero distance must return null, never divide by zero.");
}

// --- computeDiffFromTarget ---------------------------------------------------

{
  assert.equal(computeDiffFromTarget(310, 320), 10, "Arriving 10s before target must be a positive (ahead) diff.");
  assert.equal(computeDiffFromTarget(330, 320), -10, "Arriving 10s after target must be a negative (behind) diff.");
  assert.equal(computeDiffFromTarget(320, 320), 0);
}

// --- computeGoalStatus --------------------------------------------------------
// Each goal slot's status must be computed independently -- never merged
// across goals into one summary value.

{
  assert.equal(computeGoalStatus({ diffFromTargetSeconds: 15, distanceRemainingMeters: 2000 }), "ahead", "A large positive diff (well ahead) must be 'ahead', not 'on_pace'.");
  assert.equal(computeGoalStatus({ diffFromTargetSeconds: 1, distanceRemainingMeters: 2000 }), "on_pace", "A small positive diff within tolerance must be 'on_pace'.");
  assert.equal(computeGoalStatus({ diffFromTargetSeconds: -1, distanceRemainingMeters: 2000 }), "on_pace", "A small negative diff within tolerance must still be 'on_pace', not 'at_risk'.");
  assert.equal(computeGoalStatus({ diffFromTargetSeconds: -15, distanceRemainingMeters: 2000 }), "at_risk", "A large negative diff with race left must be 'at_risk', not yet 'missed'.");
  assert.equal(computeGoalStatus({ diffFromTargetSeconds: -15, distanceRemainingMeters: 0 }), "missed", "A negative diff with no race left must be 'missed'.");
  assert.equal(computeGoalStatus({ diffFromTargetSeconds: 0, distanceRemainingMeters: 0 }), "on_pace", "Hitting the target exactly at the finish must be 'on_pace', never 'missed'.");
}

// --- computeRequiredRemaining vs. computeCurrentPaceProjection --------------
// The spec's explicit anti-merging requirement: "current pace projects X"
// and "required pace to hit goal is Y" must remain two separate
// statements the UI can never accidentally combine into one misleading
// number. Verified structurally here by asserting the two return shapes
// share no field name.

{
  const required = computeRequiredRemaining({ goalSeconds: 1020, elapsedSoFarSeconds: 640, distanceRemainingMeters: 1800 });
  assert.ok(Math.abs(required.requiredSeconds - 380) < 0.0001, "Required remaining time must be goal minus elapsed so far.");
  assert.ok(required.requiredPacePerMile > 0 && required.requiredPacePerKm > 0, "Required pace must be reported for both common units.");

  const zeroRemaining = computeRequiredRemaining({ goalSeconds: 1020, elapsedSoFarSeconds: 1020, distanceRemainingMeters: 0 });
  assert.equal(zeroRemaining.requiredPacePerMile, null, "With no distance remaining, a required pace cannot be computed and must be null, never a divide-by-zero artifact.");

  const projection = computeCurrentPaceProjection({ elapsedSoFarSeconds: 640, distanceCompletedMeters: 3200, distanceTotalMeters: 5000 });
  assert.ok(Math.abs(projection.projectedFinishSeconds - 640 * (5000 / 3200)) < 0.0001, "Current-pace projection must be a straight-line extrapolation of pace so far.");

  const requiredKeys = Object.keys(required).sort();
  const projectionKeys = Object.keys(projection).sort();
  assert.deepEqual(
    requiredKeys.filter((k) => projectionKeys.includes(k)),
    [],
    "computeRequiredRemaining() and computeCurrentPaceProjection() must share no field name, so the UI can never merge 'required to hit goal' and 'current pace projects' into one misleading number."
  );
}

// --- computeExpectedOrder -----------------------------------------------------
// Purely advisory -- this function only produces a sort order, it never
// gates which runner a coach is allowed to record a split for.

{
  const participants = [
    { id: "a", targetsByCheckpoint: { cp1: 320 } },
    { id: "b", targetsByCheckpoint: { cp1: 300 } },
    { id: "c", targetsByCheckpoint: { cp1: 340 } },
    { id: "d", targetsByCheckpoint: {} }
  ];
  const order = computeExpectedOrder(participants, "cp1");
  assert.deepEqual(order.map((p) => p.id), ["b", "a", "c"], "Expected order must sort by target arrival time at the given checkpoint, fastest first, skipping runners with no target at that checkpoint.");
}

// --- deriveCoachingCue ---------------------------------------------------------
// A fixed, deterministic rule table -- no randomness, no network, no AI.

{
  assert.equal(deriveCoachingCue({ diffFromTargetSeconds: -20, distanceRemainingMeters: 0, goalStatus: "missed" }), "race_by_feel");
  assert.equal(deriveCoachingCue({ diffFromTargetSeconds: 15, distanceRemainingMeters: 2000, goalStatus: "ahead" }), "stay_patient");
  assert.equal(deriveCoachingCue({ diffFromTargetSeconds: 0, distanceRemainingMeters: 2000, goalStatus: "on_pace" }), "on_plan");
  assert.equal(deriveCoachingCue({ diffFromTargetSeconds: -10, distanceRemainingMeters: 300, goalStatus: "at_risk" }), "start_closing", "An at-risk runner with under 400m left must get a closing cue.");
  assert.equal(deriveCoachingCue({ diffFromTargetSeconds: -10, distanceRemainingMeters: 3000, goalStatus: "at_risk" }), "on_plan", "An at-risk runner with plenty of race left must not be told to close yet.");

  // Determinism: calling twice with identical input must always produce
  // identical output.
  const input = { diffFromTargetSeconds: -10, distanceRemainingMeters: 300, goalStatus: "at_risk" };
  assert.equal(deriveCoachingCue(input), deriveCoachingCue(input));
}

// --- Team-level math -----------------------------------------------------------
// No team-score function exists anywhere in race-math.js -- confirmed here
// structurally, not just by omission from this test file.

{
  assert.equal(
    Object.keys(global.window.PodiumRaceMath).some((name) => /score/i.test(name)),
    false,
    "race-math.js must expose no team-score function -- one team's own times cannot determine a real cross country team score without field-position data this project does not capture."
  );

  assert.ok(Math.abs(computeTeamAverageDiff([10, -10, 20]) - 6.6667) < 0.001);
  assert.equal(computeTeamAverageDiff([]), null, "An empty diff list must return null, never NaN.");
  assert.equal(computeTeamAverageDiff([NaN, 10]), 10, "Non-finite diffs (unrecorded runners) must be excluded, not poison the average.");

  assert.equal(computeRunnerGap([1000, 1010, 1020, 1030, 1040], 5), 40, "R1-R5 gap must be the 5th-fastest minus the fastest.");
  assert.equal(computeRunnerGap([1000, 1010], 5), null, "Fewer than N finishers must return null, never throw.");

  assert.deepEqual(
    computeGoalTierCounts(["ahead", "on_pace", "on_pace", "at_risk", "missed", "missed"]),
    { ahead: 1, on_pace: 2, at_risk: 1, missed: 2 }
  );
}

// --- Timer engine (public/scripts/race-timer.js) ----------------------------
// Every test here injects fake nowMs/perfNowMs sources instead of touching
// the real clock, so elapsed-at-tap behavior is a deterministic pure
// function of the injected values, matching the plan's requirement.

{
  // A fake monotonic clock that only ever moves forward when advanced --
  // this is what proves elapsedNow() is driven by perfNowMs, not nowMs.
  let fakePerfMs = 0;
  let fakeWallMs = 1_000_000;
  const timer = createRaceTimer({
    nowMs: () => fakeWallMs,
    perfNowMs: () => fakePerfMs
  });

  assert.equal(timer.isLive(), false, "A timer must not be live before startRace() is called.");
  assert.equal(timer.elapsedNow(), null, "elapsedNow() must be null before the race starts, never 0 (0 would be indistinguishable from 'just started').");

  const { raceStartWallClockMs } = timer.startRace();
  assert.equal(raceStartWallClockMs, 1_000_000, "startRace() must anchor the wall clock at the injected nowMs value.");
  assert.equal(timer.isLive(), true);
  assert.equal(timer.elapsedNow(), 0, "Elapsed time must be exactly 0 at the instant of start.");

  // Advance only the monotonic clock -- elapsedNow() must track it exactly.
  fakePerfMs = 12_340;
  assert.equal(timer.elapsedNow(), 12.34, "elapsedNow() must equal (perfNowMs - startPerfMs) / 1000.");
  assert.equal(timer.captureElapsedAtTap(), 12.34, "captureElapsedAtTap() must return the same value as elapsedNow() at that instant.");

  // Simulate a system clock jump (e.g. NTP correction, timezone change)
  // that moves the wall clock without moving the monotonic clock at all --
  // elapsedNow() must be completely unaffected, proving it is monotonic-
  // clock-driven, not wall-clock-driven, during a live session.
  fakeWallMs += 5_000_000;
  assert.equal(timer.elapsedNow(), 12.34, "A wall-clock jump during a live session must never affect the monotonic elapsed reading.");

  const live = timer.elapsedOrRecovered();
  assert.deepEqual(live, { elapsedSeconds: 12.34, precision: "monotonic" }, "elapsedOrRecovered() must prefer the live monotonic path and tag it 'monotonic' while the session is live.");
}

{
  // Simulate a page reload: a fresh timer instance (performance.now()
  // truly does reset to 0 on every real page load) recovers only from a
  // persisted wall-clock value.
  let fakeWallMs = 1_000_000;
  const timer = createRaceTimer({ nowMs: () => fakeWallMs, perfNowMs: () => 0 });

  assert.equal(timer.recoverElapsed(), null, "recoverElapsed() must be null with no anchor set at all.");
  assert.equal(timer.elapsedOrRecovered(), null, "elapsedOrRecovered() must be null with no anchor set at all.");

  timer.recoverFromWallClock(1_000_000);
  assert.equal(timer.isLive(), false, "Recovering from the wall clock must never claim the session is live -- a monotonic anchor cannot be reconstructed after a reload.");

  fakeWallMs = 1_009_500; // 9.5 real seconds later
  assert.equal(timer.recoverElapsed(), 9.5, "recoverElapsed() must derive elapsed time from the wall-clock anchor after a reload.");

  const recovered = timer.elapsedOrRecovered();
  assert.deepEqual(recovered, { elapsedSeconds: 9.5, precision: "recovered" }, "elapsedOrRecovered() must fall back to the wall-clock path and tag it 'recovered' (lower precision) after a reload, never claim 'monotonic' precision it doesn't have.");
}

{
  // reset() must fully clear a timer back to its pre-start state.
  const timer = createRaceTimer({ nowMs: () => 1, perfNowMs: () => 1 });
  timer.startRace();
  assert.equal(timer.isLive(), true);
  timer.reset();
  assert.equal(timer.isLive(), false, "reset() must clear the live monotonic anchor.");
  assert.equal(timer.getRaceStartWallClockMs(), null, "reset() must clear the wall-clock anchor too.");
  assert.equal(timer.elapsedOrRecovered(), null, "A reset timer must report no elapsed time at all.");
}

console.log("Timer engine (public/scripts/race-timer.js) validated with injected fake time sources:");
console.log("Confirmed elapsedNow()/captureElapsedAtTap() are driven purely by the monotonic clock and are completely unaffected by a simulated wall-clock jump during a live session.");
console.log("Confirmed the post-reload recovery path derives elapsed time only from the persisted wall-clock anchor, is correctly tagged 'recovered' (lower precision) rather than 'monotonic', and that isLive() never lies about having a live monotonic session after a reload.");
console.log("Confirmed reset() fully clears both anchors.");

// --- Local-first persistence record shapes (public/scripts/race-local-store.js) ---
// Only the pure, non-indexedDB-touching record builders are exercised
// here -- see that file's header comment for the Node/Playwright test
// boundary this reflects.

{
  const CLIENT_SPLIT_ID_PATTERN = /^pw_rcc_[a-zA-Z0-9._-]{16,80}$/;

  const id1 = generateClientSplitId();
  const id2 = generateClientSplitId();
  assert.ok(CLIENT_SPLIT_ID_PATTERN.test(id1), `generateClientSplitId() output "${id1}" must match install/11_RACE_COMMAND_CENTER.sql's client_split_id check constraint exactly.`);
  assert.notEqual(id1, id2, "Two generated ids must never collide.");

  const stateRecord = buildRaceStateRecord({
    raceSessionId: "session-1",
    session: { id: "session-1", name: "Test Invite" },
    checkpoints: [{ id: "cp1" }],
    participants: [{ id: "p1" }],
    goals: [{ id: "g1" }],
    targets: [{ id: "t1" }],
    currentCheckpointIndex: 1,
    raceStartedAtWallClockMs: 1_700_000_000_000
  });
  assert.equal(stateRecord.race_session_id, "session-1", "race_session_id must be the record's key field, matching the object store's keyPath.");
  assert.equal(stateRecord.current_checkpoint_index, 1);
  assert.equal(stateRecord.race_started_at_wall_clock_ms, 1_700_000_000_000, "The persisted state must carry the wall-clock recovery anchor, never a monotonic performance.now() value (meaningless across page loads).");
  assert.equal(typeof stateRecord.saved_at_ms, "number", "A default saved_at_ms must be stamped even when not explicitly provided.");

  const emptyState = buildRaceStateRecord({ raceSessionId: "session-2" });
  assert.deepEqual(emptyState.checkpoints, [], "Missing collection fields must default to empty arrays, never undefined or null, so UI code can always safely iterate.");

  const splitRecord = buildSplitRecord({
    clientSplitId: id1,
    raceSessionId: "session-1",
    raceParticipantId: "p1",
    raceCheckpointId: "cp1",
    elapsedSeconds: 320.4,
    wallClockCapturedAtMs: 1_700_000_010_000,
    captureMethod: "single_tap",
    deviceId: "device-1"
  });
  assert.equal(splitRecord.synced, false, "A newly built split record must default to unsynced.");
  assert.equal(splitRecord.revision, 1, "A newly built split record must default to revision 1.");
  assert.equal(splitRecord.is_dns, false);
  assert.equal(splitRecord.is_dnf, false);
  assert.equal(splitRecord.client_split_id, id1, "client_split_id must be the record's key field, matching the object store's keyPath.");

  const dnsSplit = buildSplitRecord({
    clientSplitId: id2,
    raceSessionId: "session-1",
    raceParticipantId: "p2",
    raceCheckpointId: "cp1",
    wallClockCapturedAtMs: 1_700_000_020_000,
    captureMethod: "manual_entry",
    isDns: true
  });
  assert.equal(dnsSplit.elapsed_seconds, null, "A DNS split must have a null elapsed time, never a fabricated 0.");
  assert.equal(dnsSplit.is_dns, true);

  const revisionRecord = buildRevisionRecord({
    clientSplitId: id1,
    revision: 2,
    elapsedSeconds: 318.1,
    wallClockCapturedAtMs: 1_700_000_015_000,
    captureMethod: "edited",
    changeReason: "manual_correction",
    deviceId: "device-1"
  });
  assert.equal(revisionRecord.client_split_id, id1, "A revision record must reference its split by the same client_split_id, so local revision history can be reattached after sync.");
  assert.equal(revisionRecord.revision, 2);
  assert.equal(revisionRecord.change_reason, "manual_correction");
}

console.log("Local-first persistence record shapes (public/scripts/race-local-store.js) validated:");
console.log("generateClientSplitId() output checked against the exact database check constraint pattern and for collision-freedom.");
console.log("buildRaceStateRecord()/buildSplitRecord()/buildRevisionRecord() checked for correct keyPath fields, safe defaults (empty arrays, unsynced, revision 1, non-DNS/DNF), and that a DNS split's elapsed time is null rather than a fabricated 0.");

// --- Server-side calculation port (lib/race_math.mjs) -----------------------
// The API layer never trusts client-side validation alone -- this section
// confirms the server port produces IDENTICAL output to the browser
// version for the same input, so the two are provably kept in sync
// rather than silently drifting.

{
  const serverMath = await import("../lib/race_math.mjs");

  const checkpoints = [
    { id: "cp1", distanceMeters: 1600 },
    { id: "cp2", distanceMeters: 3200 },
    { id: "cp3", distanceMeters: 5000 }
  ];
  const clientTargets = computeEvenPaceTargets({ distanceMeters: 5000, goalSeconds: 1020, checkpoints });
  const serverTargets = serverMath.computeEvenPaceTargets({ distanceMeters: 5000, goalSeconds: 1020, checkpoints });
  assert.deepEqual(serverTargets, clientTargets, "The server-side port of computeEvenPaceTargets() must produce byte-identical output to the browser version for the same input.");

  assert.deepEqual(serverMath.validateCustomPaceTargets([320, 640, 1020]), validateCustomPaceTargets([320, 640, 1020]));
  assert.deepEqual(serverMath.validateCustomPaceTargets([320, 200, 1020]), validateCustomPaceTargets([320, 200, 1020]), "The server-side port must reject the same invalid Custom Pace input as the browser version, at the same index -- the server never trusts client-side validation alone.");
  assert.deepEqual(serverMath.computeEvenPaceTargets({ distanceMeters: 0, goalSeconds: 1020, checkpoints }), []);
}

console.log("Server-side calculation port (lib/race_math.mjs) validated as byte-identical to the browser version for computeEvenPaceTargets() and validateCustomPaceTargets(), confirming the server never trusts client-side Custom Pace validation alone.");

// --- Service-layer pure helpers (lib/race_command_center_service.mjs) ------
// Only the pure, no-database functions are exercised here -- the
// database-backed functions in that file are hand-verified separately
// against real production Supabase (see docs/DECISIONS.md).

{
  const {
    buildCheckpointsWithFinish,
    diffParticipants,
    splitPayloadChanged
  } = await import("../lib/race_command_center_service.mjs");

  // -- buildCheckpointsWithFinish ---------------------------------------------

  const withoutExplicitFinish = buildCheckpointsWithFinish(5000, [
    { label: "Mile 1", distanceMeters: 1600 },
    { label: "Mile 2", distanceMeters: 3200 }
  ]);
  assert.equal(withoutExplicitFinish.length, 3, "A coach's own checkpoints that don't reach the race distance must get exactly one appended Finish checkpoint.");
  assert.equal(withoutExplicitFinish[2].label, "Finish");
  assert.equal(withoutExplicitFinish[2].distance_meters, 5000);
  assert.equal(withoutExplicitFinish[2].is_finish, true);
  assert.equal(withoutExplicitFinish[0].is_finish, false);
  assert.deepEqual(withoutExplicitFinish.map((c) => c.sort_order), [1, 2, 3], "Checkpoints must be sorted by distance and numbered in order.");

  const withExplicitFinish = buildCheckpointsWithFinish(5000, [
    { label: "Mile 1", distanceMeters: 1600 },
    { label: "5K Finish", distanceMeters: 5000 }
  ]);
  assert.equal(withExplicitFinish.length, 2, "A coach who already entered a checkpoint at the exact race distance must not get a duplicate invented Finish checkpoint.");
  assert.equal(withExplicitFinish[1].label, "5K Finish", "The coach's own label for the finish checkpoint must be preserved, never overwritten with a generic one.");

  const outOfOrderInput = buildCheckpointsWithFinish(5000, [
    { label: "Mile 2", distanceMeters: 3200 },
    { label: "Mile 1", distanceMeters: 1600 }
  ]);
  assert.deepEqual(outOfOrderInput.map((c) => c.label), ["Mile 1", "Mile 2", "Finish"], "Checkpoints entered out of order must be sorted by distance, never left in entry order.");

  const noCheckpointsEntered = buildCheckpointsWithFinish(5000, []);
  assert.equal(noCheckpointsEntered.length, 1, "A race with no coach-entered checkpoints must still get exactly one Finish checkpoint -- a race can never have zero checkpoints.");
  assert.equal(noCheckpointsEntered[0].is_finish, true);

  // -- diffParticipants ---------------------------------------------------------

  const existingParticipants = [
    { id: "row-1", team_athlete_id: "athlete-1", manual_name: null },
    { id: "row-2", team_athlete_id: null, manual_name: "Guest Runner" }
  ];

  const noChangeDiff = diffParticipants(existingParticipants, [
    { id: "row-1", teamAthleteId: "athlete-1", raceGroup: "Varsity", sortOrder: 0 },
    { id: "row-2", manualName: "Guest Runner", raceGroup: null, sortOrder: 1 }
  ]);
  assert.deepEqual(noChangeDiff.toDelete, [], "Resubmitting the exact same participants must delete nothing.");
  assert.equal(noChangeDiff.toInsert.length, 0);
  assert.equal(noChangeDiff.toUpdate.length, 2, "Resubmitting the same participants must still count as an update (race_group/sort_order refresh), matched by id.");

  const addAndRemoveDiff = diffParticipants(existingParticipants, [
    { id: "row-1", teamAthleteId: "athlete-1", raceGroup: "Varsity", sortOrder: 0 },
    { teamAthleteId: "athlete-3", raceGroup: "Varsity", sortOrder: 1 }
  ]);
  assert.equal(addAndRemoveDiff.toInsert.length, 1, "A brand-new athlete with no matching id or team_athlete_id must be an insert.");
  assert.equal(addAndRemoveDiff.toInsert[0].team_athlete_id, "athlete-3");
  assert.deepEqual(addAndRemoveDiff.toDelete, ["row-2"], "A participant left out of the resubmitted full list (Guest Runner) must be removed -- the bulk save always reflects the complete desired state.");

  const matchByAthleteIdWithoutRowId = diffParticipants(existingParticipants, [
    { teamAthleteId: "athlete-1", raceGroup: "JV", sortOrder: 0 }
  ]);
  assert.equal(matchByAthleteIdWithoutRowId.toUpdate.length, 1, "A desired participant with no row id but a matching team_athlete_id must still match the existing row (update), never create a duplicate.");
  assert.equal(matchByAthleteIdWithoutRowId.toInsert.length, 0);
  assert.deepEqual(matchByAthleteIdWithoutRowId.toDelete, ["row-2"]);

  // -- splitPayloadChanged -------------------------------------------------------

  const existingSplit = {
    elapsed_seconds: 320.4,
    wall_clock_captured_at: "2026-08-09T18:00:00.000Z",
    is_dns: false,
    is_dnf: false
  };
  assert.equal(splitPayloadChanged(null, { elapsedSeconds: 320.4 }), true, "A split with no existing row must always count as changed (it's new).");
  assert.equal(
    splitPayloadChanged(existingSplit, {
      elapsedSeconds: 320.4,
      wallClockCapturedAt: "2026-08-09T18:00:00.000Z",
      isDns: false,
      isDnf: false
    }),
    false,
    "A byte-identical retried sync payload must be recognized as unchanged, so retrying a sync never fabricates a duplicate revision."
  );
  assert.equal(
    splitPayloadChanged(existingSplit, {
      elapsedSeconds: 318.1,
      wallClockCapturedAt: "2026-08-09T18:00:00.000Z",
      isDns: false,
      isDnf: false
    }),
    true,
    "A genuinely different elapsed time must be recognized as changed, so a real correction is never silently dropped."
  );

  // Postgres `numeric` columns come back through PostgREST as STRINGS,
  // never JS numbers -- this exact scenario broke sync idempotency in
  // live verification against real Supabase before being fixed. A
  // Postgres-shaped existing row (string elapsed_seconds, "+00:00"
  // offset instead of "Z") must still be recognized as unchanged when
  // the incoming payload represents the identical value/instant.
  const postgresShapedExistingSplit = {
    elapsed_seconds: "320.4",
    wall_clock_captured_at: "2026-08-09T18:00:00.856+00:00",
    is_dns: false,
    is_dnf: false
  };
  assert.equal(
    splitPayloadChanged(postgresShapedExistingSplit, {
      elapsedSeconds: 320.4,
      wallClockCapturedAt: "2026-08-09T18:00:00.856Z",
      isDns: false,
      isDnf: false
    }),
    false,
    "A Postgres-shaped existing row (numeric-as-string, +00:00 offset) must still be recognized as an unchanged retry, not a false positive."
  );

  // A DNS split's null elapsed time must never be confused with 0, in
  // either direction.
  const dnsExisting = { elapsed_seconds: null, wall_clock_captured_at: "2026-08-09T18:00:00.000Z", is_dns: true, is_dnf: false };
  assert.equal(
    splitPayloadChanged(dnsExisting, { elapsedSeconds: null, wallClockCapturedAt: "2026-08-09T18:00:00.000Z", isDns: true, isDnf: false }),
    false
  );
  assert.equal(
    splitPayloadChanged(dnsExisting, { elapsedSeconds: 0, wallClockCapturedAt: "2026-08-09T18:00:00.000Z", isDns: true, isDnf: false }),
    true,
    "A null elapsed time (DNS) must never be treated as equal to an incoming 0."
  );
}

console.log("Service-layer pure helpers (lib/race_command_center_service.mjs) validated:");
console.log("buildCheckpointsWithFinish() checked for auto-appending exactly one Finish checkpoint only when needed, preserving a coach's own finish label, sorting out-of-order entries, and never producing a race with zero checkpoints.");
console.log("diffParticipants() checked for matching by row id or by team_athlete_id (never creating a duplicate), and that a bulk roster save always reflects the complete resubmitted list -- omitted participants are removed, new ones are inserted.");
console.log("splitPayloadChanged() checked to recognize a byte-identical retried sync as a true no-op while still catching a genuine correction, which is what keeps the revision audit trail honest under retries.");

console.log("Race Command Center calculation engine (public/scripts/race-math.js) validated:");
console.log("Even Pace target generation checked against the proportional formula reused from pace-splits.js, including zero-distance and missing-checkpoint safety.");
console.log("Custom Pace validation checked for strictly-increasing enforcement (ties, backward entries, empty lists, non-finite entries), confirming targets are only ever validated, never auto-corrected.");
console.log("Goal status thresholds checked across ahead/on_pace/at_risk/missed, including the finish-line edge case.");
console.log("Confirmed computeRequiredRemaining() and computeCurrentPaceProjection() share no output field name, so 'current pace projects X' and 'required pace to hit goal is Y' can never be merged into one misleading number.");
console.log("Expected-order sorting, deterministic coaching cues, and team-level average-diff/runner-gap/goal-tier math checked, including a structural assertion that no team-score function exists.");
