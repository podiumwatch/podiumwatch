// Analytics intake after the Nov 10 voting surge (2026-11-11): the track
// endpoint answers 204 without waiting on the database, rows are written in
// batches, and a slow or failing database only drops rows.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY ||= "test-service-role-key";

const { analyticsRow } = await import("../lib/engagement_service.mjs");
const { createAnalyticsBuffer } = await import("../lib/analytics_buffer.mjs");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("analyticsRow: cleans a real page view, rejects anything else without throwing", () => {
  const row = analyticsRow({ event_type: "page_view", path: "/awards/2026/", content_id: "/awards/2026/", referrer: "https://www.instagram.com/x", metadata: { utm_source: "ig" } });
  assert.equal(row.event_type, "page_view");
  assert.equal(row.referrer_host, "www.instagram.com");
  assert.deepEqual(row.metadata, { utm_source: "ig" });
  assert.ok(row.created_at);
  assert.equal(analyticsRow({ event_type: "drop_table" }), null);
  assert.equal(analyticsRow(null), null);
  assert.equal(analyticsRow("text"), null);
  assert.deepEqual(analyticsRow({ event_type: "page_view", metadata: { big: "x".repeat(2000) } }).metadata, {});
});

test("buffer: many views become one write after the flush window", async () => {
  const writes = [];
  const buffer = createAnalyticsBuffer({ write: async (rows) => writes.push(rows.length), flushMs: 30 });
  const promises = [];
  for (let i = 0; i < 25; i++) promises.push(buffer.add({ i }));
  assert.equal(writes.length, 0, "nothing written while requests are arriving");
  await Promise.all(promises);
  assert.deepEqual(writes, [25]);
});

test("buffer: a full batch writes at once and splits at the batch size", async () => {
  const writes = [];
  const buffer = createAnalyticsBuffer({ write: async (rows) => writes.push(rows.length), flushMs: 10_000, maxBatch: 10 });
  const promises = [];
  for (let i = 0; i < 23; i++) promises.push(buffer.add({ i }));
  await Promise.race([Promise.all(promises), sleep(500).then(() => { throw new Error("waited for the timer"); })]);
  assert.equal(writes.reduce((a, b) => a + b, 0), 23);
  assert.ok(writes.every((n) => n <= 10));
});

test("buffer: a failed or slow write drops that batch and never rejects", async () => {
  let drops = 0;
  const buffer = createAnalyticsBuffer({ write: async () => { throw new Error("504"); }, flushMs: 5, onDrop: (n) => { drops += n; } });
  await Promise.all([buffer.add({ a: 1 }), buffer.add({ a: 2 })]);
  assert.equal(drops, 2);
  assert.equal(buffer.size(), 0);
  const later = [];
  const recovered = createAnalyticsBuffer({ write: async (rows) => later.push(rows.length), flushMs: 5 });
  await recovered.add({ a: 3 });
  assert.deepEqual(later, [1]);
});

test("buffer: the queue is capped so a dead database can't grow memory", async () => {
  let dropped = 0;
  let release;
  const blocked = new Promise((resolve) => { release = resolve; });
  const buffer = createAnalyticsBuffer({ write: () => blocked, flushMs: 1, maxBatch: 5, maxQueue: 20, onDrop: (n) => { dropped += n; } });
  for (let i = 0; i < 40; i++) buffer.add({ i });
  assert.ok(buffer.size() <= 20);
  assert.ok(dropped >= 15);
  release();
});

test("track endpoint: answers 204 before any database work, for good and bad events", async () => {
  const { default: handler } = await import("../api/engagement/track.js");
  for (const body of [{ event_type: "page_view", path: "/" }, "not json", { event_type: "nope" }, JSON.stringify({ event_type: "story_view" })]) {
    let status = 0;
    let ended = false;
    const response = { setHeader() {}, status(code) { status = code; return this; }, end() { ended = true; return this; }, json() { ended = true; return this; } };
    const started = Date.now();
    const result = handler({ method: "POST", body }, response);
    assert.ok(!(result instanceof Promise), "the handler must not be async (nothing to await)");
    assert.equal(status, 204);
    assert.ok(ended);
    assert.ok(Date.now() - started < 50);
  }
});

test("browser senders use sendBeacon and never await the track call", () => {
  for (const file of ["page-view.js", "story-view.js", "engagement.js", "pace-calculator.js", "podium-play.js", "merch-card.js"]) {
    const source = fs.readFileSync(`public/scripts/${file}`, "utf8");
    assert.match(source, /navigator\.sendBeacon\("\/api\/engagement\/track"/, file);
    assert.doesNotMatch(source, /await fetch\("\/api\/engagement\/track"/, file);
  }
});
