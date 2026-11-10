// 2026 Athlete, Team and Coach of the Year: vote storage on Redis.
// Separate from lib/award_vote_redis.mjs (the weekly aotw/totw module,
// which is left alone) and under its own yoty2026: namespace.
//
// One vote per browser per category every hour (Zachary, 2026-11-10;
// was one vote total). A vote sets a one-hour cooldown key with SET NX,
// so a second vote inside the hour is refused on the server; after the
// hour, the browser can vote again (for any finalist). Every accepted vote
// is its own ballot entry, so counts are tallied from the ballots when
// the admin asks, and voiding a vote moves its ballot out; there are no
// counters to drift.
//
// Keys, per category slug:
//   yoty2026:ballots:<slug>     "<token hash>:<ms>" -> finalist key (counted)
//   yoty2026:ballotip:<slug>    "<token hash>:<ms>" -> address hash
//   yoty2026:cool:<slug>:<tok>  finalist key, expires after one hour
//   yoty2026:ip:<slug>          address hash -> votes from that address
//   yoty2026:void:<slug>        "<token hash>:<ms>" -> JSON of the voided vote
//   yoty2026:voidtok:<slug>     token hash -> 1 (a voided browser can't vote again)
//   yoty2026:hourly:<slug>      "<UTC hour>|<finalist key>" -> votes
//   yoty2026:iphourly:<slug>    "<UTC hour>|<address hash>" -> votes
// Address counts are for flagging in the admin and per-minute rate
// limits; a whole school can share one network, so it is only slowed.

const PREFIX = "yoty2026";
const KEY_TTL_SECONDS = 60 * 60 * 24 * 120;
export const VOTE_COOLDOWN_SECONDS = 60 * 60;

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
  ballots: `${PREFIX}:ballots:${slug}`,
  ballotIp: `${PREFIX}:ballotip:${slug}`,
  ip: `${PREFIX}:ip:${slug}`,
  void: `${PREFIX}:void:${slug}`,
  voidTok: `${PREFIX}:voidtok:${slug}`,
  hourly: `${PREFIX}:hourly:${slug}`,
  ipHourly: `${PREFIX}:iphourly:${slug}`
});
const coolKey = (slug, tokenHash) => `${PREFIX}:cool:${slug}:${tokenHash}`;

// Rate limits per network address (2026-11-10). Votes beyond these within
// one minute are refused (not counted); a whole school voting is only
// slowed, never blocked, while a script firing votes is stopped.
export const RATE_LIMIT_PER_MINUTE = 30;
export const RATE_LIMIT_PER_CATEGORY_PER_MINUTE = 8;
const hourOf = (now) => new Date(now).toISOString().slice(0, 13);

// Returns { accepted: true, nextVoteAt } or { accepted: false, votedFor,
// nextVoteAt } (cooldown) or { accepted: false, rateLimited: true } or
// { accepted: false, voided: true }.
export async function castYearlyVote({ slug, finalistKey, tokenHash, ipHash, now = new Date() }) {
  const client = await redis();
  const k = keys(slug);
  const nowMs = new Date(now).getTime();
  // A browser whose votes were voided can't vote again in that category.
  if (await client.hexists(k.voidTok, tokenHash)) return { accepted: false, votedFor: null, voided: true };
  const minute = Math.floor(nowMs / 60000);
  const rl = client.pipeline();
  rl.incr(`${PREFIX}:rl:${ipHash}:${minute}`);
  rl.expire(`${PREFIX}:rl:${ipHash}:${minute}`, 120);
  rl.incr(`${PREFIX}:rlc:${slug}:${ipHash}:${minute}`);
  rl.expire(`${PREFIX}:rlc:${slug}:${ipHash}:${minute}`, 120);
  const [all, , perCategory] = await rl.exec();
  if (Number(all) > RATE_LIMIT_PER_MINUTE || Number(perCategory) > RATE_LIMIT_PER_CATEGORY_PER_MINUTE) return { accepted: false, rateLimited: true };
  // The hour starts with this vote: SET NX with a one-hour expiry.
  const set = await client.set(coolKey(slug, tokenHash), finalistKey, { nx: true, ex: VOTE_COOLDOWN_SECONDS });
  if (!set) {
    const [votedFor, ttl] = await Promise.all([client.get(coolKey(slug, tokenHash)), client.ttl(coolKey(slug, tokenHash))]);
    return { accepted: false, votedFor: votedFor == null ? null : String(votedFor), nextVoteAt: new Date(nowMs + Math.max(0, Number(ttl) || 0) * 1000).toISOString() };
  }
  const ballot = `${tokenHash}:${nowMs}`;
  const pipeline = client.pipeline();
  pipeline.hset(k.ballots, { [ballot]: finalistKey });
  pipeline.hset(k.ballotIp, { [ballot]: ipHash });
  pipeline.hincrby(k.ip, ipHash, 1);
  pipeline.hincrby(k.hourly, `${hourOf(now)}|${finalistKey}`, 1);
  pipeline.hincrby(k.ipHourly, `${hourOf(now)}|${ipHash}`, 1);
  for (const key of Object.values(k)) pipeline.expire(key, KEY_TTL_SECONDS);
  await pipeline.exec();
  return { accepted: true, nextVoteAt: new Date(nowMs + VOTE_COOLDOWN_SECONDS * 1000).toISOString() };
}

