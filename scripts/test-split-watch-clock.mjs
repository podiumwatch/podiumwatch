import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

// Race clock accuracy (Split Watch track build Phase 1, 2026-11-12).
// Live cross country test: started at the gun, and by the finish about 17
// minutes later the Split Watch clock was roughly 15 s off the official
// clock, sometimes ahead, sometimes behind. Causes found: the start was
// stored in the starting phone's own (uncorrected) clock and taken after
// the confirm box; the starting phone timed with performance.now(), which
// can stop while an Android phone sleeps; the correction was one noisy
// sample, replaced on every request, with the server's processing time
// inside it. This test simulates the whole race with fake clocks and a
// fake, uneven network and checks the fix against the agreed limits:
// the start within 0.3 s of the tap even with the start request delayed
// 8 s, and at 17:00 every phone within 0.3 s of true elapsed time.

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
function load(nowMs) {
  const context = { window: {}, Math, Number, Date };
  vm.createContext(context);
  vm.runInContext(read("../public/scripts/race-timer.js"), context);
  vm.runInContext(read("../public/scripts/race-clock-sync.js"), context);
  return {
    timer: context.window.PodiumRaceTimer.createRaceTimer({ nowMs }),
    sync: context.window.PodiumRaceClockSync.createClockSync({ nowMs }),
    ClockSync: context.window.PodiumRaceClockSync
  };
}

// Deterministic "random" numbers so the test is repeatable.
let seed = 20261112;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

let trueNow = 1_800_000_000_000; // an arbitrary true "now"
const T0 = trueNow; // the gun

// True time is server time, in ms. A phone clock = true + skew + drift.
function phone(skewMs, driftPpm) {
  const p = { skewMs, driftPpm, extraMs: 0 };
  // Drift counts from the gun (T0), so the skew stays what it says.
  p.clock = (trueMs) => trueMs + p.skewMs + p.extraMs + ((trueMs - T0) * p.driftPpm) / 1e6;
  return p;
}


// One clock sample over an uneven network: uplink and downlink each 40 ms
// to `maxLegMs`, server processing 0-2 s (cold start, database). Fills in
// the four timestamps exactly as a phone would see them.
function sample(p, sync, { maxLegMs = 1200, serverMs = null } = {}) {
  const up = 40 + rand() * (maxLegMs - 40);
  const down = 40 + rand() * (maxLegMs - 40);
  const work = serverMs ?? rand() * 2000;
  const sentTrue = trueNow;
  const recvTrue = sentTrue + up + work + down;
  const result = sync.addSample({
    sentMs: p.clock(sentTrue),
    serverReceivedMs: sentTrue + up,
    serverSentMs: sentTrue + up + work,
    receivedMs: p.clock(recvTrue)
  });
  trueNow = recvTrue + 150; // the page waits 150 ms between samples
  return result;
}
function burst(p, sync, timer, count = 4, options) {
  for (let i = 0; i < count; i += 1) sample(p, sync, options);
  const offset = sync.offsetMs();
  if (offset !== null) timer.setClockOffsetMs(offset);
}

// ---- Clock sync basics -------------------------------------------------------
{
  const A = phone(-15_000, 0);
  const { sync } = load(() => A.clock(trueNow));
  // A fast sample, then a very slow one: the slow one is thrown away.
  const good = sample(A, sync, { maxLegMs: 60, serverMs: 5 });
  assert.equal(good.accepted, true);
  assert.ok(Math.abs(sync.offsetMs() - 15_000) < 60, "a fast sample measures the offset within half its round trip");
  const slow = sync.addSample({ sentMs: A.clock(trueNow), serverReceivedMs: trueNow + 4000, serverSentMs: trueNow + 4000, receivedMs: A.clock(trueNow + 4100) });
  assert.equal(slow.accepted, false, "a sample slower than 1.5 s is thrown away");
  assert.ok(Math.abs(sync.offsetMs() - 15_000) < 60, "a slow sample never moves the correction");
  // Server processing time doesn't count: 3 s of server work, fast network.
  const busyServer = sample(A, sync, { maxLegMs: 80, serverMs: 3000 });
  assert.equal(busyServer.accepted, true);
  assert.ok(busyServer.rttMs < 200, "the server's own processing time is taken out of the round trip");
  assert.ok(Math.abs(busyServer.offsetMs - 15_000) < 80);
}

