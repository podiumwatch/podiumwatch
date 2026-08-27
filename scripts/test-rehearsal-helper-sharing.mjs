import assert from "node:assert/strict";
import fs from "node:fs";

// Real incident fix (2026-08-27): a coach ran a rehearsal, but their two
// helpers' devices and the parent page never updated. The parent page
// not updating during a rehearsal is CORRECT, INTENDED behavior (a
// rehearsal can never be spectator_visible -- install/25's own hard
// rule, confirmed in scripts/test-rehearsal.mjs). The helpers not
// updating was a REAL gap: a rehearsal never appears in the smart
// routing a race-day code normally uses (by design, so practice data
// is never mistaken for today's real race), so there was previously no
// way at all for a coach's actual helpers to land on the SAME
// rehearsal the coach was running -- confirmed directly: no
// "share"/"link"/"invite" text existed anywhere near the rehearsal
// panel before this fix. Checked at the source level, matching this
// project's established convention for DOM-heavy client logic (see
// scripts/test-race-day-access.mjs's own header comment) -- a live
// mobile Playwright pass is the natural companion check, run separately.

function readSource(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const joinSource = readSource("../public/scripts/split-watch-join.js");
const liveSource = readSource("../public/scripts/split-watch-live.js");
const planSource = readSource("../public/scripts/split-watch-plan.js");
const planPageSource = readSource("../src/pages/splitwatchplan.mjs");

// --- split-watch-join.js: ?next= is honored, but only a safe relative path ---

{
  assert.match(joinSource, /function safeNextPath/);
  const safeNextBody = joinSource.slice(joinSource.indexOf("function safeNextPath"), joinSource.indexOf("function safeNextPath") + 400);
  assert.ok(safeNextBody.includes("split-watch"), "safeNextPath must only ever accept a path starting with /split-watch/ -- never an arbitrary external URL (open-redirect protection).");
  assert.ok(safeNextBody.includes("test(raw)"), "safeNextPath must actually validate the raw ?next= value against a pattern, not just pass it through.");

  assert.match(joinSource, /window\.location\.href = next \|\| "\/split-watch\/races\/\?id="/, "A valid ?next= path must win over the default race-selection redirect.");

  console.log("split-watch-join.js checked: a valid ?next= path (same-app relative only) is honored after a successful code entry, falling back to the default race-selection page otherwise.");
}

// --- split-watch-live.js: a cold 401 preserves the current race as ?next= ---

{
  assert.match(liveSource, /split-watch\/join\/\?next=" \+ encodeURIComponent\(window\.location\.pathname \+ window\.location\.search\)/, "A helper who opens a specific race's Live page cold must be sent back to that EXACT race after entering the code, not the generic race list -- this is what makes a shared rehearsal link actually work.");

  console.log("split-watch-live.js checked: a cold 401 (no code entered yet on this device) preserves the exact current race URL as ?next=, so a shared rehearsal link survives the code-entry step.");
}

// --- Plan page: the rehearsal share link uses the REHEARSAL's own session id ---

{
  assert.match(planPageSource, /data-sw-rehearsal-share-link/);
  assert.match(planPageSource, /data-sw-rehearsal-share-copy/);

  const renderBody = planSource.slice(planSource.indexOf("async function renderRehearsalPanel"), planSource.indexOf("let rehearsalHasEverBeenUsed"));
  assert.match(renderBody, /race=" \+ encodeURIComponent\(status\.session_id\)/, "The shared link must point at the REHEARSAL's own session id (status.session_id), never the source race's id -- sharing the wrong id would send helpers into the official race instead.");
  assert.match(renderBody, /status\.status !== "finished"/, "The share link must hide itself once the rehearsal is finished -- nothing left to usefully join.");

  console.log("The Plan page's rehearsal panel checked: the shared link points at the rehearsal's own session id (never the source race's), and hides itself once that rehearsal is finished.");
}

// --- The parent page's own non-update during a rehearsal is untouched, on purpose ---

{
  const authSource = readSource("../lib/race_day_auth.mjs");
  const viewerSource = readSource("../lib/race_viewer_service.mjs");
  // Not asserting anything new here -- confirming the existing hard
  // rule this fix must never relax: a rehearsal can never become
  // spectator_visible, so the parent page correctly has nothing to show.
  assert.match(readSource("../lib/split_watch_service.mjs"), /requestedVisible && session\.is_rehearsal/);
  assert.match(viewerSource, /is_rehearsal/);
  void authSource;

  console.log("Confirmed unchanged: a rehearsal still can never become spectator_visible -- the parent page correctly showing nothing during a rehearsal is intended behavior, not something this fix touches.");
}

console.log("\nRehearsal helper-sharing fix (2026-08-27 incident): source-level checks passed.");
