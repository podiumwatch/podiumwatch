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
  assert.match(html, /name="robots" content="index, follow, max-image-preview:large"/);
  assert.doesNotMatch(html, /Secret Town/);
  assert.doesNotMatch(html, /Path to State/, "a Path to State with only default 'Not started' stages is left out");
  assert.doesNotMatch(html, /Loading/);
});

test("a profile with no results is noindex and says so plainly", () => {
  const html = athletePageHtml(site, { ...base, performances: [] });
  assert.match(html, /name="robots" content="noindex, follow"/);
  assert.match(html, /No results for Pat Runner are on Podium Watch yet/);
});

test("honors come only from official state results and the import's labels", async () => {
  const { athleteHonors, postseasonByStage } = await import("../lib/render/athlete_page.mjs");
  const state = { season_year: 2026, sport: "cross_country", meet_name: "OHSAA Cross Country State Championships", place: 1, mark_text: "14:50.7", result_status: "official_result", honor_label: "All-Ohio first team" };
  const district = { season_year: 2026, sport: "cross_country", meet_name: "OHSAA Cross Country District - Cambridge", place: 1, mark_text: "15:06.7", result_status: "official_result" };
  assert.deepEqual(athleteHonors([state, district]).map((h) => h.label), ["2026 State champion", "2026 All-Ohio First Team"]);
  assert.deepEqual(athleteHonors([{ ...state, place: 30, honor_label: "All-Ohio second team" }]).map((h) => h.label), ["2026 All-Ohio Second Team"]);
  assert.deepEqual(athleteHonors([{ ...state, result_status: "reviewed_result" }]), []);
  assert.deepEqual(athleteHonors([{ ...district, place: 1 }]), []);
  const stages = postseasonByStage([state, district, { ...district, meet_name: "Billy Goat Challenge" }], 2026);
  assert.deepEqual(Object.keys(stages).sort(), ["district", "state"]);
  assert.equal(postseasonByStage([{ ...district, place: null }], 2026).district, undefined);
});

// ---- Site redesign step 4 -------------------------------------------------
test("redesign: band with the school link, stat cards, SB tag and gaps from the stored marks", async () => {
  const html = athletePageHtml(site, base);
  assert.match(html, /<p class="pw-band-context"><a href="\/teams\/somewhere-somewhere-1\/">Somewhere<\/a> · Class of 2028 · Boys Division III<\/p>/);
  assert.match(html, /<small>2026 season best · 5K<\/small><b>15:58\.2<\/b>/);
  assert.match(html, /15:58\.2 <em class="pw-sb">SB<\/em>/, "the season best is marked SB");
  assert.match(html, /16:10\.0<span class="pw-sub">\+11\.8 off season best<\/span>/, "the gap is worked out from the stored marks");
  assert.doesNotMatch(html, /16:40\.0<span/, "only the latest season is in the results table");
  assert.match(html, /<details class="pw-report"><summary>Something wrong\? Submit a correction<\/summary>/, "correction form is collapsed");
  assert.match(html, /data-athlete-correction-form/);
  assert.match(html, /data-athlete-share/);
  assert.doesNotMatch(html, /data-pw-support|support-card/i, "no donation block");
});

test("redesign: a one-result athlete has no SB tag, no gap and no ranking card", () => {
  const one = { ...base, performances: [base.performances[1]], rankings: [{ rank: 19, ranking_title: "2026 Division 3 Boys Cross Country Top 25", ranking_type: "Podium Watch editorial ranking", division: "Division 3", gender: "boys", current: true, editorial_only: true }] };
  const html = athletePageHtml(site, one);
  assert.doesNotMatch(html, /pw-sb/);
  assert.doesNotMatch(html, /off season best/);
  assert.doesNotMatch(html, /<small>Podium Watch ranking<\/small>/);
  assert.match(html, /An editorial ranking, not an official result\./, "the Rankings panel still lists it, labeled editorial");
});

test("redesign: a team honor shows only when the athlete ran that state meet", async () => {
  const { bandHonors } = await import("../lib/render/athlete_page.mjs");
  const path = { available: true, season_year: 2026, gender: "boys", division_label: "Division I", nodes: [{ key: "state", status: "qualified_team", status_source: "admin", note: "Finished 1st as a team, 107 points" }] };
  const ran = [{ season_year: 2026, meet_name: "OHSAA Cross Country State Championships", place: 16, result_status: "official_result", honor_label: "All-Ohio first team" }];
  assert.deepEqual(bandHonors({ profile: {}, path_to_state: { path } }, ran), [
    { label: "All-Ohio First Team", note: "2026 Cross Country", featured: true },
    { label: "State Champion team", note: "Division I Boys · 107 pts" }
  ]);
  const didNotRun = [{ season_year: 2026, meet_name: "OHSAA Cross Country Regional - Troy", place: 20, result_status: "official_result" }];
  assert.deepEqual(bandHonors({ profile: {}, path_to_state: { path } }, didNotRun), []);
});

test("redesign: teammates are the next three on the roster, filled from ahead near the bottom", async () => {
  const { teammatesFor } = await import("../lib/render/athlete_page.mjs");
  const roster = Array.from({ length: 6 }, (_, i) => ({ slug: `test-mate-${i}`, name: `Test Mate ${i}`, best: `16:0${i}.0` }));
  const team = { genders: { boys: { roster } } };
  assert.deepEqual(teammatesFor(team, { slug: "test-mate-0", gender: "boys" }).map((t) => t.slug), ["test-mate-1", "test-mate-2", "test-mate-3"]);
  assert.deepEqual(teammatesFor(team, { slug: "test-mate-5", gender: "boys" }).map((t) => t.slug), ["test-mate-2", "test-mate-3", "test-mate-4"]);
  assert.deepEqual(teammatesFor(team, { slug: "test-not-listed", gender: "boys" }).map((t) => t.slug), ["test-mate-0", "test-mate-1", "test-mate-2"]);
  assert.deepEqual(teammatesFor(null, { slug: "x", gender: "boys" }), []);
});
