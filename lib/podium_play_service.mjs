// Podium Play account bridge -- server-authoritative points/records
// backing the public leaderboard, for a signed-in My Podium user AND for
// a guest who never signs in at all (explicit direction, 2026-09-01:
// guests should be able to appear on the leaderboard too, under a
// server-assigned "podiumwatchguest####" label). See
// install/41_PODIUM_PLAY_ACCOUNTS.sql's own header for the full design
// of the two identity kinds sharing one table.
//
// The local (localStorage) guest profile in public/scripts/podium-play.js
// is never blindly merged into a server row here, for either identity
// kind. A local point total can't be verified after the fact -- there is
// no record of the raw inputs that produced it, so there is nothing
// honest to check it against. Rather than pretend to "migrate" an
// unverifiable number into a trusted ledger, a row's real points start
// accumulating from the first game actually submitted, computed
// independently by this file from the same kind of raw inputs the local
// guest profile already produces (elapsed seconds, reaction ms,
// distance/hurdles/trophies) -- never a client-calculated final score or
// point total. This is the same rule this whole feature was built under
// (never trust client-calculated Podium Points for account progression),
// enforced here for real now that a public leaderboard makes a faked
// number worth something -- and it applies equally whether the caller is
// signed in or a guest.
//
// The scoring functions below (photoFinishScoreBand, startingGunScoreBand,
// hurdleDashGameScore, levelForPoints) are intentionally near-identical
// to their client-side counterparts in public/scripts/podium-play.js --
// that copy exists purely for immediate on-screen feedback before a
// submission round-trips; THIS copy is the one that actually counts.
// scripts/test-podium-play-service.mjs includes a parity check asserting
// both copies agree on a real range of inputs, specifically so the two
// are never allowed to silently drift apart.
import { supabaseAdmin } from "./supabase-admin.mjs";

function error(message, status = 400, code = "PODIUM_PLAY_ERROR") {
  const value = new Error(message);
  value.status = status;
  value.code = code;
  return value;
}

export const DAILY_POINT_CAP = 300;
export const PERSONAL_RECORD_POINTS = 10;
// The server-side counterpart to the spec's "Return on a new day and
// complete one valid game: 10 points" -- the local guest profile's own
// "first game in a cooldown" bonus has no server-side equivalent (there
// is no cooldown session to key it to here), so this is the one activity
// bonus this file awards, once per real calendar day per account.
export const DAILY_ACTIVITY_POINTS = 10;

// A generous floor, not a throttle on real play -- every game already
// has its own real minimum completion time (Photo Finish >=1s, Starting
// Gun waits through a real 1.5-4s delay, Hurdle Dash takes real
// gameplay time), so this only ever catches a scripted flood.
const RATE_LIMIT_MIN_INTERVAL_MS = 1200;

const PHOTO_FINISH_TARGET_SECONDS = 15;
const PHOTO_FINISH_MIN_VALID_SECONDS = 1;
const PHOTO_FINISH_MAX_VALID_SECONDS = 120; // generous upper bound -- rejects only obviously-impossible/malformed input

const STARTING_GUN_MAX_VALID_MS = 10000;

const HURDLE_DASH_MAX_VALID_DISTANCE = 500000;
const HURDLE_DASH_MAX_VALID_HURDLES = 100000;
const HURDLE_DASH_MAX_VALID_TROPHIES = 100000;
const HURDLE_DASH_DISTANCE_PER_SCORE_UNIT = 10;
const HURDLE_DASH_HURDLE_CLEAR_POINTS = 25;
const HURDLE_DASH_TROPHY_POINTS = 40;

const TAP_SPRINT_DISTANCE_PER_TAP = 12;
// The real physical ceiling: a 10-second run with the client's own
// 65ms-per-tap rate-limit floor allows at most ~153 taps
// (10000/65 = 153.8); 165 leaves a small margin for real timing jitter
// without opening the door to an actually unrealistic score.
const TAP_SPRINT_MAX_VALID_TAPS = 165;

export function tapSprintDistanceForTaps(taps) {
  return Math.max(0, Number(taps) || 0) * TAP_SPRINT_DISTANCE_PER_TAP;
}

