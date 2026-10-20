// Step 2 of the Mock Postseason brief: for each of the 71 real district
// races, determine the projected field from the full-statewide candidate
// dataset (teams already tagged with districtSiteKey by
// resolve-region-from-districts.mjs), and report every category of gap
// the brief asked for -- never silently resolved:
//   - unmatched entries: a school in a site's entered_schools list with
//     no matching team in our roster dataset at all
//   - division conflicts: a team matched to a site but (a) flagged
//     divisionReview in our data, or (b) its division has no race at
//     that site
//   - HD race-assignment gaps: Hilliard Darby splits some
//     division/gender combos into Race 1 / Race 2; we only know the
//     site, not which of the two races a team is in, so those are
//     flagged rather than split arbitrarily
//   - not-entered: D2-D4 schools in our dataset with no district site
//     match at all (includes the 16 from Step 1 plus any directory-only
//     region resolution that never matched an actual entry list)
//
// D1 is out of scope here -- it has no districts in 2026.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(pkgDir, "../..");

const candidate = JSON.parse(fs.readFileSync(path.join(pkgDir, "ohio_2026_xc_full_statewide_2026.json"), "utf8"));
const district = JSON.parse(fs.readFileSync(path.join(root, "dataimports/district_meets_2026.json"), "utf8"));

function norm(s) {
  return String(s || "").trim().toLowerCase().replace(/[.,()]/g, "").replace(/\s+/g, " ").trim();
}
const DIV_NUM = { D1: 1, D2: 2, D3: 3, D4: 4 };

// Index races by site, and by (site, gender, division) for race-count checks.
const racesBySite = new Map();
for (const race of district.races) {
  if (!racesBySite.has(race.site)) racesBySite.set(race.site, []);
  racesBySite.get(race.site).push(race);
}

// Index every (gender-D2-D4) team by districtSiteKey for fast field building.
const teamsBySiteGenderDiv = new Map(); // key: site|gender|divisionNumber
const allD2toD4Teams = [];
for (const cat of Object.values(candidate.categories)) {
  if (cat.division === "D1") continue; // no districts for D1
  for (const team of cat.teams) {
    allD2toD4Teams.push({ cat, team });
    if (!team.districtSiteKey) continue;
    const key = `${team.districtSiteKey}|${cat.gender}|${DIV_NUM[cat.division]}`;
    if (!teamsBySiteGenderDiv.has(key)) teamsBySiteGenderDiv.set(key, []);
    teamsBySiteGenderDiv.get(key).push(team);
  }
}

// --- unmatched entries: a site's entered_schools row with no team in our dataset resolved to that site+entry ---
// (We approximate "resolved to that site+entry" as: some D2-D4 team has
// districtSiteKey === site.key AND its name/schoolNameOhsaa normalizes to
// this exact entry -- since one school can field a team in only one
// division/gender combo in our data but the entry list is gender/division-
// blind, we just check the team existed at all for that site.)
const teamNamesBySite = new Map(); // site.key -> Set of normalized names (team.name and schoolNameOhsaa) of teams resolved there
for (const { cat, team } of allD2toD4Teams) {
  if (!team.districtSiteKey) continue;
  if (!teamNamesBySite.has(team.districtSiteKey)) teamNamesBySite.set(team.districtSiteKey, new Set());
  teamNamesBySite.get(team.districtSiteKey).add(norm(team.name));
  if (team.schoolNameOhsaa) teamNamesBySite.get(team.districtSiteKey).add(norm(team.schoolNameOhsaa));
}

const unmatchedEntries = [];
for (const site of district.sites) {
  const known = teamNamesBySite.get(site.key) || new Set();
  for (const entry of site.entered_schools) {
    if (!known.has(norm(entry.full_name)) && !known.has(norm(entry.athletic_net_name))) {
      unmatchedEntries.push({ site: site.key, fullName: entry.full_name, athleticNetName: entry.athletic_net_name });
    }
  }
}

