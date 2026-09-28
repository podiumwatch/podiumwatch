// Mock Meet Export -- CLI entry point.
//
// Connects the REAL, already-existing athlete performance system
// (athlete_best_performances, populated entirely by
// lib/result_ingestion_engine.mjs's own existing CSV/staging/review
// pipeline -- unmodified by this script) to the static mock regionals
// JSON (src/data/mock-regionals-2026.json). All matching, merging, and
// diffing logic lives in lib/mock_meet_export_service.mjs (pure,
// tested against fixtures in tests/mock-meet-export.test.mjs); this
// file is only I/O -- the Supabase fetch, the school/candidate data
// joins, and writing the draft/report/promoted files.
//
// Usage:
//   node --env-file=.env.local scripts/mock-meet-export.mjs --mode=preview
//   node --env-file=.env.local scripts/mock-meet-export.mjs --mode=apply --draft-id=<uuid>
//   node --env-file=.env.local scripts/mock-meet-export.mjs --mode=apply --draft-hash=<sha256 hex>
//
// PREVIEW makes no permanent changes and never touches
// src/data/mock-regionals-2026.json. It queries Supabase once, writes
// a self-contained, uniquely-identified draft folder under
// dataimports/mock-meet-export/<draftId>/ (manifest.json + the draft
// JSON + the comparison report + human-readable Markdown reports), and
// prints a terminal summary.
//
// APPLY is deliberately a completely different code path: it takes NO
// Supabase connection at all (see runApply() below -- supabaseAdmin is
// never imported into that function's closure) and does NOT recompute
// anything. It requires --draft-id or --draft-hash, loads that exact
// draft folder, and refuses unless every one of these holds:
//   1. The draft folder/manifest can be found.
//   2. The draft JSON's current on-disk hash still matches the hash
//      recorded in the manifest at preview time (the draft was not
//      hand-edited or regenerated since you reviewed it).
//   3. The CURRENTLY published mock-regionals-2026.json still hashes to
//      the same value it did when preview ran (nothing else changed the
//      published data out from under this draft).
//   4. The draft re-passes validateDivisionRoster with zero problems.
//   5. The manifest's blocking_errors list is empty.
// Only then is the draft promoted into src/data/mock-regionals-2026.json.
// Apply never pushes, deploys, or touches any table.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { supabaseAdmin, fetchInChunks } from "../lib/supabase-admin.mjs";
import {
  MOCK_MEET_SEASON_YEAR,
  isEligibleCrossCountryRow,
  isEligibleSchoolLevel,
  computeContentHash,
  realPerformanceToCandidate,
  mergeDivision
} from "../lib/mock_meet_export_service.mjs";
import { validateDivisionRoster, scoreTeams } from "../src/lib/mock_scoring.mjs";
import { LEADERS_SPORT, LEADERS_EVENT_KEY } from "../lib/athlete_leaders_service.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const mockDataPath = path.join(root, "src/data/mock-regionals-2026.json");
const outputRoot = path.join(root, "dataimports/mock-meet-export");

function arg(name) {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split("=").slice(1).join("=") : null;
}

const mode = arg("mode") || "preview";
if (!["preview", "apply"].includes(mode)) {
  console.error("Usage:");
  console.error("  node --env-file=.env.local scripts/mock-meet-export.mjs --mode=preview");
  console.error("  node --env-file=.env.local scripts/mock-meet-export.mjs --mode=apply --draft-id=<uuid>");
  process.exit(1);
}

// ---------------------------------------------------------------------
// PREVIEW: the only mode that touches Supabase.
// ---------------------------------------------------------------------

// Bounded .range() pagination, not one unbounded select -- the exact
// discipline lib/awards_service.mjs's fetchAllVoterHashesForWeek()
// already established after the 2026-08-31 vote-undercounting incident
// (docs/DECISIONS.md): never trust a single page of results without a
// real signal that nothing was left behind. Found directly while
// verifying this script against real production data: a bare .select()
// against athlete_best_performances silently returned exactly 1000 rows
// (PostgREST's default page cap) against a real total of 2912.
const PAGE_SIZE = 1000;

async function fetchAllPages(build) {
  const rows = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await build().range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return rows;
}