// Matches public/scripts/podium-play.js's own BEAT_THE_RUNNER_ROUNDS
// length -- a completed-round count can never exceed the real number of
// rounds that exist.
const BEAT_THE_RUNNER_ROUND_COUNT = 8;

const MEMORY_MATCH_PAIR_COUNT = 3;
// A generous but real floor and ceiling -- a genuine 3-pair board cannot
// be won in fewer than 3 moves (the best possible: every first flip of a
// pair immediately matches), and a real client-side rate limit (the
// mismatch-flip delay) bounds how many moves are physically possible in
// any real amount of time; these are deliberately generous outer bounds,
// not a tight simulation of optimal play.
const MEMORY_MATCH_MIN_VALID_MOVES = MEMORY_MATCH_PAIR_COUNT;
const MEMORY_MATCH_MAX_VALID_MOVES = 500;
const MEMORY_MATCH_MIN_VALID_TIME_MS = 500; // a real board cannot be solved faster than this
const MEMORY_MATCH_MAX_VALID_TIME_MS = 30 * 60 * 1000; // 30 minutes -- generous, rejects only a clearly malformed/stale value

// The exact 15 names and their order are a fixed product requirement
// (2026-09-01) -- never renamed, removed, combined, or reordered. This
// is the server-authoritative copy; public/scripts/podium-play.js keeps
// its own (a browser script and a Node module can't literally share one
// file without a bundler this project doesn't have) -- the parity test
// below is what keeps the two from silently drifting apart.
//
// Level is never stored anywhere -- always computed fresh from real
// points via levelForPoints() -- so widening these thresholds
// automatically re-derives the correct level for every existing
// account's already-earned points the next time it's read. No
// migration, no reset: this change never touches the points column.
export const LEVELS = [
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

export function levelForPoints(points) {
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
    progress: next ? Math.min(1, Math.max(0, (safePoints - current.threshold) / (next.threshold - current.threshold))) : 1
  };
}

export function photoFinishScoreBand(diffSeconds) {
  const diffHundredths = Math.round(Math.abs(diffSeconds) * 100);
  if (diffHundredths === 0) return 1000;
  if (diffHundredths <= 1) return 750;
  if (diffHundredths <= 5) return 500;
  if (diffHundredths <= 10) return 300;
  if (diffHundredths <= 25) return 150;
  if (diffHundredths <= 50) return 75;
  return 20;
}

export function startingGunScoreBand(reactionMs) {
  const ms = Math.round(reactionMs);
  if (ms < 150) return { score: 1000, suspicious: true };
  if (ms <= 199) return { score: 750, suspicious: false };
  if (ms <= 249) return { score: 500, suspicious: false };
  if (ms <= 299) return { score: 300, suspicious: false };
  if (ms <= 399) return { score: 150, suspicious: false };
  if (ms <= 599) return { score: 75, suspicious: false };
  return { score: 20, suspicious: false };
}

export function hurdleDashGameScore(distance, hurdlesCleared, trophiesCollected) {
  const distancePoints = Math.floor(Math.max(0, Number(distance) || 0) / HURDLE_DASH_DISTANCE_PER_SCORE_UNIT);
  const hurdlePoints = Math.max(0, Number(hurdlesCleared) || 0) * HURDLE_DASH_HURDLE_CLEAR_POINTS;
  const trophyPoints = Math.max(0, Number(trophiesCollected) || 0) * HURDLE_DASH_TROPHY_POINTS;
  return distancePoints + hurdlePoints + trophyPoints;
}

