import assert from "node:assert/strict";
import fs from "node:fs";

// Two real bugs found in a full correctness audit of Split Watch's live
// capture path (2026-08-27), both in the "coach mistapped the finish,
// hit Undo" flow -- narrow, but exactly the kind of thing that erodes
// trust in a timing tool if it ever surfaces at a real meet.

function readSource(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const liveSource = readSource("../public/scripts/split-watch-live.js");
const serviceSource = readSource("../lib/split_watch_service.mjs");

// --- Bug 1 (client): Undo must clear the retap-confirmation window ---
// Without this, "wrong runner, Undo, tap the right one" (all within a
// couple seconds) asked "X already has a time here" citing a value the
// screen had already cleared -- confusing, and about data that no
// longer exists.
{
  const undoBody = liveSource.slice(liveSource.indexOf("function handleUndo"), liveSource.indexOf("function handleManualEntry"));
  assert.match(undoBody, /lastTapAt\.delete\(key\)/, "handleUndo must clear lastTapAt for this (participant, checkpoint) pair");
  assert.match(undoBody, /lastRecordedValue\.delete\(key\)/, "handleUndo must clear lastRecordedValue for this (participant, checkpoint) pair");
  console.log("split-watch-live.js checked: Undo clears the retap-confirmation window for that runner/checkpoint, so a correct re-tap right after Undo is never confused for a reflex double-tap.");
}

// --- Bug 2 (server): undoing a finish split must not leave "finished" stuck ---
// Without this, a runner whose finish split was undone kept status
// "finished" with no recorded time forever (nothing else ever reverts
// it) -- and was silently dropped from the Review page's "Copy team
// summary" text recap: not a finisher (no finish time), not listed as
// DNS/DNF either (status was never actually that).
{
  const pushBody = serviceSource.slice(serviceSource.indexOf("export async function pushSplits"), serviceSource.indexOf("export async function pullState"));
  assert.match(pushBody, /elapsedSeconds === null && checkpoint\.is_finish/, "pushSplits detects a finish-checkpoint split being cleared (Undo)");
  assert.match(pushBody, /started_after_finish_undo/, "the revert is tracked distinctly from a normal forward 'started' write, since it needs a different guard");
  assert.match(pushBody, /!statusUpdates\.has\(incoming\.raceParticipantId\)/, "the revert never overwrites a real status change already decided earlier in the same batch");

  // The actual DB write must only ever fire FROM "finished" -- must
  // never be reachable for an explicit dns/dnf, and must never blindly
  // downgrade without checking current status first.
  const applyBody = pushBody.slice(pushBody.indexOf("for (const [participantId"));
  assert.match(applyBody, /if \(isFinishUndo\) \{[\s\S]{0,400}?eq\("status",\s*"finished"\)/, "the finish-undo revert is a guarded update that only fires when the participant is CURRENTLY \"finished\"");
  console.log("lib/split_watch_service.mjs checked: undoing a finish-checkpoint split reverts a stuck \"finished\" status back to \"started\", guarded to never touch an explicit DNS/DNF and never fight a real status change already decided in the same batch.");
}

console.log("\nLive capture audit fixes (2026-08-27 full-product review): source-level checks passed.");
