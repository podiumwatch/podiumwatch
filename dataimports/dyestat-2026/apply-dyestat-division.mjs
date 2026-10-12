// General-purpose version of apply-boys-d4.mjs: replaces one division's
// team rosters in mock-regionals-2026.json from a DyeStat Hypothetical
// Meet CSV export. Usage:
//   node apply-dyestat-division.mjs <divisionId> <csvPath>
// e.g. node apply-dyestat-division.mjs boys-d1 "dataimports/dyestat-2026/Week 10_11 - boys d1.csv"
//
// Matching: exact normalized name first; then a small edit-distance
// fallback (<=2) against existing team names in THIS division only, to
// catch abbreviation-spelling drift between DyeStat and this site's own
// convention (e.g. "Tuscar. Valley" vs this file's existing
// "Tusc. Valley") without ever cross-matching two different schools.
// Anything still unmatched is reported and left for manual resolution --
// never guessed.
import fs from "node:fs";

const [, , divisionId, csvPath] = process.argv;
if (!divisionId || !csvPath) {
  console.error("Usage: node apply-dyestat-division.mjs <divisionId> <csvPath>");
  process.exit(1);
}

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const toCs = (t) => {
  const m = String(t).match(/^(\d+):(\d{2})\.(\d+)$/);
  return Number(m[1]) * 6000 + Number(m[2]) * 100 + Number(m[3].padEnd(2, "0").slice(0, 2));
};
const lev = (a, b) => {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
};

const REGION_KEY_BY_DISTRICT = {
  Central: "central", Northeast: "northeast", Northwest: "northwest", Southwest: "southwest",
  East: "central", Southeast: "central"
};
const REGION_LABEL_BY_KEY = { central: "Central", northeast: "Northeast", northwest: "Northwest", southwest: "Southwest" };
const manualLookup = JSON.parse(fs.readFileSync("dataimports/dyestat-2026/manual-school-lookup.json", "utf8"));

const path = "src/data/mock-regionals-2026.json";
const mock = JSON.parse(fs.readFileSync(path, "utf8"));
const entry = mock.divisions.find((v) => v.id === divisionId);
if (!entry) {
  console.error("Unknown divisionId:", divisionId);
  process.exit(1);
}

const existingByKey = new Map();
for (const [regionKey, region] of Object.entries(entry.regions)) {
  for (const t of region.teams) {
    existingByKey.set(norm(t.name), { name: t.name, regionKey, region: region.region, ohsaaSchoolId: t.ohsaaSchoolId, city: t.city, athleticDistrict: t.athleticDistrict });
  }
}
const existingKeys = [...existingByKey.keys()];

const csvLines = fs.readFileSync(csvPath, "utf8").trim().split("\n").slice(1);
const newTeams = [];
const unresolved = [];
const fuzzyMatches = [];

function splitCsvLine(line) {
  // Minimal CSV splitter that respects double-quoted fields (needed for
  // "John ""Jack"" Reardon" style names in the DyeStat export).
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

for (const line of csvLines) {
  const cols = splitCsvLine(line);
  const rawName = cols[3].replace(/\s+OH$/, "").trim();
  const key = norm(rawName);

  let placement = existingByKey.get(key);
  if (!placement) {
    let best = null, bestDist = 3;
    for (const ek of existingKeys) {
      const d = lev(key, ek);
      if (d < bestDist) { bestDist = d; best = ek; }
    }
    if (best) {
      placement = existingByKey.get(best);
      fuzzyMatches.push(`${rawName} -> ${placement.name} (distance ${bestDist})`);
    }
  }
  if (!placement) {
    const manual = manualLookup[`${divisionId}|${key}`];
    if (manual) {
      let regionKey = REGION_KEY_BY_DISTRICT[manual.athleticDistrict];
      if (!entry.regions[regionKey]) {
        // e.g. Division I has no northwest bucket -- OHSAA's real D1 regional
        // draw folds Northwest-district schools into the Northeast region.
        if (regionKey === "northwest" && entry.regions.northeast) regionKey = "northeast";
      }
      placement = { name: rawName, regionKey, region: REGION_LABEL_BY_KEY[regionKey], ohsaaSchoolId: manual.ohsaaSchoolId, city: manual.city, athleticDistrict: manual.athleticDistrict };
    }
  }
  if (!placement) {
    unresolved.push(rawName);
    continue;
  }

  const runners = [];
  for (let i = 8; i < cols.length; i += 2) {
    const name = cols[i];
    const time = cols[i + 1];
    if (!name || !time) continue;
    runners.push({
      name,
      grade: null,
      graduationYear: null,
      seasonBest: time,
      timeCentiseconds: toCs(time),
      athleticNetId: null,
      resultUrl: null
    });
  }

  newTeams.push({
    name: placement.name,
    athleticNetTeamRank: Number(cols[2]),
    ohsaaSchoolId: placement.ohsaaSchoolId,
    city: placement.city,
    athleticDistrict: placement.athleticDistrict,
    region: placement.region,
    runners,
    regionKey: placement.regionKey
  });
}

if (unresolved.length) {
  console.error("UNRESOLVED teams (not applied, needs manual lookup):", unresolved);
  process.exit(1);
}

if (fuzzyMatches.length) {
  console.log("Fuzzy-matched (review these):");
  fuzzyMatches.forEach((m) => console.log(" -", m));
}

const droppedTeams = existingKeys
  .filter((k) => !newTeams.some((t) => norm(t.name) === k))
  .map((k) => existingByKey.get(k));

for (const [regionKey, region] of Object.entries(entry.regions)) {
  region.teams = newTeams.filter((t) => t.regionKey === regionKey).map(({ regionKey: _rk, ...t }) => t);
}

mock.lastUpdated = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path, JSON.stringify(mock, null, 2) + "\n");

const counts = {};
for (const t of newTeams) counts[t.regionKey] = (counts[t.regionKey] || 0) + 1;
console.log(`Applied ${newTeams.length} ${divisionId} teams:`, JSON.stringify(counts));
console.log(`Dropped ${droppedTeams.length} teams no longer in the new top-75 list:`, droppedTeams.map((t) => t.name).join(", "));