// Real per-play points (2026-09-01) -- before this, a submission that
// wasn't a brand-new personal record earned nothing at all beyond the
// once-a-day activity bonus, which made leveling up far too slow for
// any real, engaged player (confirmed: the only two point sources were
// DAILY_ACTIVITY_POINTS once/day and PERSONAL_RECORD_POINTS, which stops
// firing almost immediately once a player has a few real plays in). This
// awards every valid submission a real amount scaled to how well it was
// actually played -- min floor keeps every valid attempt worth something,
// the max keeps a single play from ever rivaling a whole day's worth of
// varied real play, and both the existing per-submission rate limit and
// DAILY_POINT_CAP still govern the ceiling on how fast this can be
// farmed. Each game's own STRONG_* reference is a deliberately generous
// "very good real play" benchmark, not a max-possible value -- reaching
// or exceeding it earns the max, same as the other games.
export const MIN_PARTICIPATION_POINTS = 1;
export const MAX_PARTICIPATION_POINTS = 25;
const PHOTO_FINISH_SCORE_MAX = 1000; // matches photoFinishScoreBand's own perfect-hit value
const STARTING_GUN_SCORE_MAX = 1000; // matches startingGunScoreBand's own <150ms value
const HURDLE_DASH_STRONG_SCORE = 500; // a strong, real single run
const TAP_SPRINT_STRONG_DISTANCE = 900; // ~75 real alternating taps in 10s -- a fast, skilled pace
const MEMORY_MATCH_STRONG_TIME_MS = 6000;
const MEMORY_MATCH_SLOW_VALID_TIME_MS = 25000; // still a real, valid solve -- just not a fast one

function participationScale(ratio) {
  const safeRatio = Number.isFinite(ratio) ? ratio : 0; // NaN/Infinity (e.g. a malformed gameScore) never crashes or breaks the clamp -- worst case, the participation floor
  const clamped = Math.min(1, Math.max(0, safeRatio));
  return Math.min(MAX_PARTICIPATION_POINTS, Math.max(MIN_PARTICIPATION_POINTS, Math.round(1 + clamped * (MAX_PARTICIPATION_POINTS - 1))));
}

// Pure and exported so both this file's own scoring and the client-side
// preview copy (public/scripts/podium-play.js) can be parity-tested
// against each other, same as every other scoring function here.
// `suspicious` only applies to starting_gun: a flagged (likely
// auto-clicked, <150ms) reading is floored to the minimum rather than
// scored normally -- without this, a scripted sub-150ms "reaction" would
// otherwise earn the max every single round, since Starting Gun's real
// per-round wait (a genuine 1.5-4s delay) is the only other real friction
// standing between a bot and the daily cap.
export function participationPointsForPlay(gameType, { gameScore = 0, suspicious = false } = {}) {
  if (gameType === "photo_finish") return participationScale(gameScore / PHOTO_FINISH_SCORE_MAX);
  if (gameType === "starting_gun") return suspicious ? MIN_PARTICIPATION_POINTS : participationScale(gameScore / STARTING_GUN_SCORE_MAX);
  if (gameType === "hurdle_dash") return participationScale(gameScore / HURDLE_DASH_STRONG_SCORE);
  if (gameType === "tap_sprint") return participationScale(gameScore / TAP_SPRINT_STRONG_DISTANCE);
  if (gameType === "beat_the_runner") return participationScale(gameScore / BEAT_THE_RUNNER_ROUND_COUNT);
  if (gameType === "memory_match") {
    // Lower time is better -- invert onto the same "higher ratio is
    // better" scale the other games use, rather than a second code path.
    const span = MEMORY_MATCH_SLOW_VALID_TIME_MS - MEMORY_MATCH_STRONG_TIME_MS;
    const ratio = (MEMORY_MATCH_SLOW_VALID_TIME_MS - gameScore) / span;
    return participationScale(ratio);
  }
  return MIN_PARTICIPATION_POINTS;
}

function todayDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

