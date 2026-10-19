// Builds src/data/mock-districts-2026.json from dataimports/district_meets_2026.json.
//
// Never invents data (AGENTS.md rule 2 / MOCK_DISTRICTS_BRIEF.md rule 2):
// every school is resolved to a real ohio_schools row via the same
// loadOhioSchoolLookup() this project already uses for Athletic.net/
// performance imports; every school's real 2026 division comes from
// ohio_school_divisions (current = true); every runner's season-best
// time comes from athlete_performances (xc_5k, season 2026,
// public_visible). A school that can't be resolved, or whose resolved
// division has no race at its site, is reported and left out -- never
// guessed into a bucket. Read-only: this script makes no writes.
//
// Usage:
//   node --env-file=.env.local dataimports/build-mock-districts-data.mjs            (report only)
//   node --env-file=.env.local dataimports/build-mock-districts-data.mjs --write    (also writes src/data/mock-districts-2026.json)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { supabaseAdmin } from "../lib/supabase-admin.mjs";
import { loadOhioSchoolLookup } from "../lib/recruiting_service.mjs";
import { keepFastestPerAthlete } from "../lib/athlete_leaders_service.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const write = process.argv.includes("--write");

const SPORT = "cross_country";
const EVENT_KEY = "xc_5k";
const SEASON_YEAR = 2026;
const GENDER_CODE = { boys: "M", girls: "F" }; // district_meets_2026.json race.division + this -> region_totals key (e.g. "M2")

const district = JSON.parse(fs.readFileSync(path.join(root, "dataimports", "district_meets_2026.json"), "utf8"));

const schoolLookup = await loadOhioSchoolLookup();

// --- 1. Resolve every entered school, once (schools repeat across races at the same site) ---
const unmatchedSchools = [];
const resolvedBySite = new Map(); // siteKey -> [{ raw, resolved }]
for (const site of district.sites) {
  const resolvedList = [];
  for (const entry of site.entered_schools) {
    const resolved = schoolLookup.resolve(entry.full_name) || schoolLookup.resolve(entry.athletic_net_name);
    if (!resolved) {
      unmatchedSchools.push({ site: site.key, athletic_net_name: entry.athletic_net_name, full_name: entry.full_name });
      continue;
    }
    resolvedList.push({ raw: entry, resolved });
  }
  resolvedBySite.set(site.key, resolvedList);
}

// --- 2. Real 2026 division per resolved school, both genders, in one batch ---
const allSchoolIds = [...new Set([...resolvedBySite.values()].flat().map((r) => r.resolved.id))];
const divisionsBySchool = new Map(); // schoolId -> { boys: N, girls: N }
for (let i = 0; i < allSchoolIds.length; i += 150) {
  const chunk = allSchoolIds.slice(i, i + 150);
  const { data, error } = await supabaseAdmin
    .from("ohio_school_divisions")
    .select("school_id, gender, division")
    .in("school_id", chunk)
    .eq("sport", SPORT)
    .eq("current", true);
  if (error) throw error;
  for (const row of data || []) {
    // ohio_school_divisions.division is a string label ("Division II"),
    // not the plain number district_meets_2026.json's race.division uses
    // -- convert once here so every downstream comparison is number-to-number.
    const match = /^Division (I{1,3}|IV)$/.exec(row.division || "");
    const romanToNumber = { I: 1, II: 2, III: 3, IV: 4 };
    const divisionNumber = match ? romanToNumber[match[1]] : null;
    if (divisionNumber == null) continue;
    if (!divisionsBySchool.has(row.school_id)) divisionsBySchool.set(row.school_id, {});
    divisionsBySchool.get(row.school_id)[row.gender] = divisionNumber;
  }
}

// --- 3. Assign each resolved school to its race (site, gender, division) ---
const racesBySite = new Map();
for (const race of district.races) {
  if (!racesBySite.has(race.site)) racesBySite.set(race.site, []);
  racesBySite.get(race.site).push(race);
}

function raceDataKey(site, gender, division, raceLabel) {
  return `${site}|${gender}|${division}|${raceLabel || ""}`;
}

// Every race on file gets an entry up front -- even one with zero
// assigned teams still appears on the site with an honest "not enough
// data yet" state, never silently dropped.
const races = new Map();
for (const race of district.races) {
  const key = raceDataKey(race.site, race.gender, race.division, race.race_label);
  races.set(key, {
    site: race.site,
    gender: race.gender,
    division: race.division,
    race_label: race.race_label || null,
    start_time: race.start_time,
    teams_advance: race.teams_advance,
    individuals_advance: race.individuals_advance,
    athletic_net_div_id: race.athletic_net_div_id,
    teams: [],
    missing: [] // entered schools not represented in `teams`, each with a reason
  });
}