async function fetchRealSeasonBests() {
  const rows = await fetchAllPages(() =>
    supabaseAdmin
      .from("athlete_best_performances")
      .select("profile_id, school_id, mark_text, mark_value, meet_name, meet_date, source_url, source_type, verification_status, public_visible, result_status, sport, event_key, season_year")
      .eq("sport", LEADERS_SPORT)
      .eq("event_key", LEADERS_EVENT_KEY)
      .eq("season_year", MOCK_MEET_SEASON_YEAR)
  );
  return rows.filter((row) => isEligibleCrossCountryRow(row, { seasonYear: MOCK_MEET_SEASON_YEAR }));
}

async function fetchProfiles(profileIds) {
  const rows = await fetchInChunks("athlete_profiles", "id, display_name, gender, graduation_year, current_school_id", "id", profileIds);
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
    // tolerate any real variant rather than an exact-string match.
    if (row.external_source && /athletic.?net/i.test(row.external_source) && row.alias) {
      map.set(row.profile_id, row.alias);
    }
  }
  return map;
}

async function fetchSchools(schoolIds) {
  const rows = await fetchInChunks("ohio_schools", "id, ohsaa_school_id, school_name, program_level", "id", schoolIds);
  return new Map(rows.map((row) => [row.id, row]));
}

// Best-effort, read-only fuzzy suggestions for the manual "possible Ohio
// schools matches" column in the unresolved-teams report -- never used
// to auto-resolve anything, only surfaced for a human to confirm. Token
// overlap against ohio_schools.normalized_name / ohio_school_aliases.normalized_alias.
async function suggestSchoolMatches(teamName) {
  const tokens = teamName.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length > 2);
  if (!tokens.length) return [];

  const orClause = tokens.map((t) => `normalized_name.ilike.%${t}%`).join(",");
  const { data: schoolRows, error: schoolError } = await supabaseAdmin
    .from("ohio_schools")
    .select("ohsaa_school_id, school_name, city, athletic_district")
    .or(orClause)
    .limit(8);
  if (schoolError) throw schoolError;

  const aliasOr = tokens.map((t) => `normalized_alias.ilike.%${t}%`).join(",");
  const { data: aliasRows, error: aliasError } = await supabaseAdmin
    .from("ohio_school_aliases")
    .select("alias, school_id, ohio_schools:school_id(ohsaa_school_id, school_name, city, athletic_district)")
    .or(aliasOr)
    .limit(8);
  if (aliasError) throw aliasError;

  const seen = new Map();
  for (const row of schoolRows || []) {
    seen.set(row.ohsaa_school_id, { ohsaaSchoolId: row.ohsaa_school_id, schoolName: row.school_name, city: row.city, athleticDistrict: row.athletic_district, matchedVia: "school name" });
  }
  for (const row of aliasRows || []) {
    if (row.ohio_schools && !seen.has(row.ohio_schools.ohsaa_school_id)) {
      seen.set(row.ohio_schools.ohsaa_school_id, { ohsaaSchoolId: row.ohio_schools.ohsaa_school_id, schoolName: row.ohio_schools.school_name, city: row.ohio_schools.city, athleticDistrict: row.ohio_schools.athletic_district, matchedVia: `alias "${row.alias}"` });
    }
  }
  return [...seen.values()];
}

async function buildCandidatesByGender() {
  const supabaseRetrievedAt = new Date().toISOString();
  const bestRows = await fetchRealSeasonBests();
  if (!bestRows.length) {
    return { boys: new Map(), girls: new Map(), unresolvedSchools: [], excludedNonHighSchool: 0, rawCount: 0, supabaseRetrievedAt };
  }

  const profileIds = [...new Set(bestRows.map((r) => r.profile_id))];
  const schoolIds = [...new Set(bestRows.map((r) => r.school_id).filter(Boolean))];

  const [profilesById, athleticNetByProfile, schoolsById] = await Promise.all([
    fetchProfiles(profileIds),
    fetchAthleticNetAliases(profileIds),
    fetchSchools(schoolIds)
  ]);

  const byGender = { boys: new Map(), girls: new Map() };
  const unresolvedSchools = new Set();
  let excludedNonHighSchool = 0;

  for (const row of bestRows) {
    const profile = profilesById.get(row.profile_id);
    if (!profile) continue; // No matching profile is a data-integrity gap upstream, not something to guess at here.

    const school = row.school_id ? schoolsById.get(row.school_id) : null;
    if (row.school_id && !school) {
      unresolvedSchools.add(row.school_id);
      continue;
    }
    if (school && !isEligibleSchoolLevel(school.program_level)) {
      excludedNonHighSchool += 1;
      continue;
    }

    const candidate = realPerformanceToCandidate(
      { ...row, display_name: profile.display_name, gender: profile.gender, graduation_year: profile.graduation_year },
      { athleticNetId: athleticNetByProfile.get(row.profile_id) || null }
    );
    candidate.schoolId = school ? school.ohsaa_school_id : null;

    const genderKey = profile.gender === "girls" ? "girls" : profile.gender === "boys" ? "boys" : null;
    if (!genderKey) continue; // Unspecified gender: excluded, not guessed into a division.

    if (!byGender[genderKey].has(candidate.schoolId)) byGender[genderKey].set(candidate.schoolId, []);
    byGender[genderKey].get(candidate.schoolId).push(candidate);
  }

  return { ...byGender, unresolvedSchools: [...unresolvedSchools], excludedNonHighSchool, rawCount: bestRows.length, supabaseRetrievedAt };
}