// Strips control characters and caps length -- real hygiene, not a
// profanity filter (this codebase has no such utility anywhere; a real,
// disclosed limitation on what "moderated" means here, not a silent gap
// -- see this file's own header and install/41's comment).
export function cleanDisplayName(value) {
  return String(value ?? "")
    .split("").filter((ch) => ch.codePointAt(0) > 0x1F && ch.codePointAt(0) !== 0x7F).join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

// A guest's identity is the SAME anonymous crypto.randomUUID() the local
// guest profile already generates and persists in localStorage (see
// install/41's own header) -- validated as a real UUID shape, but never
// authenticated the way a real My Podium session is. Nothing server-side
// proves a given install_id actually belongs to the browser presenting
// it; validateRawInput's range checks and the per-identity rate limit
// below are what keep a guest row honest, not this check.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidInstallId(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

// A guest's server-assigned display label -- never client-supplied, so a
// guest can never pick an impersonating or offensive name (see this
// file's own header and install/41's for why that matters once a name
// can appear on a public leaderboard). Assigned once per install_id, at
// first creation, and reused on every later submission from that same
// device -- exported so scripts/test-podium-play-service.mjs can assert
// the real "podiumwatchguest####" shape without needing a live database.
export function generateGuestLabel(randomFn = Math.random) {
  const number = Math.floor(randomFn() * 9000) + 1000; // a real 4-digit number, 1000-9999
  return `podiumwatchguest${number}`;
}

const VALID_GAME_TYPES = new Set(["photo_finish", "starting_gun", "hurdle_dash", "tap_sprint", "beat_the_runner", "memory_match"]);

// Validates and narrows the raw client-reported input for one game type.
// Never trusts a computed score/points value from the client -- only the
// same kind of raw measurement the local guest profile already produces
// (elapsed time, reaction time, distance/hurdles/trophies), range-checked
// against generous but real physical bounds.
export function validateRawInput(gameType, rawInput) {
  if (gameType === "photo_finish") {
    const elapsedSeconds = Number(rawInput?.elapsedSeconds);
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < PHOTO_FINISH_MIN_VALID_SECONDS || elapsedSeconds > PHOTO_FINISH_MAX_VALID_SECONDS) {
      throw error("That Photo Finish result isn't valid.", 422, "INVALID_PHOTO_FINISH_RESULT");
    }
    return { elapsedSeconds };
  }

  if (gameType === "starting_gun") {
    const reactionMs = Number(rawInput?.reactionMs);
    if (!Number.isFinite(reactionMs) || reactionMs < 0 || reactionMs > STARTING_GUN_MAX_VALID_MS) {
      throw error("That Starting Gun result isn't valid.", 422, "INVALID_STARTING_GUN_RESULT");
    }
    return { reactionMs };
  }

  if (gameType === "hurdle_dash") {
    const distance = Number(rawInput?.distance);
    const hurdlesCleared = Number(rawInput?.hurdlesCleared);
    const trophiesCollected = Number(rawInput?.trophiesCollected);
    if (!Number.isFinite(distance) || distance < 0 || distance > HURDLE_DASH_MAX_VALID_DISTANCE) {
      throw error("That Hurdle Dash distance isn't valid.", 422, "INVALID_HURDLE_DASH_RESULT");
    }
    if (!Number.isInteger(hurdlesCleared) || hurdlesCleared < 0 || hurdlesCleared > HURDLE_DASH_MAX_VALID_HURDLES) {
      throw error("That Hurdle Dash hurdle count isn't valid.", 422, "INVALID_HURDLE_DASH_RESULT");
    }
    if (!Number.isInteger(trophiesCollected) || trophiesCollected < 0 || trophiesCollected > HURDLE_DASH_MAX_VALID_TROPHIES) {
      throw error("That Hurdle Dash trophy count isn't valid.", 422, "INVALID_HURDLE_DASH_RESULT");
    }
    return { distance, hurdlesCleared, trophiesCollected };
  }

  if (gameType === "tap_sprint") {
    const taps = Number(rawInput?.taps);
    if (!Number.isInteger(taps) || taps < 0 || taps > TAP_SPRINT_MAX_VALID_TAPS) {
      throw error("That Tap Sprint result isn't valid.", 422, "INVALID_TAP_SPRINT_RESULT");
    }
    return { taps };
  }

  if (gameType === "beat_the_runner") {
    const highestRoundCompleted = Number(rawInput?.highestRoundCompleted);
    if (!Number.isInteger(highestRoundCompleted) || highestRoundCompleted < 0 || highestRoundCompleted > BEAT_THE_RUNNER_ROUND_COUNT) {
      throw error("That Beat the Runner result isn't valid.", 422, "INVALID_BEAT_THE_RUNNER_RESULT");
    }
    return { highestRoundCompleted };
  }

  if (gameType === "memory_match") {
    const timeMs = Number(rawInput?.timeMs);
    const moves = Number(rawInput?.moves);
    if (!Number.isFinite(timeMs) || timeMs < MEMORY_MATCH_MIN_VALID_TIME_MS || timeMs > MEMORY_MATCH_MAX_VALID_TIME_MS) {
      throw error("That Memory Match time isn't valid.", 422, "INVALID_MEMORY_MATCH_RESULT");
    }
    if (!Number.isInteger(moves) || moves < MEMORY_MATCH_MIN_VALID_MOVES || moves > MEMORY_MATCH_MAX_VALID_MOVES) {
      throw error("That Memory Match move count isn't valid.", 422, "INVALID_MEMORY_MATCH_RESULT");
    }
    return { timeMs, moves };
  }

  throw error("Unknown Podium Play game type.", 400, "UNKNOWN_GAME_TYPE");
}

