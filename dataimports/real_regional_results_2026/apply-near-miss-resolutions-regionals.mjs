// Applies Zachary's 2026-11-01 decisions on the regional PR near-misses
// (see near_miss_split_regionals.json and docs/SESSION_LOG.md, 2026-11-01):
//
//   1. Lebanon girls (D1): "Isabel Ansberry" (Athletic.net 30744175) and
//      "Izzy Ansberry" (29496136) are the same runner. Merge into one row
//      named as Athletic.net lists her now (Izzy Ansberry), keeping both
//      IDs. Applied to the hub roster and the legacy /mock-meets/ file.
//   2. Group (a) rows 3-8 (legacy file only; the hub roster already matched
//      these runners by Athletic.net ID): apply the regional time when it
//      is faster. Where the hub roster carries the Athletic.net spelling,
//      the legacy row takes the same spelling so both datasets agree;
//      otherwise the legacy spelling stays.
//   3. Group (b) case/punctuation-only rows: apply the regional time when
//      faster (two of the four are faster), fix capitalization only.
//
// Nothing else is touched. Faster-only, never a fuzzy match, no runner
// added. Writes near_miss_resolution_report_regionals.json.
//
// Run: node dataimports/real_regional_results_2026/apply-near-miss-resolutions-regionals.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(pkgDir, "../..");
const candidatePath = path.join(root, "dataimports/ohio_2026_xc_Claude_Code/ohio_2026_xc_full_statewide_2026.json");
const legacyPath = path.join(root, "src/data/mock-regionals-2026.json");

const parsed = JSON.parse(fs.readFileSync(path.join(pkgDir, "real_regional_results_2026_parsed.json"), "utf8"));
const candidate = JSON.parse(fs.readFileSync(candidatePath, "utf8"));
const legacyRaw = fs.readFileSync(legacyPath, "utf8");
const legacy = JSON.parse(legacyRaw);

const realByKey = new Map();
for (const race of parsed.races) {
  for (const row of race.results) {
    if (row.dnf) continue;
    realByKey.set(`${race.gender}|${row.school}|${row.name}`, { ...row, gender: race.gender, division: race.division, site: race.site });
  }
}
const sourceLabel = (real) => `real regional result (${real.site}, ${real.gender} D${real.division}, 2026-10-31)`;

// Legacy rows approved for a time update. rename: the spelling the legacy
// row takes afterwards (null = keep as is).
const LEGACY_APPROVED = [
  { gender: "boys", division: 1, team: "Milford", rosterName: "Daniel Haders  III", realName: "Daniel Haders III", rename: "Daniel Haders III", group: "a3" },
  { gender: "boys", division: 2, team: "Hol. Springfield", rosterName: "Johnathan (John Iman", realName: "Johnathan (John) Iman", rename: "Johnathan (John) Iman", group: "a4" },
  { gender: "boys", division: 3, team: "Bellaire", rosterName: "Kai Jon Cerritos", realName: "Kai'Jon Cerritos", rename: "Kai'Jon Cerritos", group: "a5" },
  { gender: "boys", division: 3, team: "Wauseon", rosterName: "Carter St John", realName: "Carter St. John", rename: "Carter St. John", group: "a6" },
  { gender: "girls", division: 3, team: "Bethel", rosterName: "Alyssandra \"Grace\" Peirano", realName: "Alyssandra Peirano", rename: null, group: "a7" },
  { gender: "girls", division: 3, team: "Crestwood", rosterName: "Madie Grace Gonczy", realName: "Madiegrace Gonczy", rename: null, group: "a8" },
  { gender: "boys", division: 1, team: "Lorain", rosterName: "isaiah Berrios", realName: "Isaiah Berrios", rename: "Isaiah Berrios", group: "b-case" },
  { gender: "boys", division: 3, team: "Fostoria", rosterName: "Zay'Mere Tucker", realName: "Zaymere Tucker", rename: null, group: "b-case" },
  { gender: "boys", division: 1, team: "Groveport-Madison", rosterName: "DeMari Smith", realName: "Demari Smith", rename: null, group: "b-case" },
  { gender: "boys", division: 2, team: "Whetstone", rosterName: "Maxfield Max) Kuhns", realName: "Maxfield (Max) Kuhns", rename: null, group: "b-case" },
];

const report = { generatedAt: new Date().toISOString(), ansberry: {}, legacy: [] };

