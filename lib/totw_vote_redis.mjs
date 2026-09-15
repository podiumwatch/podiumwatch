// Team of the Week vote tallying, on Redis instead of Supabase rows
// (2026-09-15 pilot). Root cause this replaces: the real Supabase Disk
// IO Budget outage (2026-08-31, see docs/DECISIONS.md) was driven by
// sustained vote-spam -- 53,000+ rows in one week's worth of aotw_votes
// alone -- because the old design wrote one Postgres row per vote and
// counted them with COUNT(*). Redis counters don't have that problem:
// a vote is one INCR against a small, fixed set of keys per week, not a
// new row.
//
// Scope: Team of the Week only, for now. Athlete of the Week keeps its
// existing Supabase cast_totw_vote-style RPC (aotw's own, cast_aotw_vote)
// unchanged -- this is a pilot on the award with zero votes cast yet
// this week, not a full cutover. Finalists/nominations/weeks themselves
// stay on Supabase either way (low volume, admin-controlled, not
// spam-exposed) -- only the high-volume vote/cooldown writes move.
//
// Cooldown design mirrors the existing (now-replaced) cast_totw_vote RPC
// exactly: one cooldown per (week, voter), not per finalist -- confirmed
// against that RPC's own behavior via totw_vote_cooldowns' real schema
// (voter_hash, category), and TOTW now has exactly one category
// ("overall") for every finalist, so a voter's cooldown was always
// shared across the whole list, not scoped to one team. A voter can't
// beat the cooldown by switching which team they vote for.
import { redisAdmin } from "./redis-admin.mjs";

// Refreshed on every write so a week's keys don't outlive their
// usefulness by more than this, but with enormous margin over how long
// anyone actually needs the numbers -- winners are announced within days
// of voting closing, not months. Keeps Redis storage bounded across a
// full season without needing a manual cleanup step, the same shape as
// the "old decided weeks' vote rows already cleaned up as a stopgap"
// mitigation this whole migration exists to make unnecessary going
// forward.
const KEY_TTL_SECONDS = 60 * 60 * 24 * 60; // 60 days

function voteCountKey(weekId, finalistId) {
  return `totw:votes:${weekId}:${finalistId}`;
}

function cooldownKey(weekId, voterHash) {
  return `totw:cooldown:${weekId}:${voterHash}`;
}

function voterSetKey(weekId) {
  return `totw:voters:${weekId}`;
}

function totalVotesKey(weekId) {
  return `totw:total-votes:${weekId}`;
}

// Attempts to cast one vote. Returns the same shape the old
// cast_totw_vote RPC returned to api/totw/vote.js, so that file's own
// response handling needed no changes: { accepted, reason?,
// retry_after_seconds? }.
export async function castRedisVote({ weekId, finalistId, voterHash, cooldownSeconds }) {
  if (!weekId || !finalistId || !voterHash) {
    return { accepted: false, reason: "invalid_voter" };
  }

  const key = cooldownKey(weekId, voterHash);
  // SET ... NX EX is the same atomic check-and-set primitive the
  // previous Postgres RPC used a unique constraint for -- only one
  // caller can ever win this race for a given (week, voter) within the
  // cooldown window, verified live against the real database (a second
  // NX set while the first is still active returns null, not an error).
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
  pipeline.incr(voteCountKey(weekId, finalistId));
  pipeline.expire(voteCountKey(weekId, finalistId), KEY_TTL_SECONDS);
  pipeline.incr(totalVotesKey(weekId));
  pipeline.expire(totalVotesKey(weekId), KEY_TTL_SECONDS);
  pipeline.sadd(voterSetKey(weekId), voterHash);
  pipeline.expire(voterSetKey(weekId), KEY_TTL_SECONDS);
  await pipeline.exec();

  return { accepted: true };
}

// Real vote count per finalist, in the same order as the ids passed in
// -- mirrors the shape api/totw/current.js and awards_service.mjs's
// getWeekDetail() both already build from their old per-finalist
// Supabase count("exact", head:true) queries, so the call sites only
// needed their data source swapped, not their own logic.
export async function getRedisVoteCounts({ weekId, finalistIds }) {
  if (!finalistIds.length) return [];
  const keys = finalistIds.map((finalistId) => voteCountKey(weekId, finalistId));
  const values = await redisAdmin.mget(...keys);
  return values.map((value) => Number(value) || 0);
}

// Mirrors getWeekDetail()'s existing { total_votes_cast, distinct_voters }
// shape, previously built by paging through every totw_votes row for the
// week and de-duplicating voter_hash client-side -- SCARD is the same
// number without ever fetching the individual hashes.
export async function getRedisVoteStats({ weekId }) {
  const [total, distinct] = await Promise.all([
    redisAdmin.get(totalVotesKey(weekId)),
    redisAdmin.scard(voterSetKey(weekId))
  ]);

  return {
    totalVotesCast: Number(total) || 0,
    distinctVoters: Number(distinct) || 0
  };
}
