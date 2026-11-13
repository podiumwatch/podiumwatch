import fs from "node:fs";
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
    async mget(...list) { return Promise.all(list.map((key) => client.get(key))); },
    async del(key) { plain.delete(key); store.delete(key); return 1; },
    // The vote script (VOTE_SCRIPT, Lua) mirrored step for step. The Lua
    // itself is checked against real Redis by scripts/test-yearly-vote-script.mjs.
    async eval(script, k, a) {
      if (await client.hexists(k[0], a[0])) return ["voided"];
      const value = `${a[1]}|${a[7]}|${a[2]}`;
      if (!(await client.set(k[3], value, { nx: true, ex: Number(a[6]) }))) {
        const current = await client.get(k[3]);
        if (current === value) return ["ok"];
        if (current && String(current).includes("|")) return ["cool", current, -1];
        return ["cool", current ?? "", await client.ttl(k[3])];
      }
      if (Number((await client.hget(k[8], a[5])) || 0) >= Number(a[11])) { await client.del(k[3]); return ["hourcap"]; }
      if (await client.get(k[10])) { await client.del(k[3]); return ["spacing"]; }
      const all = await client.incr(k[1]);
      const cat = await client.incr(k[2]);
      if (all > Number(a[8]) || cat > Number(a[9])) { await client.del(k[3]); return ["rate"]; }
      await client.hset(k[4], { [a[2]]: a[1] });
      await client.hset(k[5], { [a[2]]: a[3] });
      await client.hincrby(k[6], a[3], 1);
      await client.hincrby(k[8], a[5], 1);
      await client.hincrby(k[9], a[1], 1);
      await client.set(k[10], "1", { ex: Number(a[12]) });
      await client.hincrby(k[7], a[4], 1);
      return ["ok"];
    },
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
  now = at("2026-11-11T15:00:35Z");
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

test("votes are spaced per network (one every 30 seconds per category) and logged per hour for the admin", async () => {
  const { castYearlyVote, useRedisClientForTests, yearlyVoteActivity, NETWORK_SPACING_SECONDS } = await import("../lib/yearly_awards_2026_votes.mjs");
  assert.equal(NETWORK_SPACING_SECONDS, 30);
  const fake = fakeRedis();
  useRedisClientForTests(fake);
  const slug = "athlete-girls-d3";
  const now = new Date("2026-11-11T15:20:00Z");
  fake.setClock(now.getTime());
  const results = [];
  for (let i = 0; i < 11; i += 1) results.push(await castYearlyVote({ slug, finalistKey: "a", tokenHash: `tok${String(i).padStart(13, "0")}`, ipHash: "bot0000000000000", now }));
  assert.equal(results.filter((r) => r.accepted).length, 1, "one counted vote per 30 seconds from one network");
  assert.equal(results.filter((r) => r.spaced).length, 10);
  // Another network is not slowed by it, and neither is the same network in another category.
  assert.equal((await castYearlyVote({ slug, finalistKey: "a", tokenHash: "other00000000000", ipHash: "net9999999999999", now })).accepted, true);
  assert.equal((await castYearlyVote({ slug: "athlete-boys-d3", finalistKey: "a", tokenHash: "tok0000000000000", ipHash: "bot0000000000000", now })).accepted, true);
  // 31 seconds later the same network can vote again.
  const later = new Date("2026-11-11T15:20:31Z");
  fake.setClock(later.getTime());
  assert.equal((await castYearlyVote({ slug, finalistKey: "b", tokenHash: "later00000000000", ipHash: "bot0000000000000", now: later })).accepted, true);
  const activity = await yearlyVoteActivity(slug);
  assert.deepEqual(activity.hours.map((h) => [h.hour, h.total, h.by_finalist]), [["2026-11-11T15", 3, { a: 2, b: 1 }]]);
});

