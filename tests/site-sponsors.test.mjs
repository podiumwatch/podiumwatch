import test from "node:test";
import assert from "node:assert/strict";
import { findPlacement, placementForPath, sponsorSlotHtml } from "../lib/site_sponsors.mjs";
import { monthRange, summarizePlacement } from "../lib/sponsor_report_service.mjs";

test("placements follow the pages Zachary set", () => {
  assert.equal(placementForPath("/rankings/cross-country/girls/division-3/").sponsor.id, "spike-town-runners-plus");
  assert.equal(placementForPath("/rankings/top-10/").sponsor.id, "raising-canes");
  assert.equal(placementForPath("/rankings/oatccc/"), null, "no sponsor on OATCCC poll pages");
  assert.equal(placementForPath("/athletes/someone/"), null);
});

test("links go through /go/ for counting; a sponsor with no url is shown by name only", () => {
  const spike = sponsorSlotHtml("/rankings/cross-country/boys/division-1/");
  assert.match(spike, /href="\/go\/spike-town-runners-plus\/rankings\/\?from=%2Frankings%2Fcross-country%2Fboys%2Fdivision-1%2F"/);
  assert.match(spike, /rel="sponsored noopener"/);
  const canes = sponsorSlotHtml("/rankings/top-10/");
  assert.match(canes, /Presented by/);
  assert.doesNotMatch(canes, /href=/);
  assert.equal(sponsorSlotHtml("/rankings/oatccc/"), "");
  assert.equal(findPlacement("spike-town-runners-plus", "rankings").sponsor.url, "https://runpl.us/PodiumWatch");
  assert.equal(findPlacement("spike-town-runners-plus", "nope"), null);
});

test("report math: impressions by path prefix, bot clicks left out, click rate", () => {
  const placement = { id: "rankings", paths: ["/rankings/cross-country/"] };
  const views = [
    { content_id: "/rankings/cross-country/boys/division-1/" },
    { content_id: "/rankings/cross-country/boys/division-1/" },
    { content_id: "/rankings/cross-country/girls/division-2/" },
    { content_id: "/rankings/top-10/" }
  ];
  const clicks = [{ placement_id: "rankings", device_class: "phone" }, { placement_id: "rankings", device_class: "bot" }];
  const summary = summarizePlacement(placement, views, clicks);
  assert.equal(summary.impressions, 3);
  assert.equal(summary.clicks, 1);
  assert.equal(summary.click_rate, 33.33);
  assert.deepEqual(summary.top_pages[0], { path: "/rankings/cross-country/boys/division-1/", views: 2 });
  assert.deepEqual(monthRange("2026-11"), { month: "2026-11", start: "2026-11-01T00:00:00.000Z", end: "2026-12-01T00:00:00.000Z" });
  assert.equal(monthRange("2026-12").end, "2027-01-01T00:00:00.000Z");
});
