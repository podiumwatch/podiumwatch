import assert from "node:assert/strict";

// public/scripts/meet-scoring.js is a plain classic script (matching
// every other file in public/scripts/), so it attaches its functions to
// window rather than using export. A minimal window stub is all Node
// needs to load it directly here.
global.window = {};
await import("../public/scripts/meet-scoring.js");

const { MIN_SCORING_FINISHERS, DISPLACER_COUNT, computeTeamScores, rankTeams } = global.window.PodiumMeetScoring;

assert.equal(MIN_SCORING_FINISHERS, 5);
assert.equal(DISPLACER_COUNT, 2);

function team(teamId, teamName = teamId) {
  return { teamId, teamName };
}

// --- computeTeamScores: a clean dual meet, 5-and-5, no displacers ------------

{
  const finishOrder = [team("a"), team("b"), team("a"), team("b"), team("a"), team("b"), team("a"), team("b"), team("a"), team("b")];
  const scores = computeTeamScores(finishOrder);
  const a = scores.find((t) => t.teamId === "a");
  const b = scores.find((t) => t.teamId === "b");

  assert.deepEqual(a.allPlaces, [1, 3, 5, 7, 9]);
  assert.deepEqual(a.scoringPlaces, [1, 3, 5, 7, 9]);
  assert.equal(a.score, 25, "Team A's 5 alternating-odd places must sum to 25.");
  assert.equal(a.complete, true);
  assert.deepEqual(a.displacerPlaces, [], "A team with exactly 5 finishers has no displacers.");

  assert.deepEqual(b.allPlaces, [2, 4, 6, 8, 10]);
  assert.equal(b.score, 30, "Team B's 5 alternating-even places must sum to 30.");

  const { ranked, unscored } = rankTeams(scores);
  assert.equal(unscored.length, 0);
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].teamId, "a", "Team A's lower score (25) must win the dual meet.");
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked[1].teamId, "b");
  assert.equal(ranked[1].rank, 2);
  assert.equal(ranked[0].scoreTied, false);
}

// --- computeTeamScores: displacers (7 finishers) and excess (9th+ ignored) --

{
  const finishOrder = [team("a"), team("a"), team("a"), team("a"), team("a"), team("a"), team("a"), team("a"), team("a")];
  const [a] = computeTeamScores(finishOrder);

  assert.equal(a.finisherCount, 9, "All 9 finishers must still be counted toward finisherCount.");
  assert.deepEqual(a.scoringPlaces, [1, 2, 3, 4, 5], "Only the first 5 places score.");
  assert.equal(a.score, 15);
  assert.deepEqual(a.displacerPlaces, [6, 7], "The 6th and 7th finishers are displacers, recorded but not scored.");
  assert.deepEqual(a.allPlaces, [1, 2, 3, 4, 5, 6, 7, 8, 9], "Every finisher's place is kept, even past the displacers.");
}

// --- computeTeamScores: incomplete team (fewer than 5 finishers) does not score --

{
  const finishOrder = [team("a"), team("b"), team("b"), team("a"), team("b"), team("a"), team("b")];
  const scores = computeTeamScores(finishOrder);
  const a = scores.find((t) => t.teamId === "a");
  const b = scores.find((t) => t.teamId === "b");

  assert.equal(a.finisherCount, 3);
  assert.equal(a.complete, false, "A team with only 3 finishers is incomplete and cannot score.");
  assert.equal(a.score, null, "An incomplete team's score must be null, never a partial sum.");
  assert.deepEqual(a.scoringPlaces, []);

  assert.equal(b.finisherCount, 4);
  assert.equal(b.complete, false, "4 finishers is still one short of the minimum 5.");

  const { ranked, unscored } = rankTeams(scores);
  assert.equal(ranked.length, 0, "No team has enough finishers to be ranked.");
  assert.equal(unscored.length, 2);
}

// --- computeTeamScores: unattached/no-team finishers occupy a place but never score --

{
  // Place order: A, unattached, A, A, unattached, A, A -- the two
  // unattached slots must not be attributed to any team, but must still
  // consume place numbers 2 and 5 so Team A's real places are 1,3,4,6,7.
  const finishOrder = [team("a"), null, team("a"), team("a"), { teamId: null }, team("a"), team("a")];
  const [a] = computeTeamScores(finishOrder);

  assert.equal(a.finisherCount, 5);
  assert.deepEqual(a.allPlaces, [1, 3, 4, 6, 7], "Unattached finishers must consume real place numbers without ever being attributed to a team.");
  assert.equal(a.score, 1 + 3 + 4 + 6 + 7);
}

// --- rankTeams: a same-total-score tie is deterministically broken by the 5th scorer --

{
  const finishOrder = Array.from({ length: 25 }, () => null);
  [1, 2, 3, 4, 25].forEach((place) => { finishOrder[place - 1] = team("a", "Team A"); });
  [5, 6, 7, 8, 9].forEach((place) => { finishOrder[place - 1] = team("b", "Team B"); });

  const scores = computeTeamScores(finishOrder);
  const a = scores.find((t) => t.teamId === "a");
  const b = scores.find((t) => t.teamId === "b");
  assert.equal(a.score, 35);
  assert.equal(b.score, 35, "Both teams must have the exact same 35-point total for this to be a real tie-break test.");

  const { ranked } = rankTeams(scores);
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].teamId, "b", "Team B's better (lower) 5th/worst scorer (9th place vs Team A's 25th) must win the tie, per the standard NFHS tie-break rule.");
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked[1].teamId, "a");
  assert.equal(ranked[1].rank, 2);
  assert.equal(ranked[0].scoreTied, true, "Both teams' equal raw totals must still be flagged as tied for the UI, even though the rank order itself is fully decided.");
  assert.equal(ranked[1].scoreTied, true);
}

// --- rankTeams: an invitational (3+ teams) mixes complete and incomplete teams --

{
  const finishOrder = [
    team("a"), team("b"), team("a"), team("c"), team("b"),
    team("a"), team("c"), team("a"), team("b"), team("a"),
    team("a"), team("b"), team("c")
  ];
  const scores = computeTeamScores(finishOrder);
  const { ranked, unscored } = rankTeams(scores);

  // Team A: 1,3,6,8,10 = 28 (finisherCount 6, one displacer at 11)
  // Team B: 2,5,9,12 = only 4 finishers -> incomplete, unscored
  // Team C: 4,7,13 = only 3 finishers -> incomplete, unscored
  assert.equal(ranked.length, 1, "Only Team A has 5+ finishers in this field.");
  assert.equal(ranked[0].teamId, "a");
  assert.equal(ranked[0].score, 1 + 3 + 6 + 8 + 10);
  assert.deepEqual(ranked[0].displacerPlaces, [11]);
  assert.equal(unscored.length, 2, "Teams B and C must both be reported as unscored (incomplete), not silently dropped.");
}

console.log("Meet scoring validation passed.");
console.log("Team score summation checked: clean 5-and-5 dual meets, 7+ finisher teams (displacers plus excess finishers past the displacers), and incomplete (<5 finisher) teams that correctly score null.");
console.log("Unattached/no-team finishers checked to occupy a real place (displacing scorers behind them) without ever being attributed to any team.");
console.log("Tie-break checked against a real same-total-score scenario, confirmed deterministic via the standard NFHS worst-scorer-first rule, with the informational scoreTied flag checked separately from the decided rank order.");
console.log("Invitational (3+ team) scoring checked: complete and incomplete teams correctly separated into ranked vs unscored.");
