// Cross-references every real Oct 24, 2026 district finisher against the
// season-best candidate roster (the file the ORIGINAL season-best Mock
// Postseason universe is built from) and updates a runner's seasonBest/
// timeCentiseconds when their real district time is a new PR (faster
// than whatever season-best was on file). Exact match only (team name +
// runner name, both strings as already used by both pipelines) -- never
// a fuzzy/nickname match, so a real near-miss (e.g. "Maxfield (Max)
// Kuhns" in real results vs "Max Kuhns" on the roster) is reported, not
// guessed. A real finisher who isn't one of the roster's top 7 (every
// team's JV/alternate runners) is simply not on the roster at all --
// expected, not a problem, not reported.
//
// Writes the updated candidate file in place (local dataimports artifact,
// never the live site) and a report of every change + every unmatched
// near-miss for review.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(pkgDir, "../..");
const candidatePath = path.join(root, "dataimports/ohio_2026_xc_Claude_Code/ohio_2026_xc_full_statewide_2026.json");

const candidate = JSON.parse(fs.readFileSync(candidatePath, "utf8"));
const parsed = JSON.parse(fs.readFileSync(path.join(pkgDir, "real_district_results_2026_parsed.json"), "utf8"));

function parseTimeToCentiseconds(timeStr) {
  const parts = timeStr.trim().split(":");
  let seconds = 0;
  for (const part of parts) seconds = seconds * 60 + Number.parseFloat(part);
  return Math.round(seconds * 100);
}
function formatCentiseconds(cs) {
  const totalTenths = Math.round(cs / 10);
  const minutes = Math.floor(totalTenths / 600);
  const seconds = (totalTenths % 600) / 10;
  return `${minutes}:${seconds.toFixed(1).padStart(4, "0")}`;
}

// Real results by "school|name" -> fastest real centiseconds + raw display time.
const realByKey = new Map();
for (const race of parsed.races) {
  for (const row of race.individualResults) {
    if (!row.time || /^(DNS|DNF)$/i.test(row.time)) continue;
    const key = `${row.school}|${row.name}`;
    const cs = parseTimeToCentiseconds(row.time);
    const existing = realByKey.get(key);
    if (!existing || cs < existing.cs) realByKey.set(key, { cs, display: row.time, site: race.siteKey, gender: race.gender, division: race.division });
  }
}

// Near-miss detection: same school, real name NOT an exact roster match,
// but shares the roster runner's LAST word (surname) -- surfaced as a
// "check this one" note, never auto-applied.
const realNamesBySchool = new Map();
for (const race of parsed.races) {
  for (const row of race.individualResults) {
    if (!realNamesBySchool.has(row.school)) realNamesBySchool.set(row.school, new Set());
    realNamesBySchool.get(row.school).add(row.name);
  }
}

const updates = [];
const possibleNearMisses = [];

for (const [catKey, cat] of Object.entries(candidate.categories)) {
  for (const team of cat.teams) {
    for (const runner of team.runners) {
      const key = `${team.name}|${runner.name}`;
      const real = realByKey.get(key);
      if (real) {
        if (real.cs < runner.timeCentiseconds) {
          const oldSeasonBest = runner.seasonBest;
          updates.push({
            category: catKey, team: team.name, runner: runner.name,
            oldSeasonBest, oldCs: runner.timeCentiseconds,
            newSeasonBest: real.display, newCs: real.cs,
            source: `${real.site} district, ${real.gender} D${real.division}, 2026-10-24`
          });
          runner.seasonBestSource = `real district result (${real.site}, 2026-10-24) -- updated from a prior seasonBest of ${oldSeasonBest}`;
          runner.seasonBest = real.display;
          runner.timeCentiseconds = real.cs;
        }
        continue;
      }
      // No exact match -- check for a same-school near-miss by surname.
      const realNames = realNamesBySchool.get(team.name);
      if (!realNames) continue;
      const surname = runner.name.trim().split(/\s+/).pop();
      for (const realName of realNames) {
        if (realName === runner.name) continue; // would have matched above
        if (realName.split(/\s+/).pop() === surname && !updates.some((u) => u.team === team.name && u.runner === runner.name)) {
          possibleNearMisses.push({ team: team.name, rosterName: runner.name, realName });
        }
      }
    }
  }
}

fs.writeFileSync(candidatePath, JSON.stringify(candidate, null, 2));

const dedupedNearMisses = [...new Map(possibleNearMisses.map((n) => [`${n.team}|${n.rosterName}|${n.realName}`, n])).values()];

console.log(`=== ${updates.length} PR update(s) applied (real district time faster than roster season-best) ===`);
for (const u of updates) {
  console.log(`[${u.category}] ${u.team} -- ${u.runner}: ${u.oldSeasonBest} -> ${u.newSeasonBest} (${u.source})`);
}
console.log(`\n=== ${dedupedNearMisses.length} possible near-miss(es) -- same school, surname matches, but full name differs (not auto-applied) ===`);
for (const n of dedupedNearMisses) {
  console.log(`${n.team}: roster has "${n.rosterName}", real results has "${n.realName}"`);
}

fs.writeFileSync(path.join(pkgDir, "pr_update_report.json"), JSON.stringify({ updates, possibleNearMisses: dedupedNearMisses }, null, 2));
console.log(`\nWrote ${candidatePath}`);
console.log(`Wrote pr_update_report.json`);
