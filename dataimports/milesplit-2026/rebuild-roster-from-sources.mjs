// Rebuilds every team's runner list from scratch directly from both original
// sources (top-75 CSV + MileSplit CSV), fixing a real bug the previous
// merge pass (merge-top75-into-roster.mjs) could not: when a MileSplit row
// lists names in "Lastname Firstname" order (confirmed real for at least
// one Dublin Coffman row), the reversed name normalizes to a different
// string than its normal-order counterpart, so it was added as a brand-new
// "runner" rather than recognized as the same real person -- inflating the
// pool and silently truncating real teammates out of the top 7 once sorted
// and sliced. This script dedupes by exact name, fuzzy nickname/typo match
// (same rules as dedupe-fuzzy-runners.mjs), AND word-set equality
// (regardless of order), then keeps the fastest 7 unique real people.
// Never invents a time; only ever picks between real recorded ones.
//
// Usage: node rebuild-roster-from-sources.mjs <divisionId> <top75CsvPath> <milesplitCsvPath>
import fs from "node:fs";

const [, , divisionId, top75CsvPath, milesplitCsvPath] = process.argv;
if (!divisionId || !top75CsvPath || !milesplitCsvPath) {
  console.error("Usage: node rebuild-roster-from-sources.mjs <divisionId> <top75CsvPath> <milesplitCsvPath>");
  process.exit(1);
}

