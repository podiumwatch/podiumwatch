// Read-only pages: CDN caching plus a last-good copy on database errors
// (2026-11-11). Votes, admin and tracking stay live.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { CACHE_API_60, CACHE_PAGE, createLastGood, sendLastGood } from "../lib/page_cache.mjs";

function fakeResponse() {
  return { headers: {}, code: 0, body: null, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, status(c) { this.code = c; return this; }, send(b) { this.body = b; return this; } };
}

test("cache times: pages 15 minutes, meets and awards status 60 seconds, both stale-while-revalidate", () => {
  assert.equal(CACHE_PAGE, "public, s-maxage=900, stale-while-revalidate=86400");
  assert.equal(CACHE_API_60, "public, s-maxage=60, stale-while-revalidate=600");
});

test("last good copy: served on error with a short cache, nothing when there is none", () => {
  const store = createLastGood();
  const empty = fakeResponse();
  assert.equal(sendLastGood(empty, "team:x", store), false);
  assert.equal(empty.code, 0);
  store.remember("team:x", "text/html; charset=utf-8", "<p>good</p>");
  const res = fakeResponse();
  assert.equal(sendLastGood(res, "team:x", store), true);
  assert.equal(res.code, 200);
  assert.equal(res.body, "<p>good</p>");
  assert.equal(res.headers["cache-control"], "public, s-maxage=60");
  assert.equal(res.headers["x-pw-stale"], "1");
});

test("last good copy: bounded by entries and bytes, oldest dropped first", () => {
  const store = createLastGood({ maxEntries: 3, maxBytes: 1000 });
  for (const key of ["a", "b", "c", "d"]) store.remember(key, "text/html", "x".repeat(100));
  assert.equal(store.size(), 3);
  assert.equal(store.get("a"), null);
  store.remember("big", "text/html", "y".repeat(240));
  store.remember("big2", "text/html", "y".repeat(240));
  store.remember("big3", "text/html", "y".repeat(240));
  assert.ok(store.bytes() <= 1000);
  store.remember("huge", "text/html", "z".repeat(600));
  assert.equal(store.get("huge"), null, "a single response over a quarter of the budget is not kept");
});

test("read-only handlers cache and fall back; errors are never cached", () => {
  const handlers = {
    "api/pages/team.js": "team:",
    "api/pages/athlete.js": "athlete:",
    "api/pages/season-hub.js": "hub:",
    "api/pages/front-page.js": "front-page",
    "api/pages/commitments.js": "commitments:",
    "api/awards-2026/status.js": "awards-status",
    "api/meets/index.js": "meets"
  };
  for (const [file, key] of Object.entries(handlers)) {
    const source = fs.readFileSync(file, "utf8");
    assert.ok(source.includes(`rememberGood(${key.endsWith(":") ? "`" + key : '"' + key}`), `${file} remembers good responses`);
    assert.match(source, /if \(sendLastGood\(response, /, `${file} serves the last good copy on error`);
    const errorBranch = source.slice(source.indexOf("sendLastGood(response"));
    assert.match(errorBranch, /no-store|status\(500\)/, `${file} still answers an error uncached when there is no copy`);
  }
  assert.match(fs.readFileSync("api/meets/index.js", "utf8"), /CACHE_API_60/);
  assert.match(fs.readFileSync("api/awards-2026/status.js", "utf8"), /CACHE_API_60/);
  for (const file of ["api/pages/team.js", "api/pages/athlete.js", "api/pages/season-hub.js"]) assert.match(fs.readFileSync(file, "utf8"), /CACHE_PAGE/, file);
});

test("votes, admin and tracking stay live (never CDN cached)", () => {
  for (const file of ["api/awards-2026/vote.js", "api/engagement/track.js"]) {
    const source = fs.readFileSync(file, "utf8");
    assert.match(source, /"Cache-Control", "no-store"/, file);
    assert.doesNotMatch(source, /page_cache|s-maxage/, file);
  }
});
