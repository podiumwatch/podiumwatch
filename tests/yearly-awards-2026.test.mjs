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
    pipeline() { const queue = []; const p = new Proxy({}, { get: (_, name) => (name === "exec" ? async () => { for (const [cmd, args] of queue) await client[cmd](...args); } : (...args) => { queue.push([name, args]); return p; }) }); return p; }
  };
  return client;
}

test("Redis votes: one per browser, voiding removes it and blocks a re-vote", async () => {
  const { castYearlyVote, existingYearlyVote, useRedisClientForTests, voidYearlyVotes, yearlyVoteTally } = await import("../lib/yearly_awards_2026_votes.mjs");
  useRedisClientForTests(fakeRedis());
  const slug = "athlete-boys-d1";
  const school = "aaaaaaaa11112222";
  assert.deepEqual(await castYearlyVote({ slug, finalistKey: "a", tokenHash: "t1" + "0".repeat(14), ipHash: school }), { accepted: true });
  assert.deepEqual(await castYearlyVote({ slug, finalistKey: "b", tokenHash: "t1" + "0".repeat(14), ipHash: school }), { accepted: false, votedFor: "a" });
  await castYearlyVote({ slug, finalistKey: "b", tokenHash: "t2" + "0".repeat(14), ipHash: school });
  await castYearlyVote({ slug, finalistKey: "b", tokenHash: "t3" + "0".repeat(14), ipHash: "bbbbbbbb33334444" });
  let tally = await yearlyVoteTally(slug);
  assert.deepEqual(tally.counts, { a: 1, b: 2 });
  assert.equal(tally.total, 3);
  assert.deepEqual(tally.addresses[0], { ip: school, count: 2 });
  assert.equal(await existingYearlyVote({ slug, tokenHash: "t2" + "0".repeat(14) }), "b");
  await assert.rejects(() => voidYearlyVotes({ slug, ipPrefix: "aaaa" }), /8 characters/);
  assert.deepEqual(await voidYearlyVotes({ slug, ipPrefix: "aaaaaaaa", reason: "test" }), { voided: 2 });
  tally = await yearlyVoteTally(slug);
  assert.deepEqual(tally.counts, { b: 1 });
  assert.equal(tally.voided, 2);
  assert.equal(tally.addresses.find((item) => item.ip === school).count, 0);
  assert.equal((await castYearlyVote({ slug, finalistKey: "a", tokenHash: "t1" + "0".repeat(14), ipHash: school })).accepted, false);
  assert.equal((await yearlyVoteTally("team-boys-d1")).total, 0);
  useRedisClientForTests(null);
});