function addMissing(key, schoolName, reason) {
  const race = races.get(key);
  if (race) race.missing.push({ school: schoolName, reason });
}

const unmatchedCount = unmatchedSchools.length;
const noDivisionOnFile = [];
const noMatchingRace = [];
const hilliardDarbyAmbiguous = [];
const assignments = []; // { site, race, schoolId, schoolName }

for (const [siteKey, resolvedList] of resolvedBySite) {
  const siteRaces = racesBySite.get(siteKey) || [];
  for (const { raw, resolved } of resolvedList) {
    const divisions = divisionsBySchool.get(resolved.id);
    for (const gender of ["boys", "girls"]) {
      const division = divisions?.[gender];
      if (division == null) {
        // Not every school fields both genders -- only report when this
        // site actually has a race for that gender (otherwise it's just
        // "this school doesn't run this gender," not a data gap). We
        // don't know which division's race it would have been, so this
        // is attached to every race of that gender at the site.
        const genderRaces = siteRaces.filter((r) => r.gender === gender);
        if (genderRaces.length) {
          noDivisionOnFile.push({ site: siteKey, school: resolved.school_name, gender });
          for (const r of genderRaces) {
            addMissing(raceDataKey(siteKey, r.gender, r.division, r.race_label), resolved.school_name, "no official division on file for this school/gender");
          }
        }
        continue;
      }
      const candidateRaces = siteRaces.filter((r) => r.gender === gender && r.division === division);
      if (!candidateRaces.length) {
        noMatchingRace.push({ site: siteKey, school: resolved.school_name, gender, division });
        continue;
      }
      if (candidateRaces.length > 1) {
        // Hilliard Darby Race 1 / Race 2 split -- we only have the
        // school's division from our own DB, not athletic.net's race-id
        // assignment, so we cannot tell which of the two races this
        // school is actually in. Flag rather than split arbitrarily
        // (brief's Known Gap #3).
        hilliardDarbyAmbiguous.push({ site: siteKey, school: resolved.school_name, gender, division, races: candidateRaces.map((r) => r.race_label) });
        for (const r of candidateRaces) {
          addMissing(raceDataKey(siteKey, r.gender, r.division, r.race_label), resolved.school_name, `entered at this site/division, but Race 1 vs Race 2 assignment isn't in our data`);
        }
        continue;
      }
      assignments.push({ site: siteKey, race: candidateRaces[0], schoolId: resolved.id, schoolName: resolved.school_name });
    }
  }
}

// --- 4. Season-best times per assigned school/gender, from the DB directly (2026-10-13 Athletic.net import + everything else already public) ---
// PostgREST silently caps an unbounded select at 1,000 rows regardless of
// .limit() -- the same shape behind the real 2026-08-31 vote-undercounting
// incident -- so this pages with .range() per school-id chunk rather than
// trusting a single large .limit() call.
const schoolIdsNeeded = [...new Set(assignments.map((a) => a.schoolId))];
const rosterRows = [];
const PAGE_SIZE = 1000;
for (let i = 0; i < schoolIdsNeeded.length; i += 150) {
  const chunk = schoolIdsNeeded.slice(i, i + 150);
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from("athlete_performances")
      .select("id, profile_id, school_id, mark_text, mark_value, grade")
      .in("school_id", chunk)
      .eq("sport", SPORT)
      .eq("event_key", EVENT_KEY)
      .eq("season_year", SEASON_YEAR)
      .eq("public_visible", true)
      .is("archived_at", null)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rosterRows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
}

const profileIds = [...new Set(rosterRows.map((r) => r.profile_id))];
const profilesById = new Map();
for (let i = 0; i < profileIds.length; i += 150) {
  const chunk = profileIds.slice(i, i + 150);
  const { data, error } = await supabaseAdmin
    .from("athlete_profiles")
    .select("id, display_name, gender, graduation_year, public_visible, suspended, archived_at, merged_into_profile_id")
    .in("id", chunk);
  if (error) throw error;
  for (const row of data || []) profilesById.set(row.id, row);
}

function gradeFromGraduationYear(graduationYear) {
  if (!graduationYear) return null;
  // 2026 cross country season: senior graduation year = 2027.
  const grade = 12 - (graduationYear - 2027);
  return grade >= 9 && grade <= 12 ? String(grade) : null;
}

