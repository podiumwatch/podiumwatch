// Parses dataimports/Ohio_XC_Regionals_2026_All_Results.xlsx (Zachary's
// workbook of the real Oct 31, 2026 OHSAA regional results, pulled race by
// race from Athletic.net and re-checked at 7:00 PM ET) into one structured
// JSON file. Pure spreadsheet -> structured data: no scoring, no
// qualifier logic, nothing recomputed. Every name, time, place, score and
// qualifier mark is copied as given.
//
// Mirrors dataimports/real_district_results_2026/parse-real-results.mjs
// (the district stage), with one workbook instead of pasted text files.
//
// Run: node dataimports/real_regional_results_2026/parse-regional-results.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readWorkbook, sheetRecords } from "./read-xlsx.mjs";

const pkgDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(pkgDir, "../..");
const workbookPath = path.join(root, "dataimports/Ohio_XC_Regionals_2026_All_Results.xlsx");

// Region label -> the site key src/data/mock-regionals-2026.json and the
// Mock Postseason hub already use. Never fuzzy-matched.
const REGION_KEY = { Central: "central", Northeast: "northeast", Northwest: "northwest", Southwest: "southwest" };
const SITE_TO_MEET_ID = { Pickerington: 287237, Boardman: 287234, Tiffin: 287247, Troy: 287241 };

const workbook = readWorkbook(workbookPath);
const sheet = (name) => {
  const found = workbook.sheets.find((s) => s.name === name);
  if (!found) throw new Error(`Workbook has no "${name}" sheet.`);
  return found;
};

const allResults = sheetRecords(sheet("All Results"));
const teamScores = sheetRecords(sheet("Team Scores"));
const abbreviations = sheetRecords(sheet("Abbreviations")).map((a) => ({ listed: a["As listed on Athletic.net"], full: a["Full school name used"] }));

// Read Me's per-race table: the rows after the "Race" marker line.
const readMeRows = sheet("Read Me").rows;
const raceHeaderIndex = readMeRows.findIndex((r) => r[0] === "Division" && r[1] === "Gender");
if (raceHeaderIndex === -1) throw new Error("Read Me sheet has no per-race table (Division | Gender | ...).");
const readMeHeader = readMeRows[raceHeaderIndex].map((h) => String(h ?? "").trim());
const readMeRaces = readMeRows.slice(raceHeaderIndex + 1)
  .filter((r) => /^D[1-4]$/.test(String(r[0] ?? "")))
  .map((r) => { const rec = {}; readMeHeader.forEach((h, i) => { rec[h] = r[i] ?? ""; }); return rec; });

// Existing site data: site names + advancement counts per region, so the
// workbook's own numbers can be checked against what the site already
// publishes (verify-regional-results.mjs does the comparison).
const existingRegionals = JSON.parse(fs.readFileSync(path.join(root, "src/data/mock-regionals-2026.json"), "utf8"));
function existingRegion(gender, division, regionKey) {
  const entry = existingRegionals.divisions.find((d) => d.gender.toLowerCase() === gender && d.division === division);
  return entry ? entry.regions[regionKey] : null;
}

const num = (value) => (value === "" || value == null ? null : Number(value));
const raceKey = (r) => `${r.Division}|${r.Gender}|${r.Region}`;

const races = new Map();
for (const row of allResults) {
  const key = raceKey(row);
  if (!races.has(key)) {
    const division = Number(String(row.Division).replace(/^D/, ""));
    const gender = String(row.Gender).toLowerCase();
    const regionKey = REGION_KEY[row.Region];
    if (!regionKey) throw new Error(`Unknown region "${row.Region}" in All Results row for ${row.Athlete}.`);
    const meta = readMeRaces.find((m) => m.Division === row.Division && m.Gender === row.Gender && m.Region === row.Region);
    if (!meta) throw new Error(`Read Me has no race row for ${key}.`);
    const existing = existingRegion(gender, division, regionKey);
    races.set(key, {
      gender, division, regionKey, region: row.Region, site: row.Site,
      siteName: existing ? existing.siteName : row.Site,
      meetId: SITE_TO_MEET_ID[row.Site] ?? null,
      raceId: num(meta["Athletic.net race id"]),
      finishersListed: num(meta["Finishers listed"]),
      teamsScored: num(meta["Teams scored"]),
      teamsToState: num(meta["Teams to state"]),
      individualsToState: num(meta["Individuals to state"]),
      siteTeamsToState: existing ? existing.stateQualifiers : null,
      siteIndividualsToState: existing ? existing.individualQualifiers : null,
      teamScores: [],
      results: []
    });
  }
  const seconds = row.Seconds === "" ? null : Number(row.Seconds);
  const dnf = seconds == null;
  races.get(key).results.push({
    place: dnf ? null : Number(row["Regional Place"]),
    name: row.Athlete,
    grade: row.Grade || null,
    school: row["School (as listed)"],
    schoolFull: row.School,
    time: row.Time,
    seconds,
    timeCentiseconds: dnf ? null : Math.round(seconds * 100),
    stateQualifier: row["State Qualifier"] || null,
    athleticNetId: row["Athletic.net ID"] || null,
    dnf
  });
}

for (const row of teamScores) {
  const race = races.get(raceKey(row));
  if (!race) throw new Error(`Team Scores row for ${raceKey(row)} (${row.School}) has no matching All Results race.`);
  race.teamScores.push({
    place: Number(row["Team Place"]),
    school: row["School (as listed)"],
    schoolFull: row.School,
    points: Number(row.Points),
    advanced: row["Advanced to State"] === "Yes"
  });
}

const ordered = [...races.values()].sort((a, b) => a.division - b.division || a.gender.localeCompare(b.gender) || a.regionKey.localeCompare(b.regionKey));
for (const race of ordered) race.teamScores.sort((a, b) => a.place - b.place);

const output = {
  generatedAt: new Date().toISOString(),
  meetDate: "2026-10-31",
  asOf: "2026-10-31",
  asOfLabel: "Oct 31, 2026, 7:00 PM ET",
  source: "Athletic.net official results for the four OHSAA regionals on Oct 31, 2026 (Central at Pickerington 287237, Northeast at Boardman 287234, Northwest at Tiffin 287247, Southwest at Troy 287241), compiled by Zachary in dataimports/Ohio_XC_Regionals_2026_All_Results.xlsx; every race re-checked against Athletic.net at 7:00 PM ET. Parsed verbatim, nothing recomputed.",
  workbookNotes: [
    "Troy D1 Boys: Gabe Potts (Wayne) is listed DNF with no place and no time; kept with dnf: true.",
    "Tiffin D4 Boys, 239th: Athletic.net corrected \"Max Pursell\" (no grade) to \"Max Parsell\" (11, Mohawk) after the race; the workbook carries the corrected name and no Athletic.net ID.",
    "Team ties were decided by Athletic.net's official team places (sixth-runner tiebreak): Pickerington D1 Girls, Hilliard Davidson and Gahanna Lincoln at 136; Boardman D2 Boys, Shaker Heights and Hoover at 265; Boardman D3 Girls, Marlington and Crestwood at 127.",
    "\"Cal. River Valley\" is River Valley (Caledonia); \"Bid. River Valley\" is River Valley (Bidwell).",
    "Perrysburg (Northwest) ran the D1 regional at Boardman; Tiffin had no D1 race."
  ],
  raceCount: ordered.length,
  abbreviations,
  races: ordered
};

const outPath = path.join(pkgDir, "real_regional_results_2026_parsed.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`Parsed ${ordered.length} races, ${allResults.length} result rows, ${teamScores.length} team-score rows -> ${outPath}`);
