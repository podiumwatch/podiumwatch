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
//   yoty2026:count:<slug>       finalist key -> live vote count (public;
//                               +1 per accepted vote, -1 per voided vote)
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
  ipHourly: `${PREFIX}:iphourly:${slug}`,
  count: `${PREFIX}:count:${slug}`
});
const coolKey = (slug, tokenHash) => `${PREFIX}:cool:${slug}:${tokenHash}`;
const spaceKey = (slug, ipHash) => `${PREFIX}:space:${slug}:${ipHash}`;

// Rate limits per network address (2026-11-10). Votes beyond these within
// one minute are refused (not counted); a whole school voting is only
// slowed, never blocked, while a script firing votes is stopped.
export const RATE_LIMIT_PER_MINUTE = 30;
export const RATE_LIMIT_PER_CATEGORY_PER_MINUTE = 8;
// Backstop (Zachary, 2026-11-12): at most this many counted votes from one
// network in one category in one clock hour (UTC). Sized from the real
// votes: the busiest legitimate network-hour so far was 200, and 150 would
// have refused about 50 of 54,218 legitimate-looking votes. It reads the
// existing per-network hourly counter (iphourly), so it adds one HGET.
//
// Lowered (Zachary, 2026-11-13, every category alike): 25 counted votes per
// network per category per clock hour, and at most one counted vote every
// 30 seconds from the same network in the same category. Votes already
// cast are not touched.
export const NETWORK_LIMIT_PER_CATEGORY_PER_HOUR = 25;
export const NETWORK_SPACING_SECONDS = 30;
const hourOf = (now) => new Date(now).toISOString().slice(0, 13);

// One vote is one Lua script on Redis (2026-11-10), so it is all or
// nothing: the cooldown, the ballot and every counter are written
// together or not at all. A vote can't be half-saved (cooldown set, vote
// not counted) and a retried request can't count twice: the cooldown
// value carries the ballot ID, and a retry that finds its own ballot
// there answers "ok" without writing again. Hash expiries are refreshed
// once per finalist per hour instead of on every vote (that was 9 of a
// vote's 21 commands). Upstash bills each command inside a script, so
// an accepted vote is now about 11 commands.
//
// The cooldown key's value is "<finalist>|<ms when the hour ends>|<ballot>"
// so the page can read every category's cooldown with one MGET. Keys set
// before this change hold only the finalist; those fall back to TTL.
//
// KEYS: 1 voidTok, 2 rl, 3 rlc, 4 cool, 5 ballots, 6 ballotIp, 7 ip,
//       8 hourly, 9 ipHourly, 10 count, 11 network spacing
// ARGV: 1 token hash, 2 finalist, 3 ballot, 4 address hash, 5 hourly
//       field, 6 address-hourly field, 7 cooldown seconds, 8 cooldown
//       end (ms), 9 limit per minute, 10 limit per category per minute,
//       11 hash TTL seconds, 12 limit per network per category per hour,
//       13 seconds between counted votes from one network in one category
export const VOTE_SCRIPT = `
if redis.call('HEXISTS', KEYS[1], ARGV[1]) == 1 then return {'voided'} end
local value = ARGV[2] .. '|' .. ARGV[8] .. '|' .. ARGV[3]
if not redis.call('SET', KEYS[4], value, 'NX', 'EX', ARGV[7]) then
  local current = redis.call('GET', KEYS[4])
  if current == value then return {'ok'} end
  if current and string.find(current, '|', 1, true) then return {'cool', current, -1} end
  return {'cool', current or '', redis.call('TTL', KEYS[4])}
end
if tonumber(redis.call('HGET', KEYS[9], ARGV[6]) or '0') >= tonumber(ARGV[12]) then
  redis.call('DEL', KEYS[4])
  return {'hourcap'}
end
if redis.call('EXISTS', KEYS[11]) == 1 then
  redis.call('DEL', KEYS[4])
  return {'spacing'}
end
local all = redis.call('INCR', KEYS[2])
if all == 1 then redis.call('EXPIRE', KEYS[2], 120) end
local cat = redis.call('INCR', KEYS[3])
if cat == 1 then redis.call('EXPIRE', KEYS[3], 120) end
if all > tonumber(ARGV[9]) or cat > tonumber(ARGV[10]) then
  redis.call('DEL', KEYS[4])
  return {'rate'}
end
redis.call('HSET', KEYS[5], ARGV[3], ARGV[2])
redis.call('HSET', KEYS[6], ARGV[3], ARGV[4])
redis.call('HINCRBY', KEYS[7], ARGV[4], 1)
redis.call('HINCRBY', KEYS[9], ARGV[6], 1)
redis.call('HINCRBY', KEYS[10], ARGV[2], 1)
redis.call('SET', KEYS[11], '1', 'EX', ARGV[13])
if redis.call('HINCRBY', KEYS[8], ARGV[5], 1) == 1 then
  for i = 5, 10 do redis.call('EXPIRE', KEYS[i], ARGV[11]) end
end
return {'ok'}
`;

