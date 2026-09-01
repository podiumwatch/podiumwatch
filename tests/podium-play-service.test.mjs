import assert from "node:assert/strict";
import {
  photoFinishScoreBand,
  startingGunScoreBand,
  hurdleDashGameScore,
  tapSprintDistanceForTaps,
  levelForPoints,
  cleanDisplayName,
  validateRawInput,
  isValidInstallId,
  generateGuestLabel,
  LEVELS,
  DAILY_POINT_CAP,
  PERSONAL_RECORD_POINTS,
  DAILY_ACTIVITY_POINTS
} from "../lib/podium_play_service.mjs";

// --- photoFinishScoreBand ----------------------------------------------

assert.equal(photoFinishScoreBand(0), 1000);
assert.equal(photoFinishScoreBand(0.01), 750);
assert.equal(photoFinishScoreBand(0.05), 500);
assert.equal(photoFinishScoreBand(0.10), 300);
assert.equal(photoFinishScoreBand(0.25), 150);
assert.equal(photoFinishScoreBand(0.50), 75);
assert.equal(photoFinishScoreBand(0.51), 20);
assert.equal(photoFinishScoreBand(-0.01), 750, "The band uses the absolute difference regardless of sign.");

// --- startingGunScoreBand ------------------------------------------------

assert.deepEqual(startingGunScoreBand(120), { score: 1000, suspicious: true });
assert.deepEqual(startingGunScoreBand(150), { score: 750, suspicious: false });
assert.deepEqual(startingGunScoreBand(200), { score: 500, suspicious: false });
assert.deepEqual(startingGunScoreBand(250), { score: 300, suspicious: false });
assert.deepEqual(startingGunScoreBand(300), { score: 150, suspicious: false });
assert.deepEqual(startingGunScoreBand(400), { score: 75, suspicious: false });
assert.deepEqual(startingGunScoreBand(600), { score: 20, suspicious: false });

// --- hurdleDashGameScore -------------------------------------------------

assert.equal(hurdleDashGameScore(0, 0, 0), 0);
assert.equal(hurdleDashGameScore(500, 8, 2), 330, "50 (distance) + 200 (hurdles) + 80 (trophies) = 330.");
assert.equal(hurdleDashGameScore(-50, -1, -1), 0, "Negative/invalid inputs never produce a negative score.");

// --- levelForPoints ------------------------------------------------------

assert.equal(levelForPoints(0).name, "Rookie Runner");
assert.equal(levelForPoints(100).name, "Junior Varsity");
assert.equal(levelForPoints(16500).name, "Podium Legend");
assert.equal(levelForPoints(50000).next, null);
assert.equal(LEVELS.length, 15, "All 15 fixed-requirement launch levels must be present.");
assert.deepEqual(LEVELS.map((l) => l.name), [
  "Rookie Runner", "Junior Varsity", "Varsity", "Conference Champion", "District Runner Up",
  "District Champion", "Regional Runner Up", "Regional Champion", "State Qualifier", "All Ohio",
  "State Runner Up", "State Champion", "Nationals Bound", "National Champion", "Podium Legend"
], "The 15 names and their exact order are a fixed product requirement.");

// --- cleanDisplayName ------------------------------------------------------

assert.equal(cleanDisplayName("Mary-Jane Smith"), "Mary-Jane Smith", "Real spaces and hyphens must be preserved, not stripped.");
assert.equal(cleanDisplayName("  Jane   Doe  "), "Jane Doe", "Leading/trailing whitespace trimmed, internal runs of whitespace collapsed to one space.");
assert.equal(cleanDisplayName("ABCD"), "ABCD", "Real control characters (NUL-range and DEL) are stripped.");
assert.equal(cleanDisplayName(null), "");
assert.equal(cleanDisplayName(undefined), "");
assert.equal(cleanDisplayName("x".repeat(200)).length, 60, "A very long name is capped at 60 characters.");

// --- validateRawInput ------------------------------------------------------

assert.deepEqual(validateRawInput("photo_finish", { elapsedSeconds: 15.07 }), { elapsedSeconds: 15.07 });
assert.throws(() => validateRawInput("photo_finish", { elapsedSeconds: 0.5 }), /valid/i, "Below the real minimum valid time must be rejected.");
assert.throws(() => validateRawInput("photo_finish", { elapsedSeconds: 999 }), /valid/i, "An impossibly large time must be rejected.");
assert.throws(() => validateRawInput("photo_finish", { elapsedSeconds: "not a number" }), /valid/i);
assert.throws(() => validateRawInput("photo_finish", {}), /valid/i, "A missing value must be rejected, not silently coerced.");

