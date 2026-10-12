// Rebuilds the Top 10 by grade/division lists for whichever gender/
// divisions have already been refreshed from DyeStat in
// mock-regionals-2026.json (boys-d1..d4 and girls-d1..d4), pooling every
// runner with a known grade from that division's teams + supplemental
// individuals, and taking the fastest 10 per grade.
//
// This deliberately replaces build-top10-combined.mjs's job for just
// these division keys: once mock-regionals-2026.json is the fresher,
// more current source for a division, there's no reason for the Top 10
// page to keep showing older times for the same teams.
import fs from "node:fs";

const DIVISIONS_TO_REBUILD = ["boys-d1", "boys-d2", "boys-d3", "boys-d4", "girls-d1", "girls-d2", "girls-d3", "girls-d4"];

const mock = JSON.parse(fs.readFileSync("src/data/mock-regionals-2026.json", "utf8"));
const byGrade = JSON.parse(fs.readFileSync("src/data/top10-by-grade-2026.json", "utf8"));

for (const divisionId of DIVISIONS_TO_REBUILD) {
  const entry = mock.divisions.find((v) => v.id === divisionId);
  if (!entry) continue;
  const resultKey = `${entry.gender}-${entry.division}`;

  const pool = [];
  for (const region of Object.values(entry.regions)) {
    for (const team of region.teams) {
      for (const r of team.runners) {
        if (r.grade == null) continue;
        pool.push({ name: r.name, school: team.name, grade: r.grade, time: r.seasonBest, cs: r.timeCentiseconds });
      }
    }
    for (const ind of region.individuals || []) {
      if (ind.grade == null) continue;
      pool.push({ name: ind.name, school: ind.school, grade: ind.grade, time: ind.seasonBest, cs: ind.timeCentiseconds });
    }
  }

  const byGradeLocal = {};
  for (const r of pool) (byGradeLocal[r.grade] ||= []).push(r);

  const lists = {};
  for (const grade of ["9", "10", "11", "12"]) {
    const rows = (byGradeLocal[grade] || []).sort((a, b) => a.cs - b.cs).slice(0, 10);
    lists[grade] = rows.map((r) => ({ name: r.name, school: r.school, grade: r.grade, time: r.time }));
  }

  byGrade.lists[resultKey] = lists;
  console.log(resultKey, "rebuilt from mock-regionals-2026.json:", Object.fromEntries(Object.entries(lists).map(([g, rows]) => [g, rows.length])));
}

byGrade.source = "Rebuilt directly from this site's own mock regional rosters (src/data/mock-regionals-2026.json), which are sourced from DyeStat/Athletic.net exports.";
fs.writeFileSync("src/data/top10-by-grade-2026.json", JSON.stringify(byGrade, null, 2) + "\n");
console.log("Wrote src/data/top10-by-grade-2026.json");