const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, "");
const TIME_PATTERN = /^(\d+):(\d{2})\.(\d+)$/;
const toCs = (t) => { const m = String(t).match(TIME_PATTERN); if (!m) return null; return Number(m[1]) * 6000 + Number(m[2]) * 100 + Number(m[3].padEnd(2, "0").slice(0, 2)); };
const lev = (a, b) => {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
};
const NICK = {
  zach: "zachary", zac: "zachary", zachery: "zachary",
  josh: "joshua", will: "william", sam: "samuel", sammy: "samuel", sammie: "samantha",
  matt: "matthew", gabe: "gabriel", gabby: "gabriella", nate: "nathan", nick: "nicholas", nico: "nicholas",
  mike: "michael", ben: "benjamin", chris: "christopher", jon: "jonathan", jonathon: "jonathan",
  alex: "alexander", max: "maxwell", andy: "andrew", drew: "andrew",
  landin: "landon", landen: "landon",
  tony: "anthony", issac: "isaac", colten: "colton", jake: "jacob",
  liz: "elizabeth", maddy: "madelyn", maddie: "madelyn", madison: "madelyn", madi: "madelyn", madeline: "madelyn",
  katie: "katherine", kate: "katherine", kaitlin: "katherine", caitlin: "katherine", katelyn: "katherine",
  addie: "adeline", addi: "adeline",
  abby: "abigail", ester: "esther", brooklyn: "brooklynn",
  conner: "connor", presten: "preston", leej: "lj",
  everrett: "everett", joe: "joseph", harry: "harrison", avee: "avelyn",
  lexi: "alexis", lexie: "alexis", allie: "allison", ally: "allison",
  libby: "elizabeth", lizzie: "elizabeth", beth: "elizabeth",
  eli: "elijah"
};
const canon = (name) => { const n = norm(name); return NICK[n] || n; };
// A few confirmed same-person first-name pairs that don't fit the one-to-one
// NICK dictionary (e.g. "Sammy" is a nickname of both "Samuel" and
// "Samantha"). Verified against an identical recorded time on the same team.
const EXTRA_FIRST_NAME_PAIRS = new Set([
  "amayah|maya", "kate|kathleen", "samantha|sammy"
]);
const extraPairMatch = (a, b) => {
  const [x, y] = [norm(a), norm(b)].sort();
  return EXTRA_FIRST_NAME_PAIRS.has(`${x}|${y}`);
};
const wordParts = (name) => name.replace(/["'(),.]/g, " ").trim().split(/\s+/).filter(Boolean);

function isSamePerson(nameA, nameB) {
  const na = norm(nameA), nb = norm(nameB);
  if (na === nb) return true;
  const pa = wordParts(nameA), pb = wordParts(nameB);
  // word-set equality regardless of order (catches "Lastname Firstname" rows)
  const setA = pa.map(norm).sort().join("|");
  const setB = pb.map(norm).sort().join("|");
  if (pa.length === pb.length && setA === setB) return true;
  const lastA = norm(pa[pa.length - 1]), lastB = norm(pb[pb.length - 1]);
  const firstA = norm(pa[0]), firstB = norm(pb[0]);
  const firstExact = firstA === firstB;
  const lastExact = lastA === lastB;
  const lastDist = lev(lastA, lastB);
  const firstDist1 = lev(firstA, firstB) <= 1;
  const firstCanonMatch = canon(pa[0]) === canon(pb[0]) || extraPairMatch(pa[0], pb[0]);
  return (firstExact && lastDist >= 1 && lastDist <= 2) || (lastExact && (firstCanonMatch || firstDist1));
}

function splitCsvLine(line) {
  const out = []; let cur = ""; let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') inQuotes = false; else cur += c; }
    else if (c === '"') inQuotes = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

function loadCsvRows(csvPath) {
  return fs.readFileSync(csvPath, "utf8").trim().split("\n").slice(1).map(splitCsvLine);
}

function parseRow(rows, teamName) {
  const key = norm(teamName);
  let match = rows.find((cols) => norm(cols[3].replace(/\s+OH$/, "").trim()) === key);
  if (!match) {
    let best = null, bestDist = 2;
    for (const cols of rows) {
      const d = lev(key, norm(cols[3].replace(/\s+OH$/, "").trim()));
      if (d < bestDist) { bestDist = d; best = cols; }
    }
    match = best;
  }
  if (!match) return null;
  const runners = [];
  for (let i = 8; i < match.length; i += 2) {
    const name = match[i], time = match[i + 1];
    if (!name || !time || !TIME_PATTERN.test(time)) continue;
    runners.push({ name, time, cs: toCs(time) });
  }
  return runners;
}

const path = "src/data/mock-regionals-2026.json";
const mock = JSON.parse(fs.readFileSync(path, "utf8"));
const entry = mock.divisions.find((v) => v.id === divisionId);
if (!entry) { console.error("Unknown divisionId:", divisionId); process.exit(1); }

const top75Rows = loadCsvRows(top75CsvPath);
const milesplitRows = loadCsvRows(milesplitCsvPath);

let teamsChanged = 0;
const changeLog = [];

for (const region of Object.values(entry.regions)) {
  for (const team of region.teams) {
    const topRunners = parseRow(top75Rows, team.name) || [];
    const msRunners = parseRow(milesplitRows, team.name) || [];
    if (!topRunners.length && !msRunners.length) continue;

    const all = [...topRunners, ...msRunners];
    const groups = [];
    for (const r of all) {
      let placed = false;
      for (const g of groups) {
        if (isSamePerson(g[0].name, r.name)) { g.push(r); placed = true; break; }
      }
      if (!placed) groups.push([r]);
    }
    const resolved = groups.map((g) => g.reduce((best, r) => (r.cs < best.cs ? r : best), g[0]));
    const newRunners = resolved
      .sort((a, b) => a.cs - b.cs)
      .slice(0, 7)
      .map((r) => ({ name: r.name, grade: null, graduationYear: null, seasonBest: r.time, timeCentiseconds: r.cs, athleticNetId: null, resultUrl: null }));

    const oldNames = team.runners.map((r) => norm(r.name)).sort().join(",");
    const newNames = newRunners.map((r) => norm(r.name)).sort().join(",");
    if (oldNames !== newNames || team.runners.length !== newRunners.length) {
      changeLog.push(`${team.name}: [${team.runners.map((r) => r.name).join(", ")}] -> [${newRunners.map((r) => r.name).join(", ")}]`);
      team.runners = newRunners;
      teamsChanged++;
    }
  }
}

mock.lastUpdated = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path, JSON.stringify(mock, null, 2) + "\n");

console.log(`${divisionId}: rebuilt ${teamsChanged} team roster(s) with a real change.`);
changeLog.forEach((l) => console.log(" -", l));
