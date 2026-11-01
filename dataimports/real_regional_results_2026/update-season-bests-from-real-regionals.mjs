// Applies new PRs from the real Oct 31, 2026 regional results to the two
// season-best datasets, the same way
// dataimports/real_district_results_2026/update-season-bests-from-real-districts.mjs
// did after districts:
//
//   1. dataimports/ohio_2026_xc_Claude_Code/ohio_2026_xc_full_statewide_2026.json
//      (the roster the season-best Mock Postseason universe at
//      /mock-postseason/ is chained from). Matched by Athletic.net ID
//      first (the roster carries IDs for nearly every runner), then by
//      exact gender + team name + runner name.
//   2. src/data/mock-regionals-2026.json (the legacy /mock-meets/ regional
//      and State pages). It carries no Athletic.net IDs, so matched by
//      exact gender + team name + runner name only.
//
// A runner's seasonBest/timeCentiseconds changes only when the regional
// time is FASTER than what is on file. Never a fuzzy or nickname match:
// a same-school, same-surname near-miss is reported for review, not
// applied. Runners in the results who are not on either roster are
// expected (full fields vs. top-7 rosters) and not reported. No runner is
// added or removed.
//
// Writes both files in place plus pr_update_report_regionals.json.
//
// Run: node dataimports/real_regional_results_2026/update-season-bests-from-real-regionals.mjs

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

// Real results by Athletic.net ID and by "gender|school|name".
const realById = new Map();
const realByKey = new Map();
const realNamesBySchool = new Map();
for (const race of parsed.races) {
  for (const row of race.results) {
    if (row.dnf) continue;
    const real = { cs: row.timeCentiseconds, display: row.time, site: race.site, gender: race.gender, division: race.division, name: row.name, school: row.school, athleticNetId: row.athleticNetId };
    if (row.athleticNetId) realById.set(row.athleticNetId, real);
    realByKey.set(`${race.gender}|${row.school}|${row.name}`, real);
    const schoolKey = `${race.gender}|${row.school}`;
    if (!realNamesBySchool.has(schoolKey)) realNamesBySchool.set(schoolKey, new Set());
    realNamesBySchool.get(schoolKey).add(row.name);
  }
}

const sourceLabel = (real) => `real regional result (${real.site}, ${real.gender} D${real.division}, 2026-10-31)`;

function applyToRunner({ dataset, category, team, runner, gender, nearMisses, updates, idMatches }) {
  let real = null;
  let matchedBy = null;
  if (runner.athleticNetId && realById.has(String(runner.athleticNetId))) {
    real = realById.get(String(runner.athleticNetId));
    matchedBy = "athleticNetId";
    idMatches.count += 1;
    if (real.name !== runner.name || real.school !== team) idMatches.nameDiffers.push({ dataset, team, rosterName: runner.name, realName: real.name, realSchool: real.school, athleticNetId: runner.athleticNetId });
  } else if (realByKey.has(`${gender}|${team}|${runner.name}`)) {
    real = realByKey.get(`${gender}|${team}|${runner.name}`);
    matchedBy = "name+school";
  }
  if (real) {
    if (real.cs < runner.timeCentiseconds) {
      updates.push({ dataset, category, team, runner: runner.name, matchedBy, oldSeasonBest: runner.seasonBest, oldCs: runner.timeCentiseconds, newSeasonBest: real.display, newCs: real.cs, source: sourceLabel(real) });
      if (dataset === "candidate") runner.seasonBestSource = `${sourceLabel(real)} -- updated from a prior seasonBest of ${runner.seasonBest}`;
      runner.seasonBest = real.display;
      runner.timeCentiseconds = real.cs;
    }
    return;
  }
  const realNames = realNamesBySchool.get(`${gender}|${team}`);
  if (!realNames) return;
  const surname = runner.name.trim().split(/\s+/).pop();
  for (const realName of realNames) {
    if (realName === runner.name) continue;
    if (realName.split(/\s+/).pop() === surname) nearMisses.push({ dataset, category, team, rosterName: runner.name, realName });
  }
}

const updates = [];
const nearMisses = [];
const idMatches = { count: 0, nameDiffers: [] };

// 1. Season-best Mock Postseason roster
for (const [catKey, cat] of Object.entries(candidate.categories)) {
  const gender = String(cat.gender || catKey.split("_")[0]).toLowerCase();
  for (const team of cat.teams) {
    for (const runner of team.runners) applyToRunner({ dataset: "candidate", category: catKey, team: team.name, runner, gender, nearMisses, updates, idMatches });
  }
}

// 2. Legacy /mock-meets/ data
for (const division of legacy.divisions) {
  const gender = String(division.gender).toLowerCase();
  const category = `${gender}_d${division.division}`;
  for (const region of Object.values(division.regions)) {
    for (const team of region.teams) {
      for (const runner of team.runners) applyToRunner({ dataset: "legacy", category, team: team.name, runner, gender, nearMisses, updates, idMatches });
    }
    for (const runner of region.individuals || []) applyToRunner({ dataset: "legacy", category, team: runner.school, runner, gender, nearMisses, updates, idMatches });
  }
}

const legacyUpdates = updates.filter((u) => u.dataset === "legacy");
if (legacyUpdates.length) legacy.lastUpdated = "2026-10-31";

fs.writeFileSync(candidatePath, JSON.stringify(candidate, null, 2));
fs.writeFileSync(legacyPath, JSON.stringify(legacy, null, 2) + (legacyRaw.endsWith("\n") ? "\n" : ""));

const dedupedNearMisses = [...new Map(nearMisses.map((n) => [`${n.dataset}|${n.team}|${n.rosterName}|${n.realName}`, n])).values()];
const candidateUpdates = updates.filter((u) => u.dataset === "candidate");

console.log(`=== Season-best Mock Postseason roster: ${candidateUpdates.length} PR update(s) (${idMatches.count} runners matched by Athletic.net ID) ===`);
for (const u of candidateUpdates) console.log(`[${u.category}] ${u.team} -- ${u.runner}: ${u.oldSeasonBest} -> ${u.newSeasonBest} (${u.matchedBy})`);
console.log(`\n=== Legacy /mock-meets/ data: ${legacyUpdates.length} PR update(s) ===`);
for (const u of legacyUpdates) console.log(`[${u.category}] ${u.team} -- ${u.runner}: ${u.oldSeasonBest} -> ${u.newSeasonBest}`);
console.log(`\n=== ${idMatches.nameDiffers.length} ID match(es) where the roster name or school differs from the result (applied by ID, listed for review) ===`);
for (const n of idMatches.nameDiffers) console.log(`[${n.dataset}] ${n.team}: roster "${n.rosterName}" vs result "${n.realName}" (${n.realSchool}), ID ${n.athleticNetId}`);
console.log(`\n=== ${dedupedNearMisses.length} possible near-miss(es) -- same school, surname matches, full name differs (NOT applied) ===`);
for (const n of dedupedNearMisses) console.log(`[${n.dataset}] ${n.team}: roster has "${n.rosterName}", result has "${n.realName}"`);

fs.writeFileSync(path.join(pkgDir, "pr_update_report_regionals.json"), JSON.stringify({ generatedAt: new Date().toISOString(), updates, idMatchesWithDifferentName: idMatches.nameDiffers, possibleNearMisses: dedupedNearMisses }, null, 2));
console.log(`\nWrote ${candidatePath}\nWrote ${legacyPath}\nWrote pr_update_report_regionals.json`);
