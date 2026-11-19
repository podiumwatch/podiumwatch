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
  // Membership goes to FinalForms either way (Zachary, 2026-11-17).
  assert.equal(on.find((t) => t.key === "membership").href, "https://oatccc-oh.finalforms-amp.com/");
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
    // The only numbers allowed: the two clinic hotels' business lines
    // (Zachary, 2026-11-17).
    const allowed = page.key === "clinic-tf" ? /<a href="tel:(6144145000|6147629162)">[^<]*<\/a>/g : /$^/g;
    const html = fs.readFileSync(file, "utf8").replace(allowed, "");
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

test("Anjanette's preview comments, part 2 (2026-11-17)", () => {
  const pages = oatcccOutputs(site, oatcccFlags({ ...ALL, OATCCC_INDOOR_FULL_LIVE: "1" })).pages;
  const page = (p) => { const hit = pages.find((x) => x.pathname === p); assert.ok(hit, p); return hit.html; };
  const FF = "https://oatccc-oh.finalforms-amp.com/";
  // Declarations: the MileSplit note near the top; the date stays a visible placeholder.
  const dec = page("/oatccc/indoor/high-school/declarations-and-fees/");
  // Acceptance lists on Monday, March 1 (Anjanette); invoice and fee dates flagged (Zachary, 2026-11-17).
  assert.ok(dec.includes("<li>Final acceptance lists will be posted on MileSplit on Monday, March 1st</li>") && !dec.includes("March 2nd"));
  // Invoice and fee dates not confirmed yet: "Date to be announced." (Zachary, 2026-11-19).
  assert.ok(dec.includes("Do NOT pay the invoice until the final acceptance lists are posted. Date to be announced."));
  assert.ok(dec.includes("All entries fees are paid online and due at 12noon. Date to be announced."));
  assert.ok(!/TO CONFIRM|March 2, 2026|March 5, 2026/.test(dec));
  for (const p of ["abcs", "divisions", "eligibility-and-verification"]) {
    const kd = page(`/oatccc/indoor/high-school/${p}/`);
    assert.match(kd, /<b>Feb 27<\/b>[\s\S]*?<b>Mar 1<\/b><span>Monday<\/span><\/div><div><span class="kd-what">Final acceptance lists posted<\/span>[\s\S]*?<b>Mar 5<\/b>/, p);
  }
  assert.ok(dec.indexOf("Declarations are made completely through the MileSplit registration option") < dec.indexOf("Declarations must be completed on MileSplit Ohio"));
  // Date confirmed by Anjanette (2026-11-17); her exact paragraph.
  assert.ok(dec.includes("<p>All final entries accepted into the State Meet will be posted on Monday, March 1, 2027, under the ENTRY tab of each MileSplit meet page for each division and are considered entered in the meet. The final entry fee invoice will reflect only those athletes and relays on the final acceptance lists. Payment must be made for all those on the final acceptance lists even if the athlete or relay chooses not to compete. Again, do not pay the invoice until Sunday after the final acceptance lists are posted.</p>"));
  assert.ok(!dec.includes("DATE TO CONFIRM"), "placeholder gone");
  assert.ok(!dec.includes("All declarations made which appear on the final acceptance lists"));
  assert.ok(!/Monday, March 2, 2026, are considered entered/.test(dec));
  // Meet day.
  const day = page("/oatccc/indoor/high-school/meet-day/");
  assert.ok(day.includes("2027 NFHS and OHSAA competition rules will be in effect and applicable USATF competition rules for non-OHSAA events."));
  assert.ok(day.includes("One alternate relay pass is issued per relay team. All other alternate relay athletes must pay for entry as a spectator."));
  assert.ok(!day.includes("Whatever works best for you") && !day.includes("Include the image below"));
  // FAQ and Join.
  assert.ok(page("/oatccc/indoor/high-school/faq/").includes(`href="${FF}"`));
  assert.ok(!pages.some((p) => /oatccc\.com\/(About-Us\/Join|Coaches\/Membership\/Join)/i.test(p.html)), "no old join links");
  const join = page("/oatccc/join/");
  assert.ok(!join.includes(">Our Members<"));
  assert.ok(join.includes("<p>Membership is from July 1st to June 30th each year.</p>"));
  assert.ok(!join.includes("CALENDAR YEAR") && !join.includes("downloading the membership form"));
  assert.match(join, new RegExp(`<a href="${FF}" target="_blank" rel="noopener noreferrer" class="btn2 ox-big">Join the OATCCC</a></div>\\s*<p class="ox-bigbtn-how">Select Login/Signup and follow the prompts\\.</p>`));
  // Clinics.
  const vend = page("/oatccc/clinics/vendors/");
  assert.ok(vend.includes(`href="${FF}" target="_blank" rel="noopener noreferrer" class="btn2 ox-big">Vendor Submission</a>`));
  assert.ok(vend.includes(">Vendor Letter</a>") && !/oatccc\.com\/Clinics\/Track-And-Field\/Vendors/i.test(vend));
  const xc = page("/oatccc/clinics/cross-country/");
  // Registration goes to FinalForms with the Join how-to line (Anjanette, 2026-11-17).
  assert.match(xc, new RegExp(`<a href="${FF}"[^>]*class="btn2 ox-big">Clinic Registration</a></div>\\s*<p class="ox-bigbtn-how">Select Login/Signup and follow the prompts\\.</p>`));
  assert.ok(!/Clinics\/Cross-Country\/Register/i.test(xc), "old registration link gone");
  assert.match(xc, /class="btn2 ox-big">Clinic Speakers<\/a>/);
  const tf = page("/oatccc/clinics/track-and-field/");
  const years = [...tf.matchAll(/<span class="ox-notes-year">(\d{4})<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(years, ["2026", "2025", "2024", "2023", "2022", "2020", "2019", "2018", "2016"]);
  assert.equal((tf.match(/Archive\/20\d\d\/[^"]*\.pdf"/g) || []).length, 116, "every clinic PDF kept");
  // Leadership: current people first, then past leaders by role.
  const hist = page("/oatccc/about/history-of-leadership/");
  const order = ["Current officers and district representatives", ">Officers<", ">District representatives<", "Past leaders", ">Presidents<", ">Secretaries<", ">Treasurers<", ">Editors<"].map((t) => hist.indexOf(t));
  assert.ok(order.every((n, i) => n > 0 && (i === 0 || n > order[i - 1])), JSON.stringify(order));
  assert.ok(!hist.includes("MCDERMOTT"), "stray rows dropped");
  assert.ok(!/\(\d{3}\)\s*\d{3}-\d{4}|\b\d{3}-\d{3}-\d{4}\b/.test(hist + page("/oatccc/about/leadership/")), "no phone numbers");
});

test("Zachary's follow-up (2026-11-17): Chair contact line, FinalForms vendor row, hotel phones", () => {
  const FF = "https://oatccc-oh.finalforms-amp.com/";
  const pages = oatcccOutputs(site, oatcccFlags({ ...ALL, OATCCC_FILES_HOSTED: "1" })).pages;
  const page = (p) => pages.find((x) => x.pathname === p).html;
  // Since Matt's list (2026-11-18) the Chair line is only the no-JavaScript fallback.
  const line = '<noscript><p class="ox-lead-contact" id="ox-lead-fallback">To reach a district rep or officer, email the Indoor State Meet Chair at <a href="mailto:awhitman@oatccc.com">awhitman@oatccc.com</a>.</p></noscript>';
  for (const p of ["/oatccc/about/leadership/", "/oatccc/about/history-of-leadership/"]) {
    const html = page(p);
    assert.equal(html.split(line).length, 2, p);
    assert.equal(html.split("To reach a district rep or officer").length, 2, p + ": no visible contact line");
    assert.ok(html.indexOf(line) < html.indexOf('<div class="ox-lead-groups">'), p);
  }
  const forms = page("/oatccc/forms/");
  assert.match(forms, new RegExp(`VENDOR Contract Form[\\s\\S]*?<a href="${FF}"[^>]*>Vendor Submission</a>`));
  assert.ok(!forms.includes("Vendor-Contract.pdf"), "old contract PDF gone");
  assert.ok(page("/oatccc/clinics/vendors/").includes(">Vendor Letter</a>"));
  const tf = page("/oatccc/clinics/track-and-field/");
  assert.ok(tf.includes('<h6><a href="tel:6144145000">Hotel Phone: (614) 414-5000</a></h6>'));
  assert.ok(tf.includes('Overflow Hotel - Aloft at Easton <br> Hotel Phone: <a href="tel:6147629162">614-762-9162</a></h6>'));
  for (const p of pages) assert.match(p.html, new RegExp(`href="${FF}"[^>]*>Membership<`), p.pathname);
});

test("2027 Junior High meet on the Middle School page (OATCCC PDF, 2026-11-17)", () => {
  const PATH = "/oatccc/indoor/middle-school/";
  const { OATCCC_MS_LIVE, ...noMs } = ALL;
  assert.ok(!oatcccOutputs(site, oatcccFlags(noMs)).pages.some((p) => p.pathname === PATH), "off without OATCCC_MS_LIVE");
  const html = oatcccOutputs(site, oatcccFlags(ALL)).pages.find((p) => p.pathname === PATH).html;
  for (const words of [
    "OATCCC Junior High State Indoor Championships",
    "Entry Fee is $10 per event/$25 per relay",
    "All athletes must have a coach with an OATCCC current membership.  Memberships will be sold the day of the meet.",
    "Any 7th/8th grader can be registered by their school.  An athlete only needs one performance mark to qualify to the meet. Seeding will be done by current season marks.",
    "Relay entries must be from the same Middle School",
    "Must be registered by their schools coach.",
    "8:00 am-11:00 am    Athlete Check in",
    "We will be on a rolling time schedule."
  ]) assert.ok(html.includes(words), words);
  const prose = html.split('class="ox-prose"')[1].split('class="ox-source"')[0];
  assert.ok(!/March \d+, 2026|registration for this event has ended|Marks are not required/.test(prose), "2026 meet text gone");
  // Verification Form: old oatccc.com wording, word for word (Anjanette, 2026-11-17).
  const ver = prose.split("<h3>Verification Form</h3>")[1].split("<h3>Schedule of Events</h3>")[0];
  for (const words of [
    "Verification Form (Online Only):",
    "The verification form is completed by the team's coach.",
    "In consideration for participating with the OAT&amp;CCC Indoor Middle School State Championship Meet all of the following regulations must be complied with:",
    "The participating Indoor Track &amp; Field team’s school must be a member of the OHSAA for the 2025-2026 academic year and abides by the regulations to be member in good-standing with the OHSAA;",
    "All coaches representing the participating Indoor Track &amp; Field team must be 2026 members of the OAT&amp;CCC;",
    "All student-athletes associated with the participating Indoor Track &amp; Field team must meet all local Board of Education and OHSAA eligibility requirements for participation in athletics; and",
    "If the Indoor Track &amp; Field team participating is represented by a coach or student-athlete who does not meet the above regulations, then the OATCCC may exclude the team or any of its competitors or coaches from the Indoor State Meet and apply sanctions to the team's future participation with OATCCC events."
  ]) assert.ok(ver.includes(words), words);
  assert.ok(ver.includes('<strong>Verification form link:</strong> <mark class="ox-tbc">[TO CONFIRM]</mark>'));
  assert.ok(ver.includes('Verification Form Submission Deadline: <mark class="ox-tbc">[TO CONFIRM]</mark>'));
  const lists = [...html.matchAll(/<h4>(Field Events|Running Events)<\/h4>\s*<ul class="ox-sched">([\s\S]*?)<\/ul>/g)];
  assert.deepEqual(lists.map((m) => m[1]), ["Field Events", "Running Events"]);
  const items = (m) => [...m[2].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((x) => x[1].replace(/<span class="ox-sched-time">[^<]*<\/span>\s*/, ""));
  assert.deepEqual(items(lists[0]), ["Girls Shot", "Boys Long Jump", "Girls Pole Vault", "Boys High Jump", "Boys Shot", "Girls High Jump", "Girls Long Jump", "Boys Pole Vault"]);
  const run = items(lists[1]);
  assert.equal(run.length, 23);
  assert.deepEqual([run[0], run[2], run[16], run[22]], ["Girls 3200 Relay", "Girls 60 Hurdles", "Girls 800m Run", "Team Awards"]);
  assert.deepEqual([...html.matchAll(/<span class="ox-sched-time">([^<]*)<\/span>/g)].map((m) => m[1]), ["9:00 am", "Followed by:", "10:00 am"]);
  assert.equal((html.match(/<mark class="ox-tbc">\[TO CONFIRM\]<\/mark>/g) || []).length, 4);
  assert.ok(html.includes("<strong>Registration deadline:</strong> <mark") && html.includes("<strong>MileSplit meet page:</strong> <mark"));
  assert.match(html, /<a href="https:\/\/oatccc-oh\.finalforms-amp\.com\/"[^>]*class="btn2 ox-big">Join the OATCCC<\/a><\/div>\s*<p class="ox-bigbtn-how">Select Login\/Signup and follow the prompts\.<\/p>/);
  assert.ok(!/tel:|\b\d{3}-\d{3}-\d{4}\b/.test(html), "no phone numbers");
  // Zachary's approval notes (2026-11-17): contact, footer, hub card.
  assert.match(html, /<p><strong>Contact:<\/strong> Doug Joy, <a class="ox-email-link" href="#ox-lead-fallback" data-ox-e="[^"]+">Email<\/a><\/p>/, "contact line (address encoded since 2026-11-18)");
  assert.ok(html.includes('<p class="ox-source">Information from the OATCCC&rsquo;s 2027 Junior High State Meet sheet and the OATCCC&rsquo;s Middle School verification terms.</p>'), "footer");
  const other = oatcccOutputs(site, oatcccFlags(ALL)).pages.find((p) => p.pathname === "/oatccc/about/").html;
  assert.ok(other.includes("This page is shared from oatccc.com with the OATCCC&rsquo;s permission."), "other pages keep their footer");
  const hub = (flags) => oatcccOutputs(site, oatcccFlags(flags)).pages.find((p) => p.pathname === "/oatccc/").html;
  assert.ok(hub(ALL).includes("March 13, 2027 &middot; Muskingum University"));
  assert.ok(hub(noMs).includes("2027 date and site coming soon") && !hub(noMs).includes("Muskingum"));
});

test("History of Leadership layout (2026-11-17): past tables collapsed, rows unchanged and in oatccc.com order", () => {
  const html = oatcccOutputs(site, oatcccFlags(ALL)).pages.find((p) => p.pathname === "/oatccc/about/history-of-leadership/").html;
  const src = fs.readFileSync(new URL("../src/oatccc/more/content/history-of-leadership.html", import.meta.url), "utf8");
  const rows = (s) => [...s.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => [...m[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => c[1]).join(" | "));
  const past = html.split("<h2>Past leaders</h2>")[1];
  assert.deepEqual(rows(past), rows(src), "same rows, same text, same order");
  assert.deepEqual([...past.matchAll(/<details class="ox-past-sec">\s*<summary>([^<]+)<\/summary>/g)].map((m) => m[1]), ["Presidents", "Secretaries", "Treasurers", "Editors"]);
  assert.ok(!/<details class="ox-past-sec" open/.test(past), "collapsed by default");
  assert.ok(!/<td>/.test(past) && /<td data-l="Year">2023-24<\/td>/.test(past), "every cell labelled");
  assert.equal((html.split("<h2>Past leaders</h2>")[0].match(/<li class="ox-leader/g) || []).length, 57, "57 current-leader rows from Matt's list");
  const css = fs.readFileSync(new URL("../src/oatccc/oatccc.css", import.meta.url), "utf8");
  assert.match(css, /table\.ox-past td\[data-l="Year"\] \{ white-space: nowrap; \}/);
});

test("Current leaders from Matt Schock's list (2026-11-18): order, one Email button, encoded addresses", async () => {
  const { leadersFromCsv, encodeEmail } = await import("../scripts/oatccc-leaders-import.mjs");
  const data = JSON.parse(fs.readFileSync(new URL("../src/oatccc/more/leaders.json", import.meta.url), "utf8"));
  const raw = fs.readFileSync(new URL("../src/oatccc/more/leaders.json", import.meta.url), "utf8");
  const pages = oatcccOutputs(site, oatcccFlags(ALL)).pages;
  const page = (p) => pages.find((x) => x.pathname === p).html;
  const decode = (c) => [...Buffer.from(c, "base64").toString("utf8")].reverse().join("");

  // The data file: only the allowed fields, no plain address, no phone or street.
  assert.equal(data.leaders.length, 57);
  for (const p of data.leaders) assert.deepEqual(Object.keys(p).sort(), ["affiliation", "e", "name", "photo", "role"]);
  assert.ok(!raw.includes("@"), "no plain email address in the committed data file");
  assert.ok(!/\(\d{3}\)\s*\d{3}-\d{4}|\b\d{3}[-. ]\d{3}[-. ]\d{4}\b/.test(raw), "no phone numbers");
  for (const p of data.leaders) for (const c of p.e) assert.match(decode(c), /^[^@\s]+@[^@\s]+\.[^@\s]+$/);
  const addresses = data.leaders.flatMap((p) => p.e.map(decode));

  // The importer ignores phone and address columns entirely.
  const sample = leadersFromCsv("Position,First Name,Last Name,School/Affiliation,Phone Number,Mailing Address,OATCCC Email,Personal/Work Email\nPresident,Test,Person,Test High School,555-123-4567,1 Main St,t@oatccc.example,t@home.example\n");
  assert.deepEqual(sample, [{ role: "President", name: "Test Person", affiliation: "Test High School", e: [encodeEmail("t@oatccc.example"), encodeEmail("t@home.example")], photo: null }]);

  for (const p of ["/oatccc/about/leadership/", "/oatccc/about/history-of-leadership/"]) {
    const html = page(p);
    const groups = html.split('<div class="ox-lead-groups">')[1].split(/<h2>Past leaders<\/h2>|<p class="ox-source">/)[0];
    // No plain address from Matt's list anywhere in the page, except the
    // Chair's (already published across the OATCCC pages) inside <noscript>.
    const outsideNoscript = html.replace(/<noscript>[\s\S]*?<\/noscript>/g, "");
    for (const a of addresses) assert.ok(!outsideNoscript.toLowerCase().includes(a.toLowerCase()), `${p}: plain address`);
    assert.ok(!/mailto:/.test(outsideNoscript), `${p}: no mailto outside the fallback`);
    assert.ok(html.includes('<script src="/scripts/oatccc-email.js" defer></script>'), p);
    // Order: Officers, District reps 1-16, Chairs and committees, Liaisons.
    const heads = [...groups.matchAll(/<h3 class="ox-lead-group">([^<]+)<\/h3>/g)].map((m) => m[1]);
    assert.deepEqual(heads, ["Officers", "District representatives", "Chairs and committees", "Liaisons"], p);
    const roles = (section) => [...section.matchAll(/<span class="ox-leader-role">([^<]+)<\/span>/g)].map((m) => m[1]);
    const [, officers, districts, chairs, liaisons] = groups.split(/<h3 class="ox-lead-group">[^<]+<\/h3>/);
    assert.deepEqual(roles(officers), ["President", "Vice President", "Secretary", "Treasurer", "Past President"]);
    assert.deepEqual(roles(districts), Array.from({ length: 16 }, (_, i) => [`District ${i + 1}`, `Alternate District ${i + 1}`]).flat());
    assert.deepEqual([...districts.matchAll(/<h4>(District \d+)<\/h4>/g)].map((m) => m[1]), Array.from({ length: 16 }, (_, i) => `District ${i + 1}`));
    assert.deepEqual(roles(liaisons), ["OHSAA Liaison", "College Liaison"]);
    assert.equal(roles(chairs).length, 57 - 5 - 32 - 2);
    assert.equal(roles(chairs)[0], "Track Clinic Chair");
    // Matt's wording, as written.
    assert.ok(groups.includes("<strong>Kris Boey</strong>") && groups.includes("<strong>Nicole Whitley</strong>") && groups.includes(">OHSAA Sport Administrator<"));
    assert.ok(groups.includes(">Northmont   OHSAA Registered official<"));
    // Alternate District 5 is open, with no button.
    assert.match(groups, /<li class="ox-leader ox-leader-open"><div class="ox-leader-text"><span class="ox-leader-role">Alternate District 5<\/span><strong>Open<\/strong><\/div><\/li>/);
    // One Email button per person row, each with every address in that row.
    const cards = [...groups.matchAll(/<li class="ox-leader[^"]*">([\s\S]*?)<\/li>/g)].map((m) => m[1]);
    assert.equal(cards.length, 57);
    cards.forEach((card, i) => {
      const want = data.leaders.find((l) => card.includes(`<span class="ox-leader-role">${l.role.replace(/&/g, "&amp;")}</span><strong>${l.name || "Open"}</strong>`) && card.includes(`data-ox-e="${l.e.join(" ")}"`) === (l.e.length > 0));
      assert.ok(want, `card ${i} matches a row`);
      assert.equal((card.match(/class="btn2 ox-leader-email"/g) || []).length, want.e.length ? 1 : 0);
    });
    // Jeff Howard's Advisory Committee row: personal email only, as Matt wrote it.
    const jeff = data.leaders.filter((l) => l.name === "Jeff Howard");
    assert.deepEqual(jeff.map((l) => [l.role, l.e.length]), [["Alternate District 4", 2], ["Advisory Committee", 1]]);
    assert.ok(!/<img/.test(groups), "no empty photo boxes");
    assert.ok(!/\(\d{3}\)\s*\d{3}-\d{4}|\b\d{3}-\d{3}-\d{4}\b|tel:/.test(groups), "no phone numbers");
  }
  const js = fs.readFileSync(new URL("../src/oatccc/oatccc-email.js", import.meta.url), "utf8");
  assert.match(js, /"mailto:" \+ to\.join\(","\)/);
});

test("T&F Clinic: Hotel Group Rate button above the hotel phones (Anjanette, 2026-11-18)", () => {
  const tf = oatcccOutputs(site, oatcccFlags(ALL)).pages.find((p) => p.pathname === "/oatccc/clinics/track-and-field/").html;
  const btn = '<div class="ox-bigbtns"><a href="https://www.hilton.com/en/attend-my-event/cmhchhf-93v-a52b6c8c-d1da-4b30-ab49-c7d116163e7d/" target="_blank" rel="noopener noreferrer" class="btn2 ox-big">Hotel Group Rate (rooms are limited - reserve today!)</a></div>';
  assert.equal(tf.split(btn).length, 2);
  assert.ok(tf.indexOf(btn) < tf.indexOf("Hotel Phone: (614) 414-5000") && tf.indexOf(btn) > tf.indexOf("3900 Chagrin Dr"));
});

test("Personal addresses encoded on the Hall of Fame bios and the Middle School page (2026-11-18)", async () => {
  const { protectEmails, EMAIL_FALLBACK } = await import("../src/oatccc/email-protect.mjs");
  const { oatcccHofPages } = await import("../src/oatccc/more/hof.mjs");
  const decode = (c) => [...Buffer.from(c, "base64").toString("utf8")].reverse().join("");
  const plain = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

  // The helper: mailto links and written-out addresses become encoded links;
  // the Chair's address (the public contact and fallback) is left alone.
  const r = protectEmails('<p>Contact: Test Coach, <a href="mailto:coach@school.example">coach@school.example</a></p><p>Reach him at other.person@mail.example.</p><p><a href="mailto:awhitman@oatccc.com">awhitman@oatccc.com</a></p>');
  assert.equal(r.count, 2);
  assert.deepEqual([...r.html.matchAll(/data-ox-e="([^"]+)"/g)].map((m) => decode(m[1])), ["coach@school.example", "other.person@mail.example"]);
  assert.match(r.html, /Reach him at <a class="ox-email-link" href="#ox-lead-fallback" data-ox-e="[^"]+">Email<\/a>\.<\/p>/);
  assert.ok(r.html.includes('<a href="mailto:awhitman@oatccc.com">awhitman@oatccc.com</a>'));
  assert.deepEqual([...r.html.matchAll(plain)].map((m) => m[0]), ["awhitman@oatccc.com", "awhitman@oatccc.com"]);

  // Middle School page: Doug Joy's address only encoded, with fallback and script.
  const ms = oatcccOutputs(site, oatcccFlags({ ...ALL, OATCCC_INDOOR_FULL_LIVE: "1" })).pages.find((p) => p.pathname === "/oatccc/indoor/middle-school/").html;
  const src = fs.readFileSync(new URL("../src/oatccc/more/content/middle-school.html", import.meta.url), "utf8");
  const doug = src.match(/mailto:([^"]+)"/)[1];
  assert.ok(!ms.toLowerCase().includes(doug.toLowerCase()), "Doug Joy's address not plain");
  assert.match(ms, /<p><strong>Contact:<\/strong> Doug Joy, <a class="ox-email-link" href="#ox-lead-fallback" data-ox-e="([^"]+)">Email<\/a><\/p>/);
  assert.equal(decode(ms.match(/Doug Joy, <a [^>]*data-ox-e="([^"]+)"/)[1]), doug);
  assert.ok(ms.includes(EMAIL_FALLBACK) && ms.includes('<script src="/scripts/oatccc-email.js" defer></script>'));

  // Hall of Fame bio (TEST data): address in the text is encoded, page gets fallback and script.
  const data = {
    inductees: [{ id: "t", slug: "test-coach-2024", name: "Test Coach", sort_name: "Coach, Test", induction_year: 2024, ed_barker_recipient: false, school: "Test High School", sport: "", bio: "Coached for years.\n\nTest can be reached at test.coach@mail.example", photo_path: null, old_url: null },
      { id: "u", slug: "no-email-2024", name: "No Email", sort_name: "Email, No", induction_year: 2024, ed_barker_recipient: false, school: "", sport: "", bio: "No address here.", photo_path: null, old_url: null }],
    awards: [], recipients: []
  };
  const hof = oatcccHofPages(site, oatcccFlags(ALL), data);
  const one = hof.find((p) => p.pathname.endsWith("/test-coach-2024/")).html;
  assert.ok(!one.includes("test.coach@mail.example"));
  assert.match(one, /Test can be reached at <a class="ox-email-link" href="#ox-lead-fallback" data-ox-e="([^"]+)">Email<\/a><\/p>/);
  assert.ok(one.includes(EMAIL_FALLBACK) && one.includes('<script src="/scripts/oatccc-email.js" defer></script>'));
  const none = hof.find((p) => p.pathname.endsWith("/no-email-2024/")).html;
  assert.ok(!none.includes("ox-lead-fallback") && !none.includes("oatccc-email.js"), "pages without addresses unchanged");
});

test("Launch build (2026-11-19): no [TO CONFIRM] on any live page; Middle School off and not linked", async () => {
  const { pagesWithUnconfirmed } = await import("../src/oatccc/build.mjs");
  const launch = { OATCCC_LIVE: "1", OATCCC_INDOOR_FULL_LIVE: "1", OATCCC_DIVISION_LIST_LIVE: "1", OATCCC_TERMS_LIVE: "1", OATCCC_MORE_LIVE: "1", OATCCC_FILES_HOSTED: "1",
    ...Object.fromEntries(Object.entries(MORE_SECTIONS).filter(([key]) => key !== "ms").map(([, name]) => [name, "1"])) };
  const { pages } = oatcccOutputs(site, oatcccFlags(launch));
  assert.deepEqual(pagesWithUnconfirmed(pages), []);
  assert.ok(!pages.some((p) => p.pathname.includes("middle-school")), "no Middle School page");
  for (const p of pages) assert.ok(!p.html.includes('href="/oatccc/indoor/middle-school/"'), `${p.pathname} links to Middle School`);
  // The stop itself: a page with the marker is reported.
  assert.deepEqual(pagesWithUnconfirmed([{ pathname: "/x/", html: '<p>Date <mark class="ox-tbc">[TO CONFIRM]</mark></p>' }, { pathname: "/y/", html: "<p>ok</p>" }]), ["/x/"]);
});
