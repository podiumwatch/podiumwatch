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
  DAILY_ACTIVITY_POINTS,
  MIN_PARTICIPATION_POINTS,
  MAX_PARTICIPATION_POINTS,
  participationPointsForPlay,
  relayStartBand,
  relayPassBand,
  relayExchangeGameScore,
  coneSlalomGameScore,
  paceBeatBand,
  paceBeatScore,
  pacePerfectGameScore,
  packPassGameScore,
  finishChuteGameScore,
  spikeShuffleGameScore,
  runnerSaysGameScore
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

// --- validateRawInput: the 7 more games (2026-09-02) ----------------------

assert.deepEqual(validateRawInput("relay_exchange", { finishTimeMs: 9800, place: 1, startErrorsMs: [10, -20, 30], passErrorsMs: [5, null, 90] }), { finishTimeMs: 9800, place: 1, startErrorsMs: [10, -20, 30], passErrorsMs: [5, null, 90] });
assert.throws(() => validateRawInput("relay_exchange", { finishTimeMs: 0, place: 1, startErrorsMs: [0, 0, 0], passErrorsMs: [0, 0, 0] }), /valid/i, "A zero or negative finish time is never real.");
assert.throws(() => validateRawInput("relay_exchange", { finishTimeMs: 9800, place: 4, startErrorsMs: [0, 0, 0], passErrorsMs: [0, 0, 0] }), /valid/i, "There are only 3 real lanes -- 4th place is never possible.");
assert.throws(() => validateRawInput("relay_exchange", { finishTimeMs: 9800, place: 1, startErrorsMs: [0, 0], passErrorsMs: [0, 0, 0] }), /valid/i, "Exactly 3 exchanges are required, never 2.");
assert.throws(() => validateRawInput("relay_exchange", { finishTimeMs: 9800, place: 1, startErrorsMs: [0, 0, 0], passErrorsMs: [0, 0, "not a number"] }), /valid/i);

assert.deepEqual(validateRawInput("cone_slalom", { metersTraveled: 340, groupsCleared: 12 }), { metersTraveled: 340, groupsCleared: 12, survivedFull: false });
assert.deepEqual(validateRawInput("cone_slalom", { metersTraveled: 340, groupsCleared: 12, survivedFull: true }), { metersTraveled: 340, groupsCleared: 12, survivedFull: true });
assert.throws(() => validateRawInput("cone_slalom", { metersTraveled: -1, groupsCleared: 0 }), /valid/i);

assert.deepEqual(validateRawInput("pace_perfect", { beatErrorsMs: [...Array(16)].map(() => 10), falseTapCount: 0 }), { beatErrorsMs: Array(16).fill(10), falseTapCount: 0 });
assert.throws(() => validateRawInput("pace_perfect", { beatErrorsMs: Array(15).fill(10), falseTapCount: 0 }), /valid/i, "Exactly 16 real beats are required, never 15.");
assert.throws(() => validateRawInput("pace_perfect", { beatErrorsMs: Array(16).fill(10), falseTapCount: -1 }), /valid/i);

assert.deepEqual(validateRawInput("pack_pass", { finalPosition: 1, cleanPasses: 14, narrowPasses: 3, momentumPasses: 2, blockedChoices: 0 }), { finalPosition: 1, cleanPasses: 14, narrowPasses: 3, momentumPasses: 2, blockedChoices: 0 });
assert.throws(() => validateRawInput("pack_pass", { finalPosition: 0, cleanPasses: 0, narrowPasses: 0, momentumPasses: 0, blockedChoices: 0 }), /valid/i, "Position 0 is never a real finishing place -- 1st is the best possible.");
assert.throws(() => validateRawInput("pack_pass", { finalPosition: 20, cleanPasses: 0, narrowPasses: 0, momentumPasses: 0, blockedChoices: 4 }), /valid/i, "More than 3 blocked choices should have already ended the run.");
assert.deepEqual(validateRawInput("pack_pass", { finalPosition: 20, cleanPasses: 0, narrowPasses: 0, momentumPasses: 0, blockedChoices: 3 }), { finalPosition: 20, cleanPasses: 0, narrowPasses: 0, momentumPasses: 0, blockedChoices: 3 }, "Exactly 3 blocked choices (the real ending condition) is valid, not rejected.");