assert.deepEqual(validateRawInput("starting_gun", { reactionMs: 218 }), { reactionMs: 218 });
assert.throws(() => validateRawInput("starting_gun", { reactionMs: -5 }), /valid/i, "A negative reaction time is never physically real.");
assert.throws(() => validateRawInput("starting_gun", { reactionMs: 50000 }), /valid/i);

assert.deepEqual(validateRawInput("hurdle_dash", { distance: 1200, hurdlesCleared: 6, trophiesCollected: 2 }), { distance: 1200, hurdlesCleared: 6, trophiesCollected: 2 });
assert.throws(() => validateRawInput("hurdle_dash", { distance: -1, hurdlesCleared: 0, trophiesCollected: 0 }), /valid/i);
assert.throws(() => validateRawInput("hurdle_dash", { distance: 100, hurdlesCleared: 2.5, trophiesCollected: 0 }), /valid/i, "A fractional hurdle count is never real -- hurdles are a whole-number count.");
assert.throws(() => validateRawInput("hurdle_dash", { distance: 100, hurdlesCleared: 1, trophiesCollected: -1 }), /valid/i);

assert.throws(() => validateRawInput("not_a_real_game", {}), /unknown/i);

// --- validateRawInput: the 3 new games ------------------------------------

assert.deepEqual(validateRawInput("tap_sprint", { taps: 40 }), { taps: 40 });
assert.throws(() => validateRawInput("tap_sprint", { taps: -1 }), /valid/i, "A negative tap count is never physically real.");
assert.throws(() => validateRawInput("tap_sprint", { taps: 5.5 }), /valid/i, "A fractional tap count is never real -- taps are a whole-number count.");
assert.throws(() => validateRawInput("tap_sprint", { taps: 166 }), /valid/i, "166 taps in a real 10-second run, even at the client's own 65ms rate-limit floor, is not physically possible.");
assert.deepEqual(validateRawInput("tap_sprint", { taps: 165 }), { taps: 165 }, "165 is the real generous ceiling itself, still accepted.");

assert.deepEqual(validateRawInput("beat_the_runner", { highestRoundCompleted: 5 }), { highestRoundCompleted: 5 });
assert.deepEqual(validateRawInput("beat_the_runner", { highestRoundCompleted: 0 }), { highestRoundCompleted: 0 }, "0 rounds completed (lost round 1) is a real, valid result.");
assert.deepEqual(validateRawInput("beat_the_runner", { highestRoundCompleted: 8 }), { highestRoundCompleted: 8 }, "8 is the real total round count -- completing every round is valid.");
assert.throws(() => validateRawInput("beat_the_runner", { highestRoundCompleted: 9 }), /valid/i, "There are only 8 real rounds -- 9 completed is never possible.");
assert.throws(() => validateRawInput("beat_the_runner", { highestRoundCompleted: -1 }), /valid/i);

assert.deepEqual(validateRawInput("memory_match", { timeMs: 8000, moves: 6 }), { timeMs: 8000, moves: 6 });
assert.throws(() => validateRawInput("memory_match", { timeMs: 8000, moves: 2 }), /valid/i, "A real 3-pair board cannot be won in fewer than 3 moves.");
assert.deepEqual(validateRawInput("memory_match", { timeMs: 8000, moves: 3 }), { timeMs: 8000, moves: 3 }, "3 moves (a perfect game) is the real minimum, still valid.");
assert.throws(() => validateRawInput("memory_match", { timeMs: 100, moves: 6 }), /valid/i, "A real board cannot be solved in 100ms.");
assert.throws(() => validateRawInput("memory_match", { timeMs: 8000, moves: 501 }), /valid/i);

// --- Scoring for the 3 new games ------------------------------------------

assert.equal(tapSprintDistanceForTaps(10), 120, "10 taps at 12 distance/tap is exactly 120.");
assert.equal(tapSprintDistanceForTaps(-5), 0, "A negative/invalid tap count never produces a negative distance.");

// --- Guest identity: isValidInstallId / generateGuestLabel -------------

assert.equal(isValidInstallId("3267650b-245e-4627-903a-07c5fd887e80"), true, "A real, correctly-shaped v4 UUID (the exact shape crypto.randomUUID() produces) must be accepted.");
assert.equal(isValidInstallId("3267650B-245E-4627-903A-07C5FD887E80"), true, "A real UUID's hex digits are case-insensitive.");
assert.equal(isValidInstallId("not-a-uuid"), false);
assert.equal(isValidInstallId(""), false);
assert.equal(isValidInstallId(null), false);
assert.equal(isValidInstallId(undefined), false);
assert.equal(isValidInstallId(12345), false, "A non-string value must never be accepted, even one that could stringify into something plausible.");
assert.equal(isValidInstallId("3267650b-245e-4627-903a-07c5fd887e80extra"), false, "Trailing extra characters must not be accepted -- the whole string must match, not just a prefix.");

