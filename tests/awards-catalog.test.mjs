// Voting fallback (2026-11-11): votes never wait on Supabase once a good
// copy of the categories and finalists exists.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createCatalog } from "../lib/yearly_awards_2026_catalog.mjs";

const GOOD = { categories: [{ id: "c1", slug: "athlete-boys-d1" }], finalists: [{ id: "f1", category_id: "c1", nominee_key: "123" }] };
const quiet = { warn() {}, error() {} };

function setup({ fail = false, hang = false, saved = null } = {}) {
  let clock = 1_000_000;
  const state = { loads: 0, saves: [], fail, hang, saved };
  const catalog = createCatalog({
    load: async (signal) => {
      state.loads++;
      if (state.hang) return new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted"))));
      if (state.fail) throw Object.assign(new Error("upstream request timeout"), { code: "504" });
      return structuredClone(GOOD);
    },
    redisGet: async () => state.saved,
    redisSet: async (json) => { state.saves.push(json); state.saved = json; },
    timeoutMs: 40,
    now: () => clock,
    log: quiet
  });
  return { catalog, state, tick: (ms) => { clock += ms; } };
}

test("fresh copy is reused for 10 seconds (one Supabase read for a crowd)", async () => {
  const { catalog, state, tick } = setup();
  await Promise.all(Array.from({ length: 50 }, () => catalog.get()));
  assert.equal(state.loads, 1, "concurrent requests share one load");
  tick(9_000); await catalog.get();
  assert.equal(state.loads, 1);
  tick(2_000); await catalog.get();
  assert.equal(state.loads, 2);
});

test("every good copy is saved to Redis, at most once a minute", async () => {
  const { catalog, state, tick } = setup();
  await catalog.get();
  assert.equal(state.saves.length, 1);
  assert.deepEqual(JSON.parse(state.saves[0]), GOOD);
  tick(11_000); await catalog.get();
  assert.equal(state.saves.length, 1);
  tick(60_000); await catalog.get();
  assert.equal(state.saves.length, 2);
});

test("Supabase fails: the last good copy in memory is served, and Supabase is left alone for 5 seconds", async () => {
  const { catalog, state, tick } = setup();
  await catalog.get();
  state.fail = true;
  tick(11_000);
  const copy = await catalog.get();
  assert.equal(copy.stale, true);
  assert.deepEqual(copy.categories, GOOD.categories);
  const loads = state.loads;
  for (let i = 0; i < 20; i++) await catalog.get();
  assert.equal(state.loads, loads, "no retries inside the 5 second window");
  tick(6_000); await catalog.get();
  assert.equal(state.loads, loads + 1);
  state.fail = false;
  tick(6_000);
  assert.equal((await catalog.get()).stale, undefined, "back to fresh once Supabase answers");
});

test("Supabase slow: times out and serves the saved copy instead of waiting", async () => {
  const { catalog, state, tick } = setup();
  await catalog.get();
  state.hang = true;
  tick(11_000);
  const started = Date.now();
  const copy = await catalog.get();
  assert.ok(Date.now() - started < 1_000);
  assert.equal(copy.stale, true);
});

test("cold instance during an outage: the Redis copy is used", async () => {
  const { catalog } = setup({ fail: true, saved: JSON.stringify(GOOD) });
  const copy = await catalog.get();
  assert.equal(copy.stale, true);
  assert.equal(copy.finalists[0].nominee_key, "123");
  const objectSaved = setup({ fail: true, saved: GOOD }); // Upstash may hand back parsed JSON
  assert.equal((await objectSaved.catalog.get()).categories[0].slug, "athlete-boys-d1");
});

test("no copy anywhere: the Supabase error is passed on (the vote API answers with its safe message)", async () => {
  const { catalog } = setup({ fail: true, saved: null });
  await assert.rejects(catalog.get(), /upstream request timeout/);
});

test("the vote and status paths read the catalog, not Supabase directly", () => {
  const source = fs.readFileSync("lib/yearly_awards_2026_service.mjs", "utf8");
  const vote = source.slice(source.indexOf("async function categoryForVoting"), source.indexOf("// Pure: is this vote allowed"));
  assert.match(vote, /catalog\.get\(\)/);
  assert.doesNotMatch(vote, /db\(\)/);
  const status = source.slice(source.indexOf("export async function listPublicCategories"), source.indexOf("export async function submitNomination"));
  assert.match(status, /catalog\.get\(\)/);
  assert.doesNotMatch(status, /db\(\)/);
});
