// OATCCC section switches (src/oatccc/config.mjs). The section must stay
// completely unbuilt unless OATCCC_LIVE=1, the four pages copied from
// oatccc.com need their own setting, and pages are noindex everywhere
// except the real production launch.
import test from "node:test";
import assert from "node:assert/strict";
import { oatcccFlags, indoorHref, LINKS, SPONSORS } from "../src/oatccc/config.mjs";
import { oatcccOutputs } from "../src/oatccc/build.mjs";
import { site } from "../src/config/site.mjs";

test("off by default: no setting means nothing is built", () => {
  const flags = oatcccFlags({});
  assert.equal(flags.live, false);
  for (const name of ["indoorFull", "verification", "divisionList", "more", "filesHosted", "indexable"]) assert.equal(flags[name], false, name);
  assert.ok(Object.values(flags.sections).every((on) => on === false), "every full-site section is off");
  assert.deepEqual(oatcccOutputs(site, flags), { pages: [], assets: [] });
});

test("only the exact value 1 turns a setting on", () => {
  for (const value of ["", "0", "true", "yes", "on", " 2 "]) {
    assert.equal(oatcccFlags({ OATCCC_LIVE: value }).live, false, `OATCCC_LIVE=${JSON.stringify(value)}`);
  }
  assert.equal(oatcccFlags({ OATCCC_LIVE: "1" }).live, true);
});

test("the sub-settings do nothing without OATCCC_LIVE", () => {
  const flags = oatcccFlags({ OATCCC_INDOOR_FULL_LIVE: "1", OATCCC_VERIFICATION_LIVE: "1", VERCEL_ENV: "production" });
  assert.equal(flags.live, false);
  assert.equal(flags.indoorFull, false);
  assert.equal(flags.verification, false);
  assert.equal(flags.indexable, false);
});

test("launch builds the hub and three indoor pages; the oatccc.com four link out", () => {
  const flags = oatcccFlags({ OATCCC_LIVE: "1" });
  const paths = oatcccOutputs(site, flags).pages.map((page) => page.pathname).sort();
  assert.deepEqual(paths, [
    "/oatccc/",
    "/oatccc/indoor/high-school/abcs/",
    "/oatccc/indoor/high-school/divisions/",
    "/oatccc/indoor/high-school/eligibility-and-verification/"
  ]);
  for (const key of ["overview", "declarations", "meetday", "faq"]) assert.equal(indoorHref(key, flags), LINKS.indoorPage);
});

test("OATCCC_INDOOR_FULL_LIVE adds the four pages", () => {
  const flags = oatcccFlags({ OATCCC_LIVE: "1", OATCCC_INDOOR_FULL_LIVE: "1" });
  const paths = oatcccOutputs(site, flags).pages.map((page) => page.pathname);
  for (const path of ["/oatccc/indoor/high-school/", "/oatccc/indoor/high-school/declarations-and-fees/", "/oatccc/indoor/high-school/meet-day/", "/oatccc/indoor/high-school/faq/"]) {
    assert.ok(paths.includes(path), path);
  }
});

test("noindex everywhere but the production launch", () => {
  const preview = oatcccOutputs(site, oatcccFlags({ OATCCC_LIVE: "1", VERCEL_ENV: "preview" }));
  for (const page of preview.pages) assert.match(page.html, /<meta name="robots" content="noindex, nofollow">/, page.pathname);
  const production = oatcccOutputs(site, oatcccFlags({ OATCCC_LIVE: "1", VERCEL_ENV: "production" }));
  for (const page of production.pages) assert.doesNotMatch(page.html, /noindex/, page.pathname);
});

test("every page has the lockup, the tab bar and all six sponsors", () => {
  const { pages } = oatcccOutputs(site, oatcccFlags({ OATCCC_LIVE: "1", OATCCC_INDOOR_FULL_LIVE: "1" }));
  for (const page of pages) {
    assert.match(page.html, /aria-label="Podium Watch, powered by the OATCCC"/, page.pathname);
    assert.match(page.html, /class="ox-tabs"/, page.pathname);
    for (const sponsor of SPONSORS) assert.ok(page.html.includes(sponsor.href), `${page.pathname} ${sponsor.name}`);
  }
});

