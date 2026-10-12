// General-purpose version of backfill-grade-d4.mjs: restores grade and
// graduation year for any runner who already had one in the last-pushed
// committed version of mock-regionals-2026.json, matched by team + name,
// for one division. Anyone with no prior grade on record is deliberately
// left blank rather than guessed.
// Usage: node backfill-grade-division.mjs <divisionId>
import fs from "node:fs";
import { execSync } from "node:child_process";

const divisionId = process.argv[2];
if (!divisionId) {
  console.error("Usage: node backfill-grade-division.mjs <divisionId>");
  process.exit(1);
}

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const path = "src/data/mock-regionals-2026.json";

const oldMock = JSON.parse(execSync(`git show HEAD:${path}`, { maxBuffer: 1024 * 1024 * 64 }).toString());
const oldEntry = oldMock.divisions.find((v) => v.id === divisionId);

const oldGradeByKey = new Map();
for (const region of Object.values(oldEntry.regions)) {
  for (const t of region.teams) {
    for (const r of t.runners) {
      if (r.grade == null) continue;
      oldGradeByKey.set(`${norm(t.name)}|${norm(r.name)}`, { grade: r.grade, graduationYear: r.graduationYear ?? null });
    }
  }
  for (const ind of region.individuals || []) {
    if (ind.grade == null) continue;
    oldGradeByKey.set(`${norm(ind.school)}|${norm(ind.name)}`, { grade: ind.grade, graduationYear: ind.graduationYear ?? null });
  }
}

const mock = JSON.parse(fs.readFileSync(path, "utf8"));
const entry = mock.divisions.find((v) => v.id === divisionId);

let filled = 0, total = 0;
for (const region of Object.values(entry.regions)) {
  for (const t of region.teams) {
    for (const r of t.runners) {
      total++;
      const hit = oldGradeByKey.get(`${norm(t.name)}|${norm(r.name)}`);
      if (hit) {
        r.grade = hit.grade;
        r.graduationYear = hit.graduationYear;
        filled++;
      }
    }
  }
}
fs.writeFileSync(path, JSON.stringify(mock, null, 2) + "\n");
console.log(`Backfilled grade for ${filled} of ${total} ${divisionId} runners (rest left blank, no match in prior data).`);
