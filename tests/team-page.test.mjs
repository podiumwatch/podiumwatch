import test from "node:test";
import assert from "node:assert/strict";
import { teamPageHtml } from "../lib/render/team_page.mjs";
import { logoBaseFromUrl, smallLogoHtml } from "../src/lib/team_logo_html.mjs";
import { site } from "../src/config/site.mjs";

const empty = { division: null, roster: [], top7_average: null, results: [], path: [], state: null, state_qualifiers: 0, all_ohio: 0, best_ever: [] };
const base = {
  team: { id: "t1", slug: "russia-russia", display_name: "Russia", city: "Russia" },
  claimed: true,
  logo: { base: "/images/teams/russia-russia", color: "#015ca7" },
  accent: "#0300bd",
  accent_text: "#ffffff",
  instagram: [{ handle: "raiders_tf_xc", label: "XC & Track", url: "https://www.instagram.com/raiders_tf_xc/" }],
  first_year: 2025,
  featured: [],
  season: 2026,
  genders: {
    boys: { ...empty, division: "Division IV", roster: [{ slug: "paxson-bixler", name: "Paxson Bixler", class_year: 2029, best: "15:32.9", best_value: 932.9, best_meet: "OHSAA Cross Country Regional - Troy", honor: "All-Ohio first team" }], results: [{ meet: "OHSAA Cross Country State Championships", date: "2026-11-07", place: 2, score: 99 }, { meet: "Bob Schul Invitational", date: "2026-08-29", place: null, score: null }], path: [{ stage: "district", place: 1, score: 45 }, { stage: "regional", place: 1, score: 57 }, { stage: "state", place: 2, score: 99 }], state: { place: 2, score: 99, label: "State Runner-up, Division IV Boys" }, state_qualifiers: 7, all_ohio: 3 },
    girls: { ...empty, division: "Division IV" }
  }
};

test("team page: header, highlight strip, sections and JSON-LD from the data", () => {
  const html = teamPageHtml(site, base);
  assert.match(html, /<title>Russia Cross Country \| Podium Watch<\/title>/);
  assert.match(html, /State Runner-up, Division IV Boys/);
  assert.match(html, /7 state qualifiers/);
  assert.match(html, /3 All-Ohio/);
  assert.match(html, /Claimed by coach/);
  assert.match(html, /@raiders_tf_xc <small>XC &amp; Track<\/small>/);
  assert.match(html, /russia-russia-256\.webp/);
  assert.match(html, /Team score not posted/);
  assert.match(html, /1st &middot; 45 pts/);
  assert.match(html, /"@type":"SportsTeam"/);
  assert.match(html, /href="\/athletes\/paxson-bixler\/"/);
  assert.match(html, /All-Ohio First Team/);
});

test("team page: empty sections and an empty gender are left out", () => {
  const html = teamPageHtml(site, base);
  assert.doesNotMatch(html, /data-tp-tab="girls"/, "girls has no data, so no tab");
  assert.doesNotMatch(html, /Best on Podium Watch/, "no best-ever rows, no section");
  assert.doesNotMatch(html, /Top-7 average/, "fewer than 7 runners, no average");
  const none = teamPageHtml(site, { ...base, genders: { boys: { ...empty }, girls: { ...empty } }, instagram: [], claimed: false });
  assert.match(none, /No results yet/);
  assert.match(none, /noindex, follow/);
  assert.doesNotMatch(none, /class="tp-strip"/);
});

test("logo helpers accept only our processed logo paths", () => {
  assert.equal(logoBaseFromUrl("/images/teams/russia-russia-256.png"), "/images/teams/russia-russia");
  assert.equal(logoBaseFromUrl("/images/teams/pool/carroll-96.webp"), "/images/teams/pool/carroll");
  assert.equal(logoBaseFromUrl("https://example.com/logo.png"), null);
  assert.match(smallLogoHtml("/images/teams/russia-russia"), /src="\/images\/teams\/russia-russia-96\.webp"/);
  assert.equal(smallLogoHtml("javascript:alert(1)"), "");
  assert.equal(smallLogoHtml(null), "");
});
