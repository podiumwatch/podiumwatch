import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = path.dirname(fileURLToPath(import.meta.url));
const before = JSON.parse(fs.readFileSync(path.join(pkgDir, "postseason_chain_output.BEFORE_HD.json"), "utf8"));
const after = JSON.parse(fs.readFileSync(path.join(pkgDir, "postseason_chain_output.json"), "utf8"));

const affected = ["boys_D2_central", "boys_D3_central", "boys_D4_central", "girls_D2_central", "girls_D4_central"];
for (const key of affected) {
  const b = before.regionalResults[key];
  const a = after.regionalResults[key];
  const n = a.stateQualifiers;
  const beforeQualNames = new Set(b.teams.filter((t) => t.complete).slice(0, n).map((t) => t.name));
  const afterTop = a.teams.filter((t) => t.complete).slice(0, n);
  console.log(`\n=== ${key} (top ${n} qualify) ===`);
  afterTop.forEach((t, i) => {
    const tag = beforeQualNames.has(t.name) ? "" : " <-- NEWLY QUALIFIES (Hilliard Darby team)";
    console.log(`  ${i + 1}. ${t.name} (${t.score} pts)${tag}`);
  });
  const droppedOut = [...beforeQualNames].filter((name) => !afterTop.some((t) => t.name === name));
  console.log(`  DROPPED OUT: ${droppedOut.join(", ")}`);
}
