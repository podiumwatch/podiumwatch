// Direct test of what the user actually cares about: does our recomputed
// qualifying-team ORDER match the order you'd get by sorting the real
// district's own posted scores? (Not just "scores are close" -- RANK.)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = path.dirname(fileURLToPath(import.meta.url));
const parsed = JSON.parse(fs.readFileSync(path.join(pkgDir, "real_district_results_2026_parsed.json"), "utf8"));
const chain = JSON.parse(fs.readFileSync(path.join(pkgDir, "postseason_chain_output_real.json"), "utf8"));

let raceMismatches = 0;

function sessionsFor(siteKey, gender, division) {
  return parsed.races.filter((r) => r.siteKey === siteKey && r.gender === gender && r.division === division).length;
}

for (const dr of chain.districtResults) {
  const multi = sessionsFor(dr.site, dr.gender, dr.division) > 1;
  const session = multi ? Number(dr.raceLabel.replace("Race ", "")) : 1;
  const raw = parsed.races.find((r) => r.siteKey === dr.site && r.gender === dr.gender && r.division === dr.division && r.session === session);
  if (!raw) continue;

  // Real posted order, as the district's own TEAM_SCORES table already
  // ranked them (place column) -- the ground truth for "who actually
  // qualified," independent of our own scoring engine entirely.
  const rawOrder = [...raw.teamScores].sort((a, b) => a.place - b.place).map((t) => t.school);
  const rawQualifiers = rawOrder.slice(0, dr.teamsAdvance);

  const ourQualifiers = dr.qualifyingTeams.map((t) => t.name);

  const sameSet = rawQualifiers.length === ourQualifiers.length && rawQualifiers.every((n) => ourQualifiers.includes(n));
  const sameOrder = sameSet && rawQualifiers.every((n, i) => ourQualifiers[i] === n);

  if (!sameSet) {
    console.log(`QUALIFIER SET MISMATCH [${dr.site} ${dr.gender} D${dr.division} ${dr.raceLabel}]`);
    console.log(`  real:      ${rawQualifiers.join(", ")}`);
    console.log(`  recomputed: ${ourQualifiers.join(", ")}`);
    raceMismatches += 1;
  } else if (!sameOrder) {
    console.log(`QUALIFIER ORDER DIFFERS (same teams, different rank) [${dr.site} ${dr.gender} D${dr.division} ${dr.raceLabel}]`);
    console.log(`  real order:       ${rawQualifiers.join(", ")}`);
    console.log(`  recomputed order: ${ourQualifiers.join(", ")}`);
  }
}

console.log(`\n${raceMismatches === 0 ? "ALL CLEAR" : `${raceMismatches} RACE(S) WITH A DIFFERENT QUALIFYING TEAM SET`} across ${chain.districtResults.length} races.`);
