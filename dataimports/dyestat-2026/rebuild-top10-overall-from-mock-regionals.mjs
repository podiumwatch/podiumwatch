// Same idea as rebuild-top10-from-mock-regionals.mjs, but for the
// "overall, regardless of division" Top 10 file: pools every graded
// runner across all four boys divisions in mock-regionals-2026.json
// (now DyeStat-sourced) and takes the fastest 10 per grade. Girls stay
// on whatever rebuild-top10-overall.mjs last produced, untouched.
import fs from "node:fs";

const mock = JSON.parse(fs.readFileSync("src/data/mock-regionals-2026.json", "utf8"));
const overall = JSON.parse(fs.readFileSync("src/data/top10-overall-by-grade-2026.json", "utf8"));

const pool = [];
for (const entry of mock.divisions.filter((v) => v.gender === "boys")) {
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

overall.lists.boys = lists;
overall.source = "Boys: rebuilt directly from this site's own mock regional rosters (src/data/mock-regionals-2026.json), which are sourced from DyeStat, pooled across all four divisions. Girls: Athletic.net individual season-best lists and the MileSplit 2026 grade rankings, combined by runner, not yet refreshed.";
fs.writeFileSync("src/data/top10-overall-by-grade-2026.json", JSON.stringify(overall, null, 2) + "\n");
console.log("boys overall rebuilt:", Object.fromEntries(Object.entries(lists).map(([g, rows]) => [g, rows.length])));
