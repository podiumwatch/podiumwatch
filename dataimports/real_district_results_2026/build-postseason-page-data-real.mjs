// Converts postseason_chain_output_real.json into src/data/mock-postseason-2026-real.json,
// the real-results counterpart to dataimports/ohio_2026_xc_Claude_Code/
// build-postseason-page-data.mjs's src/data/mock-postseason-2026.json.
// Same shape (districtsBySite / regionalResults / stateResults) so
// src/pages/mockpostseason.mjs's factory can render either universe with
// the same code.
//
// Regional stage (2026-10-31): when dataimports/real_regional_results_2026/
// postseason_chain_output_real_regionals.json exists (written by
// apply-real-regionals.mjs from the real Oct 31 regional results), its
// OFFICIAL regionalResults and PROJECTED stateResults replace the
// district-fed projection here, and that projection is carried along as
// projectedRegionalResults so each regional card can show projection vs.
// actual. Without that file the output is exactly what it was before.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(pkgDir, "../..");

const chain = JSON.parse(fs.readFileSync(path.join(pkgDir, "postseason_chain_output_real.json"), "utf8"));
const district = JSON.parse(fs.readFileSync(path.join(root, "dataimports/district_meets_2026.json"), "utf8"));
const regionalStagePath = path.join(root, "dataimports/real_regional_results_2026/postseason_chain_output_real_regionals.json");
const regionalStage = fs.existsSync(regionalStagePath) ? JSON.parse(fs.readFileSync(regionalStagePath, "utf8")) : null;

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
  asOf: regionalStage ? regionalStage.asOf : district.meet_date,
  meetDate: district.meet_date,
  regionalDate: district.regional_date,
  districtsBySite,
  regionalResults: regionalStage ? regionalStage.regionalResults : chain.regionalResults,
  stateResults: regionalStage ? regionalStage.stateResults : chain.stateResults,
  underReviewByCategory: {},
  districtStatewideCheck: {}
};
if (regionalStage) {
  output.regionalsOfficial = true;
  output.regionalsAsOfLabel = regionalStage.asOfLabel;
  output.stateDate = regionalStage.stateDate;
  output.stateVenue = regionalStage.stateVenue;
  output.projectedRegionalResults = regionalStage.projectedRegionalResults;
  output.regionalSource = regionalStage.source;
  output.regionalWorkbookNotes = regionalStage.workbookNotes;
}

const outPath = path.join(root, "src/data/mock-postseason-2026-real.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`Wrote ${outPath}${regionalStage ? " (official regionals + projected State from the Oct 31 regional stage)" : ""}`);
