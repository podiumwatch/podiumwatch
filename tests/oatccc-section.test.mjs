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
  assert.deepEqual(flags, { live: false, indoorFull: false, verification: false, indexable: false });
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