// ---- The 17-minute race --------------------------------------------------------
const A = phone(-15_000, 40); // starting phone: 15 s behind the server, drifting 40 ppm
const B = phone(8_000, -35);  // second phone: 8 s ahead, drifting the other way
let a = load(() => A.clock(trueNow));
const b = load(() => B.clock(trueNow));

// Before the start, phone A takes its first samples (page load).
trueNow = T0 - 30_000;
burst(A, a.sync, a.timer, 5);

// The gun: the coach taps Start. The confirm box takes 2.2 s to answer, and
// the start request then takes 8 s to reach the server.
trueNow = T0;
const tapLocalMs = A.clock(trueNow);
trueNow += 2_200;
const { raceStartWallClockMs: startSent } = a.timer.startRace(tapLocalMs);
trueNow += 8_000; // the delayed start request
const officialStart = startSent; // the server stores what the phone sent (first start wins)
assert.ok(Math.abs(officialStart - T0) <= 300, `the recorded start matches the tap within 0.3 s (off by ${((officialStart - T0) / 1000).toFixed(3)} s) even with the start request delayed 8 s`);

// Minutes 0-4: refresh every minute (3 samples each).
for (let minute = 1; minute <= 4; minute += 1) { trueNow = T0 + minute * 60_000; burst(A, a.sync, a.timer, 3); }

// Minutes 4-8: screen locked. No samples at all; the clock is wall-clock
// based now, so a sleeping phone loses nothing.
trueNow = T0 + 8 * 60_000;
const afterLock = a.timer.elapsedNow();
assert.ok(Math.abs(afterLock - (trueNow - T0) / 1000) <= 0.3, `after a 4-minute screen lock the starting phone is within 0.3 s (off by ${(afterLock - (trueNow - T0) / 1000).toFixed(3)} s)`);
burst(A, a.sync, a.timer, 3); // visible again: fresh samples

// Minute 8: phone B joins late (opened the link mid-race).
trueNow = T0 + 8 * 60_000 + 20_000;
burst(B, b.sync, b.timer, 5);
b.timer.recoverFromWallClock(officialStart);

// Minutes 9-11: page in the background (no samples), then visible again.
trueNow = T0 + 11 * 60_000;
burst(A, a.sync, a.timer, 3);
burst(B, b.sync, b.timer, 3);

// Minute 11.5: phone A's own clock jumps 2 s (the phone synced its time).
A.extraMs += 2_000;
trueNow = T0 + 11.5 * 60_000;
burst(A, a.sync, a.timer, 3);

// Minute 12: phone A reloads the page. A fresh timer and clock sync; the
// saved best sample is restored, then fresh samples are taken.
const savedSample = a.sync.snapshot();
a = load(() => A.clock(trueNow));
trueNow = T0 + 12 * 60_000;
a.sync.restore(savedSample);
a.timer.setClockOffsetMs(a.sync.offsetMs());
a.timer.recoverFromWallClock(officialStart);
burst(A, a.sync, a.timer, 5);

// Minutes 13-17: normal refreshes, a few awful samples mixed in.
for (let minute = 13; minute <= 17; minute += 1) {
  trueNow = T0 + minute * 60_000 - 5_000;
  burst(A, a.sync, a.timer, 3, minute === 15 ? { maxLegMs: 4000 } : undefined);
  burst(B, b.sync, b.timer, 3, minute === 16 ? { maxLegMs: 4000 } : undefined);
}

// The finish: exactly 17:00 of true elapsed time.
trueNow = T0 + 17 * 60_000;
const trueElapsed = 17 * 60;
const elapsedA = a.timer.elapsedNow();
const elapsedB = b.timer.elapsedNow();
console.log(`At 17:00 true: starting phone ${elapsedA.toFixed(3)} s, late-joining phone ${elapsedB.toFixed(3)} s (start off by ${((officialStart - T0) / 1000).toFixed(3)} s).`);
assert.ok(Math.abs(elapsedA - trueElapsed) <= 0.3, `starting phone within 0.3 s of true elapsed time at 17:00 (off by ${(elapsedA - trueElapsed).toFixed(3)} s)`);
assert.ok(Math.abs(elapsedB - trueElapsed) <= 0.3, `late-joining phone within 0.3 s of true elapsed time (off by ${(elapsedB - trueElapsed).toFixed(3)} s)`);
assert.ok(Math.abs(elapsedA - elapsedB) <= 0.3, "the two phones agree within 0.3 s");

