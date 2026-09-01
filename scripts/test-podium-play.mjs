import assert from "node:assert/strict";

// public/scripts/podium-play.js is a plain classic script (matching every
// other file in public/scripts/), so it attaches its pure/testable pieces
// to window.PodiumPlay rather than using export -- same pattern already
// used by public/scripts/pace-splits.js (see scripts/test-pace-calculator.mjs).
// A minimal window stub is all this file's pure section needs; the DOM
// wiring below it is skipped entirely because `document` is left
// undefined (see podium-play.js's own `typeof document === "undefined"`
// guard).
global.window = {};
await import("../public/scripts/podium-play.js");

const {
  DAILY_POINT_CAP,
  FIRST_GAME_IN_COOLDOWN_POINTS,
  PERSONAL_RECORD_POINTS,
  LEVELS,
  PHOTO_FINISH_TARGET_SECONDS,
  photoFinishScoreBand,
  STARTING_GUN_MIN_DELAY_MS,
  STARTING_GUN_MAX_DELAY_MS,
  randomStartingGunDelayMs,
  startingGunScoreBand,
  HURDLE_DASH_GROUND_Y,
  HURDLE_DASH_JUMP_DURATION_SECONDS,
  HURDLE_DASH_INITIAL_SPEED,
  HURDLE_DASH_MAX_SPEED,
  HURDLE_DASH_SAFE_GAP_MIN_MULTIPLIER,
  hurdleDashSpeedAtElapsed,
  hurdleDashJumpOffset,
  rectsOverlap,
  hurdleDashNextGap,
  hurdleDashGameScore,
  levelForPoints,
  todayLocalDateKey,
  defaultProfile,
  sanitizeProfile,
  loadProfile,
  saveProfile,
  awardPoints
} = global.window.PodiumPlay;

assert.equal(PHOTO_FINISH_TARGET_SECONDS, 15, "Photo Finish targets exactly 15.00 seconds, per spec.");

// installId is a fresh random UUID on every defaultProfile() call, so two
// independently generated fresh profiles never deep-equal on that one
// field -- every "is this a fresh profile" comparison below goes through
// this helper instead of a raw deepEqual against defaultProfile().
function withoutInstallId(profile) {
  const { installId, ...rest } = profile;
  return rest;
}
function assertIsFreshProfile(profile, message) {
  assert.deepEqual(withoutInstallId(profile), withoutInstallId(defaultProfile()), message);
}

// --- photoFinishScoreBand ----------------------------------------------

assert.equal(photoFinishScoreBand(0), 1000, "Exactly on target earns 1000.");
assert.equal(photoFinishScoreBand(0.01), 750, "Within 0.01 earns 750.");
assert.equal(photoFinishScoreBand(-0.01), 750, "The band uses the absolute difference, sign must not matter.");
assert.equal(photoFinishScoreBand(0.05), 500, "Within 0.05 earns 500.");
assert.equal(photoFinishScoreBand(0.10), 300, "Within 0.10 earns 300.");
assert.equal(photoFinishScoreBand(0.25), 150, "Within 0.25 earns 150.");
assert.equal(photoFinishScoreBand(0.50), 75, "Within 0.50 earns 75.");
assert.equal(photoFinishScoreBand(0.51), 20, "Anything beyond 0.50 still earns the 20-point floor for a valid attempt.");
assert.equal(photoFinishScoreBand(5), 20, "A wildly off attempt still earns the 20-point floor, never 0, for a valid completed attempt.");
// Real floating-point boundary safety: 0.01, 0.05, 0.1, 0.25 do not store
// exactly in binary, so a naive `diff <= 0.05` comparison can misfire
// right at the edge. This must land in the correct band regardless.
assert.equal(photoFinishScoreBand(0.1), 300, "0.1 (binary-imprecise) must still land in the <=0.10 band, not slip into the next one.");
assert.equal(photoFinishScoreBand(0.05000000001), 500, "A float sliver over 0.05 must round to the same hundredth and stay in the <=0.05 band.");

// --- randomStartingGunDelayMs ----------------------------------------------

