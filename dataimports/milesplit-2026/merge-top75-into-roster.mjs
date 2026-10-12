// Fixes a real bug: apply-milesplit-division.mjs replaced each team's roster
// with ONLY that single MileSplit meet's finishers, which can be fewer than
// 7 real runners (a team's season-best 7th runner may simply not have run
// that particular week). This script merges the team's top-75 source
// (DyeStat for boys, Athletic.net for girls -- both already applied earlier
// this session, before being overwritten by the single-meet MileSplit data)
// back in: for every team already in the division, pool its current
// MileSplit-sourced runners with its top-75-sourced runners, collapse the
// same person appearing in both (keep their faster time), and keep the
// fastest 7 unique runners. Never guesses a time; only ever picks between
// two real recorded times for the same person.
//
// Usage: node merge-top75-into-roster.mjs <divisionId> <top75CsvPath>
import fs from "node:fs";

const [, , divisionId, top75CsvPath] = process.argv;
if (!divisionId || !top75CsvPath) {
  console.error("Usage: node merge-top75-into-roster.mjs <divisionId> <top75CsvPath>");
  process.exit(1);
}

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const TIME_PATTERN = /^(\d+):(\d{2})\.(\d+)$/;
const toCs = (t) => {
  const m = String(t).match(TIME_PATTERN);
  if (!m) return null;
  return Number(m[1]) * 6000 + Number(m[2]) * 100 + Number(m[3].padEnd(2, "0").slice(0, 2));
};
const lev = (a, b) => {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
};

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const path = "src/data/mock-regionals-2026.json";
const mock = JSON.parse(fs.readFileSync(path, "utf8"));
const entry = mock.divisions.find((v) => v.id === divisionId);
if (!entry) {
  console.error("Unknown divisionId:", divisionId);
  process.exit(1);
}

// Build normalized-team-name -> runners[] map from the top-75 source.
const top75ByTeam = new Map();
const csvLines = fs.readFileSync(top75CsvPath, "utf8").trim().split("\n").slice(1);
for (const line of csvLines) {
  const cols = splitCsvLine(line);
  const rawName = cols[3].replace(/\s+OH$/, "").trim();
  const key = norm(rawName);
  const runners = [];
  for (let i = 8; i < cols.length; i += 2) {
    const name = cols[i];
    const time = cols[i + 1];
    if (!name || !time || !TIME_PATTERN.test(time)) continue;
    runners.push({ name, time, cs: toCs(time) });
  }
  top75ByTeam.set(key, { rawName, runners });
}

const existingKeys = [];
for (const region of Object.values(entry.regions)) {
  for (const t of region.teams) existingKeys.push(norm(t.name));
}

let teamsTouched = 0;
let runnersAdded = 0;
let runnersSwapped = 0;
const unmatchedTop75 = [];
const usedTop75Keys = new Set();

for (const region of Object.values(entry.regions)) {
  for (const team of region.teams) {
    const key = norm(team.name);
    let top75 = top75ByTeam.get(key);
    let matchedKey = key;
    if (!top75) {
      // small edit-distance fallback within this division's own top75 list only
      let best = null, bestDist = 3;
      for (const k of top75ByTeam.keys()) {
        const d = lev(key, k);
        if (d < bestDist) { bestDist = d; best = k; }
      }
      if (best) { top75 = top75ByTeam.get(best); matchedKey = best; }
    }
    if (!top75) continue;
    usedTop75Keys.add(matchedKey);

    const pool = new Map(); // normName -> {name, grade, graduationYear, seasonBest, timeCentiseconds, athleticNetId, resultUrl}
    for (const r of team.runners) {
      const k = norm(r.name);
      if (!pool.has(k) || r.timeCentiseconds < pool.get(k).timeCentiseconds) pool.set(k, r);
    }
    let changed = false;
    for (const r of top75.runners) {
      const k = norm(r.name);
      const existing = pool.get(k);
      if (!existing) {
        pool.set(k, { name: r.name, grade: null, graduationYear: null, seasonBest: r.time, timeCentiseconds: r.cs, athleticNetId: null, resultUrl: null });
        runnersAdded++;
        changed = true;
      } else if (r.cs < existing.timeCentiseconds) {
        pool.set(k, { ...existing, seasonBest: r.time, timeCentiseconds: r.cs });
        runnersSwapped++;
        changed = true;
      }
    }
    if (changed) {
      const merged = [...pool.values()].sort((a, b) => a.timeCentiseconds - b.timeCentiseconds).slice(0, 7);
      team.runners = merged;
      teamsTouched++;
    }
  }
}

for (const [key, data] of top75ByTeam) {
  if (!usedTop75Keys.has(key) && !existingKeys.includes(key)) unmatchedTop75.push(data.rawName);
}

mock.lastUpdated = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path, JSON.stringify(mock, null, 2) + "\n");

console.log(`${divisionId}: merged top-75 data into ${teamsTouched} teams (${runnersAdded} runners added, ${runnersSwapped} faster times swapped in).`);
if (unmatchedTop75.length) {
  console.log(`Top-75 teams with no match in the current roster (not added, needs review):`, unmatchedTop75.join(", "));
}
