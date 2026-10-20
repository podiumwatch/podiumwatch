// Converts the ohio_2026_xc_Claude_Code package (full statewide 2026
// Ohio XC coverage: 1,383 school/category records, 8,158 accepted
// runners) into a candidate replacement dataset for the Mock
// Regionals/State feature.
//
// This is a LOCAL, UNWIRED candidate only -- it writes
// ohio_2026_xc_full_statewide_2026.json next to the source package, not
// into src/data/, and does not touch src/pages/mockregionals.mjs or
// scripts/build.mjs. Nothing here is live until a human decides how to
// handle the one real architectural gap this script surfaces: the
// package has no "region" field (Central/Northeast/Northwest/Southwest),
// but the current Mock Regionals feature is organized entirely by
// region, with real per-region stateQualifiers/individualQualifiers
// counts from OHSAA's own document. Region is resolved here only where
// an exact, unambiguous name match exists against the project's own
// dataimports/mock-meet-export/ohsaa_official_directory.json; every
// other school is left with region: null and reported, never guessed.
//
// Preserves (per READ_ME_FIRST.txt and AGENTS.md rule 2 -- never invent
// data): athlete_url/team_url as the strongest identity keys, displayed
// names, grades (blank where unclear), accepted eligible times (not the
// athlete's all-event season best -- these exclude Open races per the
// package's own stated rule), meet dates, source links, collection
// timestamps, verification status, notes, and every review flag
// (provisional, division_review, identity_review, seventh_tie).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pkgDir = path.dirname(fileURLToPath(import.meta.url));

const EXPECTED_TOTALS = {
  boys_d1: { schools: 85, runners: 580 },
  boys_d2: { schools: 172, runners: 1154 },
  boys_d3: { schools: 197, runners: 1223 },
  boys_d4: { schools: 240, runners: 1324 },
  girls_d1: { schools: 77, runners: 505 },
  girls_d2: { schools: 158, runners: 1006 },
  girls_d3: { schools: 191, runners: 1107 },
  girls_d4: { schools: 263, runners: 1259 }
};

const data = JSON.parse(fs.readFileSync(path.join(pkgDir, "ohio_2026_xc_validated_data.json"), "utf8"));
const directory = JSON.parse(fs.readFileSync(path.join(root, "dataimports/mock-meet-export/ohsaa_official_directory.json"), "utf8"));

function normName(s) {
  return String(s || "").trim().toUpperCase().replace(/\s+/g, " ");
}

const directoryByName = new Map();
for (const row of directory) {
  const key = normName(row.school_name);
  if (!directoryByName.has(key)) directoryByName.set(key, []);
  directoryByName.get(key).push(row);
}

function resolveRegion(schoolNameOhsaa) {
  const candidates = directoryByName.get(normName(schoolNameOhsaa)) || [];
  if (candidates.length === 1) {
    return { region: candidates[0].athletic_district || null, ohsaaSchoolId: candidates[0].ohsaa_school_id, city: candidates[0].city || null, matchType: "exact" };
  }
  if (candidates.length === 0) return { region: null, ohsaaSchoolId: null, city: null, matchType: "unmatched" };
  return { region: null, ohsaaSchoolId: null, city: null, matchType: "ambiguous", candidateCount: candidates.length };
}

function athleticNetIdFromUrl(url) {
  const m = /\/athlete\/(\d+)\//.exec(url || "");
  return m ? m[1] : null;
}

function gradYearFromGrade(gradeNormalized) {
  // 2026 cross country season: senior (grade 12) graduates 2027, matching
  // lib/athlete_foundation_service.mjs's deriveGraduationYearFromGrade().
  if (gradeNormalized == null) return null;
  return 2027 + (12 - gradeNormalized);
}

// --- index runners by (gender, division, team_url) ---
const runnersByTeam = new Map();
for (const r of data.runners) {
  const key = [r.gender, r.division, r.team_url].join("|");
  if (!runnersByTeam.has(key)) runnersByTeam.set(key, []);
  runnersByTeam.get(key).push(r);
}

