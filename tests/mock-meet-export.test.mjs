import test from "node:test";
import assert from "node:assert/strict";
import {
  MOCK_MEET_SEASON_YEAR,
  gradeForGraduationYear,
  isEligibleCrossCountryRow,
  isEligibleSchoolLevel,
  computeContentHash,
  realPerformanceToCandidate,
  matchRunnerToCandidate,
  mergeTeamRoster,
  mergeRegion,
  mergeDivision
} from "../lib/mock_meet_export_service.mjs";
import { scoreTeams, selectIndividualQualifiers, validateDivisionRoster } from "../src/lib/mock_scoring.mjs";

// ---------------------------------------------------------------------
// Small fixture builders -- mirror the REAL mock-regionals-2026.json
// shape exactly (field names confirmed directly against the real file
// before writing this service).
// ---------------------------------------------------------------------
function runner(overrides = {}) {
  return {
    name: "Test Runner",
    grade: "11",
    graduationYear: 2028,
    seasonBest: "16:30.0",
    timeCentiseconds: 99000,
    athleticNetId: null,
    resultUrl: null,
    ...overrides
  };
}

function team(overrides = {}) {
  return {
    name: "Test High School",
    athleticNetTeamRank: 1,
    ohsaaSchoolId: 12345,
    city: "Test City",
    athleticDistrict: "Central",
    region: "central",
    runners: [],
    ...overrides
  };
}

function candidate(overrides = {}) {
  return {
    profileId: "profile-1",
    schoolId: "school-uuid-1",
    name: "Real Athlete",
    gender: "boys",
    graduationYear: 2028,
    timeCentiseconds: 95000,
    seasonBest: "15:50.0",
    resultUrl: "https://www.athletic.net/result/real",
    meetName: "Real Meet",
    meetDate: "2026-09-20",
    sourceType: "official",
    verificationStatus: "verified",
    athleticNetId: null,
    ...overrides
  };
}

function bestPerformanceRow(overrides = {}) {
  return {
    profile_id: "profile-1",
    school_id: "school-uuid-1",
    display_name: "Real Athlete",
    gender: "boys",
    graduation_year: 2028,
    mark_value: 950.0,
    mark_text: "15:50.0",
    source_url: "https://www.athletic.net/result/real",
    meet_name: "Real Meet",
    meet_date: "2026-09-20",
    source_type: "official",
    verification_status: "verified",
    public_visible: true,
    result_status: "official_result",
    sport: "cross_country",
    event_key: "xc_5k",
    season_year: MOCK_MEET_SEASON_YEAR,
    ...overrides
  };
}

// ---------------------------------------------------------------------
// Arithmetic helpers
// ---------------------------------------------------------------------

test("gradeForGraduationYear matches the real Gavin Swain fixture (grade 11, class of 2028, 2026 season)", () => {
  assert.equal(gradeForGraduationYear(2028, 2026), "11");
});

test("gradeForGraduationYear returns null outside a plausible high school range", () => {
  assert.equal(gradeForGraduationYear(2040, 2026), null);
});

// ---------------------------------------------------------------------
// Eligibility filtering (tests #8, #9: invalid time rejected, non-5K excluded)
// ---------------------------------------------------------------------

test("a valid verified cross country 5K row is eligible", () => {
  assert.equal(isEligibleCrossCountryRow(bestPerformanceRow()), true);
});

test("a non-5000m event is excluded", () => {
  assert.equal(isEligibleCrossCountryRow(bestPerformanceRow({ event_key: "xc_3200" })), false);
});

test("a non-cross-country sport is excluded", () => {
  assert.equal(isEligibleCrossCountryRow(bestPerformanceRow({ sport: "outdoor_track" })), false);
});

test("an invalid/missing time is rejected", () => {
  assert.equal(isEligibleCrossCountryRow(bestPerformanceRow({ mark_value: null })), false);
  assert.equal(isEligibleCrossCountryRow(bestPerformanceRow({ mark_value: 0 })), false);
  assert.equal(isEligibleCrossCountryRow(bestPerformanceRow({ mark_value: "not a number" })), false);
});

test("an unverified performance is rejected (pending/unverified must never affect mock meets)", () => {
  assert.equal(isEligibleCrossCountryRow(bestPerformanceRow({ verification_status: "unverified" })), false);
  assert.equal(isEligibleCrossCountryRow(bestPerformanceRow({ verification_status: "disputed" })), false);
});

test("a source-linked (not just fully verified) performance is still eligible", () => {
  assert.equal(isEligibleCrossCountryRow(bestPerformanceRow({ verification_status: "source_linked" })), true);
});

test("a performance from the wrong season year is excluded", () => {
  assert.equal(isEligibleCrossCountryRow(bestPerformanceRow({ season_year: 2025 })), false);
});

// ---------------------------------------------------------------------
// Athlete matching
// ---------------------------------------------------------------------