assert.equal(STARTING_GUN_MIN_DELAY_MS, 1500, "The spec's random delay floor is 1.5 seconds.");
assert.equal(STARTING_GUN_MAX_DELAY_MS, 4000, "The spec's random delay ceiling is 4.0 seconds.");
assert.equal(randomStartingGunDelayMs(() => 0), STARTING_GUN_MIN_DELAY_MS, "A random() of exactly 0 must land exactly on the floor.");
assert.equal(randomStartingGunDelayMs(() => 1), STARTING_GUN_MAX_DELAY_MS, "A random() of exactly 1 must land exactly on the ceiling.");
assert.equal(randomStartingGunDelayMs(() => 0.5), (STARTING_GUN_MIN_DELAY_MS + STARTING_GUN_MAX_DELAY_MS) / 2, "A midpoint random() must land exactly at the midpoint delay.");
{
  // A real spread check against the actual Math.random default, not just
  // an injected fixed value -- confirms every real call stays in bounds.
  for (let i = 0; i < 200; i += 1) {
    const delay = randomStartingGunDelayMs();
    assert.ok(delay >= STARTING_GUN_MIN_DELAY_MS && delay <= STARTING_GUN_MAX_DELAY_MS, `Delay ${delay} must always fall within [1500, 4000].`);
  }
}

// --- startingGunScoreBand ----------------------------------------------------

assert.deepEqual(startingGunScoreBand(120), { score: 1000, suspicious: true }, "Under 150ms scores 1000 but is flagged suspicious for any future public ranking.");
assert.deepEqual(startingGunScoreBand(149), { score: 1000, suspicious: true }, "149ms is still under the 150ms boundary.");
assert.deepEqual(startingGunScoreBand(150), { score: 750, suspicious: false }, "Exactly 150ms is the start of the real (non-suspicious) 750 band.");
assert.deepEqual(startingGunScoreBand(199), { score: 750, suspicious: false });
assert.deepEqual(startingGunScoreBand(200), { score: 500, suspicious: false });
assert.deepEqual(startingGunScoreBand(249), { score: 500, suspicious: false });
assert.deepEqual(startingGunScoreBand(250), { score: 300, suspicious: false });
assert.deepEqual(startingGunScoreBand(299), { score: 300, suspicious: false });
assert.deepEqual(startingGunScoreBand(300), { score: 150, suspicious: false });
assert.deepEqual(startingGunScoreBand(399), { score: 150, suspicious: false });
assert.deepEqual(startingGunScoreBand(400), { score: 75, suspicious: false });
assert.deepEqual(startingGunScoreBand(599), { score: 75, suspicious: false });
assert.deepEqual(startingGunScoreBand(600), { score: 20, suspicious: false }, "600ms and slower still earns the 20-point floor for a valid response.");
assert.deepEqual(startingGunScoreBand(2000), { score: 20, suspicious: false });
assert.deepEqual(startingGunScoreBand(199.4), { score: 750, suspicious: false }, "A fractional millisecond reading rounds to the nearest whole ms before banding (199.4 rounds to 199, staying in the 750 band).");
assert.deepEqual(startingGunScoreBand(199.6), { score: 500, suspicious: false }, "199.6 rounds up to 200, crossing into the 500 band.");

// --- Hurdle Dash physics/scoring ---------------------------------------------

assert.ok(HURDLE_DASH_JUMP_DURATION_SECONDS > 0 && HURDLE_DASH_JUMP_DURATION_SECONDS < 2, "The full jump arc must be a real, human-scale duration.");

// hurdleDashSpeedAtElapsed
assert.equal(hurdleDashSpeedAtElapsed(0), HURDLE_DASH_INITIAL_SPEED, "Speed starts at the configured initial value.");
assert.equal(hurdleDashSpeedAtElapsed(-5), HURDLE_DASH_INITIAL_SPEED, "A negative/invalid elapsed time never produces a speed below the starting speed.");
assert.ok(hurdleDashSpeedAtElapsed(10) > HURDLE_DASH_INITIAL_SPEED, "Speed increases the longer a run continues.");
assert.equal(hurdleDashSpeedAtElapsed(100000), HURDLE_DASH_MAX_SPEED, "Speed is capped at the configured maximum, however long a run continues.");

// hurdleDashJumpOffset -- a real parabola: starts and ends at 0 (grounded),
// positive in between (airborne), symmetric around the midpoint.
assert.equal(hurdleDashJumpOffset(0), 0, "The instant a jump starts, height is 0 (still at the ground).");
assert.equal(hurdleDashJumpOffset(-1), 0, "A negative time (before the jump started) is never airborne.");
assert.equal(hurdleDashJumpOffset(HURDLE_DASH_JUMP_DURATION_SECONDS), 0, "The exact instant a jump's full duration has elapsed, the runner is back at 0 (landed).");
assert.equal(hurdleDashJumpOffset(HURDLE_DASH_JUMP_DURATION_SECONDS + 1), 0, "Well after landing, height stays 0, never goes negative or resumes.");
{
  const midpoint = HURDLE_DASH_JUMP_DURATION_SECONDS / 2;
  const peak = hurdleDashJumpOffset(midpoint);
  assert.ok(peak > 0, "The runner is genuinely airborne at the midpoint of a jump.");
  const quarter = hurdleDashJumpOffset(midpoint / 2);
  const threeQuarter = hurdleDashJumpOffset(midpoint * 1.5);
  assert.ok(Math.abs(quarter - threeQuarter) < 0.01, "A real parabola is symmetric: equal time before and after the peak reach the same height.");
  assert.ok(peak > quarter, "The peak (midpoint) must be the highest point of the arc.");
}