// This browser's latest vote in a category while its hour is running:
// { votedFor, nextVoteAt }, or null when it can vote now.
export async function existingYearlyVote({ slug, tokenHash, now = new Date() }) {
  const client = await redis();
  const [votedFor, ttl] = await Promise.all([client.get(coolKey(slug, tokenHash)), client.ttl(coolKey(slug, tokenHash))]);
  if (votedFor == null || !(Number(ttl) > 0)) return null;
  return { votedFor: String(votedFor), nextVoteAt: new Date(new Date(now).getTime() + Number(ttl) * 1000).toISOString() };
}

// Admin: live counts per finalist key, total, voided total and the
// heaviest addresses for one category.
export async function yearlyVoteTally(slug) {
  const client = await redis();
  const k = keys(slug);
  const [ballots, ipCounts, voided] = await Promise.all([client.hgetall(k.ballots), client.hgetall(k.ip), client.hlen(k.void)]);
  const counts = {};
  let total = 0;
  for (const finalistKey of Object.values(ballots || {})) {
    counts[String(finalistKey)] = (counts[String(finalistKey)] || 0) + 1;
    total += 1;
  }
  const addresses = Object.entries(ipCounts || {}).map(([ip, count]) => ({ ip, count: Number(count) || 0 })).sort((a, b) => b.count - a.count);
  return { counts, total, voided: Number(voided) || 0, addresses };
}

// Admin: void every counted vote in a category whose browser ID or
// network ID starts with the given prefix (at least 8 characters, so a
// typo can't wipe a category). Voided browsers can't vote again in that
// category. Returns how many votes were voided.
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
  const [ballots, ballotIp] = await Promise.all([client.hgetall(k.ballots), client.hgetall(k.ballotIp)]);
  const targets = Object.keys(ballots || {}).filter((ballot) => (token && ballot.startsWith(token)) || (ip && String(ballotIp?.[ballot] || "").startsWith(ip)));
  if (!targets.length) return { voided: 0 };
  const at = new Date().toISOString();
  const pipeline = client.pipeline();
  for (const ballot of targets) {
    const ipHash = String(ballotIp?.[ballot] || "");
    pipeline.hset(k.void, { [ballot]: JSON.stringify({ finalist: String(ballots[ballot]), ip: ipHash, at, reason: String(reason || "").slice(0, 120) }) });
    pipeline.hset(k.voidTok, { [ballot.split(":")[0]]: 1 });
    pipeline.hdel(k.ballots, ballot);
    if (ipHash) pipeline.hincrby(k.ip, ipHash, -1);
  }
  pipeline.expire(k.void, KEY_TTL_SECONDS);
  pipeline.expire(k.voidTok, KEY_TTL_SECONDS);
  await pipeline.exec();
  return { voided: targets.length };
}

// Admin: votes per hour per finalist, and per-network bursts, for one
// category. A burst is one network casting at least BURST_MIN_VOTES in an
// hour, or at least half of that hour's votes (with at least 5).
export const BURST_MIN_VOTES = 10;
export async function yearlyVoteActivity(slug) {
  const client = await redis();
  const k = keys(slug);
  const [hourly, ipHourly] = await Promise.all([client.hgetall(k.hourly), client.hgetall(k.ipHourly)]);
  const hours = new Map();
  for (const [field, value] of Object.entries(hourly || {})) {
    const [hour, finalist] = field.split("|");
    if (!hours.has(hour)) hours.set(hour, { hour, total: 0, by_finalist: {} });
    const entry = hours.get(hour);
    entry.by_finalist[finalist] = Number(value) || 0;
    entry.total += Number(value) || 0;
  }
  const bursts = [];
  for (const [field, value] of Object.entries(ipHourly || {})) {
    const [hour, ip] = field.split("|");
    const count = Number(value) || 0;
    const hourTotal = hours.get(hour)?.total || count;
    if (count >= BURST_MIN_VOTES || (count >= 5 && count / hourTotal >= 0.5)) bursts.push({ hour, ip: ip.slice(0, 12), count, share: Math.round((count / hourTotal) * 100) });
  }
  return { hours: [...hours.values()].sort((a, b) => a.hour.localeCompare(b.hour)), bursts: bursts.sort((a, b) => b.count - a.count) };
}
