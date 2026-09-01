// Podium Play account bridge -- server-authoritative points/records for a
// signed-in My Podium user, backing the public leaderboard.
//
// The guest (local-only) profile in public/scripts/podium-play.js is
// never blindly merged into an account here. A local point total can't
// be verified after the fact -- there is no record of the raw inputs
// that produced it, so there is nothing honest to check it against.
// Rather than pretend to "migrate" an unverifiable number into a trusted
// ledger, an account's real points start accumulating from the first
// game played while actually signed in, computed independently by this
// file from the same kind of raw inputs the local guest profile already
// produces (elapsed seconds, reaction ms, distance/hurdles/trophies) --
// never a client-calculated final score or point total. This is the same
// rule this whole feature was built under (never trust client-calculated
// Podium Points for account progression), just enforced here for real
// now that a public leaderboard makes a faked number worth something.
//
// The scoring functions below (photoFinishScoreBand, startingGunScoreBand,
// hurdleDashGameScore, levelForPoints) are intentionally near-identical
// to their client-side counterparts in public/scripts/podium-play.js --
// that copy exists purely for immediate on-screen feedback before a
// signed-in submission round-trips; THIS copy is the one that actually
// counts. scripts/test-podium-play-service.mjs includes a parity check
// asserting both copies agree on a real range of inputs, specifically so
// the two are never allowed to silently drift apart.
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

export const LEVELS = [
  { name: "Rookie Runner", threshold: 0 },
  { name: "Junior Varsity", threshold: 100 },
  { name: "Varsity", threshold: 300 },
  { name: "Conference Champion", threshold: 700 },
  { name: "District Champion", threshold: 1200 },
  { name: "Regional Champion", threshold: 2000 },
  { name: "State Qualifier", threshold: 3000 },
  { name: "All Ohio", threshold: 4500 },
  { name: "State Champion", threshold: 6500 },
  { name: "Podium Legend", threshold: 10000 }
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

const VALID_GAME_TYPES = new Set(["photo_finish", "starting_gun", "hurdle_dash"]);

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

  throw error("Unknown Podium Play game type.", 400, "UNKNOWN_GAME_TYPE");
}

async function getOrCreateAccount(userId, displayName) {
  const cleanedName = cleanDisplayName(displayName);
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("podium_play_accounts")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (fetchError) throw fetchError;

  if (existing) {
    // Keep the stored display name in sync with the real account name --
    // refreshed on every submission rather than only at creation, so a
    // later name change (from My Podium's own account settings) reaches
    // the leaderboard without needing a separate sync step.
    if (cleanedName && cleanedName !== existing.display_name) {
      const { data: updated, error: renameError } = await supabaseAdmin
        .from("podium_play_accounts")
        .update({ display_name: cleanedName })
        .eq("user_id", userId)
        .select("*")
        .single();
      if (renameError) throw renameError;
      return updated;
    }
    return existing;
  }

  const { data: created, error: insertError } = await supabaseAdmin
    .from("podium_play_accounts")
    .insert({ user_id: userId, display_name: cleanedName || null })
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
      }
    }
  };
}

// The one write path for a real, signed-in game attempt. `user` is the
// real Supabase Auth user object from requireMyPodiumUser() -- never a
// bare user id string, so this can always refresh the stored display
// name from the real account metadata.
export async function submitPodiumPlayAttempt({ user, gameType, rawInput }) {
  if (!VALID_GAME_TYPES.has(gameType)) {
    throw error("Unknown Podium Play game type.", 400, "UNKNOWN_GAME_TYPE");
  }
  const validated = validateRawInput(gameType, rawInput);

  const account = await getOrCreateAccount(user.id, user.user_metadata?.display_name);

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
    const { score, suspicious } = startingGunScoreBand(validated.reactionMs);
    gameScore = score;
    const priorMs = account.starting_gun_best_reaction_ms;
    isNewPr = priorMs === null || validated.reactionMs < priorMs;
    if (isNewPr) {
      updates.starting_gun_best_reaction_ms = validated.reactionMs;
      updates.starting_gun_best_suspicious = suspicious;
    }
  } else {
    gameScore = hurdleDashGameScore(validated.distance, validated.hurdlesCleared, validated.trophiesCollected);
    const newDistancePr = account.hurdle_dash_best_distance === null || validated.distance > account.hurdle_dash_best_distance;
    const newHurdlesPr = account.hurdle_dash_best_hurdles_cleared === null || validated.hurdlesCleared > account.hurdle_dash_best_hurdles_cleared;
    const newScorePr = account.hurdle_dash_best_game_score === null || gameScore > account.hurdle_dash_best_game_score;
    if (newDistancePr) updates.hurdle_dash_best_distance = Math.round(validated.distance);
    if (newHurdlesPr) updates.hurdle_dash_best_hurdles_cleared = validated.hurdlesCleared;
    if (newScorePr) updates.hurdle_dash_best_game_score = gameScore;
    isNewPr = newDistancePr || newHurdlesPr || newScorePr;
  }

  if (isNewPr) {
    award(PERSONAL_RECORD_POINTS);
  }
  updates.points = points;
  updates.points_awarded_today = pointsAwardedToday;

  const { data: saved, error: updateError } = await supabaseAdmin
    .from("podium_play_accounts")
    .update(updates)
    .eq("user_id", user.id)
    .select("*")
    .single();
  if (updateError) throw updateError;

  const rank = await getPodiumPlayRank(saved.points);
  return { ...toSummary(saved), rank, gameScore, isNewPr, pointsEarned };
}

export async function getPodiumPlayAccountSummary(user) {
  const account = await getOrCreateAccount(user.id, user.user_metadata?.display_name);
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