// Exactly one of userId/installId must be set -- callers (submitPodiumPlayAttempt,
// getPodiumPlayAccountSummary) are responsible for that check, matching
// install/41's own identity_check constraint as a second, real backstop.
async function getOrCreateAccount({ userId, installId, displayName }) {
  const column = userId ? "user_id" : "install_id";
  const value = userId || installId;
  // A guest's display name is always server-assigned (generateGuestLabel),
  // never taken from client input -- only a real, signed-in My Podium
  // account's own real display name is ever cleaned and stored here.
  const cleanedName = userId ? cleanDisplayName(displayName) : null;

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("podium_play_accounts")
    .select("*")
    .eq(column, value)
    .maybeSingle();
  if (fetchError) throw fetchError;

  if (existing) {
    // Keep a signed-in row's stored display name in sync with the real
    // account name -- refreshed on every submission rather than only at
    // creation, so a later name change (from My Podium's own account
    // settings) reaches the leaderboard without needing a separate sync
    // step. A guest row's label never changes once assigned.
    if (userId && cleanedName && cleanedName !== existing.display_name) {
      const { data: updated, error: renameError } = await supabaseAdmin
        .from("podium_play_accounts")
        .update({ display_name: cleanedName })
        .eq(column, value)
        .select("*")
        .single();
      if (renameError) throw renameError;
      return updated;
    }
    return existing;
  }

  const initialName = userId ? (cleanedName || null) : generateGuestLabel();
  const { data: created, error: insertError } = await supabaseAdmin
    .from("podium_play_accounts")
    .insert({ [column]: value, display_name: initialName })
    .select("*")
    .single();
  if (insertError) throw insertError;
  return created;
}

function toSummary(account) {
  const level = levelForPoints(account.points);
  return {
    points: account.points,
    level,
    displayName: account.display_name || null,
    records: {
      photoFinish: account.photo_finish_best_diff_seconds === null ? null : {
        diffSeconds: account.photo_finish_best_diff_seconds,
        elapsedSeconds: account.photo_finish_best_elapsed_seconds
      },
      startingGun: account.starting_gun_best_reaction_ms === null ? null : {
        reactionMs: account.starting_gun_best_reaction_ms,
        suspicious: account.starting_gun_best_suspicious === true
      },
      hurdleDash: {
        bestDistance: account.hurdle_dash_best_distance,
        bestHurdlesCleared: account.hurdle_dash_best_hurdles_cleared,
        bestGameScore: account.hurdle_dash_best_game_score
      },
      tapSprint: { bestDistance: account.tap_sprint_best_distance },
      beatTheRunner: { bestRoundReached: account.beat_the_runner_best_round },
      memoryMatch: { bestTimeMs: account.memory_match_best_time_ms, fewestMoves: account.memory_match_fewest_moves }
    }
  };
}