test("Athletic.net ID match takes priority over name matching", () => {
  const r = runner({ name: "Some Runner", athleticNetId: "999" });
  const candidates = [
    candidate({ profileId: "wrong-name-match", name: "Some Runner", graduationYear: 2028, athleticNetId: null }),
    candidate({ profileId: "correct-id-match", name: "Completely Different Name", athleticNetId: "999" })
  ];
  const { candidate: matched, matchedBy } = matchRunnerToCandidate(r, candidates);
  assert.equal(matched.profileId, "correct-id-match");
  assert.equal(matchedBy, "athletic_net_id");
});

test("falls back to name + graduation year when no Athletic.net ID is present", () => {
  const r = runner({ name: "Fallback Runner", graduationYear: 2027, athleticNetId: null });
  const candidates = [candidate({ name: "Fallback Runner", graduationYear: 2027 })];
  const { candidate: matched, matchedBy } = matchRunnerToCandidate(r, candidates);
  assert.ok(matched);
  assert.equal(matchedBy, "name_grad_year");
});

test("an ambiguous name match (two candidates, same key) is never auto-merged", () => {
  const r = runner({ name: "Ambiguous Runner", graduationYear: 2027, athleticNetId: null });
  const candidates = [
    candidate({ profileId: "a", name: "Ambiguous Runner", graduationYear: 2027 }),
    candidate({ profileId: "b", name: "Ambiguous Runner", graduationYear: 2027 })
  ];
  const { candidate: matched, matchedBy } = matchRunnerToCandidate(r, candidates);
  assert.equal(matched, null);
  assert.equal(matchedBy, null);
});

test("two athletes with the same name at different schools never cross-match (school-scoped candidate pools)", () => {
  const teamA = team({ name: "School A", ohsaaSchoolId: 1, runners: [runner({ name: "Same Name", graduationYear: 2027, timeCentiseconds: 100000 })] });
  const teamB = team({ name: "School B", ohsaaSchoolId: 2, runners: [runner({ name: "Same Name", graduationYear: 2027, timeCentiseconds: 100000 })] });
  const region = { region: "central", siteName: "Test Site", stateQualifiers: 8, individualQualifiers: 16, teams: [teamA, teamB], individuals: [] };

  // Candidates are keyed by OHSAA school id, exactly how the real CLI
  // builds this map (scripts/mock-meet-export.mjs) -- only School A's
  // bucket has a match.
  const ohsaaIdToCandidates = new Map([[1, [candidate({ profileId: "a", name: "Same Name", graduationYear: 2027, timeCentiseconds: 90000 })]]]);
  const { region: updatedRegion } = mergeRegion(region, ohsaaIdToCandidates);
  const resultA = updatedRegion.teams.find((t) => t.name === "School A");
  const resultB = updatedRegion.teams.find((t) => t.name === "School B");

  assert.equal(resultA.runners[0].timeCentiseconds, 90000, "School A's runner should be improved by the real match scoped to their own school");
  assert.equal(resultB.runners[0].timeCentiseconds, 100000, "School B's identically-named runner must be completely untouched");
});

// ---------------------------------------------------------------------
// School matching / identity resolution (test #7: unknown school -> review)
// ---------------------------------------------------------------------

test("a team with no ohsaaSchoolId is reported as unresolved, not guessed at, and never receives any real match", () => {
  const unresolvedTeam = team({ name: "Unresolved School", ohsaaSchoolId: null, runners: [runner({ name: "Baseline Runner", timeCentiseconds: 100000 })] });
  const resolvedTeam = team({ name: "Resolved School", ohsaaSchoolId: 555, runners: [runner({ name: "Other Runner", athleticNetId: "z", timeCentiseconds: 100000 })] });
  const region = { region: "central", siteName: "Test Site", stateQualifiers: 8, individualQualifiers: 16, teams: [unresolvedTeam, resolvedTeam], individuals: [] };

  const ohsaaIdToCandidates = new Map([[555, [candidate({ athleticNetId: "z", timeCentiseconds: 90000 })]]]);
  const { region: updatedRegion, unresolvedTeams } = mergeRegion(region, ohsaaIdToCandidates);

  assert.deepEqual(unresolvedTeams, ["Unresolved School"]);
  const stillUnresolved = updatedRegion.teams.find((t) => t.name === "Unresolved School");
  assert.equal(stillUnresolved.runners[0].timeCentiseconds, 100000, "a team with unresolved school identity must never receive a real update, even if a candidate happens to share its name");
});

// ---------------------------------------------------------------------
// Season best replace-only-if-faster (tests #1, #2)
// ---------------------------------------------------------------------

test("a faster approved performance updates the mock athlete's season best", () => {
  const t = team({ runners: [runner({ name: "Improving Runner", athleticNetId: "111", timeCentiseconds: 100000, seasonBest: "16:40.0" })] });
  const candidates = [candidate({ athleticNetId: "111", timeCentiseconds: 95000, seasonBest: "15:50.0" })];
  const { team: updated, changes } = mergeTeamRoster(t, candidates);
  assert.equal(updated.runners[0].timeCentiseconds, 95000);
  assert.equal(updated.runners[0].seasonBest, "15:50.0");
  assert.ok(changes.some((c) => c.type === "season_best_improved" && c.athlete === "Improving Runner"));
});

