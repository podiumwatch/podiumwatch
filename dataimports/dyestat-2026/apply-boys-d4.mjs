// Replaces Boys Division IV's team rosters in mock-regionals-2026.json
// with the fresh top-75 list from DyeStat's Week 10/11 Hypothetical Meet
// export. Matches each DyeStat team to its existing mock-regionals entry
// by name (reusing that team's already-verified ohsaaSchoolId/region/city)
// so nothing about region placement is re-guessed; a small number of
// genuinely new teams are matched against the official OHSAA directory
// instead, by hand-confirmed id below (never auto-guessed).
//
// Known limitation, by design: DyeStat's export has no grade column, so
// every runner here gets grade: null, graduationYear: null until the
// matching Individuals export is merged in (a follow-up pass).
import fs from "node:fs";

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const toCs = (t) => {
  const m = String(t).match(/^(\d+):(\d{2})\.(\d+)$/);
  return Number(m[1]) * 6000 + Number(m[2]) * 100 + Number(m[3].padEnd(2, "0").slice(0, 2));
};

// Hand-confirmed against dataimports/mock-meet-export/ohsaa_official_directory.json
// -- the 6 teams in this new top-75 list with no existing mock-regionals
// entry to match against.
const NEW_TEAM_LOOKUP = {
  "calvarychristian": { ohsaaSchoolId: 9276, city: "Bellefontaine", athleticDistrict: "Southwest" },
  "eastcanton": { ohsaaSchoolId: 488, city: "East Canton", athleticDistrict: "Northeast" },
  "sandsmcc": { ohsaaSchoolId: 1372, city: "Sandusky", athleticDistrict: "Northwest" },
  "lakeridgeacad": { ohsaaSchoolId: 827, city: "North Ridgeville", athleticDistrict: "Northeast" },
  "manschristian": { ohsaaSchoolId: 942, city: "Mansfield", athleticDistrict: "Northwest" },
  "bucyrus": { ohsaaSchoolId: 290, city: "Bucyrus", athleticDistrict: "Northwest" }
};

const path = "src/data/mock-regionals-2026.json";
const mock = JSON.parse(fs.readFileSync(path, "utf8"));
const entry = mock.divisions.find((v) => v.id === "boys-d4");

const existingByKey = new Map();
for (const [regionKey, region] of Object.entries(entry.regions)) {
  for (const t of region.teams) {
    existingByKey.set(norm(t.name), { name: t.name, regionKey, region: region.region, ohsaaSchoolId: t.ohsaaSchoolId, city: t.city, athleticDistrict: t.athleticDistrict });
  }
}

const REGION_KEY_BY_DISTRICT = { Central: "central", Northeast: "northeast", Northwest: "northwest", Southwest: "southwest" };

const csvLines = fs.readFileSync("dataimports/dyestat-2026/Week 10_11 - Boys d4.csv", "utf8").trim().split("\n").slice(1);
const newTeams = [];
const unresolved = [];

for (const line of csvLines) {
  const cols = line.split(",");
  const rawName = cols[3].replace(/\s+OH$/, "").trim();
  const key = norm(rawName);

  let placement = existingByKey.get(key);
  if (!placement) {
    const lookup = NEW_TEAM_LOOKUP[key];
    if (!lookup) {
      unresolved.push(rawName);
      continue;
    }
    placement = { name: rawName, regionKey: REGION_KEY_BY_DISTRICT[lookup.athleticDistrict], region: lookup.athleticDistrict, ohsaaSchoolId: lookup.ohsaaSchoolId, city: lookup.city, athleticDistrict: lookup.athleticDistrict };
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

// Replace each region's team list, preserving existing individuals/
// stateQualifiers/individualQualifiers/siteName fields untouched.
for (const [regionKey, region] of Object.entries(entry.regions)) {
  region.teams = newTeams.filter((t) => t.regionKey === regionKey).map(({ regionKey: _rk, ...t }) => t);
}

mock.lastUpdated = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path, JSON.stringify(mock, null, 2) + "\n");

const counts = {};
for (const t of newTeams) counts[t.regionKey] = (counts[t.regionKey] || 0) + 1;
console.log("Applied", newTeams.length, "Boys D4 teams:", JSON.stringify(counts));
