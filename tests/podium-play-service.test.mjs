import assert from "node:assert/strict";
import {
  photoFinishScoreBand,
  startingGunScoreBand,
  hurdleDashGameScore,
  levelForPoints,
  cleanDisplayName,
  validateRawInput,
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
assert.equal(levelForPoints(10000).name, "Podium Legend");
assert.equal(levelForPoints(50000).next, null);
assert.equal(LEVELS.length, 10);

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

for (const points of [0, 50, 100, 299, 300, 700, 1199, 3000, 10000, 50000]) {
  assert.deepEqual(levelForPoints(points), client.levelForPoints(points), `Level must match at points=${points}`);
}
assert.deepEqual(LEVELS, client.LEVELS, "The launch level table itself must be byte-identical between client and server.");

console.log("photoFinishScoreBand/startingGunScoreBand/hurdleDashGameScore/levelForPoints checked: every real band and boundary.");
console.log("cleanDisplayName checked: real spaces/hyphens preserved, whitespace collapsed, real control characters stripped, length capped -- confirms the earlier bug (a regex that stripped every space and hyphen) is genuinely fixed.");
console.log("validateRawInput checked: every game type's real valid range, and every invalid/missing/malformed/out-of-range input rejected rather than silently coerced.");
console.log("Client/server scoring parity checked across a real range of inputs for every scoring function and the full level table -- the two independent copies (one for instant client feedback, one server-authoritative) cannot silently drift apart without this test catching it.");