test("a slower approved performance is preserved upstream but does NOT change the mock season best", () => {
  const t = team({ runners: [runner({ name: "Already Fast Runner", athleticNetId: "222", timeCentiseconds: 90000, seasonBest: "15:00.0" })] });
  const candidates = [candidate({ athleticNetId: "222", timeCentiseconds: 95000, seasonBest: "15:50.0" })];
  const { team: updated, changes } = mergeTeamRoster(t, candidates);
  assert.equal(updated.runners[0].timeCentiseconds, 90000, "mock season best must not regress");
  assert.equal(updated.runners[0].seasonBest, "15:00.0");
  assert.ok(changes.some((c) => c.type === "slower_performance_preserved"));
});

test("a pending (unverified) performance never reaches the merge step at all", () => {
  // isEligibleCrossCountryRow already proved unverified rows are excluded
  // before realPerformanceToCandidate is ever called on them -- this
  // confirms the CLI's real query-time filter has a matching in-memory
  // guard, so a pending row can never become a candidate in the first
  // place, let alone affect a roster.
  const row = bestPerformanceRow({ verification_status: "unverified", mark_value: 800 });
  assert.equal(isEligibleCrossCountryRow(row), false);
});

test("a rejected/disputed performance never reaches the merge step at all", () => {
  const row = bestPerformanceRow({ verification_status: "disputed", mark_value: 800 });
  assert.equal(isEligibleCrossCountryRow(row), false);
});

// ---------------------------------------------------------------------
// Duplicate / idempotency (tests #4, #5, #11)
// ---------------------------------------------------------------------

test("running the same merge twice produces identical output (idempotent)", () => {
  const t = team({ runners: [runner({ name: "Idempotent Runner", athleticNetId: "333", timeCentiseconds: 100000 })] });
  const candidates = [candidate({ athleticNetId: "333", timeCentiseconds: 95000 })];
  const first = mergeTeamRoster(t, candidates);
  const second = mergeTeamRoster(first.team, candidates);
  assert.deepEqual(first.team.runners, second.team.runners);
  // Second run: the runner is already at the real best, so it's neither
  // an improvement nor a new addition -- just preserved as-is, and a
  // repeated apply changes nothing further.
  assert.equal(second.team.runners[0].timeCentiseconds, 95000);
});

// ---------------------------------------------------------------------
// Team roster: new athlete entering the top seven (tests #6/#10, #7/#11)
// ---------------------------------------------------------------------

test("a newly matched real athlete can enter a team's top seven", () => {
  const existingSeven = Array.from({ length: 7 }, (_, i) => runner({ name: `Existing ${i + 1}`, timeCentiseconds: 100000 + i * 1000, athleticNetId: `id-${i}` }));
  const t = team({ runners: existingSeven });
  const newFastCandidate = candidate({ profileId: "new-fast", name: "Brand New Fast Runner", athleticNetId: "new-id", timeCentiseconds: 90000 });
  const { team: updated, changes } = mergeTeamRoster(t, [newFastCandidate]);

  assert.equal(updated.runners.length, 7, "roster stays capped at seven");
  assert.equal(updated.runners[0].name, "Brand New Fast Runner");
  assert.ok(changes.some((c) => c.type === "new_athlete_added" && c.athlete === "Brand New Fast Runner"));
  assert.ok(changes.some((c) => c.type === "runner_dropped_from_top_seven" && c.athlete === "Existing 7"), "the previous slowest of the seven should be dropped from the mock roster (their real history is untouched elsewhere)");
});

test("a team moves from incomplete (fewer than 5) to complete when a 5th eligible runner is added", () => {
  const fourRunners = Array.from({ length: 4 }, (_, i) => runner({ name: `Runner ${i + 1}`, timeCentiseconds: 100000 + i * 1000, athleticNetId: `id-${i}` }));
  const region = {
    region: "central",
    siteName: "Test Site",
    stateQualifiers: 8,
    individualQualifiers: 16,
    teams: [team({ name: "Growing Team", ohsaaSchoolId: 1, runners: fourRunners })],
    individuals: []
  };
  const before = scoreTeams(region.teams, region.individuals);
  assert.equal(before.teams[0].complete, false);

  const fifthCandidate = candidate({ profileId: "fifth", name: "Fifth Runner", athleticNetId: "id-4", timeCentiseconds: 105000 });
  const { region: updatedRegion } = mergeRegion(region, new Map([[1, [fifthCandidate]]]));
  const after = scoreTeams(updatedRegion.teams, updatedRegion.individuals);
  assert.equal(after.teams[0].complete, true);
  assert.equal(after.teams[0].runners.length, 5);
});

// ---------------------------------------------------------------------
// Regional / State cascade (tests #12, #13, #15)
// ---------------------------------------------------------------------