// The one write path for a real game attempt, signed in or guest. `user`
// is the real Supabase Auth user object from requireMyPodiumUser() when
// signed in (never a bare user id string, so this can always refresh the
// stored display name from the real account metadata) -- pass null for a
// guest submission and a validated `installId` instead.
export async function submitPodiumPlayAttempt({ user, installId, gameType, rawInput }) {
  if (!user && !isValidInstallId(installId)) {
    throw error("A valid guest identity is required.", 400, "INVALID_GUEST_IDENTITY");
  }
  if (!VALID_GAME_TYPES.has(gameType)) {
    throw error("Unknown Podium Play game type.", 400, "UNKNOWN_GAME_TYPE");
  }
  const validated = validateRawInput(gameType, rawInput);

  const account = await getOrCreateAccount({
    userId: user?.id || null,
    installId: user ? null : installId,
    displayName: user?.user_metadata?.display_name
  });

  if (account.last_submission_at) {
    const sinceLast = Date.now() - new Date(account.last_submission_at).getTime();
    if (sinceLast < RATE_LIMIT_MIN_INTERVAL_MS) {
      throw error("Please slow down before submitting another result.", 429, "PODIUM_PLAY_RATE_LIMITED");
    }
  }

  const today = todayDateKey();
  let pointsAwardedToday = account.points_awarded_date === today ? account.points_awarded_today : 0;
  let points = account.points;
  let pointsEarned = 0;

  function award(amount) {
    const remaining = Math.max(0, DAILY_POINT_CAP - pointsAwardedToday);
    const granted = Math.max(0, Math.min(amount, remaining));
    if (granted > 0) {
      points += granted;
      pointsAwardedToday += granted;
      pointsEarned += granted;
    }
    return granted;
  }

  // The daily activity bonus -- once per real calendar day per account,
  // for the first valid submission of any kind that day.
  const isFirstSubmissionToday = account.points_awarded_date !== today;
  if (isFirstSubmissionToday) {
    award(DAILY_ACTIVITY_POINTS);
  }

  const updates = {
    points,
    points_awarded_date: today,
    points_awarded_today: pointsAwardedToday,
    last_submission_at: new Date().toISOString()
  };

  let gameScore = 0;
  let isNewPr = false;
  let suspicious = false; // only ever set true for starting_gun; read by participationPointsForPlay below

  if (gameType === "photo_finish") {
    const roundedElapsed = Math.round(validated.elapsedSeconds * 100) / 100;
    const diff = Math.round(Math.abs(roundedElapsed - PHOTO_FINISH_TARGET_SECONDS) * 100) / 100;
    gameScore = photoFinishScoreBand(diff);
    const priorDiff = account.photo_finish_best_diff_seconds;
    isNewPr = priorDiff === null || diff < priorDiff;
    if (isNewPr) {
      updates.photo_finish_best_diff_seconds = diff;
      updates.photo_finish_best_elapsed_seconds = roundedElapsed;
    }
  } else if (gameType === "starting_gun") {
    const band = startingGunScoreBand(validated.reactionMs);
    gameScore = band.score;
    suspicious = band.suspicious;
    const priorMs = account.starting_gun_best_reaction_ms;
    isNewPr = priorMs === null || validated.reactionMs < priorMs;
    if (isNewPr) {
      updates.starting_gun_best_reaction_ms = validated.reactionMs;
      updates.starting_gun_best_suspicious = suspicious;
    }
  } else if (gameType === "hurdle_dash") {
    gameScore = hurdleDashGameScore(validated.distance, validated.hurdlesCleared, validated.trophiesCollected);
    const newDistancePr = account.hurdle_dash_best_distance === null || validated.distance > account.hurdle_dash_best_distance;
    const newHurdlesPr = account.hurdle_dash_best_hurdles_cleared === null || validated.hurdlesCleared > account.hurdle_dash_best_hurdles_cleared;
    const newScorePr = account.hurdle_dash_best_game_score === null || gameScore > account.hurdle_dash_best_game_score;
    if (newDistancePr) updates.hurdle_dash_best_distance = Math.round(validated.distance);
    if (newHurdlesPr) updates.hurdle_dash_best_hurdles_cleared = validated.hurdlesCleared;
    if (newScorePr) updates.hurdle_dash_best_game_score = gameScore;
    isNewPr = newDistancePr || newHurdlesPr || newScorePr;
  } else if (gameType === "tap_sprint") {
    gameScore = Math.round(tapSprintDistanceForTaps(validated.taps));
    const priorBest = account.tap_sprint_best_distance;
    isNewPr = priorBest === null || gameScore > priorBest;
    if (isNewPr) updates.tap_sprint_best_distance = gameScore;
  } else if (gameType === "beat_the_runner") {
    gameScore = validated.highestRoundCompleted;
    const priorBest = account.beat_the_runner_best_round;
    isNewPr = priorBest === null || validated.highestRoundCompleted > priorBest;
    if (isNewPr) updates.beat_the_runner_best_round = validated.highestRoundCompleted;
  } else {
    // memory_match -- two independent bests, same shape as Hurdle Dash's
    // three (a run can set either, neither, or both).
    gameScore = validated.timeMs;
    const newTimePr = account.memory_match_best_time_ms === null || validated.timeMs < account.memory_match_best_time_ms;
    const newMovesPr = account.memory_match_fewest_moves === null || validated.moves < account.memory_match_fewest_moves;
    if (newTimePr) updates.memory_match_best_time_ms = validated.timeMs;
    if (newMovesPr) updates.memory_match_fewest_moves = validated.moves;
    isNewPr = newTimePr || newMovesPr;
  }

  award(participationPointsForPlay(gameType, { gameScore, suspicious }));
  if (isNewPr) {
    award(PERSONAL_RECORD_POINTS);
  }
  updates.points = points;
  updates.points_awarded_today = pointsAwardedToday;

  // Keyed on the row's own primary key -- works identically for a
  // signed-in row (user_id) or a guest row (install_id) without needing
  // to branch here too.
  const { data: saved, error: updateError } = await supabaseAdmin
    .from("podium_play_accounts")
    .update(updates)
    .eq("id", account.id)
    .select("*")
    .single();
  if (updateError) throw updateError;

  const rank = await getPodiumPlayRank(saved.points);
  return { ...toSummary(saved), rank, gameScore, isNewPr, pointsEarned };
}

