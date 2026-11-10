// One-off generator for the 2026 Athlete/Team/Coach of the Year nominee pool
// (public/data/yearly-awards-2026-pool.json). Not part of the build.
//
//   node --env-file=.env.local scripts/build-yearly-awards-2026-pool.mjs <ohio-schools.json>
//
// <ohio-schools.json> is a saved response from /api/ohio-schools/?limit=600
// (read-only), used to match each state-qualifying team to its ohio_schools
// row. Sources, all real:
// - Athletes and teams: the 2026 state field in
//   src/data/mock-postseason-2026-real.json (1,647 qualifiers, 192 teams),
//   gender and division from the race key.
// - Regional place, time, team place and score: the official Oct. 31
//   regional results, dataimports/real_regional_results_2026/
//   real_regional_results_2026_parsed.json (read only). Nothing is computed
//   from times; a missing official value stays null.
// ohio_schools official names carry no city, so overrides are matched on
// "<official name> (<city>)".
import fs from "node:fs";
import path from "node:path";
import { loadSeasonDivisions } from "../lib/season_divisions.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const schoolsFile = process.argv[2];
if (!schoolsFile) throw new Error("Pass the saved /api/ohio-schools/ response as the first argument.");

const field = JSON.parse(fs.readFileSync(path.join(root, "src/data/mock-postseason-2026-real.json"), "utf8"));
const regionals = JSON.parse(fs.readFileSync(path.join(root, "dataimports/real_regional_results_2026/real_regional_results_2026_parsed.json"), "utf8"));
const schools = JSON.parse(fs.readFileSync(schoolsFile, "utf8")).schools;

const ROMAN = { 1: "I", 2: "II", 3: "III", 4: "IV" };

// Display-name fixes Zachary confirmed (2026-11-08), by Athletic.net ID.
const NAME_OVERRIDES = {
  "31994896": "Charlee Skeen", // Charlee Skeen-Adrine (Hudson)
  "23888567": "Cara Bornhorst", // listed as "Cara Bornhornst" (Minster)
  "30937049": "Samuel Phlipot", // listed as "Samuel Philpot" (Russia)
  "29447416": "Lily Kiser" // Lillian (Lily) Kiser (Fremont Ross)
};

// State teams whose regional name doesn't match an ohio_schools name on
// its own, mapped to the OHSAA "Name (City)" record by hand.
const SCHOOL_OVERRIDES = {
  "Mass. Jackson": "Jackson (Massillon)",
  "Perrysburg": "Perrysburg High School (Perrysburg)",
  "Tol. St. Francis": "St. Francis de Sales (Toledo)",
  "Watterson": "Bishop Watterson (Columbus)",
  "Mass. Perry": "Perry (Massillon)",
  "Col. DeSales": "St. Francis DeSALES (Columbus)",
  "CVCA": "Cuyahoga Valley Christian Academy (Cuyahoga Falls)",
  "Uniont. Lake": "Lake (Uniontown)",
  "Carroll": "Archbishop Carroll (Dayton)",
  "CF Northwest": "Northwest (Canal Fulton)",
  "Akron SVSM": "St. Vincent-St Mary (Akron)",
  "Legacy Christian": "Legacy Christian Academy (Xenia)",
  "Con. Crestview": "Crestview (Convoy)",
  "Sher. Fairview": "Fairview (Sherwood)",
  "Lake Center Chr.": "Lake Center Christian School (Hartville)",
  "Rac. Southern": "Southern (Racine)",
  "Kid. Cent. Christian": "Central Christian (Kidron)",
  "Ash. St. John": "St. John School (Ashtabula)",
  "Mil. Edison": "Edison (Milan)"
};

const norm = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const slugify = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const romanDivision = (value) => ({ "Division I": 1, "Division II": 2, "Division III": 3, "Division IV": 4 })[value] || null;

