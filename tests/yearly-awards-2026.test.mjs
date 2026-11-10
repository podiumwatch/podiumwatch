import test from "node:test";
import assert from "node:assert/strict";
import { YEARLY_AWARDS_SCHEDULE, categoryStatus, findNominee, formatEt, loadYearlyAwardsPool } from "../lib/yearly_awards_2026.mjs";
import { pickWinner, validateNomination, validateVote } from "../lib/yearly_awards_2026_service.mjs";

// Pure checks only. lib/yearly_awards_2026_service.mjs loads Supabase
// lazily, so nothing here touches the database.

const pool = await loadYearlyAwardsPool();
const category = (slug) => ({ id: `id-${slug}`, slug, award: slug.split("-")[0], ...YEARLY_AWARDS_SCHEDULE, voting_closed_early_at: null, results_published_at: null });
const during = new Date("2026-11-09T20:00:00Z");

test("pool has 24 categories, 1,647 athletes and 184 teams", () => {
  assert.equal(pool.categories.length, 24);
  assert.equal(Object.values(pool.athletes).reduce((n, list) => n + list.length, 0), 1647);
  assert.equal(Object.values(pool.teams).reduce((n, list) => n + list.length, 0), 184);
});

test("Quintin Parrish is a Boys Division III athlete and nowhere else", () => {
  const hits = Object.entries(pool.athletes).filter(([, list]) => list.some((item) => item.name === "Quintin Parrish")).map(([slug]) => slug);
  assert.deepEqual(hits, ["athlete-boys-d3"]);
  assert.equal(findNominee(pool, "athlete-boys-d3", "23658979").school, "Van Wert");
});

test("name overrides apply", () => {
  const names = Object.values(pool.athletes).flat().map((item) => item.name);
  for (const name of ["Charlee Skeen", "Cara Bornhorst", "Samuel Phlipot", "Lily Kiser"]) assert.ok(names.includes(name), name);
  for (const name of ["Charlee Skeen-Adrine", "Cara Bornhornst", "Samuel Philpot", "Lillian (Lily) Kiser"]) assert.ok(!names.includes(name), name);
});

test("a valid nomination passes", () => {
  const { row } = validateNomination(pool, category("athlete-boys-d3"), { nomineeId: "23658979", reason: "Came back from heart surgery", firstName: "Zach" }, { now: during });
  assert.equal(row.athletic_net_id, "23658979");
  assert.equal(row.nominator_first_name, "Zach");
});

