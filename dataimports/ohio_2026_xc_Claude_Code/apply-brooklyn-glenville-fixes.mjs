// Brooklyn/Glenville fixes (2026-10-20 follow-up), following the real
// NE PDFs over what was in the roster:
//   - Brooklyn (Boys D3): the real Boys D3 Lorain County CC PDF entry
//     list does not include Brooklyn at all. Unresolved (districtSiteKey
//     cleared) rather than guessed into a different site/division we
//     have no source for.
//   - Glenville (currently filed under Boys D3 Madison): the real PDFs
//     show Glenville entered at Boys D2 Madison, not D3. Moved from the
//     D3 category's team list into D2's, roster/runners unchanged.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(pkgDir, "ohio_2026_xc_full_statewide_2026.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

const d3boys = Object.values(data.categories).find((c) => c.gender === "Boys" && c.division === "D3");
const d2boys = Object.values(data.categories).find((c) => c.gender === "Boys" && c.division === "D2");

const brooklyn = d3boys.teams.find((t) => t.name === "Brooklyn");
if (brooklyn) {
  brooklyn.districtSiteKey = undefined;
  console.log("Brooklyn (Boys D3): districtSiteKey cleared -- not a real LCCC Boys D3 entry per the PDF");
}

const glenvilleIdx = d3boys.teams.findIndex((t) => t.name === "Glenville");
if (glenvilleIdx !== -1) {
  const [glenville] = d3boys.teams.splice(glenvilleIdx, 1);
  d2boys.teams.push(glenville);
  console.log("Glenville: moved from Boys D3 Madison to Boys D2 Madison, districtSiteKey unchanged:", glenville.districtSiteKey);
}

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
console.log(`\nWrote ${dataPath}`);