function buildTwoTeamRegion() {
  const strongTeam = team({
    name: "Strong Team",
    ohsaaSchoolId: 10,
    runners: Array.from({ length: 5 }, (_, i) => runner({ name: `Strong ${i + 1}`, timeCentiseconds: 95000 + i * 500, athleticNetId: `strong-${i}` }))
  });
  const weakTeam = team({
    name: "Weak Team",
    ohsaaSchoolId: 20,
    runners: Array.from({ length: 5 }, (_, i) => runner({ name: `Weak ${i + 1}`, timeCentiseconds: 110000 + i * 500, athleticNetId: `weak-${i}` }))
  });
  return {
    region: "central",
    siteName: "Test Site",
    stateQualifiers: 1,
    individualQualifiers: 2,
    teams: [strongTeam, weakTeam],
    individuals: []
  };
}

// Five real, newly-approved performances landing for the Weak Team's
// whole front line in one import -- realistic for "a batch of new
// source-linked results just cleared review," and, unlike a single new
// runner, actually enough to overcome a team SCORE (a sum of 5 places),
// not just add one fast individual. Verified by hand: before, Strong's
// top 5 places 1-5 (score 15) beats Weak's top 5 places 6-10 (score
// 40). After, these 5 replace Weak's whole scoring five at places 1-5
// (score 15) while Strong's original five are pushed back to places
// 6-10 (score 40) -- a genuine, realistic flip.
function fastNewCandidatesForWeakTeam() {
  return Array.from({ length: 5 }, (_, i) => candidate({ profileId: `superstar-${i}`, name: `Superstar ${i + 1}`, athleticNetId: `superstar-id-${i}`, timeCentiseconds: 40000 + i * 500 }));
}

test("a top-seven roster change can flip regional rank and qualification", () => {
  const region = buildTwoTeamRegion();
  const before = scoreTeams(region.teams, region.individuals);
  assert.equal(before.teams[0].name, "Strong Team");
  assert.equal(before.teams[0].mockRank, 1);

  const { region: updatedRegion, rescored, regionalDiff } = mergeRegion(region, new Map([[20, fastNewCandidatesForWeakTeam()]]));

  assert.equal(rescored, true);
  const after = scoreTeams(updatedRegion.teams, updatedRegion.individuals);
  assert.equal(after.teams[0].name, "Weak Team", "Weak Team should now rank first with 5 new faster approved performances");
  assert.ok(regionalDiff.some((d) => d.type === "regional_team_changed" && d.team === "Weak Team" && d.newQualifies === true));
  assert.ok(regionalDiff.some((d) => d.type === "regional_team_changed" && d.team === "Strong Team" && d.newQualifies === false), "Strong Team should lose its regional qualifying spot (stateQualifiers: 1)");
});

test("a regional qualifier change rebuilds the state field from the NEW regional results, never the old ones", () => {
  const divisionEntry = {
    id: "test-div",
    gender: "boys",
    division: 1,
    label: "Test Division",
    regions: { central: buildTwoTeamRegion() }
  };

  const beforeState = mergeDivision(divisionEntry, new Map());
  assert.equal(beforeState.affected, false, "no real candidates supplied yet, nothing should be marked affected");

  const afterMerge = mergeDivision(divisionEntry, new Map([[20, fastNewCandidatesForWeakTeam()]]));

  assert.equal(afterMerge.affected, true);
  assert.ok(afterMerge.stateDiff.length > 0, "state field must be rebuilt, not carried over, once the regional qualifier pool changes");
  assert.ok(afterMerge.stateDiff.some((d) => d.type === "regional_team_changed" && d.team === "Weak Team"));
});

// ---------------------------------------------------------------------
// Existing scoring engine regression coverage -- there were zero tests
// for src/lib/mock_scoring.mjs before this session; these lock in the
// documented tie-break/displacement rules directly (tests #14, #16, #17).
// ---------------------------------------------------------------------

test("individual qualifiers displace team scorers in shared place order", () => {
  const teams = [team({
    name: "Only Team",
    runners: Array.from({ length: 5 }, (_, i) => runner({ name: `Runner ${i + 1}`, timeCentiseconds: 100000 + i * 1000 }))
  })];
  const fastIndividual = { name: "Fast Individual", school: "Other School", timeCentiseconds: 50000, seasonBest: "8:20.0" };
  const { teams: scoredTeams, individuals } = scoreTeams(teams, [fastIndividual]);

  assert.equal(individuals[0].name, "Fast Individual");
  assert.equal(individuals[0].placePoints, 1, "the individual occupies real place 1, ahead of every team runner");
  // Every team runner's placePoints should be pushed back by the one
  // individual ahead of them (place 2 instead of place 1 for the team's
  // first scorer).
  assert.equal(scoredTeams[0].runners[0].placePoints, 2);
});

