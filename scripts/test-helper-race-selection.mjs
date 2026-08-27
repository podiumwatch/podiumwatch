import assert from "node:assert/strict";
import fs from "node:fs";

// Real incident fix (2026-08-27): a helper testing Split Watch entered
// the team's code and was silently auto-routed into the HS boys race
// when they meant to time the JH boys race running the same day, then
// started the wrong race's official clock without ever being shown
// which race they were on. Three independent layers fixed here, all
// checked at the source level since this is DOM-heavy client logic
// (matching this project's established convention -- see
// scripts/test-race-day-access.mjs's own header comment for the same
// reasoning). A live mobile Playwright pass is the natural companion
// check, run separately.

function readSource(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const racesSource = readSource("../public/scripts/split-watch-races.js");
const liveSource = readSource("../public/scripts/split-watch-live.js");
const pageSource = readSource("../src/pages/splitwatchlive.mjs");

// --- Layer 1: never silently auto-pick among multiple same-day races ------

{
  const initBody = racesSource.slice(racesSource.indexOf("async function initialize"));
  assert.match(initBody, /sameDayCandidates = \[\.\.\.\(data\.liveRaces \|\| \[\]\), \.\.\.\(data\.upcomingToday \|\| \[\]\)\]/, "The choice condition must consider BOTH live and today's-scheduled races, not just live ones.");
  assert.match(initBody, /if \(sameDayCandidates\.length > 1\)/);
  // The broadened check must run BEFORE the auto-route, or it can never
  // actually intercept the silent single-race pick this fix exists to stop.
  assert.ok(initBody.indexOf("sameDayCandidates.length > 1") < initBody.indexOf("data.singleRelevantRace"), "The multi-candidate check must run before the auto-route to a single race.");

  console.log("split-watch-races.js checked: a helper sees an explicit, named choice whenever more than one race is relevant to today, whether or not either is live yet -- not just when multiple are simultaneously live.");
}

// --- Layer 2: the choice list itself is real, clickable, and routes through the position-check ---

{
  const renderBody = racesSource.slice(racesSource.indexOf("function renderChoiceList"), racesSource.indexOf("// Timing Crew (Project 3): before sending"));
  assert.match(renderBody, /data-choice-race/);
  assert.match(renderBody, /routeToRace\(session\)/, "Picking from the choice list must go through the same position-confirmation check as the single-race auto-route, not a bare link straight to the Live page.");

  console.log("renderChoiceList() checked: every race in the list routes through routeToRace() (the same position-confirmation path as the auto-routed case), not a bare direct link.");
}

// --- Layer 3: the pre-start screen makes the race unmistakable -------------

{
  assert.match(pageSource, /data-sw-start-race-name/, "The pre-start screen must show the race name directly in its own body, not rely solely on the small sticky header above it.");
  assert.match(pageSource, /data-sw-start-race-switcher/, "The pre-start screen must offer an easy way to switch races right there, not just in the small top-row select.");

  const populateBody = liveSource.slice(liveSource.indexOf("async function populateRaceSwitcher"), liveSource.indexOf("function goToSwitchedRace"));
  assert.match(populateBody, /startSwitcher\.innerHTML = optionsHtml/, "The start-screen switcher must be populated from the exact same option list as the top-row switcher -- never a second, independently-built list that could drift out of sync.");

  const startNameBody = liveSource.slice(liveSource.indexOf("raceNameEl.textContent = detail.session.name"), liveSource.indexOf("loadingBox.hidden = true"));
  assert.match(startNameBody, /startRaceNameEl\.textContent = detail\.session\.name/);

  console.log("The pre-start screen checked: it shows the race name directly (not just the small sticky header) and a switcher populated from the exact same list as the existing top-row one.");
}

// --- Layer 4: a helper switching races is never sent to the coach-only Plan page ---

{
  const goToBody = liveSource.slice(liveSource.indexOf("function goToSwitchedRace"), liveSource.indexOf("raceSwitcher.addEventListener"));
  assert.match(goToBody, /viewerType === "race_day_code"/, "A helper switching to a not-yet-live race must be routed straight to the Live page, never through the coach-only Plan page (which would just redirect them right back here anyway).");

  console.log("goToSwitchedRace() checked: a helper is routed straight to the Live page for a not-yet-live target, never through the coach-only Plan page.");
}

// --- Layer 5: an explicit, named confirmation before the official clock starts ---

{
  const startClickBody = liveSource.slice(liveSource.indexOf('startButton.addEventListener("click"'), liveSource.indexOf('startButton.disabled = true;\n    try'));
  assert.match(startClickBody, /window\.confirm\('Start "' \+ detail\.session\.name \+ '" now\?/, "Starting an official race must ask a real, named confirmation -- the exact race name must appear in the prompt, not a generic 'Are you sure?'.");
  assert.match(startClickBody, /!detail\.session\.is_rehearsal/, "The confirmation must be skipped for a rehearsal -- Project 1's whole point is a low-friction, repeatable practice loop, and a rehearsal carries none of an official start's real risk.");

  console.log("The official-start confirmation checked: it names the exact race being started, and is correctly skipped for a rehearsal (no real risk there).");
}

console.log("\nHelper race-selection safety fixes (2026-08-27 incident): source-level checks passed.");
