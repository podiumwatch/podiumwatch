import test from "node:test";
import assert from "node:assert/strict";
import { allFrontPageRuns, alsoRuns, currentAlso, currentLead, leadRuns, queuedLeads, runLabel } from "../src/lib/front_page_timeline.mjs";
import { frontAlsoHtml, frontLeadHtml } from "../public/scripts/front-lead.mjs";
import { frontPageArchivePage } from "../src/pages/frontpagearchive.mjs";
import { site } from "../src/config/site.mjs";

const lead = (id, starts, ends = null, extra = {}) => ({ id, story_slug: `story-${id}`, title: `Story ${id}`, starts_at: starts, ends_at: ends, status: "scheduled", ...extra });
const now = new Date("2026-11-12T15:00:00Z");

test("one lead at a time: a later start takes over, and runs keep their real dates", () => {
  const leads = [lead("a", "2026-11-09T14:00:00Z"), lead("b", "2026-11-11T14:00:00Z")];
  const runs = leadRuns(leads, now);
  assert.deepEqual(runs.map((r) => [r.lead.id, r.startsAt, r.endsAt]), [["a", "2026-11-09T14:00:00.000Z", "2026-11-11T14:00:00.000Z"], ["b", "2026-11-11T14:00:00.000Z", null]]);
  assert.equal(currentLead(leads, now).id, "b");
  assert.equal(runLabel(runs[0]), "Nov 9 to Nov 11, 2026");
});

test("an end time gives the front page back to the newest story (no lead)", () => {
  const leads = [lead("a", "2026-11-09T14:00:00Z", "2026-11-10T14:00:00Z")];
  assert.equal(currentLead(leads, now), null);
  assert.equal(runLabel(leadRuns(leads, now)[0]), "Nov 9 to Nov 10, 2026");
});

test("a short lead inside a longer one: the longer one resumes afterwards", () => {
  const leads = [lead("a", "2026-11-09T14:00:00Z"), lead("b", "2026-11-10T14:00:00Z", "2026-11-11T02:00:00Z")];
  assert.deepEqual(leadRuns(leads, now).map((r) => r.lead.id), ["a", "b", "a"]);
  assert.equal(currentLead(leads, now).id, "a");
});

test("cancelled and future leads never count as having run; the queue is soonest first", () => {
  const leads = [lead("c", "2026-11-09T14:00:00Z", null, { status: "cancelled" }), lead("f2", "2026-11-20T14:00:00Z"), lead("f1", "2026-11-15T14:00:00Z")];
  assert.deepEqual(leadRuns(leads, now), []);
  assert.deepEqual(queuedLeads(leads, now).map((l) => l.id), ["f1", "f2"]);
});

test("labels use Eastern dates: a 9 PM ET start is that day, not the next", () => {
  assert.equal(runLabel({ startsAt: "2026-11-10T02:00:00Z", endsAt: "2026-11-10T03:00:00Z" }), "Nov 9, 2026");
  assert.equal(runLabel({ startsAt: "2026-12-30T15:00:00Z", endsAt: "2027-01-02T15:00:00Z" }), "Dec 30, 2026 to Jan 2, 2027");
  assert.equal(runLabel({ startsAt: "2026-11-09T15:00:00Z", endsAt: null }), "Nov 9, 2026 to now");
});

test("lead block: photo with credit, or type-only with no image at all; text is escaped", () => {
  const base = { slug: "s", href: "/stories/s/", title: "A <b>title</b>", summary: "Sum", kicker: "STATE MEET", byline: "Podium Watch Staff", story_date: "2026-11-08" };
  const withPhoto = frontLeadHtml({ ...base, image_url: "/images/x.jpg", image_credit: "Jane Doe" });
  assert.match(withPhoto, /<img src="\/images\/x.jpg"/);
  assert.match(withPhoto, /Photo: Jane Doe/);
  assert.match(withPhoto, /Read the story/);
  assert.match(withPhoto, /A &lt;b&gt;title&lt;\/b&gt;/);
  const typeOnly = frontLeadHtml({ ...base, image_url: null });
  assert.match(typeOnly, /fl-lead is-type/);
  assert.doesNotMatch(typeOnly, /<img/);
  assert.match(frontAlsoHtml([{ ...base, image_url: null }]), /Also on the front page/);
});

test("archive lists every run with its dates and links /front", () => {
  const html = frontPageArchivePage(site, [{ href: "/stories/a/", title: "Story A", summary: "S", image_url: null, label: "Nov 9 to Nov 11, 2026", current: false }]);
  assert.match(html, /<title>On the Front Page: Podium Watch Lead Stories \| Podium Watch<\/title>/);
  assert.match(html, /Nov 9 to Nov 11, 2026/);
  assert.match(html, /href="\/front"/);
  assert.match(html, /max-image-preview:large/);
});

