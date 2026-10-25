// Cross-checks the recomputed (from times) team scores/qualifiers in
// postseason_chain_output_real.json against the REAL district's own
// posted TEAM_SCORES (real_district_results_2026_parsed.json), and
// checks qualifyingTeams.length matches teams_advance. Read-only report.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = path.dirname(fileURLToPath(import.meta.url));
const parsed = JSON.parse(fs.readFileSync(path.join(pkgDir, "real_district_results_2026_parsed.json"), "utf8"));
const chain = JSON.parse(fs.readFileSync(path.join(pkgDir, "postseason_chain_output_real.json"), "utf8"));

let mismatches = 0;
let checked = 0;

function sessionsFor(siteKey, gender, division) {
  return parsed.races.filter((r) => r.siteKey === siteKey && r.gender === gender && r.division === division).length;
}

for (const dr of chain.districtResults) {
  const multi = sessionsFor(dr.site, dr.gender, dr.division) > 1;
  const session = multi ? (dr.raceLabel === "Race 1" ? 1 : Number(dr.raceLabel.replace("Race ", ""))) : 1;
  const raw = parsed.races.find((r) => r.siteKey === dr.site && r.gender === dr.gender && r.division === dr.division && r.session === session);
  if (!raw) { console.log(`NO RAW MATCH for ${dr.site} ${dr.gender} D${dr.division} ${dr.raceLabel}`); continue; }

  const rawByName = new Map(raw.teamScores.map((t) => [t.school, t]));
  for (const scored of dr.scoredTeams) {
    if (!scored.complete) continue;
    checked += 1;
    const rawTeam = rawByName.get(scored.name);
    if (!rawTeam) {
      console.log(`MISMATCH [${dr.site} ${dr.gender} D${dr.division} ${dr.raceLabel}] "${scored.name}" scored complete (${scored.score}) but has no raw TEAM_SCORES row (not in real scoring table).`);
      mismatches += 1;
      continue;
    }
    if (rawTeam.score !== scored.score) {
      console.log(`MISMATCH [${dr.site} ${dr.gender} D${dr.division} ${dr.raceLabel}] "${scored.name}": recomputed ${scored.score} vs real posted ${rawTeam.score}`);
      mismatches += 1;
    }
  }
  // Every raw scoring team should also come back complete in our recompute.
  const scoredByName = new Map(dr.scoredTeams.map((t) => [t.name, t]));
  for (const rawTeam of raw.teamScores) {
    const scored = scoredByName.get(rawTeam.school);
    if (!scored || !scored.complete) {
      console.log(`MISMATCH [${dr.site} ${dr.gender} D${dr.division} ${dr.raceLabel}] "${rawTeam.school}" has a real posted score (${rawTeam.score}) but recompute marks it incomplete/missing.`);
      mismatches += 1;
    }
  }

  // teams_advance sanity: qualifyingTeams.length should equal teams_advance
  // (or be less only if fewer than teams_advance complete teams existed).
  const completeCount = dr.scoredTeams.filter((t) => t.complete).length;
  const expectedQualifiers = Math.min(dr.teamsAdvance, completeCount);
  if (dr.qualifyingTeams.length !== expectedQualifiers) {
    console.log(`MISMATCH [${dr.site} ${dr.gender} D${dr.division} ${dr.raceLabel}] qualifyingTeams.length=${dr.qualifyingTeams.length}, expected ${expectedQualifiers} (teamsAdvance=${dr.teamsAdvance}, complete=${completeCount})`);
    mismatches += 1;
  }
}

console.log(`\nChecked ${checked} complete-team score comparisons across ${chain.districtResults.length} races.`);
console.log(mismatches === 0 ? "ALL CLEAR -- every recomputed score matches the real posted score, every qualifier count matches teams_advance." : `${mismatches} MISMATCH(ES) FOUND -- see above.`);
