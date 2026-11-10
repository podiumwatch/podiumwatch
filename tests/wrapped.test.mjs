import test from "node:test";
import assert from "node:assert/strict";
import { buildWrapped, postseasonLine, furthestRound } from "../src/lib/wrapped.mjs";
import { wrappedCard, wrappedTiles } from "../lib/og/wrapped_card.mjs";
import { wrappedPageHtml } from "../lib/render/wrapped_page.mjs";
import { site } from "../src/config/site.mjs";

const profile = { slug: "test-runner", display_name: "Test Runner", gender: "girls" };
const row = (meet, date, mark, value, extra = {}) => ({ season_year: 2026, event_key: "xc_5k", mark_unit: "seconds", meet_name: meet, meet_date: date, mark_text: mark, mark_value: value, place: null, result_status: "official_result", ...extra });
const rows = [
  row("Mystery Invite", null, "21:44.23", 1304.23, { place: 1 }),
  row("Opener", "2026-08-29", "20:00.0", 1200, { place: 9 }),
  row("OHSAA Cross Country District - Somewhere", "2026-10-24", "19:00.0", 1140, { place: 4, metadata: { postseason_2026: { level: "district", division: 3 } } }),
  row("OHSAA Cross Country Regional - Troy", "2026-10-31", "19:10.0", 1150, { place: 12, metadata: { postseason_2026: { level: "regional", division: 3 } } }),
  row("OHSAA Cross Country State Championships", "2026-11-07", "19:05.0", 1145, { place: 20, honor_label: "All-Ohio first team", metadata: { postseason_2026: { level: "state", division: 3 } } })
];

test("wrapped: 3 or more public results; fewer gets no card", () => {
  assert.equal(buildWrapped({ profile, rows: rows.slice(0, 2) }).eligible, false);
  assert.equal(buildWrapped({ profile, rows }).eligible, true);
});

test("wrapped: facts from the rows; an undated race is never the first race", () => {
  const w = buildWrapped({ profile, school: "Test High", rows, ranks: { division: { rank: 12, of: 1204, division: "Division III" }, grade: { rank: 3, of: 1142, grade: 11 } } });
  assert.equal(w.races, 5);
  assert.equal(w.best.mark, "19:00.0");
  assert.equal(w.first.mark, "20:00.0", "the dated opener, not the undated race");
  assert.equal(w.drop_text, "1:00.0");
  assert.equal(w.best_place.place_text, "1st");
  assert.equal(postseasonLine(w), "District 4th, Regional 12th, State 20th");
  assert.equal(furthestRound(w), "State meet, Division III");
  assert.equal(w.all_ohio, "All-Ohio First Team");
  assert.equal(w.rank_division.text, "12th of 1,204 in Division III");
  assert.equal(w.rank_grade.text, "3rd of 1,142 juniors");
});

test("wrapped: reviewed results never give a place; no rank is shown when the leaders list has none", () => {
  const reviewed = rows.map((r) => ({ ...r, result_status: "reviewed_result" }));
  const w = buildWrapped({ profile, rows: reviewed });
  assert.equal(w.best_place, null);
  assert.equal(w.all_ohio, null);
  assert.ok(w.postseason.every((p) => p.place === null));
  assert.equal(w.rank_division, null);
  assert.equal(w.rank_grade, null);
});

test("wrapped: first race was the season best", () => {
  const w = buildWrapped({ profile, rows: [row("A", "2026-09-01", "18:00.0", 1080), row("B", "2026-09-08", "18:30.0", 1110), row("C", "2026-09-15", "18:20.0", 1100)] });
  assert.equal(w.first_is_best, true);
  assert.equal(w.drop_text, null);
});

test("wrapped card: story keeps 250 px clear top and bottom; girls pink, boys green; site address on both", () => {
  const w = buildWrapped({ profile, school: "Test High", rows });
  const story = wrappedCard(w, { size: "story" });
  assert.equal(story.height, 1920);
  assert.equal(story.element.props.style.padding, "250px 72px 250px");
  const json = JSON.stringify(story.element);
  assert.match(json, /#EC4899/);
  assert.match(json, /podiumwatch\.org\/wrapped/);
  assert.match(json, /different courses/);
  const boys = JSON.stringify(wrappedCard({ ...w, gender: "boys" }, { size: "post" }).element);
  assert.match(boys, /#0FAF68/);
  assert.match(boys, /podiumwatch\.org\/wrapped/);
  assert.ok(wrappedTiles(w).length <= 4);
});

test("wrapped page: facts, downloads and the missing-races link; ineligible shows only the link", () => {
  const w = buildWrapped({ profile, school: "Test High", rows });
  const html = wrappedPageHtml(site, w);
  assert.match(html, /Download Story \(1080x1920\)/);
  assert.match(html, /Missing races\? Send the results/);
  assert.match(html, /Different courses/);
  const none = wrappedPageHtml(site, buildWrapped({ profile, rows: rows.slice(0, 2) }));
  assert.match(none, /needs at least 3 public 2026/);
  assert.doesNotMatch(none, /Download Story/);
});
