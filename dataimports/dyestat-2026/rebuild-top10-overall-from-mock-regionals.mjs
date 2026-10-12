// Same idea as rebuild-top10-from-mock-regionals.mjs, but for the
// "overall, regardless of division" Top 10 file: pools every graded
// runner across all four divisions per gender in mock-regionals-2026.json
// (now DyeStat/Athletic.net-sourced for both boys and girls) and takes
// the fastest 10 per grade.
import fs from "node:fs";

const mock = JSON.parse(fs.readFileSync("src/data/mock-regionals-2026.json", "utf8"));
const overall = JSON.parse(fs.readFileSync("src/data/top10-overall-by-grade-2026.json", "utf8"));

for (const gender of ["boys", "girls"]) {
  const pool = [];
  for (const entry of mock.divisions.filter((v) => v.gender === gender)) {
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
  }

  const byGrade = {};
  for (const r of pool) (byGrade[r.grade] ||= []).push(r);

  const lists = {};
  for (const grade of ["9", "10", "11", "12"]) {
    const rows = (byGrade[grade] || []).sort((a, b) => a.cs - b.cs).slice(0, 10);
    lists[grade] = rows.map((r) => ({ name: r.name, school: r.school, grade: r.grade, time: r.time }));
  }

  overall.lists[gender] = lists;
  console.log(`${gender} overall rebuilt:`, Object.fromEntries(Object.entries(lists).map(([g, rows]) => [g, rows.length])));
}

overall.source = "Rebuilt directly from this site's own mock regional rosters (src/data/mock-regionals-2026.json), which are sourced from DyeStat/Athletic.net exports, pooled across all four divisions per gender.";
fs.writeFileSync("src/data/top10-overall-by-grade-2026.json", JSON.stringify(overall, null, 2) + "\n");
console.log("Wrote src/data/top10-overall-by-grade-2026.json");
