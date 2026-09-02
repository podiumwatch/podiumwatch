// Podium Play -- a small arcade on the Athlete/Team of the Week pages.
// Thirteen games as of 2026-09-02: Photo Finish, Starting Gun, Hurdle
// Dash, Tap Sprint, Beat the Runner, Memory Match, Relay Exchange, Cone
// Slalom, Pace Perfect, Pack Pass, Finish Chute, Spike Shuffle, and
// Runner Says. Every game shares the same currentAttempt cleanup
// contract, the same points/records/level system, and the same
// server-authoritative submission path (lib/podium_play_service.mjs) --
// see that file's own header for why a raw measurement is submitted,
// never a client-computed score. A My Podium account bridge and a public
// leaderboard/world-records panel exist too (see loadAccount/
// loadLeaderboard/loadWorldRecords below); daily challenges and badges
// remain deliberately deferred rather than shipped as placeholders --
// there is no existing daily-challenge system in this codebase to extend,
// and building one from scratch was out of scope for adding these games.
//
// The games are available for the whole page visit -- a visitor does not
// have to vote first (explicit direction, 2026-09-01: "I want the games
// to pull up immediately even before someone votes"). A confirmed vote
// only ever ADDS a cooldown-status readout (confirmation message, live
// countdown, Vote Again) on top of the same already-visible panel; it
// never gates the games and never interrupts one already in progress
// (see showVoteConfirmation()'s own comment for why it deliberately does
// not call cancelCurrentAttempt()).
//
// This file NEVER touches vote counting, candidate totals, or the
// cooldown duration -- it only ever READS the real retry_after_seconds
// that public/scripts/weekly-awards.js already received from the server,
// via one small custom event that script dispatches on a confirmed
// success (see its own comment at the dispatch site). If this file fails
// to load, throws, or is blocked entirely, voting itself is completely
// unaffected -- it is a strictly additive panel, never a replacement for
// any existing vote-flow markup or logic.
//
// Plain classic script (not a module), matching every other file in this
// directory -- pure/testable pieces attach to window.PodiumPlay so
// scripts/test-podium-play.mjs can load this file directly in Node with a
// minimal window/localStorage/document stub, the same pattern already
// used for public/scripts/pace-splits.js.
(() => {
  "use strict";

  // ---------------------------------------------------------------------
  // Config: points, levels, Photo Finish scoring -- plain data, no logic
  // scattered as unexplained numbers elsewhere in this file.
  // ---------------------------------------------------------------------

  const PROFILE_STORAGE_KEY = "podiumWatch.podiumPlay.profile.v1";
  const PROFILE_VERSION = 1;

  // Personal progression only, never vote spamming -- see awardPoints()
  // below, which is what actually enforces this.
  const DAILY_POINT_CAP = 300;
  const FIRST_GAME_IN_COOLDOWN_POINTS = 5;
  const PERSONAL_RECORD_POINTS = 10;

  // The one place this client defines level names/thresholds -- every
  // other place a level shows up (the progress row, game result screens,
  // the account status line) reads through levelForPoints() below, never
  // repeats a name or number of its own. The exact 15 names and their
  // order are a fixed product requirement (2026-09-01) -- never renamed,
  // removed, combined, or reordered. lib/podium_play_service.mjs keeps
  // its own copy (a browser script and a Node module can't literally
  // share one file without a bundler this project doesn't have) --
  // tests/podium-play-service.test.mjs's parity check is what keeps the
  // two from silently drifting apart, the same discipline already
  // established for the scoring functions.
  //
  // Level is never stored anywhere -- always computed fresh from points
  // (client-side from the local guest profile, server-side from the real
  // account row) -- so widening these thresholds automatically re-derives
  // the correct level for every existing player's already-earned points
  // the next time it's displayed. No migration, no reset, nothing to
  // preserve here beyond leaving the real points column alone, which
  // this change never touches.
  const LEVELS = [
    { name: "Rookie Runner", threshold: 0 },
    { name: "Junior Varsity", threshold: 100 },
    { name: "Varsity", threshold: 300 },
    { name: "Conference Champion", threshold: 650 },
    { name: "District Runner Up", threshold: 1100 },
    { name: "District Champion", threshold: 1700 },
    { name: "Regional Runner Up", threshold: 2450 },
    { name: "Regional Champion", threshold: 3350 },
    { name: "State Qualifier", threshold: 4400 },
    { name: "All Ohio", threshold: 5600 },
    { name: "State Runner Up", threshold: 7000 },
    { name: "State Champion", threshold: 8600 },
    { name: "Nationals Bound", threshold: 10500 },
    { name: "National Champion", threshold: 13000 },
    { name: "Podium Legend", threshold: 16500 }
  ];

  const PHOTO_FINISH_TARGET_SECONDS = 15;
  const PHOTO_FINISH_HIDE_AT_SECONDS = 12;
  const PHOTO_FINISH_MIN_VALID_SECONDS = 1;

  // Bands keyed off hundredths-of-a-second as integers, not raw floats --
  // avoids real floating-point boundary bugs (0.01 doesn't store exactly
  // in binary) landing an attempt in the wrong band right at an edge.
  function photoFinishScoreBand(diffSeconds) {
    const diffHundredths = Math.round(Math.abs(diffSeconds) * 100);
    if (diffHundredths === 0) return 1000;
    if (diffHundredths <= 1) return 750;
    if (diffHundredths <= 5) return 500;
    if (diffHundredths <= 10) return 300;
    if (diffHundredths <= 25) return 150;
    if (diffHundredths <= 50) return 75;
    return 20;
  }

  const STARTING_GUN_MIN_DELAY_MS = 1500;
  const STARTING_GUN_MAX_DELAY_MS = 4000;
  const STARTING_GUN_ON_YOUR_MARKS_MS = 600;
  const STARTING_GUN_SET_MS = 600;

  function randomStartingGunDelayMs(randomFn = Math.random) {
    return STARTING_GUN_MIN_DELAY_MS + randomFn() * (STARTING_GUN_MAX_DELAY_MS - STARTING_GUN_MIN_DELAY_MS);
  }

  // Bands from the spec, in whole milliseconds. Under 150ms is real and
  // scoreable locally, but flagged `suspicious` -- there is no server
  // leaderboard in this phase, so nothing reads that flag yet, but the
  // data is captured now rather than needing a later migration of stored
  // records to add it retroactively.
  function startingGunScoreBand(reactionMs) {
    const ms = Math.round(reactionMs);
    if (ms < 150) return { score: 1000, suspicious: true };
    if (ms <= 199) return { score: 750, suspicious: false };
    if (ms <= 249) return { score: 500, suspicious: false };
    if (ms <= 299) return { score: 300, suspicious: false };
    if (ms <= 399) return { score: 150, suspicious: false };
    if (ms <= 599) return { score: 75, suspicious: false };
    return { score: 20, suspicious: false };
  }

  // --- Hurdle Dash: a fixed internal coordinate system (game units),
  // independent of the canvas element's actual on-screen pixel size. The
  // canvas is scaled to fit its container purely via CSS (see .pp-hurdle-
  // canvas), so every physics calculation below always happens in these
  // same fixed units regardless of screen size -- an orientation change
  // or window resize never has to touch game state at all, satisfying
  // the spec's "resize safely... do not reset an active run" requirement
  // by construction rather than by handling a resize event.
  const HURDLE_DASH_WIDTH = 800;
  const HURDLE_DASH_HEIGHT = 220;
  const HURDLE_DASH_GROUND_Y = 190;
  const HURDLE_DASH_RUNNER_X = 90;
  const HURDLE_DASH_RUNNER_WIDTH = 34;
  const HURDLE_DASH_RUNNER_HEIGHT = 52;
  const HURDLE_DASH_HURDLE_WIDTH = 22;
  const HURDLE_DASH_HURDLE_HEIGHT = 42;
  const HURDLE_DASH_TROPHY_SIZE = 26;
  const HURDLE_DASH_GRAVITY = 2600; // game units / s^2
  const HURDLE_DASH_JUMP_VELOCITY = 820; // game units / s, upward
  const HURDLE_DASH_JUMP_DURATION_SECONDS = (2 * HURDLE_DASH_JUMP_VELOCITY) / HURDLE_DASH_GRAVITY;
  const HURDLE_DASH_INITIAL_SPEED = 300; // game units / s
  // Dialed up moderately (2026-09-01, "I want the game to be a little
  // more difficult") from the earlier playtesting-tuned values -- the
  // ramp climbs faster and reaches a higher ceiling, and the head start
  // and hurdle spacing are both trimmed, while staying well above the
  // real "never physically impossible" floor (see hurdleDashNextGap's
  // own comment) -- a real, not just theoretical, jump-and-land cycle
  // still always fits before the next hurdle arrives.
  const HURDLE_DASH_MAX_SPEED = 760;
  const HURDLE_DASH_SPEED_RAMP_PER_SECOND = 8;
  const HURDLE_DASH_FIRST_HURDLE_DELAY_SECONDS = 2.8;
  const HURDLE_DASH_DISTANCE_PER_SCORE_UNIT = 10;
  const HURDLE_DASH_HURDLE_CLEAR_POINTS = 25;
  const HURDLE_DASH_TROPHY_POINTS = 40;
  const HURDLE_DASH_RESUME_COUNTDOWN_SECONDS = 3;

  function hurdleDashSpeedAtElapsed(elapsedSeconds) {
    const safeElapsed = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0;
    return Math.min(HURDLE_DASH_MAX_SPEED, HURDLE_DASH_INITIAL_SPEED + safeElapsed * HURDLE_DASH_SPEED_RAMP_PER_SECOND);
  }

  // The runner's height above the ground (0 = grounded) at a given point
  // into a jump. Simple projectile motion -- gravity is constant, so this
  // is a closed-form parabola, not a per-frame numeric integration, which
  // means it produces the exact same arc regardless of frame rate.
  function hurdleDashJumpOffset(jumpElapsedSeconds) {
    if (!Number.isFinite(jumpElapsedSeconds) || jumpElapsedSeconds < 0 || jumpElapsedSeconds > HURDLE_DASH_JUMP_DURATION_SECONDS) {
      return 0;
    }
    const height = HURDLE_DASH_JUMP_VELOCITY * jumpElapsedSeconds - 0.5 * HURDLE_DASH_GRAVITY * jumpElapsedSeconds * jumpElapsedSeconds;
    return Math.max(0, height);
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  // Trimmed alongside HURDLE_DASH_FIRST_HURDLE_DELAY_SECONDS above for a
  // real difficulty increase, but never below 1.0 -- that's the actual
  // hard floor for "one full jump-and-land cycle still always fits";
  // 1.25 keeps a genuine, if tighter, human-reaction buffer on top of it.
  const HURDLE_DASH_SAFE_GAP_MIN_MULTIPLIER = 1.25;
  const HURDLE_DASH_SAFE_GAP_MAX_MULTIPLIER = 1.9;

  // A safe, never-impossible gap (in game units, i.e. distance the world
  // must scroll) before the next hurdle, given the CURRENT speed --
  // always leaves enough real time for one full jump-and-land cycle plus
  // a buffer, so a correctly-timed tap can always clear it. Randomized
  // within that safe range for real variety, never below it -- the test
  // suite asserts this gap converted back to time (gap / speed) is always
  // >= the real jump duration, at both minimum and maximum speed.
  function hurdleDashNextGap(currentSpeed, randomFn = Math.random) {
    const minSeconds = HURDLE_DASH_JUMP_DURATION_SECONDS * HURDLE_DASH_SAFE_GAP_MIN_MULTIPLIER;
    const maxSeconds = HURDLE_DASH_JUMP_DURATION_SECONDS * HURDLE_DASH_SAFE_GAP_MAX_MULTIPLIER;
    const seconds = minSeconds + randomFn() * (maxSeconds - minSeconds);
    return seconds * currentSpeed;
  }

  // Raw game score for one run -- distance converted to points, plus
  // fixed per-hurdle and per-trophy bonuses. Kept deliberately separate
  // from Podium Points (see awardPoints()), same as the other two games.
  function hurdleDashGameScore(distance, hurdlesCleared, trophiesCollected) {
    const distancePoints = Math.floor(Math.max(0, Number(distance) || 0) / HURDLE_DASH_DISTANCE_PER_SCORE_UNIT);
    const hurdlePoints = Math.max(0, Number(hurdlesCleared) || 0) * HURDLE_DASH_HURDLE_CLEAR_POINTS;
    const trophyPoints = Math.max(0, Number(trophiesCollected) || 0) * HURDLE_DASH_TROPHY_POINTS;
    return distancePoints + hurdlePoints + trophyPoints;
  }

  function levelForPoints(points) {
    const safePoints = Number.isFinite(points) ? Math.max(0, points) : 0;
    let current = LEVELS[0];
    for (const level of LEVELS) {
      if (safePoints >= level.threshold) current = level;
    }
    const index = LEVELS.indexOf(current);
    const next = LEVELS[index + 1] || null;
    return {
      name: current.name,
      threshold: current.threshold,
      next: next ? { name: next.name, threshold: next.threshold } : null,
      // 1 (full) once the visitor is at the top level -- there is no next
      // threshold to divide by.
      progress: next ? Math.min(1, Math.max(0, (safePoints - current.threshold) / (next.threshold - current.threshold))) : 1
    };
  }

  // --- Tap Sprint (2026-09-01) -------------------------------------------
  const TAP_SPRINT_DURATION_SECONDS = 10;
  const TAP_SPRINT_DISTANCE_PER_TAP = 12;
  // A real, generous floor -- faster than this is not realistic sustained
  // human alternating tapping, but comfortably above what a fast real
  // player can do. Bounds the max possible tap rate rather than trying to
  // detect "is this really a human," the same proportionate approach the
  // other games already use for their own raw-input validation.
  const TAP_SPRINT_MIN_TAP_INTERVAL_MS = 65;
  const TAP_SPRINT_TRACK_DISTANCE = 1100; // the visual "full track" length for the runner animation

  function tapSprintDistanceForTaps(taps) {
    return Math.max(0, Number(taps) || 0) * TAP_SPRINT_DISTANCE_PER_TAP;
  }

  // Pure state transition: only an alternating tap (different button from
  // the last one that counted) is valid. Returns whether THIS tap counts,
  // and the new "last button" state to remember for the next one.
  function tapSprintRegisterTap(lastButton, button) {
    const counts = lastButton !== button;
    return { counts, lastButton: button };
  }

  function tapSprintTapIsRateLimited(msSinceLastTap) {
    return Number.isFinite(msSinceLastTap) && msSinceLastTap < TAP_SPRINT_MIN_TAP_INTERVAL_MS;
  }

  // --- Beat the Runner (2026-09-01) ---------------------------------------
  // Named rounds are a fixed product requirement -- exact names, exact
  // order, never renamed or reordered (same discipline as LEVELS above).
  const BEAT_THE_RUNNER_ROUNDS = [
    { name: "Junior Varsity Runner" },
    { name: "Varsity Runner" },
    { name: "Conference Champion" },
    { name: "District Champion" },
    { name: "Regional Champion" },
    { name: "State Qualifier" },
    { name: "State Champion" },
    { name: "National Champion" }
  ];
  const BEAT_THE_RUNNER_BASE_TAPS_NEEDED = 12; // round 1's real, easy-for-new-players target
  const BEAT_THE_RUNNER_TAPS_INCREMENT = 3; // each later round needs a few more real taps
  const BEAT_THE_RUNNER_BASE_TIME_MS = 6000; // round 1's real, generous window
  const BEAT_THE_RUNNER_TIME_DECREMENT_MS = 350; // each later round gives a little less time
  const BEAT_THE_RUNNER_MIN_TIME_MS = 2200; // never below a real, still-fair floor, however far a player gets

  // 0-indexed roundIndex in, matching BEAT_THE_RUNNER_ROUNDS -- returns
  // the real taps needed and time allowed for that round. Both increase
  // with round index (harder), time floors out rather than going to 0.
  function beatTheRunnerRoundTarget(roundIndex) {
    const safeIndex = Number.isFinite(roundIndex) && roundIndex >= 0 ? Math.floor(roundIndex) : 0;
    return {
      tapsNeeded: BEAT_THE_RUNNER_BASE_TAPS_NEEDED + safeIndex * BEAT_THE_RUNNER_TAPS_INCREMENT,
      timeMs: Math.max(BEAT_THE_RUNNER_MIN_TIME_MS, BEAT_THE_RUNNER_BASE_TIME_MS - safeIndex * BEAT_THE_RUNNER_TIME_DECREMENT_MS)
    };
  }

  // --- Memory Match (2026-09-01) -------------------------------------------
  const MEMORY_MATCH_SYMBOLS = ["👟", "🏆", "⏱️", "🥇", "🏁", "PW"]; // running shoes, trophy, stopwatch, medal, track/checkered flag, Podium Watch mark
  const MEMORY_MATCH_PAIR_COUNT = 3; // three matching pairs -- a real six-card board
  const MEMORY_MATCH_MISMATCH_DELAY_MS = 800;

  // A real Fisher-Yates shuffle of the 6-card board (3 symbols x 2 each) --
  // injectable randomFn so this is genuinely testable, not "trust me it's
  // random." Returns an array of { symbol, matched } in shuffled order.
  function memoryMatchNewBoard(randomFn = Math.random) {
    // Real variety across rounds -- which 3 symbols appear is itself
    // shuffled from the full themed pool (Fisher-Yates on the pool, not
    // always the same fixed first 3), before the 6 resulting cards are
    // separately shuffled into board positions.
    const pool = MEMORY_MATCH_SYMBOLS.slice();
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(randomFn() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const symbols = pool.slice(0, MEMORY_MATCH_PAIR_COUNT);
    const cards = symbols.flatMap((symbol) => [{ symbol, matched: false }, { symbol, matched: false }]);
    for (let i = cards.length - 1; i > 0; i -= 1) {
      const j = Math.floor(randomFn() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }

  // --- Real per-play points (2026-09-01) ----------------------------------
  // Before this, a submission that wasn't a brand-new personal record
  // earned nothing beyond the once-a-day activity bonus -- far too slow
  // for any real, engaged player to actually level up. This awards every
  // valid play a real amount scaled to how well it was played, kept in
  // exact parity with lib/podium_play_service.mjs's own copy (the server
  // copy is authoritative; this one is only for the instant on-screen
  // preview before a submission round-trips). See that file's own comment
  // for why each STRONG_* reference was chosen.
  const MIN_PARTICIPATION_POINTS = 1;
  const MAX_PARTICIPATION_POINTS = 25;
  const PHOTO_FINISH_SCORE_MAX = 1000;
  const STARTING_GUN_SCORE_MAX = 1000;
  const HURDLE_DASH_STRONG_SCORE = 500;
  const TAP_SPRINT_STRONG_DISTANCE = 900;
  const MEMORY_MATCH_STRONG_TIME_MS = 6000;
  const MEMORY_MATCH_SLOW_VALID_TIME_MS = 25000;

  function participationScale(ratio) {
    const safeRatio = Number.isFinite(ratio) ? ratio : 0; // NaN/Infinity never crashes or breaks the clamp -- worst case, the participation floor
    const clamped = Math.min(1, Math.max(0, safeRatio));
    return Math.min(MAX_PARTICIPATION_POINTS, Math.max(MIN_PARTICIPATION_POINTS, Math.round(1 + clamped * (MAX_PARTICIPATION_POINTS - 1))));
  }

  function participationPointsForPlay(gameType, { gameScore = 0, suspicious = false } = {}) {
    if (gameType === "photo_finish") return participationScale(gameScore / PHOTO_FINISH_SCORE_MAX);
    if (gameType === "starting_gun") return suspicious ? MIN_PARTICIPATION_POINTS : participationScale(gameScore / STARTING_GUN_SCORE_MAX);
    if (gameType === "hurdle_dash") return participationScale(gameScore / HURDLE_DASH_STRONG_SCORE);
    if (gameType === "tap_sprint") return participationScale(gameScore / TAP_SPRINT_STRONG_DISTANCE);
    if (gameType === "beat_the_runner") return participationScale(gameScore / BEAT_THE_RUNNER_ROUNDS.length);
    if (gameType === "memory_match") {
      const span = MEMORY_MATCH_SLOW_VALID_TIME_MS - MEMORY_MATCH_STRONG_TIME_MS;
      const ratio = (MEMORY_MATCH_SLOW_VALID_TIME_MS - gameScore) / span;
      return participationScale(ratio);
    }
    if (gameType === "relay_exchange") return participationScale(gameScore / RELAY_EXCHANGE_STRONG_SCORE);
    if (gameType === "cone_slalom") return participationScale(gameScore / CONE_SLALOM_STRONG_SCORE);
    if (gameType === "pace_perfect") return participationScale(gameScore / PACE_PERFECT_STRONG_SCORE);
    if (gameType === "pack_pass") return participationScale(gameScore / PACK_PASS_STRONG_SCORE);
    if (gameType === "finish_chute") return participationScale(gameScore / FINISH_CHUTE_STRONG_SCORE);
    if (gameType === "spike_shuffle") return participationScale(gameScore / SPIKE_SHUFFLE_STRONG_SCORE);
    if (gameType === "runner_says") return participationScale(gameScore / RUNNER_SAYS_STRONG_SCORE);
    return MIN_PARTICIPATION_POINTS;
  }

  // --- Relay Exchange (2026-09-02) ----------------------------------------
  const RELAY_EXCHANGE_LANE_COUNT = 3; // player + 2 seeded CPU opponents
  const RELAY_EXCHANGE_LEG_DURATION_MS = 2600; // one full, uninterrupted lap at "good" pace
  const RELAY_EXCHANGE_START_WINDOW_MS = 900; // Start Runner becomes available this long before the ideal moment
  const RELAY_EXCHANGE_PASS_WINDOW_MS = 900; // valid Pass Baton window around the ideal moment
  const RELAY_EXCHANGE_STRONG_SCORE = 2500;

  function relayStartBand(errorMs) {
    const abs = Math.abs(errorMs);
    if (abs <= 120) return "perfect";
    if (abs <= 250) return "great";
    if (abs <= 450) return "good";
    if (abs <= 700) return "early_late";
    return "very_off";
  }
  const RELAY_START_POINTS = { perfect: 250, great: 150, good: 75, early_late: 0, very_off: 0 };

  // null means a missed/never-attempted pass -- always a real, counted
  // outcome, never an absent one.
  function relayPassBand(errorMs) {
    if (errorMs === null || errorMs === undefined) return "missed";
    const abs = Math.abs(errorMs);
    if (abs <= 90) return "perfect";
    if (abs <= 200) return "great";
    if (abs <= 400) return "safe";
    return "late";
  }
  const RELAY_PASS_POINTS = { perfect: 500, great: 300, safe: 150, late: 0, missed: 0 };

  function relayExchangeGameScore(startErrorsMs, passErrorsMs, place) {
    let score = 0;
    let perfectCombos = 0;
    for (let i = 0; i < startErrorsMs.length; i += 1) {
      const startBand = relayStartBand(startErrorsMs[i]);
      const passBand = relayPassBand(passErrorsMs[i]);
      score += (RELAY_START_POINTS[startBand] || 0) + (RELAY_PASS_POINTS[passBand] || 0);
      if (startBand === "perfect" && passBand === "perfect") { score += 250; perfectCombos += 1; }
    }
    if (perfectCombos >= 3) score += 1000;
    if (place === 1) score += 750;
    else if (place === 2) score += 350;
    return { score, perfectCombos };
  }

  // A CPU opponent's own lap time for one leg -- a small seeded variation
  // around the base duration so opponents feel alive without ever
  // teleporting or changing a result after the fact.
  function relayCpuLegDurationMs(randomFn = Math.random) {
    return RELAY_EXCHANGE_LEG_DURATION_MS * (0.94 + randomFn() * 0.12);
  }

  // --- Cone Slalom (2026-09-02) --------------------------------------------
  const CONE_SLALOM_LANE_COUNT = 3;
  const CONE_SLALOM_LANE_TRANSITION_MS = 180;
  const CONE_SLALOM_DURATION_SECONDS = 30;
  const CONE_SLALOM_OBSTACLES = [
    { id: "cone", label: "cone", symbol: "🚧" },
    { id: "puddle", label: "mud puddle", symbol: "💧" },
    { id: "branch", label: "fallen branch", symbol: "🌿" },
    { id: "flags", label: "course flags", symbol: "🚩" },
    { id: "hay", label: "hay bale", symbol: "🟫" }
  ];
  const CONE_SLALOM_INITIAL_SPEED = 130;
  const CONE_SLALOM_MAX_SPEED = 340;
  const CONE_SLALOM_SPEED_RAMP_PER_SECOND = 9;
  const CONE_SLALOM_MAX_LANE_SHIFT = CONE_SLALOM_LANE_COUNT - 1; // worst case: edge lane to edge lane
  const CONE_SLALOM_SAFE_GAP_MIN_MULTIPLIER = 1.4;
  const CONE_SLALOM_SAFE_GAP_MAX_MULTIPLIER = 2.1;
  const CONE_SLALOM_STRONG_SCORE = 400;

  function coneSlalomSpeedAtElapsed(elapsedSeconds) {
    const safeElapsed = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0;
    return Math.min(CONE_SLALOM_MAX_SPEED, CONE_SLALOM_INITIAL_SPEED + safeElapsed * CONE_SLALOM_SPEED_RAMP_PER_SECOND);
  }

  // A safe, never-impossible gap (game units) before the next obstacle
  // group, given the CURRENT speed -- always leaves enough real time for
  // the worst-case lane change (edge-to-edge, 2 transitions) plus a
  // buffer. Same "safe gap" technique Hurdle Dash's hurdleDashNextGap
  // already uses.
  function coneSlalomNextGap(currentSpeed, randomFn = Math.random) {
    const worstCaseMs = CONE_SLALOM_MAX_LANE_SHIFT * CONE_SLALOM_LANE_TRANSITION_MS;
    const minSeconds = (worstCaseMs / 1000) * CONE_SLALOM_SAFE_GAP_MIN_MULTIPLIER;
    const maxSeconds = (worstCaseMs / 1000) * CONE_SLALOM_SAFE_GAP_MAX_MULTIPLIER;
    const seconds = minSeconds + randomFn() * (maxSeconds - minSeconds);
    return seconds * currentSpeed;
  }

  // Which lane(s) a new obstacle group blocks -- never all three, so
  // coneSlalomNextGap's safe-gap guarantee always has a real open lane to
  // guarantee reachability for.
  function coneSlalomNextGroup(randomFn = Math.random) {
    const blockCount = randomFn() < 0.55 ? 1 : 2;
    const lanes = [0, 1, 2];
    const blocked = [];
    for (let i = 0; i < blockCount; i += 1) {
      const pick = Math.floor(randomFn() * lanes.length);
      blocked.push(lanes.splice(pick, 1)[0]);
    }
    const obstacle = CONE_SLALOM_OBSTACLES[Math.floor(randomFn() * CONE_SLALOM_OBSTACLES.length)];
    return { blockedLanes: blocked.sort((a, b) => a - b), obstacle };
  }

  function coneSlalomGameScore(groupsCleared, metersTraveled, survivedFull) {
    const safeGroups = Math.max(0, Math.floor(Number(groupsCleared) || 0));
    const safeMeters = Math.max(0, Number(metersTraveled) || 0);
    let score = safeGroups * 10 + Math.floor(safeMeters);
    if (safeGroups >= 5) score += 50;
    if (survivedFull) score += 100;
    return score;
  }

  // --- Pace Perfect (2026-09-02) -------------------------------------------
  const PACE_PERFECT_BEAT_COUNT = 16;
  const PACE_PERFECT_BEAT_INTERVAL_MS = 1450;
  const PACE_PERFECT_MISS_TOLERANCE_MS = 240;
  const PACE_PERFECT_STRONG_SCORE = 1600;

  function paceBeatSchedule(beatCount = PACE_PERFECT_BEAT_COUNT, intervalMs = PACE_PERFECT_BEAT_INTERVAL_MS) {
    const beats = [];
    for (let i = 0; i < beatCount; i += 1) beats.push((i + 1) * intervalMs);
    return beats;
  }

  function paceBeatBand(errorMs) {
    if (errorMs === null || errorMs === undefined) return "miss";
    const abs = Math.abs(errorMs);
    if (abs <= 70) return "perfect";
    if (abs <= 140) return "great";
    if (abs <= 240) return "good";
    return "miss";
  }

  function paceBeatScore(errorMs) {
    if (errorMs === null || errorMs === undefined) return 0;
    const accuracy = Math.max(0, 1 - Math.abs(errorMs) / PACE_PERFECT_MISS_TOLERANCE_MS);
    return Math.round(accuracy * 100);
  }

  // Matches a real tap timestamp to the nearest STILL-UNMATCHED beat
  // within tolerance -- returns that beat's index, or -1 for a false tap
  // (nothing left to match). Pure: takes the current matched-state array,
  // never mutates it.
  function paceMatchTapToBeat(tapTimeMs, beatTimesMs, matchedFlags) {
    let bestIndex = -1;
    let bestDistance = Infinity;
    for (let i = 0; i < beatTimesMs.length; i += 1) {
      if (matchedFlags[i]) continue;
      const distance = Math.abs(tapTimeMs - beatTimesMs[i]);
      if (distance <= PACE_PERFECT_MISS_TOLERANCE_MS && distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }
    return bestIndex;
  }

  function pacePerfectGameScore(beatErrorsMs, falseTapCount) {
    let total = 0;
    let longestStreak = 0;
    let currentStreak = 0;
    let accuracySum = 0;
    for (const err of beatErrorsMs) {
      total += paceBeatScore(err);
      accuracySum += err === null || err === undefined ? 0 : Math.max(0, 1 - Math.abs(err) / PACE_PERFECT_MISS_TOLERANCE_MS);
      if (paceBeatBand(err) === "perfect") { currentStreak += 1; longestStreak = Math.max(longestStreak, currentStreak); }
      else currentStreak = 0;
    }
    if (longestStreak >= 5) total += 250;
    if (longestStreak >= 10) total += 750;
    if (falseTapCount === 0) total += 250;
    const accuracyPct = beatErrorsMs.length ? Math.round((accuracySum / beatErrorsMs.length) * 100) : 0;
    return { score: total, longestStreak, accuracyPct };
  }

  // --- Pack Pass (2026-09-02) ----------------------------------------------
  const PACK_PASS_START_POSITION = 20;
  const PACK_PASS_DECISION_COUNT = 14;
  const PACK_PASS_LANE_COUNT = 3;
  const PACK_PASS_DECISION_WINDOW_MS = 1700;
  const PACK_PASS_STRONG_SCORE = 1200;

  // Which lane(s) are open for one pass decision -- always at least one
  // open lane, per spec. 0, 1, or 2 lanes blocked (never all 3).
  function packPassNextDecision(randomFn = Math.random) {
    const blockCount = Math.floor(randomFn() * 3);
    const lanes = [0, 1, 2];
    const blocked = [];
    for (let i = 0; i < blockCount; i += 1) {
      const pick = Math.floor(randomFn() * lanes.length);
      blocked.push(lanes.splice(pick, 1)[0]);
    }
    return { blockedLanes: blocked.sort((a, b) => a - b), openLanes: lanes.slice().sort((a, b) => a - b) };
  }

  function packPassResolveChoice(chosenLane, openLanes) {
    const clean = openLanes.includes(chosenLane);
    const narrow = clean && openLanes.length === 1;
    return { clean, narrow };
  }

  function packPassGameScore({ cleanPasses, narrowPasses, momentumPasses, finalPosition, blockedChoices }) {
    let score = cleanPasses * 100 + narrowPasses * 75 + momentumPasses * 150;
    if (finalPosition <= 10) score += 250;
    if (finalPosition <= 5) score += 500;
    if (finalPosition === 1) score += 1000;
    if (blockedChoices === 0) score += 500;
    return score;
  }

  // --- Finish Chute (2026-09-02) -------------------------------------------
  const FINISH_CHUTE_PAIRINGS = [
    { color: "green", symbol: "🏆", label: "Green trophy" },
    { color: "blue", symbol: "⏱️", label: "Blue stopwatch" },
    { color: "red", symbol: "👟", label: "Red running shoe" },
    { color: "gold", symbol: "🥇", label: "Gold medal" }
  ];
  const FINISH_CHUTE_MAX_MISTAKES = 3;
  const FINISH_CHUTE_DURATION_SECONDS = 30;
  const FINISH_CHUTE_INITIAL_INTERVAL_MS = 2200;
  const FINISH_CHUTE_MIN_INTERVAL_MS = 900;
  const FINISH_CHUTE_INTERVAL_RAMP_PER_RUNNER = 60;
  const FINISH_CHUTE_STRONG_SCORE = 1200;

  function finishChuteNextRunner(randomFn = Math.random) {
    return Math.floor(randomFn() * FINISH_CHUTE_PAIRINGS.length);
  }

  function finishChuteIntervalForCount(runnerCount) {
    return Math.max(FINISH_CHUTE_MIN_INTERVAL_MS, FINISH_CHUTE_INITIAL_INTERVAL_MS - runnerCount * FINISH_CHUTE_INTERVAL_RAMP_PER_RUNNER);
  }

  function finishChuteGameScore({ correctCount, longestStreak, mistakeCount, totalPrompts, avgResponseMs }) {
    let score = correctCount * 100;
    if (longestStreak >= 5) score += 250;
    if (longestStreak >= 10) score += 500;
    if (longestStreak >= 20) score += 1000;
    if (mistakeCount === 0 && totalPrompts > 0 && correctCount === totalPrompts) score += 1000;
    if (Number.isFinite(avgResponseMs)) score += Math.max(0, Math.min(50, Math.round(50 - avgResponseMs / 40)));
    return score;
  }

  // --- Spike Shuffle (2026-09-02) ------------------------------------------
  const SPIKE_SHUFFLE_ADVANCED_ROUND_THRESHOLD = 6; // 4-box rounds start here
  const SPIKE_SHUFFLE_BASE_SWAP_COUNT = 3;
  const SPIKE_SHUFFLE_BASE_SWAP_DURATION_MS = 550;
  const SPIKE_SHUFFLE_MIN_SWAP_DURATION_MS = 260;
  const SPIKE_SHUFFLE_STRONG_SCORE = 1500;

  function spikeShuffleBoxCountForRound(roundNumber) {
    return roundNumber >= SPIKE_SHUFFLE_ADVANCED_ROUND_THRESHOLD ? 4 : 3;
  }
  function spikeShuffleSwapCountForRound(roundNumber) {
    return SPIKE_SHUFFLE_BASE_SWAP_COUNT + Math.min(6, Math.floor(roundNumber / 2));
  }
  function spikeShuffleSwapDurationMsForRound(roundNumber) {
    return Math.max(SPIKE_SHUFFLE_MIN_SWAP_DURATION_MS, SPIKE_SHUFFLE_BASE_SWAP_DURATION_MS - roundNumber * 25);
  }

  // The complete swap sequence for one round, generated BEFORE the
  // animation starts, per spec -- an array of [i, j] box-index pairs.
  function spikeShuffleGenerateSwaps(boxCount, swapCount, randomFn = Math.random) {
    const swaps = [];
    for (let i = 0; i < swapCount; i += 1) {
      const a = Math.floor(randomFn() * boxCount);
      let b = Math.floor(randomFn() * boxCount);
      while (b === a) b = Math.floor(randomFn() * boxCount);
      swaps.push([a, b]);
    }
    return swaps;
  }

  // Applies the swap sequence to find where the spike ends up -- the
  // exact same logical tracking the visual animation performs, at the
  // exact same swap boundaries, so the result is provably determined
  // before the player ever chooses.
  function spikeShuffleApplySwaps(startingBox, swaps) {
    let current = startingBox;
    for (const [a, b] of swaps) {
      if (current === a) current = b;
      else if (current === b) current = a;
    }
    return current;
  }

  function spikeShuffleGameScore(roundsCompleted, advancedRoundsCompleted) {
    const safeRounds = Math.max(0, Math.floor(Number(roundsCompleted) || 0));
    const safeAdvanced = Math.max(0, Math.floor(Number(advancedRoundsCompleted) || 0));
    let score = safeRounds * 250 + safeAdvanced * 500;
    if (safeRounds >= 5) score += 1000;
    return score;
  }

  // --- Runner Says (2026-09-02) --------------------------------------------
  const RUNNER_SAYS_SYMBOLS = [
    { id: "shoe", symbol: "👟", label: "Running shoe" },
    { id: "stopwatch", symbol: "⏱️", label: "Stopwatch" },
    { id: "medal", symbol: "🥇", label: "Medal" },
    { id: "trophy", symbol: "🏆", label: "Trophy" }
  ];
  const RUNNER_SAYS_INITIAL_LENGTH = 2;
  const RUNNER_SAYS_INITIAL_CUE_MS = 650;
  const RUNNER_SAYS_MIN_CUE_MS = 350;
  const RUNNER_SAYS_CUE_GAP_MS = 200;
  const RUNNER_SAYS_FAST_RESPONSE_THRESHOLD_MS = 1200;
  const RUNNER_SAYS_STRONG_SCORE = 1800;

  function runnerSaysCueDurationForRound(roundNumber) {
    return Math.max(RUNNER_SAYS_MIN_CUE_MS, RUNNER_SAYS_INITIAL_CUE_MS - roundNumber * 25);
  }

  // Extends a sequence by exactly one new seeded symbol index.
  function runnerSaysNextSymbolIndex(randomFn = Math.random) {
    return Math.floor(randomFn() * RUNNER_SAYS_SYMBOLS.length);
  }

  function runnerSaysGameScore(sequenceLengthReached, correctSymbolTaps, fastRoundCount) {
    const safeLen = Math.max(0, Math.floor(Number(sequenceLengthReached) || 0));
    const safeTaps = Math.max(0, Math.floor(Number(correctSymbolTaps) || 0));
    const safeFast = Math.max(0, Math.floor(Number(fastRoundCount) || 0));
    let score = safeTaps * 50;
    for (let round = 1; round <= safeLen; round += 1) score += round * 100;
    if (safeLen >= 5) score += 500;
    if (safeLen >= 10) score += 1500;
    score += safeFast * 100;
    return score;
  }

  function todayLocalDateKey(date = new Date()) {
    // The visitor's own local calendar day. Daily challenges (a later
    // phase) specifically need America/New_York per the spec; this daily
    // point cap is just "don't let one sitting farm points forever" and
    // doesn't need that same precision.
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // ---------------------------------------------------------------------
  // Guest profile: versioned, local-only, no account required. Personal
  // records, points, and level live here; nothing sensitive is stored.
  // ---------------------------------------------------------------------

  function defaultProfile() {
    return {
      version: PROFILE_VERSION,
      installId: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      points: 0,
      pointsAwardedToday: { date: todayLocalDateKey(), amount: 0 },
      // Idempotency guard for one-time-per-key point awards (e.g. a given
      // day's first-game bonus) -- see awardPoints().
      awardedKeys: [],
      photoFinish: { personalRecord: null, attempts: 0 },
      startingGun: { personalRecord: null, attempts: 0, falseStarts: 0 },
      // Three independent bests, per spec ("store the longest distance,
      // highest hurdle count, and highest game score") -- each can come
      // from a different run; a run doesn't have to sweep all three to
      // set any one of them.
      hurdleDash: { bestDistance: null, bestHurdlesCleared: null, bestGameScore: null, attempts: 0 },
      tapSprint: { bestDistance: null, attempts: 0 },
      beatTheRunner: { bestRoundReached: null, attempts: 0 },
      memoryMatch: { bestTimeMs: null, fewestMoves: null, attempts: 0 },
      relayExchange: { bestTimeMs: null, bestScore: null, bestPerfectExchanges: null, attempts: 0 },
      coneSlalom: { bestDistance: null, bestGroupsCleared: null, attempts: 0 },
      pacePerfect: { bestAccuracyPct: null, bestStreak: null, attempts: 0 },
      packPass: { bestPosition: null, bestScore: null, attempts: 0 },
      finishChute: { bestStreak: null, bestScore: null, attempts: 0 },
      spikeShuffle: { bestStreak: null, bestScore: null, attempts: 0 },
      runnerSays: { bestSequenceLength: null, bestScore: null, attempts: 0 },
      lastActivityAt: null
    };
  }

  // No prior profile version has ever existed -- an unrecognized version
  // is a future shape this code doesn't understand, not something to
  // guess a migration for. Recovers with a fresh profile rather than
  // crashing the voting page on malformed/future data.
  function sanitizeProfile(raw) {
    try {
      if (!raw || typeof raw !== "object" || raw.version !== PROFILE_VERSION) {
        return defaultProfile();
      }
      const base = defaultProfile();
      const pr = raw.photoFinish && typeof raw.photoFinish === "object" ? raw.photoFinish : {};
      const validPr = pr.personalRecord && Number.isFinite(pr.personalRecord.diffSeconds) && Number.isFinite(pr.personalRecord.elapsedSeconds)
        ? { diffSeconds: pr.personalRecord.diffSeconds, elapsedSeconds: pr.personalRecord.elapsedSeconds }
        : null;
      const sg = raw.startingGun && typeof raw.startingGun === "object" ? raw.startingGun : {};
      const validSgPr = sg.personalRecord && Number.isFinite(sg.personalRecord.reactionMs)
        ? { reactionMs: sg.personalRecord.reactionMs, suspicious: sg.personalRecord.suspicious === true }
        : null;
      const hd = raw.hurdleDash && typeof raw.hurdleDash === "object" ? raw.hurdleDash : {};
      const ts = raw.tapSprint && typeof raw.tapSprint === "object" ? raw.tapSprint : {};
      const btr = raw.beatTheRunner && typeof raw.beatTheRunner === "object" ? raw.beatTheRunner : {};
      const mm = raw.memoryMatch && typeof raw.memoryMatch === "object" ? raw.memoryMatch : {};
      const re = raw.relayExchange && typeof raw.relayExchange === "object" ? raw.relayExchange : {};
      const cs = raw.coneSlalom && typeof raw.coneSlalom === "object" ? raw.coneSlalom : {};
      const pp = raw.pacePerfect && typeof raw.pacePerfect === "object" ? raw.pacePerfect : {};
      const pk = raw.packPass && typeof raw.packPass === "object" ? raw.packPass : {};
      const fc = raw.finishChute && typeof raw.finishChute === "object" ? raw.finishChute : {};
      const ss = raw.spikeShuffle && typeof raw.spikeShuffle === "object" ? raw.spikeShuffle : {};
      const rs = raw.runnerSays && typeof raw.runnerSays === "object" ? raw.runnerSays : {};
      const safeNonNegative = (value) => (Number.isFinite(value) && value >= 0 ? value : null);
      return {
        ...base,
        installId: typeof raw.installId === "string" && raw.installId ? raw.installId : base.installId,
        points: Number.isFinite(raw.points) ? Math.max(0, raw.points) : 0,
        pointsAwardedToday: raw.pointsAwardedToday && typeof raw.pointsAwardedToday.date === "string"
          ? { date: raw.pointsAwardedToday.date, amount: Math.max(0, Number(raw.pointsAwardedToday.amount) || 0) }
          : base.pointsAwardedToday,
        awardedKeys: Array.isArray(raw.awardedKeys) ? raw.awardedKeys.filter((key) => typeof key === "string").slice(-500) : [],
        photoFinish: { personalRecord: validPr, attempts: Number.isFinite(pr.attempts) ? Math.max(0, pr.attempts) : 0 },
        startingGun: {
          personalRecord: validSgPr,
          attempts: Number.isFinite(sg.attempts) ? Math.max(0, sg.attempts) : 0,
          falseStarts: Number.isFinite(sg.falseStarts) ? Math.max(0, sg.falseStarts) : 0
        },
        hurdleDash: {
          bestDistance: safeNonNegative(hd.bestDistance),
          bestHurdlesCleared: safeNonNegative(hd.bestHurdlesCleared),
          bestGameScore: safeNonNegative(hd.bestGameScore),
          attempts: Number.isFinite(hd.attempts) ? Math.max(0, hd.attempts) : 0
        },
        tapSprint: {
          bestDistance: safeNonNegative(ts.bestDistance),
          attempts: Number.isFinite(ts.attempts) ? Math.max(0, ts.attempts) : 0
        },
        beatTheRunner: {
          bestRoundReached: safeNonNegative(btr.bestRoundReached),
          attempts: Number.isFinite(btr.attempts) ? Math.max(0, btr.attempts) : 0
        },
        memoryMatch: {
          bestTimeMs: safeNonNegative(mm.bestTimeMs),
          fewestMoves: safeNonNegative(mm.fewestMoves),
          attempts: Number.isFinite(mm.attempts) ? Math.max(0, mm.attempts) : 0
        },
        relayExchange: {
          bestTimeMs: safeNonNegative(re.bestTimeMs),
          bestScore: safeNonNegative(re.bestScore),
          bestPerfectExchanges: safeNonNegative(re.bestPerfectExchanges),
          attempts: Number.isFinite(re.attempts) ? Math.max(0, re.attempts) : 0
        },
        coneSlalom: {
          bestDistance: safeNonNegative(cs.bestDistance),
          bestGroupsCleared: safeNonNegative(cs.bestGroupsCleared),
          attempts: Number.isFinite(cs.attempts) ? Math.max(0, cs.attempts) : 0
        },
        pacePerfect: {
          bestAccuracyPct: safeNonNegative(pp.bestAccuracyPct),
          bestStreak: safeNonNegative(pp.bestStreak),
          attempts: Number.isFinite(pp.attempts) ? Math.max(0, pp.attempts) : 0
        },
        packPass: {
          bestPosition: safeNonNegative(pk.bestPosition),
          bestScore: safeNonNegative(pk.bestScore),
          attempts: Number.isFinite(pk.attempts) ? Math.max(0, pk.attempts) : 0
        },
        finishChute: {
          bestStreak: safeNonNegative(fc.bestStreak),
          bestScore: safeNonNegative(fc.bestScore),
          attempts: Number.isFinite(fc.attempts) ? Math.max(0, fc.attempts) : 0
        },
        spikeShuffle: {
          bestStreak: safeNonNegative(ss.bestStreak),
          bestScore: safeNonNegative(ss.bestScore),
          attempts: Number.isFinite(ss.attempts) ? Math.max(0, ss.attempts) : 0
        },
        runnerSays: {
          bestSequenceLength: safeNonNegative(rs.bestSequenceLength),
          bestScore: safeNonNegative(rs.bestScore),
          attempts: Number.isFinite(rs.attempts) ? Math.max(0, rs.attempts) : 0
        },
        lastActivityAt: typeof raw.lastActivityAt === "string" ? raw.lastActivityAt : null
      };
    } catch {
      return defaultProfile();
    }
  }

  function loadProfile() {
    try {
      const raw = globalThis.localStorage?.getItem(PROFILE_STORAGE_KEY);
      return raw ? sanitizeProfile(JSON.parse(raw)) : defaultProfile();
    } catch {
      // Malformed JSON, storage disabled, or anything else -- recover
      // with a fresh in-memory profile rather than breaking the page.
      return defaultProfile();
    }
  }

  function saveProfile(profile) {
    try {
      globalThis.localStorage?.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // Storage unavailable, full, or disabled -- Podium Play keeps
      // working for this page view from the in-memory profile; it just
      // won't persist across a reload. Never throws into the caller.
    }
  }

  // Grants `amount` points under a unique `key`, exactly once ever for
  // that key, respecting the daily cap. Returns the amount actually
  // granted (0 if already granted for this key, or the cap was already
  // reached today -- a repeat call for the same key is always free of
  // side effects beyond the first). Mutates `profile` in place; callers
  // are expected to saveProfile() afterward.
  function awardPoints(profile, key, amount) {
    const today = todayLocalDateKey();
    if (profile.pointsAwardedToday.date !== today) {
      profile.pointsAwardedToday = { date: today, amount: 0 };
    }
    if (profile.awardedKeys.includes(key)) return 0;

    profile.awardedKeys.push(key);
    const remaining = Math.max(0, DAILY_POINT_CAP - profile.pointsAwardedToday.amount);
    const granted = Math.max(0, Math.min(amount, remaining));
    if (granted > 0) {
      profile.points += granted;
      profile.pointsAwardedToday.amount += granted;
    }
    return granted;
  }

  // ---------------------------------------------------------------------
  // Expose the pure/testable pieces before any DOM wiring below runs, so
  // scripts/test-podium-play.mjs can load this file in Node (with a
  // window/localStorage stub) and never needs a real browser or document.
  // ---------------------------------------------------------------------

  const PodiumPlay = (window.PodiumPlay = window.PodiumPlay || {});
  Object.assign(PodiumPlay, {
    PROFILE_STORAGE_KEY,
    PROFILE_VERSION,
    DAILY_POINT_CAP,
    FIRST_GAME_IN_COOLDOWN_POINTS,
    PERSONAL_RECORD_POINTS,
    LEVELS,
    PHOTO_FINISH_TARGET_SECONDS,
    PHOTO_FINISH_HIDE_AT_SECONDS,
    PHOTO_FINISH_MIN_VALID_SECONDS,
    photoFinishScoreBand,
    STARTING_GUN_MIN_DELAY_MS,
    STARTING_GUN_MAX_DELAY_MS,
    STARTING_GUN_ON_YOUR_MARKS_MS,
    STARTING_GUN_SET_MS,
    randomStartingGunDelayMs,
    startingGunScoreBand,
    HURDLE_DASH_WIDTH,
    HURDLE_DASH_HEIGHT,
    HURDLE_DASH_GROUND_Y,
    HURDLE_DASH_RUNNER_X,
    HURDLE_DASH_RUNNER_WIDTH,
    HURDLE_DASH_RUNNER_HEIGHT,
    HURDLE_DASH_HURDLE_WIDTH,
    HURDLE_DASH_HURDLE_HEIGHT,
    HURDLE_DASH_TROPHY_SIZE,
    HURDLE_DASH_GRAVITY,
    HURDLE_DASH_JUMP_VELOCITY,
    HURDLE_DASH_JUMP_DURATION_SECONDS,
    HURDLE_DASH_INITIAL_SPEED,
    HURDLE_DASH_MAX_SPEED,
    HURDLE_DASH_SPEED_RAMP_PER_SECOND,
    HURDLE_DASH_FIRST_HURDLE_DELAY_SECONDS,
    HURDLE_DASH_SAFE_GAP_MIN_MULTIPLIER,
    HURDLE_DASH_SAFE_GAP_MAX_MULTIPLIER,
    HURDLE_DASH_RESUME_COUNTDOWN_SECONDS,
    hurdleDashSpeedAtElapsed,
    hurdleDashJumpOffset,
    rectsOverlap,
    hurdleDashNextGap,
    hurdleDashGameScore,
    TAP_SPRINT_DURATION_SECONDS,
    tapSprintDistanceForTaps,
    tapSprintRegisterTap,
    tapSprintTapIsRateLimited,
    BEAT_THE_RUNNER_ROUNDS,
    beatTheRunnerRoundTarget,
    MEMORY_MATCH_SYMBOLS,
    MEMORY_MATCH_PAIR_COUNT,
    memoryMatchNewBoard,
    levelForPoints,
    MIN_PARTICIPATION_POINTS,
    MAX_PARTICIPATION_POINTS,
    participationPointsForPlay,
    RELAY_EXCHANGE_LANE_COUNT,
    RELAY_EXCHANGE_LEG_DURATION_MS,
    RELAY_EXCHANGE_START_WINDOW_MS,
    RELAY_EXCHANGE_PASS_WINDOW_MS,
    relayStartBand,
    relayPassBand,
    relayExchangeGameScore,
    relayCpuLegDurationMs,
    CONE_SLALOM_LANE_COUNT,
    CONE_SLALOM_LANE_TRANSITION_MS,
    CONE_SLALOM_MAX_LANE_SHIFT,
    CONE_SLALOM_DURATION_SECONDS,
    CONE_SLALOM_OBSTACLES,
    CONE_SLALOM_INITIAL_SPEED,
    CONE_SLALOM_MAX_SPEED,
    coneSlalomSpeedAtElapsed,
    coneSlalomNextGap,
    coneSlalomNextGroup,
    coneSlalomGameScore,
    PACE_PERFECT_BEAT_COUNT,
    PACE_PERFECT_BEAT_INTERVAL_MS,
    PACE_PERFECT_MISS_TOLERANCE_MS,
    paceBeatSchedule,
    paceBeatBand,
    paceBeatScore,
    paceMatchTapToBeat,
    pacePerfectGameScore,
    PACK_PASS_START_POSITION,
    PACK_PASS_DECISION_COUNT,
    PACK_PASS_LANE_COUNT,
    PACK_PASS_DECISION_WINDOW_MS,
    packPassNextDecision,
    packPassResolveChoice,
    packPassGameScore,
    FINISH_CHUTE_PAIRINGS,
    FINISH_CHUTE_MAX_MISTAKES,
    FINISH_CHUTE_INITIAL_INTERVAL_MS,
    FINISH_CHUTE_MIN_INTERVAL_MS,
    finishChuteNextRunner,
    finishChuteIntervalForCount,
    finishChuteGameScore,
    SPIKE_SHUFFLE_ADVANCED_ROUND_THRESHOLD,
    spikeShuffleBoxCountForRound,
    spikeShuffleSwapCountForRound,
    spikeShuffleSwapDurationMsForRound,
    spikeShuffleGenerateSwaps,
    spikeShuffleApplySwaps,
    spikeShuffleGameScore,
    RUNNER_SAYS_SYMBOLS,
    RUNNER_SAYS_INITIAL_LENGTH,
    RUNNER_SAYS_CUE_GAP_MS,
    RUNNER_SAYS_FAST_RESPONSE_THRESHOLD_MS,
    runnerSaysCueDurationForRound,
    runnerSaysNextSymbolIndex,
    runnerSaysGameScore,
    todayLocalDateKey,
    defaultProfile,
    sanitizeProfile,
    loadProfile,
    saveProfile,
    awardPoints
  });

  // A bare `document` check (rather than a full browser-feature check)
  // is the real signal this file is running in Node under the test
  // runner rather than a real page -- every DOM-dependent piece below is
  // deliberately skipped in that case so the pure exports above stay
  // importable with nothing more than a window/localStorage stub.
  if (typeof document === "undefined") return;

  // ---------------------------------------------------------------------
  // DOM wiring: the panel, the countdown, Photo Finish, analytics.
  // ---------------------------------------------------------------------

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatSeconds2(value) {
    return Number.isFinite(value) ? value.toFixed(2) : "--.--";
  }

  // Same podium_visitor_id/podium_session_id keys already used by
  // public/scripts/pace-calculator.js and page-view.js -- Podium Play
  // activity ties to the same visitor/session identity as the rest of
  // the site's engagement tracking, not a competing scheme.
  function getVisitorId() {
    try {
      let id = localStorage.getItem("podium_visitor_id");
      if (!id) {
        id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        localStorage.setItem("podium_visitor_id", id);
      }
      return id;
    } catch {
      return "unknown";
    }
  }

  function getSessionId() {
    try {
      let id = sessionStorage.getItem("podium_session_id");
      if (!id) {
        id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        sessionStorage.setItem("podium_session_id", id);
      }
      return id;
    } catch {
      return "unknown";
    }
  }

  // Analytics must never interrupt voting or play -- every call site
  // below fires this and ignores the outcome entirely. Events land in
  // the same team_analytics_events table as the rest of the site's
  // engagement tracking (see lib/engagement_service.mjs); this silently
  // no-ops (a real, expected 400) until
  // install/40_PODIUM_PLAY_ANALYTICS.sql is actually run.
  function track(eventType, extra = {}) {
    try {
      fetch("/api/engagement/track", {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: eventType,
          visitor_id: getVisitorId(),
          session_id: getSessionId(),
          section: "podium_play",
          path: window.location.pathname,
          ...extra
        })
      }).catch(() => {});
    } catch {
      // Never let analytics break the arcade.
    }
  }

  function initPanel(root) {
    const panel = root.querySelector("[data-podium-play]");
    if (!panel) return;

    const otherContestHref = panel.dataset.otherContestHref || "";
    const otherContestLabel = panel.dataset.otherContestLabel || "";

    let profile = loadProfile();
    let cooldownTimer = null;
    let cooldownDeadline = 0;
    // Games are available for the whole page visit now, independent of
    // voting (see the file header) -- there is no longer a per-vote
    // "cooldown session" to scope the first-game bonus to, so this key
    // covers the whole time this page has been open instead, generated
    // once below rather than regenerated on every vote.
    const pageSessionKey = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    let sessionAwardedFirstGame = false;
    // Whichever one game is currently in progress, if any -- only one can
    // ever be active at a time (starting a new attempt or opening a
    // different game always goes through cancelCurrentAttempt() first).
    // Photo Finish stores { startedAt, raf, cleanup, tabHidden }; Starting
    // Gun and Hurdle Dash both store { cleanup } (their own pending
    // timers/listeners/animation frame -- Hurdle Dash's own `raf` local
    // variable is cancelled from inside that cleanup closure, not read
    // off this shared object the way Photo Finish's is).
    let currentAttempt = null;
    // My Podium account bridge -- entirely additive on top of the local
    // guest profile above, which keeps working unchanged for anyone not
    // signed in (see lib/podium_play_service.mjs's own header for why a
    // local total is never blindly imported into the account). null
    // means "not signed in, or not loaded yet"; once loaded, this
    // (server-authoritative) summary is what's actually displayed and
    // what backs the leaderboard, in place of the local profile.
    let signedIn = false;
    let accountSummary = null;

    function persist() {
      profile.lastActivityAt = new Date().toISOString();
      saveProfile(profile);
    }

    function renderProgress() {
      const points = accountSummary ? accountSummary.points : profile.points;
      const level = accountSummary ? accountSummary.level : levelForPoints(profile.points);
      const pointsEl = panel.querySelector("[data-pp-points]");
      const levelEl = panel.querySelector("[data-pp-level]");
      if (pointsEl) pointsEl.textContent = String(points);
      if (levelEl) {
        levelEl.textContent = level.next
          ? `${level.name} · ${level.threshold + Math.round(level.progress * (level.next.threshold - level.threshold))}/${level.next.threshold} to ${level.next.name}`
          : `${level.name} · top level`;
      }
      renderAccountStatus();
    }

    function renderAccountStatus() {
      const el = panel.querySelector("[data-pp-account]");
      if (!el) return;
      const rankText = accountSummary?.rank ? ` · Ranked #${accountSummary.rank}` : "";
      if (signedIn) {
        const name = accountSummary?.displayName ? escapeHtml(accountSummary.displayName) : "your account";
        el.innerHTML = `<span>Signed in as ${name}${rankText}</span>`;
      } else if (accountSummary?.displayName) {
        // Guests are on the leaderboard too now, under a server-assigned
        // label -- sign-in is no longer required to appear on it, only
        // to get a real name and carry progress across devices.
        el.innerHTML = `<span>Playing as ${escapeHtml(accountSummary.displayName)}${rankText}</span> <a href="/my-podium-login/">Sign in for a real name</a>`;
      } else {
        el.innerHTML = `<a href="/my-podium-login/">Sign in to save your progress</a>`;
      }
    }

    function announce(text) {
      const liveRegion = panel.querySelector("[data-pp-live]");
      if (liveRegion) liveRegion.textContent = text;
    }

    function tickCountdown() {
      const remaining = Math.max(0, Math.ceil((cooldownDeadline - Date.now()) / 1000));
      const countdownEl = panel.querySelector("[data-pp-countdown]");
      const ringEl = panel.querySelector("[data-pp-ring]");
      if (countdownEl) {
        countdownEl.textContent = remaining > 0 ? `Vote again in ${remaining} second${remaining === 1 ? "" : "s"}.` : "You can vote again now.";
      }
      if (ringEl) {
        const total = Number(panel.dataset.cooldownTotal) || 45;
        const pct = Math.max(0, Math.min(100, ((total - remaining) / total) * 100));
        ringEl.style.setProperty("--pp-progress", `${pct}%`);
      }
      if (remaining <= 0) {
        clearInterval(cooldownTimer);
        cooldownTimer = null;
        showVoteAgain();
      }
    }

    function showVoteAgain() {
      const button = panel.querySelector("[data-pp-vote-again]");
      if (button && button.hidden) {
        button.hidden = false;
        announce("You can vote again now.");
      }
    }

    function buildPanelMarkup() {
      panel.innerHTML = `
        <div class="pp-cooldown-status" data-pp-cooldown-status hidden>
          <div class="pp-header">
            <p class="pp-vote-confirmed" data-pp-confirmed></p>
            <div class="pp-cooldown-ring" data-pp-ring><span data-pp-countdown>Vote again in 45 seconds.</span></div>
          </div>
        </div>
        <p class="visually-hidden" role="status" aria-live="polite" data-pp-live></p>
        <div class="pp-progress-row">
          <span><strong data-pp-points>0</strong> Podium Points</span>
          <span data-pp-level>Rookie Runner</span>
        </div>
        <p class="pp-account" data-pp-account></p>
        <p class="eyebrow">Podium Play</p>
        <div class="pp-games" data-pp-games>
          <div class="pp-game-card" data-pp-game="photo-finish">
            <h3>Photo Finish</h3>
            <p>Stop the clock at exactly 15.00.</p>
            <button class="button button-primary" type="button" data-pp-play="photo-finish">Play</button>
          </div>
          <div class="pp-game-card" data-pp-game="starting-gun">
            <h3>Starting Gun</h3>
            <p>Wait for the gun. Tap as fast as you can.</p>
            <button class="button button-primary" type="button" data-pp-play="starting-gun">Play</button>
          </div>
          <div class="pp-game-card" data-pp-game="hurdle-dash">
            <h3>Hurdle Dash</h3>
            <p>Tap to jump. Clear as many hurdles as you can.</p>
            <button class="button button-primary" type="button" data-pp-play="hurdle-dash">Play</button>
          </div>
          <div class="pp-game-card" data-pp-game="tap-sprint">
            <h3>Tap Sprint</h3>
            <p>Alternate taps for 10 seconds. How far can you go?</p>
            <button class="button button-primary" type="button" data-pp-play="tap-sprint">Play</button>
          </div>
          <div class="pp-game-card" data-pp-game="beat-the-runner">
            <h3>Beat the Runner</h3>
            <p>Tap fast enough to catch the runner before the line.</p>
            <button class="button button-primary" type="button" data-pp-play="beat-the-runner">Play</button>
          </div>
          <div class="pp-game-card" data-pp-game="memory-match">
            <h3>Memory Match</h3>
            <p>Find all 3 matching pairs as fast as you can.</p>
            <button class="button button-primary" type="button" data-pp-play="memory-match">Play</button>
          </div>
          <div class="pp-game-card" data-pp-game="relay-exchange">
            <h3>Relay Exchange</h3>
            <p>Start the runner, then time the baton pass.</p>
            <button class="button button-primary" type="button" data-pp-play="relay-exchange">Play</button>
          </div>
          <div class="pp-game-card" data-pp-game="cone-slalom">
            <h3>Cone Slalom</h3>
            <p>Change lanes and avoid every obstacle.</p>
            <button class="button button-primary" type="button" data-pp-play="cone-slalom">Play</button>
          </div>
          <div class="pp-game-card" data-pp-game="pace-perfect">
            <h3>Pace Perfect</h3>
            <p>Tap with the rhythm and hold the pace.</p>
            <button class="button button-primary" type="button" data-pp-play="pace-perfect">Play</button>
          </div>
          <div class="pp-game-card" data-pp-game="pack-pass">
            <h3>Pack Pass</h3>
            <p>Find the opening and race through the pack.</p>
            <button class="button button-primary" type="button" data-pp-play="pack-pass">Play</button>
          </div>
          <div class="pp-game-card" data-pp-game="finish-chute">
            <h3>Finish Chute</h3>
            <p>Send every runner to the matching chute.</p>
            <button class="button button-primary" type="button" data-pp-play="finish-chute">Play</button>
          </div>
          <div class="pp-game-card" data-pp-game="spike-shuffle">
            <h3>Spike Shuffle</h3>
            <p>Follow the spike and find its box.</p>
            <button class="button button-primary" type="button" data-pp-play="spike-shuffle">Play</button>
          </div>
          <div class="pp-game-card" data-pp-game="runner-says">
            <h3>Runner Says</h3>
            <p>Watch the sequence and repeat it.</p>
            <button class="button button-primary" type="button" data-pp-play="runner-says">Play</button>
          </div>
        </div>
        <div class="pp-game-stage" data-pp-stage hidden></div>
        <div class="pp-leaderboard" data-pp-leaderboard hidden>
          <p class="eyebrow">Leaderboard</p>
          <ol class="pp-leaderboard-list" data-pp-leaderboard-list></ol>
        </div>
        <div class="pp-leaderboard pp-world-records" data-pp-world-records hidden>
          <p class="eyebrow">World Records</p>
          <ul class="pp-world-records-list" data-pp-world-records-list></ul>
        </div>
        ${otherContestHref ? `<p class="pp-other-contest"><a href="${escapeHtml(otherContestHref)}">Have you voted for ${escapeHtml(otherContestLabel)}?</a></p>` : ""}
        <button class="button button-primary pp-vote-again" type="button" data-pp-vote-again hidden>Vote again</button>
      `;
    }

    // Reuses the exact same shared Supabase session wrapper every My
    // Podium/team/photographer tier already uses (public/scripts/
    // team-auth-client.js, window.PodiumTeamAuth) -- not a second auth
    // scheme. That script may not have loaded for any reason; every call
    // below is guarded so failure degrades to guest-only, never breaks
    // the panel.
    async function getAccessToken() {
      try {
        if (!window.PodiumTeamAuth) return "";
        return await window.PodiumTeamAuth.getAccessToken();
      } catch {
        return "";
      }
    }

    // Guests can be on the leaderboard too now, under a server-assigned
    // "podiumwatchguest####" label (never client-supplied -- see
    // lib/podium_play_service.mjs's generateGuestLabel). Their identity
    // is the same anonymous crypto.randomUUID() the local guest profile
    // already generates and persists (profile.installId) -- not
    // authenticated the way a real My Podium session is, just a stable
    // per-device id.
    async function loadAccount() {
      const token = await getAccessToken();
      signedIn = Boolean(token);
      renderAccountStatus();
      try {
        const url = signedIn ? "/api/podium-play/me/" : `/api/podium-play/me/?installId=${encodeURIComponent(profile.installId)}`;
        const response = await fetch(url, signedIn ? { headers: { Authorization: `Bearer ${token}` } } : {});
        const data = await response.json().catch(() => ({}));
        if (response.ok) {
          accountSummary = data;
          renderProgress();
        }
      } catch {
        // A failed account load leaves the local guest/points display as
        // the fallback -- never breaks the panel.
      }
    }

    // Fire-and-forget, for both a signed-in player and a guest alike: the
    // already-rendered local result must never wait on or be disrupted by
    // this. Sends only the same kind of raw measurement the local guest
    // profile already produces -- never a client-computed score or point
    // total (see lib/podium_play_service.mjs's own header for why that
    // matters now that a public leaderboard makes a faked number worth
    // something).
    async function submitToServer(gameType, rawInput) {
      try {
        const token = await getAccessToken();
        const headers = { "Content-Type": "application/json" };
        const body = { gameType, rawInput };
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        } else {
          body.installId = profile.installId;
        }
        const response = await fetch("/api/podium-play/submit", {
          method: "POST",
          headers,
          body: JSON.stringify(body)
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) {
          accountSummary = data;
          renderProgress();
          loadLeaderboard();
          loadWorldRecords();
        }
      } catch {
        // Never let a failed submission disrupt the already-shown local result.
      }
    }

    function formatLeaderboardRow(entry) {
      return `<li><span class="pp-leaderboard-rank">#${entry.rank}</span><span class="pp-leaderboard-name">${escapeHtml(entry.displayName)}</span><span class="pp-leaderboard-points">${entry.points}</span></li>`;
    }

    // Public data -- loaded regardless of sign-in state, same as anyone
    // can see who's currently voting-leaderboard-adjacent without an
    // account (see api/podium-play/leaderboard.js's own header).
    async function loadLeaderboard() {
      const section = panel.querySelector("[data-pp-leaderboard]");
      const list = panel.querySelector("[data-pp-leaderboard-list]");
      if (!section || !list) return;
      try {
        const response = await fetch("/api/podium-play/leaderboard/?limit=10");
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !Array.isArray(data.leaders) || data.leaders.length === 0) {
          section.hidden = true;
          return;
        }
        list.innerHTML = data.leaders.map(formatLeaderboardRow).join("");
        section.hidden = false;
      } catch {
        section.hidden = true;
      }
    }

    function worldRecordRow(label, valueHtml, holder) {
      if (!valueHtml) return "";
      return `<li><span class="pp-world-record-game">${escapeHtml(label)}</span><span class="pp-world-record-value">${valueHtml}</span><span class="pp-world-record-holder">${escapeHtml(holder || "")}</span></li>`;
    }

    // One headline record per game, across every real account -- not a
    // per-player leaderboard (see api/podium-play/world-records.js's own
    // header). Public, loaded the same way loadLeaderboard() is above.
    async function loadWorldRecords() {
      const section = panel.querySelector("[data-pp-world-records]");
      const list = panel.querySelector("[data-pp-world-records-list]");
      if (!section || !list) return;
      try {
        const response = await fetch("/api/podium-play/world-records/");
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.records) {
          section.hidden = true;
          return;
        }
        const r = data.records;
        const rows = [];

        if (r.photoFinish) {
          const exact = r.photoFinish.diffSeconds === 0;
          const value = exact
            ? `Exact 15.00s <span class="pp-world-record-note">(${r.photoFinish.exactHitCount} player${r.photoFinish.exactHitCount === 1 ? "" : "s"} have hit it exactly)</span>`
            : `${r.photoFinish.diffSeconds.toFixed(2)}s off <span class="pp-world-record-note">(${r.photoFinish.exactHitCount} player${r.photoFinish.exactHitCount === 1 ? "" : "s"} have hit it exactly)</span>`;
          rows.push(worldRecordRow("Photo Finish", value, r.photoFinish.holder));
        }
        if (r.startingGun) {
          rows.push(worldRecordRow("Starting Gun", `${r.startingGun.reactionMs}ms`, r.startingGun.holder));
        }
        if (r.hurdleDash) {
          rows.push(worldRecordRow("Hurdle Dash", `${r.hurdleDash.distance.toLocaleString()} distance`, r.hurdleDash.holder));
        }
        if (r.tapSprint) {
          rows.push(worldRecordRow("Tap Sprint", `${r.tapSprint.distance.toLocaleString()} distance`, r.tapSprint.holder));
        }
        if (r.beatTheRunner) {
          const roundInfo = BEAT_THE_RUNNER_ROUNDS[r.beatTheRunner.round - 1];
          const roundLabel = roundInfo ? `Round ${r.beatTheRunner.round}, ${roundInfo.name}` : `Round ${r.beatTheRunner.round}`;
          rows.push(worldRecordRow("Beat the Runner", roundLabel, r.beatTheRunner.holder));
        }
        if (r.memoryMatch?.fastestTime) {
          rows.push(worldRecordRow("Memory Match (time)", `${(r.memoryMatch.fastestTime.timeMs / 1000).toFixed(1)}s`, r.memoryMatch.fastestTime.holder));
        }
        if (r.memoryMatch?.fewestMoves) {
          rows.push(worldRecordRow("Memory Match (moves)", `${r.memoryMatch.fewestMoves.moves} moves`, r.memoryMatch.fewestMoves.holder));
        }

        const rendered = rows.filter(Boolean);
        if (rendered.length === 0) {
          section.hidden = true;
          return;
        }
        list.innerHTML = rendered.join("");
        section.hidden = false;
      } catch {
        section.hidden = true;
      }
    }

    function openPhotoFinish() {
      const stage = panel.querySelector("[data-pp-stage]");
      const games = panel.querySelector("[data-pp-games]");
      if (!stage) return;
      games.hidden = true;
      stage.hidden = false;
      track("podium_play_game_started", { content_type: "game", content_id: "photo_finish" });
      renderPhotoFinishIdle(stage, games);
    }

    function closeGameStage(stage, games) {
      cancelCurrentAttempt();
      stage.hidden = true;
      stage.innerHTML = "";
      games.hidden = false;
    }

    // The single cleanup path for an in-progress attempt -- called both
    // when it finishes normally (Stop) and when the visitor abandons it
    // early (Back to games mid-attempt). Cancels the running animation
    // frame loop AND removes the visibilitychange listener every time, so
    // clicking Back mid-attempt can never leak a listener the way calling
    // only cancelAnimationFrame here previously did.
    function cancelCurrentAttempt() {
      if (currentAttempt?.raf) cancelAnimationFrame(currentAttempt.raf);
      currentAttempt?.cleanup?.();
      currentAttempt = null;
    }

    function renderPhotoFinishIdle(stage, games) {
      const pr = profile.photoFinish.personalRecord;
      stage.innerHTML = `
        <div class="pp-stage-head"><h3>Photo Finish</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
        <p>Stop the clock at exactly 15.00.</p>
        ${pr ? `<p class="pp-pr">Personal record: ${formatSeconds2(pr.elapsedSeconds)} (${formatSeconds2(pr.diffSeconds)} away)</p>` : ""}
        <p class="pp-clock" data-pp-clock aria-hidden="true">00.00</p>
        <button class="button button-primary pp-stage-action" type="button" data-pp-start>Start</button>
      `;
      stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));
      stage.querySelector("[data-pp-start]").addEventListener("click", () => startPhotoFinishAttempt(stage, games));
    }

    function startPhotoFinishAttempt(stage, games) {
      const clockEl = stage.querySelector("[data-pp-clock]");
      const startButton = stage.querySelector("[data-pp-start]");
      const startedAt = performance.now();
      let hiddenFromView = false;
      let tabHidden = false;

      const onVisibilityChange = () => {
        if (document.hidden) tabHidden = true;
      };
      document.addEventListener("visibilitychange", onVisibilityChange);

      startButton.textContent = "Stop";
      startButton.replaceWith(startButton.cloneNode(true)); // drop the Start listener cleanly
      const stopButton = stage.querySelector("[data-pp-start]");
      stopButton.addEventListener("click", () => finishPhotoFinishAttempt(stage, games, startedAt, tabHidden));

      currentAttempt = { startedAt, tabHidden: () => tabHidden };

      function frame() {
        const elapsed = (performance.now() - startedAt) / 1000;
        if (!hiddenFromView && elapsed >= PHOTO_FINISH_HIDE_AT_SECONDS) {
          hiddenFromView = true;
          clockEl.textContent = "Finish by feel.";
        } else if (!hiddenFromView) {
          clockEl.textContent = formatSeconds2(elapsed);
        }
        if (currentAttempt) currentAttempt.raf = requestAnimationFrame(frame);
      }
      currentAttempt.raf = requestAnimationFrame(frame);
      currentAttempt.cleanup = () => document.removeEventListener("visibilitychange", onVisibilityChange);
    }

    function finishPhotoFinishAttempt(stage, games, startedAt, wasTabHidden) {
      const elapsedSeconds = (performance.now() - startedAt) / 1000;
      cancelCurrentAttempt();

      const invalid = elapsedSeconds < PHOTO_FINISH_MIN_VALID_SECONDS || wasTabHidden;
      profile.photoFinish.attempts += 1;

      if (invalid) {
        stage.innerHTML = `
          <div class="pp-stage-head"><h3>Photo Finish</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
          <p>That attempt didn't count. Try again.</p>
          <button class="button button-primary pp-stage-action" type="button" data-pp-again>Play again</button>
        `;
        stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));
        stage.querySelector("[data-pp-again]").addEventListener("click", () => renderPhotoFinishIdle(stage, games));
        persist();
        return;
      }

      submitToServer("photo_finish", { elapsedSeconds });

      const roundedElapsed = Math.round(elapsedSeconds * 100) / 100;
      const diff = Math.round(Math.abs(roundedElapsed - PHOTO_FINISH_TARGET_SECONDS) * 100) / 100;
      const gameScore = photoFinishScoreBand(diff);

      const priorPr = profile.photoFinish.personalRecord;
      const isNewPr = !priorPr || diff < priorPr.diffSeconds;
      if (isNewPr) {
        profile.photoFinish.personalRecord = { diffSeconds: diff, elapsedSeconds: roundedElapsed };
      }

      let pointsEarned = 0;
      if (!sessionAwardedFirstGame) {
        pointsEarned += awardPoints(profile, `first-game-${pageSessionKey}`, FIRST_GAME_IN_COOLDOWN_POINTS);
        sessionAwardedFirstGame = true;
      }
      pointsEarned += awardPoints(profile, `photo-finish-play-${Date.now()}`, participationPointsForPlay("photo_finish", { gameScore }));
      if (isNewPr) {
        // The "is this better than the stored record" gate above already
        // guarantees this branch runs at most once for this exact
        // attempt, so a fresh key per call is safe -- awardPoints() still
        // matters here for the one real thing it enforces on this path:
        // the daily point cap. The record itself is stored unconditionally
        // above regardless of the cap, matching the spec's "personal
        // records may still update after the cap is reached."
        pointsEarned += awardPoints(profile, `photo-finish-pr-${Date.now()}`, PERSONAL_RECORD_POINTS);
        track("podium_play_personal_record", { content_type: "game", content_id: "photo_finish" });
      }
      persist();
      renderProgress();
      track("podium_play_game_completed", { content_type: "game", content_id: "photo_finish", result_band: String(gameScore) });

      const resultLine = diff === 0
        ? `Perfect ${formatSeconds2(roundedElapsed)}. Exactly on target.`
        : diff <= 0.05
          ? `${formatSeconds2(roundedElapsed)}. Photo finish. Only ${formatSeconds2(diff)} away.`
          : `${formatSeconds2(roundedElapsed)}. Only ${formatSeconds2(diff)} away.`;
      const prLine = isNewPr ? "New personal record." : "Can you get closer?";
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

      stage.innerHTML = `
        <div class="pp-stage-head"><h3>Photo Finish</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
        <p class="pp-result${isNewPr && !reduceMotion ? " pp-result-celebrate" : ""}">${escapeHtml(resultLine)}</p>
        <p class="pp-pr">${escapeHtml(prLine)}</p>
        <p class="pp-score">Score: ${gameScore}${pointsEarned > 0 ? ` &middot; +${pointsEarned} Podium Points` : ""}</p>
        <button class="button button-primary pp-stage-action" type="button" data-pp-again>Play again</button>
      `;
      stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));
      stage.querySelector("[data-pp-again]").addEventListener("click", () => renderPhotoFinishIdle(stage, games));
      announce(`${resultLine} ${prLine}`);
    }

    function openStartingGun() {
      const stage = panel.querySelector("[data-pp-stage]");
      const games = panel.querySelector("[data-pp-games]");
      if (!stage) return;
      games.hidden = true;
      stage.hidden = false;
      track("podium_play_game_started", { content_type: "game", content_id: "starting_gun" });
      renderStartingGunIdle(stage, games);
    }

    function renderStartingGunIdle(stage, games) {
      const pr = profile.startingGun.personalRecord;
      stage.innerHTML = `
        <div class="pp-stage-head"><h3>Starting Gun</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
        <p>Wait for the gun. Tap as fast as you can.</p>
        ${pr ? `<p class="pp-pr">Personal record: ${Math.round(pr.reactionMs)}ms${pr.suspicious ? " (flagged for review)" : ""}</p>` : ""}
        ${profile.startingGun.falseStarts > 0 ? `<p class="pp-pr">False starts so far: ${profile.startingGun.falseStarts}</p>` : ""}
        <button class="button button-primary pp-stage-action" type="button" data-pp-ready>Ready</button>
      `;
      stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));
      stage.querySelector("[data-pp-ready]").addEventListener("click", () => beginStartingGunSequence(stage, games));
    }

    // "On your marks" -> "Set" -> a real random 1.5-4.0s delay -> GO.
    // Any tap before GO is a false start; the single click listener below
    // (added once, not re-added per phase) just checks `phase`, avoiding
    // the churn of attaching/detaching a listener per state.
    function beginStartingGunSequence(stage, games) {
      stage.innerHTML = `
        <div class="pp-stage-head"><h3>Starting Gun</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
        <button class="pp-tap-zone" type="button" data-pp-tap-zone aria-label="Tap when you see GO"><span data-pp-signal>On your marks.</span></button>
      `;
      stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));

      const tapZone = stage.querySelector("[data-pp-tap-zone]");
      const signalEl = stage.querySelector("[data-pp-signal]");
      let phase = "waiting"; // "waiting": any tap is a false start. "go": timing a real reaction.
      let goAt = 0;
      let resolved = false; // guards against two click events (e.g. a fast double-tap) both resolving this one attempt.
      const timers = [];

      function schedule(fn, ms) {
        timers.push(setTimeout(fn, ms));
      }

      currentAttempt = { cleanup: () => { for (const id of timers) clearTimeout(id); } };

      schedule(() => {
        signalEl.textContent = "Set.";
        schedule(() => {
          schedule(() => {
            phase = "go";
            goAt = performance.now();
            tapZone.classList.add("pp-tap-zone-go");
            signalEl.textContent = "GO";
            // No sound, by explicit direction -- visual (color + text)
            // and vibration only. Color and text alone never reach a
            // screen reader (a live region is required, per this
            // project's own accessibility bar), so this announcement is
            // the one signal guaranteed to reach every visitor regardless
            // of device.
            announce("Go! Tap now.");
            navigator.vibrate?.(60);
          }, randomStartingGunDelayMs());
        }, STARTING_GUN_SET_MS);
      }, STARTING_GUN_ON_YOUR_MARKS_MS);

      tapZone.addEventListener("click", () => {
        if (resolved) return;
        resolved = true;
        if (phase === "waiting") {
          handleFalseStart(stage, games);
          return;
        }
        handleStartingGunResult(stage, games, performance.now() - goAt);
      });
    }

    function handleFalseStart(stage, games) {
      cancelCurrentAttempt();
      profile.startingGun.falseStarts += 1;
      persist();
      stage.innerHTML = `
        <div class="pp-stage-head"><h3>Starting Gun</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
        <p class="pp-result">False start.</p>
        <p class="pp-pr">Wait for the gun next time -- no points for this one.</p>
        <button class="button button-primary pp-stage-action" type="button" data-pp-again>Try again</button>
      `;
      stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));
      stage.querySelector("[data-pp-again]").addEventListener("click", () => renderStartingGunIdle(stage, games));
      announce("False start. Wait for the gun next time.");
    }

    function handleStartingGunResult(stage, games, reactionMs) {
      cancelCurrentAttempt();
      profile.startingGun.attempts += 1;
      submitToServer("starting_gun", { reactionMs });

      const { score: gameScore, suspicious } = startingGunScoreBand(reactionMs);
      const priorPr = profile.startingGun.personalRecord;
      const isNewPr = !priorPr || reactionMs < priorPr.reactionMs;
      if (isNewPr) {
        profile.startingGun.personalRecord = { reactionMs, suspicious };
      }

      let pointsEarned = 0;
      if (!sessionAwardedFirstGame) {
        pointsEarned += awardPoints(profile, `first-game-${pageSessionKey}`, FIRST_GAME_IN_COOLDOWN_POINTS);
        sessionAwardedFirstGame = true;
      }
      pointsEarned += awardPoints(profile, `starting-gun-play-${Date.now()}`, participationPointsForPlay("starting_gun", { gameScore, suspicious }));
      if (isNewPr) {
        // Same reasoning as Photo Finish's PR bonus: the "is this better"
        // gate above already limits this to at most once per attempt, so
        // a fresh key is safe -- awardPoints() still enforces the daily
        // cap here, which a direct profile.points += would have skipped.
        pointsEarned += awardPoints(profile, `starting-gun-pr-${Date.now()}`, PERSONAL_RECORD_POINTS);
        track("podium_play_personal_record", { content_type: "game", content_id: "starting_gun" });
      }
      persist();
      renderProgress();
      track("podium_play_game_completed", { content_type: "game", content_id: "starting_gun", result_band: String(gameScore) });

      const resultLine = `${Math.round(reactionMs)} milliseconds.`;
      const prLine = isNewPr ? "New personal record." : "Can you beat it?";
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

      stage.innerHTML = `
        <div class="pp-stage-head"><h3>Starting Gun</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
        <p class="pp-result${isNewPr && !reduceMotion ? " pp-result-celebrate" : ""}">${escapeHtml(resultLine)}</p>
        <p class="pp-pr">${escapeHtml(prLine)}${suspicious ? " (flagged for review before any public ranking)" : ""}</p>
        <p class="pp-score">Score: ${gameScore}${pointsEarned > 0 ? ` &middot; +${pointsEarned} Podium Points` : ""}</p>
        <button class="button button-primary pp-stage-action" type="button" data-pp-again>Try again</button>
      `;
      stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));
      stage.querySelector("[data-pp-again]").addEventListener("click", () => renderStartingGunIdle(stage, games));
      announce(`${resultLine} ${prLine}`);
    }

    function openHurdleDash() {
      const stage = panel.querySelector("[data-pp-stage]");
      const games = panel.querySelector("[data-pp-games]");
      if (!stage) return;
      games.hidden = true;
      stage.hidden = false;
      track("podium_play_game_started", { content_type: "game", content_id: "hurdle_dash" });
      renderHurdleDashIdle(stage, games);
    }

    function renderHurdleDashIdle(stage, games) {
      const hd = profile.hurdleDash;
      const prParts = [];
      if (hd.bestDistance !== null) prParts.push(`Best distance: ${hd.bestDistance}`);
      if (hd.bestHurdlesCleared !== null) prParts.push(`Most hurdles cleared: ${hd.bestHurdlesCleared}`);
      if (hd.bestGameScore !== null) prParts.push(`Best score: ${hd.bestGameScore}`);
      stage.innerHTML = `
        <div class="pp-stage-head"><h3>Hurdle Dash</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
        <p>Tap to jump. Clear as many hurdles as you can.</p>
        ${prParts.length ? `<p class="pp-pr">${escapeHtml(prParts.join(" · "))}</p>` : ""}
        <button class="button button-primary pp-stage-action" type="button" data-pp-run>Start Running</button>
        <div class="pp-game-leaderboard" data-pp-hd-distance-board hidden>
          <p class="pp-game-leaderboard-title">Best distances</p>
          <ol class="pp-leaderboard-list" data-pp-hd-distance-list></ol>
        </div>
      `;
      stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));
      stage.querySelector("[data-pp-run]").addEventListener("click", () => startHurdleDashRun(stage, games));
      loadHurdleDashDistanceLeaderboard(stage);
    }

    // Public, same as the main points leaderboard -- "who has the best/
    // furthest Hurdle Dash distance" (2026-09-01), a per-game record list
    // separate from overall points.
    async function loadHurdleDashDistanceLeaderboard(stage) {
      const section = stage.querySelector("[data-pp-hd-distance-board]");
      const list = stage.querySelector("[data-pp-hd-distance-list]");
      if (!section || !list) return;
      try {
        const response = await fetch("/api/podium-play/leaderboard-hurdle-dash/?limit=5");
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !Array.isArray(data.leaders) || data.leaders.length === 0) {
          section.hidden = true;
          return;
        }
        list.innerHTML = data.leaders.map((entry) => `<li><span class="pp-leaderboard-rank">#${entry.rank}</span><span class="pp-leaderboard-name">${escapeHtml(entry.displayName)}</span><span class="pp-leaderboard-points">${entry.distance}</span></li>`).join("");
        section.hidden = false;
      } catch {
        section.hidden = true;
      }
    }

    // The one-touch endless runner. Real elapsed-time physics (never a
    // fixed-frame-rate assumption), a fixed internal coordinate system
    // (see the HURDLE_DASH_* config above) so an on-screen resize never
    // has to touch game state, and every cleanup path -- Back mid-run,
    // voting again mid-run, or the run ending naturally -- goes through
    // the exact same cancelCurrentAttempt() the other two games use.
    function startHurdleDashRun(stage, games) {
      stage.innerHTML = `
        <div class="pp-stage-head"><h3>Hurdle Dash</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
        <div class="pp-hd-stats" aria-hidden="true"><span data-pp-hd-distance>Distance: 0</span><span data-pp-hd-hurdles>Hurdles: 0</span></div>
        <div class="pp-hd-wrap">
          <canvas class="pp-hurdle-canvas" data-pp-hd-canvas width="${HURDLE_DASH_WIDTH}" height="${HURDLE_DASH_HEIGHT}" role="img" aria-label="Hurdle Dash game surface"></canvas>
          <div class="pp-hd-overlay" data-pp-hd-overlay hidden></div>
        </div>
        <p class="pp-hd-hint">Tap the track, or press Space or Enter, to jump.</p>
      `;
      stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));

      const canvas = stage.querySelector("[data-pp-hd-canvas]");
      const ctx = canvas.getContext("2d");
      const overlay = stage.querySelector("[data-pp-hd-overlay]");
      const distanceEl = stage.querySelector("[data-pp-hd-distance]");
      const hurdlesEl = stage.querySelector("[data-pp-hd-hurdles]");

      let raf = null;
      let resumeTimer = null;
      let lastFrameTime = null;
      let elapsedTotal = 0;
      let distance = 0;
      let hurdlesCleared = 0;
      let trophiesCollected = 0;
      let jumpStartedAt = null; // elapsedTotal value the current jump began at, or null when grounded
      let hurdles = [];
      let trophies = [];
      let distanceToNextHurdle = HURDLE_DASH_FIRST_HURDLE_DELAY_SECONDS * HURDLE_DASH_INITIAL_SPEED;
      let paused = false;
      let ended = false;

      function runnerRect() {
        const offset = jumpStartedAt === null ? 0 : hurdleDashJumpOffset(elapsedTotal - jumpStartedAt);
        return { x: HURDLE_DASH_RUNNER_X, y: HURDLE_DASH_GROUND_Y - HURDLE_DASH_RUNNER_HEIGHT - offset, width: HURDLE_DASH_RUNNER_WIDTH, height: HURDLE_DASH_RUNNER_HEIGHT };
      }

      function attemptJump() {
        if (ended || paused || jumpStartedAt !== null) return; // no double jump
        jumpStartedAt = elapsedTotal;
      }

      function draw() {
        ctx.clearRect(0, 0, HURDLE_DASH_WIDTH, HURDLE_DASH_HEIGHT);
        ctx.strokeStyle = "#dedede";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, HURDLE_DASH_GROUND_Y + 1);
        ctx.lineTo(HURDLE_DASH_WIDTH, HURDLE_DASH_GROUND_Y + 1);
        ctx.stroke();

        ctx.fillStyle = "#0faf68";
        for (const trophy of trophies) {
          ctx.beginPath();
          ctx.arc(trophy.x + HURDLE_DASH_TROPHY_SIZE / 2, trophy.y + HURDLE_DASH_TROPHY_SIZE / 2, HURDLE_DASH_TROPHY_SIZE / 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = "#a22b2b";
        for (const hurdle of hurdles) {
          const y = HURDLE_DASH_GROUND_Y - HURDLE_DASH_HURDLE_HEIGHT;
          ctx.fillRect(hurdle.x + HURDLE_DASH_HURDLE_WIDTH * 0.35, y, HURDLE_DASH_HURDLE_WIDTH * 0.3, HURDLE_DASH_HURDLE_HEIGHT);
          ctx.fillRect(hurdle.x, y, HURDLE_DASH_HURDLE_WIDTH, 6);
        }

        const r = runnerRect();
        ctx.fillStyle = "#090909";
        ctx.fillRect(r.x, r.y + 14, r.width, r.height - 14);
        ctx.beginPath();
        ctx.arc(r.x + r.width / 2, r.y + 9, 9, 0, Math.PI * 2);
        ctx.fill();
      }

      function frame(now) {
        if (paused || ended) return;
        if (lastFrameTime === null) lastFrameTime = now;
        // Clamped so a delayed/backgrounded frame (or the instant after
        // the resume countdown ends) never causes a huge, unfair physics
        // jump -- distance and jump state advance as if no more than 50ms
        // ever passed in a single frame, however long it really took.
        const dt = Math.min(0.05, Math.max(0, (now - lastFrameTime) / 1000));
        lastFrameTime = now;
        elapsedTotal += dt;

        const speed = hurdleDashSpeedAtElapsed(elapsedTotal);
        const advance = speed * dt;
        distance += advance;
        distanceToNextHurdle -= advance;

        if (jumpStartedAt !== null && elapsedTotal - jumpStartedAt >= HURDLE_DASH_JUMP_DURATION_SECONDS) {
          jumpStartedAt = null;
        }

        for (const hurdle of hurdles) hurdle.x -= advance;
        for (const trophy of trophies) trophy.x -= advance;

        if (distanceToNextHurdle <= 0) {
          const gap = hurdleDashNextGap(speed);
          hurdles.push({ x: HURDLE_DASH_WIDTH, cleared: false });
          // A trophy roughly a third of the time, placed mid-gap so
          // collecting it is a bonus during the jump the player is
          // already making to clear the upcoming hurdle -- never a
          // separately-timed obstacle, and never requiring an otherwise
          // impossible jump.
          if (Math.random() < 0.35) {
            trophies.push({ x: HURDLE_DASH_WIDTH + gap / 2, y: HURDLE_DASH_GROUND_Y - HURDLE_DASH_RUNNER_HEIGHT - 6, collected: false });
          }
          distanceToNextHurdle = gap;
        }

        const runner = runnerRect();
        for (const hurdle of hurdles) {
          if (!hurdle.cleared && hurdle.x + HURDLE_DASH_HURDLE_WIDTH < runner.x) {
            hurdle.cleared = true;
            hurdlesCleared += 1;
          }
          const hurdleRect = { x: hurdle.x, y: HURDLE_DASH_GROUND_Y - HURDLE_DASH_HURDLE_HEIGHT, width: HURDLE_DASH_HURDLE_WIDTH, height: HURDLE_DASH_HURDLE_HEIGHT };
          if (rectsOverlap(runner, hurdleRect)) {
            endRun();
            return;
          }
        }
        for (const trophy of trophies) {
          if (trophy.collected) continue;
          const trophyRect = { x: trophy.x, y: trophy.y, width: HURDLE_DASH_TROPHY_SIZE, height: HURDLE_DASH_TROPHY_SIZE };
          if (rectsOverlap(runner, trophyRect)) {
            trophy.collected = true;
            trophiesCollected += 1;
          }
        }

        hurdles = hurdles.filter((h) => h.x + HURDLE_DASH_HURDLE_WIDTH > -20);
        trophies = trophies.filter((t) => !t.collected && t.x + HURDLE_DASH_TROPHY_SIZE > -20);

        distanceEl.textContent = `Distance: ${Math.round(distance)}`;
        hurdlesEl.textContent = `Hurdles: ${hurdlesCleared}`;

        draw();
        raf = requestAnimationFrame(frame);
      }

      function handlePointerDown(event) {
        event.preventDefault();
        attemptJump();
      }

      // A document-level listener (matching the spec's plain "Enter key
      // or Space key" requirement, not scoped to the canvas having focus)
      // -- but never hijacks Space/Enter while the visitor is actually
      // typing somewhere else on the page (the nomination form sits right
      // below this same panel).
      function handleKeydown(event) {
        const tag = event.target?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || event.target?.isContentEditable) return;
        if (event.code === "Space" || event.key === "Enter") {
          event.preventDefault();
          attemptJump();
        }
      }

      function pauseRun() {
        if (paused || ended) return;
        paused = true;
        lastFrameTime = null; // so dt doesn't include the paused duration once resumed
        if (raf) cancelAnimationFrame(raf);
        raf = null;
        if (resumeTimer) { clearInterval(resumeTimer); resumeTimer = null; }
        overlay.hidden = false;
        overlay.textContent = "Paused. Come back to this tab to continue.";
      }

      // A player must never return to the tab and be instantly hit by a
      // hurdle they had no chance to react to -- a real, visible 3-second
      // countdown always runs before play resumes.
      function beginResumeCountdown() {
        if (ended || !paused) return;
        let remaining = HURDLE_DASH_RESUME_COUNTDOWN_SECONDS;
        overlay.hidden = false;
        overlay.textContent = `Resuming in ${remaining}...`;
        resumeTimer = setInterval(() => {
          remaining -= 1;
          if (remaining <= 0) {
            clearInterval(resumeTimer);
            resumeTimer = null;
            overlay.hidden = true;
            paused = false;
            lastFrameTime = null;
            raf = requestAnimationFrame(frame);
          } else {
            overlay.textContent = `Resuming in ${remaining}...`;
          }
        }, 1000);
      }

      function handleVisibilityChange() {
        if (document.hidden) pauseRun();
        else if (paused) beginResumeCountdown();
      }

      canvas.addEventListener("pointerdown", handlePointerDown);
      document.addEventListener("keydown", handleKeydown);
      document.addEventListener("visibilitychange", handleVisibilityChange);

      // The single cleanup path, matching cancelCurrentAttempt()'s
      // contract -- called on Back mid-run, on voting again mid-run
      // (open() calls cancelCurrentAttempt() before rebuilding the
      // panel), and from endRun() below when the run ends naturally.
      currentAttempt = {
        cleanup: () => {
          ended = true;
          if (raf) cancelAnimationFrame(raf);
          if (resumeTimer) clearInterval(resumeTimer);
          canvas.removeEventListener("pointerdown", handlePointerDown);
          document.removeEventListener("keydown", handleKeydown);
          document.removeEventListener("visibilitychange", handleVisibilityChange);
        }
      };

      function endRun() {
        cancelCurrentAttempt();
        profile.hurdleDash.attempts += 1;
        submitToServer("hurdle_dash", { distance, hurdlesCleared, trophiesCollected });

        const roundedDistance = Math.round(distance);
        const gameScore = hurdleDashGameScore(roundedDistance, hurdlesCleared, trophiesCollected);
        const hd = profile.hurdleDash;
        const newDistancePr = hd.bestDistance === null || roundedDistance > hd.bestDistance;
        const newHurdlesPr = hd.bestHurdlesCleared === null || hurdlesCleared > hd.bestHurdlesCleared;
        const newScorePr = hd.bestGameScore === null || gameScore > hd.bestGameScore;
        if (newDistancePr) hd.bestDistance = roundedDistance;
        if (newHurdlesPr) hd.bestHurdlesCleared = hurdlesCleared;
        if (newScorePr) hd.bestGameScore = gameScore;
        const isNewPr = newDistancePr || newHurdlesPr || newScorePr;

        let pointsEarned = 0;
        if (!sessionAwardedFirstGame) {
          pointsEarned += awardPoints(profile, `first-game-${pageSessionKey}`, FIRST_GAME_IN_COOLDOWN_POINTS);
          sessionAwardedFirstGame = true;
        }
        pointsEarned += awardPoints(profile, `hurdle-dash-play-${Date.now()}`, participationPointsForPlay("hurdle_dash", { gameScore }));
        if (isNewPr) {
          pointsEarned += awardPoints(profile, `hurdle-dash-pr-${Date.now()}`, PERSONAL_RECORD_POINTS);
          track("podium_play_personal_record", { content_type: "game", content_id: "hurdle_dash" });
        }
        persist();
        renderProgress();
        track("podium_play_game_completed", { content_type: "game", content_id: "hurdle_dash", result_band: String(gameScore) });

        const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        const resultLine = `${roundedDistance} distance, ${hurdlesCleared} hurdle${hurdlesCleared === 1 ? "" : "s"} cleared${trophiesCollected > 0 ? `, ${trophiesCollected} troph${trophiesCollected === 1 ? "y" : "ies"}` : ""}.`;
        const prLine = isNewPr ? "New personal record." : "Can you beat it?";

        stage.innerHTML = `
          <div class="pp-stage-head"><h3>Hurdle Dash</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
          <p class="pp-result${isNewPr && !reduceMotion ? " pp-result-celebrate" : ""}">${escapeHtml(resultLine)}</p>
          <p class="pp-pr">${escapeHtml(prLine)}</p>
          <p class="pp-score">Score: ${gameScore}${pointsEarned > 0 ? ` &middot; +${pointsEarned} Podium Points` : ""}</p>
          <button class="button button-primary pp-stage-action" type="button" data-pp-again>Run again</button>
        `;
        stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));
        stage.querySelector("[data-pp-again]").addEventListener("click", () => renderHurdleDashIdle(stage, games));
        announce(`${resultLine} ${prLine}`);
      }

      draw();
      raf = requestAnimationFrame(frame);
    }

    function openTapSprint() {
      const stage = panel.querySelector("[data-pp-stage]");
      const games = panel.querySelector("[data-pp-games]");
      if (!stage) return;
      games.hidden = true;
      stage.hidden = false;
      track("podium_play_game_started", { content_type: "game", content_id: "tap_sprint" });
      renderTapSprintIdle(stage, games);
    }

    function renderTapSprintIdle(stage, games) {
      const best = profile.tapSprint.bestDistance;
      stage.innerHTML = `
        <div class="pp-stage-head"><h3>Tap Sprint</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
        <p>Alternate tapping Left and Right as fast as you can for 10 seconds.</p>
        ${best !== null ? `<p class="pp-pr">Best distance: ${best}</p>` : ""}
        <button class="button button-primary pp-stage-action" type="button" data-pp-ts-start>Start</button>
      `;
      stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));
      stage.querySelector("[data-pp-ts-start]").addEventListener("click", () => startTapSprintRun(stage, games));
    }

    function startTapSprintRun(stage, games) {
      stage.innerHTML = `
        <div class="pp-stage-head"><h3>Tap Sprint</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
        <div class="pp-ts-stats" aria-hidden="true"><span data-pp-ts-time>Time: 10.0</span><span data-pp-ts-distance>Distance: 0</span><span data-pp-ts-taps>Taps: 0</span></div>
        <div class="pp-track"><div class="pp-ts-runner" data-pp-ts-runner></div></div>
        <div class="pp-ts-buttons">
          <button class="pp-ts-button" type="button" data-pp-ts-tap="left" aria-label="Tap left">LEFT</button>
          <button class="pp-ts-button" type="button" data-pp-ts-tap="right" aria-label="Tap right">RIGHT</button>
        </div>
      `;
      stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));

      const timeEl = stage.querySelector("[data-pp-ts-time]");
      const distanceEl = stage.querySelector("[data-pp-ts-distance]");
      const tapsEl = stage.querySelector("[data-pp-ts-taps]");
      const runnerEl = stage.querySelector("[data-pp-ts-runner]");
      const leftButton = stage.querySelector('[data-pp-ts-tap="left"]');
      const rightButton = stage.querySelector('[data-pp-ts-tap="right"]');

      let taps = 0;
      // Two SEPARATE trackers, deliberately: lastPhysicalButton always
      // reflects the real last button pressed (even a rejected one) so a
      // rapid-fire spam on ONE button can never be "primed" into counting
      // by a rejected opposite-button tap sneaking the state machine
      // forward; lastCountedTapAt only advances on a tap that actually
      // scored, so the rate limit caps genuine alternation at the same
      // real ceiling it caps everything else at.
      let lastPhysicalButton = null;
      let lastCountedTapAt = -Infinity;
      const startedAt = performance.now();
      let raf = null;
      let ended = false;

      function attemptTap(button) {
        if (ended) return;
        const { counts: alternates } = tapSprintRegisterTap(lastPhysicalButton, button);
        lastPhysicalButton = button;
        if (!alternates) return;
        const now = performance.now();
        if (tapSprintTapIsRateLimited(now - lastCountedTapAt)) return;
        lastCountedTapAt = now;
        taps += 1;
        const distance = tapSprintDistanceForTaps(taps);
        distanceEl.textContent = `Distance: ${Math.round(distance)}`;
        tapsEl.textContent = `Taps: ${taps}`;
        runnerEl.style.left = `${Math.min(100, (distance / TAP_SPRINT_TRACK_DISTANCE) * 100)}%`;
      }

      function handlePointerDown(event) {
        event.preventDefault();
        attemptTap(event.currentTarget.dataset.ppTsTap);
      }
      leftButton.addEventListener("pointerdown", handlePointerDown);
      rightButton.addEventListener("pointerdown", handlePointerDown);

      // event.repeat is the real, standard signal a keydown was generated
      // by the OS auto-repeating a HELD key, not a fresh press -- the
      // exact "keyboard repeat" the spec asks to guard against.
      function handleKeydown(event) {
        if (event.repeat) return;
        const tag = event.target?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || event.target?.isContentEditable) return;
        if (event.code === "ArrowLeft") { event.preventDefault(); attemptTap("left"); }
        else if (event.code === "ArrowRight") { event.preventDefault(); attemptTap("right"); }
      }
      document.addEventListener("keydown", handleKeydown);

      currentAttempt = {
        cleanup: () => {
          ended = true;
          if (raf) cancelAnimationFrame(raf);
          leftButton.removeEventListener("pointerdown", handlePointerDown);
          rightButton.removeEventListener("pointerdown", handlePointerDown);
          document.removeEventListener("keydown", handleKeydown);
        }
      };

      function frame() {
        if (ended) return;
        const elapsed = (performance.now() - startedAt) / 1000;
        const remaining = Math.max(0, TAP_SPRINT_DURATION_SECONDS - elapsed);
        timeEl.textContent = `Time: ${remaining.toFixed(1)}`;
        if (remaining <= 0) {
          endRun();
          return;
        }
        raf = requestAnimationFrame(frame);
      }

      function endRun() {
        cancelCurrentAttempt();
        profile.tapSprint.attempts += 1;
        submitToServer("tap_sprint", { taps });

        const finalDistance = Math.round(tapSprintDistanceForTaps(taps));
        const priorBest = profile.tapSprint.bestDistance;
        const isNewPr = priorBest === null || finalDistance > priorBest;
        if (isNewPr) profile.tapSprint.bestDistance = finalDistance;

        let pointsEarned = 0;
        if (!sessionAwardedFirstGame) {
          pointsEarned += awardPoints(profile, `first-game-${pageSessionKey}`, FIRST_GAME_IN_COOLDOWN_POINTS);
          sessionAwardedFirstGame = true;
        }
        pointsEarned += awardPoints(profile, `tap-sprint-play-${Date.now()}`, participationPointsForPlay("tap_sprint", { gameScore: finalDistance }));
        if (isNewPr) {
          pointsEarned += awardPoints(profile, `tap-sprint-pr-${Date.now()}`, PERSONAL_RECORD_POINTS);
          track("podium_play_personal_record", { content_type: "game", content_id: "tap_sprint" });
        }
        persist();
        renderProgress();
        track("podium_play_game_completed", { content_type: "game", content_id: "tap_sprint", result_band: String(finalDistance) });

        const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        const resultLine = `${finalDistance} distance, ${taps} tap${taps === 1 ? "" : "s"}.`;
        const prLine = isNewPr ? "New personal record." : "Can you beat it?";

        stage.innerHTML = `
          <div class="pp-stage-head"><h3>Tap Sprint</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
          <p class="pp-result${isNewPr && !reduceMotion ? " pp-result-celebrate" : ""}">${escapeHtml(resultLine)}</p>
          <p class="pp-pr">${escapeHtml(prLine)}</p>
          ${pointsEarned > 0 ? `<p class="pp-score">+${pointsEarned} Podium Points</p>` : ""}
          <button class="button button-primary pp-stage-action" type="button" data-pp-again>Sprint again</button>
        `;
        stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));
        stage.querySelector("[data-pp-again]").addEventListener("click", () => renderTapSprintIdle(stage, games));
        announce(`${resultLine} ${prLine}`);
      }

      raf = requestAnimationFrame(frame);
    }

    function openBeatTheRunner() {
      const stage = panel.querySelector("[data-pp-stage]");
      const games = panel.querySelector("[data-pp-games]");
      if (!stage) return;
      games.hidden = true;
      stage.hidden = false;
      track("podium_play_game_started", { content_type: "game", content_id: "beat_the_runner" });
      renderBeatTheRunnerIdle(stage, games);
    }

    function renderBeatTheRunnerIdle(stage, games) {
      const best = profile.beatTheRunner.bestRoundReached;
      const bestName = best ? BEAT_THE_RUNNER_ROUNDS[best - 1]?.name : "";
      stage.innerHTML = `
        <div class="pp-stage-head"><h3>Beat the Runner</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
        <p>Tap fast enough to catch the runner before the finish line. Each round gets harder.</p>
        ${best ? `<p class="pp-pr">Best: Round ${best}${bestName ? ` (${escapeHtml(bestName)})` : ""}</p>` : ""}
        <button class="button button-primary pp-stage-action" type="button" data-pp-btr-start>Start</button>
      `;
      stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));
      stage.querySelector("[data-pp-btr-start]").addEventListener("click", () => startBeatTheRunnerGame(stage, games));
    }

    // A multi-round game -- one shared cleanup (currentAttempt.cleanup)
    // set once, but the listeners it tears down belong to whichever
    // round is currently active (teardownRoundListeners, reassigned by
    // renderRoundStage() each round) -- the closure below reads that
    // variable's CURRENT value at cleanup time, not a stale snapshot from
    // when the game started, so Back always tears down the real active
    // round regardless of which one it is.
    function startBeatTheRunnerGame(stage, games) {
      let roundIndex = 0;
      let runnersDefeated = 0;
      let newPrThisRun = false;
      let ended = false;
      let raf = null;
      let lastCountedTapAt = -Infinity; // shared across rounds -- the rate-limit floor applies to the whole game, not reset per round
      let teardownRoundListeners = null;

      currentAttempt = {
        cleanup: () => {
          ended = true;
          if (raf) cancelAnimationFrame(raf);
          teardownRoundListeners?.();
        }
      };

      function renderRoundStage() {
        const round = BEAT_THE_RUNNER_ROUNDS[roundIndex];
        const target = beatTheRunnerRoundTarget(roundIndex);
        stage.innerHTML = `
          <div class="pp-stage-head"><h3>Beat the Runner</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
          <p class="pp-btr-round">Round ${roundIndex + 1}: ${escapeHtml(round.name)}</p>
          <div class="pp-btr-stats" aria-hidden="true"><span data-pp-btr-time>Time: ${(target.timeMs / 1000).toFixed(1)}s</span><span data-pp-btr-taps>Taps: 0/${target.tapsNeeded}</span></div>
          <div class="pp-btr-track">
            <div class="pp-btr-lane"><span class="pp-btr-lane-label">You</span><div class="pp-btr-runner pp-btr-runner-player" data-pp-btr-player></div></div>
            <div class="pp-btr-lane"><span class="pp-btr-lane-label">${escapeHtml(round.name)}</span><div class="pp-btr-runner pp-btr-runner-cpu" data-pp-btr-cpu></div></div>
          </div>
          <button class="button button-primary pp-stage-action" type="button" data-pp-btr-tap>TAP</button>
        `;
        stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));

        const timeEl = stage.querySelector("[data-pp-btr-time]");
        const tapsEl = stage.querySelector("[data-pp-btr-taps]");
        const playerEl = stage.querySelector("[data-pp-btr-player]");
        const cpuEl = stage.querySelector("[data-pp-btr-cpu]");
        const tapButton = stage.querySelector("[data-pp-btr-tap]");

        let taps = 0;
        const startedAt = performance.now();

        function attemptTap() {
          if (ended) return;
          const now = performance.now();
          // Reuses the exact same real rate-limit floor Tap Sprint uses --
          // "quickly enough to catch the runner" still needs a bound on
          // how fast a single button can be spammed for the difficulty
          // curve above to mean anything real.
          if (tapSprintTapIsRateLimited(now - lastCountedTapAt)) return;
          lastCountedTapAt = now;
          taps += 1;
          tapsEl.textContent = `Taps: ${taps}/${target.tapsNeeded}`;
          playerEl.style.left = `${Math.min(100, (taps / target.tapsNeeded) * 100)}%`;
          if (taps >= target.tapsNeeded) winRound();
        }

        function handlePointerDown(event) { event.preventDefault(); attemptTap(); }
        function handleKeydown(event) {
          if (event.repeat) return;
          const tag = event.target?.tagName;
          if (tag === "INPUT" || tag === "TEXTAREA" || event.target?.isContentEditable) return;
          if (event.code === "Space" || event.key === "Enter") { event.preventDefault(); attemptTap(); }
        }
        tapButton.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("keydown", handleKeydown);
        teardownRoundListeners = () => {
          tapButton.removeEventListener("pointerdown", handlePointerDown);
          document.removeEventListener("keydown", handleKeydown);
        };

        function frame() {
          if (ended) return;
          const elapsed = performance.now() - startedAt;
          const remaining = Math.max(0, target.timeMs - elapsed);
          timeEl.textContent = `Time: ${(remaining / 1000).toFixed(1)}s`;
          cpuEl.style.left = `${Math.min(100, (elapsed / target.timeMs) * 100)}%`;
          if (remaining <= 0) { endGame(); return; }
          raf = requestAnimationFrame(frame);
        }

        function winRound() {
          if (raf) cancelAnimationFrame(raf);
          teardownRoundListeners?.();
          runnersDefeated += 1;
          const completedRoundNumber = roundIndex + 1;
          if (profile.beatTheRunner.bestRoundReached === null || completedRoundNumber > profile.beatTheRunner.bestRoundReached) {
            profile.beatTheRunner.bestRoundReached = completedRoundNumber;
            newPrThisRun = true;
          }
          if (completedRoundNumber >= BEAT_THE_RUNNER_ROUNDS.length) { endGame(); return; }

          stage.innerHTML = `<div class="pp-stage-head"><h3>Beat the Runner</h3></div><p class="pp-result">You caught the ${escapeHtml(round.name)}!</p><p class="pp-pr">Next: ${escapeHtml(BEAT_THE_RUNNER_ROUNDS[roundIndex + 1].name)}</p>`;
          announce(`You caught the ${round.name}. Next round starting.`);
          setTimeout(() => {
            if (ended) return;
            roundIndex += 1;
            renderRoundStage();
          }, 1800);
        }

        raf = requestAnimationFrame(frame);
      }

      function endGame() {
        cancelCurrentAttempt();
        profile.beatTheRunner.attempts += 1;
        submitToServer("beat_the_runner", { highestRoundCompleted: runnersDefeated });

        let pointsEarned = 0;
        if (!sessionAwardedFirstGame) {
          pointsEarned += awardPoints(profile, `first-game-${pageSessionKey}`, FIRST_GAME_IN_COOLDOWN_POINTS);
          sessionAwardedFirstGame = true;
        }
        pointsEarned += awardPoints(profile, `beat-the-runner-play-${Date.now()}`, participationPointsForPlay("beat_the_runner", { gameScore: runnersDefeated }));
        if (newPrThisRun) {
          pointsEarned += awardPoints(profile, `beat-the-runner-pr-${Date.now()}`, PERSONAL_RECORD_POINTS);
          track("podium_play_personal_record", { content_type: "game", content_id: "beat_the_runner" });
        }
        persist();
        renderProgress();
        track("podium_play_game_completed", { content_type: "game", content_id: "beat_the_runner", result_band: String(runnersDefeated) });

        const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        const wonEverything = runnersDefeated >= BEAT_THE_RUNNER_ROUNDS.length;
        const highestRoundReached = Math.min(roundIndex + 1, BEAT_THE_RUNNER_ROUNDS.length);
        // A plain (unescaped) version for the aria-live announcement --
        // .textContent never decodes HTML entities, so passing an
        // escapeHtml()'d string there would risk reading out literal
        // entity codes instead of the real character. Built from the
        // same underlying values as the HTML version below, just never
        // escaped, since .textContent needs no escaping in the first place.
        const resultLinePlain = wonEverything
          ? `You defeated every runner, all the way to ${BEAT_THE_RUNNER_ROUNDS[BEAT_THE_RUNNER_ROUNDS.length - 1].name}!`
          : `Reached Round ${highestRoundReached}, ${runnersDefeated} runner${runnersDefeated === 1 ? "" : "s"} defeated.`;
        const resultLine = wonEverything
          ? `You defeated every runner, all the way to ${escapeHtml(BEAT_THE_RUNNER_ROUNDS[BEAT_THE_RUNNER_ROUNDS.length - 1].name)}!`
          : `Reached Round ${highestRoundReached}, ${runnersDefeated} runner${runnersDefeated === 1 ? "" : "s"} defeated.`;
        const prLine = newPrThisRun ? "New personal record." : "Can you beat it?";

        stage.innerHTML = `
          <div class="pp-stage-head"><h3>Beat the Runner</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
          <p class="pp-result${newPrThisRun && !reduceMotion ? " pp-result-celebrate" : ""}">${resultLine}</p>
          <p class="pp-pr">${escapeHtml(prLine)}</p>
          ${pointsEarned > 0 ? `<p class="pp-score">+${pointsEarned} Podium Points</p>` : ""}
          <button class="button button-primary pp-stage-action" type="button" data-pp-again>Race again</button>
        `;
        stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));
        stage.querySelector("[data-pp-again]").addEventListener("click", () => renderBeatTheRunnerIdle(stage, games));
        announce(`${resultLinePlain} ${prLine}`);
      }

      renderRoundStage();
    }

    const MEMORY_MATCH_SYMBOL_NAMES = { "👟": "running shoes", "🏆": "trophy", "⏱️": "stopwatch", "🥇": "medal", "🏁": "checkered flag", "PW": "Podium Watch logo" };

    function openMemoryMatch() {
      const stage = panel.querySelector("[data-pp-stage]");
      const games = panel.querySelector("[data-pp-games]");
      if (!stage) return;
      games.hidden = true;
      stage.hidden = false;
      track("podium_play_game_started", { content_type: "game", content_id: "memory_match" });
      renderMemoryMatchIdle(stage, games);
    }

    function renderMemoryMatchIdle(stage, games) {
      const mm = profile.memoryMatch;
      const prParts = [];
      if (mm.bestTimeMs !== null) prParts.push(`Best time: ${(mm.bestTimeMs / 1000).toFixed(1)}s`);
      if (mm.fewestMoves !== null) prParts.push(`Fewest moves: ${mm.fewestMoves}`);
      stage.innerHTML = `
        <div class="pp-stage-head"><h3>Memory Match</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
        <p>Find all 3 matching pairs as fast as you can.</p>
        ${prParts.length ? `<p class="pp-pr">${escapeHtml(prParts.join(" · "))}</p>` : ""}
        <button class="button button-primary pp-stage-action" type="button" data-pp-mm-start>Start</button>
      `;
      stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));
      stage.querySelector("[data-pp-mm-start]").addEventListener("click", () => startMemoryMatchGame(stage, games));
    }

    function startMemoryMatchGame(stage, games) {
      const board = memoryMatchNewBoard();
      stage.innerHTML = `
        <div class="pp-stage-head"><h3>Memory Match</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
        <div class="pp-mm-stats" aria-hidden="true"><span data-pp-mm-time>Time: 0.0</span><span data-pp-mm-moves>Moves: 0</span></div>
        <div class="pp-mm-board" data-pp-mm-board>
          ${board.map((_, i) => `<button class="pp-mm-card" type="button" data-pp-mm-card="${i}"></button>`).join("")}
        </div>
      `;
      stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));

      const timeEl = stage.querySelector("[data-pp-mm-time]");
      const movesEl = stage.querySelector("[data-pp-mm-moves]");
      const cardButtons = Array.from(stage.querySelectorAll("[data-pp-mm-card]"));

      let moves = 0;
      let matchedPairs = 0;
      let revealed = []; // indices currently face-up and not yet resolved, max 2
      let checking = false; // true while 2 cards are being compared -- locks further taps, per spec
      const startedAt = performance.now();
      let raf = null;
      let ended = false;
      let mismatchTimer = null;

      function renderCard(index) {
        const card = board[index];
        const button = cardButtons[index];
        const faceUp = card.matched || revealed.includes(index);
        button.textContent = faceUp ? card.symbol : "";
        button.classList.toggle("pp-mm-card-up", faceUp);
        button.classList.toggle("pp-mm-card-matched", card.matched);
        button.disabled = card.matched;
        const symbolName = MEMORY_MATCH_SYMBOL_NAMES[card.symbol] || card.symbol;
        button.setAttribute("aria-label", faceUp ? `Card ${index + 1}, ${symbolName}${card.matched ? ", matched" : ""}` : `Card ${index + 1}, face down`);
      }
      cardButtons.forEach((_, i) => renderCard(i));

      function handleCardClick(index) {
        if (ended || checking) return;
        if (board[index].matched || revealed.includes(index)) return;
        revealed.push(index);
        renderCard(index);
        if (revealed.length < 2) return;

        checking = true;
        moves += 1;
        movesEl.textContent = `Moves: ${moves}`;

        const [a, b] = revealed;
        if (board[a].symbol === board[b].symbol) {
          board[a].matched = true;
          board[b].matched = true;
          matchedPairs += 1;
          revealed = [];
          renderCard(a);
          renderCard(b);
          checking = false;
          if (matchedPairs >= MEMORY_MATCH_PAIR_COUNT) endGame();
        } else {
          mismatchTimer = setTimeout(() => {
            revealed = [];
            renderCard(a);
            renderCard(b);
            checking = false;
          }, MEMORY_MATCH_MISMATCH_DELAY_MS);
        }
      }

      cardButtons.forEach((button, i) => button.addEventListener("click", () => handleCardClick(i)));

      currentAttempt = {
        cleanup: () => {
          ended = true;
          if (raf) cancelAnimationFrame(raf);
          if (mismatchTimer) clearTimeout(mismatchTimer);
        }
      };

      function frame() {
        if (ended) return;
        const elapsed = (performance.now() - startedAt) / 1000;
        timeEl.textContent = `Time: ${elapsed.toFixed(1)}`;
        raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);

      function endGame() {
        cancelCurrentAttempt();
        profile.memoryMatch.attempts += 1;
        const elapsedMs = Math.round(performance.now() - startedAt);
        submitToServer("memory_match", { timeMs: elapsedMs, moves });

        const priorBestTime = profile.memoryMatch.bestTimeMs;
        const priorFewestMoves = profile.memoryMatch.fewestMoves;
        const isNewTimePr = priorBestTime === null || elapsedMs < priorBestTime;
        const isNewMovesPr = priorFewestMoves === null || moves < priorFewestMoves;
        if (isNewTimePr) profile.memoryMatch.bestTimeMs = elapsedMs;
        if (isNewMovesPr) profile.memoryMatch.fewestMoves = moves;
        const isNewPr = isNewTimePr || isNewMovesPr;

        let pointsEarned = 0;
        if (!sessionAwardedFirstGame) {
          pointsEarned += awardPoints(profile, `first-game-${pageSessionKey}`, FIRST_GAME_IN_COOLDOWN_POINTS);
          sessionAwardedFirstGame = true;
        }
        pointsEarned += awardPoints(profile, `memory-match-play-${Date.now()}`, participationPointsForPlay("memory_match", { gameScore: elapsedMs }));
        if (isNewPr) {
          pointsEarned += awardPoints(profile, `memory-match-pr-${Date.now()}`, PERSONAL_RECORD_POINTS);
          track("podium_play_personal_record", { content_type: "game", content_id: "memory_match" });
        }
        persist();
        renderProgress();
        track("podium_play_game_completed", { content_type: "game", content_id: "memory_match", result_band: String(elapsedMs) });

        const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        const resultLine = `${(elapsedMs / 1000).toFixed(1)}s, ${moves} move${moves === 1 ? "" : "s"}.`;
        const prLine = isNewPr ? "New personal record." : "Can you beat it?";

        stage.innerHTML = `
          <div class="pp-stage-head"><h3>Memory Match</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
          <p class="pp-result${isNewPr && !reduceMotion ? " pp-result-celebrate" : ""}">${escapeHtml(resultLine)}</p>
          <p class="pp-pr">${escapeHtml(prLine)}</p>
          ${pointsEarned > 0 ? `<p class="pp-score">+${pointsEarned} Podium Points</p>` : ""}
          <button class="button button-primary pp-stage-action" type="button" data-pp-again>Play again</button>
        `;
        stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));
        stage.querySelector("[data-pp-again]").addEventListener("click", () => renderMemoryMatchIdle(stage, games));
        announce(`${resultLine} ${prLine}`);
      }
    }

    // A pure parametric point on a "stadium" (rounded-rectangle) shaped
    // lane -- two straight segments joined by two semicircle arcs, the
    // same real shape a running track uses. progress is 0..1 around the
    // full perimeter, starting at the left end of the top straight and
    // moving clockwise. Coordinates are relative to the lane's own
    // center (0,0); the caller offsets them onto the actual track
    // element. Pure and DOM-free so it's directly testable.
    function relayStadiumPoint(progress, halfWidth, halfHeight) {
      const straight = halfWidth * 2;
      const radius = halfHeight;
      const arcLength = Math.PI * radius;
      const perimeter = 2 * straight + 2 * arcLength;
      let d = (((progress % 1) + 1) % 1) * perimeter;
      if (d <= straight) return { x: -halfWidth + d, y: -halfHeight };
      d -= straight;
      if (d <= arcLength) {
        const angle = -Math.PI / 2 + d / radius;
        return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
      }
      d -= arcLength;
      if (d <= straight) return { x: halfWidth - d, y: halfHeight };
      d -= straight;
      const angle = Math.PI / 2 + d / radius;
      return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
    }

    function openRelayExchange() {
      const stage = panel.querySelector("[data-pp-stage]");
      const games = panel.querySelector("[data-pp-games]");
      if (!stage) return;
      games.hidden = true;
      stage.hidden = false;
      track("podium_play_game_started", { content_type: "game", content_id: "relay_exchange" });
      renderRelayExchangeIdle(stage, games);
    }

    function renderRelayExchangeIdle(stage, games) {
      const re = profile.relayExchange;
      const prParts = [];
      if (re.bestTimeMs !== null) prParts.push(`Fastest: ${(re.bestTimeMs / 1000).toFixed(2)}s`);
      if (re.bestPerfectExchanges !== null) prParts.push(`Best perfect exchanges: ${re.bestPerfectExchanges}/3`);
      stage.innerHTML = `
        <div class="pp-stage-head"><h3>Relay Exchange</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
        <p>Race a 4x400 relay. Tap Start Runner as the incoming runner arrives, then Pass Baton to complete the handoff -- three times.</p>
        ${prParts.length ? `<p class="pp-pr">${escapeHtml(prParts.join(" · "))}</p>` : ""}
        <button class="button button-primary pp-stage-action" type="button" data-pp-relay-start>Start Race</button>
      `;
      stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));
      stage.querySelector("[data-pp-relay-start]").addEventListener("click", () => startRelayExchangeRace(stage, games));
    }

    const RELAY_EXCHANGE_PASS_OFFSET_MS = 1300; // ideal pass moment, measured from the ACTUAL Start tap
    const RELAY_EXCHANGE_INPUT_LOCK_MS = 220; // brief lock after Start so one tap can never also register as Pass
    const RELAY_TEAM_NAMES = ["You", "Rival A", "Rival B"];

    function startRelayExchangeRace(stage, games) {
      stage.innerHTML = `
        <div class="pp-stage-head"><h3>Relay Exchange</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
        <div class="pp-relay-stats" aria-hidden="true">
          <span data-pp-relay-leg>Leg 1 of 4</span>
          <span data-pp-relay-place>--</span>
          <span data-pp-relay-time>0.0s</span>
        </div>
        <svg class="pp-relay-track" data-pp-relay-track viewBox="0 0 300 160" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Relay track">
          <path class="pp-relay-track-outline" d="M80,30 L220,30 A50,50 0 0 1 220,130 L80,130 A50,50 0 0 1 80,30" fill="none"></path>
          <rect class="pp-relay-exchange-marker" x="78" y="14" width="4" height="34"></rect>
          <circle class="pp-relay-runner pp-relay-runner-cpu" data-pp-relay-runner="1" r="9" cx="150" cy="16"></circle>
          <circle class="pp-relay-runner pp-relay-runner-cpu" data-pp-relay-runner="2" r="9" cx="150" cy="16"></circle>
          <circle class="pp-relay-runner pp-relay-runner-player" data-pp-relay-runner="0" r="11" cx="150" cy="44"></circle>
        </svg>
        <p class="pp-relay-action-label" data-pp-relay-action-label>Get ready...</p>
        <button class="button button-primary pp-stage-action" type="button" data-pp-relay-action disabled>Start Runner</button>
      `;
      stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));

      const legEl = stage.querySelector("[data-pp-relay-leg]");
      const placeEl = stage.querySelector("[data-pp-relay-place]");
      const timeEl = stage.querySelector("[data-pp-relay-time]");
      const trackEl = stage.querySelector("[data-pp-relay-track]");
      const actionLabelEl = stage.querySelector("[data-pp-relay-action-label]");
      const actionButton = stage.querySelector("[data-pp-relay-action]");
      const runnerEls = [0, 1, 2].map((i) => stage.querySelector(`[data-pp-relay-runner="${i}"]`));

      const raceStartedAt = performance.now();
      let ended = false;
      let raf = null;

      // Every CPU leg duration is decided right now, before the race
      // even visually starts -- so a CPU team can never teleport, change
      // its result after the finish, or become impossible without
      // warning (per spec). Player legs 2-4 are only pinned down as each
      // real exchange resolves.
      const cpuLegDurations = [1, 2].map(() => [0, 1, 2, 3].map(() => relayCpuLegDurationMs()));
      const cpuLegStarts = [1, 2].map((cpuIndex) => {
        const starts = [0];
        for (let leg = 1; leg < 4; leg += 1) starts.push(starts[leg - 1] + cpuLegDurations[cpuIndex - 1][leg - 1]);
        return starts;
      });

      const startErrorsMs = [];
      const passErrorsMs = [];
      const playerLegDurations = [RELAY_EXCHANGE_LEG_DURATION_MS];
      let exchangeIndex = 0; // 0, 1, 2 -- three exchanges
      let phase = "leg_running"; // leg_running -> start_available -> pass_available -> (resolve) -> next leg
      let idealStartAt = raceStartedAt + RELAY_EXCHANGE_LEG_DURATION_MS;
      let idealPassAt = null;
      let inputLockedUntil = 0;
      let passWindowEndsAt = null;

      function playerElapsedMs(now) {
        const completedLegs = playerLegDurations.slice(0, exchangeIndex).reduce((sum, ms) => sum + ms, 0);
        return completedLegs + Math.min(now - raceStartedAt - completedLegs, playerLegDurations[exchangeIndex] ?? RELAY_EXCHANGE_LEG_DURATION_MS);
      }

      function updateActionUi() {
        if (phase === "start_available") {
          actionButton.disabled = false;
          actionButton.textContent = "Start Runner";
          actionLabelEl.textContent = "Tap Start Runner as the incoming runner arrives!";
        } else if (phase === "pass_locked" || phase === "pass_available") {
          actionButton.disabled = phase === "pass_locked";
          actionButton.textContent = "Pass Baton";
          actionLabelEl.textContent = phase === "pass_locked" ? "Baton coming up to speed..." : "Tap Pass Baton to complete the handoff!";
        } else {
          actionButton.disabled = true;
          actionButton.textContent = exchangeIndex === 0 ? "Start Runner" : "Pass Baton";
          actionLabelEl.textContent = "Runner is on the way around...";
        }
      }
      updateActionUi();

      function resolveExchange(startErrorMs, passErrorMs) {
        startErrorsMs.push(startErrorMs);
        passErrorsMs.push(passErrorMs);
        const startBand = relayStartBand(startErrorMs);
        const passBand = relayPassBand(passErrorMs);
        const startAdjustmentMs = { perfect: -150, great: -60, good: 0, early_late: 120, very_off: 400 }[startBand] ?? 0;
        const passAdjustmentMs = { perfect: -250, great: -100, safe: 0, late: 150, missed: 600 }[passBand] ?? 0;
        const nextLegDuration = Math.max(1200, RELAY_EXCHANGE_LEG_DURATION_MS + startAdjustmentMs + passAdjustmentMs);
        playerLegDurations.push(nextLegDuration);
        exchangeIndex += 1;
        trackEl.classList.remove("pp-relay-track-zoomed");
        if (exchangeIndex >= 3) { finishRace(); return; }
        phase = "leg_running";
        idealStartAt = raceStartedAt + playerLegDurations.slice(0, exchangeIndex + 1).reduce((sum, ms) => sum + ms, 0);
        idealPassAt = null;
        passWindowEndsAt = null;
        updateActionUi();
      }

      function handleAction() {
        if (ended) return;
        const now = performance.now();
        if (now < inputLockedUntil) return;
        if (phase === "start_available") {
          const startErrorMs = now - idealStartAt;
          idealPassAt = now + RELAY_EXCHANGE_PASS_OFFSET_MS;
          passWindowEndsAt = now + RELAY_EXCHANGE_PASS_OFFSET_MS + RELAY_EXCHANGE_PASS_WINDOW_MS;
          inputLockedUntil = now + RELAY_EXCHANGE_INPUT_LOCK_MS;
          phase = "pass_locked";
          stage.dataset.relayPendingStartError = String(startErrorMs);
          setTimeout(() => { if (!ended && phase === "pass_locked") { phase = "pass_available"; updateActionUi(); } }, RELAY_EXCHANGE_INPUT_LOCK_MS);
          updateActionUi();
        } else if (phase === "pass_available") {
          const passErrorMs = now - idealPassAt;
          const startErrorMs = Number(stage.dataset.relayPendingStartError);
          phase = "resolving";
          updateActionUi();
          resolveExchange(startErrorMs, passErrorMs);
        }
      }

      function handlePointerDown(event) { event.preventDefault(); handleAction(); }
      function handleKeydown(event) {
        if (event.repeat) return;
        const tag = event.target?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || event.target?.isContentEditable) return;
        if (event.code === "Space" || event.key === "Enter") { event.preventDefault(); handleAction(); }
      }
      actionButton.addEventListener("pointerdown", handlePointerDown);
      document.addEventListener("keydown", handleKeydown);

      currentAttempt = {
        cleanup: () => {
          ended = true;
          if (raf) cancelAnimationFrame(raf);
          actionButton.removeEventListener("pointerdown", handlePointerDown);
          document.removeEventListener("keydown", handleKeydown);
        }
      };

      function finishRace() {
        const { score: gameScore, perfectCombos } = relayExchangeGameScore(startErrorsMs, passErrorsMs, 1);
        const playerTotalMs = playerLegDurations.reduce((sum, ms) => sum + ms, 0);
        const cpuTotals = cpuLegDurations.map((legs) => legs.reduce((sum, ms) => sum + ms, 0));
        const allTimes = [playerTotalMs, ...cpuTotals];
        const place = 1 + allTimes.filter((t) => t < playerTotalMs).length;
        endRace(playerTotalMs, place, perfectCombos, gameScore);
      }

      function frame() {
        if (ended) return;
        const now = performance.now();

        if (phase === "leg_running" && now >= idealStartAt - RELAY_EXCHANGE_START_WINDOW_MS) {
          phase = "start_available";
          updateActionUi();
        }
        if (phase === "pass_available" && passWindowEndsAt !== null && now >= passWindowEndsAt) {
          // No Pass Baton tap arrived in time -- a real missed exchange.
          // The race continues per spec rather than getting stuck.
          const startErrorMs = Number(stage.dataset.relayPendingStartError);
          phase = "resolving";
          resolveExchange(startErrorMs, null);
        }

        const elapsedSeconds = (now - raceStartedAt) / 1000;
        timeEl.textContent = `${elapsedSeconds.toFixed(1)}s`;
        legEl.textContent = `Leg ${Math.min(4, exchangeIndex + 1)} of 4`;

        const nearExchange = phase === "start_available" || phase === "pass_locked" || phase === "pass_available";
        trackEl.classList.toggle("pp-relay-track-zoomed", nearExchange && !window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);

        // Player runner: cosmetic progress at the base pace (the real,
        // scored leg durations are only finalized once every exchange
        // resolves -- see finishRace()'s own comment).
        const playerElapsed = playerElapsedMs(now);
        const playerLegIndex = Math.min(3, exchangeIndex);
        const playerLegProgress = Math.min(1, (now - raceStartedAt - playerLegDurations.slice(0, playerLegIndex).reduce((s, m) => s + m, 0)) / (playerLegDurations[playerLegIndex] ?? RELAY_EXCHANGE_LEG_DURATION_MS));
        positionRunner(runnerEls[0], playerLegProgress, 36);

        [1, 2].forEach((cpuIndex) => {
          const starts = cpuLegStarts[cpuIndex - 1];
          const legs = cpuLegDurations[cpuIndex - 1];
          const raceElapsed = now - raceStartedAt;
          let legIndex = 0;
          for (let i = 3; i >= 0; i -= 1) { if (raceElapsed >= starts[i]) { legIndex = i; break; } }
          const legProgress = Math.min(1, (raceElapsed - starts[legIndex]) / legs[legIndex]);
          positionRunner(runnerEls[cpuIndex], legProgress, cpuIndex === 1 ? 50 : 64);
        });

        if (!ended) raf = requestAnimationFrame(frame);
      }

      // Sets real SVG cx/cy inside the fixed 0-300x0-160 viewBox coordinate
      // system -- the <svg> itself scales to fit whatever the container's
      // actual on-screen width is (same technique Hurdle Dash's own canvas
      // already uses), so this positioning is correct at any real screen
      // size without needing to measure the container at all.
      function positionRunner(el, progress, radius) {
        const point = relayStadiumPoint(progress, 70, radius);
        el.setAttribute("cx", String(150 + point.x));
        el.setAttribute("cy", String(80 + point.y));
      }

      raf = requestAnimationFrame(frame);

      function endRace(finalTimeMs, place, perfectCombos, gameScore) {
        cancelCurrentAttempt();
        profile.relayExchange.attempts += 1;
        submitToServer("relay_exchange", { finishTimeMs: finalTimeMs, place, startErrorsMs, passErrorsMs });

        const priorTime = profile.relayExchange.bestTimeMs;
        const priorScore = profile.relayExchange.bestScore;
        const priorPerfect = profile.relayExchange.bestPerfectExchanges;
        const newTimePr = priorTime === null || finalTimeMs < priorTime;
        const newScorePr = priorScore === null || gameScore > priorScore;
        const newPerfectPr = priorPerfect === null || perfectCombos > priorPerfect;
        if (newTimePr) profile.relayExchange.bestTimeMs = Math.round(finalTimeMs);
        if (newScorePr) profile.relayExchange.bestScore = gameScore;
        if (newPerfectPr) profile.relayExchange.bestPerfectExchanges = perfectCombos;
        const isNewPr = newTimePr || newScorePr || newPerfectPr;

        let pointsEarned = 0;
        if (!sessionAwardedFirstGame) {
          pointsEarned += awardPoints(profile, `first-game-${pageSessionKey}`, FIRST_GAME_IN_COOLDOWN_POINTS);
          sessionAwardedFirstGame = true;
        }
        pointsEarned += awardPoints(profile, `relay-exchange-play-${Date.now()}`, participationPointsForPlay("relay_exchange", { gameScore }));
        if (isNewPr) {
          pointsEarned += awardPoints(profile, `relay-exchange-pr-${Date.now()}`, PERSONAL_RECORD_POINTS);
          track("podium_play_personal_record", { content_type: "game", content_id: "relay_exchange" });
        }
        persist();
        renderProgress();
        track("podium_play_game_completed", { content_type: "game", content_id: "relay_exchange", result_band: String(gameScore) });

        const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        const placeLabel = place === 1 ? "1st" : place === 2 ? "2nd" : "3rd";
        const startLabels = startErrorsMs.map((e) => relayStartBand(e));
        const passLabels = passErrorsMs.map((e) => relayPassBand(e));
        const exchangeReport = startLabels.map((s, i) => `Exchange ${i + 1}: start ${s.replace("_", "/")}, pass ${passLabels[i]}`).join(" · ");
        const resultLine = `${(finalTimeMs / 1000).toFixed(2)}s, finished ${placeLabel}.`;
        const prLine = isNewPr ? "New personal record." : "Can you beat it?";

        stage.innerHTML = `
          <div class="pp-stage-head"><h3>Relay Exchange</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
          <p class="pp-result${isNewPr && !reduceMotion ? " pp-result-celebrate" : ""}">${escapeHtml(resultLine)}</p>
          <p class="pp-pr">Score: ${gameScore} · Perfect exchanges: ${perfectCombos}/3</p>
          <p class="pp-pr">${escapeHtml(exchangeReport)}</p>
          <p class="pp-pr">${escapeHtml(prLine)}</p>
          ${pointsEarned > 0 ? `<p class="pp-score">+${pointsEarned} Podium Points</p>` : ""}
          <button class="button button-primary pp-stage-action" type="button" data-pp-again>Race again</button>
        `;
        stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));
        stage.querySelector("[data-pp-again]").addEventListener("click", () => renderRelayExchangeIdle(stage, games));
        announce(`${resultLine} ${prLine}`);
      }
    }

    function openConeSlalom() {
      const stage = panel.querySelector("[data-pp-stage]");
      const games = panel.querySelector("[data-pp-games]");
      if (!stage) return;
      games.hidden = true;
      stage.hidden = false;
      track("podium_play_game_started", { content_type: "game", content_id: "cone_slalom" });
      renderConeSlalomIdle(stage, games);
    }

    function renderConeSlalomIdle(stage, games) {
      const cs = profile.coneSlalom;
      const prParts = [];
      if (cs.bestDistance !== null) prParts.push(`Best distance: ${cs.bestDistance}`);
      if (cs.bestGroupsCleared !== null) prParts.push(`Most cleared: ${cs.bestGroupsCleared}`);
      stage.innerHTML = `
        <div class="pp-stage-head"><h3>Cone Slalom</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
        <p>Change lanes to avoid every obstacle. Go as far as you can.</p>
        ${prParts.length ? `<p class="pp-pr">${escapeHtml(prParts.join(" · "))}</p>` : ""}
        <button class="button button-primary pp-stage-action" type="button" data-pp-cs-start>Start</button>
      `;
      stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));
      stage.querySelector("[data-pp-cs-start]").addEventListener("click", () => startConeSlalomRun(stage, games));
    }

    function startConeSlalomRun(stage, games) {
      stage.innerHTML = `
        <div class="pp-stage-head"><h3>Cone Slalom</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
        <div class="pp-cs-stats" aria-hidden="true"><span data-pp-cs-time>Time: 30.0</span><span data-pp-cs-distance>Distance: 0</span><span data-pp-cs-cleared>Cleared: 0</span></div>
        <div class="pp-cs-course" data-pp-cs-course>
          <div class="pp-cs-lane" data-pp-cs-lane="0"></div>
          <div class="pp-cs-lane" data-pp-cs-lane="1"></div>
          <div class="pp-cs-lane" data-pp-cs-lane="2"></div>
          <div class="pp-cs-runner" data-pp-cs-runner></div>
        </div>
        <div class="pp-ts-buttons">
          <button class="pp-ts-button" type="button" data-pp-cs-move="left" aria-label="Move left">◀ LEFT</button>
          <button class="pp-ts-button" type="button" data-pp-cs-move="right" aria-label="Move right">RIGHT ▶</button>
        </div>
      `;
      stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));

      const timeEl = stage.querySelector("[data-pp-cs-time]");
      const distanceEl = stage.querySelector("[data-pp-cs-distance]");
      const clearedEl = stage.querySelector("[data-pp-cs-cleared]");
      const courseEl = stage.querySelector("[data-pp-cs-course]");
      const runnerEl = stage.querySelector("[data-pp-cs-runner]");
      const leftButton = stage.querySelector('[data-pp-cs-move="left"]');
      const rightButton = stage.querySelector('[data-pp-cs-move="right"]');

      let lane = 1; // start in the middle lane
      let laneTransitioning = false;
      let distanceTraveled = 0;
      let groupsCleared = 0;
      let ended = false;
      let raf = null;
      const startedAt = performance.now();
      const groups = []; // { el, blockedLanes, spawnDistance, resolved }
      let nextGroupAtDistance = 260;

      function renderLanePosition() {
        runnerEl.style.left = `${(lane / 2) * 66 + 17}%`;
      }
      renderLanePosition();

      function moveLane(direction) {
        if (ended) return;
        const target = lane + direction;
        if (target < 0 || target > 2) return; // an unavailable outer lane -- do nothing (subtle no-op feedback)
        lane = target;
        laneTransitioning = true;
        runnerEl.classList.add("pp-cs-runner-moving");
        renderLanePosition();
        setTimeout(() => { laneTransitioning = false; runnerEl.classList.remove("pp-cs-runner-moving"); }, CONE_SLALOM_LANE_TRANSITION_MS);
      }

      function handleLeft(event) { event.preventDefault(); moveLane(-1); }
      function handleRight(event) { event.preventDefault(); moveLane(1); }
      function handleKeydown(event) {
        if (event.repeat) return;
        const tag = event.target?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || event.target?.isContentEditable) return;
        if (event.code === "ArrowLeft") { event.preventDefault(); moveLane(-1); }
        else if (event.code === "ArrowRight") { event.preventDefault(); moveLane(1); }
      }
      leftButton.addEventListener("pointerdown", handleLeft);
      rightButton.addEventListener("pointerdown", handleRight);
      document.addEventListener("keydown", handleKeydown);

      currentAttempt = {
        cleanup: () => {
          ended = true;
          if (raf) cancelAnimationFrame(raf);
          leftButton.removeEventListener("pointerdown", handleLeft);
          rightButton.removeEventListener("pointerdown", handleRight);
          document.removeEventListener("keydown", handleKeydown);
        }
      };

      function spawnGroup() {
        const { blockedLanes, obstacle } = coneSlalomNextGroup();
        const el = document.createElement("div");
        el.className = "pp-cs-group";
        el.innerHTML = [0, 1, 2].map((laneIndex) => `<span class="pp-cs-obstacle${blockedLanes.includes(laneIndex) ? " pp-cs-obstacle-active" : ""}">${blockedLanes.includes(laneIndex) ? obstacle.symbol : ""}</span>`).join("");
        courseEl.appendChild(el);
        groups.push({ el, blockedLanes, spawnDistance: distanceTraveled, resolved: false });
        const speed = coneSlalomSpeedAtElapsed((performance.now() - startedAt) / 1000);
        nextGroupAtDistance = distanceTraveled + coneSlalomNextGap(speed);
      }

      function frame() {
        if (ended) return;
        const now = performance.now();
        const elapsedSeconds = (now - startedAt) / 1000;
        const remaining = Math.max(0, CONE_SLALOM_DURATION_SECONDS - elapsedSeconds);
        timeEl.textContent = `Time: ${remaining.toFixed(1)}`;

        const speed = coneSlalomSpeedAtElapsed(elapsedSeconds);
        distanceTraveled += (speed * (1 / 60)); // a stable per-frame increment based on real elapsed-time speed, not raw frame count
        distanceEl.textContent = `Distance: ${Math.floor(distanceTraveled)}`;

        if (distanceTraveled >= nextGroupAtDistance) spawnGroup();

        const COURSE_TRAVEL = 240; // px the course visually scrolls before a group reaches the runner's line
        for (const group of groups) {
          const traveled = distanceTraveled - group.spawnDistance;
          const progressToLine = Math.min(1.15, traveled / 90);
          group.el.style.top = `${progressToLine * COURSE_TRAVEL}px`;
          if (!group.resolved && progressToLine >= 1) {
            group.resolved = true;
            // A player already mid-transition out of a blocked lane at
            // the exact instant of arrival is forgiven -- they already
            // committed to the correct move in time, and being
            // unforgiving here would punish pure animation-timing luck,
            // not a real mistake.
            const stillInBlockedLane = group.blockedLanes.includes(lane) && !laneTransitioning;
            if (stillInBlockedLane) {
              endRun("collision");
              return;
            }
            groupsCleared += 1;
            clearedEl.textContent = `Cleared: ${groupsCleared}`;
          }
          if (progressToLine >= 1.1) { group.el.remove(); }
        }
        for (let i = groups.length - 1; i >= 0; i -= 1) {
          if (!groups[i].el.isConnected) groups.splice(i, 1);
        }

        if (remaining <= 0) { endRun("time_expired"); return; }
        raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);

      function endRun(completionReason) {
        cancelCurrentAttempt();
        profile.coneSlalom.attempts += 1;
        const survivedFull = completionReason === "time_expired";
        const roundedMeters = Math.floor(distanceTraveled);
        submitToServer("cone_slalom", { metersTraveled: roundedMeters, groupsCleared, survivedFull });

        const gameScore = coneSlalomGameScore(groupsCleared, roundedMeters, survivedFull);
        const priorDistance = profile.coneSlalom.bestDistance;
        const priorGroups = profile.coneSlalom.bestGroupsCleared;
        const newDistancePr = priorDistance === null || roundedMeters > priorDistance;
        const newGroupsPr = priorGroups === null || groupsCleared > priorGroups;
        if (newDistancePr) profile.coneSlalom.bestDistance = roundedMeters;
        if (newGroupsPr) profile.coneSlalom.bestGroupsCleared = groupsCleared;
        const isNewPr = newDistancePr || newGroupsPr;

        let pointsEarned = 0;
        if (!sessionAwardedFirstGame) {
          pointsEarned += awardPoints(profile, `first-game-${pageSessionKey}`, FIRST_GAME_IN_COOLDOWN_POINTS);
          sessionAwardedFirstGame = true;
        }
        pointsEarned += awardPoints(profile, `cone-slalom-play-${Date.now()}`, participationPointsForPlay("cone_slalom", { gameScore }));
        if (isNewPr) {
          pointsEarned += awardPoints(profile, `cone-slalom-pr-${Date.now()}`, PERSONAL_RECORD_POINTS);
          track("podium_play_personal_record", { content_type: "game", content_id: "cone_slalom" });
        }
        persist();
        renderProgress();
        track("podium_play_game_completed", { content_type: "game", content_id: "cone_slalom", completion_reason: completionReason, result_band: String(gameScore) });

        const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        const resultLine = completionReason === "collision"
          ? `Collision! ${roundedMeters} distance, ${groupsCleared} cleared.`
          : `${roundedMeters} distance, ${groupsCleared} cleared.`;
        const prLine = isNewPr ? "New personal record." : "Can you beat it?";

        stage.innerHTML = `
          <div class="pp-stage-head"><h3>Cone Slalom</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
          <p class="pp-result${isNewPr && !reduceMotion ? " pp-result-celebrate" : ""}">${escapeHtml(resultLine)}</p>
          <p class="pp-pr">${escapeHtml(prLine)}</p>
          ${pointsEarned > 0 ? `<p class="pp-score">+${pointsEarned} Podium Points</p>` : ""}
          <button class="button button-primary pp-stage-action" type="button" data-pp-again>Run again</button>
        `;
        stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));
        stage.querySelector("[data-pp-again]").addEventListener("click", () => renderConeSlalomIdle(stage, games));
        announce(`${resultLine} ${prLine}`);
      }
    }

    function openPacePerfect() {
      const stage = panel.querySelector("[data-pp-stage]");
      const games = panel.querySelector("[data-pp-games]");
      if (!stage) return;
      games.hidden = true;
      stage.hidden = false;
      track("podium_play_game_started", { content_type: "game", content_id: "pace_perfect" });
      renderPacePerfectIdle(stage, games);
    }

    function renderPacePerfectIdle(stage, games) {
      const pp = profile.pacePerfect;
      const prParts = [];
      if (pp.bestAccuracyPct !== null) prParts.push(`Best accuracy: ${pp.bestAccuracyPct}%`);
      if (pp.bestStreak !== null) prParts.push(`Best streak: ${pp.bestStreak}`);
      stage.innerHTML = `
        <div class="pp-stage-head"><h3>Pace Perfect</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
        <p>Tap the moment the pulse reaches the target. Consistent rhythm beats raw speed.</p>
        ${prParts.length ? `<p class="pp-pr">${escapeHtml(prParts.join(" · "))}</p>` : ""}
        <button class="button button-primary pp-stage-action" type="button" data-pp-pace-start>Start</button>
      `;
      stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));
      stage.querySelector("[data-pp-pace-start]").addEventListener("click", () => startPacePerfectRun(stage, games));
    }

    function startPacePerfectRun(stage, games) {
      stage.innerHTML = `
        <div class="pp-stage-head"><h3>Pace Perfect</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
        <div class="pp-pace-stats" aria-hidden="true"><span data-pp-pace-split>Split 1 of 4</span><span data-pp-pace-feedback>Ready...</span></div>
        <div class="pp-pace-target" data-pp-pace-tap>
          <div class="pp-pace-pulse" data-pp-pace-pulse></div>
          <div class="pp-pace-ring"></div>
        </div>
        <div class="pp-track"><div class="pp-ts-runner" data-pp-pace-runner></div></div>
      `;
      stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));

      const splitEl = stage.querySelector("[data-pp-pace-split]");
      const feedbackEl = stage.querySelector("[data-pp-pace-feedback]");
      const pulseEl = stage.querySelector("[data-pp-pace-pulse]");
      const tapArea = stage.querySelector("[data-pp-pace-tap]");
      const runnerEl = stage.querySelector("[data-pp-pace-runner]");
      pulseEl.style.animationDuration = `${PACE_PERFECT_BEAT_INTERVAL_MS}ms`;

      const beatTimesMs = paceBeatSchedule();
      const matchedFlags = beatTimesMs.map(() => false);
      const beatErrorsMs = beatTimesMs.map(() => null);
      let falseTapCount = 0;
      let cumulativeScore = 0;
      let ended = false;
      let raf = null;
      const startedAt = performance.now();
      const endAt = beatTimesMs[beatTimesMs.length - 1] + PACE_PERFECT_MISS_TOLERANCE_MS + 300;

      function showFeedback(band) {
        const labels = { perfect: "Perfect!", great: "Great", good: "Good", miss: "Miss" };
        feedbackEl.textContent = labels[band] || "";
        feedbackEl.dataset.band = band;
      }

      function handleTap(event) {
        if (ended) return;
        event.preventDefault();
        const tapTimeMs = performance.now() - startedAt;
        const index = paceMatchTapToBeat(tapTimeMs, beatTimesMs, matchedFlags);
        if (index === -1) {
          falseTapCount += 1;
          showFeedback("miss");
          return;
        }
        matchedFlags[index] = true;
        const errorMs = tapTimeMs - beatTimesMs[index];
        beatErrorsMs[index] = errorMs;
        const band = paceBeatBand(errorMs);
        showFeedback(band);
        cumulativeScore += paceBeatScore(errorMs);
        runnerEl.style.left = `${Math.min(100, (cumulativeScore / (PACE_PERFECT_BEAT_COUNT * 100)) * 100)}%`;
        splitEl.textContent = `Split ${Math.min(4, Math.floor(index / 4) + 1)} of 4`;
      }
      tapArea.addEventListener("pointerdown", handleTap);

      function handleKeydown(event) {
        if (event.repeat) return;
        const tag = event.target?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || event.target?.isContentEditable) return;
        if (event.code === "Space" || event.key === "Enter") handleTap(event);
      }
      document.addEventListener("keydown", handleKeydown);

      currentAttempt = {
        cleanup: () => {
          ended = true;
          if (raf) cancelAnimationFrame(raf);
          tapArea.removeEventListener("pointerdown", handleTap);
          document.removeEventListener("keydown", handleKeydown);
        }
      };

      function frame() {
        if (ended) return;
        const now = performance.now() - startedAt;
        if (now >= endAt) { endRun(); return; }
        raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);

      function endRun() {
        cancelCurrentAttempt();
        // Any beat that never got a matching tap resolves as a real miss
        // (null), same as the client always did for an unmatched beat --
        // this just makes it explicit at the end rather than leaving gaps.
        profile.pacePerfect.attempts += 1;
        submitToServer("pace_perfect", { beatErrorsMs, falseTapCount });

        const result = pacePerfectGameScore(beatErrorsMs, falseTapCount);
        const priorAccuracy = profile.pacePerfect.bestAccuracyPct;
        const priorStreak = profile.pacePerfect.bestStreak;
        const newAccuracyPr = priorAccuracy === null || result.accuracyPct > priorAccuracy;
        const newStreakPr = priorStreak === null || result.longestStreak > priorStreak;
        if (newAccuracyPr) profile.pacePerfect.bestAccuracyPct = result.accuracyPct;
        if (newStreakPr) profile.pacePerfect.bestStreak = result.longestStreak;
        const isNewPr = newAccuracyPr || newStreakPr;

        let pointsEarned = 0;
        if (!sessionAwardedFirstGame) {
          pointsEarned += awardPoints(profile, `first-game-${pageSessionKey}`, FIRST_GAME_IN_COOLDOWN_POINTS);
          sessionAwardedFirstGame = true;
        }
        pointsEarned += awardPoints(profile, `pace-perfect-play-${Date.now()}`, participationPointsForPlay("pace_perfect", { gameScore: result.score }));
        if (isNewPr) {
          pointsEarned += awardPoints(profile, `pace-perfect-pr-${Date.now()}`, PERSONAL_RECORD_POINTS);
          track("podium_play_personal_record", { content_type: "game", content_id: "pace_perfect" });
        }
        persist();
        renderProgress();
        track("podium_play_game_completed", { content_type: "game", content_id: "pace_perfect", result_band: String(result.score) });

        const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        const resultLine = `${result.accuracyPct}% accuracy, streak ${result.longestStreak}.`;
        const prLine = isNewPr ? "New personal record." : "Can you beat it?";

        stage.innerHTML = `
          <div class="pp-stage-head"><h3>Pace Perfect</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
          <p class="pp-result${isNewPr && !reduceMotion ? " pp-result-celebrate" : ""}">${escapeHtml(resultLine)}</p>
          <p class="pp-pr">Score: ${result.score} · False taps: ${falseTapCount}</p>
          <p class="pp-pr">${escapeHtml(prLine)}</p>
          ${pointsEarned > 0 ? `<p class="pp-score">+${pointsEarned} Podium Points</p>` : ""}
          <button class="button button-primary pp-stage-action" type="button" data-pp-again>Pace again</button>
        `;
        stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));
        stage.querySelector("[data-pp-again]").addEventListener("click", () => renderPacePerfectIdle(stage, games));
        announce(`${resultLine} ${prLine}`);
      }
    }

    function openPackPass() {
      const stage = panel.querySelector("[data-pp-stage]");
      const games = panel.querySelector("[data-pp-games]");
      if (!stage) return;
      games.hidden = true;
      stage.hidden = false;
      track("podium_play_game_started", { content_type: "game", content_id: "pack_pass" });
      renderPackPassIdle(stage, games);
    }

    function renderPackPassIdle(stage, games) {
      const pk = profile.packPass;
      const prParts = [];
      if (pk.bestPosition !== null) prParts.push(`Best finish: ${pk.bestPosition === 1 ? "1st" : `#${pk.bestPosition}`}`);
      if (pk.bestScore !== null) prParts.push(`Best score: ${pk.bestScore}`);
      stage.innerHTML = `
        <div class="pp-stage-head"><h3>Pack Pass</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
        <p>You're 20th. Pick the open lane to pass runners and race up to 1st.</p>
        ${prParts.length ? `<p class="pp-pr">${escapeHtml(prParts.join(" · "))}</p>` : ""}
        <button class="button button-primary pp-stage-action" type="button" data-pp-pack-start>Start</button>
      `;
      stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));
      stage.querySelector("[data-pp-pack-start]").addEventListener("click", () => startPackPassRun(stage, games));
    }

    function startPackPassRun(stage, games) {
      stage.innerHTML = `
        <div class="pp-stage-head"><h3>Pack Pass</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
        <div class="pp-pack-stats" aria-hidden="true"><span data-pp-pack-position>Position: 20th</span><span data-pp-pack-momentum>Momentum: 0/3</span></div>
        <div class="pp-pack-lanes" data-pp-pack-lanes>
          <button class="pp-pack-lane" type="button" data-pp-pack-lane="0">LEFT</button>
          <button class="pp-pack-lane" type="button" data-pp-pack-lane="1">CENTER</button>
          <button class="pp-pack-lane" type="button" data-pp-pack-lane="2">RIGHT</button>
        </div>
        <p class="pp-pace-target-hint" data-pp-pack-hint>Watch for the gap...</p>
      `;
      stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));

      const positionEl = stage.querySelector("[data-pp-pack-position]");
      const momentumEl = stage.querySelector("[data-pp-pack-momentum]");
      const hintEl = stage.querySelector("[data-pp-pack-hint]");
      const laneButtons = [0, 1, 2].map((i) => stage.querySelector(`[data-pp-pack-lane="${i}"]`));

      let position = PACK_PASS_START_POSITION;
      let cleanPasses = 0;
      let narrowPasses = 0;
      let momentumPasses = 0;
      let blockedChoices = 0;
      let momentumStreak = 0;
      let decisionCount = 0;
      let currentOpenLanes = [];
      let decisionActive = false;
      let decisionTimeout = null;
      let ended = false;

      function renderLaneState() {
        laneButtons.forEach((button, i) => {
          button.classList.toggle("pp-pack-lane-open", currentOpenLanes.includes(i));
          button.classList.toggle("pp-pack-lane-blocked", !currentOpenLanes.includes(i));
        });
      }

      function nextDecision() {
        if (ended) return;
        if (decisionCount >= PACK_PASS_DECISION_COUNT || position <= 1 || blockedChoices >= 3) { endRun(); return; }
        decisionCount += 1;
        const { openLanes } = packPassNextDecision();
        currentOpenLanes = openLanes;
        decisionActive = true;
        hintEl.textContent = "Pick the open lane!";
        renderLaneState();
        decisionTimeout = setTimeout(() => resolveChoice(null), PACK_PASS_DECISION_WINDOW_MS);
      }

      function resolveChoice(chosenLane) {
        if (!decisionActive || ended) return;
        decisionActive = false;
        if (decisionTimeout) clearTimeout(decisionTimeout);

        const { clean, narrow } = chosenLane === null ? { clean: false, narrow: false } : packPassResolveChoice(chosenLane, currentOpenLanes);
        if (clean) {
          cleanPasses += 1;
          if (narrow) narrowPasses += 1;
          momentumStreak += 1;
          let gain = 1;
          if (narrow) gain += 1;
          if (momentumStreak >= 3) {
            momentumPasses += 1;
            gain += 1;
            momentumStreak = 0;
          }
          position = Math.max(1, position - gain);
          hintEl.textContent = narrow ? "Narrow gap -- nice pass!" : "Clean pass!";
        } else {
          blockedChoices += 1;
          momentumStreak = 0;
          position = Math.min(PACK_PASS_START_POSITION, position + 1);
          hintEl.textContent = chosenLane === null ? "Too slow -- blocked!" : "Blocked!";
        }
        positionEl.textContent = `Position: ${position === 1 ? "1st" : `${position}th`}`;
        momentumEl.textContent = `Momentum: ${momentumStreak}/3`;
        renderLaneState();

        setTimeout(nextDecision, 500);
      }

      function handleLaneClick(event) {
        event.preventDefault();
        resolveChoice(Number(event.currentTarget.dataset.ppPackLane));
      }
      laneButtons.forEach((button) => button.addEventListener("pointerdown", handleLaneClick));

      function handleKeydown(event) {
        if (event.repeat || ended) return;
        const tag = event.target?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || event.target?.isContentEditable) return;
        if (event.code === "ArrowLeft") { event.preventDefault(); resolveChoice(0); }
        else if (event.code === "ArrowUp" || event.code === "Space") { event.preventDefault(); resolveChoice(1); }
        else if (event.code === "ArrowRight") { event.preventDefault(); resolveChoice(2); }
      }
      document.addEventListener("keydown", handleKeydown);

      currentAttempt = {
        cleanup: () => {
          ended = true;
          if (decisionTimeout) clearTimeout(decisionTimeout);
          laneButtons.forEach((button) => button.removeEventListener("pointerdown", handleLaneClick));
          document.removeEventListener("keydown", handleKeydown);
        }
      };

      nextDecision();

      function endRun() {
        cancelCurrentAttempt();
        profile.packPass.attempts += 1;
        submitToServer("pack_pass", { finalPosition: position, cleanPasses, narrowPasses, momentumPasses, blockedChoices });

        const gameScore = packPassGameScore({ cleanPasses, narrowPasses, momentumPasses, finalPosition: position, blockedChoices });
        const priorPosition = profile.packPass.bestPosition;
        const priorScore = profile.packPass.bestScore;
        const newPositionPr = priorPosition === null || position < priorPosition;
        const newScorePr = priorScore === null || gameScore > priorScore;
        if (newPositionPr) profile.packPass.bestPosition = position;
        if (newScorePr) profile.packPass.bestScore = gameScore;
        const isNewPr = newPositionPr || newScorePr;

        let pointsEarned = 0;
        if (!sessionAwardedFirstGame) {
          pointsEarned += awardPoints(profile, `first-game-${pageSessionKey}`, FIRST_GAME_IN_COOLDOWN_POINTS);
          sessionAwardedFirstGame = true;
        }
        pointsEarned += awardPoints(profile, `pack-pass-play-${Date.now()}`, participationPointsForPlay("pack_pass", { gameScore }));
        if (isNewPr) {
          pointsEarned += awardPoints(profile, `pack-pass-pr-${Date.now()}`, PERSONAL_RECORD_POINTS);
          track("podium_play_personal_record", { content_type: "game", content_id: "pack_pass" });
        }
        persist();
        renderProgress();
        track("podium_play_game_completed", { content_type: "game", content_id: "pack_pass", result_band: String(gameScore) });

        const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        const resultLine = position === 1 ? "You reached 1st place!" : `Finished ${position}${position === 2 ? "nd" : position === 3 ? "rd" : "th"}.`;
        const prLine = isNewPr ? "New personal record." : "Can you beat it?";

        stage.innerHTML = `
          <div class="pp-stage-head"><h3>Pack Pass</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
          <p class="pp-result${isNewPr && !reduceMotion ? " pp-result-celebrate" : ""}">${escapeHtml(resultLine)}</p>
          <p class="pp-pr">Score: ${gameScore} · Clean passes: ${cleanPasses}</p>
          <p class="pp-pr">${escapeHtml(prLine)}</p>
          ${pointsEarned > 0 ? `<p class="pp-score">+${pointsEarned} Podium Points</p>` : ""}
          <button class="button button-primary pp-stage-action" type="button" data-pp-again>Race again</button>
        `;
        stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));
        stage.querySelector("[data-pp-again]").addEventListener("click", () => renderPackPassIdle(stage, games));
        announce(`${resultLine} ${prLine}`);
      }
    }

    function openFinishChute() {
      const stage = panel.querySelector("[data-pp-stage]");
      const games = panel.querySelector("[data-pp-games]");
      if (!stage) return;
      games.hidden = true;
      stage.hidden = false;
      track("podium_play_game_started", { content_type: "game", content_id: "finish_chute" });
      renderFinishChuteIdle(stage, games);
    }

    function renderFinishChuteIdle(stage, games) {
      const fc = profile.finishChute;
      const prParts = [];
      if (fc.bestStreak !== null) prParts.push(`Best streak: ${fc.bestStreak}`);
      if (fc.bestScore !== null) prParts.push(`Best score: ${fc.bestScore}`);
      stage.innerHTML = `
        <div class="pp-stage-head"><h3>Finish Chute</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
        <p>Send each runner to the matching chute by color and symbol. Three mistakes ends the run.</p>
        ${prParts.length ? `<p class="pp-pr">${escapeHtml(prParts.join(" · "))}</p>` : ""}
        <button class="button button-primary pp-stage-action" type="button" data-pp-fc-start>Start</button>
      `;
      stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));
      stage.querySelector("[data-pp-fc-start]").addEventListener("click", () => startFinishChuteRun(stage, games));
    }

    function startFinishChuteRun(stage, games) {
      stage.innerHTML = `
        <div class="pp-stage-head"><h3>Finish Chute</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
        <div class="pp-fc-stats" aria-hidden="true"><span data-pp-fc-streak>Streak: 0</span><span data-pp-fc-mistakes>Mistakes: 0/3</span></div>
        <div class="pp-fc-bib" data-pp-fc-bib>Get ready...</div>
        <div class="pp-fc-controls" data-pp-fc-controls>
          ${FINISH_CHUTE_PAIRINGS.map((p, i) => `<button class="pp-fc-control pp-fc-control-${p.color}" type="button" data-pp-fc-control="${i}" aria-label="${escapeHtml(p.label)}"><span>${p.symbol}</span></button>`).join("")}
        </div>
      `;
      stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));

      const streakEl = stage.querySelector("[data-pp-fc-streak]");
      const mistakesEl = stage.querySelector("[data-pp-fc-mistakes]");
      const bibEl = stage.querySelector("[data-pp-fc-bib]");
      const controlButtons = [0, 1, 2, 3].map((i) => stage.querySelector(`[data-pp-fc-control="${i}"]`));

      let correctCount = 0;
      let mistakeCount = 0;
      let currentStreak = 0;
      let longestStreak = 0;
      let totalPrompts = 0;
      let responseTimesMs = [];
      let currentPairingIndex = -1;
      let runnerActive = false;
      let runnerShownAt = 0;
      let ended = false;
      let spawnTimer = null;
      let durationTimer = null;
      const startedAt = performance.now();

      function spawnRunner() {
        if (ended) return;
        totalPrompts += 1;
        currentPairingIndex = finishChuteNextRunner();
        const pairing = FINISH_CHUTE_PAIRINGS[currentPairingIndex];
        bibEl.innerHTML = `<span class="pp-fc-bib-symbol">${pairing.symbol}</span><span class="pp-fc-bib-color">${escapeHtml(pairing.color)}</span>`;
        bibEl.className = `pp-fc-bib pp-fc-bib-${pairing.color}`;
        runnerActive = true;
        runnerShownAt = performance.now();
      }

      function scheduleNextSpawn() {
        if (ended) return;
        const interval = finishChuteIntervalForCount(totalPrompts);
        spawnTimer = setTimeout(spawnRunner, interval);
      }
      spawnRunner();

      function handleControl(index) {
        if (ended || !runnerActive) return;
        runnerActive = false;
        const responseMs = performance.now() - runnerShownAt;
        responseTimesMs.push(responseMs);
        if (index === currentPairingIndex) {
          correctCount += 1;
          currentStreak += 1;
          longestStreak = Math.max(longestStreak, currentStreak);
          bibEl.classList.add("pp-fc-bib-correct");
        } else {
          mistakeCount += 1;
          currentStreak = 0;
          bibEl.classList.add("pp-fc-bib-wrong");
        }
        streakEl.textContent = `Streak: ${currentStreak}`;
        mistakesEl.textContent = `Mistakes: ${mistakeCount}/3`;
        if (mistakeCount >= FINISH_CHUTE_MAX_MISTAKES) { endRun(); return; }
        setTimeout(() => { if (!ended) { bibEl.classList.remove("pp-fc-bib-correct", "pp-fc-bib-wrong"); scheduleNextSpawn(); } }, 250);
      }

      function handleControlClick(event) { event.preventDefault(); handleControl(Number(event.currentTarget.dataset.ppFcControl)); }
      controlButtons.forEach((button) => button.addEventListener("pointerdown", handleControlClick));

      function handleKeydown(event) {
        if (event.repeat || ended) return;
        const tag = event.target?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || event.target?.isContentEditable) return;
        const index = ["Digit1", "Digit2", "Digit3", "Digit4"].indexOf(event.code);
        if (index !== -1) { event.preventDefault(); handleControl(index); }
      }
      document.addEventListener("keydown", handleKeydown);

      currentAttempt = {
        cleanup: () => {
          ended = true;
          if (spawnTimer) clearTimeout(spawnTimer);
          if (durationTimer) clearTimeout(durationTimer);
          controlButtons.forEach((button) => button.removeEventListener("pointerdown", handleControlClick));
          document.removeEventListener("keydown", handleKeydown);
        }
      };

      durationTimer = setTimeout(() => { if (!ended) endRun(); }, FINISH_CHUTE_DURATION_SECONDS * 1000);

      function endRun() {
        cancelCurrentAttempt();
        profile.finishChute.attempts += 1;
        const avgResponseMs = responseTimesMs.length ? responseTimesMs.reduce((sum, ms) => sum + ms, 0) / responseTimesMs.length : 0;
        submitToServer("finish_chute", { correctCount, longestStreak, mistakeCount, totalPrompts, avgResponseMs });

        const gameScore = finishChuteGameScore({ correctCount, longestStreak, mistakeCount, totalPrompts, avgResponseMs });
        const priorStreak = profile.finishChute.bestStreak;
        const priorScore = profile.finishChute.bestScore;
        const newStreakPr = priorStreak === null || longestStreak > priorStreak;
        const newScorePr = priorScore === null || gameScore > priorScore;
        if (newStreakPr) profile.finishChute.bestStreak = longestStreak;
        if (newScorePr) profile.finishChute.bestScore = gameScore;
        const isNewPr = newStreakPr || newScorePr;

        let pointsEarned = 0;
        if (!sessionAwardedFirstGame) {
          pointsEarned += awardPoints(profile, `first-game-${pageSessionKey}`, FIRST_GAME_IN_COOLDOWN_POINTS);
          sessionAwardedFirstGame = true;
        }
        pointsEarned += awardPoints(profile, `finish-chute-play-${Date.now()}`, participationPointsForPlay("finish_chute", { gameScore }));
        if (isNewPr) {
          pointsEarned += awardPoints(profile, `finish-chute-pr-${Date.now()}`, PERSONAL_RECORD_POINTS);
          track("podium_play_personal_record", { content_type: "game", content_id: "finish_chute" });
        }
        persist();
        renderProgress();
        track("podium_play_game_completed", { content_type: "game", content_id: "finish_chute", result_band: String(gameScore) });

        const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        const resultLine = `${correctCount} sorted, streak ${longestStreak}.`;
        const prLine = isNewPr ? "New personal record." : "Can you beat it?";

        stage.innerHTML = `
          <div class="pp-stage-head"><h3>Finish Chute</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
          <p class="pp-result${isNewPr && !reduceMotion ? " pp-result-celebrate" : ""}">${escapeHtml(resultLine)}</p>
          <p class="pp-pr">Score: ${gameScore} · Mistakes: ${mistakeCount}</p>
          <p class="pp-pr">${escapeHtml(prLine)}</p>
          ${pointsEarned > 0 ? `<p class="pp-score">+${pointsEarned} Podium Points</p>` : ""}
          <button class="button button-primary pp-stage-action" type="button" data-pp-again>Sort again</button>
        `;
        stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));
        stage.querySelector("[data-pp-again]").addEventListener("click", () => renderFinishChuteIdle(stage, games));
        announce(`${resultLine} ${prLine}`);
      }
    }

    function openSpikeShuffle() {
      const stage = panel.querySelector("[data-pp-stage]");
      const games = panel.querySelector("[data-pp-games]");
      if (!stage) return;
      games.hidden = true;
      stage.hidden = false;
      track("podium_play_game_started", { content_type: "game", content_id: "spike_shuffle" });
      renderSpikeShuffleIdle(stage, games);
    }

    function renderSpikeShuffleIdle(stage, games) {
      const ss = profile.spikeShuffle;
      const prParts = [];
      if (ss.bestStreak !== null) prParts.push(`Best streak: ${ss.bestStreak}`);
      if (ss.bestScore !== null) prParts.push(`Best score: ${ss.bestScore}`);
      stage.innerHTML = `
        <div class="pp-stage-head"><h3>Spike Shuffle</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
        <p>Watch the spike, then track it through the shuffle. One wrong guess ends the run.</p>
        ${prParts.length ? `<p class="pp-pr">${escapeHtml(prParts.join(" · "))}</p>` : ""}
        <button class="button button-primary pp-stage-action" type="button" data-pp-ss-start>Start</button>
      `;
      stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));
      stage.querySelector("[data-pp-ss-start]").addEventListener("click", () => startSpikeShuffleGame(stage, games));
    }

    function startSpikeShuffleGame(stage, games) {
      let roundNumber = 1;
      let roundsCompleted = 0;
      let advancedRoundsCompleted = 0;
      let ended = false;
      let teardownRoundListeners = null;

      currentAttempt = { cleanup: () => { ended = true; teardownRoundListeners?.(); } };

      function renderRound() {
        const boxCount = spikeShuffleBoxCountForRound(roundNumber);
        const swapCount = spikeShuffleSwapCountForRound(roundNumber);
        const swapDurationMs = spikeShuffleSwapDurationMsForRound(roundNumber);
        const startingBox = Math.floor(Math.random() * boxCount);
        const swaps = spikeShuffleGenerateSwaps(boxCount, swapCount);
        const winningBox = spikeShuffleApplySwaps(startingBox, swaps);

        stage.innerHTML = `
          <div class="pp-stage-head"><h3>Spike Shuffle</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
          <p class="pp-btr-round">Round ${roundNumber}${boxCount === 4 ? " -- 4 boxes!" : ""}</p>
          <div class="pp-ss-boxes" data-pp-ss-boxes style="--pp-ss-box-count:${boxCount}">
            ${Array.from({ length: boxCount }, (_, slot) => `<button class="pp-ss-box" type="button" data-pp-ss-slot="${slot}" data-pp-ss-box="${slot}" style="--pp-ss-slot:${slot}" disabled>📦</button>`).join("")}
          </div>
        `;
        stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));

        const boxButtons = Array.from(stage.querySelectorAll("[data-pp-ss-box]"));
        // slotOfBox[boxId] = current visual slot; boxInSlot[slot] = current box id -- kept in sync at every swap boundary.
        const boxInSlot = Array.from({ length: boxCount }, (_, i) => i);
        const slotOfBox = Array.from({ length: boxCount }, (_, i) => i);

        function placeBoxes() {
          boxButtons.forEach((button) => {
            const boxId = Number(button.dataset.ppSsBox);
            button.style.setProperty("--pp-ss-slot", String(slotOfBox[boxId]));
          });
        }

        // Reveal the spike's real starting box before covering it.
        boxButtons[startingBox].textContent = "👟";
        boxButtons[startingBox].classList.add("pp-ss-box-reveal");
        placeBoxes();

        let swapIndex = 0;
        let shuffleTimer = null;
        let inputLocked = true;

        function coverAndShuffle() {
          boxButtons.forEach((button) => { button.textContent = "📦"; button.classList.remove("pp-ss-box-reveal"); });
          runNextSwap();
        }

        function runNextSwap() {
          if (ended) return;
          if (swapIndex >= swaps.length) {
            inputLocked = false;
            boxButtons.forEach((button) => { button.disabled = false; });
            return;
          }
          const [a, b] = swaps[swapIndex];
          const boxA = boxInSlot[a];
          const boxB = boxInSlot[b];
          boxInSlot[a] = boxB;
          boxInSlot[b] = boxA;
          slotOfBox[boxA] = b;
          slotOfBox[boxB] = a;
          placeBoxes();
          swapIndex += 1;
          shuffleTimer = setTimeout(runNextSwap, swapDurationMs);
        }

        shuffleTimer = setTimeout(coverAndShuffle, 900);

        function handlePick(event) {
          if (ended || inputLocked) return;
          event.preventDefault();
          const pickedBox = Number(event.currentTarget.dataset.ppSsBox);
          resolveRound(pickedBox === winningBox, winningBox);
        }
        boxButtons.forEach((button) => button.addEventListener("pointerdown", handlePick));
        teardownRoundListeners = () => {
          if (shuffleTimer) clearTimeout(shuffleTimer);
          boxButtons.forEach((button) => button.removeEventListener("pointerdown", handlePick));
        };

        function resolveRound(correct, actualWinningBox) {
          teardownRoundListeners?.();
          boxButtons.forEach((button) => { button.disabled = true; });
          boxButtons[actualWinningBox].textContent = "👟";
          boxButtons[actualWinningBox].classList.add(correct ? "pp-ss-box-reveal" : "pp-ss-box-wrong");
          if (correct) {
            roundsCompleted += 1;
            if (boxCount === 4) advancedRoundsCompleted += 1;
            announce(`Correct! Round ${roundNumber} complete.`);
            setTimeout(() => { if (!ended) { roundNumber += 1; renderRound(); } }, 1300);
          } else {
            setTimeout(() => { if (!ended) endGame(); }, 1300);
          }
        }
      }

      renderRound();

      function endGame() {
        cancelCurrentAttempt();
        profile.spikeShuffle.attempts += 1;
        submitToServer("spike_shuffle", { roundsCompleted, advancedRoundsCompleted });

        const gameScore = spikeShuffleGameScore(roundsCompleted, advancedRoundsCompleted);
        const priorStreak = profile.spikeShuffle.bestStreak;
        const priorScore = profile.spikeShuffle.bestScore;
        const newStreakPr = priorStreak === null || roundsCompleted > priorStreak;
        const newScorePr = priorScore === null || gameScore > priorScore;
        if (newStreakPr) profile.spikeShuffle.bestStreak = roundsCompleted;
        if (newScorePr) profile.spikeShuffle.bestScore = gameScore;
        const isNewPr = newStreakPr || newScorePr;

        let pointsEarned = 0;
        if (!sessionAwardedFirstGame) {
          pointsEarned += awardPoints(profile, `first-game-${pageSessionKey}`, FIRST_GAME_IN_COOLDOWN_POINTS);
          sessionAwardedFirstGame = true;
        }
        pointsEarned += awardPoints(profile, `spike-shuffle-play-${Date.now()}`, participationPointsForPlay("spike_shuffle", { gameScore }));
        if (isNewPr) {
          pointsEarned += awardPoints(profile, `spike-shuffle-pr-${Date.now()}`, PERSONAL_RECORD_POINTS);
          track("podium_play_personal_record", { content_type: "game", content_id: "spike_shuffle" });
        }
        persist();
        renderProgress();
        track("podium_play_game_completed", { content_type: "game", content_id: "spike_shuffle", result_band: String(gameScore) });

        const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        const resultLine = `${roundsCompleted} round${roundsCompleted === 1 ? "" : "s"} correct.`;
        const prLine = isNewPr ? "New personal record." : "Can you beat it?";

        stage.innerHTML = `
          <div class="pp-stage-head"><h3>Spike Shuffle</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
          <p class="pp-result${isNewPr && !reduceMotion ? " pp-result-celebrate" : ""}">${escapeHtml(resultLine)}</p>
          <p class="pp-pr">Score: ${gameScore}</p>
          <p class="pp-pr">${escapeHtml(prLine)}</p>
          ${pointsEarned > 0 ? `<p class="pp-score">+${pointsEarned} Podium Points</p>` : ""}
          <button class="button button-primary pp-stage-action" type="button" data-pp-again>Play again</button>
        `;
        stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));
        stage.querySelector("[data-pp-again]").addEventListener("click", () => renderSpikeShuffleIdle(stage, games));
        announce(`${resultLine} ${prLine}`);
      }
    }

    function openRunnerSays() {
      const stage = panel.querySelector("[data-pp-stage]");
      const games = panel.querySelector("[data-pp-games]");
      if (!stage) return;
      games.hidden = true;
      stage.hidden = false;
      track("podium_play_game_started", { content_type: "game", content_id: "runner_says" });
      renderRunnerSaysIdle(stage, games);
    }

    function renderRunnerSaysIdle(stage, games) {
      const rs = profile.runnerSays;
      const prParts = [];
      if (rs.bestSequenceLength !== null) prParts.push(`Longest sequence: ${rs.bestSequenceLength}`);
      if (rs.bestScore !== null) prParts.push(`Best score: ${rs.bestScore}`);
      stage.innerHTML = `
        <div class="pp-stage-head"><h3>Runner Says</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
        <p>Watch the sequence, then repeat it in order. It grows by one symbol each round.</p>
        ${prParts.length ? `<p class="pp-pr">${escapeHtml(prParts.join(" · "))}</p>` : ""}
        <button class="button button-primary pp-stage-action" type="button" data-pp-rs-start>Start</button>
      `;
      stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));
      stage.querySelector("[data-pp-rs-start]").addEventListener("click", () => startRunnerSaysGame(stage, games));
    }

    function startRunnerSaysGame(stage, games) {
      stage.innerHTML = `
        <div class="pp-stage-head"><h3>Runner Says</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
        <p class="pp-btr-round" data-pp-rs-round>Round 1</p>
        <div class="pp-rs-grid" data-pp-rs-grid>
          ${RUNNER_SAYS_SYMBOLS.map((s, i) => `<button class="pp-rs-symbol pp-rs-symbol-${s.id}" type="button" data-pp-rs-symbol="${i}" aria-label="${escapeHtml(s.label)}" disabled><span>${s.symbol}</span></button>`).join("")}
        </div>
        <p class="pp-pace-target-hint" data-pp-rs-hint>Watch closely...</p>
      `;
      stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));

      const roundEl = stage.querySelector("[data-pp-rs-round]");
      const hintEl = stage.querySelector("[data-pp-rs-hint]");
      const symbolButtons = RUNNER_SAYS_SYMBOLS.map((_, i) => stage.querySelector(`[data-pp-rs-symbol="${i}"]`));

      // "Start with a two symbol sequence" -- per spec, not one.
      let sequence = Array.from({ length: RUNNER_SAYS_INITIAL_LENGTH }, () => runnerSaysNextSymbolIndex());
      let ended = false;
      let playbackTimer = null;
      let playerIndex = 0;
      let correctSymbolTaps = 0;
      let fastRoundCount = 0;
      let completedRounds = 0; // sequence lengths actually finished, tracked directly rather than derived from sequence.length
      let lastTapAt = 0;
      let roundIsFast = true;
      let inputLocked = true;

      function setLocked(locked) {
        inputLocked = locked;
        symbolButtons.forEach((button) => { button.disabled = locked; });
      }

      function playSequence() {
        setLocked(true);
        hintEl.textContent = "Watch the sequence...";
        const cueMs = runnerSaysCueDurationForRound(sequence.length);
        let i = 0;
        function showNext() {
          if (ended) return;
          if (i >= sequence.length) {
            setLocked(false);
            hintEl.textContent = "Your turn -- repeat it!";
            playerIndex = 0;
            roundIsFast = true;
            lastTapAt = performance.now();
            return;
          }
          const symbolIndex = sequence[i];
          symbolButtons[symbolIndex].classList.add("pp-rs-symbol-active");
          playbackTimer = setTimeout(() => {
            symbolButtons[symbolIndex].classList.remove("pp-rs-symbol-active");
            i += 1;
            playbackTimer = setTimeout(showNext, RUNNER_SAYS_CUE_GAP_MS);
          }, cueMs);
        }
        playbackTimer = setTimeout(showNext, 500);
      }

      function handleTap(symbolIndex) {
        if (ended || inputLocked) return;
        const now = performance.now();
        if (now - lastTapAt > RUNNER_SAYS_FAST_RESPONSE_THRESHOLD_MS) roundIsFast = false;
        lastTapAt = now;

        if (symbolIndex !== sequence[playerIndex]) {
          setLocked(true);
          symbolButtons[sequence[playerIndex]].classList.add("pp-rs-symbol-reveal");
          endGame();
          return;
        }
        correctSymbolTaps += 1;
        playerIndex += 1;
        if (playerIndex >= sequence.length) {
          completedRounds += 1;
          if (roundIsFast) fastRoundCount += 1;
          setLocked(true);
          hintEl.textContent = "Round complete!";
          announce(`Round ${completedRounds} complete.`);
          const nextSequence = sequence.concat([runnerSaysNextSymbolIndex()]);
          setTimeout(() => {
            if (ended) return;
            sequence = nextSequence;
            roundEl.textContent = `Round ${completedRounds + 1}`;
            playSequence();
          }, 900);
        }
      }

      function handleSymbolClick(event) { event.preventDefault(); handleTap(Number(event.currentTarget.dataset.ppRsSymbol)); }
      symbolButtons.forEach((button) => button.addEventListener("pointerdown", handleSymbolClick));

      function handleKeydown(event) {
        if (event.repeat || ended) return;
        const tag = event.target?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || event.target?.isContentEditable) return;
        const index = ["Digit1", "Digit2", "Digit3", "Digit4"].indexOf(event.code);
        if (index !== -1) { event.preventDefault(); handleTap(index); }
      }
      document.addEventListener("keydown", handleKeydown);

      currentAttempt = {
        cleanup: () => {
          ended = true;
          if (playbackTimer) clearTimeout(playbackTimer);
          symbolButtons.forEach((button) => button.removeEventListener("pointerdown", handleSymbolClick));
          document.removeEventListener("keydown", handleKeydown);
        }
      };

      playSequence();

      function endGame() {
        cancelCurrentAttempt();
        profile.runnerSays.attempts += 1;
        // completedRounds is the actual, directly-tracked count of full
        // sequences the player repeated correctly -- the length of the
        // sequence they were failing on (sequence.length) is one past
        // that, not the same number.
        const sequenceLengthReached = completedRounds;
        submitToServer("runner_says", { sequenceLengthReached, correctSymbolTaps, fastRoundCount });

        const gameScore = runnerSaysGameScore(sequenceLengthReached, correctSymbolTaps, fastRoundCount);
        const priorLength = profile.runnerSays.bestSequenceLength;
        const priorScore = profile.runnerSays.bestScore;
        const newLengthPr = priorLength === null || sequenceLengthReached > priorLength;
        const newScorePr = priorScore === null || gameScore > priorScore;
        if (newLengthPr) profile.runnerSays.bestSequenceLength = sequenceLengthReached;
        if (newScorePr) profile.runnerSays.bestScore = gameScore;
        const isNewPr = newLengthPr || newScorePr;

        let pointsEarned = 0;
        if (!sessionAwardedFirstGame) {
          pointsEarned += awardPoints(profile, `first-game-${pageSessionKey}`, FIRST_GAME_IN_COOLDOWN_POINTS);
          sessionAwardedFirstGame = true;
        }
        pointsEarned += awardPoints(profile, `runner-says-play-${Date.now()}`, participationPointsForPlay("runner_says", { gameScore }));
        if (isNewPr) {
          pointsEarned += awardPoints(profile, `runner-says-pr-${Date.now()}`, PERSONAL_RECORD_POINTS);
          track("podium_play_personal_record", { content_type: "game", content_id: "runner_says" });
        }
        persist();
        renderProgress();
        track("podium_play_game_completed", { content_type: "game", content_id: "runner_says", result_band: String(gameScore) });

        const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        const resultLine = `Reached Round ${completedRounds + 1}, completed ${sequenceLengthReached} round${sequenceLengthReached === 1 ? "" : "s"}.`;
        const prLine = isNewPr ? "New personal record." : "Can you beat it?";

        setTimeout(() => {
          if (!stage.isConnected) return;
          stage.innerHTML = `
            <div class="pp-stage-head"><h3>Runner Says</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
            <p class="pp-result${isNewPr && !reduceMotion ? " pp-result-celebrate" : ""}">${escapeHtml(resultLine)}</p>
            <p class="pp-pr">Score: ${gameScore}</p>
            <p class="pp-pr">${escapeHtml(prLine)}</p>
            ${pointsEarned > 0 ? `<p class="pp-score">+${pointsEarned} Podium Points</p>` : ""}
            <button class="button button-primary pp-stage-action" type="button" data-pp-again>Play again</button>
          `;
          stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));
          stage.querySelector("[data-pp-again]").addEventListener("click", () => renderRunnerSaysIdle(stage, games));
          announce(`${resultLine} ${prLine}`);
        }, 900);
      }
    }

    // Renders the panel and wires everything ONCE, immediately -- games
    // are available for the whole page visit, not gated behind voting
    // (see the file header). A real vote succeeding later only ever
    // reveals/updates the cooldown-status sub-section (showVoteConfirmation
    // below); it never rebuilds this markup or touches an in-progress game.
    function renderPanel() {
      buildPanelMarkup();
      renderProgress();
      loadAccount();
      loadLeaderboard();
      loadWorldRecords();

      const voteAgainButton = panel.querySelector("[data-pp-vote-again]");
      voteAgainButton?.addEventListener("click", () => {
        track("podium_play_vote_again_clicked");
        panel.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth", block: "start" });
      });

      // Both games share this same try/catch shape -- a game failing to
      // open must never take voting down with it.
      function wireGameButton(gameId, openFn) {
        panel.querySelector(`[data-pp-play="${gameId}"]`)?.addEventListener("click", () => {
          try {
            openFn();
          } catch {
            const stage = panel.querySelector("[data-pp-stage]");
            if (stage) { stage.hidden = false; stage.innerHTML = "<p>This game had a problem loading. Voting still works as usual.</p>"; }
          }
        });
      }
      wireGameButton("photo-finish", openPhotoFinish);
      wireGameButton("starting-gun", openStartingGun);
      wireGameButton("hurdle-dash", openHurdleDash);
      wireGameButton("tap-sprint", openTapSprint);
      wireGameButton("beat-the-runner", openBeatTheRunner);
      wireGameButton("memory-match", openMemoryMatch);
      wireGameButton("relay-exchange", openRelayExchange);
      wireGameButton("cone-slalom", openConeSlalom);
      wireGameButton("pace-perfect", openPacePerfect);
      wireGameButton("pack-pass", openPackPass);
      wireGameButton("finish-chute", openFinishChute);
      wireGameButton("spike-shuffle", openSpikeShuffle);
      wireGameButton("runner-says", openRunnerSays);

      track("podium_play_panel_viewed", { content_type: "award_type", content_id: root.dataset.awardType || "athlete" });
    }

    // Called on every confirmed vote (there can be more than one per page
    // visit, once each cooldown ends) -- reveals/updates the cooldown
    // status only. Deliberately does NOT call cancelCurrentAttempt(): a
    // game already in progress when a vote succeeds keeps running
    // uninterrupted, since games are no longer tied to the vote flow.
    function showVoteConfirmation(detail) {
      const { finalistName, retryAfterSeconds } = detail;

      const statusBlock = panel.querySelector("[data-pp-cooldown-status]");
      if (statusBlock) statusBlock.hidden = false;
      panel.dataset.cooldownTotal = String(retryAfterSeconds);

      const confirmedEl = panel.querySelector("[data-pp-confirmed]");
      if (confirmedEl) confirmedEl.textContent = finalistName ? `Your vote for ${finalistName} has been recorded.` : "Your vote has been recorded.";

      // A second vote (once an earlier cooldown already finished) must
      // re-hide Vote Again for the new cooldown -- showVoteAgain() below
      // only ever un-hides it, so this is the one place it's re-hidden.
      const voteAgainButton = panel.querySelector("[data-pp-vote-again]");
      if (voteAgainButton) voteAgainButton.hidden = true;

      cooldownDeadline = Date.now() + retryAfterSeconds * 1000;
      if (cooldownTimer) clearInterval(cooldownTimer);
      tickCountdown();
      cooldownTimer = setInterval(tickCountdown, 1000);
    }

    renderPanel();

    document.addEventListener("podiumwatch:vote-success", (event) => {
      try {
        showVoteConfirmation(event.detail || {});
      } catch {
        // The cooldown status failing to update must never affect the
        // vote that just succeeded, or the existing per-button cooldown
        // UI that weekly-awards.js already manages independently of this
        // file, or any game already in progress.
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    // [data-weekly-award] is the Athlete/Team of the Week pages, where the
    // panel sits inside a section that's hidden whenever there's no
    // current award period -- games become completely unreachable there
    // between voting periods (a real user report, 2026-09-02).
    // [data-podium-play-standalone] (src/pages/podiumplay.mjs, /podium-play/)
    // is the fix: the exact same panel, initialized the exact same way,
    // just never nested inside anything that can hide it -- games stay
    // playable regardless of whether any voting is currently open.
    document.querySelectorAll("[data-weekly-award], [data-podium-play-standalone]").forEach((root) => {
      try {
        initPanel(root);
      } catch {
        // Never let Podium Play's own init break the page it's on.
      }
    });
  });
})();