// rectsOverlap
assert.equal(rectsOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 }), true, "Two genuinely overlapping rectangles must be detected.");
assert.equal(rectsOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 20, width: 10, height: 10 }), false, "Two far-apart rectangles must not register as a collision.");
assert.equal(rectsOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 10, height: 10 }), false, "Two rectangles that only touch at an edge (no real overlap area) must not register as a collision.");
assert.equal(rectsOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 20, width: 10, height: 10 }), false, "Overlapping on the x-axis alone (not y) must not register as a collision.");

// hurdleDashNextGap -- the real "never impossible" guarantee: whatever
// gap comes back, converted to time at that same speed, must always be
// at least the real jump duration (with the built-in safety buffer).
for (const speed of [HURDLE_DASH_INITIAL_SPEED, (HURDLE_DASH_INITIAL_SPEED + HURDLE_DASH_MAX_SPEED) / 2, HURDLE_DASH_MAX_SPEED]) {
  for (let i = 0; i < 100; i += 1) {
    const gap = hurdleDashNextGap(speed);
    const gapSeconds = gap / speed;
    assert.ok(gapSeconds >= HURDLE_DASH_JUMP_DURATION_SECONDS * HURDLE_DASH_SAFE_GAP_MIN_MULTIPLIER - 0.0001, `At speed ${speed}, a gap of ${gapSeconds}s must never be tighter than a real jump can clear.`);
  }
}
assert.equal(hurdleDashNextGap(HURDLE_DASH_INITIAL_SPEED, () => 0), HURDLE_DASH_JUMP_DURATION_SECONDS * HURDLE_DASH_SAFE_GAP_MIN_MULTIPLIER * HURDLE_DASH_INITIAL_SPEED, "A random() of 0 must land exactly on the safe minimum gap.");

// hurdleDashGameScore
assert.equal(hurdleDashGameScore(0, 0, 0), 0, "No distance, no hurdles, no trophies is a real 0 score, not a crash.");
assert.equal(hurdleDashGameScore(100, 0, 0), 10, "100 distance units at 10 units/point is exactly 10 score.");
assert.equal(hurdleDashGameScore(105, 0, 0), 10, "A partial distance unit is not rounded up -- distance points floor down.");
assert.equal(hurdleDashGameScore(0, 4, 0), 100, "4 cleared hurdles at 25 points each is exactly 100.");
assert.equal(hurdleDashGameScore(0, 0, 3), 120, "3 trophies at 40 points each is exactly 120.");
assert.equal(hurdleDashGameScore(500, 8, 2), 330, "Distance, hurdles, and trophies combine additively: 50 + 200 + 80 = 330.");
assert.equal(hurdleDashGameScore(-50, -1, -1), 0, "Negative/invalid inputs never produce a negative score.");

// --- levelForPoints ------------------------------------------------------

assert.equal(levelForPoints(0).name, "Rookie Runner");
assert.equal(levelForPoints(99).name, "Rookie Runner", "99 points has not yet reached Junior Varsity's 100-point threshold.");
assert.equal(levelForPoints(100).name, "Junior Varsity", "Exactly hitting a threshold advances the level.");
assert.equal(levelForPoints(300).name, "Varsity");
assert.equal(levelForPoints(9999).name, "State Champion", "9999 has not yet reached Podium Legend's 10,000-point threshold.");
assert.equal(levelForPoints(10000).name, "Podium Legend");
assert.equal(levelForPoints(50000).name, "Podium Legend", "Points beyond the top threshold stay at the top level, never overflow.");
assert.equal(levelForPoints(50000).next, null, "The top level has no next level to progress toward.");
assert.equal(levelForPoints(50000).progress, 1, "The top level always reports full progress.");
assert.equal(levelForPoints(150).next.name, "Varsity");
assert.ok(Math.abs(levelForPoints(200).progress - 0.5) < 0.001, "Halfway between Junior Varsity (100) and Varsity (300) is 50% progress.");
assert.equal(levelForPoints(-50).name, "Rookie Runner", "A negative/invalid point total is treated as 0, never crashes or picks a bogus level.");
assert.equal(LEVELS.length, 10, "All 10 launch levels from the spec must be present.");

