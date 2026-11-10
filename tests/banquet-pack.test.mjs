import test from "node:test";
import assert from "node:assert/strict";
import { buildBanquetPack, awardSchoolMatches, seasonMeetCount, formatSeconds } from "../src/lib/banquet_pack.mjs";
import { banquetPageHtml, banquetSlides, banquetSlidesHtml, classLabel } from "../lib/render/banquet_page.mjs";
import { site } from "../src/config/site.mjs";

const profiles = [
  { id: "p1", slug: "ava-senior", display_name: "Ava Senior", gender: "girls", graduation_year: 2027 },
  { id: "p2", slug: "bo-junior", display_name: "Bo Junior", gender: "girls", graduation_year: 2028 },
  { id: "p3", slug: "cy-two", display_name: "Cy Two", gender: "girls", graduation_year: 2029 }
];
const perf = (id, profile, meet, date, mark, value) => ({ id, profile_id: profile, season_year: 2026, meet_name: meet, meet_date: date, mark_text: mark, mark_value: value, mark_unit: "seconds", place: null });
const perfs = [
  perf(1, "p1", "Meet A", "2026-08-29", "21:00.0", 1260), perf(2, "p1", "Meet B", "2026-09-12", "20:30.0", 1230), perf(3, "p1", "Meet C", "2026-10-03", "20:00.0", 1200),
  perf(4, "p2", "Meet A", "2026-08-29", "22:00.0", 1320), perf(5, "p2", "Meet B", "2026-09-12", "21:00.0", 1260),
  perf(6, "p3", "Meet A", "2026-08-29", "23:00.0", 1380)
];
const results = (n) => [{ meet: "Meet A", date: "2026-08-29", runners: 3, place: 2, score: 40 }, { meet: "Meet B", date: "2026-09-12", runners: 2, place: null, score: null }, { meet: "Meet C", date: "2026-10-03", runners: 1, place: null, score: null }].slice(0, n);
const empty = { division: null, roster: [], results: [], path: [], state: null, all_ohio: 0 };
const data = (meets) => ({
  team: { id: "t1", slug: "test-high", display_name: "Test High", school_name: "Test High", city: "Testville", ohio_school_id: "s1" },
  logo: null, accent: "#123456", accent_text: "#ffffff", season: 2026, claimed: true,
  genders: { boys: { ...empty }, girls: { ...empty, division: "Division III", roster: [{ slug: "ava-senior", honor: "All-Ohio first team" }], results: results(meets), path: [{ stage: "district", place: 1, score: 30, runners: 7 }] } },
  rows: { profiles, perfs, teamScores: [] }
});
const awards = {
  weekly: [{ award: "Athlete of the Week", week: "2026-09-16", athlete_name: "Ava Senior", school: "Test High", winner: true, decided: true }, { award: "Athlete of the Week", week: "2026-09-23", athlete_name: "Someone Else", school: "Other High", winner: true, decided: true }],
  yearly: [{ label: "Girls Division III Athlete of the Year", award: "athlete", display_name: "Bo Junior", school: "Test High", school_id: null, winner: false, finalists_published_at: "2026-11-10", results_published_at: null }]
};

test("banquet: 3 meets builds the full pack; 2 meets does not", () => {
  assert.equal(seasonMeetCount(data(3)), 3);
  const two = buildBanquetPack(data(2), { awards });
  assert.equal(two.eligible, false);
  assert.equal(two.genders, undefined);
  const html = banquetPageHtml(site, { ...two, claimed: true });
  assert.match(html, /Built from 2 meets on Podium Watch/);
  assert.match(html, /Upload results/);
  assert.doesNotMatch(html, /Projector slides|Season bests|Coach tools/);
  const full = buildBanquetPack(data(3), { awards });
  assert.equal(full.eligible, true);
  assert.equal(full.meet_count, 3);
});