test("tied runner times receive the averaged (fractional) place, not a rounded one", () => {
  const teams = [team({
    name: "Tie Team",
    runners: [
      runner({ name: "A", timeCentiseconds: 100000 }),
      runner({ name: "B", timeCentiseconds: 100000 }),
      runner({ name: "C", timeCentiseconds: 101000 }),
      runner({ name: "D", timeCentiseconds: 102000 }),
      runner({ name: "E", timeCentiseconds: 103000 })
    ]
  })];
  const { teams: scoredTeams } = scoreTeams(teams, []);
  const [a, b] = scoredTeams[0].runners;
  assert.equal(a.placePoints, b.placePoints, "tied runners must share the exact same averaged place");
  assert.equal(a.placePoints, 1.5, "places 1 and 2 tied should average to 1.5");
});

test("a team score tie is broken by the sixth runner, then the seventh", () => {
  // Team A and Team B's top 5 runners are given IDENTICAL pairwise
  // times (a genuine 2-way tie at every one of the 5 scoring places),
  // which guarantees an equal top-5 score by construction: each tied
  // pair averages to the same place value for both teams (places 1-2
  // average 1.5, 3-4 average 3.5, ... 9-10 average 9.5; both teams'
  // sum = 1.5+3.5+5.5+7.5+9.5 = 27.5). Only the 6th runner differs --
  // A's 6th (95000) is faster than B's 6th (96000), and both are slower
  // than every tied top-5 runner, so they don't disturb the tie -- the
  // team with the faster 6th runner must rank ahead, per the documented
  // NFHS/OHSAA tiebreak rule this engine's own header comment claims to
  // implement.
  const tiedTimes = [90000, 91000, 92000, 93000, 94000];
  const teamA = team({
    name: "Team A",
    runners: [
      ...tiedTimes.map((t, i) => runner({ name: `A${i + 1}`, timeCentiseconds: t })),
      runner({ name: "A6", timeCentiseconds: 95000 })
    ]
  });
  const teamB = team({
    name: "Team B",
    runners: [
      ...tiedTimes.map((t, i) => runner({ name: `B${i + 1}`, timeCentiseconds: t })),
      runner({ name: "B6", timeCentiseconds: 96000 })
    ]
  });
  const { teams: scoredTeams } = scoreTeams([teamA, teamB], []);
  const a = scoredTeams.find((t) => t.name === "Team A");
  const b = scoredTeams.find((t) => t.name === "Team B");
  assert.equal(a.score, b.score, "both teams should have the identical top-5 score for this fixture to be a real tie test");
  assert.ok(a.sixthPlace < b.sixthPlace, "Team A's 6th runner should occupy a better (lower) place than Team B's");
  assert.ok(a.mockRank < b.mockRank, "Team A (faster 6th runner) must rank ahead of Team B on the tiebreak");
});

// ---------------------------------------------------------------------
// Full-file regression: all eight real division/gender datasets remain
// valid (test #19), using the REAL committed data -- read-only, never
// mutated by this test file.
// ---------------------------------------------------------------------

test("all eight real division datasets in mock-regionals-2026.json still pass validateDivisionRoster", async () => {
  const { default: regionalsData } = await import("../src/data/mock-regionals-2026.json", { with: { type: "json" } });
  assert.equal(regionalsData.divisions.length, 8, "there should be exactly 8 division/gender datasets");
  for (const divisionEntry of regionalsData.divisions) {
    const problems = validateDivisionRoster(divisionEntry, Object.entries(divisionEntry.regions));
    assert.deepEqual(problems, [], `${divisionEntry.label} should have zero validation problems`);
  }
});

// ---------------------------------------------------------------------
// Eligibility filters -- audit follow-up: explicitly confirm every
// filter the export claims to apply, not just the subset already
// covered above.
// ---------------------------------------------------------------------

test("a track 5000m performance is excluded (wrong sport, not just wrong event)", () => {
  assert.equal(isEligibleCrossCountryRow(bestPerformanceRow({ sport: "outdoor_track", event_key: "track_5000" })), false);
});

test("an indoor track performance is excluded", () => {
  assert.equal(isEligibleCrossCountryRow(bestPerformanceRow({ sport: "indoor_track" })), false);
});

test("a three-mile (xc_3_mile-shaped) event key is excluded, only xc_5k is eligible", () => {
  assert.equal(isEligibleCrossCountryRow(bestPerformanceRow({ event_key: "xc_3_mile" })), false);
});

test("a performance not marked public_visible is excluded (defense-in-depth beyond the view's own filter)", () => {
  assert.equal(isEligibleCrossCountryRow(bestPerformanceRow({ public_visible: false })), false);
});

test("a community-reported or editorial-context result_status is excluded -- only official/reviewed results are eligible", () => {
  assert.equal(isEligibleCrossCountryRow(bestPerformanceRow({ result_status: "community_reported" })), false);
  assert.equal(isEligibleCrossCountryRow(bestPerformanceRow({ result_status: "editorial_context" })), false);
});

test("isEligibleSchoolLevel excludes middle school and club programs, includes only high_school", () => {
  assert.equal(isEligibleSchoolLevel("high_school"), true);
  assert.equal(isEligibleSchoolLevel("middle_school"), false);
  assert.equal(isEligibleSchoolLevel("club"), false);
  assert.equal(isEligibleSchoolLevel(null), false);
});