const schoolsByName = new Map();
const schoolsByOfficial = new Map();
for (const school of schools) {
  for (const name of new Set([school.school_name, school.official_school_name.replace(/\s*\([^)]*\)\s*$/, "")])) {
    const list = schoolsByName.get(norm(name)) || [];
    if (!list.some((item) => item.id === school.id)) list.push(school);
    schoolsByName.set(norm(name), list);
  }
  schoolsByOfficial.set(`${school.official_school_name} (${school.city})`.toLowerCase(), school);
}

function matchSchool(shortName, fullName, division) {
  if (SCHOOL_OVERRIDES[shortName]) return { school: schoolsByOfficial.get(SCHOOL_OVERRIDES[shortName].toLowerCase()) || null, how: "override" };
  let hits = schoolsByName.get(norm(fullName)) || schoolsByName.get(norm(shortName)) || [];
  if (hits.length > 1) hits = hits.filter((school) => romanDivision(school.division) === division);
  return hits.length === 1 ? { school: hits[0], how: "name" } : { school: null, how: hits.length ? "ambiguous" : "none" };
}

const flags = { athletesMissingGenderOrDivision: [], teamsUnmatched: [], teamsMissingRegionalRow: [], athletesMissingRegionalRow: [], notes: [] };
const categories = [];
const athletes = {};
const teams = {};
const seen = new Set();