{
  const label = generateGuestLabel();
  assert.match(label, /^podiumwatchguest\d{4}$/, "A real generated label must match the exact promised shape.");
}
assert.equal(generateGuestLabel(() => 0), "podiumwatchguest1000", "A random() of 0 must land on the real floor of the promised 4-digit range.");
assert.equal(generateGuestLabel(() => 0.999999), "podiumwatchguest9999", "A random() near 1 must land on the real ceiling of the promised 4-digit range, never overflow to 5 digits.");
{
  // A real spread check, not just the two boundary values.
  for (let i = 0; i < 200; i += 1) {
    const label = generateGuestLabel();
    const number = Number(label.replace("podiumwatchguest", ""));
    assert.ok(number >= 1000 && number <= 9999, `Every real generated label's number must stay in [1000, 9999], got ${number}.`);
  }
}

// --- Config sanity -----------------------------------------------------

assert.equal(DAILY_POINT_CAP, 300);
assert.equal(PERSONAL_RECORD_POINTS, 10);
assert.equal(DAILY_ACTIVITY_POINTS, 10);

// --- Client/server scoring parity ---------------------------------------
// The client copy in public/scripts/podium-play.js exists purely for
// immediate on-screen feedback -- this server copy is the one that
// actually determines real points. Both must agree, or a signed-in
// player's on-screen result would silently lie about what they actually
// earned once the real server-validated submission comes back.
global.window = {};
await import("../public/scripts/podium-play.js");
const client = global.window.PodiumPlay;

for (let hundredths = 0; hundredths <= 60; hundredths += 1) {
  const diff = hundredths / 100;
  assert.equal(photoFinishScoreBand(diff), client.photoFinishScoreBand(diff), `Photo Finish band must match at diff=${diff}`);
}

for (let ms = 0; ms <= 700; ms += 7) {
  assert.deepEqual(startingGunScoreBand(ms), client.startingGunScoreBand(ms), `Starting Gun band must match at reactionMs=${ms}`);
}

for (const [distance, hurdles, trophies] of [[0, 0, 0], [500, 8, 2], [12345, 37, 9], [999, 0, 5], [10, 100, 0]]) {
  assert.equal(
    hurdleDashGameScore(distance, hurdles, trophies),
    client.hurdleDashGameScore(distance, hurdles, trophies),
    `Hurdle Dash score must match for (${distance}, ${hurdles}, ${trophies})`
  );
}

for (const taps of [0, 1, 10, 40, 100, 165]) {
  assert.equal(tapSprintDistanceForTaps(taps), client.tapSprintDistanceForTaps(taps), `Tap Sprint distance must match at taps=${taps}`);
}

for (const points of [0, 50, 100, 299, 300, 700, 1199, 3000, 10000, 50000, 16500, 20000]) {
  assert.deepEqual(levelForPoints(points), client.levelForPoints(points), `Level must match at points=${points}`);
}
assert.deepEqual(LEVELS, client.LEVELS, "The launch level table itself must be byte-identical between client and server.");

console.log("photoFinishScoreBand/startingGunScoreBand/hurdleDashGameScore/levelForPoints checked: every real band and boundary.");
console.log("cleanDisplayName checked: real spaces/hyphens preserved, whitespace collapsed, real control characters stripped, length capped -- confirms the earlier bug (a regex that stripped every space and hyphen) is genuinely fixed.");
console.log("validateRawInput checked: every one of all 6 game types' real valid range (including the 3 new games' own real physical ceilings/floors -- max real taps in 10s, the real 8-round cap, and a real board's minimum 3 moves), and every invalid/missing/malformed/out-of-range input rejected rather than silently coerced.");
console.log("tapSprintDistanceForTaps checked against real values, and in client/server parity below.");
console.log("isValidInstallId checked: real v4 UUIDs accepted case-insensitively, every malformed/wrong-type/trailing-garbage value rejected.");
console.log("generateGuestLabel checked: the exact promised \"podiumwatchguest####\" shape, both real boundary values (1000 and 9999) via an injected random function, and a 200-sample spread staying in range.");
console.log("Client/server scoring parity checked across a real range of inputs for every scoring function and the full level table -- the two independent copies (one for instant client feedback, one server-authoritative) cannot silently drift apart without this test catching it.");
