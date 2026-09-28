// Mock Meet Export -- CLI entry point.
//
// Connects the REAL, already-existing athlete performance system
// (athlete_best_performances, populated entirely by
// lib/result_ingestion_engine.mjs's own existing CSV/staging/review
// pipeline -- unmodified by this script) to the static mock regionals
// JSON (src/data/mock-regionals-2026.json). All matching, merging, and
// diffing logic lives in lib/mock_meet_export_service.mjs (pure,
// tested against fixtures in tests/mock-meet-export.test.mjs); this
// file is only I/O -- the Supabase fetch, the two real school/candidate
// data joins, and writing the draft/report/promoted files.
//
// Usage:
//   node --env-file=.env.local scripts/mock-meet-export.mjs --mode=preview
//   node --env-file=.env.local scripts/mock-meet-export.mjs --mode=apply
//
// Preview mode makes no permanent changes: it writes a draft JSON and a
// machine-readable report to dataimports/mock-meet-export/ (untracked,
// per this project's standing dataimports/ convention) and prints a
// terminal summary. Apply mode re-runs the exact same computation
// against current data, then promotes the result into
// src/data/mock-regionals-2026.json -- the live mock meet pages remain
// fully static/build-time; nothing about their architecture changes,
// this only updates the JSON a normal `npm run build` already reads.
// Apply never pushes, deploys, or runs anything outside this local
// repository.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { supabaseAdmin, fetchInChunks } from "../lib/supabase-admin.mjs";
import {
  MOCK_MEET_SEASON_YEAR,
  isEligibleCrossCountryRow,
  realPerformanceToCandidate,
  mergeDivision
} from "../lib/mock_meet_export_service.mjs";
import { LEADERS_SPORT, LEADERS_EVENT_KEY } from "../lib/athlete_leaders_service.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const mockDataPath = path.join(root, "src/data/mock-regionals-2026.json");
const outputDir = path.join(root, "dataimports/mock-meet-export");

const mode = (process.argv.find((arg) => arg.startsWith("--mode="))?.split("=")[1]) || "preview";
if (!["preview", "apply"].includes(mode)) {
  console.error('Usage: node --env-file=.env.local scripts/mock-meet-export.mjs --mode=preview|apply');
  process.exit(1);
}

// ---------------------------------------------------------------------
// Fetch: real approved 2026 cross country 5K season bests, plus the
// real athlete/school identity needed to match them to mock rosters.
// Every step below is a read against tables the existing ingestion
// system already owns -- nothing here writes to athlete_performances,
// athlete_profiles, or any real table.
// ---------------------------------------------------------------------
// Bounded .range() pagination, not one unbounded select -- the exact
// discipline lib/awards_service.mjs's fetchAllVoterHashesForWeek()
// already established after the 2026-08-31 vote-undercounting incident
// (docs/DECISIONS.md): never trust a single page of results without a
// real signal that nothing was left behind. Found directly while
// verifying this script against real production data: a bare .select()
// against athlete_best_performances silently returned exactly 1000 rows
// (PostgREST's default page cap) against a real total of 2912 -- almost
// two-thirds of real, eligible season bests would have been silently
// invisible to every mock meet update without this.
const SEASON_BEST_PAGE_SIZE = 1000;

async function fetchRealSeasonBests() {
  const rows = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await supabaseAdmin
      .from("athlete_best_performances")
      .select("profile_id, school_id, mark_text, mark_value, meet_name, meet_date, source_url, source_type, verification_status, sport, event_key, season_year")
      .eq("sport", LEADERS_SPORT)
      .eq("event_key", LEADERS_EVENT_KEY)
      .eq("season_year", MOCK_MEET_SEASON_YEAR)
      .range(offset, offset + SEASON_BEST_PAGE_SIZE - 1);
    if (error) throw error;

    const page = data || [];
    rows.push(...page);
    if (page.length < SEASON_BEST_PAGE_SIZE) break;
    offset += SEASON_BEST_PAGE_SIZE;
  }

  return rows.filter((row) => isEligibleCrossCountryRow(row, { seasonYear: MOCK_MEET_SEASON_YEAR }));
}

async function fetchProfiles(profileIds) {
  const rows = await fetchInChunks(
    "athlete_profiles",
    "id, display_name, gender, graduation_year, current_school_id",
    "id",
    profileIds
  );
  return new Map(rows.map((row) => [row.id, row]));
}