// `user` is a real Supabase Auth user object when signed in, or null for
// a guest -- pass a validated `installId` in that case instead.
export async function getPodiumPlayAccountSummary({ user, installId }) {
  if (!user && !isValidInstallId(installId)) {
    throw error("A valid guest identity is required.", 400, "INVALID_GUEST_IDENTITY");
  }
  const account = await getOrCreateAccount({
    userId: user?.id || null,
    installId: user ? null : installId,
    displayName: user?.user_metadata?.display_name
  });
  const rank = await getPodiumPlayRank(account.points);
  return { ...toSummary(account), rank };
}

// 1-indexed rank by real points -- a real COUNT(*) aggregate (immune to
// PostgREST's 1,000-row select cap, the same discipline this codebase
// applies everywhere it counts a realistically-unbounded table; see
// docs/DECISIONS.md, 2026-08-31), not a client-side tally of a bulk
// select.
export async function getPodiumPlayRank(points) {
  const { count, error: countError } = await supabaseAdmin
    .from("podium_play_accounts")
    .select("id", { count: "exact", head: true })
    .gt("points", points);
  if (countError) throw countError;
  return (count || 0) + 1;
}

export async function getPodiumPlayLeaderboard(limit = 10) {
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));
  const { data, error: listError } = await supabaseAdmin
    .from("podium_play_accounts")
    .select("display_name, points")
    .gt("points", 0)
    .order("points", { ascending: false })
    .limit(safeLimit);
  if (listError) throw listError;

  return (data || []).map((row, index) => ({
    rank: index + 1,
    // A real account with no display name set falls back to an honest,
    // non-identifying label rather than showing a blank row -- never a
    // full name/email, matching the spec's "no full names" rule.
    displayName: row.display_name || "A Podium Watch fan",
    points: row.points,
    level: levelForPoints(row.points).name
  }));
}

