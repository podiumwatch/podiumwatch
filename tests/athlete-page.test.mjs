import test from "node:test";
import assert from "node:assert/strict";
import { athleteIsIndexable, athletePageHtml, bestByEvent } from "../lib/render/athlete_page.mjs";
import { site } from "../src/config/site.mjs";



const base = {
  profile: { slug: "pat-runner-somewhere-2028", display_name: "Pat Runner", gender: "boys", graduation_year: 2028, hometown: "Secret Town", college_commitment: null, updated_at: "2026-11-01T00:00:00Z" },
  school: { school_name: "Somewhere" },
  team: { slug: "somewhere-somewhere-1", school_name: "Somewhere" },
  path_to_state: { path: { available: true, division_label: "Division III", nodes: [{ label: "District", status: "not_started", status_source: "default", status_label: "Not started" }] } },
  performances: [
    { season_year: 2026, event_key: "xc_5k", event_name: "Cross Country 5K", mark_text: "16:10.0", mark_value: 970, mark_unit: "seconds", meet_name: "Meet A", meet_date: "2026-09-01", place: 3, source_label: "Official results" },
    { season_year: 2026, event_key: "xc_5k", event_name: "Cross Country 5K", mark_text: "15:58.2", mark_value: 958.2, mark_unit: "seconds", meet_name: "Meet B", meet_date: "2026-10-01", place: 1, source_label: "Official results", source_url: "https://example.com/r" },
    { season_year: 2025, event_key: "xc_5k", event_name: "Cross Country 5K", mark_text: "16:40.0", mark_value: 1000, mark_unit: "seconds", meet_name: "Meet C", meet_date: "2025-10-01", source_label: "Official results" }
  ],
  rankings: [],
  stories: []
};

test("fastest mark wins for timed events; farthest for field events", () => {
  assert.equal(bestByEvent(base.performances.filter((row) => row.season_year === 2026))[0].mark_text, "15:58.2");
  const field = [{ event_key: "lj", mark_value: 6.1, mark_unit: "meters" }, { event_key: "lj", mark_value: 6.4, mark_unit: "meters" }];
  assert.equal(bestByEvent(field)[0].mark_value, 6.4);
});

test("indexed only with a sourced public performance", () => {
  assert.equal(athleteIsIndexable(base), true);
  assert.equal(athleteIsIndexable({ ...base, performances: [] }), false);
  assert.equal(athleteIsIndexable({ ...base, performances: [{ mark_text: "16:00" }] }), false);
});

test("the page carries its content, title, canonical and JSON-LD, never the hometown", () => {
  const html = athletePageHtml(site, base);
  assert.match(html, /<h1>Pat Runner<\/h1>/);
  assert.match(html, /15:58\.2/);
  assert.match(html, /Season by season/);
  assert.match(html, /<title>Pat Runner \| Somewhere Cross Country &amp; Track \| Podium Watch<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/www\.podiumwatch\.org\/athletes\/pat-runner-somewhere-2028\/"/);
  assert.match(html, /"@type":"ProfilePage"/);
  assert.match(html, /name="robots" content="index, follow"/);
  assert.doesNotMatch(html, /Secret Town/);
  assert.doesNotMatch(html, /Path to State/, "a Path to State with only default 'Not started' stages is left out");
  assert.doesNotMatch(html, /Loading/);
});

test("a profile with no results is noindex and says so plainly", () => {
  const html = athletePageHtml(site, { ...base, performances: [] });
  assert.match(html, /name="robots" content="noindex, follow"/);
  assert.match(html, /No results for Pat Runner are on Podium Watch yet/);
});