export function voteScriptCall({ slug, finalistKey, tokenHash, ipHash, now = new Date() }) {
  const k = keys(slug);
  const nowMs = new Date(now).getTime();
  const minute = Math.floor(nowMs / 60000);
  const endsAt = nowMs + VOTE_COOLDOWN_SECONDS * 1000;
  return {
    keys: [k.voidTok, `${PREFIX}:rl:${ipHash}:${minute}`, `${PREFIX}:rlc:${slug}:${ipHash}:${minute}`, coolKey(slug, tokenHash), k.ballots, k.ballotIp, k.ip, k.hourly, k.ipHourly, k.count, spaceKey(slug, ipHash)],
    args: [tokenHash, finalistKey, `${tokenHash}:${nowMs}`, ipHash, `${hourOf(now)}|${finalistKey}`, `${hourOf(now)}|${ipHash}`, String(VOTE_COOLDOWN_SECONDS), String(endsAt), String(RATE_LIMIT_PER_MINUTE), String(RATE_LIMIT_PER_CATEGORY_PER_MINUTE), String(KEY_TTL_SECONDS), String(NETWORK_LIMIT_PER_CATEGORY_PER_HOUR), String(NETWORK_SPACING_SECONDS)],
    endsAt
  };
}

// A cooldown value: "<finalist>|<end ms>|<ballot>" (or just the finalist,
// before 2026-11-10). Returns { votedFor, endsAt|null }.
export function parseCooldown(value) {
  if (value == null || value === "") return null;
  const [votedFor, endsAt] = String(value).split("|");
  return { votedFor, endsAt: endsAt ? Number(endsAt) : null };
}

// Returns { accepted: true, nextVoteAt } or { accepted: false, votedFor,
// nextVoteAt } (cooldown) or { accepted: false, rateLimited: true } or
// { accepted: false, voided: true }. Throws if Redis fails; nothing is
// written in that case (see VOTE_SCRIPT).
export async function castYearlyVote({ slug, finalistKey, tokenHash, ipHash, now = new Date() }) {
  const client = await redis();
  const nowMs = new Date(now).getTime();
  const call = voteScriptCall({ slug, finalistKey, tokenHash, ipHash, now });
  const result = await client.eval(VOTE_SCRIPT, call.keys, call.args);
  const [outcome, value, ttl] = Array.isArray(result) ? result : [];
  if (outcome === "ok") return { accepted: true, nextVoteAt: new Date(call.endsAt).toISOString() };
  if (outcome === "voided") return { accepted: false, votedFor: null, voided: true };
  if (outcome === "rate") return { accepted: false, rateLimited: true };
  if (outcome === "hourcap") return { accepted: false, rateLimited: true, hourCapped: true };
  if (outcome === "spacing") return { accepted: false, rateLimited: true, spaced: true };
  if (outcome === "cool") {
    const cooldown = parseCooldown(value);
    const endsAt = cooldown?.endsAt || nowMs + Math.max(0, Number(ttl) || 0) * 1000;
    return { accepted: false, votedFor: cooldown?.votedFor ?? null, nextVoteAt: new Date(endsAt).toISOString() };
  }
  throw new Error(`Unexpected vote script result: ${JSON.stringify(result)}`);
}

