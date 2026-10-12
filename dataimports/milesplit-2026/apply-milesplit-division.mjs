// General-purpose version of apply-boys-d4-milesplit.mjs: replaces one
// division's rosters in mock-regionals-2026.json from a MileSplit export,
// verifying every team against the official 2026-27 boys XC division
// document first. See apply-boys-d4-milesplit.mjs's own header for the
// full reasoning; this is the same logic, parameterized.
//
// Usage: node apply-milesplit-division.mjs <divisionId> <targetDivisionLabel> <csvPath> <resolutionPath>
import fs from "node:fs";

const [, , divisionId, targetDivisionLabel, csvPath, resolutionPath] = process.argv;
if (!divisionId || !targetDivisionLabel || !csvPath || !resolutionPath) {
  console.error("Usage: node apply-milesplit-division.mjs <divisionId> <targetDivisionLabel> <csvPath> <resolutionPath>");
  process.exit(1);
}

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const TIME_PATTERN = /^(\d+):(\d{2})\.(\d+)$/;
const toCs = (t) => {
  const m = String(t).match(TIME_PATTERN);
  return Number(m[1]) * 6000 + Number(m[2]) * 100 + Number(m[3].padEnd(2, "0").slice(0, 2));
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

const REGION_KEY_BY_DISTRICT = {
  Central: "central", Northeast: "northeast", Northwest: "northwest", Southwest: "southwest",
  East: "central", Southeast: "central"
};
const REGION_LABEL = { central: "Central", northeast: "Northeast", northwest: "Northwest", southwest: "Southwest" };

const foundation = JSON.parse(fs.readFileSync("public/data/ohio-school-foundation-2026-27.json", "utf8"));
const byNormName = new Map(foundation.schools.map((s) => [norm(s.school_name), s]));

const resolution = JSON.parse(fs.readFileSync(resolutionPath, "utf8"));
const excludeSet = new Set(resolution.exclude.map(norm));
const unresolvedSet = new Set((resolution.unresolved || []).map(norm));

const path = "src/data/mock-regionals-2026.json";
const mock = JSON.parse(fs.readFileSync(path, "utf8"));
const entry = mock.divisions.find((v) => v.id === divisionId);

const csvLines = fs.readFileSync(csvPath, "utf8").trim().split("\n").slice(1);

const newTeams = [];
const excluded = [];
const unverifiedIncluded = [];
const stillUnresolved = [];
const skippedAmbiguous = [];
const malformedPairs = [];

for (const line of csvLines) {
  const cols = splitCsvLine(line);
  const rawName = cols[3].replace(/\s+OH$/, "").trim();
  const key = norm(rawName);

  if (excludeSet.has(key)) {
    excluded.push(rawName);
    continue;
  }
  if (unresolvedSet.has(key)) {
    skippedAmbiguous.push(rawName);
    continue;
  }

  let placement;
  const direct = byNormName.get(key);
  if (direct && direct.division_2026_27_2027_28 === targetDivisionLabel) {
    placement = { ohsaaSchoolId: direct.school_id, city: direct.city, athleticDistrict: direct.athletic_district };
  } else {
    const resolved = resolution.resolve[rawName];
    if (!resolved) {
      stillUnresolved.push(rawName);
      continue;
    }
    placement = resolved;
    if (!resolved.verified) unverifiedIncluded.push(rawName);
  }

  let regionKey = REGION_KEY_BY_DISTRICT[placement.athleticDistrict];
  if (!regionKey) {
    stillUnresolved.push(`${rawName} (unrecognized athletic district "${placement.athleticDistrict}")`);
    continue;
  }
  if (!entry.regions[regionKey]) {
    // Division I has no northwest bucket -- OHSAA's real D1 regional draw folds
    // Northwest-district schools into the Northeast region instead. Without this,
    // a real Northwest D1 school silently vanishes (newTeams.length counts it,
    // but the final per-regionKey filter never matches any bucket).
    if (regionKey === "northwest" && entry.regions.northeast) regionKey = "northeast";
    else {
      stillUnresolved.push(`${rawName} (division has no "${regionKey}" region bucket)`);
      continue;
    }
  }

  const runnersByKey = new Map();
  for (let i = 8; i < cols.length; i += 2) {
    const name = cols[i];
    const time = cols[i + 1];
    if (!name || !time) continue;
    if (!TIME_PATTERN.test(time)) {
      malformedPairs.push(`${rawName}: "${name}" / "${time}"`);
      continue;
    }
    const cs = toCs(time);
    const rkey = norm(name);
    if (!runnersByKey.has(rkey) || cs < runnersByKey.get(rkey).timeCentiseconds) {
      runnersByKey.set(rkey, {
        name,
        grade: null,
        graduationYear: null,
        seasonBest: time,
        timeCentiseconds: cs,
        athleticNetId: null,
        resultUrl: null
      });
    } else {
      malformedPairs.push(`${rawName}: duplicate "${name}" entry, kept the faster time`);
    }
  }
  const runners = [...runnersByKey.values()].sort((a, b) => a.timeCentiseconds - b.timeCentiseconds);

  newTeams.push({
    name: rawName,
    athleticNetTeamRank: Number(cols[2]),
    ohsaaSchoolId: placement.ohsaaSchoolId,
    city: placement.city,
    athleticDistrict: placement.athleticDistrict,
    region: REGION_LABEL[regionKey],
    runners,
    regionKey
  });
}

if (stillUnresolved.length) {
  console.error("STILL UNRESOLVED (not applied):", stillUnresolved);
  process.exit(1);
}

for (const [regionKey, region] of Object.entries(entry.regions)) {
  region.teams = newTeams.filter((t) => t.regionKey === regionKey).map(({ regionKey: _rk, ...t }) => t);
}

mock.lastUpdated = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path, JSON.stringify(mock, null, 2) + "\n");

const counts = {};
for (const t of newTeams) counts[t.regionKey] = (counts[t.regionKey] || 0) + 1;
console.log(`Applied ${newTeams.length} ${divisionId} teams:`, JSON.stringify(counts));
console.log(`Excluded ${excluded.length} (confirmed wrong division):`, excluded.join(", "));
if (skippedAmbiguous.length) console.log(`Skipped ${skippedAmbiguous.length} (ambiguous, could not confidently resolve to one school):`, skippedAmbiguous.join(", "));
console.log(`Included ${unverifiedIncluded.length} without official division confirmation:`);
unverifiedIncluded.forEach((n) => console.log(" -", n));
if (malformedPairs.length) {
  console.log(`\nDropped/fixed ${malformedPairs.length} malformed runner slot(s):`);
  malformedPairs.forEach((p) => console.log(" -", p));
}
