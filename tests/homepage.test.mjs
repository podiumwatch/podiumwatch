import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { apDate, divisionLabel, homeContent, homePageHtml, leadOrder, recapGroup } from "../src/pages/home.mjs";
import { frontRotatorHtml } from "../public/scripts/front-lead.mjs";
import { merchStripHtml } from "../src/lib/merch_card.mjs";
import { readHomeStories } from "../lib/home_stories.mjs";
import { site } from "../src/config/site.mjs";

test("server-rendered homepage: the admin lead is first in the HTML, with no browser wait or swap", () => {
  const stories = readHomeStories();
  assert.ok(stories.length >= 8, "stories read from content/stories");
  assert.ok(stories.every((s) => s.draft !== true && s.slug !== "write-for-podium-watch"));
  const pick = stories[5];
  const frontPage = { lead: { story_slug: pick.slug, href: `/stories/${pick.slug}/`, title: pick.title, summary: "Admin summary", kicker: "ADMIN KICKER", image_url: null, byline: "Podium Watch Staff", story_date: pick.date }, also: [] };
  const html = homePageHtml({ stories, frontPage, now: new Date("2026-11-13T17:00:00Z"), site });
  const firstSlide = html.slice(html.indexOf('class="fl-lead'), html.indexOf("</h1>"));
  assert.match(firstSlide, new RegExp(`data-front-lead-slug="${pick.slug}"`));
  assert.match(firstSlide, /ADMIN KICKER/);
  assert.doesNotMatch(html, /is-pending|data-front-candidates|\/api\/front-page\/current/);
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  assert.match(html, /<link rel="canonical" href="[^"]*\/">/);
  // No admin rows: the 8 newest stories, newest first.
  const plain = homePageHtml({ stories, frontPage: null, now: new Date("2026-11-13T17:00:00Z"), site });
  assert.match(plain.slice(plain.indexOf('class="fl-lead'), plain.indexOf("</h1>")), new RegExp(`data-front-lead-slug="${stories[0].slug}"`));
});

test("lead order: admin lead, then hand-placed stories, then the newest; no repeats, at most 8", () => {
  const newest = Array.from({ length: 12 }, (_, i) => ({ slug: `n${i}`, image_position: i === 3 ? "50% 20%" : null }));
  const order = leadOrder(newest, { lead: { story_slug: "n3" }, also: [{ story_slug: "x" }, { story_slug: "n0" }] });
  assert.deepEqual(order.map((s) => s.slug), ["n3", "x", "n0", "n1", "n2", "n4", "n5", "n6"]);
  assert.equal(order[0].image_position, "50% 20%", "crop point from the story files");
  assert.deepEqual(leadOrder(newest, null).map((s) => s.slug), ["n0", "n1", "n2", "n3", "n4", "n5", "n6", "n7"]);
});

const story = (slug, extra = {}) => ({ slug, title: `Story ${slug}`, date: "2026-11-10", ...extra });
const champions = {
  year: 2026,
  meet: { date: "2026-11-07", venue: "Fortress Obetz" },
  races: [
    { gender: "girls", division: 1, anchor: "girls-d1", individual: { name: "A Runner", school: "School A", time: "17:51.0" }, team: { school: "Team A", score: 111 } },
    { gender: "boys", division: 3, anchor: "boys-d3", individual: { name: "B Runner", school: "School B", time: "14:50.7" }, team: { school: "Team B", score: 65 } }
  ]
};
const poll = { label: "Pre-State Poll", date: "November 5, 2026", data: { boys: { 1: [["Team X", "238 points"]] }, girls: { 1: [["Team Y", "230 points"]] } } };

test("AP dates and division labels", () => {
  assert.equal(apDate("2026-11-07"), "Nov. 7, 2026");
  assert.equal(apDate("2026-09-03"), "Sept. 3, 2026");
  assert.equal(apDate("2027-03-01"), "March 1, 2027");
  assert.equal(apDate(""), "");
  assert.equal(divisionLabel({ divisions: "III" }), "Division III");
  assert.equal(divisionLabel({ divisions: "All" }), "");
});

test("recaps: the newest series, Division I to IV in order; otherwise the stories after the lead set", () => {
  const stories = [
    story("d4", { series: "s", divisions: "IV", seriesOrder: 1, seriesLabel: "2026 State Recaps" }),
    story("d2", { series: "s", divisions: "II", seriesOrder: 3 }),
    story("d1", { series: "s", divisions: "I", seriesOrder: 4 }),
    story("other")
  ];
  const group = recapGroup(stories, []);
  assert.equal(group.title, "2026 State Recaps");
  assert.deepEqual(group.items.map((s) => s.slug), ["d1", "d2", "d4"]);
  const plain = recapGroup([story("a"), story("b"), story("c")], ["a"]);
  assert.equal(plain.title, "Latest stories");
  assert.deepEqual(plain.items.map((s) => s.slug), ["b", "c"]);
});