test("no review-draft leftovers and no review link on any page", () => {
  const { pages } = oatcccOutputs(site, oatcccFlags({ OATCCC_LIVE: "1", OATCCC_INDOOR_FULL_LIVE: "1" }));
  for (const page of pages) {
    assert.doesNotMatch(page.html, /review note|Notes for OATCCC review|Questions for the OATCCC|possible future home|class="rn"|mark class="rv"|DRAFT|\/review\//i, page.pathname);
  }
});

test("Parking Map and Onsite Food Options stay unlinked (Tripleseat links open a sign-in page)", () => {
  const { pages } = oatcccOutputs(site, oatcccFlags({ OATCCC_LIVE: "1", OATCCC_INDOOR_FULL_LIVE: "1" }));
  const meetDay = pages.find((page) => page.pathname === "/oatccc/indoor/high-school/meet-day/").html;
  assert.match(meetDay, /<p>Parking Map<\/p>/);
  assert.match(meetDay, /<p>Onsite Food Options<\/p>/);
  for (const page of pages) assert.doesNotMatch(page.html, /tripleseat/i, page.pathname);
});

test("athletic director sign-in stays hidden until verification is switched on", () => {
  const hub = (env) => oatcccOutputs(site, oatcccFlags(env)).pages.find((page) => page.pathname === "/oatccc/").html;
  assert.doesNotMatch(hub({ OATCCC_LIVE: "1" }), /Athletic director sign-in/);
  assert.match(hub({ OATCCC_LIVE: "1", OATCCC_VERIFICATION_LIVE: "1" }), /Athletic director sign-in/);
});

// Anjanette's answers (2026-11-17), Part 1 of the handoff.
test("launch pages use Anjanette's answers", () => {
  const pages = oatcccOutputs(site, oatcccFlags({ OATCCC_LIVE: "1", OATCCC_INDOOR_FULL_LIVE: "1" })).pages;
  const html = (path) => pages.find((p) => p.pathname === path).html;
  const launch = ["/oatccc/", "/oatccc/indoor/high-school/abcs/", "/oatccc/indoor/high-school/divisions/", "/oatccc/indoor/high-school/eligibility-and-verification/"];
  for (const path of launch) {
    const page = html(path);
    assert.doesNotMatch(page, /calendar year|January through December|2027 members|for each team|3\/1\/27|March 1, 2027|docs\.google\.com|every Sunday|for convenience/i, path);
  }
  assert.match(html("/oatccc/"), /paid members for the 2026-2027 academic year/);
  assert.match(html(launch[1]), /Coaches must be paid OATCCC members for the 2026-2027 academic year in order for their athletes to be eligible to compete in the Indoor State Meet/);
  const elig = html(launch[3]);
  assert.match(elig, /The terms in the verification form signed by the athletic director are the official rules\. They are the same as the content shown in the verification section\./);
  assert.match(elig, /If you do not see your school listed, ask your AD if they submitted the online form emailed to them\./);
  assert.match(elig, /The coach or person designated by the coach declares, scratches, and pays\./);
  assert.match(elig, /The entry fees are due by 12 noon the day of the meet that the team or athlete is competing\./);
  assert.match(elig, /hereby releases, waives and covenants not to sue/);
  assert.match(elig, /href="mailto:awhitman@oatccc\.com\?subject=Indoor%20State%20Meet"/);
  assert.doesNotMatch(elig, /oatccc\.com\/Contact-Us/);
  const div = html(launch[2]);
  assert.match(div, /Divisions are based on 2026-2027 OHSAA Enrollment Figures\./);
  for (const range of ["449 and up", "207 - 448", "124 - 206", "1 - 123", "465 and up", "221 - 464", "125 - 220", "1 - 124"]) assert.ok(div.includes(range), range);
  assert.match(div, /The steps apply equally to athletes and relays\./);
  assert.match(div, /They must declare in the same window of time as the other divisions February 24-26\. Same fees apply but there are no relays\./);
  const faq = html("/oatccc/indoor/high-school/faq/");
  assert.match(faq, /paid members of the OAT&amp;CCC for the 2026-2027 academic year\./);
  assert.doesNotMatch(faq, /calendar year/);
});
