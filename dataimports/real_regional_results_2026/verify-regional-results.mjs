// Fails loudly (exit 1) if real_regional_results_2026_parsed.json is off in
// any way the import brief (Oct 31, 2026) lists:
//   - per division/gender: race count, finishers, teams to State,
//     individuals to State (the fixed table below);
//   - every race re-scored from the finish order (count only runners whose
//     school is in that race's Team Scores, up to 7 per team, number them
//     1, 2, 3..., sum each team's first 5) matches the posted team score;
//   - every "Team" mark is on an advancing team, every "Individual" mark is
//     on a non-advancing school, advancing team places are 1..N;
//   - the workbook's advancement counts match what the site already
//     publishes per region (src/data/mock-regionals-2026.json);
//   - the three known team ties carry official places;
//   - exactly one DNF (Gabe Potts, Wayne) and one row with no Athletic.net
//     ID (Max Parsell, Mohawk).
// Read-only report; writes nothing.
//
// Run: node dataimports/real_regional_results_2026/verify-regional-results.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = path.dirname(fileURLToPath(import.meta.url));
const parsed = JSON.parse(fs.readFileSync(path.join(pkgDir, "real_regional_results_2026_parsed.json"), "utf8"));

const EXPECTED = {
  "boys|1": { races: 3, finishers: 565, teams: 20, individuals: 40 },
  "girls|1": { races: 3, finishers: 482, teams: 20, individuals: 40 },
  "boys|2": { races: 4, finishers: 850, teams: 24, individuals: 48 },
  "girls|2": { races: 4, finishers: 825, teams: 24, individuals: 48 },
  "boys|3": { races: 4, finishers: 831, teams: 24, individuals: 48 },
  "girls|3": { races: 4, finishers: 803, teams: 24, individuals: 48 },
  "boys|4": { races: 4, finishers: 823, teams: 24, individuals: 48 },
  "girls|4": { races: 4, finishers: 819, teams: 24, individuals: 48 }
};
const EXPECTED_TOTALS = { races: 30, rows: 5998, teams: 184, individuals: 368 };

const problems = [];
const fail = (message) => problems.push(message);

// 1. Counts table
const groups = new Map();
for (const race of parsed.races) {
  const key = `${race.gender}|${race.division}`;
  if (!groups.has(key)) groups.set(key, { races: 0, finishers: 0, teams: 0, individuals: 0 });
  const g = groups.get(key);
  g.races += 1;
  // The brief and the Read Me count every listed row, DNF included (Troy D1
  // boys lists 184 rows: 183 finishers plus Gabe Potts, DNF).
  g.finishers += race.results.length;
  g.teams += race.teamScores.filter((t) => t.advanced).length;
  g.individuals += race.results.filter((r) => r.stateQualifier === "Individual").length;
}
console.log("Division | Gender | Races | Finishers | Teams to state | Individuals to state");
for (const [key, expected] of Object.entries(EXPECTED)) {
  const got = groups.get(key) || { races: 0, finishers: 0, teams: 0, individuals: 0 };
  const ok = Object.keys(expected).every((k) => got[k] === expected[k]);
  const [gender, division] = key.split("|");
  console.log(`${ok ? "OK  " : "FAIL"} D${division} ${gender}: ${got.races}/${expected.races} | ${got.finishers}/${expected.finishers} | ${got.teams}/${expected.teams} | ${got.individuals}/${expected.individuals}`);
  if (!ok) fail(`Counts off for D${division} ${gender}: got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`);
}
const totalRows = parsed.races.reduce((n, r) => n + r.results.length, 0);
const totalTeams = [...groups.values()].reduce((n, g) => n + g.teams, 0);
const totalInd = [...groups.values()].reduce((n, g) => n + g.individuals, 0);
if (parsed.races.length !== EXPECTED_TOTALS.races) fail(`Expected ${EXPECTED_TOTALS.races} races, parsed ${parsed.races.length}.`);
if (totalRows !== EXPECTED_TOTALS.rows) fail(`Expected ${EXPECTED_TOTALS.rows} result rows, parsed ${totalRows}.`);
if (totalTeams !== EXPECTED_TOTALS.teams) fail(`Expected ${EXPECTED_TOTALS.teams} teams to State, found ${totalTeams}.`);
if (totalInd !== EXPECTED_TOTALS.individuals) fail(`Expected ${EXPECTED_TOTALS.individuals} individuals to State, found ${totalInd}.`);