async function fetchAthleticNetAliases(profileIds) {
  const rows = await fetchInChunks(
    "athlete_profile_aliases",
    "profile_id, alias, alias_type, external_source",
    "profile_id",
    profileIds,
    (query) => query.eq("alias_type", "external_id")
  );
  const map = new Map();
  for (const row of rows) {
    // external_source is free text (no check constraint) -- admins have
    // typed "athletic.net" per the admin form's own placeholder, but
    // tolerate any real variant rather than an exact-string match that
    // could silently miss a differently-capitalized or differently-
    // punctuated real row.
    if (row.external_source && /athletic.?net/i.test(row.external_source) && row.alias) {
      map.set(row.profile_id, row.alias);
    }
  }
  return map;
}

async function fetchSchoolOhsaaIds(schoolIds) {
  const rows = await fetchInChunks("ohio_schools", "id, ohsaa_school_id, school_name", "id", schoolIds);
  return new Map(rows.map((row) => [row.id, row.ohsaa_school_id]));
}

// ---------------------------------------------------------------------
// Build candidates: join real performance rows with real profile/school/
// alias data, resolve each candidate's school identity to the SAME
// numeric OHSAA school ID mock team objects already carry
// (team.ohsaaSchoolId), and split into one candidate list per gender --
// each mock division dataset is single-gender, so a boys division must
// never see a girls candidate or vice versa.
// ---------------------------------------------------------------------
async function buildCandidatesByGender() {
  const bestRows = await fetchRealSeasonBests();
  if (!bestRows.length) {
    return { boys: new Map(), girls: new Map(), unresolvedSchools: [], rawCount: 0 };
  }

  const profileIds = [...new Set(bestRows.map((r) => r.profile_id))];
  const schoolIds = [...new Set(bestRows.map((r) => r.school_id).filter(Boolean))];

  const [profilesById, athleticNetByProfile, schoolOhsaaById] = await Promise.all([
    fetchProfiles(profileIds),
    fetchAthleticNetAliases(profileIds),
    fetchSchoolOhsaaIds(schoolIds)
  ]);

  const byGender = { boys: new Map(), girls: new Map() };
  const unresolvedSchools = new Set();

  for (const row of bestRows) {
    const profile = profilesById.get(row.profile_id);
    if (!profile) continue; // No matching profile is itself a data-integrity gap, not this script's job to guess at.

    const ohsaaSchoolId = row.school_id ? schoolOhsaaById.get(row.school_id) : null;
    if (row.school_id && !ohsaaSchoolId) {
      unresolvedSchools.add(row.school_id);
      continue;
    }

    const candidate = realPerformanceToCandidate(
      { ...row, display_name: profile.display_name, gender: profile.gender, graduation_year: profile.graduation_year },
      { athleticNetId: athleticNetByProfile.get(row.profile_id) || null }
    );
    candidate.schoolId = ohsaaSchoolId;

    const genderKey = profile.gender === "girls" ? "girls" : profile.gender === "boys" ? "boys" : null;
    if (!genderKey) continue; // Unspecified gender: excluded, not guessed into a division.

    if (!byGender[genderKey].has(ohsaaSchoolId)) byGender[genderKey].set(ohsaaSchoolId, []);
    byGender[genderKey].get(ohsaaSchoolId).push(candidate);
  }

  return { ...byGender, unresolvedSchools: [...unresolvedSchools], rawCount: bestRows.length };
}

