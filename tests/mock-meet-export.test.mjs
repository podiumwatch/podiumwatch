import test from "node:test";
import assert from "node:assert/strict";
import {
  MOCK_MEET_SEASON_YEAR,
  gradeForGraduationYear,
  isEligibleCrossCountryRow,
  realPerformanceToCandidate,
  matchRunnerToCandidate,
  mergeTeamRoster,
  groupCandidatesBySchool,
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

  const realCandidateAtSchoolA = candidate({ profileId: "a", schoolId: "uuid-a", name: "Same Name", graduationYear: 2027, timeCentiseconds: 90000 });
  const { candidatesByTeamName } = groupCandidatesBySchool(
    [{ ...realCandidateAtSchoolA, schoolId: 1 }],
    [teamA, teamB]
  );

  const resultA = mergeTeamRoster(teamA, candidatesByTeamName.get("School A") || []);
  const resultB = mergeTeamRoster(teamB, candidatesByTeamName.get("School B") || []);

  assert.equal(resultA.team.runners[0].timeCentiseconds, 90000, "School A's runner should be improved by the real match scoped to their own school");
  assert.equal(resultB.team.runners[0].timeCentiseconds, 100000, "School B's identically-named runner must be completely untouched");
});

// ---------------------------------------------------------------------
// School matching / identity resolution (test #7: unknown school -> review)
// ---------------------------------------------------------------------

test("a team with no ohsaaSchoolId is reported as unresolved, not guessed at", () => {
  const unresolvedTeam = team({ name: "Unresolved School", ohsaaSchoolId: null });
  const resolvedTeam = team({ name: "Resolved School", ohsaaSchoolId: 555 });
  const { candidatesByTeamName, unresolvedTeams } = groupCandidatesBySchool(
    [candidate({ schoolId: 555 })],
    [unresolvedTeam, resolvedTeam]
  );
  assert.deepEqual(unresolvedTeams, ["Unresolved School"]);
  assert.equal(candidatesByTeamName.has("Unresolved School"), false);
  assert.equal(candidatesByTeamName.has("Resolved School"), true);
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
