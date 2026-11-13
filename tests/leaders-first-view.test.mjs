// Site fixes A2 (2026-11-13): State Leaders first view rendered on the
// server, and the year list found with a few tiny queries instead of
// reading every performance row. Fake data only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { rankingLeadersPage, leaderRowsHtml, LEADERS_FIRST_VIEW } from "../src/pages/rankingleaders.mjs";
import { site } from "../src/config/site.mjs";

process.env.SUPABASE_URL ||= "https://example.invalid";
process.env.SUPABASE_SECRET_KEY ||= "test-key-not-real";
const { distinctYearsDescending } = await import("../lib/athlete_leaders_service.mjs");

const fake = (count) => Array.from({ length: count }, (_, index) => ({
  rank: index + 1, athlete_name: `Test Runner ${index + 1}`, athlete_slug: index === 0 ? "test-runner-1" : null,
  school_name: "Test School", division: "Division II", grade: 11, meet_name: "Test Invitational", meet_date: "2026-10-03", mark_text: "16:00.0"
}));

test("the first view (top 50) is in the HTML, with the year chosen and a show-more button", () => {
  const html = rankingLeadersPage(site, { years: [2026, 2025], season_year: 2026, total_before_limit: 900, entries: fake(LEADERS_FIRST_VIEW) });
  const tbody = html.match(/<tbody data-leaders-rows data-leaders-initial>([\s\S]*?)<\/tbody>/);
  assert.ok(tbody, "rows rendered on the server");
  assert.equal((tbody[1].match(/<tr data-leaders-rank=/g) || []).length, 50);
  assert.ok(!html.includes("Loading State Leaders."));
  assert.match(html, /<option value="2026" selected>2026<\/option><option value="2025">2025<\/option>/);
  assert.match(html, /data-leaders-more>Show places 51 to 100</);
  assert.match(tbody[1], /<a href="\/athletes\/test-runner-1\/">Test Runner 1<\/a>/);
  assert.match(tbody[1], /Oct 3, 2026/);
});

test("short lists have no show-more button; no data falls back to loading in the browser", () => {
  const short = rankingLeadersPage(site, { years: [2026], season_year: 2026, total_before_limit: 12, entries: fake(12) });
  assert.ok(!short.includes("data-leaders-more"));
  const fallback = rankingLeadersPage(site, null);
  assert.ok(fallback.includes("Loading State Leaders."));
  assert.ok(!fallback.includes("data-leaders-initial"));
});

test("server rows match the browser's row markup", () => {
  const client = fs.readFileSync("public/scripts/ranking-leaders.js", "utf8");
  for (const piece of ['class="leaders-cell-rank"', 'class="leaders-cell-athlete"', 'data-label="Grade"', 'data-label="Meet"', 'class="leaders-cell-time" data-label="Time"', "data-pw-division=", "data-pw-gender="]) {
    assert.ok(client.includes(piece), `browser renders ${piece}`);
    assert.ok(leaderRowsHtml(fake(1), "boys").includes(piece), `server renders ${piece}`);
  }
  assert.ok(client.includes('hasAttribute("data-leaders-initial")'), "browser skips its first load when rows are already there");
});

test("distinct years: one small query per year, newest first", async () => {
  const stored = [2026, 2026, 2025, 2024, 2026];
  const calls = [];
  const years = await distinctYearsDescending(async (below) => {
    calls.push(below);
    const candidates = stored.filter((year) => below === null || year < below);
    return candidates.length ? Math.max(...candidates) : null;
  });
  assert.deepEqual(years, [2026, 2025, 2024]);
  assert.deepEqual(calls, [null, 2026, 2025, 2024]);
});

test("/rankings/leaders/ is served by the server page, not a static file", () => {
  const vercel = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
  assert.ok(vercel.rewrites.some((r) => r.source === "/rankings/leaders/" && r.destination === "/api/pages/leaders"));
  assert.ok(!/writePage\("\/rankings\/leaders\/"/.test(fs.readFileSync("scripts/build.mjs", "utf8")));
});