function findTeamInPublishedData(regionalsData, division, region, teamName) {
  const div = regionalsData.divisions.find((d) => d.label === division);
  const reg = div?.regions?.[region];
  return reg?.teams.find((t) => t.name === teamName) || null;
}

function teamCurrentlyQualifiesForState(regionalsData, division, regionKey, teamName) {
  const div = regionalsData.divisions.find((d) => d.label === division);
  const region = div?.regions?.[regionKey];
  if (!region) return null;
  const { teams: scored } = scoreTeams(region.teams, region.individuals || []);
  const found = scored.find((t) => t.name === teamName);
  if (!found) return null;
  return Boolean(found.complete && found.mockRank <= region.stateQualifiers);
}

async function runPreview() {
  const regionalsData = JSON.parse(fs.readFileSync(mockDataPath, "utf8"));
  const publishedHash = computeContentHash(regionalsData);
  const { boys, girls, unresolvedSchools, excludedNonHighSchool, rawCount, supabaseRetrievedAt } = await buildCandidatesByGender();

  const affectedDivisions = [];
  const allTeamChanges = [];
  const allRegionalDiffs = [];
  const allStateDiffs = [];
  const unresolvedTeamRecords = [];

  const draftDivisions = regionalsData.divisions.map((divisionEntry) => {
    const candidatesByOhsaaId = divisionEntry.gender === "girls" ? girls : boys;
    const result = mergeDivision(divisionEntry, candidatesByOhsaaId);

    for (const [regionKey, regionResult] of Object.entries(result.regionResults)) {
      if (regionResult.teamChanges?.length) {
        allTeamChanges.push(...regionResult.teamChanges.map((c) => ({ division: divisionEntry.label, region: regionKey, ...c })));
      }
      if (regionResult.regionalDiff?.length) {
        allRegionalDiffs.push(...regionResult.regionalDiff.map((d) => ({ division: divisionEntry.label, region: regionKey, ...d })));
      }
      for (const teamName of regionResult.unresolvedTeams || []) {
        unresolvedTeamRecords.push({ division: divisionEntry.label, gender: divisionEntry.gender, region: regionKey, team: teamName });
      }
    }
    if (result.stateDiff?.length) {
      allStateDiffs.push(...result.stateDiff.map((d) => ({ division: divisionEntry.label, ...d })));
    }
    if (result.affected) affectedDivisions.push(divisionEntry.label);

    return result.division;
  });

  const draftData = { ...regionalsData, divisions: draftDivisions };
  const draftHash = computeContentHash(draftData);

  const seasonBestImprovements = allTeamChanges.flatMap((tc) => tc.changes.filter((c) => c.type === "season_best_improved").map((c) => ({ division: tc.division, region: tc.region, team: tc.team, ...c })));
  const slowerPreserved = allTeamChanges.flatMap((tc) => tc.changes.filter((c) => c.type === "slower_performance_preserved").map((c) => ({ division: tc.division, region: tc.region, team: tc.team, ...c })));
  const newAthletes = allTeamChanges.flatMap((tc) => tc.changes.filter((c) => c.type === "new_athlete_added").map((c) => ({ division: tc.division, region: tc.region, team: tc.team, ...c })));
  const duplicateCollisions = allTeamChanges.flatMap((tc) => tc.changes.filter((c) => c.type === "duplicate_profile_collision").map((c) => ({ division: tc.division, region: tc.region, team: tc.team, ...c })));
  const droppedRunners = allTeamChanges.flatMap((tc) => tc.changes.filter((c) => c.type === "runner_dropped_from_top_seven").map((c) => ({ division: tc.division, region: tc.region, team: tc.team, ...c })));

  const teamHasSevenChange = (division, team) => allTeamChanges.some((tc) => tc.division === division && tc.team === team && tc.changes.some((c) => ["new_athlete_added", "runner_dropped_from_top_seven"].includes(c.type)));
  const teamHasRegionalChange = (division, team) => allRegionalDiffs.some((d) => d.division === division && d.type === "regional_team_changed" && d.team === team);
  const teamHasStateChange = (division, team) => allStateDiffs.some((d) => d.division === division && d.type === "regional_team_changed" && d.team === team);

  for (const improvement of seasonBestImprovements) {
    improvement.already_in_top_seven = true; // season_best_improved only ever applies to an already-matched existing runner, by construction.
    improvement.changed_team_top_seven = teamHasSevenChange(improvement.division, improvement.team);
    improvement.changed_regional_or_state_scoring = teamHasRegionalChange(improvement.division, improvement.team) || teamHasStateChange(improvement.division, improvement.team);
    improvement.missing_meet_date = !improvement.meetDate;
    improvement.missing_source_url = !improvement.sourceUrl;
  }
  for (const entry of newAthletes) {
    entry.changed_team_score = teamHasRegionalChange(entry.division, entry.team) || teamHasStateChange(entry.division, entry.team);
    entry.removed_runner = droppedRunners.find((d) => d.division === entry.division && d.team === entry.team)?.athlete || null;
    entry.missing_meet_date = !entry.meetDate;
    entry.missing_source_url = !entry.sourceUrl;
  }

  const teamsWithTopSevenChanges = new Set(allTeamChanges.filter((tc) => tc.changes.some((c) => ["season_best_improved", "new_athlete_added", "runner_dropped_from_top_seven"].includes(c.type))).map((tc) => `${tc.division} / ${tc.team}`));

  // Enrich the 7 (or however many) unresolved teams with real,
  // read-only fuzzy school-name suggestions and current state-
  // qualification status -- never auto-applied.
  for (const record of unresolvedTeamRecords) {
    const team = findTeamInPublishedData(regionalsData, record.division, record.region, record.team);
    record.current_ohsaa_school_id = team?.ohsaaSchoolId ?? null;
    record.reason = "No ohsaaSchoolId on this mock team entry (an isTop75Team-exception team whose official OHSAA identity was never confirmed when the mock roster was built).";
    record.prevented_athlete_updates = true;
    record.currently_qualifies_for_state = teamCurrentlyQualifiesForState(regionalsData, record.division, record.region, record.team);
    record.possible_school_matches = await suggestSchoolMatches(record.team);
    record.recommended_resolution = record.possible_school_matches.length
      ? "Manually confirm one of the suggested OHSAA school ID matches, then set ohsaaSchoolId on this team entry in src/data/mock-regionals-2026.json directly. Never auto-applied by this script."
      : "No plausible ohio_schools match found by name/alias. This school may not exist yet in ohio_schools, or its name differs enough that a manual search is needed.";
  }

  // Regional/state breakdown by division x gender, per the audit's
  // required table.
  const divisionBreakdown = regionalsData.divisions.map((divisionEntry) => {
    const regDiffs = allRegionalDiffs.filter((d) => d.division === divisionEntry.label);
    const stDiffs = allStateDiffs.filter((d) => d.division === divisionEntry.label);
    return {
      division: divisionEntry.label,
      gender: divisionEntry.gender,
      teams_score_changed: regDiffs.filter((d) => d.type === "regional_team_changed" && d.previousScore !== d.newScore).length,
      teams_place_changed: regDiffs.filter((d) => d.type === "regional_team_changed" && d.previousRank !== d.newRank).length,
      teams_entering_state_qualification: regDiffs.filter((d) => d.type === "regional_team_changed" && !d.previousQualifies && d.newQualifies).length,
      teams_leaving_state_qualification: regDiffs.filter((d) => d.type === "regional_team_changed" && d.previousQualifies && !d.newQualifies).length,
      individual_qualifiers_entering: regDiffs.filter((d) => d.type === "individual_qualifier_added").length,
      individual_qualifiers_leaving: regDiffs.filter((d) => d.type === "individual_qualifier_removed").length,
      state_teams_score_changed: stDiffs.filter((d) => d.type === "regional_team_changed" && d.previousScore !== d.newScore).length,
      state_teams_place_changed: stDiffs.filter((d) => d.type === "regional_team_changed" && d.previousRank !== d.newRank).length,
      state_qualifying_team_before_after: stDiffs.filter((d) => d.type === "regional_team_changed").map((d) => ({ team: d.team, previousRank: d.previousRank, newRank: d.newRank, previousScore: d.previousScore, newScore: d.newScore, previousQualifies: d.previousQualifies, newQualifies: d.newQualifies }))
    };
  }).filter((row) => row.teams_score_changed || row.teams_place_changed || row.teams_entering_state_qualification || row.teams_leaving_state_qualification || row.individual_qualifiers_entering || row.individual_qualifiers_leaving || row.state_teams_score_changed || row.state_teams_place_changed);

  const summary = {
    rows_received: rawCount,
    real_candidates_matched_by_gender: { boys: [...boys.values()].reduce((n, a) => n + a.length, 0), girls: [...girls.values()].reduce((n, a) => n + a.length, 0) },
    excluded_non_high_school: excludedNonHighSchool,
    schools_unresolved_ohsaa_id: unresolvedSchools.length,
    teams_school_identity_unresolved: unresolvedTeamRecords.length,
    new_athletes: newAthletes.length,
    athletes_with_new_season_bests: seasonBestImprovements.length,
    slower_performances_preserved: slowerPreserved.length,
    duplicate_profile_collisions: duplicateCollisions.length,
    teams_with_top_seven_changes: teamsWithTopSevenChanges.size,
    divisions_affected: affectedDivisions,
    regional_rankings_changed: allRegionalDiffs.filter((d) => d.type === "regional_team_changed").length,
    regional_qualifiers_changed: allRegionalDiffs.filter((d) => d.type === "regional_team_changed" && d.previousQualifies !== d.newQualifies).length,
    state_qualifiers_changed: allStateDiffs.filter((d) => d.type === "regional_team_changed" && d.previousQualifies !== d.newQualifies).length,
    state_scores_changed: allStateDiffs.filter((d) => d.type === "regional_team_changed" && d.previousScore !== d.newScore).length
  };

  const validationProblems = draftData.divisions.flatMap((d) => validateDivisionRoster(d, Object.entries(d.regions)));
  const blockingErrors = validationProblems; // The one blocking-error source today; a real extension point for later checks without changing the apply contract.

  const draftId = crypto.randomUUID();
  const manifest = {
    draft_id: draftId,
    draft_hash: draftHash,
    created_at: new Date().toISOString(),
    supabase_retrieved_at: supabaseRetrievedAt,
    rows_used: rawCount,
    published_json_hash_at_preview: publishedHash,
    validation_problems: validationProblems,
    blocking_errors: blockingErrors,
    summary
  };

  const draftDir = path.join(outputRoot, draftId);
  fs.mkdirSync(draftDir, { recursive: true });
  fs.writeFileSync(path.join(draftDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  fs.writeFileSync(path.join(draftDir, "draft-mock-regionals-2026.json"), JSON.stringify(draftData, null, 2) + "\n");

  const report = {
    generated_at: manifest.created_at,
    draft_id: draftId,
    mode: "preview",
    season_year: MOCK_MEET_SEASON_YEAR,
    summary,
    season_best_improvements: seasonBestImprovements,
    slower_performances_preserved: slowerPreserved,
    new_athletes: newAthletes,
    duplicate_profile_collisions: duplicateCollisions,
    unresolved_teams: unresolvedTeamRecords,
    division_breakdown: divisionBreakdown,
    regional_diffs: allRegionalDiffs,
    state_diffs: allStateDiffs
  };
  fs.writeFileSync(path.join(draftDir, "report.json"), JSON.stringify(report, null, 2) + "\n");
  writeMarkdownReports(draftDir, report);

  // Convenience "latest" pointer, for humans only -- apply never reads
  // this, apply always requires an explicit --draft-id/--draft-hash.
  fs.writeFileSync(path.join(outputRoot, "latest-draft-id.txt"), draftId + "\n");

  console.log(`\nMock Meet Export -- PREVIEW mode`);
  console.log("=".repeat(50));
  console.log(`draft_id: ${draftId}`);
  console.log(`draft_hash: ${draftHash}`);
  console.log(`published_json_hash_at_preview: ${publishedHash}`);
  for (const [key, value] of Object.entries(summary)) {
    console.log(`${key}: ${Array.isArray(value) ? value.length : typeof value === "object" ? JSON.stringify(value) : value}`);
  }
  console.log(`validation_problems: ${validationProblems.length}`);
  console.log("=".repeat(50));
  console.log(`\nDraft folder: ${path.relative(root, draftDir)}`);
  console.log("No changes made to the published mock meet data.");
  console.log(`\nTo apply this exact draft once approved:`);
  console.log(`  node --env-file=.env.local scripts/mock-meet-export.mjs --mode=apply --draft-id=${draftId}`);
}

function writeMarkdownReports(draftDir, report) {
  const lines = [];
  lines.push(`# Unresolved teams (${report.unresolved_teams.length})\n`);
  for (const t of report.unresolved_teams) {
    lines.push(`## ${t.team}`);
    lines.push(`- Gender: ${t.gender}`);
    lines.push(`- Division: ${t.division}`);
    lines.push(`- Region: ${t.region}`);
    lines.push(`- Current OHSAA school ID: ${t.current_ohsaa_school_id ?? "none"}`);
    lines.push(`- Reason unresolved: ${t.reason}`);
    lines.push(`- Prevented athlete updates: ${t.prevented_athlete_updates}`);
    lines.push(`- Currently qualifies for state: ${t.currently_qualifies_for_state}`);
    lines.push(`- Possible school matches: ${t.possible_school_matches.length ? t.possible_school_matches.map((m) => `${m.schoolName} (OHSAA ${m.ohsaaSchoolId}, ${m.city}, ${m.athleticDistrict}) via ${m.matchedVia}`).join("; ") : "none found"}`);
    lines.push(`- Recommended resolution: ${t.recommended_resolution}\n`);
  }
  fs.writeFileSync(path.join(draftDir, "unresolved-teams-report.md"), lines.join("\n"));

  const improveLines = [`# Season best improvements (${report.season_best_improvements.length})\n`];
  improveLines.push("| Athlete | School | Division | Region | Previous | New | Improvement | Meet | Meet date | Source URL | Missing date | Missing URL | Changed 7 | Changed scoring |");
  improveLines.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const a of report.season_best_improvements) {
    const improvementCs = a.previousTimeCentiseconds - a.newTimeCentiseconds;
    improveLines.push(`| ${a.athlete} | ${a.school} | ${a.division} | ${a.region} | ${a.previousSeasonBest} | ${a.newSeasonBest} | ${(improvementCs / 100).toFixed(2)}s | ${a.meetName || "--"} | ${a.meetDate || "--"} | ${a.sourceUrl || "--"} | ${a.missing_meet_date} | ${a.missing_source_url} | ${a.changed_team_top_seven} | ${a.changed_regional_or_state_scoring} |`);
  }
  fs.writeFileSync(path.join(draftDir, "season-best-improvements-report.md"), improveLines.join("\n"));

  const newLines = [`# New athletes (${report.new_athletes.length})\n`];
  newLines.push("| Athlete | School | Division | Region | Season best | Meet | Meet date | Source URL | Missing date | Missing URL | Runner removed | Team score changed |");
  newLines.push("|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const a of report.new_athletes) {
    newLines.push(`| ${a.athlete} | ${a.school} | ${a.division} | ${a.region} | ${a.seasonBest} | ${a.meetName || "--"} | ${a.meetDate || "--"} | ${a.sourceUrl || "--"} | ${a.missing_meet_date} | ${a.missing_source_url} | ${a.removed_runner || "none"} | ${a.changed_team_score} |`);
  }
  fs.writeFileSync(path.join(draftDir, "new-athletes-report.md"), newLines.join("\n"));
}

// ---------------------------------------------------------------------
// APPLY: no Supabase, no recomputation. Only promotes an already-
// reviewed draft, after every safety check passes.
// ---------------------------------------------------------------------
function runApply() {
  const draftId = arg("draft-id");
  const draftHashArg = arg("draft-hash");

  if (!draftId && !draftHashArg) {
    console.error("REFUSED: apply requires --draft-id=<uuid> or --draft-hash=<sha256>.");
    console.error("Run preview first, review the report, then apply with the exact draft it produced.");
    process.exit(1);
  }

  let resolvedDraftId = draftId;
  if (!resolvedDraftId && draftHashArg) {
    const candidates = fs.existsSync(outputRoot) ? fs.readdirSync(outputRoot).filter((name) => fs.existsSync(path.join(outputRoot, name, "manifest.json"))) : [];
    resolvedDraftId = candidates.find((id) => {
      const manifest = JSON.parse(fs.readFileSync(path.join(outputRoot, id, "manifest.json"), "utf8"));
      return manifest.draft_hash === draftHashArg;
    });
    if (!resolvedDraftId) {
      console.error(`REFUSED: no draft found with hash ${draftHashArg}.`);
      process.exit(1);
    }
  }

  const draftDir = path.join(outputRoot, resolvedDraftId);
  const manifestPath = path.join(draftDir, "manifest.json");
  const draftPath = path.join(draftDir, "draft-mock-regionals-2026.json");

  if (!fs.existsSync(manifestPath) || !fs.existsSync(draftPath)) {
    console.error(`REFUSED: draft ${resolvedDraftId} could not be found at ${path.relative(root, draftDir)}.`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const draftRaw = fs.readFileSync(draftPath, "utf8");
  const draftData = JSON.parse(draftRaw);

  const currentDraftHash = computeContentHash(draftData);
  if (currentDraftHash !== manifest.draft_hash) {
    console.error(`REFUSED: draft ${resolvedDraftId}'s current content hash (${currentDraftHash}) does not match the hash recorded at preview time (${manifest.draft_hash}).`);
    console.error("The draft file appears to have been edited or regenerated since it was reviewed. Run preview again.");
    process.exit(1);
  }

  if (!fs.existsSync(mockDataPath)) {
    console.error(`REFUSED: published data file not found at ${path.relative(root, mockDataPath)}.`);
    process.exit(1);
  }
  const currentPublished = JSON.parse(fs.readFileSync(mockDataPath, "utf8"));
  const currentPublishedHash = computeContentHash(currentPublished);
  if (currentPublishedHash !== manifest.published_json_hash_at_preview) {
    console.error(`REFUSED: the published mock meet data has changed since this draft was previewed.`);
    console.error(`  published hash at preview time: ${manifest.published_json_hash_at_preview}`);
    console.error(`  current published hash:         ${currentPublishedHash}`);
    console.error("Run preview again against the current published data before applying.");
    process.exit(1);
  }

  const validationProblems = draftData.divisions.flatMap((d) => validateDivisionRoster(d, Object.entries(d.regions)));
  if (validationProblems.length) {
    console.error(`REFUSED: draft ${resolvedDraftId} fails validateDivisionRoster (${validationProblems.length} problem(s)):`);
    validationProblems.slice(0, 10).forEach((p) => console.error(`  - ${p}`));
    process.exit(1);
  }

  if (manifest.blocking_errors && manifest.blocking_errors.length) {
    console.error(`REFUSED: draft ${resolvedDraftId} has ${manifest.blocking_errors.length} unresolved blocking error(s) recorded in its manifest:`);
    manifest.blocking_errors.slice(0, 10).forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  fs.writeFileSync(mockDataPath, draftRaw.endsWith("\n") ? draftRaw : draftRaw + "\n");
  const appliedRecord = { applied_at: new Date().toISOString(), draft_id: resolvedDraftId, draft_hash: currentDraftHash, promoted_from: path.relative(root, draftPath) };
  fs.writeFileSync(path.join(draftDir, "applied.json"), JSON.stringify(appliedRecord, null, 2) + "\n");

  console.log(`\nMock Meet Export -- APPLY mode`);
  console.log("=".repeat(50));
  console.log(`Promoted draft ${resolvedDraftId} into ${path.relative(root, mockDataPath)}.`);
  console.log("All safety checks passed: draft hash matched, published data unchanged since preview, zero validation problems, zero blocking errors.");
  console.log("Run `npm run build` to regenerate the mock meet pages from this data.");
  console.log("Not committed, not pushed, not deployed -- review with `git diff` before committing.");
}

if (mode === "preview") {
  runPreview().catch((error) => {
    console.error("Mock meet export (preview) failed:", error);
    process.exit(1);
  });
} else {
  try {
    runApply();
  } catch (error) {
    console.error("Mock meet export (apply) failed:", error);
    process.exit(1);
  }
}