// 2. Re-score every race from the finish order vs the posted team scores
let rescored = 0;
for (const race of parsed.races) {
  const label = `${race.site} D${race.division} ${race.gender}`;
  const scoring = new Map(race.teamScores.map((t) => [t.school, t]));
  if (scoring.size !== race.teamScores.length) fail(`${label}: duplicate school in Team Scores.`);
  const counted = new Map();
  const points = new Map();
  let n = 0;
  const finishers = race.results.filter((r) => !r.dnf).sort((a, b) => a.place - b.place);
  finishers.forEach((r, i) => { if (r.place !== i + 1) fail(`${label}: places not contiguous at ${r.name} (${r.place}, expected ${i + 1}).`); });
  for (let i = 1; i < finishers.length; i += 1) {
    if (finishers[i].timeCentiseconds < finishers[i - 1].timeCentiseconds) fail(`${label}: time order breaks at ${finishers[i].name} (${finishers[i].time} after ${finishers[i - 1].time}).`);
  }
  for (const r of finishers) {
    if (!scoring.has(r.school)) continue;
    const c = counted.get(r.school) || 0;
    if (c >= 7) continue;
    counted.set(r.school, c + 1);
    n += 1;
    if (c < 5) points.set(r.school, (points.get(r.school) || 0) + n);
  }
  for (const team of race.teamScores) {
    rescored += 1;
    if ((counted.get(team.school) || 0) < 5) fail(`${label}: ${team.school} is in Team Scores with only ${counted.get(team.school) || 0} finishers.`);
    if (points.get(team.school) !== team.points) fail(`${label}: ${team.school} re-scores to ${points.get(team.school)} but Team Scores says ${team.points}.`);
  }
  // Team places: 1..k, scores non-decreasing by place (ties allowed)
  race.teamScores.forEach((t, i) => { if (t.place !== i + 1) fail(`${label}: team places not contiguous at ${t.school} (${t.place}).`); });
  for (let i = 1; i < race.teamScores.length; i += 1) {
    if (race.teamScores[i].points < race.teamScores[i - 1].points) fail(`${label}: team score order breaks at ${race.teamScores[i].school}.`);
  }
  // 3. Qualifier marks
  const advancing = new Set(race.teamScores.filter((t) => t.advanced).map((t) => t.school));
  const advancingPlaces = race.teamScores.filter((t) => t.advanced).map((t) => t.place);
  if (advancingPlaces.length !== race.teamsToState) fail(`${label}: ${advancingPlaces.length} teams marked advanced, Read Me says ${race.teamsToState}.`);
  if (advancingPlaces.some((p, i) => p !== i + 1)) fail(`${label}: advancing teams are not places 1..${race.teamsToState}: ${advancingPlaces.join(",")}.`);
  const individuals = race.results.filter((r) => r.stateQualifier === "Individual");
  if (individuals.length !== race.individualsToState) fail(`${label}: ${individuals.length} runners marked Individual, Read Me says ${race.individualsToState}.`);
  for (const r of race.results) {
    if (r.stateQualifier === "Team" && !advancing.has(r.school)) fail(`${label}: ${r.name} (${r.school}) marked Team but school did not advance.`);
    if (r.stateQualifier === "Individual" && advancing.has(r.school)) fail(`${label}: ${r.name} (${r.school}) marked Individual but school advanced as a team.`);
    if (r.stateQualifier && !["Team", "Individual"].includes(r.stateQualifier)) fail(`${label}: unknown State Qualifier "${r.stateQualifier}" on ${r.name}.`);
    if (r.dnf && r.stateQualifier) fail(`${label}: DNF ${r.name} carries a qualifier mark.`);
  }
  if (race.results.length !== race.finishersListed) fail(`${label}: ${race.results.length} rows parsed, Read Me says ${race.finishersListed} listed.`);
  if (race.teamScores.length !== race.teamsScored) fail(`${label}: ${race.teamScores.length} scored teams parsed, Read Me says ${race.teamsScored}.`);
  // 4. Site's published advancement counts
  if (race.siteTeamsToState != null && race.siteTeamsToState !== race.teamsToState) fail(`${label}: workbook says ${race.teamsToState} teams to State, src/data/mock-regionals-2026.json says ${race.siteTeamsToState}.`);
  if (race.siteIndividualsToState != null && race.siteIndividualsToState !== race.individualsToState) fail(`${label}: workbook says ${race.individualsToState} individuals to State, src/data/mock-regionals-2026.json says ${race.siteIndividualsToState}.`);
}
console.log(`Re-scored ${rescored} team scores across ${parsed.races.length} races from the finish order.`);

