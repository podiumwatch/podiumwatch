// Fills real Northeast district qualifier numbers (OHSAA, dated
// 2026-10-20, from the 8 PDFs the user provided -- see
// dataimports/ohio_2026_xc_Claude_Code/ohsaa_source_pdfs/northeast/)
// into dataimports/district_meets_2026.json's GO/LCCC/MAD races. These
// were null before (status "qualifier_numbers_pending" throughout the
// whole chain); this is the one concrete fix that unblocks Northeast
// everywhere downstream.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dataPath = path.join(root, "dataimports/district_meets_2026.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

// [site][gender][division] -> [teams_advance, individuals_advance]
const NUMBERS = {
  GO: {
    girls: { 2: [13, 26], 3: [10, 20], 4: [6, 12] },
    boys: { 2: [14, 28], 3: [9, 18], 4: [6, 12] }
  },
  LCCC: {
    girls: { 2: [13, 26], 3: [10, 20], 4: [8, 16] },
    boys: { 2: [11, 22], 3: [7, 14], 4: [8, 16] }
  },
  MAD: {
    girls: { 2: [11, 22], 3: [12, 24], 4: [8, 16] },
    boys: { 2: [13, 26], 3: [10, 20], 4: [7, 14] }
  }
};

let filled = 0;
for (const race of data.races) {
  const siteNumbers = NUMBERS[race.site];
  if (!siteNumbers) continue;
  const pair = siteNumbers[race.gender]?.[race.division];
  if (!pair) continue;
  race.teams_advance = pair[0];
  race.individuals_advance = pair[1];
  filled++;
}

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
console.log(`Filled ${filled} races (expected 18: 3 sites x 6 gender/division combos).`);