// ---------------------------------------------------------------------
// Content hashing (the apply-protection system)
// ---------------------------------------------------------------------

test("computeContentHash is deterministic for identical data", () => {
  const data = { a: 1, b: [1, 2, 3], c: { nested: true } };
  assert.equal(computeContentHash(data), computeContentHash({ a: 1, b: [1, 2, 3], c: { nested: true } }));
});

test("computeContentHash changes when content changes", () => {
  assert.notEqual(computeContentHash({ a: 1 }), computeContentHash({ a: 2 }));
});

// ---------------------------------------------------------------------
// Roster validation audit (section 6 of the safety pass)
// ---------------------------------------------------------------------

test("a new athlete is added when a team has fewer than seven runners, even if slower than every existing runner", () => {
  const fourFastRunners = Array.from({ length: 4 }, (_, i) => runner({ name: `Fast ${i + 1}`, timeCentiseconds: 90000 + i * 500, athleticNetId: `fast-${i}` }));
  const t = team({ runners: fourFastRunners });
  const slowNewCandidate = candidate({ profileId: "slow-new", name: "Slow New Runner", athleticNetId: "slow-new-id", timeCentiseconds: 200000 });
  const { team: updated, changes } = mergeTeamRoster(t, [slowNewCandidate]);
  assert.equal(updated.runners.length, 5, "the team had room, so the new (even if slow) runner should be added");
  assert.ok(updated.runners.some((r) => r.name === "Slow New Runner"));
  assert.ok(changes.some((c) => c.type === "new_athlete_added" && c.athlete === "Slow New Runner"));
});

test("a new athlete only removes another runner once the team already has seven eligible runners", () => {
  const sixRunners = Array.from({ length: 6 }, (_, i) => runner({ name: `Existing ${i + 1}`, timeCentiseconds: 90000 + i * 500, athleticNetId: `id-${i}` }));
  const t = team({ runners: sixRunners });
  const slowNewCandidate = candidate({ profileId: "slow-new", name: "Slower New Runner", athleticNetId: "slow-new-id", timeCentiseconds: 300000 });
  const { team: updated, changes } = mergeTeamRoster(t, [slowNewCandidate]);
  assert.equal(updated.runners.length, 7, "team had room for a 7th, nobody should be removed");
  assert.equal(changes.filter((c) => c.type === "runner_dropped_from_top_seven").length, 0);
  assert.ok(updated.runners.some((r) => r.name === "Slower New Runner"));
});

test("the seven fastest unique athletes are always selected, never more than seven", () => {
  const tenRunners = Array.from({ length: 10 }, (_, i) => runner({ name: `Runner ${i + 1}`, timeCentiseconds: 90000 + i * 500, athleticNetId: `id-${i}` }));
  const t = team({ runners: tenRunners });
  const { team: updated } = mergeTeamRoster(t, []);
  assert.equal(updated.runners.length, 7);
  assert.deepEqual(updated.runners.map((r) => r.name), ["Runner 1", "Runner 2", "Runner 3", "Runner 4", "Runner 5", "Runner 6", "Runner 7"]);
});

test("an unmerged duplicate real athlete profile (two profile ids, same name/grad year) never adds the same person to a roster twice", () => {
  const t = team({ runners: [] });
  const duplicateA = candidate({ profileId: "dup-a", name: "Duplicate Person", graduationYear: 2027, athleticNetId: "dup-a-id", timeCentiseconds: 95000 });
  const duplicateB = candidate({ profileId: "dup-b", name: "Duplicate Person", graduationYear: 2027, athleticNetId: "dup-b-id", timeCentiseconds: 96000 });
  const { team: updated, changes } = mergeTeamRoster(t, [duplicateA, duplicateB]);
  const matchingRunners = updated.runners.filter((r) => r.name === "Duplicate Person");
  assert.equal(matchingRunners.length, 1, "the same real person must never occupy two roster slots");
  assert.equal(matchingRunners[0].timeCentiseconds, 95000, "the faster of the two duplicate profiles should be the one kept");
  assert.ok(changes.some((c) => c.type === "duplicate_profile_collision"), "the collision must be reported, not silently resolved");
});

test("a slower current mock result is never replaced by a real approved performance that is also slower", () => {
  const t = team({ runners: [runner({ name: "Fast Baseline", athleticNetId: "id-1", timeCentiseconds: 90000, seasonBest: "15:00.0" })] });
  const slowerReal = candidate({ athleticNetId: "id-1", timeCentiseconds: 95000, seasonBest: "15:50.0" });
  const { team: updated } = mergeTeamRoster(t, [slowerReal]);
  assert.equal(updated.runners[0].timeCentiseconds, 90000);
  assert.equal(updated.runners[0].seasonBest, "15:00.0");
});