function findLegacyRunner(gender, division, team, name) {
  for (const d of legacy.divisions) {
    if (String(d.gender).toLowerCase() !== gender || Number(d.division) !== division) continue;
    for (const [regionKey, region] of Object.entries(d.regions)) {
      for (const t of region.teams) {
        const i = t.runners.findIndex((r) => r.name === name);
        if (t.name === team && i >= 0) return { list: t.runners, index: i, runner: t.runners[i], regionKey };
      }
      const j = (region.individuals || []).findIndex((r) => r.name === name && r.school === team);
      if (j >= 0) return { list: region.individuals, index: j, runner: region.individuals[j], regionKey };
    }
  }
  return null;
}

// 1. Ansberry merge.
{
  const cat = candidate.categories.girls_d1;
  const team = cat.teams.find((t) => t.name === "Lebanon");
  const izzy = team.runners.find((r) => r.name === "Izzy Ansberry" && String(r.athleticNetId) === "29496136");
  const isabelIndex = team.runners.findIndex((r) => r.name === "Isabel Ansberry" && String(r.athleticNetId) === "30744175");
  if (!izzy || isabelIndex < 0) throw new Error("Ansberry rows not found as expected on the hub roster");
  const isabel = team.runners[isabelIndex];
  const real = realByKey.get("girls|Lebanon|Izzy Ansberry");
  if (!real) throw new Error("Izzy Ansberry regional row missing");
  izzy.mergedAthleticNetIds = ["30744175"];
  izzy.notes = `${izzy.notes ? izzy.notes + " " : ""}Merged 2026-11-01 with the duplicate roster row "Isabel Ansberry" (Athletic.net 30744175, ${isabel.seasonBest}); same runner, name kept as Athletic.net lists it. Regional time ${real.time} (Troy, girls D1, 2026-10-31) is slower than this season best and was not applied.`;
  team.runners.splice(isabelIndex, 1);
  report.ansberry.hub = { kept: { name: izzy.name, athleticNetId: izzy.athleticNetId, seasonBest: izzy.seasonBest, mergedAthleticNetIds: izzy.mergedAthleticNetIds }, removed: { name: isabel.name, athleticNetId: isabel.athleticNetId, seasonBest: isabel.seasonBest }, regionalTime: real.time, rosterSizeNow: team.runners.length };

  const legIzzy = findLegacyRunner("girls", 1, "Lebanon", "Izzy Ansberry");
  const legIsabel = findLegacyRunner("girls", 1, "Lebanon", "Isabel Ansberry");
  if (!legIzzy || !legIsabel) throw new Error("Ansberry rows not found as expected on the legacy roster");
  legIsabel.list.splice(legIsabel.index, 1);
  report.ansberry.legacy = { kept: { name: legIzzy.runner.name, seasonBest: legIzzy.runner.seasonBest }, removed: { name: "Isabel Ansberry", seasonBest: "21:44.02" }, rosterSizeNow: legIzzy.list.length };
}

// 2 + 3. Approved legacy rows.
for (const a of LEGACY_APPROVED) {
  const found = findLegacyRunner(a.gender, a.division, a.team, a.rosterName);
  const real = realByKey.get(`${a.gender}|${a.team}|${a.realName}`);
  if (!found || !real) throw new Error(`Row not found: ${a.team} ${a.rosterName} -> ${a.realName}`);
  const r = found.runner;
  const entry = { group: a.group, team: a.team, region: found.regionKey, rosterName: a.rosterName, realName: a.realName, oldSeasonBest: r.seasonBest, regionalTime: real.time, applied: false, renamedTo: null };
  if (real.timeCentiseconds < r.timeCentiseconds) {
    r.seasonBest = real.time;
    r.timeCentiseconds = real.timeCentiseconds;
    entry.applied = true;
    entry.source = sourceLabel(real);
  }
  if (a.rename && a.rename !== r.name) {
    r.name = a.rename;
    entry.renamedTo = a.rename;
  }
  report.legacy.push(entry);
}

legacy.lastUpdated = "2026-11-01";
fs.writeFileSync(candidatePath, JSON.stringify(candidate, null, 2));
fs.writeFileSync(legacyPath, JSON.stringify(legacy, null, 2) + (legacyRaw.endsWith("\n") ? "\n" : ""));
fs.writeFileSync(path.join(pkgDir, "near_miss_resolution_report_regionals.json"), JSON.stringify(report, null, 2));

console.log("Ansberry:", JSON.stringify(report.ansberry, null, 1));
for (const e of report.legacy) console.log(`[${e.group}] ${e.team} (${e.region}) ${e.rosterName}: ${e.oldSeasonBest} -> ${e.regionalTime} ${e.applied ? "APPLIED" : "not applied (slower)"}${e.renamedTo ? `, renamed to "${e.renamedTo}"` : ""}`);
console.log("Wrote near_miss_resolution_report_regionals.json");
