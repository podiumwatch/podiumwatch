import test from "node:test";
import assert from "node:assert/strict";
import { teamPageHtml, postseasonPath, teamHonors } from "../lib/render/team_page.mjs";
import { logoBaseFromUrl, smallLogoHtml } from "../src/lib/team_logo_html.mjs";
import { contrastWithWhite } from "../src/lib/components.mjs";
import { site } from "../src/config/site.mjs";

// Team page (site redesign step 3). Data shaped like
// lib/team_page_service.mjs returns it.
const empty = { division: null, roster: [], top7_average: null, results: [], path: [], state: null, state_qualifiers: 0, all_ohio: 0, best_ever: [] };
const runner = (i) => ({ slug: `test-runner-${i}`, name: `Test Runner ${i}`, class_year: 2027 + (i % 3), best: `16:${String(10 + i).padStart(2, "0")}.0`, best_value: 970 + i, best_meet: "Test Invitational", honor: i === 1 ? "All-Ohio first team" : null });
const base = {
  team: { id: "t1", slug: "russia-russia", display_name: "Russia", city: "Russia", primary_color: "#00bf63", logo_url: "/images/teams/russia-russia-256.png" },
  claimed: true,
  logo: { base: "/images/teams/russia-russia", color: "#015ca7" },
  instagram: [{ handle: "raiders_tf_xc", label: "XC & Track", url: "https://www.instagram.com/raiders_tf_xc/" }],
  first_year: 2025,
  featured: [],
  season: 2026,
  genders: {
    boys: { ...empty, division: "Division IV", roster: [{ slug: "paxson-bixler", name: "Paxson Bixler", class_year: 2029, best: "15:32.9", best_value: 932.9, best_meet: "OHSAA Cross Country Regional - Troy", honor: "All-Ohio first team" }], results: [{ meet: "OHSAA Cross Country State Championships", date: "2026-11-07", place: 2, score: 99 }, { meet: "OHSAA Cross Country Regional - Troy", date: "2026-10-31", place: 1, score: 57 }, { meet: "Bob Schul Invitational", date: "2026-08-29", place: null, score: null }], path: [{ stage: "district", meet: "OHSAA Cross Country District - Troy", place: 1, score: 45 }, { stage: "regional", meet: "OHSAA Cross Country Regional - Troy", place: 1, score: 57 }, { stage: "state", meet: "OHSAA Cross Country State Championships", place: 2, score: 99 }], state: { place: 2, score: 99, label: "State Runner-up, Division IV Boys" }, state_qualifiers: 7, all_ohio: 3 },
    girls: { ...empty, division: "Division IV" }
  }
};

test("team page: band, honors, stat cards, roster, results, path and JSON-LD from the data", () => {
  const html = teamPageHtml(site, base);
  assert.match(html, /<title>Russia Cross Country \| Podium Watch<\/title>/);
  assert.match(html, /State Runner-up<small>Division IV Boys · 99 pts<\/small>/);
  assert.match(html, /<li>7<small>state qualifiers<\/small><\/li>/);
  assert.match(html, /<li>3<small>All-Ohio<\/small><\/li>/);
  assert.match(html, /Ohio high school cross country · Boys Division IV · Girls Division IV/);
  assert.match(html, /<small>State<\/small><b>2nd<\/b><span>99 pts · Nov 7<\/span>/, "state stat card");
  assert.match(html, /<small>Regional<\/small><b>1st<\/b><span>57 pts · Troy · Oct 31<\/span>/, "regional stat card");
  assert.match(html, /<small>Roster<\/small><b>1<\/b><span>runner with a 2026 time<\/span>/);
  assert.match(html, /@raiders_tf_xc <small>XC &amp; Track<\/small>/);
  assert.match(html, /russia-russia-256\.webp/);
  assert.match(html, /Team score not posted/);
  assert.match(html, /<li class="pw-path-done"><small>District<\/small><b>1st<\/b><span>45 pts<\/span><\/li>/);
  assert.match(html, /"@type":"SportsTeam"/);
  assert.match(html, /href="\/athletes\/paxson-bixler\/"/);
  assert.match(html, /All-Ohio First Team/);
  assert.match(html, /Coach tools: sign in/, "claimed team");
  assert.match(html, /href="\/teams\/russia-russia\/season\/2026\/banquet\/"/);
  assert.match(html, /href="\/team\/\?slug=russia-russia">Follow this team/);
  assert.match(html, /data-tp-report data-team-id="t1"/, "report form kept");
});