// --- index duplicate/tie/gap info by team for attaching to output ---
const duplicatesByTeam = new Map();
for (const d of data.duplicates) {
  const key = [d.gender, d.division, d.school].join("|");
  if (!duplicatesByTeam.has(key)) duplicatesByTeam.set(key, []);
  duplicatesByTeam.get(key).push(d);
}
const tiesByTeam = new Map();
for (const t of data.ties) {
  const key = [t.gender, t.division, t.school].join("|");
  if (!tiesByTeam.has(key)) tiesByTeam.set(key, []);
  tiesByTeam.get(key).push(t);
}

// --- build team objects from coverage (authoritative school/category list) ---
const regionStats = { exact: 0, ambiguous: 0, unmatched: 0 };
const unresolvedRegionSchools = [];
const categories = {}; // e.g. "boys_d1" -> { teams: [] }

for (const c of data.coverage) {
  const categoryKey = `${c.gender.toLowerCase()}_${c.division.toLowerCase()}`;
  if (!categories[categoryKey]) categories[categoryKey] = { gender: c.gender, division: c.division, teams: [] };

  const regionInfo = resolveRegion(c.school_name_ohsaa || c.school_name_athleticnet);
  regionStats[regionInfo.matchType === "exact" ? "exact" : regionInfo.matchType === "ambiguous" ? "ambiguous" : "unmatched"]++;
  if (regionInfo.matchType !== "exact") {
    unresolvedRegionSchools.push({
      gender: c.gender, division: c.division, school: c.school_name_athleticnet,
      schoolNameOhsaa: c.school_name_ohsaa, matchType: regionInfo.matchType, teamUrl: c.team_url
    });
  }

  const runnersKey = [c.gender, c.division, c.team_url].join("|");
  const rawRunners = (runnersByTeam.get(runnersKey) || []).slice().sort((a, b) => a.team_runner_rank - b.team_runner_rank);

  const runners = rawRunners.map((r) => ({
    name: r.athlete_name,
    grade: r.grade_displayed || null,
    graduationYear: gradYearFromGrade(r.grade_normalized),
    seasonBest: r.season_best_time,
    timeCentiseconds: Math.round(r.time_seconds * 100),
    athleticNetId: athleticNetIdFromUrl(r.athlete_url),
    athleteUrl: r.athlete_url,
    resultUrl: r.result_url,
    meetName: r.meet_name,
    meetDate: r.meet_date,
    verificationStatus: r.verification_status,
    collectedAtEastern: r.collected_at_eastern,
    notes: r.notes || null
  }));

  const teamKey = [c.gender, c.division, c.school_name_athleticnet].join("|");
  categories[categoryKey].teams.push({
    name: c.school_name_athleticnet,
    schoolNameOhsaa: c.school_name_ohsaa || null,
    teamUrl: c.team_url,
    region: regionInfo.region,
    regionMatchType: regionInfo.matchType,
    ohsaaSchoolId: regionInfo.ohsaaSchoolId,
    city: regionInfo.city,
    provisional: Boolean(c.provisional),
    divisionReview: Boolean(c.division_review),
    identityReview: Boolean(c.identity_review),
    seventhTie: Boolean(c.seventh_tie),
    missingPositions: c.missing_positions,
    runners,
    duplicateConcerns: duplicatesByTeam.get(teamKey) || [],
    seventhPositionTies: tiesByTeam.get(teamKey) || []
  });
}

// --- validate against the user-supplied category totals ---
console.log("=== Category total reconciliation ===");
let allMatch = true;
let totalSchools = 0, totalRunners = 0;
for (const [key, expected] of Object.entries(EXPECTED_TOTALS)) {
  const actual = categories[key];
  const schools = actual ? actual.teams.length : 0;
  const runners = actual ? actual.teams.reduce((n, t) => n + t.runners.length, 0) : 0;
  totalSchools += schools;
  totalRunners += runners;
  const ok = schools === expected.schools && runners === expected.runners;
  if (!ok) allMatch = false;
  console.log(`${key}: schools ${schools}/${expected.schools} ${schools === expected.schools ? "OK" : "MISMATCH"}, runners ${runners}/${expected.runners} ${runners === expected.runners ? "OK" : "MISMATCH"}`);
}
console.log(`TOTAL: ${totalSchools} schools (expected 1383), ${totalRunners} runners (expected 8158)`);
console.log(allMatch ? "All 8 categories match exactly." : "DISCREPANCY FOUND -- see above.");