test("when the real system's current best for an athlete changes (e.g. a correction/void moved the view's best_rank=1 row to a different, slower performance), the merge simply uses whatever athlete_best_performances currently returns -- no special void-handling code needed, because the view itself is always re-queried fresh", () => {
  // This documents and locks in WHY corrections/voids are handled
  // correctly without any dedicated code path here: athlete_best_performances
  // is a live SQL view (install/03), not a cached snapshot -- voiding or
  // correcting a performance in the real athlete_performances table
  // changes what that view returns on the VERY NEXT query, automatically.
  // Simulated here as two independent merge calls with two different
  // "current best" values for the same athlete, proving both are
  // handled correctly with no leftover state from the first call.
  const t = team({ runners: [runner({ name: "Runner", athleticNetId: "id-1", timeCentiseconds: 100000, seasonBest: "16:40.0" })] });

  const beforeVoid = candidate({ athleticNetId: "id-1", timeCentiseconds: 95000, seasonBest: "15:50.0" }); // the since-voided fast result
  const afterVoidStep = mergeTeamRoster(t, [beforeVoid]);
  assert.equal(afterVoidStep.team.runners[0].timeCentiseconds, 95000);

  // The view now returns the next-fastest legitimate performance instead
  // (the fast one was voided) -- a fresh merge call against the ORIGINAL
  // team (not the intermediate result) with this new "current best":
  const afterVoidCandidate = candidate({ athleticNetId: "id-1", timeCentiseconds: 98000, seasonBest: "16:20.0" });
  const correctedStep = mergeTeamRoster(t, [afterVoidCandidate]);
  assert.equal(correctedStep.team.runners[0].timeCentiseconds, 98000, "the mock roster should reflect whatever the view currently says is the athlete's best, not a stale cached value");
});

test("no team loses an existing baseline runner merely because that runner has no match in the real system yet", () => {
  const t = team({ runners: [runner({ name: "Not Yet In Supabase", timeCentiseconds: 100000, seasonBest: "16:40.0", athleticNetId: null })] });
  const { team: updated, changed } = mergeTeamRoster(t, []); // no real candidates at all for this team
  assert.equal(updated.runners.length, 1);
  assert.deepEqual(updated.runners[0], t.runners[0], "a baseline runner with zero real candidates must be returned completely untouched");
  assert.equal(changed, false);
});

// ---------------------------------------------------------------------
// School identity regression: the five schools resolved by
// install/65_MISSING_MOCK_MEET_SCHOOL_IDENTITIES.sql (Hamilton,
// Groveport Madison, Danville, Elgin, Crestline) and the previously
// resolved Beaver Local -- verified directly against the REAL committed
// mock-regionals-2026.json, never a fixture, since this is a data
// integrity claim about the published file itself, not about matching
// logic (mergeRegion's own logic is already covered by the tests above
// and does not change based on which OHSAA ID a team carries).
// ---------------------------------------------------------------------

test("Hamilton (both boys and girls Division I) resolves to OHSAA 685, never to Hamilton Township's 686", async () => {
  const { default: regionalsData } = await import("../src/data/mock-regionals-2026.json", { with: { type: "json" } });
  const boysHamilton = regionalsData.divisions.find((d) => d.label === "Boys Division I").regions.southwest.teams.find((t) => t.name === "Hamilton");
  const girlsHamilton = regionalsData.divisions.find((d) => d.label === "Girls Division I").regions.southwest.teams.find((t) => t.name === "Hamilton");
  assert.equal(boysHamilton.ohsaaSchoolId, 685);
  assert.equal(girlsHamilton.ohsaaSchoolId, 685);
  assert.notEqual(boysHamilton.ohsaaSchoolId, 686, "Hamilton must never resolve to Hamilton Township's OHSAA ID");
  assert.equal(boysHamilton.city, "Hamilton");
  assert.equal(boysHamilton.athleticDistrict, "Southwest");
  assert.equal(boysHamilton.ohsaaSchoolId, girlsHamilton.ohsaaSchoolId, "boys and girls Hamilton entries must use the identical school identity");
});

test("Groveport-Madison (hyphenated in the mock data) resolves to Groveport Madison's OHSAA 682", async () => {
  const { default: regionalsData } = await import("../src/data/mock-regionals-2026.json", { with: { type: "json" } });
  const team = regionalsData.divisions.find((d) => d.label === "Girls Division I").regions.central.teams.find((t) => t.name === "Groveport-Madison");
  assert.equal(team.ohsaaSchoolId, 682);
  assert.equal(team.city, "Groveport");
  assert.equal(team.athleticDistrict, "Central");
});

test("Danville resolves to OHSAA 454 with a Central athletic district", async () => {
  const { default: regionalsData } = await import("../src/data/mock-regionals-2026.json", { with: { type: "json" } });
  const team = regionalsData.divisions.find((d) => d.label === "Girls Division IV").regions.central.teams.find((t) => t.name === "Danville");
  assert.equal(team.ohsaaSchoolId, 454);
  assert.equal(team.city, "Danville");
  assert.equal(team.athleticDistrict, "Central");
});

