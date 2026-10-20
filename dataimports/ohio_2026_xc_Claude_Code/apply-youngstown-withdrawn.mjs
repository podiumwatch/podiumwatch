// Youngstown (Boys D1) is struck through on the real OHSAA D1 Boardman
// PDF -- treated as withdrawn per the user's explicit instruction
// (2026-10-20 follow-up), reversing the earlier resolve-to-Boardman fix.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(pkgDir, "ohio_2026_xc_full_statewide_2026.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

const cat = Object.values(data.categories).find((c) => c.gender === "Boys" && c.division === "D1");
const t = cat.teams.find((t) => t.name === "Youngstown");
if (t) {
  t.region = null;
  t.regional = null;
  t.withdrawn = true;
  console.log("Youngstown (Boys D1): region/regional cleared, marked withdrawn");
}

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
console.log(`Wrote ${dataPath}`);
