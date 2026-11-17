// OATCCC full site move (branch oatccc-full-site): switches, link
// rewriting, copied page text rules, Hall of Fame parsing. TEST data only
// for the Hall of Fame; the crawl itself is never in the repository.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { oatcccFlags, MORE_SECTIONS, oatcccTabs } from "../src/oatccc/config.mjs";
import { oatcccOutputs, oatcccBuild } from "../src/oatccc/build.mjs";
import { MORE_PAGES, AWARD_PAGES } from "../src/oatccc/more/registry.mjs";
import { resolveHref, resolveLinks, inducteeSlug } from "../src/oatccc/more/links.mjs";
import { parseInducteeList, parseBio, buildInductees, parseAwardRecipients, slugify } from "../lib/oatccc_hof.mjs";
import { site } from "../src/config/site.mjs";

const ALL = { OATCCC_LIVE: "1", OATCCC_MORE_LIVE: "1", ...Object.fromEntries(Object.values(MORE_SECTIONS).map((v) => [v, "1"])) };
const paths = (env) => oatcccOutputs(site, oatcccFlags(env)).pages.map((p) => p.pathname);

test("every section needs OATCCC_LIVE, OATCCC_MORE_LIVE and its own switch", () => {
  const base = paths({ OATCCC_LIVE: "1" });
  assert.deepEqual(paths({ OATCCC_LIVE: "1", OATCCC_ABOUT_LIVE: "1" }), base, "no MORE: nothing new");
  assert.deepEqual(paths({ OATCCC_MORE_LIVE: "1", OATCCC_ABOUT_LIVE: "1" }), [], "no LIVE: nothing at all");
  assert.deepEqual(paths({ OATCCC_LIVE: "1", OATCCC_MORE_LIVE: "1" }), base, "MORE alone: nothing new");
  const about = paths({ OATCCC_LIVE: "1", OATCCC_MORE_LIVE: "1", OATCCC_ABOUT_LIVE: "1" });
  assert.ok(about.includes("/oatccc/about/") && about.includes("/oatccc/about/leadership/"));
  assert.ok(!about.includes("/oatccc/join/") && !about.includes("/oatccc/forms/"));
});

test("with every switch on, every registry page is built", () => {
  const all = paths(ALL);
  for (const page of MORE_PAGES) assert.ok(all.includes(page.path), page.path);
});

