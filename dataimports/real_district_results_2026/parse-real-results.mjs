// Parses the raw pasted ChatGPT-browser district result text files in this
// directory into one structured JSON file. Pure text -> structured data;
// no scoring, no qualifier logic, no site-key mapping guesses beyond the
// explicit table below (taken directly from dataimports/district_meets_2026.json).
//
// Run: node dataimports/real_district_results_2026/parse-real-results.mjs

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));

// Exact mapping from the "MEET: X District" line to the site key used in
// dataimports/district_meets_2026.json -- never guessed/fuzzy-matched.
const MEET_NAME_TO_SITE_KEY = {
  "Hilliard Darby District": "HD",
  "Cambridge District": "CAM",
  "GlenOak District": "GO",
  "Lorain CCC District": "LCCC",
  "Madison District": "MAD",
  "Amman's Park District": "GAL",
  "Columbus Grove District": "CG",
  "Leaders Farms District": "LF",
  "Owens CC District": "OW",
  "Rio Grande District": "RG",
  "Cedarville District": "CED",
  "Voice of America District": "VOA"
};

const ROMAN_TO_DIVISION = { I: 1, II: 2, III: 3, IV: 4 };

function parseCsvLine(line) {
  // Minimal CSV: handles one double-quoted field (scorer_places) that may
  // contain commas; every other field here is plain (no embedded commas,
  // no escaped quotes) so a full CSV parser isn't needed.
  const fields = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      const end = line.indexOf('"', i + 1);
      fields.push(line.slice(i + 1, end));
      i = end + 2; // skip closing quote + following comma
    } else {
      const next = line.indexOf(",", i);
      if (next === -1) {
        fields.push(line.slice(i));
        i = line.length;
      } else {
        fields.push(line.slice(i, next));
        i = next + 1;
      }
    }
  }
  return fields;
}

function parseRaceLabel(raceLine) {
  // e.g. "Boys Division IV Session 1" / "Girls Division II" (no session).
  const match = raceLine.match(/^(Boys|Girls)\s+Division\s+(I{1,3}|IV)(?:\s+Session\s+(\d+))?$/);
  if (!match) throw new Error(`Unrecognized RACE line: "${raceLine}"`);
  const [, genderWord, romanDivision, session] = match;
  return {
    gender: genderWord.toLowerCase(),
    division: ROMAN_TO_DIVISION[romanDivision],
    session: session ? Number(session) : 1
  };
}

function parseBlock(block) {
  const lines = block.split("\n").map((l) => l.trimEnd()).filter((l) => l.length > 0);
  let idx = 0;
  function expectLabel(label) {
    const line = lines[idx];
    if (!line.startsWith(label)) throw new Error(`Expected line starting with "${label}", got "${line}"`);
    idx += 1;
    return line.slice(label.length).trim();
  }

  const meetName = expectLabel("MEET:");
  const date = expectLabel("DATE:");
  const raceLine = expectLabel("RACE:");
  const { gender, division, session } = parseRaceLabel(raceLine);

  if (lines[idx] !== "TEAM_SCORES") throw new Error(`Expected TEAM_SCORES, got "${lines[idx]}"`);
  idx += 1;
  const teamScoresHeader = parseCsvLine(lines[idx]);
  idx += 1;
  const teamScores = [];
  while (lines[idx] !== "INDIVIDUAL_RESULTS") {
    const fields = parseCsvLine(lines[idx]);
    const row = {};
    teamScoresHeader.forEach((h, i) => { row[h] = fields[i]; });
    teamScores.push({
      place: row.place ? Number(row.place) : null,
      school: row.school,
      score: row.score === "" || row.score == null ? null : Number(row.score),
      scorerPlaces: row.scorer_places ? row.scorer_places.split(",").map((p) => Number(p.trim())) : []
    });
    idx += 1;
  }

  idx += 1; // skip INDIVIDUAL_RESULTS label
  const individualHeader = parseCsvLine(lines[idx]);
  idx += 1;
  const individualResults = [];
  while (idx < lines.length) {
    const fields = parseCsvLine(lines[idx]);
    const row = {};
    individualHeader.forEach((h, i) => { row[h] = fields[i]; });
    individualResults.push({
      place: row.place === "" || row.place == null ? null : Number(row.place),
      name: row.name,
      grade: row.grade,
      school: row.school,
      time: row.time
    });
    idx += 1;
  }

  const siteKey = MEET_NAME_TO_SITE_KEY[meetName];
  if (!siteKey) throw new Error(`No site-key mapping for meet name "${meetName}" -- add it to MEET_NAME_TO_SITE_KEY.`);

  return { siteKey, meetName, date, gender, division, session, teamScores, individualResults };
}

function parseFile(filePath) {
  const text = readFileSync(filePath, "utf8");
  const blocks = text.split(/\n\s*\n(?=MEET:)/).map((b) => b.trim()).filter(Boolean);
  return blocks.map(parseBlock);
}

const files = readdirSync(DIR).filter((f) => f.endsWith(".txt"));
const races = [];
for (const file of files) {
  const parsed = parseFile(join(DIR, file));
  races.push(...parsed);
}

races.sort((a, b) => {
  if (a.siteKey !== b.siteKey) return a.siteKey.localeCompare(b.siteKey);
  if (a.gender !== b.gender) return a.gender.localeCompare(b.gender);
  if (a.division !== b.division) return a.division - b.division;
  return a.session - b.session;
});

const output = {
  generatedAt: new Date().toISOString(),
  meetDate: "2026-10-24",
  source: "ChatGPT browser-tool retrieval from athletic.net district meet result pages, pasted in by the user; parsed verbatim with no invented values.",
  raceCount: races.length,
  races
};

const outPath = join(DIR, "real_district_results_2026_parsed.json");
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`Parsed ${races.length} races from ${files.length} files -> ${outPath}`);
