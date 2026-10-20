// Two region-resolution fixes from NORTHEAST_QUALIFIERS_UPDATE.md
// (2026-10-20), applied directly to ohio_2026_xc_full_statewide_2026.json:
//
//   1. Youngstown (Boys D1, 1 runner only) never got a `region`/`regional`
//      value at all (both null) -- the OHSAA D1 Boardman school list
//      confirms it as a real Boardman/Northeast entry (#483), so this
//      resolves it the same way every other Northeast D1 team is stored
//      (region: "Northeast", regional: "Boardman") instead of leaving it
//      silently dropped by build-postseason-chain.mjs's D1 loop (a team
//      with no `regional` value is skipped entirely, not even flagged
//      under review). No Girls D1 Youngstown team exists in this package
//      at all -- nothing to resolve there, just no roster data.
//
//   2. Cristo Rey (Boys D4 and Girls D3) has real roster data but never
//      resolved a region/regional/districtSiteKey -- it's entered at
//      Hilliard Darby on athletic.net (team 71476) but wasn't in the
//      2026-10-19 entered_schools snapshot used for region matching.
//      Resolves it to Central / Pickerington / HD, same shape every
//      other HD-entered D2-D4 team uses.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(pkgDir, "ohio_2026_xc_full_statewide_2026.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

function findTeam(gender, division, name) {
  const cat = Object.values(data.categories).find((c) => c.gender === gender && c.division === division);
  return cat?.teams.find((t) => t.name === name);
}

const youngstown = findTeam("Boys", "D1", "Youngstown");
if (youngstown) {
  youngstown.region = "Northeast";
  youngstown.regional = "Boardman";
  console.log("Youngstown (Boys D1): region/regional resolved to Northeast/Boardman");
} else {
  console.log("Youngstown (Boys D1): not found -- no fix applied");
}

for (const [gender, division] of [["Boys", "D4"], ["Girls", "D3"]]) {
  const cristoRey = findTeam(gender, division, "Cristo Rey");
  if (cristoRey) {
    cristoRey.region = "Central";
    cristoRey.regional = "Pickerington";
    cristoRey.districtSiteKey = "HD";
    console.log(`Cristo Rey (${gender} ${division}): resolved to Central/Pickerington/HD`);
  } else {
    console.log(`Cristo Rey (${gender} ${division}): not found`);
  }
}

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
console.log(`\nWrote ${dataPath}`);