// --- todayLocalDateKey -----------------------------------------------------

assert.equal(todayLocalDateKey(new Date(2026, 8, 1)), "2026-09-01", "September 1 2026 (local) must format as 2026-09-01.");
assert.equal(todayLocalDateKey(new Date(2026, 0, 5)), "2026-01-05", "Single-digit month/day must be zero-padded.");

// --- defaultProfile / sanitizeProfile ---------------------------------------

{
  const fresh = defaultProfile();
  assert.equal(fresh.points, 0);
  assert.equal(fresh.photoFinish.personalRecord, null);
  assert.equal(fresh.startingGun.personalRecord, null);
  assert.equal(fresh.startingGun.falseStarts, 0);
  assert.equal(fresh.hurdleDash.bestDistance, null);
  assert.equal(fresh.hurdleDash.bestHurdlesCleared, null);
  assert.equal(fresh.hurdleDash.bestGameScore, null);
  assert.ok(fresh.installId, "A fresh profile always has an anonymous install id.");
}

assertIsFreshProfile(sanitizeProfile(null), "Null input recovers with fresh-profile defaults rather than crashing.");
assert.ok(sanitizeProfile(null).installId, "The recovered profile still has its own anonymous install id.");
assert.equal(sanitizeProfile({ version: 999, points: 5000 }).points, 0, "An unrecognized future profile version is not guessed at -- it resets to fresh rather than trusting unknown data.");
assert.equal(sanitizeProfile("not an object").points, 0, "Malformed (non-object) stored data recovers safely.");

{
  const real = {
    version: 1, installId: "abc-123", points: 250, pointsAwardedToday: { date: "2026-08-31", amount: 40 }, awardedKeys: ["k1", "k2"],
    photoFinish: { personalRecord: { diffSeconds: 0.03, elapsedSeconds: 15.03 }, attempts: 4 },
    startingGun: { personalRecord: { reactionMs: 187, suspicious: false }, attempts: 6, falseStarts: 2 },
    hurdleDash: { bestDistance: 4200, bestHurdlesCleared: 14, bestGameScore: 810, attempts: 9 }
  };
  const sanitized = sanitizeProfile(real);
  assert.equal(sanitized.points, 250, "Valid real data is preserved, not discarded.");
  assert.equal(sanitized.installId, "abc-123");
  assert.equal(sanitized.photoFinish.personalRecord.diffSeconds, 0.03);
  assert.equal(sanitized.startingGun.personalRecord.reactionMs, 187);
  assert.equal(sanitized.startingGun.falseStarts, 2);
  assert.equal(sanitized.hurdleDash.bestDistance, 4200);
  assert.equal(sanitized.hurdleDash.bestHurdlesCleared, 14);
  assert.equal(sanitized.hurdleDash.bestGameScore, 810);
  assert.equal(sanitized.awardedKeys.length, 2);
}

assert.equal(sanitizeProfile({ version: 1, points: 100, photoFinish: { personalRecord: { diffSeconds: "not a number" } } }).photoFinish.personalRecord, null, "A corrupted personal record is dropped rather than trusted.");
assert.equal(sanitizeProfile({ version: 1, points: 100, startingGun: { personalRecord: { reactionMs: "not a number" } } }).startingGun.personalRecord, null, "A corrupted Starting Gun record is dropped rather than trusted.");
assert.equal(sanitizeProfile({ version: 1, points: 100, hurdleDash: { bestDistance: -50 } }).hurdleDash.bestDistance, null, "A negative Hurdle Dash best is dropped, not trusted as a real record.");
assert.equal(sanitizeProfile({ version: 1, points: 100, hurdleDash: { bestDistance: "not a number" } }).hurdleDash.bestDistance, null, "A corrupted Hurdle Dash best is dropped rather than trusted.");
assert.equal(sanitizeProfile({ version: 1, points: -50 }).points, 0, "A negative stored point total is clamped to 0, never trusted as-is.");

// --- loadProfile / saveProfile (localStorage-backed persistence) -----------

