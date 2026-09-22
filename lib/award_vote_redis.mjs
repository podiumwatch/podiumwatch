// Weekly award vote tallying, on Redis instead of Supabase rows.
// Root cause this replaces: the real Supabase Disk IO Budget outage
// (2026-08-31, see docs/DECISIONS.md) was driven by sustained
// vote-spam -- 53,000+ rows in one week's worth of aotw_votes alone --
// because the old design wrote one Postgres row per vote and counted
// them with COUNT(*). Redis counters don't have that problem: a vote
// is one INCR against a small, fixed set of keys per week, not a new
// row.
//
// Originally built and piloted for Team of the Week only (2026-09-15,
// as totw_vote_redis.mjs); Athlete of the Week moved onto the same
// module (2026-09-21) once the pilot held up under real vote volume
// with no further issues. Shared by both awards, parameterized by
// `award` ('aotw' | 'totw') so the Redis keys for each award never
// collide -- finalists/nominations/weeks themselves stay on Supabase
// either way (low volume, admin-controlled, not spam-exposed) -- only
// the high-volume vote/cooldown writes live here.
//
// Cooldown design mirrors each award's previous Postgres RPC exactly:
// one cooldown per (week, voter), not per finalist. For TOTW this was
// confirmed against the old cast_totw_vote RPC's real
// totw_vote_cooldowns schema (voter_hash, category), and TOTW has
// exactly one category ("overall") for every finalist, so a voter's
// cooldown was always shared across the whole list. For AOTW, the old
// cast_aotw_vote RPC enforced the same per-(week, voter) shape even
// though AOTW finalists carry a real boys/girls category (2026-09-14) --
// voting itself was never split by category, only winner-selection was
// (see lib/awards_service.mjs's aotw config) -- so the identical
// per-week cooldown key here is correct for both awards, not just a
// convenient reuse.
import { redisAdmin } from "./redis-admin.mjs";

const VALID_AWARDS = new Set(["aotw", "totw"]);

function assertAward(award) {
  if (!VALID_AWARDS.has(award)) {
    throw new Error(`award_vote_redis.mjs: unknown award "${award}" (expected "aotw" or "totw").`);
  }
}

// Refreshed on every write so a week's keys don't outlive their
// usefulness by more than this, but with enormous margin over how long
// anyone actually needs the numbers -- winners are announced within days
// of voting closing, not months. Keeps Redis storage bounded across a
// full season without needing a manual cleanup step, the same shape as
// the "old decided weeks' vote rows already cleaned up as a stopgap"
// mitigation this whole migration exists to make unnecessary going
// forward.
const KEY_TTL_SECONDS = 60 * 60 * 24 * 60; // 60 days

function voteCountKey(award, weekId, finalistId) {
  return `${award}:votes:${weekId}:${finalistId}`;
}

function cooldownKey(award, weekId, voterHash) {
  return `${award}:cooldown:${weekId}:${voterHash}`;
}

function voterSetKey(award, weekId) {
  return `${award}:voters:${weekId}`;
}

function totalVotesKey(award, weekId) {
  return `${award}:total-votes:${weekId}`;
}

// Attempts to cast one vote. Returns the same shape the old
// cast_totw_vote/cast_aotw_vote RPCs returned to api/totw/vote.js and
// api/aotw/vote.js, so neither file's own response handling needed to
// change: { accepted, reason?, retry_after_seconds? }.
export async function castRedisVote({ award, weekId, finalistId, voterHash, cooldownSeconds }) {
  assertAward(award);

  if (!weekId || !finalistId || !voterHash) {
    return { accepted: false, reason: "invalid_voter" };
  }

  const key = cooldownKey(award, weekId, voterHash);
  // SET ... NX EX is the same atomic check-and-set primitive the
  // previous Postgres RPCs used a unique constraint for -- only one
  // caller can ever win this race for a given (award, week, voter)
  // within the cooldown window, verified live against the real database
  // (a second NX set while the first is still active returns null, not
  // an error).
  const acquired = await redisAdmin.set(key, "1", { nx: true, ex: cooldownSeconds });

  if (!acquired) {
    const ttl = await redisAdmin.ttl(key);
    return {
      accepted: false,
      reason: "cooldown",
      retry_after_seconds: ttl > 0 ? ttl : cooldownSeconds
    };
  }

  const pipeline = redisAdmin.pipeline();
  pipeline.incr(voteCountKey(award, weekId, finalistId));
  pipeline.expire(voteCountKey(award, weekId, finalistId), KEY_TTL_SECONDS);
  pipeline.incr(totalVotesKey(award, weekId));
  pipeline.expire(totalVotesKey(award, weekId), KEY_TTL_SECONDS);
  pipeline.sadd(voterSetKey(award, weekId), voterHash);
  pipeline.expire(voterSetKey(award, weekId), KEY_TTL_SECONDS);
  await pipeline.exec();

  return { accepted: true };
}

// Real vote count per finalist, in the same order as the ids passed in
// -- mirrors the shape api/totw/current.js, api/aotw/current.js, and
// awards_service.mjs's getWeekDetail() all already build from their old
// per-finalist Supabase count("exact", head:true) queries, so each call
// site only needed its data source swapped, not its own logic.
export async function getRedisVoteCounts({ award, weekId, finalistIds }) {
  assertAward(award);
  if (!finalistIds.length) return [];
  const keys = finalistIds.map((finalistId) => voteCountKey(award, weekId, finalistId));
  const values = await redisAdmin.mget(...keys);
  return values.map((value) => Number(value) || 0);
}

// Mirrors getWeekDetail()'s existing { total_votes_cast, distinct_voters }
// shape, previously built by paging through every *_votes row for the
// week and de-duplicating the voter hash client-side -- SCARD is the
// same number without ever fetching the individual hashes.
export async function getRedisVoteStats({ award, weekId }) {
  assertAward(award);
  const [total, distinct] = await Promise.all([
    redisAdmin.get(totalVotesKey(award, weekId)),
    redisAdmin.scard(voterSetKey(award, weekId))
  ]);

  return {
    totalVotesCast: Number(total) || 0,
    distinctVoters: Number(distinct) || 0
  };
}