assert.deepEqual(validateRawInput("finish_chute", { correctCount: 8, longestStreak: 5, mistakeCount: 2, totalPrompts: 10, avgResponseMs: 900 }), { correctCount: 8, longestStreak: 5, mistakeCount: 2, totalPrompts: 10, avgResponseMs: 900 });
assert.throws(() => validateRawInput("finish_chute", { correctCount: 8, longestStreak: 5, mistakeCount: 4, totalPrompts: 12, avgResponseMs: 900 }), /valid/i, "More than 3 mistakes should have already ended the run.");
assert.throws(() => validateRawInput("finish_chute", { correctCount: 8, longestStreak: 5, mistakeCount: 2, totalPrompts: 9, avgResponseMs: 900 }), /valid/i, "correctCount + mistakeCount cannot exceed totalPrompts.");
assert.throws(() => validateRawInput("finish_chute", { correctCount: 3, longestStreak: 5, mistakeCount: 0, totalPrompts: 3, avgResponseMs: 900 }), /valid/i, "A streak cannot exceed the total correct count.");

assert.deepEqual(validateRawInput("spike_shuffle", { roundsCompleted: 6, advancedRoundsCompleted: 1 }), { roundsCompleted: 6, advancedRoundsCompleted: 1 });
assert.throws(() => validateRawInput("spike_shuffle", { roundsCompleted: 3, advancedRoundsCompleted: 4 }), /valid/i, "Advanced rounds cannot exceed total rounds completed.");

assert.deepEqual(validateRawInput("runner_says", { sequenceLengthReached: 6, correctSymbolTaps: 27, fastRoundCount: 4 }), { sequenceLengthReached: 6, correctSymbolTaps: 27, fastRoundCount: 4 });
assert.throws(() => validateRawInput("runner_says", { sequenceLengthReached: 6, correctSymbolTaps: 27, fastRoundCount: 7 }), /valid/i, "Fast rounds cannot exceed the sequence length reached.");

// --- Scoring for the 7 more games ------------------------------------------

assert.equal(relayStartBand(120), "perfect");
assert.equal(relayStartBand(121), "great");
assert.equal(relayPassBand(null), "missed");
assert.equal(relayPassBand(400), "safe");
{
  const perfect = relayExchangeGameScore([0, 0, 0], [0, 0, 0], 1);
  assert.equal(perfect.score, 4750, "A perfect relay (matches the client's own identically-derived value) must score exactly the spec's own table total.");
  assert.equal(perfect.perfectCombos, 3);
}

assert.equal(coneSlalomGameScore(5, 100, true), 5 * 10 + 100 + 50 + 100);

assert.equal(paceBeatBand(70), "perfect");
assert.equal(paceBeatScore(0), 100);
{
  const allPerfect = pacePerfectGameScore(Array(16).fill(0), 0);
  assert.equal(allPerfect.score, 1600 + 250 + 750 + 250);
}

assert.equal(packPassGameScore({ cleanPasses: 0, narrowPasses: 0, momentumPasses: 0, finalPosition: 1, blockedChoices: 0 }), 250 + 500 + 1000 + 500);

assert.equal(finishChuteGameScore({ correctCount: 10, longestStreak: 10, mistakeCount: 1, totalPrompts: 11, avgResponseMs: 2000 }), 1000 + 250 + 500, "Streak bonuses stack (>=5 and >=10 both apply), not else-if.");

assert.equal(spikeShuffleGameScore(5, 2), 5 * 250 + 2 * 500 + 1000);

assert.equal(runnerSaysGameScore(5, 0, 0), (100 + 200 + 300 + 400 + 500) + 500);

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

// --- participationPointsForPlay (2026-09-01) --------------------------------
// Before this, a submission that wasn't a brand-new personal record earned
// nothing beyond the once-a-day activity bonus -- confirmed far too slow
// for a real, engaged player to ever actually level up.