{
  const store = new Map();
  global.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key)
  };

  assertIsFreshProfile(loadProfile(), "With nothing stored yet, loadProfile returns a fresh profile.");

  const profile = defaultProfile();
  profile.points = 42;
  saveProfile(profile);
  const reloaded = loadProfile();
  assert.equal(reloaded.points, 42, "A saved profile is correctly reloaded.");

  store.set(global.window.PodiumPlay.PROFILE_STORAGE_KEY, "{not valid json");
  assertIsFreshProfile(loadProfile(), "Malformed stored JSON recovers with a fresh profile rather than throwing.");

  global.localStorage = {
    getItem: () => { throw new Error("storage disabled"); },
    setItem: () => { throw new Error("storage disabled"); }
  };
  assertIsFreshProfile(loadProfile(), "A throwing localStorage.getItem (disabled/blocked storage) recovers safely.");
  assert.doesNotThrow(() => saveProfile(defaultProfile()), "A throwing localStorage.setItem must never propagate into the caller.");
}

// --- awardPoints: idempotency and the daily cap -----------------------------

{
  const profile = defaultProfile();
  const granted1 = awardPoints(profile, "first-game-session-a", FIRST_GAME_IN_COOLDOWN_POINTS);
  assert.equal(granted1, FIRST_GAME_IN_COOLDOWN_POINTS);
  assert.equal(profile.points, FIRST_GAME_IN_COOLDOWN_POINTS);

  const granted2 = awardPoints(profile, "first-game-session-a", FIRST_GAME_IN_COOLDOWN_POINTS);
  assert.equal(granted2, 0, "Reusing the same key never re-awards points, even for the exact same amount.");
  assert.equal(profile.points, FIRST_GAME_IN_COOLDOWN_POINTS, "A repeated award attempt must not change the point total at all.");

  const granted3 = awardPoints(profile, "first-game-session-b", FIRST_GAME_IN_COOLDOWN_POINTS);
  assert.equal(granted3, FIRST_GAME_IN_COOLDOWN_POINTS, "A genuinely different key is a genuinely new award.");
  assert.equal(profile.points, FIRST_GAME_IN_COOLDOWN_POINTS * 2);
}

{
  const profile = defaultProfile();
  profile.pointsAwardedToday = { date: todayLocalDateKey(), amount: DAILY_POINT_CAP - 5 };
  const granted = awardPoints(profile, "near-cap-award", PERSONAL_RECORD_POINTS);
  assert.equal(granted, 5, "An award that would exceed the daily cap is truncated to whatever room remains.");
  assert.equal(profile.pointsAwardedToday.amount, DAILY_POINT_CAP, "The day's awarded total never exceeds the configured cap.");

  const grantedAtCap = awardPoints(profile, "another-award-same-day", PERSONAL_RECORD_POINTS);
  assert.equal(grantedAtCap, 0, "Once the daily cap is reached, a further award grants 0 points.");
}

{
  const profile = defaultProfile();
  profile.pointsAwardedToday = { date: "2020-01-01", amount: DAILY_POINT_CAP };
  const granted = awardPoints(profile, "new-day-award", PERSONAL_RECORD_POINTS);
  assert.equal(granted, PERSONAL_RECORD_POINTS, "A new local calendar day resets the daily cap -- yesterday being maxed out must not block today.");
}

console.log("photoFinishScoreBand checked: every scoring band from the spec, including real floating-point boundary safety at 0.05/0.10.");
console.log("randomStartingGunDelayMs checked: exact floor/ceiling/midpoint against an injected random function, plus a real spread check against actual Math.random() staying in [1500, 4000].");
console.log("startingGunScoreBand checked: every scoring band from the spec including the <150ms suspicious flag, every real boundary (150/200/250/300/400/600), and millisecond rounding at a real fractional boundary.");
console.log("Hurdle Dash physics checked: speed ramp and its cap, a real symmetric jump parabola (grounded at both ends, peak at the midpoint), AABB rectangle collision (including touching-but-not-overlapping and axis-only-overlap non-collisions), the never-impossible hurdle gap guarantee across the full speed range (100 samples each at min/mid/max speed), and additive game scoring with floor-not-round distance points.");
console.log("levelForPoints checked: all 10 launch levels, exact-threshold advancement, top-level clamping, and negative-input safety.");
console.log("todayLocalDateKey checked: zero-padded local date formatting.");
console.log("defaultProfile/sanitizeProfile checked: fresh-profile defaults, malformed/corrupted/future-version data recovering safely without crashing, and valid real data being preserved rather than discarded.");
console.log("loadProfile/saveProfile checked against a real localStorage stub: round-trip persistence, malformed stored JSON, and a fully disabled/throwing storage API -- none of it ever throws into the caller.");
console.log("awardPoints checked: same-key idempotency (never re-awards), a different key still awards normally, the daily cap truncates an over-the-cap award, a maxed-out day grants 0 further points, and a new calendar day resets the cap.");