test("vote script: a retried request counts once; Redis failing counts nothing and says busy", async () => {
  const votesModule = await import("../lib/yearly_awards_2026_votes.mjs");
  const fake = fakeRedis();
  votesModule.useRedisClientForTests(fake);
  const slug = "coach-boys-d4";
  const now = new Date("2026-11-11T18:00:00Z");
  fake.setClock(now.getTime());
  const args = { slug, finalistKey: "a", tokenHash: "retry00000000000", ipHash: "cccccccc55556666", now };
  assert.equal((await votesModule.castYearlyVote(args)).accepted, true);
  // Same request again (the client retrying after a lost response).
  assert.equal((await votesModule.castYearlyVote(args)).accepted, true);
  assert.equal((await votesModule.yearlyVoteTally(slug)).total, 1, "counted once");
  // One MGET answers every category for the page.
  const mine = await votesModule.existingYearlyVotes({ slugs: [slug, "coach-girls-d4"], tokenHash: "retry00000000000", now });
  assert.deepEqual(mine, { [slug]: { votedFor: "a", nextVoteAt: "2026-11-11T19:00:00.000Z" } });
  // A cooldown written before the change (finalist only) still works.
  await fake.set(`yoty2026:cool:${slug}:old0000000000000`, "b", { ex: 600 });
  assert.equal((await votesModule.existingYearlyVote({ slug, tokenHash: "old0000000000000", now })).votedFor, "b");
  const refused = await votesModule.castYearlyVote({ ...args, tokenHash: "old0000000000000" });
  assert.equal(refused.votedFor, "b");
  assert.equal(refused.nextVoteAt, "2026-11-11T18:10:00.000Z");
  // A rate-limited vote leaves no cooldown behind.
  // Redis down: the service says busy (503) and nothing is counted.
  votesModule.useRedisClientForTests({ ...fake, eval: async () => { throw new Error("ERR max requests limit exceeded"); } });
  const service = await import("../lib/yearly_awards_2026_service.mjs");
  assert.equal(service.VOTING_BUSY_MESSAGE, "Voting is busy, try again in a minute.");
  await assert.rejects(() => votesModule.castYearlyVote({ ...args, tokenHash: "down000000000000" }), /limit exceeded/);
  votesModule.useRedisClientForTests(fake);
  assert.equal((await votesModule.yearlyVoteTally(slug)).total, 1);
  votesModule.useRedisClientForTests(null);
});

test("public counts: one shared snapshot instead of a read per category", async () => {
  const votesModule = await import("../lib/yearly_awards_2026_votes.mjs");
  const fake = fakeRedis();
  votesModule.useRedisClientForTests(fake);
  await fake.hincrby("yoty2026:count:team-boys-d1", "x", 3);
  const first = await votesModule.publicVoteCountsMany(["team-boys-d1", "team-girls-d1"], { now: 1000 });
  assert.deepEqual(first["team-boys-d1"], { counts: { x: 3 }, total: 3 });
  await fake.hincrby("yoty2026:count:team-boys-d1", "x", 1);
  let reads = 0;
  const hgetall = fake.hgetall;
  fake.hgetall = async (...a) => { reads += 1; return hgetall(...a); };
  assert.equal((await votesModule.publicVoteCountsMany(["team-boys-d1"], { now: 20_000 }))["team-boys-d1"].total, 3, "shared snapshot, no re-read");
  assert.equal(reads, 0);
  assert.equal((await votesModule.publicVoteCountsMany(["team-boys-d1"], { now: 40_000 }))["team-boys-d1"].total, 4, "refreshed after 30 seconds");
  votesModule.useRedisClientForTests(null);
});