// What the old design would have shown, for the record: the start stored in
// phone A's own clock (tap + confirm delay), and phone B correcting itself
// against that uncorrected start.
const oldStart = A.clock(T0) + 2_200; // old: phone clock after the confirm box, no correction
const oldB = (trueNow - oldStart) / 1000; // B with a PERFECT correction, against the uncorrected start
console.log(`Old design, same race: the second phone would read ${(oldB - trueElapsed).toFixed(1)} s off at 17:00.`);
assert.ok(Math.abs(oldB - trueElapsed) > 10, "sanity: the old design reproduces the reported ~15 s error");

// ---- The clock status line -----------------------------------------------------
{
  const { ClockSync } = load(() => 0);
  assert.equal(ClockSync.describeStatus({ synced: false }), "Clock not synced yet -- using this phone's time");
  assert.equal(ClockSync.describeStatus({ synced: true, uncertaintyMs: 80, ageMs: 5000 }), "Clock synced (±0.1 s)");
  assert.equal(ClockSync.describeStatus({ synced: true, uncertaintyMs: 420, ageMs: 4 * 60000 }), "Clock synced 4 min ago (±0.4 s)");
  assert.match(ClockSync.describeStatus({ synced: true, uncertaintyMs: 100, ageMs: 30000 }, { offline: true }), /working offline/);
}

// ---- The live page uses it ---------------------------------------------------------
{
  const live = read("../public/scripts/split-watch-live.js");
  const page = read("../src/pages/splitwatchlive.mjs");
  assert.ok(page.indexOf('src="/scripts/race-clock-sync.js"') > -1 && page.indexOf('src="/scripts/race-clock-sync.js"') < page.indexOf('src="/scripts/split-watch-live.js"'), "the live page loads the clock sync before its own script");
  assert.match(live, /startButton\.addEventListener\("click", async \(\) => \{[\s\S]{0,400}const tapLocalMs = Date\.now\(\);[\s\S]{0,1200}window\.confirm\(/, "the start is taken at the tap, before the confirm box");
  assert.match(live, /Timer\.startRace\(tapLocalMs\)/, "the tap moment is what starts the race clock");
  assert.doesNotMatch(live, /updateClockOffset\(/, "the old single-sample correction is gone");
  assert.match(live, /CLOCK_REFRESH_MS = 60000/, "the correction refreshes every minute");
  assert.match(live, /visibilityState === "visible"\) measureClock\(3\)/, "and when the page becomes visible again");
  assert.match(live, /clockOffsetMs: Timer\.getClockOffsetMs\(\), clockUncertaintyMs:/, "each tap stores the correction in use");
  assert.match(live, /describeStatus\(clockSync\.status\(\)/, "the clock status shows on the live page");
  assert.match(live, /navigator\.wakeLock\.request\("screen"\)/, "the screen stays awake during a live race");
  assert.match(live, /action: "adjust_clock"/, "the manual 'set to official elapsed time' adjustment stays");
  assert.match(read("../api/split-watch/clock.js"), /server_received_ms: receivedMs, server_sent_ms: Date\.now\(\)/);
  for (const route of ["sync.js", "sessions.js"]) assert.match(read(`../api/split-watch/${route}`), /server_received_ms: serverReceivedMs, server_sent_ms: Date\.now\(\)/, `${route} replies carry the server's receive and send times`);
}

console.log("Race clock accuracy checked: the start is the tap in server time (within 0.3 s with an 8 s delayed start");
console.log("request), the correction keeps the fastest of several samples and throws away slow ones, and at 17:00 a");
console.log("starting phone (screen lock, background, phone clock change, reload) and a late-joining phone are both");
console.log("within 0.3 s of true elapsed time.");