test("a team from another division is rejected", () => {
  const vanWert = pool.teams["team-boys-d3"].find((item) => item.name === "Van Wert");
  assert.throws(() => validateNomination(pool, category("team-boys-d1"), { nomineeId: vanWert.id }, { now: during }), /this division's list/);
  assert.throws(() => validateNomination(pool, category("athlete-girls-d3"), { nomineeId: "23658979" }, { now: during }), /this division's list/);
});

test("nominations are rejected after close and before open", () => {
  assert.throws(() => validateNomination(pool, category("athlete-boys-d3"), { nomineeId: "23658979" }, { now: new Date("2026-11-10T02:00:00Z") }), /closed/);
  assert.throws(() => validateNomination(pool, category("athlete-boys-d3"), { nomineeId: "23658979" }, { now: new Date("2026-11-07T23:59:59Z") }), /aren't open yet/);
});

test("reason over 300 characters is rejected", () => {
  assert.throws(() => validateNomination(pool, category("athlete-boys-d3"), { nomineeId: "23658979", reason: "x".repeat(301) }, { now: during }), /300/);
});

test("status follows the clock", () => {
  const c = category("athlete-boys-d1");
  assert.equal(categoryStatus(c, { now: new Date("2026-11-10T01:59:59Z") }), "nominations_open");
  assert.equal(categoryStatus(c, { now: new Date("2026-11-10T02:00:00Z") }), "selecting_finalists");
  assert.equal(categoryStatus(c, { now: new Date("2026-11-10T05:00:00Z") }), "finalists_coming_soon");
  assert.equal(categoryStatus(c, { finalistCount: 3, now: new Date("2026-11-10T05:00:00Z") }), "voting_open");
  assert.equal(categoryStatus(c, { finalistCount: 3, now: new Date("2026-11-14T02:00:00Z") }), "voting_closed");
  assert.equal(categoryStatus({ ...c, results_published_at: "2026-11-14T13:00:00Z" }, { now: new Date("2026-11-14T13:00:01Z") }), "published");
});

test("times display in ET", () => {
  assert.equal(formatEt(YEARLY_AWARDS_SCHEDULE.nominations_close_at), "Mon, Nov 9 at 9:00 PM ET");
  assert.equal(formatEt(YEARLY_AWARDS_SCHEDULE.voting_open_at), "Tue, Nov 10 at 12:00 AM ET");
  assert.equal(formatEt(YEARLY_AWARDS_SCHEDULE.voting_close_at), "Fri, Nov 13 at 9:00 PM ET");
});

test("Coach of the Year lists every Ohio school once per gender", () => {
  const boys = Object.entries(pool.coaches).filter(([slug]) => slug.startsWith("coach-boys-")).flatMap(([, list]) => list.map((item) => item.id));
  const girls = Object.entries(pool.coaches).filter(([slug]) => slug.startsWith("coach-girls-")).flatMap(([, list]) => list.map((item) => item.id));
  assert.equal(new Set(boys).size, boys.length);
  assert.equal(new Set(girls).size, girls.length);
  assert.equal(boys.length, girls.length);
  assert.ok(boys.length > 500);
});

test("girls coach programs use the 2026 state meet division when known", () => {
  const archbold = pool.teams["team-girls-d4"].find((item) => item.name === "Archbold");
  assert.ok(findNominee(pool, "coach-girls-d4", archbold.schoolId));
  assert.ok(!findNominee(pool, "coach-girls-d3", archbold.schoolId));
});

test("a coach nomination needs a school in the division and a coach name", () => {
  const school = pool.coaches["coach-boys-d3"][0];
  const { row } = validateNomination(pool, category("coach-boys-d3"), { nomineeId: school.id, coachName: "  Pat   Smith ", reason: "Built the program" }, { now: during });
  assert.equal(row.coach_name, "Pat Smith");
  assert.equal(row.school_id, school.id);
  assert.equal(row.athletic_net_id, null);
  assert.throws(() => validateNomination(pool, category("coach-boys-d3"), { nomineeId: school.id }, { now: during }), /coach's name/);
  assert.throws(() => validateNomination(pool, category("coach-boys-d1"), { nomineeId: school.id, coachName: "Pat Smith" }, { now: during }), /this division's list/);
});

// ---- Part 2: voting ----
const votingNow = new Date("2026-11-11T15:00:00Z");
const finalists = [
  { id: "f1", nominee_key: "a", display_name: "Runner A" },
  { id: "f2", nominee_key: "b", display_name: "Runner B" },
  { id: "f3", nominee_key: "c", display_name: "Runner C" }
];

test("voting only opens once finalists are announced", () => {
  const hidden = { ...category("athlete-boys-d1"), finalists_published_at: null };
  assert.throws(() => validateVote(hidden, finalists, "a", { now: votingNow }), /haven't been announced/);
  const announced = { ...hidden, finalists_published_at: "2026-11-10T13:00:00Z" };
  assert.equal(validateVote(announced, finalists, "a", { now: votingNow }).id, "f1");
  assert.throws(() => validateVote(announced, finalists, "zzz", { now: votingNow }), /Pick one of the finalists/);
});

test("announced finalists before the voting window don't open voting early", () => {
  const announced = { ...category("team-girls-d2"), finalists_published_at: "2026-11-10T03:00:00Z" };
  assert.throws(() => validateVote(announced, finalists, "a", { now: new Date("2026-11-10T04:00:00Z") }), /hasn't opened/);
});

test("closing early and publishing both stop voting", () => {
  const announced = { ...category("coach-boys-d4"), finalists_published_at: "2026-11-10T06:00:00Z" };
  assert.throws(() => validateVote({ ...announced, voting_closed_early_at: "2026-11-11T12:00:00Z" }, finalists, "a", { now: votingNow }), /closed/);
  assert.throws(() => validateVote({ ...announced, results_published_at: "2026-11-11T12:00:00Z" }, finalists, "a", { now: votingNow }), /closed/);
  assert.throws(() => validateVote(announced, finalists, "a", { now: new Date("2026-11-14T02:00:01Z") }), /closed/);
});

test("winner is the top vote-getter; a tie needs the admin to pick", () => {
  assert.equal(pickWinner(finalists, { a: 3, b: 9, c: 1 }).display_name, "Runner B");
  assert.throws(() => pickWinner(finalists, { a: 5, b: 5, c: 1 }), (error) => error.code === "TIE" && error.tied.join() === "a,b");
  assert.equal(pickWinner(finalists, { a: 5, b: 5 }, "a").display_name, "Runner A");
  assert.throws(() => pickWinner(finalists, {}, "nope"), /Pick the winner/);
  assert.throws(() => pickWinner([], {}), /no finalists/);
});

// In-memory stand-in for the Upstash client: only the hash commands the
// vote module uses.
function fakeRedis() {
  const store = new Map();
  const plain = new Map();
  let clock = Date.now();
  const hash = (key) => { if (!store.has(key)) store.set(key, new Map()); return store.get(key); };
  const client = {
    async hsetnx(key, field, value) { const h = hash(key); if (h.has(field)) return 0; h.set(field, value); return 1; },
    async hget(key, field) { return hash(key).has(field) ? hash(key).get(field) : null; },
    async hexists(key, field) { return hash(key).has(field) ? 1 : 0; },
    async hset(key, values) { for (const [field, value] of Object.entries(values)) hash(key).set(field, value); return 1; },
    async hincrby(key, field, by) { const next = Number(hash(key).get(field) || 0) + by; hash(key).set(field, next); return next; },
    async hdel(key, field) { return hash(key).delete(field) ? 1 : 0; },
    async hgetall(key) { return Object.fromEntries(hash(key)); },
    async hlen(key) { return hash(key).size; },
    async expire() { return 1; },
    async incr(key) { const next = Number(store.get(key) || 0) + 1; store.set(key, next); return next; },
    setClock(ms) { clock = ms; },
    async set(key, value, options = {}) { const live = plain.get(key); if (options.nx && live && live.expires > clock) return null; plain.set(key, { value, expires: options.ex ? clock + options.ex * 1000 : Infinity }); return "OK"; },
    async get(key) { const live = plain.get(key); return live && live.expires > clock ? live.value : null; },
    async ttl(key) { const live = plain.get(key); if (!live || live.expires <= clock) return -2; return live.expires === Infinity ? -1 : Math.ceil((live.expires - clock) / 1000); },
    // Like Upstash: exec() resolves to each command's result, in order.
    pipeline() { const queue = []; const p = new Proxy({}, { get: (_, name) => (name === "exec" ? async () => { const out = []; for (const [cmd, args] of queue) out.push(await client[cmd](...args)); return out; } : (...args) => { queue.push([name, args]); return p; }) }); return p; }
  };
  return client;
}

test("Redis votes: one per browser per category every hour; voiding removes votes and blocks the browser", async () => {
  const { castYearlyVote, existingYearlyVote, publicVoteCounts, useRedisClientForTests, voidYearlyVotes, yearlyVoteTally } = await import("../lib/yearly_awards_2026_votes.mjs");
  const fake = fakeRedis();
  useRedisClientForTests(fake);
  const slug = "athlete-boys-d1";
  const school = "aaaaaaaa11112222";
  const t1 = "t1" + "0".repeat(14);
  const at = (iso) => { const d = new Date(iso); fake.setClock(d.getTime()); return d; };
  let now = at("2026-11-11T14:00:00Z");
  const first = await castYearlyVote({ slug, finalistKey: "a", tokenHash: t1, ipHash: school, now });
  assert.equal(first.accepted, true);
  assert.equal(first.nextVoteAt, "2026-11-11T15:00:00.000Z");
  // Inside the hour: refused, with the time the next vote is allowed.
  now = at("2026-11-11T14:40:00Z");
  const again = await castYearlyVote({ slug, finalistKey: "b", tokenHash: t1, ipHash: school, now });
  assert.equal(again.accepted, false);
  assert.equal(again.votedFor, "a");
  assert.equal(again.nextVoteAt, "2026-11-11T15:00:00.000Z");
  assert.deepEqual(await existingYearlyVote({ slug, tokenHash: t1, now }), { votedFor: "a", nextVoteAt: "2026-11-11T15:00:00.000Z" });
  // After the hour: allowed again, for any finalist.
  now = at("2026-11-11T15:00:01Z");
  assert.equal(await existingYearlyVote({ slug, tokenHash: t1, now }), null);
  assert.equal((await castYearlyVote({ slug, finalistKey: "b", tokenHash: t1, ipHash: school, now })).accepted, true);
  await castYearlyVote({ slug, finalistKey: "b", tokenHash: "t2" + "0".repeat(14), ipHash: school, now });
  await castYearlyVote({ slug, finalistKey: "b", tokenHash: "t3" + "0".repeat(14), ipHash: "bbbbbbbb33334444", now });
  let tally = await yearlyVoteTally(slug);
  assert.deepEqual(tally.counts, { a: 1, b: 3 });
  assert.equal(tally.total, 4);
  // The public live counter matches the ballots.
  assert.deepEqual(await publicVoteCounts(slug), { counts: { a: 1, b: 3 }, total: 4 });
  assert.deepEqual(tally.addresses[0], { ip: school, count: 3 });
  await assert.rejects(() => voidYearlyVotes({ slug, ipPrefix: "aaaa" }), /8 characters/);
  assert.deepEqual(await voidYearlyVotes({ slug, ipPrefix: "aaaaaaaa", reason: "test" }), { voided: 3 });
  tally = await yearlyVoteTally(slug);
  assert.deepEqual(tally.counts, { b: 1 });
  assert.deepEqual(await publicVoteCounts(slug), { counts: { a: 0, b: 1 }, total: 1 });
  assert.equal(tally.voided, 3);
  assert.equal(tally.addresses.find((item) => item.ip === school).count, 0);
  // A voided browser can't vote again in that category, even after the hour.
  now = at("2026-11-11T17:00:00Z");
  assert.equal((await castYearlyVote({ slug, finalistKey: "a", tokenHash: t1, ipHash: school, now })).voided, true);
  assert.equal((await yearlyVoteTally("team-boys-d1")).total, 0);
  useRedisClientForTests(null);
});

test("votes are rate limited per network and logged per hour for the admin", async () => {
  const { castYearlyVote, useRedisClientForTests, yearlyVoteActivity, RATE_LIMIT_PER_CATEGORY_PER_MINUTE } = await import("../lib/yearly_awards_2026_votes.mjs");
  useRedisClientForTests(fakeRedis());
  const slug = "athlete-girls-d3";
  const now = new Date("2026-11-11T15:20:00Z");
  const results = [];
  for (let i = 0; i < RATE_LIMIT_PER_CATEGORY_PER_MINUTE + 3; i += 1) results.push(await castYearlyVote({ slug, finalistKey: "a", tokenHash: `tok${String(i).padStart(13, "0")}`, ipHash: "bot0000000000000", now }));
  assert.equal(results.filter((r) => r.accepted).length, RATE_LIMIT_PER_CATEGORY_PER_MINUTE);
  assert.equal(results.filter((r) => r.rateLimited).length, 3);
  // A minute later the same network can vote again.
  assert.equal((await castYearlyVote({ slug, finalistKey: "b", tokenHash: "later00000000000", ipHash: "bot0000000000000", now: new Date("2026-11-11T15:21:05Z") })).accepted, true);
  const activity = await yearlyVoteActivity(slug);
  assert.deepEqual(activity.hours.map((h) => [h.hour, h.total, h.by_finalist]), [["2026-11-11T15", RATE_LIMIT_PER_CATEGORY_PER_MINUTE + 1, { a: RATE_LIMIT_PER_CATEGORY_PER_MINUTE, b: 1 }]]);
  assert.equal(activity.bursts.length, 1);
  assert.equal(activity.bursts[0].share, 100);
});