for (const [key, race] of Object.entries(field.stateResults)) {
  const [gender, divisionText] = key.split("_D");
  const division = Number(divisionText);
  const races = regionals.races.filter((item) => item.gender === gender && item.division === division);
  const resultById = new Map();
  for (const item of races) for (const row of item.results) if (row.athleticNetId) resultById.set(String(row.athleticNetId), { row, race: item });

  const athleteSlug = `athlete-${gender}-d${division}`;
  const teamSlug = `team-${gender}-d${division}`;
  const label = `${gender === "boys" ? "Boys" : "Girls"} Division ${ROMAN[division]}`;
  categories.push({ slug: athleteSlug, award: "athlete", gender, division, label: `${label} Athlete of the Year` });
  categories.push({ slug: teamSlug, award: "team", gender, division, label: `${label} Team of the Year` });

  const pool = [];
  const runners = [...race.teams.flatMap((team) => team.runners.map((runner) => ({ ...runner, team: team.name }))), ...race.individuals.map((runner) => ({ ...runner, team: runner.originalTeam }))];
  for (const runner of runners) {
    const id = String(runner.athleticNetId || "");
    if (!id || !gender || !division) { flags.athletesMissingGenderOrDivision.push(`${key} ${runner.name}`); continue; }
    if (seen.has(id)) { flags.notes.push(`Duplicate Athletic.net ID ${id} (${runner.name}) skipped`); continue; }
    seen.add(id);
    const official = resultById.get(id);
    if (!official) flags.athletesMissingRegionalRow.push(`${key} ${runner.name} (${id})`);
    pool.push({
      id,
      name: NAME_OVERRIDES[id] || runner.name,
      school: official?.row.schoolFull || runner.team,
      grade: runner.grade || null,
      seasonBest: runner.seasonBest || null,
      regionalPlace: official?.row.place ?? null,
      regionalTime: official?.row.time || null,
      regional: official?.race.site || null,
      qualifier: runner.qualifierMark === "Individual" || !race.teams.some((team) => team.name === runner.team) ? "individual" : "team"
    });
  }
  athletes[athleteSlug] = pool.sort((a, b) => a.name.localeCompare(b.name));

  teams[teamSlug] = race.teams.map((team) => {
    let score = null;
    for (const item of races) {
      const row = item.teamScores.find((entry) => entry.school === team.name && entry.advanced);
      if (row) { score = { row, race: item }; break; }
    }
    if (!score) flags.teamsMissingRegionalRow.push(`${key} ${team.name}`);
    const fullName = score?.row.schoolFull || team.name;
    const { school, how } = matchSchool(team.name, fullName, division);
    if (!school) flags.teamsUnmatched.push(`${key} ${team.name} (${fullName}): ${how}`);
    return {
      id: school ? school.id : `unmatched-${slugify(fullName)}`,
      schoolId: school?.id || null,
      name: fullName,
      regionalPlace: score?.row.place ?? null,
      regionalScore: score?.row.points ?? null,
      regional: score?.race.site || null
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

// Coach of the Year: open to every Ohio school, not just state teams.
// Each program (boys and girls separately) is filed in the division that
// team actually ran in 2026: its district, regional or state race
// (lib/season_divisions.mjs). Last year's division only when the team has
// no 2026 postseason result; the school's listed division last of all.
// Zachary's rule (2026-11-10), after Dublin Scioto girls (Division I in
// 2026) had been filed by the boys division. The coach's name is typed by
// the nominator, since Podium Watch doesn't have every coach.
const coaches = {};
const seasonDivisions = await loadSeasonDivisions(2026);
const girlsStateDivision = new Map();
for (const [slug, list] of Object.entries(teams)) {
  if (!slug.startsWith("team-girls-")) continue;
  for (const team of list) if (team.schoolId) girlsStateDivision.set(team.schoolId, Number(slug.slice(-1)));
}
const nameCounts = new Map();
for (const school of schools) nameCounts.set(norm(school.school_name), (nameCounts.get(norm(school.school_name)) || 0) + 1);
for (const gender of ["boys", "girls"]) {
  for (const division of [1, 2, 3, 4]) {
    const slug = `coach-${gender}-d${division}`;
    categories.push({ slug, award: "coach", gender, division, label: `${gender === "boys" ? "Boys" : "Girls"} Division ${ROMAN[division]} Coach of the Year` });
    coaches[slug] = [];
  }
}
for (const school of schools) {
  const listed = romanDivision(school.division);
  const boysRan = seasonDivisions.get(school.id, "boys");
  const girlsRan = seasonDivisions.get(school.id, "girls");
  const boysDivision = boysRan?.division || listed;
  if (!boysDivision) { flags.notes.push(`No division for ${school.school_name} (${school.city}); left out of Coach of the Year`); continue; }
  const girlsDivision = girlsStateDivision.get(school.id) || girlsRan?.division || boysDivision;
  for (const [side, ran] of [["boys", boysRan], ["girls", girlsRan]]) if (ran && ran.basis !== "2026") flags.notes.push(`${side} coach: ${school.school_name} (${school.city}) has no 2026 postseason result; filed by ${ran.basis === "last_year" ? "last year's" : "its listed"} division`);
  const entry = { id: school.id, schoolId: school.id, name: nameCounts.get(norm(school.school_name)) > 1 ? `${school.school_name} (${school.city})` : school.school_name, city: school.city || null };
  coaches[`coach-boys-d${boysDivision}`].push(entry);
  coaches[`coach-girls-d${girlsDivision}`].push(entry);
  if (girlsDivision !== boysDivision) flags.notes.push(`Girls coach: ${school.school_name} filed in Division ${ROMAN[girlsDivision]} (2026 state meet), boys in Division ${ROMAN[boysDivision]}`);
}
for (const list of Object.values(coaches)) list.sort((a, b) => a.name.localeCompare(b.name));

for (const id of Object.keys(NAME_OVERRIDES)) if (!seen.has(id)) flags.notes.push(`Name override ${id} matched no qualifier`);
flags.notes.push("Spitzer (Versailles): only Tony Spitzer (23658795) is in the 2026 state field; no Anthony Spitzer entry exists to merge.");

const out = { generatedAt: new Date().toISOString(), source: "2026 state field (mock-postseason-2026-real.json) with official Oct. 31 regional results", categories, athletes, teams, coaches, flags };
fs.writeFileSync(path.join(root, "public/data/yearly-awards-2026-pool.json"), JSON.stringify(out, null, 1) + "\n");
console.log("athletes", Object.values(athletes).reduce((n, list) => n + list.length, 0), "teams", Object.values(teams).reduce((n, list) => n + list.length, 0), "coach programs", Object.values(coaches).reduce((n, list) => n + list.length, 0));
console.log(JSON.stringify(flags, null, 2));
