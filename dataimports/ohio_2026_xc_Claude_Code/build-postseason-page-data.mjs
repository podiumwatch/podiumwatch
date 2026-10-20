// Converts postseason_chain_output.json (+ the region/district reports)
// into the single data file src/pages/mockpostseason.mjs reads at build
// time: src/data/mock-postseason-2026.json. Local-only artifact -- does
// not touch src/data/mock-regionals-2026.json or the live
// mock-districts-2026.json.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(pkgDir, "../..");

const chain = JSON.parse(fs.readFileSync(path.join(pkgDir, "postseason_chain_output.json"), "utf8"));
const district = JSON.parse(fs.readFileSync(path.join(root, "dataimports/district_meets_2026.json"), "utf8"));
const candidate = JSON.parse(fs.readFileSync(path.join(pkgDir, "ohio_2026_xc_full_statewide_2026.json"), "utf8"));

function siteName(key) {
  const s = district.sites.find((x) => x.key === key);
  return s ? s.name : key;
}

// --- Districts: one entry per real race (HD combos already collapsed in districtResults) ---
const districtsBySite = {};
for (const dr of chain.districtResults) {
  if (!districtsBySite[dr.site]) {
    const site = district.sites.find((s) => s.key === dr.site);
    districtsBySite[dr.site] = { key: dr.site, name: siteName(dr.site), region: site.region, regional: site.regional, races: [] };
  }
  districtsBySite[dr.site].races.push(dr);
}
// startTime is a plain "10:00 AM"-style string -- a string sort puts
// "10:00 AM" before "9:00 AM" (since "1" < "9" as characters). Parse to
// minutes-since-midnight instead so races actually land in real start
// order.
function startMinutes(value) {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(value || "").trim());
  if (!m) return Number.POSITIVE_INFINITY;
  let hour = Number(m[1]) % 12;
  if (/PM/i.test(m[3])) hour += 12;
  return hour * 60 + Number(m[2]);
}
for (const site of Object.values(districtsBySite)) {
  site.races.sort((a, b) => startMinutes(a.startTime) - startMinutes(b.startTime));
}

// --- Regionals + State, already fully scored in chain.regionalResults / chain.stateResults ---
// asOf: the roster collection itself finished 2026-10-19, but real data
// (Northeast qualifier numbers, Hilliard Darby's race split) was
// incorporated 2026-10-20 -- that's the date that actually describes how
// fresh this projection is, not the earlier collection date. ISO string;
// the page module formats it for display.
const output = {
  schemaVersion: 1,
  asOf: "2026-10-20",
  meetDate: district.meet_date,
  regionalDate: district.regional_date,
  districtsBySite,
  regionalResults: chain.regionalResults,
  stateResults: chain.stateResults,
  underReviewByCategory: chain.underReviewByCategory,
  districtStatewideCheck: chain.districtStatewideCheck
};

const outPath = path.join(root, "src/data/mock-postseason-2026.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`Wrote ${outPath}`);