console.log("\n=== Region resolution ===");
console.log(`exact match: ${regionStats.exact}, ambiguous (same name, multiple districts): ${regionStats.ambiguous}, unmatched: ${regionStats.unmatched}`);
console.log(`${unresolvedRegionSchools.length} schools have no resolved region (left null, not guessed).`);

// --- duplicate athlete_url across different accepted teams (should be zero per README) ---
const athleteUrlSeen = new Map();
let crossTeamDuplicates = 0;
for (const cat of Object.values(categories)) {
  for (const team of cat.teams) {
    for (const r of team.runners) {
      if (!r.athleteUrl) continue;
      const key = `${cat.gender}|${cat.division}|${r.athleteUrl}`;
      if (athleteUrlSeen.has(key)) {
        crossTeamDuplicates++;
        console.log(`DUPLICATE athlete_url within same category: ${r.athleteUrl} on both ${athleteUrlSeen.get(key)} and ${team.name}`);
      } else {
        athleteUrlSeen.set(key, team.name);
      }
    }
  }
}
console.log(`\nCross-team duplicate athlete_url check: ${crossTeamDuplicates} found (expected 0).`);

const provisionalCount = Object.values(categories).reduce((n, cat) => n + cat.teams.filter((t) => t.provisional).length, 0);
const identityReviewCount = Object.values(categories).reduce((n, cat) => n + cat.teams.filter((t) => t.identityReview).length, 0);
const divisionReviewCount = Object.values(categories).reduce((n, cat) => n + cat.teams.filter((t) => t.divisionReview).length, 0);
console.log(`Provisional teams: ${provisionalCount}, identity-review teams: ${identityReviewCount}, division-review teams: ${divisionReviewCount}`);

const output = {
  schemaVersion: 1,
  sourcePackage: "ohio_2026_xc_Claude_Code",
  sourceMetadata: data.metadata,
  seasonLabel: "2026",
  generatedAt: new Date().toISOString(),
  notes: [
    "Full statewide 2026 Ohio HS cross country coverage (not limited to a top-N subset), built from dataimports/ohio_2026_xc_Claude_Code/ohio_2026_xc_validated_data.json.",
    "season_best_time/timeCentiseconds is the fastest VERIFIED ELIGIBLE 2026 5,000m performance under the package's exclusion rule for Open and combined Varsity/Open races -- it can be slower than an athlete's displayed all-event season best.",
    "region/regionMatchType: region is populated only for an exact, unambiguous match against dataimports/mock-meet-export/ohsaa_official_directory.json's athletic_district. 'ambiguous' means the school name matches more than one official district entry; 'unmatched' means no official directory entry was found. Neither is guessed.",
    "provisional/divisionReview/identityReview/seventhTie are preserved exactly from the source package's coverage records -- see duplicateConcerns and seventhPositionTies on each team for the underlying detail.",
    "This file is a candidate dataset only. It has not been wired into src/pages/mockregionals.mjs or scripts/build.mjs."
  ],
  categories
};

const outPath = path.join(pkgDir, "ohio_2026_xc_full_statewide_2026.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`\nWrote ${outPath}`);

// --- unmatched/ambiguous region report, separate file for easy review ---
const reportPath = path.join(pkgDir, "region_resolution_report.json");
fs.writeFileSync(reportPath, JSON.stringify(unresolvedRegionSchools, null, 2));
console.log(`Wrote ${reportPath} (${unresolvedRegionSchools.length} schools needing manual region review)`);