const rosterByschoolGender = new Map(); // `${schoolId}|${gender}` -> rows
for (const row of rosterRows) {
  const profile = profilesById.get(row.profile_id);
  if (!profile || !profile.public_visible || profile.suspended || profile.archived_at || profile.merged_into_profile_id) continue;
  const key = `${row.school_id}|${profile.gender}`;
  if (!rosterByschoolGender.has(key)) rosterByschoolGender.set(key, []);
  rosterByschoolGender.get(key).push({ ...row, profile });
}

const noRosterFound = [];

for (const assignment of assignments) {
  const { site, race, schoolId, schoolName } = assignment;
  const key = raceDataKey(site, race.gender, race.division, race.race_label);

  const rows = rosterByschoolGender.get(`${schoolId}|${race.gender}`) || [];
  if (!rows.length) {
    noRosterFound.push({ site, school: schoolName, gender: race.gender, division: race.division });
    addMissing(key, schoolName, "entered, but no season-best 5K time on file for this school/gender yet");
    continue;
  }
  const fastestPerAthlete = keepFastestPerAthlete(rows);
  const top7 = fastestPerAthlete.slice(0, 7).map((row) => ({
    name: row.profile.display_name,
    grade: gradeFromGraduationYear(row.profile.graduation_year),
    graduationYear: row.profile.graduation_year,
    seasonBest: row.mark_text,
    timeCentiseconds: Math.round(Number(row.mark_value) * 100),
    athleticNetId: null,
    resultUrl: null
  }));
  races.get(key).teams.push({ name: schoolName, runners: top7, runnerCount: rows.length, fullRosterFound: rows.length >= 7 });
}

// --- Report ---
const racesWithTeams = [...races.values()].filter((r) => r.teams.length > 0).length;
console.log(`=== Mock Districts data build report (${write ? "WRITE" : "DRY RUN"}) ===`);
console.log(`Sites: ${district.sites.length}, races on file: ${district.races.length}, races with >=1 assigned team: ${racesWithTeams}, races with zero teams (will show "not enough data yet"): ${district.races.length - racesWithTeams}`);
console.log(`Unmatched schools (no real ohio_schools match): ${unmatchedSchools.length}`);
for (const u of unmatchedSchools) console.log(`  - [${u.site}] "${u.athletic_net_name}" / "${u.full_name}"`);
console.log(`Schools with no current ohio_school_divisions row for a gender this site races: ${noDivisionOnFile.length}`);
for (const n of noDivisionOnFile) console.log(`  - [${n.site}] ${n.school} (${n.gender})`);
console.log(`Schools whose resolved division has no race at their site: ${noMatchingRace.length}`);
for (const n of noMatchingRace) console.log(`  - [${n.site}] ${n.school} ${n.gender} D${n.division}`);
console.log(`Hilliard Darby (or similar) race-split ambiguity, not assigned: ${hilliardDarbyAmbiguous.length}`);
for (const h of hilliardDarbyAmbiguous) console.log(`  - [${h.site}] ${h.school} ${h.gender} D${h.division} -> ${h.races.join(" / ")}`);
console.log(`Assigned schools with zero season-best runners found in our DB: ${noRosterFound.length}`);
for (const n of noRosterFound) console.log(`  - [${n.site}] ${n.school} ${n.gender} D${n.division}`);

let incompleteCount = 0;
for (const r of races.values()) {
  for (const t of r.teams) if (!t.fullRosterFound) incompleteCount += 1;
}
console.log(`Assigned teams with fewer than 7 runners found in our DB (still included, roster may be incomplete): ${incompleteCount}`);

if (write) {
  const output = {
    schemaVersion: 1,
    seasonLabel: "2026",
    meetDate: district.meet_date,
    regionalDate: district.regional_date,
    asOf: district.as_of,
    source: district.source,
    sourceUrl: null,
    regionalByRegion: district.regional_by_region,
    regionTotals: district.region_totals,
    northeastNote: district.northeast_note,
    sites: district.sites.map((s) => ({ key: s.key, name: s.name, region: s.region, regional: s.regional, athleticNetMeetId: s.athletic_net_meet_id, url: s.url })),
    races: [...races.values()].map((r) => ({ ...r, status: "projected" }))
  };
  const outPath = path.join(root, "src", "data", "mock-districts-2026.json");
  fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`\nWrote ${outPath}`);
}
