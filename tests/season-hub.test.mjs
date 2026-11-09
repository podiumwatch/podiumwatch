import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { HUB_STORIES, hubForMeetSlug, allHubPaths } from "../src/config/season_hubs.mjs";
import { seasonHubPage } from "../src/pages/seasonhub.mjs";
import { site } from "../src/config/site.mjs";
import { HUB_STAGES } from "../src/config/season_hubs.mjs";

import { buildRaces, fastestTimes } from "../src/lib/season_hub_races.mjs";

const meets = [{ id: "m1", name: "OHSAA Cross Country District - Hilliard Darby", slug: "2026-ohsaa-district-hilliard-darby", meet_date: "2026-10-24" }];
const perf = (place, session, gender = "boys") => ({ meet_id: "m1", place, mark_value: 900 + place, mark_unit: "seconds", mark_text: `15:${String(place).padStart(2, "0")}.0`, metadata: { postseason_2026: { gender, division: 2, ...(session ? { session } : {}) } } });

test("two sessions at one site stay two races; places are never merged", () => {
  const races = buildRaces({ meets, year: 2026, performances: [perf(1, 1), perf(2, 1), perf(1, 2), perf(2, 2)], teamScores: [
    { meet_id: "m1", gender: "boys", division: "Division II", provider_event_id: "district-boys-d2-hilliard-darby-district-session-1", place_numeric: 1, score: 40 },
    { meet_id: "m1", gender: "boys", division: "Division II", provider_event_id: "district-boys-d2-hilliard-darby-district-session-2", place_numeric: 1, score: 50 }
  ] });
  assert.equal(races.length, 2);
  assert.deepEqual(races.map((r) => [r.session, r.runners.map((x) => x.place), r.teams.map((t) => t.score)]), [[1, [1, 2], [40]], [2, [1, 2], [50]]]);
});

test("a tie in the official results is kept as posted", () => {
  const [race] = buildRaces({ meets, year: 2026, performances: [perf(20, null, "girls"), { ...perf(20, null, "girls") }, perf(19, null, "girls")], teamScores: [] });
  assert.deepEqual(race.runners.map((r) => r.place), [19, 20, 20]);
});

test("fastest times sort by the stored time only", () => {
  const races = buildRaces({ meets, year: 2026, performances: [perf(3, null), perf(1, null), { ...perf(2, null), mark_unit: "meters" }], teamScores: [] });
  assert.deepEqual(fastestTimes(races, "boys").map((r) => r.place), [1, 3]);
});

test("meet slugs link to their hub only for years with results", () => {
  assert.equal(hubForMeetSlug("2026-ohsaa-state-championships"), "/state/2026/");
  assert.equal(hubForMeetSlug("2026-ohsaa-regional-troy"), "/regionals/2026/");
  assert.equal(hubForMeetSlug("2026-ohsaa-district-madison"), "/districts/2026/");
  assert.equal(hubForMeetSlug("2025-ohsaa-state-championships"), null);
  assert.equal(hubForMeetSlug("tiffin-carnival-2026"), null);
  assert.deepEqual(allHubPaths(), ["/state/2026/", "/regionals/2026/", "/districts/2026/"]);
});

test("every linked story exists, is published, and has the same title and date", () => {
  const files = fs.readdirSync("content/stories").filter((f) => f.endsWith(".md"));
  for (const [hub, stories] of Object.entries(HUB_STORIES)) for (const story of stories) {
    const file = files.find((f) => fs.readFileSync(`content/stories/${f}`, "utf8").includes(`slug: "${story.slug}"`));
    assert.ok(file, `${hub}: no story file for ${story.slug}`);
    const text = fs.readFileSync(`content/stories/${file}`, "utf8");
    assert.match(text, new RegExp(`date: "${story.date}"`), `${story.slug} date`);
    assert.ok(text.includes(`title: "${story.title.replace(/"/g, '\\"')}"`) || text.includes(`title: '${story.title}'`), `${story.slug} title`);
    assert.doesNotMatch(text, /draft: true/, `${story.slug} is a draft`);
  }
});

test("the state hub page names the timing credit, links athletes, and never says OHSAA in its title", () => {
  const races = buildRaces({ meets: [{ id: "s", name: "OHSAA Cross Country State Championships", slug: "2026-ohsaa-state-championships", meet_date: "2026-11-07", venue_name: "Fortress Obetz", results_url: "https://www.athletic.net/CrossCountry/meet/275513/results" }], year: 2026,
    performances: [{ meet_id: "s", place: 1, mark_value: 890.7, mark_unit: "seconds", mark_text: "14:50.7", name: "Brice Fuller", href: "/athletes/brice-fuller-fairless-2028/", school: "Fairless", honor_label: "All-Ohio first team", metadata: { postseason_2026: { gender: "boys", division: 3 } } }],
    teamScores: [{ meet_id: "s", gender: "boys", division: "Division III", place_numeric: 1, score: 65, school: "Woodridge" }] });
  const hub = { stageKey: "state", stage: HUB_STAGES.state, year: 2026, meets: races.map((r) => r.meet), races, fastest: { girls: [], boys: fastestTimes(races, "boys") }, stories: [], photos: [] };
  const html = seasonHubPage(site, hub);
  assert.match(html, /<title>2026 Ohio High School Cross Country State Meet Results \| Podium Watch<\/title>/);
  assert.match(html, /Results by SEO Timing\./);
  assert.match(html, /href="\/athletes\/brice-fuller-fairless-2028\/"/);
  assert.match(html, /Woodridge/);
  assert.match(html, /athletic\.net\/CrossCountry\/meet\/275513\/results/);
});