test("share previews: vote, then closed, then winner; finalist links; 1200x630 absolute image", async () => {
  const { shareState, shareMeta, shareImageUrl, finalistSlugs, findFinalist, closesLabel } = await import("../lib/awards_share.mjs");
  const { awardsCategoryCard, awardsFinalistCard } = await import("../lib/og/awards_card.mjs");
  const category = { slug: "athlete-boys-d4", award: "athlete", gender: "boys", division: 4, nominations_open_at: "2026-11-01T00:00:00Z", nominations_close_at: "2026-11-10T02:00:00Z", voting_open_at: "2026-11-10T14:00:00Z", voting_close_at: "2026-11-14T02:00:00Z", voting_closed_early_at: null, finalists_published_at: "2026-11-10T13:47:05Z", results_published_at: null };
  const finalists = [
    { nominee_key: "1", display_name: "PAXSON BIXLER", school: "Russia", winner: false },
    { nominee_key: "2", display_name: "Aidan Vogt", school: "Columbus Grove", winner: true },
    { nominee_key: "3", display_name: "Sam Lee", school: "A", winner: false },
    { nominee_key: "4", display_name: "Sam Lee", school: "B", winner: false }
  ];
  assert.equal(closesLabel(category), "Fri Nov 13, 9 PM");
  const slugs = finalistSlugs(finalists);
  assert.equal(slugs.get("1"), "paxson-bixler");
  assert.equal(slugs.get("3"), "3", "two finalists with one name use their keys");
  assert.equal(findFinalist(finalists, "paxson-bixler").nominee_key, "1");
  const vote = shareState(category, finalists, { now: new Date("2026-11-11T12:00:00Z") });
  assert.equal(vote.state, "vote");
  assert.equal(vote.winners.length, 0, "no winner shown before results are published");
  assert.equal(shareMeta(category, vote).title, "Vote: 2026 Boys Division IV Athlete of the Year");
  assert.equal(shareMeta(category, vote, vote.finalists[0]).title, "Vote for Paxson Bixler, 2026 Boys D4 Athlete of the Year finalist");
  const url = shareImageUrl("https://www.podiumwatch.org", category, vote);
  assert.match(url, /^https:\/\/www\.podiumwatch\.org\/api\/og\/awards-2026\/\?category=athlete-boys-d4&v=vote/);
  assert.equal(shareState(category, finalists, { now: new Date("2026-11-14T03:00:00Z") }).state, "closed");
  const published = { ...category, results_published_at: "2026-11-14T13:00:00Z" };
  const winner = shareState(published, finalists, { now: new Date("2026-11-14T14:00:00Z") });
  assert.equal(winner.state, "winner");
  assert.deepEqual(winner.winners.map((item) => item.name), ["Aidan Vogt"]);
  assert.equal(shareMeta(published, winner).title, "Winner: 2026 Boys Division IV Athlete of the Year");
  assert.notEqual(shareImageUrl("https://www.podiumwatch.org", published, winner), url, "a new image URL once there is a winner");
  // Before finalists are announced, nothing is shown.
  assert.equal(shareState({ ...category, finalists_published_at: null }, finalists).finalists.length, 0);
  const card = awardsCategoryCard(category, vote);
  assert.deepEqual([card.width, card.height], [1200, 630]);
  assert.match(JSON.stringify(card.element), /VOTE NOW/);
  assert.match(JSON.stringify(card.element), /podiumwatch\.org/);
  assert.match(JSON.stringify(card.element), /#0FAF68/);
  assert.match(JSON.stringify(awardsCategoryCard(published, winner).element), /WINNER/);
  assert.match(JSON.stringify(awardsCategoryCard({ ...category, gender: "girls" }, vote).element), /#EC4899/);
  assert.match(JSON.stringify(awardsFinalistCard(category, vote, vote.finalists[0]).element), /VOTE FOR/);
});

test("hourly backstop: 25 counted votes per network per category per hour, then refused until the next hour (2026-11-13)", async () => {
  const { castYearlyVote, useRedisClientForTests, NETWORK_LIMIT_PER_CATEGORY_PER_HOUR, yearlyVoteTally } = await import("../lib/yearly_awards_2026_votes.mjs");
  assert.equal(NETWORK_LIMIT_PER_CATEGORY_PER_HOUR, 25);
  const fake = fakeRedis();
  useRedisClientForTests(fake);
  const slug = "coach-girls-d4";
  const start = Date.parse("2026-11-12T07:00:00Z");
  let accepted = 0;
  let capped = 0;
  // One try every 31 seconds (just over the spacing) for 40 tries, all inside one clock hour.
  for (let i = 0; i < 40; i += 1) {
    const now = new Date(start + i * 31000);
    fake.setClock(now.getTime());
    const r = await castYearlyVote({ slug, finalistKey: "a", tokenHash: `cap${String(i).padStart(13, "0")}`, ipHash: "net0000000000000", now });
    if (r.accepted) accepted += 1;
    if (r.hourCapped) capped += 1;
  }
  assert.equal(accepted, 25);
  assert.equal(capped, 15);
  // Another network in the same hour, and the same network in the same hour in another category, are not affected.
  const mid = new Date(start + 30 * 60000);
  fake.setClock(mid.getTime());
  assert.equal((await castYearlyVote({ slug, finalistKey: "a", tokenHash: "other00000000000", ipHash: "net1111111111111", now: mid })).accepted, true);
  assert.equal((await castYearlyVote({ slug: "coach-boys-d4", finalistKey: "a", tokenHash: "cap0000000000000", ipHash: "net0000000000000", now: mid })).accepted, true);
  // Next clock hour: open again.
  const next = new Date(start + 61 * 60000);
  fake.setClock(next.getTime());
  assert.equal((await castYearlyVote({ slug, finalistKey: "a", tokenHash: "next00000000000a", ipHash: "net0000000000000", now: next })).accepted, true);
  assert.equal((await yearlyVoteTally(slug)).counts.a, 27);
});

test("hourly backstop: a refused vote gets its own message", () => {
  const service = fs.readFileSync("lib/yearly_awards_2026_service.mjs", "utf8");
  assert.match(service, /if \(result\.hourCapped\) throw error\("Your network has reached this category's vote limit for this hour\. Try again next hour\.", 429, "NETWORK_HOUR_LIMIT"\);/);
  assert.match(service, /if \(result\.spaced\) throw error\("Your network just voted in this category\. Try again in 30 seconds\.", 429, "NETWORK_SPACING"\);/);
});

test("public counter always equals the counted ballots: votes, cooldowns, spacing and hourly limits, voids (2026-11-13)", async () => {
  const { castYearlyVote, voidYearlyVotes, useRedisClientForTests, yearlyVoteTally, publicVoteCounts } = await import("../lib/yearly_awards_2026_votes.mjs");
  const fake = fakeRedis();
  useRedisClientForTests(fake);
  const slug = "coach-boys-d1";
  const start = Date.parse("2026-11-12T12:00:00Z");
  const cast = (input, ms) => { const now = new Date(start + ms); fake.setClock(now.getTime()); return castYearlyVote({ slug, ...input, now }); };
  const same = async () => { const [t, p] = await Promise.all([yearlyVoteTally(slug), publicVoteCounts(slug)]); assert.deepEqual(p.counts, t.counts); assert.equal(p.total, t.total); return t.total; };
  // Ordinary votes from four networks, each network every 32 s; the last 10 are repeat browsers inside the hour.
  for (let i = 0; i < 30; i += 1) await cast({ finalistKey: ["a", "b", "c"][i % 3], tokenHash: `tok${String(i % 20).padStart(13, "0")}`, ipHash: `net${String(i % 4).padStart(13, "0")}` }, i * 8000);
  assert.equal(await same(), 20, "10 repeat browsers inside the hour were refused");
  // A burst from one network: only the first counts (30-second spacing).
  for (let i = 0; i < 12; i += 1) await cast({ finalistKey: "b", tokenHash: `rate${String(i).padStart(12, "0")}`, ipHash: "b0b0b0b0b0b0b0b0" }, 600000);
  // A network past the hourly limit, trying every 31 s.
  for (let i = 0; i < 40; i += 1) await cast({ finalistKey: "c", tokenHash: `hour${String(i).padStart(12, "0")}`, ipHash: "hourcap000000000" }, 900000 + i * 31000);
  assert.equal(await same(), 20 + 1 + 25);
  // Voiding a network takes the same votes out of both.
  assert.equal((await voidYearlyVotes({ slug, ipPrefix: "b0b0b0b0", reason: "test" })).voided, 1);
  assert.equal(await same(), 20 + 25);
});