// This browser's latest vote in each category while its hour is running:
// { slug: { votedFor, nextVoteAt } }. One MGET for every category (was a
// GET and a TTL per category); only cooldowns written before 2026-11-10
// need a TTL.
export async function existingYearlyVotes({ slugs, tokenHash, now = new Date() }) {
  if (!slugs.length) return {};
  const client = await redis();
  const nowMs = new Date(now).getTime();
  const values = await client.mget(...slugs.map((slug) => coolKey(slug, tokenHash)));
  const out = {};
  await Promise.all(slugs.map(async (slug, index) => {
    const cooldown = parseCooldown(values?.[index]);
    if (!cooldown) return;
    let endsAt = cooldown.endsAt;
    if (!endsAt) { const ttl = Number(await client.ttl(coolKey(slug, tokenHash))); if (!(ttl > 0)) return; endsAt = nowMs + ttl * 1000; }
    if (endsAt <= nowMs) return;
    out[slug] = { votedFor: String(cooldown.votedFor), nextVoteAt: new Date(endsAt).toISOString() };
  }));
  return out;
}

export async function existingYearlyVote({ slug, tokenHash, now = new Date() }) {
  return (await existingYearlyVotes({ slugs: [slug], tokenHash, now }))[slug] || null;
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
    pipeline.hincrby(k.count, String(ballots[ballot]), -1);
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

// Public: live vote count per finalist key and the category total, from
// the small per-category counter (never from the ballots).
export async function publicVoteCounts(slug) {
  const client = await redis();
  const raw = (await client.hgetall(keys(slug).count)) || {};
  const counts = {};
  let total = 0;
  for (const [key, value] of Object.entries(raw)) { const n = Math.max(0, Number(value) || 0); counts[key] = n; total += n; }
  return { counts, total };
}

// Public: live counts for many categories at once (2026-11-10). Every
// server instance used to read every open category's counter itself (one
// HGETALL each, 24 per refresh). Now the first instance to refresh writes
// one shared snapshot that the others read with a single GET until it is
// PUBLIC_COUNTS_MAX_AGE_MS old. Counts on the page can lag by that much.
export const PUBLIC_COUNTS_MAX_AGE_MS = 30_000;
const PUBLIC_COUNTS_KEY = `${PREFIX}:publiccounts`;
export async function publicVoteCountsMany(slugs, { now = Date.now() } = {}) {
  const client = await redis();
  const wanted = [...new Set(slugs)].sort();
  const shared = await client.get(PUBLIC_COUNTS_KEY);
  const snapshot = typeof shared === "string" ? JSON.parse(shared) : shared;
  if (snapshot?.at && now - snapshot.at < PUBLIC_COUNTS_MAX_AGE_MS && wanted.every((slug) => snapshot.counts?.[slug])) {
    return Object.fromEntries(wanted.map((slug) => [slug, snapshot.counts[slug]]));
  }
  const pipeline = client.pipeline();
  for (const slug of wanted) pipeline.hgetall(keys(slug).count);
  const raw = wanted.length ? await pipeline.exec() : [];
  const counts = {};
  wanted.forEach((slug, index) => {
    const out = {};
    let total = 0;
    for (const [key, value] of Object.entries(raw[index] || {})) { const n = Math.max(0, Number(value) || 0); out[key] = n; total += n; }
    counts[slug] = { counts: out, total };
  });
  await client.set(PUBLIC_COUNTS_KEY, JSON.stringify({ at: now, counts }), { ex: 120 });
  return counts;
}
