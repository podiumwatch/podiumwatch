// Step 1 of the Mock Postseason brief: resolve region for every school in
// ohio_2026_xc_full_statewide_2026.json using district entry lists first
// (dataimports/district_meets_2026.json's sites[].entered_schools), then
// falling back to the existing OHSAA-directory join already computed by
// build-full-statewide-dataset.mjs. Still-unresolved schools are left
// region: null and listed, never guessed -- per the brief's explicit
// trust order:
//   1. District entry list (full_name, then athletic_net_name)
//   2. OHSAA directory join (already-resolved "exact" matches)
//   3. Unresolved -> null, reported
//
// Writes an updated copy of the candidate dataset (region +
// regionSource + regional added/overwritten on every team) and a report
// of what the entry-list pass closed, plus any entry-list-vs-directory
// disagreements (entry list wins, but every disagreement is listed).
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

// Build lookup: normalized school name (full_name, then athletic_net_name)
// -> site. A name appearing at more than one site is itself a conflict to
// report, not silently resolved by "first site wins".
const byFullName = new Map();
const byNetName = new Map();
for (const site of district.sites) {
  for (const entry of site.entered_schools) {
    const fullKey = norm(entry.full_name);
    const netKey = norm(entry.athletic_net_name);
    if (!byFullName.has(fullKey)) byFullName.set(fullKey, []);
    byFullName.get(fullKey).push(site);
    if (!byNetName.has(netKey)) byNetName.set(netKey, []);
    byNetName.get(netKey).push(site);
  }
}

function lookupSite(schoolName) {
  const key = norm(schoolName);
  const full = byFullName.get(key);
  if (full && full.length === 1) return { site: full[0], matchedOn: "full_name" };
  if (full && full.length > 1) return { conflict: "multiple_sites_full_name", sites: full };
  const net = byNetName.get(key);
  if (net && net.length === 1) return { site: net[0], matchedOn: "athletic_net_name" };
  if (net && net.length > 1) return { conflict: "multiple_sites_athletic_net_name", sites: net };
  return null;
}

let closedByEntryList = 0;
let stillNullBefore = 0;
let disagreements = [];
let entryListMultiSiteConflicts = [];

for (const cat of Object.values(candidate.categories)) {
  for (const team of cat.teams) {
    const wasNull = team.region == null;
    if (wasNull) stillNullBefore++;

    // Try both the Athletic.net team name and the OHSAA name we already
    // carry, since district entry lists sometimes use one, sometimes the
    // other, per dataimports/district_meets_2026.json's own documented
    // convention.
    let result = lookupSite(team.name);
    if (!result) result = lookupSite(team.schoolNameOhsaa);

    if (result && result.conflict) {
      entryListMultiSiteConflicts.push({
        gender: cat.gender, division: cat.division, team: team.name,
        schoolNameOhsaa: team.schoolNameOhsaa, conflict: result.conflict,
        sites: result.sites.map((s) => s.key)
      });
      continue;
    }

    if (result && result.site) {
      const entryRegion = result.site.region;
      const entryRegional = result.site.regional;
      if (!wasNull && team.region !== entryRegion) {
        disagreements.push({
          gender: cat.gender, division: cat.division, team: team.name,
          schoolNameOhsaa: team.schoolNameOhsaa,
          directoryRegion: team.region, entryListRegion: entryRegion,
          matchedOn: result.matchedOn, siteKey: result.site.key
        });
      }
      if (wasNull) closedByEntryList++;
      team.region = entryRegion;
      team.regional = entryRegional;
      team.regionSource = wasNull ? "district_entry_list" : (team.region === entryRegion ? "district_entry_list_confirms_directory" : "district_entry_list_overrides_directory");
      team.districtSiteKey = result.site.key;
    } else if (!wasNull) {
      // Directory already resolved this one and no entry list match
      // exists either way -- keep the directory result, note the source.
      team.regional = district.regional_by_region[team.region] || null;
      team.regionSource = "ohsaa_directory";
    } else {
      team.regionSource = "unresolved";
      team.regional = null;
    }
  }
}

let stillNullAfter = 0;
const stillUnresolved = [];
for (const cat of Object.values(candidate.categories)) {
  for (const team of cat.teams) {
    if (team.region == null) {
      stillNullAfter++;
      stillUnresolved.push({ gender: cat.gender, division: cat.division, team: team.name, schoolNameOhsaa: team.schoolNameOhsaa, teamUrl: team.teamUrl, priorMatchType: team.regionMatchType });
    }
  }
}

console.log(`Schools with no region before this pass: ${stillNullBefore}`);
console.log(`Closed by district entry list: ${closedByEntryList}`);
console.log(`Still unresolved after entry-list pass: ${stillNullAfter}`);
console.log(`Entry-list vs. directory disagreements (entry list wins): ${disagreements.length}`);
console.log(`Entry-list internal conflicts (same name at >1 site): ${entryListMultiSiteConflicts.length}`);

for (const d of disagreements) console.log(`  DISAGREE: ${d.gender} ${d.division} ${d.team} -- directory said ${d.directoryRegion}, entry list (${d.siteKey}) says ${d.entryListRegion}`);
for (const c of entryListMultiSiteConflicts) console.log(`  MULTI-SITE: ${c.gender} ${c.division} ${c.team} appears at sites ${c.sites.join(", ")}`);

candidate.generatedAt = new Date().toISOString();
candidate.notes.push("Region resolved in a second pass (resolve-region-from-districts.mjs) using district entry lists as the primary source, OHSAA directory join as fallback. See regionSource on each team.");

fs.writeFileSync(path.join(pkgDir, "ohio_2026_xc_full_statewide_2026.json"), JSON.stringify(candidate, null, 2));
fs.writeFileSync(path.join(pkgDir, "region_resolution_report.json"), JSON.stringify({ disagreements, entryListMultiSiteConflicts, stillUnresolved }, null, 2));
console.log(`\nWrote updated candidate dataset and region_resolution_report.json (${stillUnresolved.length} still unresolved).`);