// 5. Known ties with official places
const TIES = [
  { site: "Pickerington", division: 1, gender: "girls", points: 136, schools: ["Hil. Davidson", "Gah. Lincoln"] },
  { site: "Boardman", division: 2, gender: "boys", points: 265, schools: ["Shaker Hts.", "Hoover"] },
  { site: "Boardman", division: 3, gender: "girls", points: 127, schools: ["Marlington", "Crestwood"] }
];
for (const tie of TIES) {
  const race = parsed.races.find((r) => r.site === tie.site && r.division === tie.division && r.gender === tie.gender);
  const rows = race ? race.teamScores.filter((t) => t.points === tie.points) : [];
  const names = rows.map((t) => t.school);
  if (!tie.schools.every((s) => names.includes(s))) fail(`Tie check: ${tie.site} D${tie.division} ${tie.gender} at ${tie.points} expected ${tie.schools.join(" & ")}, found ${names.join(" & ")}.`);
  if (new Set(rows.map((t) => t.place)).size !== rows.length) fail(`Tie check: ${tie.site} D${tie.division} ${tie.gender} tied teams share a place.`);
  else console.log(`Tie OK: ${tie.site} D${tie.division} ${tie.gender} at ${tie.points}: ${rows.map((t) => `${t.school} ${t.place}${t.place === 1 ? "st" : t.place === 2 ? "nd" : t.place === 3 ? "rd" : "th"}`).join(", ")}`);
}

// 6. DNF / missing-ID rows and the River Valley pair
const dnf = parsed.races.flatMap((r) => r.results.filter((x) => x.dnf).map((x) => `${x.name} (${x.school}, ${r.site} D${r.division} ${r.gender})`));
if (dnf.length !== 1 || !dnf[0].startsWith("Gabe Potts (Wayne")) fail(`Expected exactly one DNF (Gabe Potts, Wayne); found: ${dnf.join("; ") || "none"}.`);
else console.log(`DNF OK: ${dnf[0]}`);
const noId = parsed.races.flatMap((r) => r.results.filter((x) => !x.athleticNetId).map((x) => `${x.name} (${x.school})`));
if (noId.length !== 1 || !noId[0].startsWith("Max Parsell")) fail(`Expected exactly one row with no Athletic.net ID (Max Parsell); found: ${noId.join("; ") || "none"}.`);
else console.log(`Missing-ID OK: ${noId[0]}`);
const ids = new Map();
for (const r of parsed.races) for (const x of r.results) if (x.athleticNetId) ids.set(x.athleticNetId, (ids.get(x.athleticNetId) || 0) + 1);
const dupIds = [...ids.entries()].filter(([, n]) => n > 1);
if (dupIds.length) fail(`Athletic.net IDs appear more than once: ${dupIds.map(([id]) => id).join(", ")}.`);
const rv = new Map(parsed.abbreviations.filter((a) => /River Valley/.test(a.listed)).map((a) => [a.listed, a.full]));
if (rv.get("Cal. River Valley") !== "River Valley (Caledonia)" || rv.get("Bid. River Valley") !== "River Valley (Bidwell)") fail(`River Valley abbreviations unexpected: ${JSON.stringify([...rv])}.`);
const grades = new Map();
for (const r of parsed.races) for (const x of r.results) grades.set(x.grade, (grades.get(x.grade) || 0) + 1);
console.log(`Grades: ${[...grades.entries()].map(([g, n]) => `${g}: ${n}`).join(", ")}`);
const srRows = parsed.races.flatMap((r) => r.results.filter((x) => x.grade === "Sr").map((x) => `${x.name} (${x.school})`));
if (srRows.length) console.log(`Grade kept as "Sr" (as given): ${srRows.join("; ")}`);

if (problems.length) {
  console.error(`\n${problems.length} PROBLEM(S):`);
  for (const p of problems) console.error(` - ${p}`);
  process.exit(1);
}
console.log("\nALL CLEAR -- every check in the brief passes.");
