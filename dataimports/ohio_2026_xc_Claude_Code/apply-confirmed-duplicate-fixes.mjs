// Applies the user's confirmed duplicate-identity fixes (2026-10-20
// review round) to ohio_2026_xc_full_statewide_2026.json in place, after
// resolve-region-from-districts.mjs has already run. Only two real
// changes are made here -- everything else in the user's original list
// of 7 turned out, on direct verification against this package's own
// data (including the raw team_top_7.csv), to need no action:
//
//   - Convoy Crestview (Andy/Andrew Heth), Hilliard Darby (Maddy/Madelyn
//     Pulsfort), Milan Edison (Julianna/Juliana Johnson), and Versailles
//     (Tony/Anthony Spitzer): only ONE of the two named variants exists
//     anywhere in this package (not just the roster -- the raw CSV too).
//     The one that does exist already matches the exact name/time the
//     user said to keep. Nothing to merge; already correct.
//   - Defiance (Beckett Myers vs. Beckett Meyers): the user asked to
//     check both athletic.net links first. WebFetch returns 403 on
//     athletic.net (a known, standing constraint for this project) --
//     could not verify. NOT merged here; both rows left as-is pending
//     the user's own check.
//
// What IS applied:
//   1. Berkshire Boys D3: "Ben Townsend" (16:51.2) was one of this
//      project's own 35 original "unresolved duplicate, both profiles
//      withheld" entries (ohio_2026_xc_validated_data.json's
//      `duplicates` array) -- neither profile ever made it into the
//      roster at all. The user has now confirmed Ben Townsend is the
//      real, distinct athlete to keep, so this restores that one
//      profile into the roster (not a merge of two present rows -- a
//      restoration of a previously-withheld one) and re-caps the team
//      at its real top 7 by time.
//   2. Willard Girls D3: "Keilly Hernandez Rojas" (21:49.7) and "Keilly
//      HernandezRoja" (22:11.2) are two CURRENTLY-present rows for the
//      same real person (an OCR/parsing split of one name, not a
//      distinct-identity case like the withheld-duplicates list). Keeps
//      the faster time, removes the duplicate row. No 8th runner exists
//      anywhere in this package to promote into the vacated slot (this
//      package only ever saved each team's top 7), so Willard Girls D3
//      now correctly shows 6 known runners instead of a fabricated 7th.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(pkgDir, "ohio_2026_xc_full_statewide_2026.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

function findTeam(gender, division, name) {
  const cat = Object.values(data.categories).find((c) => c.gender === gender && c.division === division);
  if (!cat) throw new Error(`No category ${gender} ${division}`);
  const team = cat.teams.find((t) => t.name === name);
  if (!team) throw new Error(`No team "${name}" in ${gender} ${division}`);
  return team;
}

// --- 1. Restore Ben Townsend (Berkshire Boys D3) ---
const berkshire = findTeam("Boys", "D3", "Berkshire");
const before = berkshire.runners.map((r) => r.name);
if (berkshire.runners.some((r) => r.name === "Ben Townsend")) {
  throw new Error("Ben Townsend already present on Berkshire Boys D3 -- this script has likely already been run against this file. Regenerate from build-full-statewide-dataset.mjs + resolve-region-from-districts.mjs first.");
}
berkshire.runners.push({
  name: "Ben Townsend",
  grade: null,
  graduationYear: null,
  seasonBest: "16:51.2",
  timeCentiseconds: 101120,
  athleticNetId: "32515969",
  athleteUrl: "https://www.athletic.net/athlete/32515969/cross-country",
  resultUrl: null,
  meetName: null,
  meetDate: null,
  verificationStatus: "restored 2026-10-20: user confirmed distinct from Benjamin Townsend (both profiles previously withheld as an unresolved duplicate pair)",
  collectedAtEastern: new Date().toISOString(),
  notes: "User-confirmed real, distinct athlete -- restored from the original withheld-duplicate pair (ohio_2026_xc_validated_data.json duplicates[])."
});
berkshire.runners.sort((a, b) => a.timeCentiseconds - b.timeCentiseconds);
const dropped = berkshire.runners.length > 7 ? berkshire.runners.splice(7) : [];
berkshire.identityReview = false;
berkshire.provisional = false;
console.log(`Berkshire Boys D3: before [${before.join(", ")}]`);
console.log(`Berkshire Boys D3: after  [${berkshire.runners.map((r) => r.name).join(", ")}]` + (dropped.length ? ` (dropped: ${dropped.map((r) => r.name).join(", ")})` : ""));

// --- 2. Merge Keilly Hernandez Rojas / HernandezRoja (Willard Girls D3) ---
const willard = findTeam("Girls", "D3", "Willard");
const beforeW = willard.runners.map((r) => r.name);
willard.runners = willard.runners.filter((r) => r.name !== "Keilly HernandezRoja");
willard.identityReview = false;
console.log(`Willard Girls D3: before [${beforeW.join(", ")}]`);
console.log(`Willard Girls D3: after  [${willard.runners.map((r) => r.name).join(", ")}]`);

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
console.log(`\nWrote ${dataPath}`);
