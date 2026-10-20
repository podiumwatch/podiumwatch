// Round 2 of confirmed duplicate-identity fixes (2026-10-20), after the
// user checked all three pairs directly on athletic.net and confirmed
// same school/same grade/split profiles. Each is a straight removal of
// the slower duplicate row -- no 8th runner exists in this package to
// promote into the vacated slot (same situation as Willard in round 1),
// so each team now correctly shows 6 known runners instead of 7.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(pkgDir, "ohio_2026_xc_full_statewide_2026.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

function findTeam(gender, division, name) {
  const cat = Object.values(data.categories).find((c) => c.gender === gender && c.division === division);
  const team = cat.teams.find((t) => t.name === name);
  if (!team) throw new Error(`No team "${name}" in ${gender} ${division}`);
  return team;
}

const merges = [
  { gender: "Boys", division: "D2", team: "Defiance", drop: "Beckett Meyers" },
  { gender: "Boys", division: "D2", team: "Mansfield Senior", drop: "Ezekiel McNamara" },
  { gender: "Girls", division: "D2", team: "Wooster", drop: "Kennedy Wolfe" }
];

for (const m of merges) {
  const team = findTeam(m.gender, m.division, m.team);
  const before = team.runners.map((r) => r.name);
  team.runners = team.runners.filter((r) => r.name !== m.drop);
  team.identityReview = false;
  console.log(`${m.team} ${m.gender} ${m.division}: before [${before.join(", ")}]`);
  console.log(`${m.team} ${m.gender} ${m.division}: after  [${team.runners.map((r) => r.name).join(", ")}]`);
}

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
console.log(`\nWrote ${dataPath}`);
