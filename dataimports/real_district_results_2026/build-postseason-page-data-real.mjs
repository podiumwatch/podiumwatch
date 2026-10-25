// Converts postseason_chain_output_real.json into src/data/mock-postseason-2026-real.json,
// the real-results counterpart to dataimports/ohio_2026_xc_Claude_Code/
// build-postseason-page-data.mjs's src/data/mock-postseason-2026.json.
// Same shape (districtsBySite / regionalResults / stateResults) so
// src/pages/mockpostseason.mjs's factory can render either universe with
// the same code.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(pkgDir, "../..");

const chain = JSON.parse(fs.readFileSync(path.join(pkgDir, "postseason_chain_output_real.json"), "utf8"));
const district = JSON.parse(fs.readFileSync(path.join(root, "dataimports/district_meets_2026.json"), "utf8"));

function siteName(key) {
  const s = district.sites.find((x) => x.key === key);
  return s ? s.name : key;
}

const districtsBySite = {};
for (const dr of chain.districtResults) {
  if (!districtsBySite[dr.site]) {
    const site = district.sites.find((s) => s.key === dr.site);
    districtsBySite[dr.site] = { key: dr.site, name: siteName(dr.site), region: site.region, regional: site.regional, races: [] };
  }
  districtsBySite[dr.site].races.push({ ...dr, status: "scored", startTime: null, enteredNoProjectionData: [] });
}
// Real race order within a site: gender (boys then girls), then division
// ascending, then session. There's no real start-time data in the pasted
// results, so this is the only sensible deterministic order.
const GENDER_ORDER = { boys: 0, girls: 1 };
for (const site of Object.values(districtsBySite)) {
  site.races.sort((a, b) => {
    if (a.gender !== b.gender) return GENDER_ORDER[a.gender] - GENDER_ORDER[b.gender];
    if (a.division !== b.division) return a.division - b.division;
    return (a.raceLabel || "").localeCompare(b.raceLabel || "");
  });
}

const output = {
  schemaVersion: 1,
  asOf: district.meet_date,
  meetDate: district.meet_date,
  regionalDate: district.regional_date,
  districtsBySite,
  regionalResults: chain.regionalResults,
  stateResults: chain.stateResults,
  underReviewByCategory: {},
  districtStatewideCheck: {}
};

const outPath = path.join(root, "src/data/mock-postseason-2026-real.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`Wrote ${outPath}`);