test("homepage: champions rows link to each division's results page, girls pink and boys green", () => {
  const html = homeContent({ champions, poll });
  assert.match(html, /2026 State Champions/);
  assert.match(html, /Ohio Cross Country &middot; Nov\. 7, 2026 &middot; Fortress Obetz/);
  assert.match(html, /<tr class="pw-g"><th scope="row"><a href="\/state\/2026\/girls-d1\/"/);
  assert.match(html, /<tr class="pw-b"><th scope="row"><a href="\/state\/2026\/boys-d3\/"/);
  assert.match(html, /111 points/);
  assert.match(html, /href="\/regionals\/2026\/"/);
});

test("homepage: no current championship means no champions table and an empty right column until meets load", () => {
  const html = homeContent({ champions: null, poll });
  assert.doesNotMatch(html, /State Champions/);
  assert.match(html, /class="pw-rail"[^>]*data-rail-empty/);
});

test("homepage: latest results and upcoming meets start hidden; no loading text", () => {
  const html = homeContent({ champions, poll });
  assert.match(html, /data-latest-results-panel hidden/);
  assert.match(html, /data-upcoming-meets-panel hidden/);
  assert.doesNotMatch(html, /Checking|Loading/);
});

test("homepage: dated call to action keeps its start and end so it hides itself", () => {
  const html = homeContent({ poll, datedCtas: [
    { href: "/awards/2026/", startsAt: "2026-11-10T05:00:00Z", expiresAt: "2026-11-14T02:00:00Z", bar: { title: "Vote: 2026 Year Awards", detail: "Closes Friday", button: "Vote" }, live: true },
    { href: "/awards/2026/", startsAt: "2026-11-14T02:00:00Z", expiresAt: "2026-12-31T05:00:00Z", showWhen: "awards-2026-winners", bar: { title: "Winners", detail: "", button: "See" }, live: false }
  ] });
  assert.match(html, /<a class="pw-teambar-cta" href="\/awards\/2026\/" data-starts="2026-11-10T05:00:00Z" data-expires="2026-11-14T02:00:00Z">/);
  assert.match(html, /data-show-when="awards-2026-winners" hidden>/);
  assert.match(html, /action="\/teams\/" method="get"/);
  assert.match(html, /href="\/athletes\/">Search athletes/);
});

test("homepage: OATCCC poll has no sponsor; Podium Watch rankings credit Spike Town and Raising Cane's as text", () => {
  const html = homeContent({ poll, spikeTownHref: "/go/spike-town-runners-plus/home-rankings/?from=%2F" });
  const pollPanel = html.slice(html.indexOf("data-home-poll"), html.indexOf("Podium Watch rankings"));
  assert.doesNotMatch(pollPanel, /Spike Town|Raising Cane|Presented by|Sponsored by/);
  assert.match(html, /Presented by <a href="\/go\/spike-town-runners-plus\/home-rankings\/\?from=%2F" rel="sponsored noopener" target="_blank">Spike Town at Runners Plus<\/a>/);
  assert.match(html, /Sponsored by Raising Cane's/);
  assert.match(html, /aria-pressed="true">Boys</);
  assert.doesNotMatch(html, /<select/);
  assert.doesNotMatch(html, /More than a finish time|What just happened in Ohio|Who the coaches have rising/);
});

test("lead set: arrows, one tab per story with aria-pressed, only the first photo loads with the page, no timer", () => {
  const list = [1, 2, 3].map((n) => ({ slug: `s${n}`, href: `/stories/s${n}/`, title: `Title ${n}`, image_url: `/images/${n}.jpg`, kicker: "STATE MEET" }));
  const html = frontRotatorHtml(list);
  assert.match(html, /data-front-prev/);
  assert.match(html, /data-front-next/);
  assert.equal((html.match(/data-front-pick=/g) || []).length, 3);
  assert.match(html, /data-front-pick="0" aria-pressed="true"/);
  assert.match(html, /<img src="\/images\/1.jpg"[^>]*fetchpriority="high"/);
  assert.match(html, /<img data-src="\/images\/2.jpg"/);
  assert.doesNotMatch(html, /Pause/);
  const client = fs.readFileSync(new URL("../public/scripts/front-lead-client.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(client, /ROTATION_MS|setInterval/);
});

test("shop strip: one slim strip with the tracked /go/merch/home/ link", () => {
  const html = merchStripHtml({ placement: "home", from: "/" });
  if (!html) return; // the admin switch can turn the shop off
  assert.match(html, /class="pw-shop"/);
  assert.match(html, /href="\/go\/merch\/home\/\?p=/);
  assert.match(html, /loading="lazy"/);
});