test("team page: empty modules and an empty gender are left out; small teams show everyone", () => {
  const html = teamPageHtml(site, base);
  assert.doesNotMatch(html, /\?g=girls/, "girls has no data, so no girls tab");
  assert.doesNotMatch(html, /Best on Podium Watch/, "replaced by the ranked roster");
  assert.doesNotMatch(html, /Top-7 average/, "fewer than 7 runners: no average card");
  assert.doesNotMatch(html, /Show \d+ more runner/, "fewer than 7 runners: no Show more");
  const none = teamPageHtml(site, { ...base, genders: { boys: { ...empty }, girls: { ...empty } }, instagram: [], claimed: false });
  assert.match(none, /No 2026 results on Podium Watch yet\./);
  assert.match(none, /Coach tools: claim this team/);
  assert.match(none, /noindex, follow/);
  assert.doesNotMatch(none, /pw-stats/);
});

test("team page: big rosters show the top 7, the rest in the HTML behind Show more", () => {
  const big = { ...base, genders: { ...base.genders, boys: { ...base.genders.boys, roster: Array.from({ length: 25 }, (_, i) => runner(i + 1)), top7_average: 971.0 } } };
  const html = teamPageHtml(site, big);
  assert.equal((html.match(/<tr>/g) || []).length - 1, 7, "7 visible rows (plus the header row)");
  assert.equal((html.match(/<tr hidden data-pw-more-row>/g) || []).length, 18);
  assert.match(html, /Show 18 more runners/);
  assert.match(html, /<small>Top-7 average<\/small><b>16:11\.0<\/b>/);
});

test("team page: Boys/Girls tabs are real URLs; the second gender has its own canonical", () => {
  const both = { ...base, genders: { boys: base.genders.boys, girls: { ...base.genders.boys } } };
  const boys = teamPageHtml(site, both);
  assert.match(boys, /<a class="pw-tab pw-boys" href="\/teams\/russia-russia\/" aria-current="page">Boys<\/a>/);
  assert.match(boys, /<a class="pw-tab pw-girls" href="\/teams\/russia-russia\/\?g=girls">Girls<\/a>/);
  const girls = teamPageHtml(site, both, { gender: "girls" });
  assert.match(girls, /href="\/teams\/russia-russia\/\?g=girls" aria-current="page"/);
  assert.match(girls, /<link rel="canonical" href="https:\/\/[^"]+\/teams\/russia-russia\/\?g=girls">/);
  assert.match(girls, /<title>Russia Girls Cross Country/);
});

test("postseason path: Division I gets a district Bye with the reason; rounds not reached are gray", () => {
  const d1 = postseasonPath({ division: "Division I", path: [{ stage: "regional", place: 1, score: 72 }, { stage: "state", place: 1, score: 107 }] });
  assert.deepEqual(d1[0], { stage: "district", state: "bye", value: "Bye", note: "D1 teams enter at regionals" });
  const out = postseasonPath({ division: "Division III", path: [{ stage: "district", place: 9, score: 240 }] });
  assert.deepEqual(out.map((p) => p.state), ["done", "out", "out"]);
  assert.equal(out[1].note, "Not reached");
  assert.deepEqual(postseasonPath({ division: "Division II", path: [] }), [], "no postseason, no module");
});

test("honors: only real state finishes, qualifiers and All-Ohio; champion is the featured tag", () => {
  const h = teamHonors({ genders: { boys: { ...empty, division: "Division I", state: { place: 1, score: 107 }, state_qualifiers: 7, all_ohio: 5 }, girls: { ...empty, division: "Division I", state: { place: 6, score: 208 }, state_qualifiers: 7, all_ohio: 2 } } });
  assert.deepEqual(h, [
    { label: "State Champion", note: "Division I Boys · 107 pts", featured: true },
    { label: "6th at State", note: "Division I Girls · 208 pts", featured: false },
    { label: "14", note: "state qualifiers" },
    { label: "7", note: "All-Ohio" }
  ]);
});

test("school color band passes WCAG AA, and no logo means a black band with initials", () => {
  const html = teamPageHtml(site, base);
  const band = (html.match(/class="pw-band pw-band-school" style="--pw-band:(#[0-9a-f]{6})"/) || [])[1];
  assert.ok(band, "school-color band");
  assert.ok(contrastWithWhite(band) >= 4.5);
  const noLogo = teamPageHtml(site, { ...base, team: { ...base.team, logo_url: null, slug: "test-no-logo" }, logo: null });
  assert.match(noLogo, /<section class="pw-band">/, "black band");
  assert.match(noLogo, /pw-logo-initials" aria-hidden="true">R</);
});

test("logo helpers accept only our processed logo paths", () => {
  assert.equal(logoBaseFromUrl("/images/teams/russia-russia-256.png"), "/images/teams/russia-russia");
  assert.equal(logoBaseFromUrl("/images/teams/pool/carroll-96.webp"), "/images/teams/pool/carroll");
  assert.equal(logoBaseFromUrl("https://example.com/logo.png"), null);
  assert.match(smallLogoHtml("/images/teams/russia-russia"), /src="\/images\/teams\/russia-russia-96\.webp"/);
  assert.equal(smallLogoHtml("javascript:alert(1)"), "");
  assert.equal(smallLogoHtml(null), "");
});
