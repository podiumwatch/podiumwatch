// Mock Meet Export -- the connective layer between the REAL, already-
// existing athlete performance system (athlete_profiles/athlete_performances/
// athlete_best_performances, populated by lib/result_ingestion_engine.mjs's
// own CSV/staging/review workflow, entirely unmodified by this file) and
// the static, hand-maintained mock regionals/state JSON
// (src/data/mock-regionals-2026.json).
//
// This file deliberately does NOT re-implement CSV parsing, duplicate
// detection, athlete matching for NEW incoming rows, school-alias
// matching, or a review queue -- all of that already exists and stays
// exactly as-is (lib/result_ingestion_engine.mjs, lib/athlete_foundation_service.mjs,
// the real ohio_schools/athlete_profile_aliases tables). A real
// performance only ever reaches this file after it has already gone
// through that entire pipeline and landed in athlete_best_performances
// -- i.e. already verified/source-linked, already public_visible,
// already the athlete's real season best. This file's only job is:
// given that already-trusted data, decide whether it should update a
// specific mock-meet team roster, and if so, hand the result to the
// EXACT SAME scoring engine (src/lib/mock_scoring.mjs) the live mock
// meet pages already use -- never a second scoring engine, never a
// second matching system.
//
// Every function below is pure (no Supabase, no fs) so it can be unit
// tested against fixtures (tests/mock-meet-export.test.mjs) without a
// live database connection or touching the real published JSON.
import { createHash } from "node:crypto";
import { scoreTeams, selectIndividualQualifiers, computeStatePool } from "../src/lib/mock_scoring.mjs";
import { normalizeAthleteName } from "./athlete_foundation_service.mjs";

// The real cross country season this exporter targets. Mock meets are a
// single-season snapshot (2026), so this is deliberately a constant
// here rather than a parameter threaded through every function -- the
// CLI script (scripts/mock-meet-export.mjs) is the one place it would
// ever need to change.
export const MOCK_MEET_SEASON_YEAR = 2026;

// Algebraic inverse of lib/athlete_foundation_service.mjs's
// deriveGraduationYearFromGrade(), cross-country branch only (mock
// meets are XC-only): that function computes
// graduationYear = (season + 1) + (12 - grade) for a cross country
// season. Solving for grade given a real athlete_profiles.graduation_year
// is only needed when ADDING a brand-new runner to a mock roster (an
// existing mock runner already carries its own grade/graduationYear,
// never touched here) -- this is arithmetic, not a second identity or
// matching system. Verified directly against real mock JSON data:
// Gavin Swain, grade 11, graduationYear 2028, season 2026 ->
// 2026 + 13 - 2028 = 11.
export function gradeForGraduationYear(graduationYear, seasonYear = MOCK_MEET_SEASON_YEAR) {
  if (!Number.isFinite(Number(graduationYear))) return null;
  const grade = seasonYear + 13 - Number(graduationYear);
  return grade >= 6 && grade <= 12 ? String(grade) : null;
}

// Defense-in-depth, not the primary filter: the CLI script's own
// Supabase query already constrains sport/event_key/season_year at the
// database level (the real, authoritative filter). This is a second,
// cheap, in-memory guard against a row that somehow doesn't match --
// e.g. a stale cached fetch, or a future caller of buildEligibleCandidates()
// that forgets the query filter -- so an invalid or non-5K row is
// rejected here too, not silently scored.
export function isEligibleCrossCountryRow(row, { seasonYear = MOCK_MEET_SEASON_YEAR } = {}) {
  if (!row) return false;
  if (row.sport !== "cross_country") return false;
  if (row.event_key !== "xc_5k") return false;
  if (Number(row.season_year) !== seasonYear) return false;
  if (!Number.isFinite(Number(row.mark_value)) || Number(row.mark_value) <= 0) return false;
  if (!["source_linked", "verified"].includes(row.verification_status)) return false;
  // public_visible and result_status are already guaranteed by
  // athlete_best_performances' own view definition (install/03 --
  // public_visible = true, result_status in
  // ('official_result','reviewed_result') are both real WHERE clauses
  // on that view), so a row fetched from it can never actually fail
  // these two checks today. They're re-checked here anyway, explicitly,
  // as defense-in-depth against a future caller reading from
  // athlete_performances directly instead of the view -- the CLI's own
  // select() includes both columns specifically so this check is real,
  // not a no-op against undefined fields.
  if (row.public_visible !== true) return false;
  if (!["official_result", "reviewed_result"].includes(row.result_status)) return false;
  return true;
}