// --- division conflicts vs. division-review resolutions ---
// A team flagged divisionReview (Athletic.net's division wasn't
// confirmed against the official PDF) that DOES have a matching race at
// the site it was actually entered for is evidence resolving that
// review, per the brief ("a school's district entry is evidence of its
// OHSAA division") -- not a conflict. A team whose division has NO
// matching race at its entered site is the real conflict: either our
// division is wrong, or it's entered under some other division/race we
// don't have a record of.
const divisionReviewResolvedByEntry = [];
const divisionConflicts = [];
for (const { cat, team } of allD2toD4Teams) {
  if (!team.districtSiteKey) continue;
  const hasRaceThere = (racesBySite.get(team.districtSiteKey) || []).some((r) => r.gender === cat.gender.toLowerCase() && r.division === DIV_NUM[cat.division]);
  if (!hasRaceThere) {
    divisionConflicts.push({ gender: cat.gender, division: cat.division, team: team.name, site: team.districtSiteKey, divisionReview: team.divisionReview, reason: "no race at this site for this gender/division -- site hosts a different set" });
  } else if (team.divisionReview) {
    divisionReviewResolvedByEntry.push({ gender: cat.gender, division: cat.division, team: team.name, site: team.districtSiteKey });
  }
}

// --- HD race-assignment gaps: site+gender+division with >1 race (Race 1 / Race 2) ---
const hdGaps = [];
for (const [key, teams] of teamsBySiteGenderDiv) {
  const [site, gender, divNum] = key.split("|");
  const matchingRaces = (racesBySite.get(site) || []).filter((r) => r.gender === gender.toLowerCase() && r.division === Number(divNum));
  if (matchingRaces.length > 1) {
    hdGaps.push({ site, gender, division: `D${divNum}`, raceLabels: matchingRaces.map((r) => r.race_label), teamsAffected: teams.map((t) => t.name) });
  }
}

// --- not-entered: D2-D4 teams with no districtSiteKey at all ---
const notEntered = [];
for (const { cat, team } of allD2toD4Teams) {
  if (!team.districtSiteKey) {
    notEntered.push({ gender: cat.gender, division: cat.division, team: team.name, region: team.region, regionSource: team.regionSource });
  }
}

console.log(`=== District field report ===`);
console.log(`Unmatched entries (entered at a site, no team in our dataset): ${unmatchedEntries.length}`);
for (const u of unmatchedEntries.slice(0, 30)) console.log(`  [${u.site}] "${u.athleticNetName}" / "${u.fullName}"`);
if (unmatchedEntries.length > 30) console.log(`  ... and ${unmatchedEntries.length - 30} more (see JSON report)`);

console.log(`\nReal division CONFLICTS (entered at a site with no matching race there): ${divisionConflicts.length}`);
for (const c of divisionConflicts) console.log(`  ${c.gender} ${c.division} ${c.team} [${c.site}] -- ${c.reason}${c.divisionReview ? " (also flagged divisionReview)" : ""}`);

console.log(`\nDivision-review flags RESOLVED by district entry (real evidence, no action needed): ${divisionReviewResolvedByEntry.length}`);
for (const r of divisionReviewResolvedByEntry.slice(0, 10)) console.log(`  ${r.gender} ${r.division} ${r.team} [${r.site}]`);
if (divisionReviewResolvedByEntry.length > 10) console.log(`  ... and ${divisionReviewResolvedByEntry.length - 10} more (see JSON report)`);

console.log(`\nHD-style race-assignment gaps (site/gender/division with Race 1 + Race 2, can't tell which): ${hdGaps.length}`);
for (const h of hdGaps) console.log(`  [${h.site}] ${h.gender} ${h.division}: ${h.raceLabels.join(", ")} -- ${h.teamsAffected.length} teams affected (${h.teamsAffected.join(", ")})`);

console.log(`\nNot entered at any district site (D2-D4 only): ${notEntered.length}`);
for (const n of notEntered.slice(0, 30)) console.log(`  ${n.gender} ${n.division} ${n.team} (region: ${n.region || "unresolved"})`);
if (notEntered.length > 30) console.log(`  ... and ${notEntered.length - 30} more (see JSON report)`);

fs.writeFileSync(
  path.join(pkgDir, "district_field_report.json"),
  JSON.stringify({ unmatchedEntries, divisionConflicts, divisionReviewResolvedByEntry, hdGaps, notEntered }, null, 2)
);
console.log(`\nWrote district_field_report.json`);
