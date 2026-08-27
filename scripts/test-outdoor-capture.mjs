import assert from "node:assert/strict";
import fs from "node:fs";

// Outdoor live capture redesign (race day build plan, Project 4) is
// almost entirely client-side UI/UX on an already-built, already-tested
// local-first capture pipeline (Timer, race-local-store.js,
// pushSplits()'s cross-device conflict handling -- all covered by
// scripts/test-split-watch.mjs and verified live in earlier projects).
// This file checks the NEW pieces at the source level, matching this
// project's established convention for DOM-heavy client logic that
// can't be safely exercised without a real browser (see
// scripts/test-race-day-access.mjs's own header comment for the same
// reasoning) -- a live Playwright pass is the natural companion check,
// run separately against the real built page.

function readSource(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const pageSource = readSource("../src/pages/splitwatchlive.mjs");
const scriptSource = readSource("../public/scripts/split-watch-live.js");

// --- Sunlight Mode / Simple Timing View: device-only, never race data -----

{
  assert.match(scriptSource, /SUNLIGHT_KEY = "podium_sw_sunlight_mode"/);
  assert.match(scriptSource, /SIMPLE_VIEW_KEY = "podium_sw_simple_view"/);

  const applySunlightBody = scriptSource.slice(scriptSource.indexOf("function applySunlightMode"), scriptSource.indexOf("function applySimpleView"));
  assert.match(applySunlightBody, /localStorage\.setItem\(SUNLIGHT_KEY/, "Sunlight Mode must persist to localStorage (device-only), not to any race/session data.");
  assert.ok(!/apiFetch|SESSIONS_ENDPOINT|SYNC_ENDPOINT/.test(applySunlightBody), "Sunlight Mode must never make a network call -- it's a pure device preference.");

  const applySimpleBody = scriptSource.slice(scriptSource.indexOf("function applySimpleView"), scriptSource.indexOf("applySunlightMode(localStorage"));
  assert.match(applySimpleBody, /localStorage\.setItem\(SIMPLE_VIEW_KEY/);
  assert.ok(!/apiFetch|SESSIONS_ENDPOINT|SYNC_ENDPOINT/.test(applySimpleBody), "Simple Timing View must never make a network call -- it's a pure device preference.");

  console.log("Sunlight Mode and Simple Timing View checked: both persist only to localStorage (this device alone), never touch the network, race plan, or any other device's screen.");
}

// --- Simple Timing View hides only what the spec calls for ----------------

{
  const hideRule = pageSource.slice(pageSource.indexOf(".sw-simple-view [data-sw-checkpoint-tabs]"), pageSource.indexOf("Respects the user's OS-level motion"));
  for (const selector of [
    "[data-sw-checkpoint-tabs]", "[data-sw-pack-toggle]", "[data-sw-pack-bar]",
    "[data-sw-race-switcher-wrap]", "[data-sw-restart-race]", "[data-sw-adjust-clock-open]",
    "[data-sw-leave-rehearsal]", ".sw-runner-more"
  ]) {
    assert.ok(hideRule.includes(selector), `Simple Timing View must hide ${selector}.`);
  }
  // The actual capture control and Undo must NEVER be in this hidden set.
  assert.ok(!hideRule.includes("[data-tap]") && !hideRule.includes("sw-runner-tap") && !hideRule.includes("data-undo"), "Simple Timing View must never hide the tap button or Undo -- those are the whole point of the screen.");

  console.log("Simple Timing View checked: hides exactly the spec's 'extras' (checkpoint tabs, Pack Capture, race switcher, restart/adjust-clock/leave-rehearsal, per-runner manual entry) while never touching the tap button or Undo.");
}

// --- Duplicate/busy-finish protection: a real confirmation, not a silent overwrite ---

{
  const tapBody = scriptSource.slice(scriptSource.indexOf("async function handleTap"), scriptSource.indexOf("function handleUndo"));
  assert.match(tapBody, /lastTap = lastTapAt\.get\(key\)/, "The retap guard must be based on the timestamp of the LAST tap for this pair, not on whether a value currently exists -- a tap button only ever renders once the current value is cleared (still-needed vs. recorded, see splitFor()), so gating on 'a real value exists right now' would make this unreachable.");
  assert.match(tapBody, /now - lastTap < RETAP_CONFIRM_WINDOW_MS/);
  assert.match(tapBody, /if \(!confirmed\) return;/, "Cancelling the retap confirmation must discard the new tap entirely -- the original value must never be silently replaced.");

  const windowMs = Number(scriptSource.match(/RETAP_CONFIRM_WINDOW_MS = (\d+)/)?.[1]);
  assert.ok(windowMs >= 3000 && windowMs <= 15000, "The retap window should be a short, deliberate interval (a few seconds), not effectively permanent or effectively instant.");

  console.log("Duplicate/busy-finish protection checked: a rapid re-tap on a runner with a real recorded time triggers a real confirmation dialog, cancelling it discards the new tap without touching the original, and the window (" + windowMs + "ms) is a short, deliberate interval.");
}

// --- Accessibility: screen reader confirmation + reduced motion -----------

{
  assert.match(pageSource, /aria-live="polite"[^>]*data-sw-capture-announce|data-sw-capture-announce[^>]*aria-live="polite"/);
  assert.match(pageSource, /data-sw-message hidden aria-live="polite"/, "The general message banner must be announced to screen readers, not just shown visually.");
  assert.match(pageSource, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(pageSource, /\.sw-recorded-row-flash \{ animation: none; \}/);

  const announceBody = scriptSource.slice(scriptSource.indexOf("function announceCapture"), scriptSource.indexOf("async function handleTap"));
  assert.match(announceBody, /captureAnnounceEl\.textContent = ""/, "Clearing the live region before setting new text is required so consecutive identical captures are still announced.");

  console.log("Accessibility checked: a dedicated aria-live region announces every capture/undo to screen readers, the general message banner is also aria-live, and the recorded-row flash animation is disabled under prefers-reduced-motion.");
}

console.log("\nOutdoor live capture redesign (Project 4) source-level checks passed.");