test("tabs point to oatccc.com until the section is on", () => {
  const off = oatcccTabs(oatcccFlags({ OATCCC_LIVE: "1" }));
  assert.match(off.find((t) => t.key === "about").href, /^https:\/\/www\.oatccc\.com\//);
  const on = oatcccTabs(oatcccFlags(ALL));
  assert.equal(on.find((t) => t.key === "about").href, "/oatccc/about/");
  assert.equal(on.find((t) => t.key === "membership").href, "/oatccc/join/");
});

test("links: moved pages only when on; files only when hosted", () => {
  const off = oatcccFlags({ OATCCC_LIVE: "1" });
  const on = oatcccFlags({ ...ALL, OATCCC_FILES_HOSTED: "1" });
  const env = { SUPABASE_URL: "https://example.supabase.co" };
  assert.equal(resolveHref("https://www.oatccc.com/About-Us/", off, env), "https://www.oatccc.com/About-Us/");
  assert.equal(resolveHref("https://www.oatccc.com/About-Us/", on, env), "/oatccc/about/");
  assert.equal(resolveHref("https://oatccc.com/about-us", on, env), "/oatccc/about/");
  assert.equal(resolveHref("https://www.oatccc.com/Media/Longevity-Form.pdf", off, env), "https://www.oatccc.com/Media/Longevity-Form.pdf");
  assert.equal(resolveHref("https://www.oatccc.com/Media/Longevity-Form.pdf", on, env), "https://example.supabase.co/storage/v1/object/public/oatccc-public/Media/Longevity-Form.pdf");
  assert.equal(resolveHref("https://www.oatccc.com/Media/Longevity-Form.pdf", on, {}), "https://www.oatccc.com/Media/Longevity-Form.pdf", "no Storage URL known: stay on oatccc.com");
  assert.equal(resolveHref("https://docs.google.com/x", on, env), "https://docs.google.com/x");
  assert.equal(inducteeSlug("/HOF/View-Bio/A-W-Hendricks-1973/"), "a-w-hendricks-1973");
  assert.match(resolveLinks('<a href="https://www.oatccc.com/Contact-Us/">x</a>', on, env), /href="\/oatccc\/about\/leadership\/"/);
  assert.match(resolveLinks('<a href="https://asics.com/">x</a>', on, env), /target="_blank" rel="noopener noreferrer"/);
});

test("copied page text: no phone numbers, no sponsor logos, no oatccc.com scripts", () => {
  const PHONE = /\(?\b[2-9]\d{2}\)?[\s.-]?\d{3}[\s.-]\d{4}\b/;
  for (const page of MORE_PAGES) {
    const file = new URL(`../src/oatccc/more/content/${page.key}.html`, import.meta.url);
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(html.replace(/<[^>]+>/g, " "), PHONE, `${page.key}: phone number`);
    assert.doesNotMatch(html, /href="tel:|<script|javascript:|onclick=|style="/i, page.key);
  }
  const built = oatcccOutputs(site, oatcccFlags(ALL)).pages;
  const sponsors = built.find((p) => p.pathname === "/oatccc/sponsors/");
  if (sponsors) assert.doesNotMatch((sponsors.html.split('class="ox-prose"')[1] || "").split('class="ox-source"')[0], /<img /, "sponsor logos");
});

test("forms without a link say Link coming soon", () => {
  const built = oatcccOutputs(site, oatcccFlags(ALL)).pages.find((p) => p.pathname === "/oatccc/forms/");
  if (!built) return;
  assert.doesNotMatch(built.html, /<td>\s*<\/td>/);
});

// ---------- Hall of Fame parsing (TEST markup) ----------
const tile = (first, last, year, barker = false) => `<div class="js-filter-item" data-year="${year}" data-fname="${first}" data-lname="${last}"><a href="/HOF/View-Bio/${first}-${last}-${year}/"><img src="/Portal/Admin/Hall-Of-Fame/Images/${first}-${last}.jpg"></a><h6><a href="/HOF/View-Bio/${first}-${last}-${year}/">${first} ${last}</a></h6><p><strong>${year}</strong></p>${barker ? "<p>Ed Barker Recipient</p>" : ""}</div>`;
const listPage = { url: "https://www.oatccc.com/HOF/", mainHtml: tile("TEST", "Alpha", 1990, true) + tile("TEST", "Bravo", 2020) + `<div class="js-filter-item" data-year="2017"><a href="/HOF/View-Bio/NONE-SELECTED-2017/"></a><h6>NONE SELECTED</h6></div>` };
const bio = (first, last, year, text) => ({ url: `https://www.oatccc.com/HOF/View-Bio/${first}-${last}-${year}/`, mainHtml: `<img src="/Portal/Admin/Hall-Of-Fame/Images/${first}-${last}.jpg"><h2>${first} ${last} (${year})</h2><p style="white-space:pre-wrap;">\n${text}</p>` });

test("Hall of Fame: list + bios, word for word, placeholder skipped", () => {
  assert.equal(parseInducteeList(listPage).length, 3);
  const b = parseBio(bio("TEST", "Alpha", 1990, "Line one.\nLine two."));
  assert.deepEqual([b.name, b.year, b.bio], ["TEST Alpha", 1990, "Line one.\nLine two."]);
  const { rows, problems } = buildInductees(listPage, [bio("TEST", "Alpha", 1990, "Bio A."), bio("TEST", "Bravo", 2020, "Bio B.")]);
  assert.deepEqual(rows.map((r) => [r.slug, r.ed_barker_recipient, r.school, r.sport]), [["test-alpha-1990", true, null, null], ["test-bravo-2020", false, null, null]]);
  assert.ok(problems.some((p) => /NONE SELECTED/.test(p)));
  assert.equal(slugify("Sandra “Sandy” Knott 2025"), "sandra-sandy-knott-2025");
});

test("awards: tables and cards keep the words as shown", () => {
  const table = parseAwardRecipients({ mainHtml: "<table><tr><th>Year</th><th>Name</th></tr><tr><td>2025</td><td>TEST Coach</td><td>TEST High School</td><td>Girls Cross Country</td></tr></table>" }, "table");
  assert.deepEqual(table, [{ name: "TEST Coach", year: 2025, year_label: "2025", school: "TEST High School", details: "Girls Cross Country", photo_path: null, old_url: null, position: 1 }]);
  const cards = parseAwardRecipients({ mainHtml: '<div class="cell-xs-12"><h2>2021 TEST Coaches of the Year</h2><div class="cell-sm-6"><div class="post-news-body"><h6>TEST Person</h6><h5>Coach of Year<br>TEST School</h5></div></div></div>' }, "cards");
  assert.equal(cards[0].details, "Coach of Year / TEST School");
  assert.equal(cards[0].year, 2021);
  assert.equal(AWARD_PAGES.length, 5);
});

test("Hall of Fame switch with no data: section treated as off", async () => {
  const env = { OATCCC_LIVE: "1", OATCCC_MORE_LIVE: "1", OATCCC_HOF_LIVE: "1" };
  const out = await oatcccBuild(site, oatcccFlags(env), {});
  assert.equal(out.flags.sections.hof, false);
  assert.ok(!out.pages.some((p) => p.pathname.startsWith("/oatccc/hall-of-fame/")));
  assert.ok(!out.pages.some((p) => p.html.includes('href="/oatccc/hall-of-fame/"')), "no link to a page that was not built");
});

// The site footer script fills every [data-year] element with the current
// year (the copyright line). OATCCC pages must never use data-year.
test("no OATCCC page body uses the data-year attribute", async () => {
  const preview = { inductees: [{ slug: "test-alpha-1990", name: "TEST Alpha", sort_name: "alpha test", induction_year: 1990, ed_barker_recipient: false, school: null, sport: null, bio: "Bio.", photo_path: null, old_url: "https://www.oatccc.com/HOF/View-Bio/TEST-Alpha-1990/" }], awards: [], recipients: [] };
  const file = new URL("./tmp-hof-preview.json", import.meta.url);
  fs.writeFileSync(file, JSON.stringify(preview));
  try {
    const env = { ...ALL, OATCCC_HOF_PREVIEW_FILE: file.pathname.replace(/^\/([A-Za-z]:)/, "$1") };
    const out = await oatcccBuild(site, oatcccFlags(env), env);
    assert.ok(out.pages.some((p) => p.pathname === "/oatccc/hall-of-fame/test-alpha-1990/"));
    for (const page of out.pages) {
      const body = page.html.split('<div class="ox">')[1]?.split('<footer class="site-footer')[0] || "";
      assert.doesNotMatch(body, /\sdata-year=/, page.pathname);
    }
  } finally {
    fs.rmSync(file, { force: true });
  }
});

test("Leadership is names and roles only", () => {
  const file = new URL("../src/oatccc/more/content/leadership.html", import.meta.url);
  if (!fs.existsSync(file)) return;
  const html = fs.readFileSync(file, "utf8").replace(/<!--[\s\S]*?-->/g, "");
  const items = [...html.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1]);
  assert.ok(items.length > 10);
  for (const item of items) assert.match(item, /^<strong>[^<]+<\/strong>(<span>[^<]+<\/span>)?$/, item);
  assert.doesNotMatch(html, /<img|<em>|mailto:|tel:/);
});
