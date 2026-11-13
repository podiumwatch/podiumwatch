import test from "node:test";
import assert from "node:assert/strict";
import { DATED_CTAS, isLive, ohioDateKey, seasonPhase } from "../src/config/season.mjs";

test("the phase follows Ohio's calendar date", () => {
  assert.equal(seasonPhase(new Date("2026-10-31T16:00:00Z")).key, "xc-postseason");
  assert.equal(seasonPhase(new Date("2026-11-10T15:00:00Z")).key, "xc-wrapup");
  assert.equal(seasonPhase(new Date("2026-12-15T15:00:00Z")).key, "indoor");
  // 11:30 PM ET on Nov. 7 is still Nov. 7 in Ohio (04:30 UTC Nov. 8).
  assert.equal(ohioDateKey(new Date("2026-11-08T04:30:00Z")), "2026-11-07");
  assert.equal(seasonPhase(new Date("2026-11-08T04:30:00Z")).key, "xc-postseason");
});

test("outside the calendar the nearest phase is used", () => {
  assert.equal(seasonPhase(new Date("2025-01-01T12:00:00Z")).key, "xc-regular");
  assert.equal(seasonPhase(new Date("2028-01-01T12:00:00Z")).key, "summer");
});

test("a build on Nov. 10 shows no expired call to action", () => {
  const nov10 = new Date("2026-11-10T12:00:00Z");
  assert.equal(isLive(DATED_CTAS.awardsNominations, nov10), false);
  assert.equal(isLive(DATED_CTAS.awardsVoting, nov10), true);
  assert.equal(isLive(DATED_CTAS.awardsWinners, nov10), false);
  // Waits for published winners, never a clock time (2026-11-13).
  assert.equal(DATED_CTAS.awardsWinners.showWhen, "awards-2026-winners");
  assert.equal(isLive(DATED_CTAS.awardsWinners, new Date("2026-11-14T13:00:00Z")), false);
  const live = Object.values(DATED_CTAS).filter((cta) => isLive(cta, nov10));
  assert.equal(live.length, 1);
});