// ---------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------
async function run() {
  const regionalsData = JSON.parse(fs.readFileSync(mockDataPath, "utf8"));
  const { boys, girls, unresolvedSchools, rawCount } = await buildCandidatesByGender();

  const affectedDivisions = [];
  const allTeamChanges = [];
  const allRegionalDiffs = [];
  const allStateDiffs = [];
  const allUnresolvedTeams = new Set();

  const draftDivisions = regionalsData.divisions.map((divisionEntry) => {
    const candidatesByOhsaaId = divisionEntry.gender === "girls" ? girls : boys;
    const result = mergeDivision(divisionEntry, candidatesByOhsaaId);

    for (const [, regionResult] of Object.entries(result.regionResults)) {
      if (regionResult.teamChanges?.length) {
        allTeamChanges.push(...regionResult.teamChanges.map((c) => ({ division: divisionEntry.label, ...c })));
      }
      if (regionResult.regionalDiff?.length) {
        allRegionalDiffs.push(...regionResult.regionalDiff.map((d) => ({ division: divisionEntry.label, ...d })));
      }
      for (const teamName of regionResult.unresolvedTeams || []) {
        allUnresolvedTeams.add(`${divisionEntry.label} / ${teamName}`);
      }
    }
    if (result.stateDiff?.length) {
      allStateDiffs.push(...result.stateDiff.map((d) => ({ division: divisionEntry.label, ...d })));
    }
    if (result.affected) affectedDivisions.push(divisionEntry.label);

    return result.division;
  });

  const draftData = { ...regionalsData, divisions: draftDivisions };

  const seasonBestImprovements = allTeamChanges.flatMap((tc) => tc.changes.filter((c) => c.type === "season_best_improved").map((c) => ({ division: tc.division, team: tc.team, ...c })));
  const slowerPreserved = allTeamChanges.flatMap((tc) => tc.changes.filter((c) => c.type === "slower_performance_preserved"));
  const newAthletes = allTeamChanges.flatMap((tc) => tc.changes.filter((c) => c.type === "new_athlete_added"));
  const teamsWithTopSevenChanges = new Set(allTeamChanges.filter((tc) => tc.changes.some((c) => ["season_best_improved", "new_athlete_added", "runner_dropped_from_top_seven"].includes(c.type))).map((tc) => `${tc.division} / ${tc.team}`));

  const summary = {
    rows_received: rawCount,
    real_candidates_matched_by_gender: { boys: [...boys.values()].reduce((n, a) => n + a.length, 0), girls: [...girls.values()].reduce((n, a) => n + a.length, 0) },
    schools_unresolved_ohsaa_id: unresolvedSchools.length,
    teams_school_identity_unresolved: [...allUnresolvedTeams],
    new_athletes: newAthletes.length,
    athletes_with_new_season_bests: seasonBestImprovements.length,
    slower_performances_preserved: slowerPreserved.length,
    teams_with_top_seven_changes: teamsWithTopSevenChanges.size,
    divisions_affected: affectedDivisions,
    regional_rankings_changed: allRegionalDiffs.filter((d) => d.type === "regional_team_changed").length,
    regional_qualifiers_changed: allRegionalDiffs.filter((d) => d.type === "regional_team_changed" && d.previousQualifies !== d.newQualifies).length,
    state_qualifiers_changed: allStateDiffs.filter((d) => d.type === "regional_team_changed" || d.type.startsWith("individual_qualifier")).length,
    state_scores_changed: allStateDiffs.filter((d) => d.type === "regional_team_changed" && d.previousScore !== d.newScore).length
  };

  const report = {
    generated_at: new Date().toISOString(),
    mode,
    season_year: MOCK_MEET_SEASON_YEAR,
    summary,
    season_best_improvements: seasonBestImprovements,
    slower_performances_preserved: slowerPreserved,
    new_athletes: newAthletes,
    regional_diffs: allRegionalDiffs,
    state_diffs: allStateDiffs
  };

  console.log(`\nMock Meet Export -- ${mode.toUpperCase()} mode`);
  console.log("=".repeat(50));
  for (const [key, value] of Object.entries(summary)) {
    console.log(`${key}: ${Array.isArray(value) ? value.length : typeof value === "object" ? JSON.stringify(value) : value}`);
  }
  console.log("=".repeat(50));

  if (mode === "preview") {
    fs.mkdirSync(outputDir, { recursive: true });
    const draftPath = path.join(outputDir, "draft-mock-regionals-2026.json");
    const reportPath = path.join(outputDir, "report.json");
    fs.writeFileSync(draftPath, JSON.stringify(draftData, null, 2) + "\n");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
    console.log(`\nDraft JSON written to: ${path.relative(root, draftPath)}`);
    console.log(`Report written to: ${path.relative(root, reportPath)}`);
    console.log("No changes made to the published mock meet data.");
  } else {
    fs.writeFileSync(mockDataPath, JSON.stringify(draftData, null, 2) + "\n");
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, "last-apply-report.json"), JSON.stringify(report, null, 2) + "\n");
    console.log(`\nPromoted draft into: ${path.relative(root, mockDataPath)}`);
    console.log("Run `npm run build` to regenerate the mock meet pages from this data.");
    console.log("Not committed, not pushed, not deployed -- review with `git diff` before committing.");
  }
}

run().catch((error) => {
  console.error("Mock meet export failed:", error);
  process.exit(1);
});