// A school's real program_level (install/01: 'high_school' | 'middle_school'
// | 'club') -- mock meets are an Ohio HIGH SCHOOL cross country feature
// only. Excludes a middle-school or club-level program even if its
// results otherwise look eligible. Pure/testable on its own since the
// CLI resolves this from a separate ohio_schools fetch, not from the
// performance row itself.
export function isEligibleSchoolLevel(programLevel) {
  return programLevel === "high_school";
}

// Deterministic content hash (SHA-256, hex) for the draft-protection
// system: preview computes and stores this hash alongside the draft it
// writes; apply refuses to run unless the caller supplies the matching
// draft id/hash AND the draft file's current on-disk content still
// hashes to the same value (protects against a hand-edited or
// regenerated draft silently being promoted instead of exactly what
// was reviewed). JSON.stringify is deterministic here because every
// object in this codebase's own draft output is built via a fixed,
// unchanging property order (confirmed directly: two consecutive real
// preview runs against unchanged Supabase data produce byte-identical
// draft JSON) -- no custom canonicalization needed.
export function computeContentHash(data) {
  return createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

// A real athlete_best_performances row (already filtered by the caller
// to sport='cross_country', event_key='xc_5k', season_year=2026 --
// the same LEADERS_SPORT/LEADERS_EVENT_KEY constants
// lib/athlete_leaders_service.mjs already exports and uses for State
// Leaders, reused here rather than redefined) converted to the shape
// this file works with internally. mark_value on athlete_performances
// is stored in SECONDS (confirmed directly: lib/result_ingestion_engine.mjs
// writes mark_unit:'seconds' for every time event) -- mock-regionals-2026.json
// stores centiseconds (confirmed directly against real data: "16:03.2"
// -> timeCentiseconds 96320 = 963.2 * 100), so the conversion here is
// exactly *100, rounded to the nearest whole centisecond.
export function realPerformanceToCandidate(row, { athleticNetId = null } = {}) {
  const timeCentiseconds = Number.isFinite(Number(row.mark_value)) ? Math.round(Number(row.mark_value) * 100) : null;
  return {
    profileId: row.profile_id,
    schoolId: row.school_id,
    name: row.display_name || row.athlete_name || null,
    gender: row.gender || null,
    graduationYear: row.graduation_year ?? null,
    timeCentiseconds,
    seasonBest: row.mark_text || null,
    resultUrl: row.source_url || null,
    meetName: row.meet_name || null,
    meetDate: row.meet_date || null,
    sourceType: row.source_type || null,
    verificationStatus: row.verification_status || null,
    athleticNetId
  };
}

// Athlete matching, in the exact order the user specified: Athletic.net
// ID first (matches a mock runner's own already-stored athleticNetId
// against a real external_id alias, resolved by the caller before this
// function ever runs), then a name + graduation year fallback. Mock
// runner objects have no gender field at all (confirmed directly
// against the real JSON schema -- gender lives at the division level,
// not per runner), so this deliberately does NOT reuse
// lib/athlete_foundation_service.mjs's athleteMatchKey() as-is (that
// key requires gender and would silently never match anything here).
// It still reuses that same file's normalizeAthleteName() for the name
// half -- the caller is always a school-scoped, division-scoped
// candidate list already (see groupCandidatesBySchool and the
// per-division real-data fetch in scripts/mock-meet-export.mjs), which
// already pins gender and school; name + graduation year is the
// correct remaining fallback in that already-narrowed context, not a
// looser match than the real system's own rule. Returns null (never a
// guess) when zero or more than one real candidate matches by name --
// an ambiguous match is excluded, not auto-merged, per the explicit
// "do not merge uncertain matches automatically" rule.
export function matchRunnerToCandidate(runner, candidates) {
  if (runner.athleticNetId) {
    const byAthleticNet = candidates.find((c) => c.athleticNetId && String(c.athleticNetId) === String(runner.athleticNetId));
    if (byAthleticNet) return { candidate: byAthleticNet, matchedBy: "athletic_net_id" };
  }

  const runnerKey = `${normalizeAthleteName(runner.name)}|${runner.graduationYear || "unknown"}`;
  const nameMatches = candidates.filter((c) => `${normalizeAthleteName(c.name)}|${c.graduationYear || "unknown"}` === runnerKey);
  if (nameMatches.length === 1) return { candidate: nameMatches[0], matchedBy: "name_grad_year" };

  return { candidate: null, matchedBy: null };
}

// Recomputes one team's roster from its current mock runners plus every
// real candidate whose school matches this team (already filtered by
// the caller via ohsaaSchoolId -- see matchCandidatesToTeam below).
// Implements, in order: replace-only-if-faster for an existing runner
// with a real match; add a brand-new runner when a real, unmatched
// candidate would place in the team's fastest seven; recompute the
// final seven by time. A runner who drops out of the top seven is
// simply not included in the returned roster -- their full performance
// history remains exactly where it always has, in the real
// athlete_performances table, completely untouched by this file; there
// is nothing to "preserve" here that isn't already preserved upstream.
export function mergeTeamRoster(team, realCandidatesForTeam) {
  const changes = [];
  const usedCandidateProfileIds = new Set();
  const updatedExisting = [];

  for (const runner of team.runners) {
    const { candidate, matchedBy } = matchRunnerToCandidate(runner, realCandidatesForTeam.filter((c) => !usedCandidateProfileIds.has(c.profileId)));

    if (!candidate || candidate.timeCentiseconds == null) {
      updatedExisting.push(runner);
      continue;
    }

    usedCandidateProfileIds.add(candidate.profileId);

    if (candidate.timeCentiseconds < runner.timeCentiseconds) {
      changes.push({
        type: "season_best_improved",
        athlete: runner.name,
        school: team.name,
        matchedBy,
        previousSeasonBest: runner.seasonBest,
        previousTimeCentiseconds: runner.timeCentiseconds,
        newSeasonBest: candidate.seasonBest,
        newTimeCentiseconds: candidate.timeCentiseconds,
        meetName: candidate.meetName,
        meetDate: candidate.meetDate,
        sourceUrl: candidate.resultUrl
      });
      updatedExisting.push({
        ...runner,
        seasonBest: candidate.seasonBest,
        timeCentiseconds: candidate.timeCentiseconds,
        athleticNetId: runner.athleticNetId || candidate.athleticNetId || null,
        resultUrl: candidate.resultUrl || runner.resultUrl
      });
    } else {
      changes.push({
        type: "slower_performance_preserved",
        athlete: runner.name,
        school: team.name,
        matchedBy,
        mockSeasonBest: runner.seasonBest,
        realSeasonBest: candidate.seasonBest,
        note: "Real approved performance did not improve on the existing mock season best; mock value kept unchanged."
      });
      updatedExisting.push(runner);
    }
  }

  const unmatchedCandidates = realCandidatesForTeam.filter((c) => !usedCandidateProfileIds.has(c.profileId) && c.timeCentiseconds != null);

  // Defense against an unmerged duplicate real athlete_profiles row (two
  // distinct profile_ids for the same real person -- a real-system data
  // quality issue outside this file's control, not something to guess a
  // merge for here): if two "new" candidates share the same normalized
  // name + graduation year, only the faster one is ever added to a mock
  // roster. The slower duplicate is reported, never silently dropped,
  // so this stays visible for someone to actually merge the profiles
  // upstream in the real system.
  const bestByNameKey = new Map();
  const duplicateCollisions = [];
  for (const candidate of unmatchedCandidates) {
    const key = `${normalizeAthleteName(candidate.name)}|${candidate.graduationYear || "unknown"}`;
    const existing = bestByNameKey.get(key);
    if (!existing) {
      bestByNameKey.set(key, candidate);
    } else if (candidate.timeCentiseconds < existing.timeCentiseconds) {
      duplicateCollisions.push({ athlete: candidate.name, keptProfileId: candidate.profileId, droppedProfileId: existing.profileId });
      bestByNameKey.set(key, candidate);
    } else {
      duplicateCollisions.push({ athlete: candidate.name, keptProfileId: existing.profileId, droppedProfileId: candidate.profileId });
    }
  }
  const newCandidates = [...bestByNameKey.values()];
  for (const collision of duplicateCollisions) {
    changes.push({
      type: "duplicate_profile_collision",
      athlete: collision.athlete,
      school: team.name,
      note: `Two distinct real athlete profiles matched the same name/graduation year for this school -- kept profile ${collision.keptProfileId}, excluded ${collision.droppedProfileId} from this mock roster. This likely needs a real profile merge upstream.`
    });
  }

  const combinedPool = [...updatedExisting];

  for (const candidate of newCandidates) {
    combinedPool.push({
      name: candidate.name,
      grade: gradeForGraduationYear(candidate.graduationYear),
      graduationYear: candidate.graduationYear,
      seasonBest: candidate.seasonBest,
      timeCentiseconds: candidate.timeCentiseconds,
      athleticNetId: candidate.athleticNetId || null,
      resultUrl: candidate.resultUrl,
      __newlyAdded: true
    });
  }

  const sorted = [...combinedPool].sort((a, b) => a.timeCentiseconds - b.timeCentiseconds);
  const finalSeven = sorted.slice(0, 7);
  const finalNames = new Set(finalSeven.map((r) => r.name));

  for (const candidate of finalSeven) {
    if (candidate.__newlyAdded) {
      changes.push({
        type: "new_athlete_added",
        athlete: candidate.name,
        school: team.name,
        timeCentiseconds: candidate.timeCentiseconds,
        seasonBest: candidate.seasonBest,
        sourceUrl: candidate.resultUrl
      });
    }
  }

  for (const runner of updatedExisting) {
    if (!finalNames.has(runner.name)) {
      changes.push({
        type: "runner_dropped_from_top_seven",
        athlete: runner.name,
        school: team.name,
        seasonBest: runner.seasonBest
      });
    }
  }

  const cleanedRunners = finalSeven.map(({ __newlyAdded, ...rest }) => rest);
  const rosterChanged = changes.some((c) => c.type === "season_best_improved" || c.type === "new_athlete_added" || c.type === "runner_dropped_from_top_seven");

  return {
    team: { ...team, runners: cleanedRunners },
    changed: rosterChanged,
    changes
  };
}

// Applies mergeTeamRoster to every team in one region, then -- only if
// at least one team in the region actually changed -- re-scores the
// WHOLE region with the real, unmodified scoring engine
// (scoreTeams/selectIndividualQualifiers), producing an old-vs-new diff
// of rank/score/qualification for every team and every individual
// qualifier slot. A region with zero changes is returned untouched,
// with rescored:false, so an unaffected division's pages are never
// needlessly marked as changed.
export function mergeRegion(region, ohsaaIdToCandidates) {
  // Teams whose official identity was never resolved (no ohsaaSchoolId
  // -- an isTop75Team-exception entry, per this project's established
  // mock-meets pattern) simply can't be safely matched against a real
  // school and are reported, never guessed at by name.
  const unresolvedTeams = region.teams.filter((t) => !t.ohsaaSchoolId).map((t) => t.name);

  const teamChanges = [];
  const updatedTeams = [];
  let anyTeamChanged = false;

  for (const team of region.teams) {
    const realCandidates = team.ohsaaSchoolId ? (ohsaaIdToCandidates.get(team.ohsaaSchoolId) || []) : [];
    const { team: mergedTeam, changed, changes } = mergeTeamRoster(team, realCandidates);
    updatedTeams.push(mergedTeam);
    if (changed) {
      anyTeamChanged = true;
      teamChanges.push({ team: team.name, changes });
    }
  }

  if (!anyTeamChanged) {
    return { region, rescored: false, teamChanges: [], regionalDiff: null, unresolvedTeams };
  }

  const updatedRegion = { ...region, teams: updatedTeams };

  const before = scoreTeams(region.teams, region.individuals || []);
  const after = scoreTeams(updatedRegion.teams, updatedRegion.individuals || []);
  const beforeIndividualQualifiers = selectIndividualQualifiers(before.teams, before.individuals, region.stateQualifiers, region.individualQualifiers || 0);
  const afterIndividualQualifiers = selectIndividualQualifiers(after.teams, after.individuals, region.stateQualifiers, region.individualQualifiers || 0);

  const regionalDiff = diffScoredTeams(before.teams, after.teams, region.stateQualifiers)
    .concat(diffIndividualQualifiers(beforeIndividualQualifiers, afterIndividualQualifiers));

  return { region: updatedRegion, rescored: true, teamChanges, regionalDiff, unresolvedTeams };
}

// Handles all three shapes a team can change between two scored
// snapshots: an existing team's rank/score/qualification changing, a
// team newly ENTERING the field (real for a State diff -- a region's
// qualifier pool changing can bring in a team that simply wasn't part
// of the old State field at all, not just re-rank one that was already
// there), and a team DROPPING OUT of the field entirely (the regional
// equivalent: a team that no longer qualifies). A missing "before" or
// "after" side is treated as null/not-qualifying defaults, not skipped
// -- found directly while testing: skipping a missing side silently
// dropped exactly the "brand new State qualifier" case from the report.
function diffScoredTeams(beforeTeams, afterTeams, stateQualifiers) {
  const beforeByName = new Map(beforeTeams.map((t) => [t.name, t]));
  const afterByName = new Map(afterTeams.map((t) => [t.name, t]));
  const allNames = new Set([...beforeByName.keys(), ...afterByName.keys()]);
  const diffs = [];

  for (const name of allNames) {
    const beforeTeam = beforeByName.get(name) || null;
    const afterTeam = afterByName.get(name) || null;

    const beforeQualifies = Boolean(beforeTeam?.complete) && beforeTeam?.mockRank <= stateQualifiers;
    const afterQualifies = Boolean(afterTeam?.complete) && afterTeam?.mockRank <= stateQualifiers;

    const rankChanged = (beforeTeam?.mockRank ?? null) !== (afterTeam?.mockRank ?? null);
    const scoreChanged = (beforeTeam?.score ?? null) !== (afterTeam?.score ?? null);
    const completeChanged = Boolean(beforeTeam?.complete) !== Boolean(afterTeam?.complete);

    if (rankChanged || scoreChanged || beforeQualifies !== afterQualifies || completeChanged) {
      diffs.push({
        type: "regional_team_changed",
        team: name,
        previousRank: beforeTeam?.mockRank ?? null,
        newRank: afterTeam?.mockRank ?? null,
        previousScore: beforeTeam?.score ?? null,
        newScore: afterTeam?.score ?? null,
        previousComplete: Boolean(beforeTeam?.complete),
        newComplete: Boolean(afterTeam?.complete),
        previousQualifies: beforeQualifies,
        newQualifies: afterQualifies
      });
    }
  }

  return diffs;
}

function diffIndividualQualifiers(before, after) {
  const beforeNames = new Set(before.map((i) => i.name));
  const afterNames = new Set(after.map((i) => i.name));
  const diffs = [];

  for (const name of afterNames) {
    if (!beforeNames.has(name)) diffs.push({ type: "individual_qualifier_added", athlete: name });
  }
  for (const name of beforeNames) {
    if (!afterNames.has(name)) diffs.push({ type: "individual_qualifier_removed", athlete: name });
  }

  return diffs;
}

// Top-level entry point for one division (one of the 8 boys/girls x
// D1-D4 datasets): merges every region, and -- only for a division
// where at least one region actually changed -- rebuilds the State
// field from the new regional qualifiers using computeStatePool(), the
// exact same pooling function the live State page itself calls. State
// results are NEVER carried over from the old data when a region
// changes, per the explicit "do not use the old state scores after a
// regional update" rule -- they are always freshly recomputed from the
// new draft.
export function mergeDivision(divisionEntry, ohsaaIdToCandidates) {
  const updatedRegions = {};
  const regionResults = {};
  let anyRegionChanged = false;

  for (const [key, region] of Object.entries(divisionEntry.regions)) {
    const result = mergeRegion(region, ohsaaIdToCandidates);
    updatedRegions[key] = result.region;
    regionResults[key] = result;
    if (result.rescored) anyRegionChanged = true;
  }

  if (!anyRegionChanged) {
    return { division: divisionEntry, affected: false, regionResults, stateDiff: null };
  }

  const updatedDivision = { ...divisionEntry, regions: updatedRegions };
  const beforeState = computeStatePool(divisionEntry);
  const afterState = computeStatePool(updatedDivision);
  const stateDiff = diffScoredTeams(beforeState.teams, afterState.teams, Infinity)
    .concat(diffIndividualQualifiers(beforeState.individuals, afterState.individuals));

  return { division: updatedDivision, affected: true, regionResults, stateDiff };
}