test("Elgin resolves to OHSAA 524 with its official city of Marion", async () => {
  const { default: regionalsData } = await import("../src/data/mock-regionals-2026.json", { with: { type: "json" } });
  const team = regionalsData.divisions.find((d) => d.label === "Girls Division IV").regions.central.teams.find((t) => t.name === "Elgin");
  assert.equal(team.ohsaaSchoolId, 524);
  assert.equal(team.city, "Marion", "Elgin's official city is Marion, not a city literally named Elgin");
  assert.equal(team.athleticDistrict, "Central");
});

test("Crestline resolves to OHSAA 432, never to Colonel Crawford's 400", async () => {
  const { default: regionalsData } = await import("../src/data/mock-regionals-2026.json", { with: { type: "json" } });
  const team = regionalsData.divisions.find((d) => d.label === "Girls Division IV").regions.northwest.teams.find((t) => t.name === "Crestline");
  assert.equal(team.ohsaaSchoolId, 432);
  assert.notEqual(team.ohsaaSchoolId, 400, "Crestline must never resolve to Colonel Crawford's OHSAA ID, even though Colonel Crawford's own city field reads Crestline");
  assert.equal(team.city, "Crestline");
  assert.equal(team.athleticDistrict, "Northwest");
});

test("the five newly resolved identities are consistent everywhere they appear in the file, across both teams and any supplemental individuals", async () => {
  const { default: regionalsData } = await import("../src/data/mock-regionals-2026.json", { with: { type: "json" } });
  const expected = {
    Hamilton: { ohsaaSchoolId: 685, city: "Hamilton", athleticDistrict: "Southwest" },
    "Groveport-Madison": { ohsaaSchoolId: 682, city: "Groveport", athleticDistrict: "Central" },
    Danville: { ohsaaSchoolId: 454, city: "Danville", athleticDistrict: "Central" },
    Elgin: { ohsaaSchoolId: 524, city: "Marion", athleticDistrict: "Central" },
    Crestline: { ohsaaSchoolId: 432, city: "Crestline", athleticDistrict: "Northwest" }
  };
  let checked = 0;
  for (const division of regionalsData.divisions) {
    for (const region of Object.values(division.regions)) {
      for (const t of region.teams) {
        if (expected[t.name]) {
          assert.deepEqual({ ohsaaSchoolId: t.ohsaaSchoolId, city: t.city, athleticDistrict: t.athleticDistrict }, expected[t.name], `${division.label} / ${t.name} (team) must match the verified identity`);
          checked += 1;
        }
      }
      for (const ind of region.individuals || []) {
        if (expected[ind.school]) {
          assert.deepEqual({ ohsaaSchoolId: ind.ohsaaSchoolId, city: ind.city, athleticDistrict: ind.athleticDistrict }, expected[ind.school], `${division.label} / ${ind.name} (individual, school=${ind.school}) must match the verified identity`);
          checked += 1;
        }
      }
    }
  }
  assert.equal(checked, 7, "expected exactly 7 nodes (Boys D1 Hamilton, Girls D1 Hamilton, Girls D1 Groveport-Madison, Girls D4 Danville, Girls D4 Elgin, Girls D4 Crestline, Boys D4 Colten Keller at Crestline)");
});

test("Beaver Local's previously resolved identity (OHSAA 176) is unchanged by this pass, across its team entry and both individual entries", async () => {
  const { default: regionalsData } = await import("../src/data/mock-regionals-2026.json", { with: { type: "json" } });
  const expectedBeaver = { ohsaaSchoolId: 176, city: "East Liverpool", athleticDistrict: "East" };
  const team = regionalsData.divisions.find((d) => d.label === "Boys Division III").regions.central.teams.find((t) => t.name === "Beaver Local");
  assert.deepEqual({ ohsaaSchoolId: team.ohsaaSchoolId, city: team.city, athleticDistrict: team.athleticDistrict }, expectedBeaver);
  const individuals = regionalsData.divisions.find((d) => d.label === "Girls Division III").regions.central.individuals.filter((ind) => ind.school === "Beaver Local");
  assert.equal(individuals.length, 2);
  for (const ind of individuals) {
    assert.deepEqual({ ohsaaSchoolId: ind.ohsaaSchoolId, city: ind.city, athleticDistrict: ind.athleticDistrict }, expectedBeaver);
  }
});

test("no unrelated school's existing identity was overwritten by this pass (spot-check a school with a pre-existing, already-correct identity)", async () => {
  const { default: regionalsData } = await import("../src/data/mock-regionals-2026.json", { with: { type: "json" } });
  const utica = regionalsData.divisions.find((d) => d.label === "Girls Division III").regions.central.individuals.find((ind) => ind.school === "Utica");
  assert.equal(utica.ohsaaSchoolId, 1584, "Utica's pre-existing identity must be untouched by the school-identity resolution work in this file");
  assert.equal(utica.city, "Utica");
  assert.equal(utica.athleticDistrict, "Central");
});
