// 2026 Athlete, Team and Coach of the Year: vote storage on Redis.
// Separate from lib/award_vote_redis.mjs (the weekly aotw/totw module,
// which is left alone) and under its own yoty2026: namespace.
//
// One vote per category per browser, as a hard limit: each category has a
// hash of browser-token-hash -> finalist key, written with HSETNX, so a
// second vote from the same browser is refused and can't change the
// first. Counts are tallied from that hash when the admin asks, so voiding
// a vote is just moving it out of the hash; there are no counters to drift.
//
// Keys, per category slug:
//   yoty2026:votes:<slug>   token hash -> finalist key (counted votes)
//   yoty2026:ipof:<slug>    token hash -> address hash (for voiding)
//   yoty2026:ip:<slug>      address hash -> votes from that address
//   yoty2026:void:<slug>    token hash -> JSON of the voided vote
// Address counts are only for flagging in the admin. A whole school can
// share one network, so heavy addresses are never blocked.

const PREFIX = "yoty2026";
const KEY_TTL_SECONDS = 60 * 60 * 24 * 120;

let testClient = null;
// Tests only: swap in an in-memory client (tests/yearly-awards-2026.test.mjs).
export function useRedisClientForTests(client) {
  testClient = client;
}

async function redis() {
  if (testClient) return testClient;
  const { redisAdmin } = await import("./redis-admin.mjs");
  return redisAdmin;
}

const keys = (slug) => ({
  votes: `${PREFIX}:votes:${slug}`,
  ipOf: `${PREFIX}:ipof:${slug}`,
  ip: `${PREFIX}:ip:${slug}`,
  void: `${PREFIX}:void:${slug}`
});

// Returns { accepted: true } or { accepted: false, votedFor }.
export async function castYearlyVote({ slug, finalistKey, tokenHash, ipHash }) {
  const client = await redis();
  const k = keys(slug);
  // A browser whose vote was voided can't vote again in that category.
  if (await client.hexists(k.void, tokenHash)) return { accepted: false, votedFor: null, voided: true };
  const added = await client.hsetnx(k.votes, tokenHash, finalistKey);
  if (!added) {
    const votedFor = await client.hget(k.votes, tokenHash);
    return { accepted: false, votedFor: votedFor == null ? null : String(votedFor) };
  }
  const pipeline = client.pipeline();
  pipeline.hset(k.ipOf, { [tokenHash]: ipHash });
  pipeline.hincrby(k.ip, ipHash, 1);
  for (const key of Object.values(k)) pipeline.expire(key, KEY_TTL_SECONDS);
  await pipeline.exec();
  return { accepted: true };
}

// The finalist key this browser already voted for in a category, or null.
export async function existingYearlyVote({ slug, tokenHash }) {
  const client = await redis();
  const value = await client.hget(keys(slug).votes, tokenHash);
  return value == null ? null : String(value);
}

// Admin: live counts per finalist key, total, voided total and the
// heaviest addresses for one category.
export async function yearlyVoteTally(slug) {
  const client = await redis();
  const k = keys(slug);
  const [votes, ipCounts, voided] = await Promise.all([client.hgetall(k.votes), client.hgetall(k.ip), client.hlen(k.void)]);
  const counts = {};
  let total = 0;
  for (const finalistKey of Object.values(votes || {})) {
    counts[String(finalistKey)] = (counts[String(finalistKey)] || 0) + 1;
    total += 1;
  }
  const addresses = Object.entries(ipCounts || {}).map(([ip, count]) => ({ ip, count: Number(count) || 0 })).sort((a, b) => b.count - a.count);
  return { counts, total, voided: Number(voided) || 0, addresses };
}

// Admin: void every counted vote in a category whose token hash or
// address hash starts with the given prefix (at least 8 characters, so a
// typo can't wipe a category). Returns how many votes were voided.
export async function voidYearlyVotes({ slug, tokenPrefix, ipPrefix, reason }) {
  const token = String(tokenPrefix || "").trim().toLowerCase();
  const ip = String(ipPrefix || "").trim().toLowerCase();
  if ((!token && !ip) || (token && token.length < 8) || (ip && ip.length < 8) || !/^[0-9a-f]*$/.test(token + ip)) {
    const error = new Error("Enter at least the first 8 characters of a browser or network ID.");
    error.status = 400;
    throw error;
  }
  const client = await redis();
  const k = keys(slug);
  const [votes, ipOf] = await Promise.all([client.hgetall(k.votes), client.hgetall(k.ipOf)]);
  const targets = Object.keys(votes || {}).filter((tokenHash) => (token && tokenHash.startsWith(token)) || (ip && String(ipOf?.[tokenHash] || "").startsWith(ip)));
  if (!targets.length) return { voided: 0 };
  const at = new Date().toISOString();
  const pipeline = client.pipeline();
  for (const tokenHash of targets) {
    const ipHash = String(ipOf?.[tokenHash] || "");
    pipeline.hset(k.void, { [tokenHash]: JSON.stringify({ finalist: String(votes[tokenHash]), ip: ipHash, at, reason: String(reason || "").slice(0, 120) }) });
    pipeline.hdel(k.votes, tokenHash);
    if (ipHash) pipeline.hincrby(k.ip, ipHash, -1);
  }
  pipeline.expire(k.void, KEY_TTL_SECONDS);
  await pipeline.exec();
  return { voided: targets.length };
}