test("hand-picked also stories: never the lead, run side by side, in set order, up to 4", () => {
  const rows = [
    lead("parrish", "2026-11-09T14:00:00Z"),
    lead("d4", "2026-11-10T18:00:00Z", null, { slot: "also", position: 1 }),
    lead("d3", "2026-11-10T18:00:00Z", null, { slot: "also", position: 2 }),
    lead("d2", "2026-11-10T18:00:00Z", null, { slot: "also", position: 3 }),
    lead("d1", "2026-11-10T18:00:00Z", null, { slot: "also", position: 4 }),
    lead("old", "2026-11-09T14:00:00Z", "2026-11-10T18:00:00Z", { slot: "also", position: 1 }),
    lead("later", "2026-11-20T14:00:00Z", null, { slot: "also", position: 1 })
  ];
  assert.equal(currentLead(rows, now).id, "parrish", "an also pick never takes over the lead");
  assert.deepEqual(leadRuns(rows, now).map((r) => r.lead.id), ["parrish"]);
  assert.deepEqual(queuedLeads(rows, now).map((r) => r.id), [], "future also picks are not in the lead queue");
  assert.deepEqual(currentAlso(rows, now).map((r) => r.id), ["d4", "d3", "d2", "d1"]);
  const old = alsoRuns(rows, now).find((r) => r.lead.id === "old");
  assert.equal(old.current, false);
  assert.equal(old.endsAt, "2026-11-10T18:00:00.000Z");
  // Every run counts as being on the front page (date line, archive, badges).
  assert.deepEqual(allFrontPageRuns(rows, now).filter((r) => r.lead.story_slug === "story-d4").map((r) => [r.slot, r.current]), [["also", true]]);
  assert.deepEqual(currentAlso([lead("x", "2026-11-09T14:00:00Z")], now), [], "no picks: the automatic rule");
});

test("also list: four stories get the four-across layout", () => {
  const story = (n) => ({ slug: `s${n}`, href: `/stories/s${n}/`, title: `S${n}`, kicker: "RESULTS", image_url: null });
  assert.match(frontAlsoHtml([1, 2, 3, 4].map(story)), /fl-also-list is-four/);
  assert.doesNotMatch(frontAlsoHtml([1, 2, 3].map(story)), /is-four/);
});

test("every published story photo has a crop for wide frames (scripts/image-focus.mjs)", async () => {
  const fs = await import("node:fs");
  const { parseFrontMatter } = await import("../src/lib/content.mjs");
  const { storyImageFocus, coverBox } = await import("../lib/story_image_focus.mjs");
  const missing = [];
  for (const file of fs.readdirSync("content/stories").filter((f) => f.endsWith(".md"))) {
    const { data } = parseFrontMatter(fs.readFileSync(`content/stories/${file}`, "utf8"), file);
    const src = data.featuredImage || data.heroImage;
    if (data.draft || !/^\/images\/.+\.(jpe?g|png|webp)$/i.test(String(src || "")) || /story_fallback/.test(src) || !fs.existsSync(`public${src}`)) continue;
    const focus = storyImageFocus(src);
    if (!(focus.fit === "contain" || (focus.position && focus.width && focus.height))) missing.push(src);
  }
  assert.deepEqual(missing, [], "run the build (npm.cmd run build) so src/data/image-focus.json covers every story photo");
  // Hand crop: a tall photo at 25% shows the upper part of the frame.
  assert.deepEqual(coverBox({ width: 1280, height: 1600, position: "center 25%" }, 1080, 600), { width: 1080, height: 1350, left: 0, top: -188 });
});

test("cover: a story published after a hand-set lead takes over; until then the hand-set lead holds", async () => {
  const { handLeadHolds } = await import("../public/scripts/front-lead.mjs");
  const lead = { story_slug: "parrish", starts_at: "2026-11-09T14:00:00Z" };
  assert.equal(handLeadHolds(lead, { slug: "recap", story_date: "2026-11-09" }), true, "same day: the hand-set lead holds");
  assert.equal(handLeadHolds(lead, { slug: "triple-crown", story_date: "2026-11-13" }), false, "a newer story takes over");
  assert.equal(handLeadHolds({ ...lead, starts_at: "2026-11-14T03:00:00Z" }, { slug: "x", story_date: "2026-11-13" }), true, "10 PM ET Nov 13 counts as Nov 13");
  assert.equal(handLeadHolds(lead, { slug: "parrish", story_date: "2026-11-13" }), true, "the lead's own story");
  assert.equal(handLeadHolds(null, { slug: "x", story_date: "2026-11-13" }), false);
});
