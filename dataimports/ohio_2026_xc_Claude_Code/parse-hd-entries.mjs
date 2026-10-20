// Parses hilliard_darby_race_entries_2026-10-20.txt (plain tab-separated
// text, pasted by the user from athletic.net meet 286386) into structured
// JSON: one entry per race with its athletic_net_div_id and every
// runner's {name, team, grade, time}.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = path.dirname(fileURLToPath(import.meta.url));
const text = fs.readFileSync(path.join(pkgDir, "hilliard_darby_race_entries_2026-10-20.txt"), "utf8");
const lines = text.split(/\r?\n/);

// Real div ids, confirmed against district_meets_2026.json's own HD
// races (same source, same meet 286386).
const DIV_ID = {
  "boys|2|1": 1140745, "boys|2|2": 1140765,
  "boys|3|1": 1140747, "boys|3|2": 1140771,
  "boys|4|1": 1140749, "boys|4|2": 1140773,
  "girls|2|1": 1140746, "girls|2|2": 1140766,
  "girls|3|1": 1140748,
  "girls|4|1": 1140750, "girls|4|2": 1140774
};

const races = [];
let current = null;
for (const line of lines) {
  const header = /^(Boys|Girls)\s+[\d,]+\s+Meters\s+Division\s+(\d)\s+Session\s+(\d)\s+([\d:]+\s*[AP]M)\s*\|\s*(\d+)\s*Entries/.exec(line);
  if (header) {
    const gender = header[1].toLowerCase();
    const division = Number(header[2]);
    const session = Number(header[3]);
    const key = `${gender}|${division}|${session}`;
    current = { gender, division, session, startTime: header[4], declaredCount: Number(header[5]), athleticNetDivId: DIV_ID[key], entries: [] };
    races.push(current);
    continue;
  }
  if (!current) continue;
  if (line === "Name\tTeam\tGrade\tTime" || !line.trim()) continue;
  const cols = line.split("\t");
  if (cols.length < 2) continue;
  const [name, team, grade, time] = cols;
  current.entries.push({ name: name?.trim() || "", team: team?.trim() || "", grade: grade?.trim() || null, time: time?.trim() || null });
}

for (const r of races) {
  if (r.entries.length !== r.declaredCount) {
    console.log(`WARNING: ${r.gender} D${r.division} Session ${r.session}: parsed ${r.entries.length} entries, header declared ${r.declaredCount}`);
  }
}

const outPath = path.join(pkgDir, "hilliard_darby_race_entries_2026-10-20.json");
fs.writeFileSync(outPath, JSON.stringify({ races }, null, 2));
console.log(`Wrote ${outPath}: ${races.length} races, ${races.reduce((n, r) => n + r.entries.length, 0)} total entries`);
