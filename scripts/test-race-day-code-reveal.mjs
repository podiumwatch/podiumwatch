import assert from "node:assert/strict";
import fs from "node:fs";

// Real coach feedback (2026-08-27): "Whenever I click share access code
// with a timer, it says I have to regenerate code. I just want one code
// per day -- once I give that code out, that device is good to go."
// The second half was already true (a joined helper's session lasts 30
// days, untouched by a later regenerate). The first half wasn't: the
// code's plaintext was never stored, only its hash, so re-opening "Get
// volunteers timing" after the first reveal gave no way to read the
// current code back -- only "Regenerate," which replaces it and breaks
// it for anyone who hasn't joined yet. This fix stores the plaintext
// (display-only, never used to authorize anything) so the coach's own
// dialog can show the SAME code again anytime, all day.

function readSource(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const authSource = readSource("../lib/race_day_auth.mjs");
const migrationSource = readSource("../install/28_SPLIT_WATCH_RACE_DAY_CODE_REVEAL.sql");
const clientScripts = [
  "../public/scripts/split-watch-live.js",
  "../public/scripts/split-watch-plan.js",
  "../public/scripts/split-watch-hub.js",
  "../public/scripts/team-home.js"
].map(readSource);
const pageTemplates = [
  "../src/pages/splitwatchlive.mjs",
  "../src/pages/splitwatchplan.mjs",
  "../src/pages/splitwatch.mjs",
  "../src/pages/teamhome.mjs"
].map(readSource);

// --- migration: purely additive, one nullable column ---
{
  assert.match(migrationSource, /alter table public\.team_race_day_codes/);
  assert.match(migrationSource, /add column if not exists code text/);
  assert.ok(!/drop |truncate /i.test(migrationSource), "the migration must never drop or truncate anything");
  console.log("install/28: checked as purely additive (one new nullable column, nothing dropped).");
}

// --- lib/race_day_auth.mjs: the code is stored, surfaced, and cleared correctly ---
{
  const regenBody = authSource.slice(authSource.indexOf("export async function regenerateRaceDayCode"), authSource.indexOf("export async function revokeRaceDayCode"));
  assert.match(regenBody, /code:\s*rawCode/, "regenerate stores the plaintext code, not just its hash");
  assert.match(regenBody, /code_hash:\s*codeHash/, "regenerate still stores the hash too -- verifyRaceDayCode's own check is completely unchanged");

  const statusBody = authSource.slice(authSource.indexOf("export async function getRaceDayCodeStatus"), authSource.indexOf("async function codeHashIsTaken"));
  assert.match(statusBody, /\.select\("[^"]*\bcode\b[^"]*"\)/, "getRaceDayCodeStatus selects the code column");
  assert.match(statusBody, /active \? data\.code \|\| null : null/, "an expired code's plaintext is never surfaced, even if a row still has one stored");

  const revokeBody = authSource.slice(authSource.indexOf("export async function revokeRaceDayCode"));
  assert.match(revokeBody, /code:\s*null/, "revoking clears the stored plaintext, not just the active flag -- nothing left to show once access is off");

  // verifyRaceDayCode itself -- the actual authorization check -- must
  // still read only code_hash, never the new plaintext column. This is
  // the load-bearing guarantee: the new column is display-only.
  const verifyBody = authSource.slice(authSource.indexOf("export async function verifyRaceDayCode"), authSource.indexOf("export async function resolveRaceDaySession"));
  assert.match(verifyBody, /code_hash/, "verifyRaceDayCode still authorizes off code_hash");
  assert.ok(!/eq\(\s*["']code["']/.test(verifyBody), "verifyRaceDayCode must never look up or compare against the plaintext code column");

  console.log("lib/race_day_auth.mjs checked: the plaintext code is stored and can be revoked/expired away, but verifyRaceDayCode's own authorization check still reads only code_hash -- the new column is display-only.");
}

// --- all four client scripts: the dialog re-shows the current code every time it's open, not just once ---
for (const source of clientScripts) {
  assert.match(source, /function renderRaceDayStatus/);
  const body = source.slice(source.indexOf("function renderRaceDayStatus"), source.indexOf("function renderRaceDayStatus") + 1600);
  assert.match(body, /if \(status\.code\) \{/, "renderRaceDayStatus shows the reveal box whenever the server returns a current code, not only right after generating one");
  assert.match(body, /raceDayRevealCode\.textContent = status\.code/, "the reveal box is populated from status.code on every render, not just the one-time generate response");
}
console.log("All four race-day-code dialogs (Split Watch hub, Plan, Live, Team Home) checked: the current code is shown again every time the dialog reopens, not hidden after the first reveal.");

// --- all four page templates: the label no longer promises a one-time reveal ---
for (const source of pageTemplates) {
  assert.ok(!/won't be shown again/i.test(source), "the reveal label must not promise a one-time reveal now that the code is shown again on every reopen");
}
console.log("All four page templates checked: the reveal label no longer claims the code 'won't be shown again'.");

console.log("\nRace day code reveal fix (2026-08-27 feedback): source-level checks passed.");