// A per-game record leaderboard, separate from the points leaderboard
// above -- "who has the best/furthest Hurdle Dash distance" (2026-09-01),
// not "who has the most points." Ranked by the same real, server-
// validated hurdle_dash_best_distance every account already carries.
export async function getHurdleDashDistanceLeaderboard(limit = 10) {
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));
  const { data, error: listError } = await supabaseAdmin
    .from("podium_play_accounts")
    .select("display_name, hurdle_dash_best_distance")
    .not("hurdle_dash_best_distance", "is", null)
    .order("hurdle_dash_best_distance", { ascending: false })
    .limit(safeLimit);
  if (listError) throw listError;

  return (data || []).map((row, index) => ({
    rank: index + 1,
    displayName: row.display_name || "A Podium Watch fan",
    distance: row.hurdle_dash_best_distance
  }));
}

// One headline all-time record per game, across every real account
// (signed-in and guest together) -- "what is the world record for Photo
// Finish," not a per-player leaderboard (2026-09-01). Photo Finish's own
// record additionally reports how many different accounts have ever hit
// the target exactly (diff = 0.00s), since a plain "closest ever" list
// would just be a wall of ties at 0.00 once more than one player has
// nailed it -- the count is the actually interesting number there.
export async function getPodiumPlayWorldRecords() {
  const fanFallback = (name) => name || "A Podium Watch fan";

  async function top(column, ascending, extraFilter) {
    let query = supabaseAdmin
      .from("podium_play_accounts")
      .select(`display_name, ${column}`)
      .not(column, "is", null);
    if (extraFilter) query = extraFilter(query);
    const { data, error: queryError } = await query.order(column, { ascending }).limit(1).maybeSingle();
    if (queryError) throw queryError;
    return data || null;
  }

  const [
    photoFinishBest,
    photoFinishExactCount,
    startingGunBest,
    hurdleDashBest,
    tapSprintBest,
    beatTheRunnerBest,
    memoryMatchTimeBest,
    memoryMatchMovesBest
  ] = await Promise.all([
    top("photo_finish_best_diff_seconds", true),
    supabaseAdmin.from("podium_play_accounts").select("id", { count: "exact", head: true }).eq("photo_finish_best_diff_seconds", 0),
    // A "world record" reaction shouldn't be a flagged, likely-fake one --
    // exclude suspicious (<150ms) readings from the headline record.
    top("starting_gun_best_reaction_ms", true, (q) => q.eq("starting_gun_best_suspicious", false)),
    top("hurdle_dash_best_distance", false),
    top("tap_sprint_best_distance", false),
    top("beat_the_runner_best_round", false),
    top("memory_match_best_time_ms", true),
    top("memory_match_fewest_moves", true)
  ]);

  if (photoFinishExactCount.error) throw photoFinishExactCount.error;

  return {
    photoFinish: photoFinishBest ? {
      diffSeconds: photoFinishBest.photo_finish_best_diff_seconds,
      elapsedSeconds: photoFinishBest.photo_finish_best_elapsed_seconds,
      holder: fanFallback(photoFinishBest.display_name),
      exactHitCount: photoFinishExactCount.count || 0
    } : null,
    startingGun: startingGunBest ? {
      reactionMs: startingGunBest.starting_gun_best_reaction_ms,
      holder: fanFallback(startingGunBest.display_name)
    } : null,
    hurdleDash: hurdleDashBest ? {
      distance: hurdleDashBest.hurdle_dash_best_distance,
      holder: fanFallback(hurdleDashBest.display_name)
    } : null,
    tapSprint: tapSprintBest ? {
      distance: tapSprintBest.tap_sprint_best_distance,
      holder: fanFallback(tapSprintBest.display_name)
    } : null,
    beatTheRunner: beatTheRunnerBest ? {
      round: beatTheRunnerBest.beat_the_runner_best_round,
      holder: fanFallback(beatTheRunnerBest.display_name)
    } : null,
    memoryMatch: {
      fastestTime: memoryMatchTimeBest ? {
        timeMs: memoryMatchTimeBest.memory_match_best_time_ms,
        holder: fanFallback(memoryMatchTimeBest.display_name)
      } : null,
      fewestMoves: memoryMatchMovesBest ? {
        moves: memoryMatchMovesBest.memory_match_fewest_moves,
        holder: fanFallback(memoryMatchMovesBest.display_name)
      } : null
    }
  };
}