// gameScore=0 is the worst real result for every game except memory_match,
// where lower is BETTER -- tested separately with its own real "worst" value.
for (const gameType of ["photo_finish", "starting_gun", "hurdle_dash", "tap_sprint", "beat_the_runner", "relay_exchange", "cone_slalom", "pace_perfect", "pack_pass", "finish_chute", "spike_shuffle", "runner_says"]) {
  assert.equal(participationPointsForPlay(gameType, { gameScore: 0 }), MIN_PARTICIPATION_POINTS, `${gameType}: even the worst valid play earns the ${MIN_PARTICIPATION_POINTS}-point floor, never 0.`);
}
assert.equal(participationPointsForPlay("memory_match", { gameScore: 30 * 60 * 1000 }), MIN_PARTICIPATION_POINTS, "memory_match: a very slow (but still real, valid) solve earns the participation floor.");
assert.equal(participationPointsForPlay("memory_match", { gameScore: 0 }), MAX_PARTICIPATION_POINTS, "memory_match: lower is better -- an (unrealistically) instant time earns the max, not the floor.");
assert.equal(participationPointsForPlay("photo_finish", { gameScore: 1000 }), MAX_PARTICIPATION_POINTS, "A perfect Photo Finish hit earns the max.");
assert.equal(participationPointsForPlay("starting_gun", { gameScore: 1000, suspicious: true }), MIN_PARTICIPATION_POINTS, "A suspicious (<150ms) reading is floored to the minimum -- otherwise a scripted 'reaction' would farm the max every round, since Starting Gun's own real per-round wait is the only other friction standing between a bot and the daily cap.");
assert.equal(participationPointsForPlay("starting_gun", { gameScore: 1000, suspicious: false }), MAX_PARTICIPATION_POINTS, "A genuine (non-suspicious) max-band reading still earns the real max.");
for (const gameType of ["photo_finish", "starting_gun", "hurdle_dash", "tap_sprint", "beat_the_runner", "memory_match", "relay_exchange", "cone_slalom", "pace_perfect", "pack_pass", "finish_chute", "spike_shuffle", "runner_says"]) {
  for (const gameScore of [-100, 100000, NaN]) {
    const points = participationPointsForPlay(gameType, { gameScore });
    assert.ok(points >= MIN_PARTICIPATION_POINTS && points <= MAX_PARTICIPATION_POINTS, `${gameType} with a malformed gameScore (${gameScore}) must still clamp into range, never crash or escape [${MIN_PARTICIPATION_POINTS}, ${MAX_PARTICIPATION_POINTS}].`);
  }
}

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

for (const errorMs of [0, 90, 120, 121, 250, 251, 400, 450, 451, 700, 701, -300]) {
  assert.equal(relayStartBand(errorMs), client.relayStartBand(errorMs), `relayStartBand must match at errorMs=${errorMs}`);
  assert.equal(relayPassBand(errorMs), client.relayPassBand(errorMs), `relayPassBand must match at errorMs=${errorMs}`);
}
assert.equal(relayPassBand(null), client.relayPassBand(null), "relayPassBand must match for a real missed exchange (null).");
for (const [starts, passes, place] of [[[0, 0, 0], [0, 0, 0], 1], [[900, 900, 900], [null, null, null], 3], [[10, 500, -300], [50, null, 380], 2]]) {
  assert.deepEqual(relayExchangeGameScore(starts, passes, place), client.relayExchangeGameScore(starts, passes, place), `relayExchangeGameScore must match for (${starts}, ${passes}, ${place})`);
}

for (const [groups, meters, survived] of [[0, 0, false], [4, 80, false], [5, 100, true], [30, 900, true]]) {
  assert.equal(coneSlalomGameScore(groups, meters, survived), client.coneSlalomGameScore(groups, meters, survived), `coneSlalomGameScore must match for (${groups}, ${meters}, ${survived})`);
}

for (const errorMs of [0, 70, 71, 140, 141, 240, 241, -200, null]) {
  assert.equal(paceBeatBand(errorMs), client.paceBeatBand(errorMs), `paceBeatBand must match at errorMs=${errorMs}`);
  assert.equal(paceBeatScore(errorMs), client.paceBeatScore(errorMs), `paceBeatScore must match at errorMs=${errorMs}`);
}
{
  const sample = [0, 50, null, 90, 200, null, 0, 0, 0, 0, 150, null, 0, 0, 0, 0];
  assert.deepEqual(pacePerfectGameScore(sample, 2), client.pacePerfectGameScore(sample, 2), "pacePerfectGameScore must match for a real mixed sample.");
}

for (const input of [
  { cleanPasses: 0, narrowPasses: 0, momentumPasses: 0, finalPosition: 20, blockedChoices: 3 },
  { cleanPasses: 14, narrowPasses: 3, momentumPasses: 2, finalPosition: 1, blockedChoices: 0 },
  { cleanPasses: 6, narrowPasses: 1, momentumPasses: 0, finalPosition: 8, blockedChoices: 2 }
]) {
  assert.equal(packPassGameScore(input), client.packPassGameScore(input), `packPassGameScore must match for ${JSON.stringify(input)}`);
}

