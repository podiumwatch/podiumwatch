import assert from "node:assert/strict";
import fs from "node:fs";

// Real incident (2026-08-25): during a live race day test, everything
// worked for the other races, but the JH boys race got stuck on
// "Checking..."/"Loading live race..." forever and never resolved --
// the helper never even got to the "Enter Race Day Code" screen. Root
// cause, confirmed against real production data (not guessed): the JH
// boys race's own data was completely unremarkable (fewer participants
// than its JH girls sibling, which finished fine; identical checkpoints;
// an active, unexpired race-day code; an active, unsuspended team) --
// there was nothing race-specific to blame. The real bug was structural:
// apiFetch() in every Split Watch client page called fetch() with no
// AbortController and no timeout at all, so a single stalled request
// (bad stadium wifi, a cold serverless start -- anything that stalls
// rather than cleanly errors) left the page's own try/catch unreachable
// forever, with no way to reach either the success path or the existing
// error screen. This file guards the fix: every one of these pages must
// time out and offer a visible, in-place retry instead of hanging.

function readSource(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const files = {
  "public/scripts/split-watch-live.js": readSource("../public/scripts/split-watch-live.js"),
  "public/scripts/split-watch-races.js": readSource("../public/scripts/split-watch-races.js"),
  "public/scripts/split-watch-hub.js": readSource("../public/scripts/split-watch-hub.js")
};

for (const [path, source] of Object.entries(files)) {
  assert.match(
    source,
    /new AbortController\(\)/,
    `${path} must use an AbortController so its initial-load fetch can never hang forever`
  );
  assert.match(
    source,
    /REQUEST_TIMEOUT_MS\s*=\s*15000/,
    `${path} must define a real, bounded timeout (not just declare the intent)`
  );
  assert.match(
    source,
    /controller\.abort\(\)/,
    `${path} must actually call abort() on timeout, not just construct the controller`
  );
  assert.match(
    source,
    /signal:\s*controller\.signal/,
    `${path} must pass the abort signal into fetch(), or the timeout does nothing`
  );
  assert.match(
    source,
    /clearTimeout\(timeoutId\)/,
    `${path} must clear the timeout once the request settles, or every successful request still leaves a stray timer`
  );
  assert.match(
    source,
    /error\.name === "AbortError"/,
    `${path} must turn a timeout into a clear, user-facing message rather than letting a raw AbortError reach the screen`
  );

  // The retry affordance itself: a real button wired to re-run
  // initialize() in place, not just a "go back" link -- going back loses
  // this exact race/team context on split-watch-live.js in particular.
  assert.match(
    source,
    /Couldn't verify -- retry/,
    `${path}'s error state must be the actionable "Couldn't verify -- retry" message, not a silent or dead-end failure`
  );
  assert.match(
    source,
    /addEventListener\("click", \(\) => \{[\s\S]{0,300}initialize\(\);/,
    `${path}'s retry button must actually call initialize() again on click`
  );
}

console.log("Split Watch load timeout fix (2026-08-25 real incident) checked across all three client pages:");
console.log("split-watch-live.js, split-watch-races.js, split-watch-hub.js each have a real, bounded AbortController");
console.log("timeout on their initial-load fetch, a clear user-facing message on timeout, and an in-place Retry button");
console.log("that re-runs initialize() rather than leaving 'Checking...'/'Loading live race...' stuck forever.");
