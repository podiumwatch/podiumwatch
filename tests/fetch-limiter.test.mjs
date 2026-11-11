// Team pages: at most 16 Supabase requests open per server instance
// (2026-11-11, after EMFILE / EBUSY on Nov 10).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createLimitedFetch } from "../lib/fetch_limiter.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("never more than the cap open at once, and every request still finishes", async () => {
  let open = 0, peak = 0;
  const limited = createLimitedFetch({ max: 4, fetchImpl: async () => { open++; peak = Math.max(peak, open); await sleep(5); open--; return new Response('{"ok":true}', { status: 200, headers: { "content-type": "application/json" } }); } });
  const results = await Promise.all(Array.from({ length: 40 }, () => limited("https://x/rest/v1/t").then((r) => r.json())));
  assert.equal(peak, 4);
  assert.equal(results.length, 40);
  assert.ok(results.every((r) => r.ok));
  assert.deepEqual(limited.stats(), { active: 0, waiting: 0 });
});

test("the slot is held until the body has been read, and the body comes through intact", async () => {
  const limited = createLimitedFetch({ max: 1, fetchImpl: async () => new Response("hello", { status: 206, headers: { "content-range": "0-4/5" } }) });
  const response = await limited("https://x");
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("content-range"), "0-4/5");
  assert.equal(await response.text(), "hello");
  const head = await createLimitedFetch({ fetchImpl: async () => new Response(null, { status: 204 }) })("https://x");
  assert.equal(head.status, 204);
});

test("too many waiting, or waiting too long: fails fast instead of piling up", async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const limited = createLimitedFetch({ max: 1, maxQueue: 2, maxWaitMs: 30, fetchImpl: async () => { await gate; return new Response("x"); } });
  const first = limited("https://x");
  const queued = [limited("https://x"), limited("https://x")];
  await assert.rejects(limited("https://x"), (e) => e.code === "PW_DB_BUSY");
  for (const p of queued) await assert.rejects(p, (e) => e.code === "PW_DB_BUSY" && /too long/.test(e.message));
  release();
  assert.equal(await (await first).text(), "x");
  assert.deepEqual(limited.stats(), { active: 0, waiting: 0 });
});

test("a failed request frees its slot", async () => {
  const limited = createLimitedFetch({ max: 1, fetchImpl: async () => { throw new Error("socket hang up"); } });
  await assert.rejects(limited("https://x"), /socket hang up/);
  await assert.rejects(limited("https://x"), /socket hang up/);
  assert.equal(limited.stats().active, 0);
});

test("team pages read through the capped client", () => {
  assert.match(fs.readFileSync("lib/team_page_service.mjs", "utf8"), /import \{ supabasePublicPages as supabaseAdmin \} from "\.\/supabase-admin\.mjs"/);
  assert.match(fs.readFileSync("lib/supabase-admin.mjs", "utf8"), /global: \{ fetch: createLimitedFetch\(\) \}/);
});