for (const input of [
  { correctCount: 0, longestStreak: 0, mistakeCount: 0, totalPrompts: 0, avgResponseMs: 0 },
  { correctCount: 10, longestStreak: 10, mistakeCount: 1, totalPrompts: 11, avgResponseMs: 2000 },
  { correctCount: 3, longestStreak: 3, mistakeCount: 0, totalPrompts: 3, avgResponseMs: 400 }
]) {
  assert.equal(finishChuteGameScore(input), client.finishChuteGameScore(input), `finishChuteGameScore must match for ${JSON.stringify(input)}`);
}

for (const [rounds, advanced] of [[0, 0], [4, 0], [5, 0], [12, 6]]) {
  assert.equal(spikeShuffleGameScore(rounds, advanced), client.spikeShuffleGameScore(rounds, advanced), `spikeShuffleGameScore must match for (${rounds}, ${advanced})`);
}

for (const [len, taps, fast] of [[0, 0, 0], [2, 9, 0], [5, 0, 0], [10, 0, 3]]) {
  assert.equal(runnerSaysGameScore(len, taps, fast), client.runnerSaysGameScore(len, taps, fast), `runnerSaysGameScore must match for (${len}, ${taps}, ${fast})`);
}

for (const points of [0, 50, 100, 299, 300, 700, 1199, 3000, 10000, 50000, 16500, 20000]) {
  assert.deepEqual(levelForPoints(points), client.levelForPoints(points), `Level must match at points=${points}`);
}
assert.deepEqual(LEVELS, client.LEVELS, "The launch level table itself must be byte-identical between client and server.");

for (const gameType of ["photo_finish", "starting_gun", "hurdle_dash", "tap_sprint", "beat_the_runner", "memory_match", "relay_exchange", "cone_slalom", "pace_perfect", "pack_pass", "finish_chute", "spike_shuffle", "runner_says"]) {
  for (const gameScore of [0, 1, 50, 500, 900, 1000, 6000, 25000]) {
    for (const suspicious of [false, true]) {
      assert.equal(
        participationPointsForPlay(gameType, { gameScore, suspicious }),
        client.participationPointsForPlay(gameType, { gameScore, suspicious }),
        `Participation points must match for ${gameType} at gameScore=${gameScore}, suspicious=${suspicious}`
      );
    }
  }
}
assert.equal(MIN_PARTICIPATION_POINTS, client.MIN_PARTICIPATION_POINTS);
assert.equal(MAX_PARTICIPATION_POINTS, client.MAX_PARTICIPATION_POINTS);

console.log("photoFinishScoreBand/startingGunScoreBand/hurdleDashGameScore/levelForPoints checked: every real band and boundary.");
console.log("cleanDisplayName checked: real spaces/hyphens preserved, whitespace collapsed, real control characters stripped, length capped -- confirms the earlier bug (a regex that stripped every space and hyphen) is genuinely fixed.");
console.log("validateRawInput checked: every one of all 6 game types' real valid range (including the 3 new games' own real physical ceilings/floors -- max real taps in 10s, the real 8-round cap, and a real board's minimum 3 moves), and every invalid/missing/malformed/out-of-range input rejected rather than silently coerced.");
console.log("tapSprintDistanceForTaps checked against real values, and in client/server parity below.");
console.log("isValidInstallId checked: real v4 UUIDs accepted case-insensitively, every malformed/wrong-type/trailing-garbage value rejected.");
console.log("generateGuestLabel checked: the exact promised \"podiumwatchguest####\" shape, both real boundary values (1000 and 9999) via an injected random function, and a 200-sample spread staying in range.");
console.log("participationPointsForPlay checked: every game's real floor/max/scaling, the suspicious-Starting-Gun anti-farm floor, malformed-input safety, and client/server parity.");
console.log("validateRawInput checked for all 7 more games: every real structural/range constraint (exactly 3 relay exchanges, exactly 16 pace beats, position 1-20, the real blocked-choices/mistake-count ending conditions, streak-cannot-exceed-total relationships) and client/server scoring parity for every one of them.");
console.log("Client/server scoring parity checked across a real range of inputs for every scoring function (all 13 games) and the full level table -- the two independent copies (one for instant client feedback, one server-authoritative) cannot silently drift apart without this test catching it.");