test("banquet: season bests, first race, most improved needs 3 races, seniors, awards", () => {
  const pack = buildBanquetPack(data(3), { awards });
  const g = pack.genders.girls;
  assert.deepEqual(g.athletes.map((a) => [a.name, a.best.mark, a.first.mark]), [["Ava Senior", "20:00.0", "21:00.0"], ["Bo Junior", "21:00.0", "22:00.0"], ["Cy Two", "23:00.0", "23:00.0"]]);
  assert.equal(g.athletes[0].drop, 60);
  assert.equal(g.athletes[2].drop, null, "one race: no change");
  assert.deepEqual(g.improved.map((a) => a.name), ["Ava Senior"], "Bo has only 2 races");
  assert.deepEqual(g.top7_by_meet, [], "never 7 runners");
  assert.deepEqual(g.all_ohio.map((a) => a.name), ["Ava Senior"]);
  assert.deepEqual(pack.seniors.map((a) => a.name), ["Ava Senior"]);
  assert.deepEqual(pack.awards.map((a) => [a.name, a.result]), [["Ava Senior", "Winner"], ["Bo Junior", "Finalist"]]);
  const html = banquetPageHtml(site, pack);
  assert.match(html, /Team score not posted/);
  assert.match(html, /2nd &middot; 40 pts/);
  assert.match(html, /First race on Podium Watch/);
  assert.match(html, /Different courses/);
  assert.match(html, /Built from 3 meets on Podium Watch\. Missing a meet\? <a href="\/submit-results\/\?team=Test%20High&amp;sport=cross_country&amp;season=2026">Send the results<\/a>/);
});

test("banquet: a hidden athlete leaves every list, awards included; times are untouched", () => {
  const pack = buildBanquetPack(data(3), { awards, settings: { hidden_profile_ids: ["p1"], note: "  Great season!  " } });
  const g = pack.genders.girls;
  assert.equal(pack.hidden_count, 1);
  assert.equal(pack.note, "Great season!");
  assert.ok(!g.athletes.some((a) => a.name === "Ava Senior"));
  assert.deepEqual(g.improved, []);
  assert.deepEqual(g.all_ohio, []);
  assert.deepEqual(pack.seniors, []);
  assert.ok(!pack.awards.some((a) => a.name === "Ava Senior"));
  assert.equal(g.athletes[0].best.mark, "21:00.0");
  const slides = banquetSlidesHtml(site, pack);
  assert.doesNotMatch(slides, /Ava Senior/);
  assert.match(slides, /Great season!/);
});

test("banquet: slides have one per senior and a title slide", () => {
  const pack = buildBanquetPack(data(3), { awards });
  const slides = banquetSlides(pack);
  assert.equal(slides[0].kind, "title");
  assert.equal(slides.filter((s) => s.kind === "senior").length, 1);
  assert.equal(slides.at(-1).kind, "end");
});

test("banquet: award school matching respects shared names and school ids", () => {
  const team = { school_name: "Madison", city: "Mansfield", ohio_school_id: "m1" };
  const shared = (key) => key === "madison";
  assert.equal(awardSchoolMatches({ school: "Madison" }, team, shared), false, "shared name needs the city");
  assert.equal(awardSchoolMatches({ school: "Madison (Mansfield)" }, team, shared), true);
  assert.equal(awardSchoolMatches({ school: "Madison (Middletown)" }, team, shared), false);
  assert.equal(awardSchoolMatches({ school: "Madison", school_id: "m1" }, team, shared), true);
  assert.equal(awardSchoolMatches({ school: "Madison (Mansfield)", school_id: "other" }, team, shared), false, "a school id decides");
  assert.equal(awardSchoolMatches({ school: "Russia" }, { school_name: "Russia", city: "Russia" }, () => false), true);
});

test("banquet: class labels and derived time format", () => {
  assert.equal(classLabel(2027, 2026), "Sr.");
  assert.equal(classLabel(2030, 2026), "Fr.");
  assert.equal(formatSeconds(1033.3), "17:13.3");
  assert.equal(formatSeconds(62.56), "1:02.6");
});
