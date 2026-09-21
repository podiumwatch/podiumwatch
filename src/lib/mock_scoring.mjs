// Shared cross country mock-meet scoring engine.
//
// Input is raw rosters only -- each team's runners with just a name and a
// time (seasonBest display string + timeCentiseconds for sorting/ties).
// Everything else (place points, team position, scoring/displacing role,
// sixth/seventh, team score, mock rank) is computed here, at build time,
// from those raw times -- never hand-entered or stored pre-computed. That
// keeps a single source of truth (the supplied times) and lets the same
// function score a region's regular field or a pooled State field built
// from regional qualifiers, with no separate "state scoring" path to keep
// in sync.
//
// Methodology matches the September 17 mock meets package this reuses:
// top five score, sixth and seventh displace, identical times share their
// averaged occupied place (fractional points are real, not rounded), and
// a team with fewer than five runners cannot score a team result (the
// same real NFHS/OHSAA rule -- such a team is still listed, just marked
// incomplete rather than given a fabricated score).

export function scoreTeams(teams) {
  const allRunners = [];
  for (const team of teams) {
    const sorted = [...team.runners].sort((a, b) => a.timeCentiseconds - b.timeCentiseconds);
    sorted.forEach((runner, index) => {
      allRunners.push({ ...runner, teamName: team.name, teamPosition: index + 1 });
    });
  }
  allRunners.sort((a, b) => a.timeCentiseconds - b.timeCentiseconds);

  // Assign places, averaging ties: a group of N runners with the identical
  // timeCentiseconds all get the average of the N consecutive place
  // numbers they occupy (e.g. two tied for 7th/8th both get 7.5).
  let i = 0;
  let place = 1;
  while (i < allRunners.length) {
    let j = i;
    while (j + 1 < allRunners.length && allRunners[j + 1].timeCentiseconds === allRunners[i].timeCentiseconds) j += 1;
    const tieCount = j - i + 1;
    const places = Array.from({ length: tieCount }, (_, k) => place + k);
    const averagePlace = places.reduce((sum, p) => sum + p, 0) / tieCount;
    for (let k = i; k <= j; k += 1) allRunners[k].placePoints = averagePlace;
    place += tieCount;
    i = j + 1;
  }

  const runnersByTeam = new Map();
  for (const runner of allRunners) {
    if (!runnersByTeam.has(runner.teamName)) runnersByTeam.set(runner.teamName, []);
    runnersByTeam.get(runner.teamName).push(runner);
  }

  const scoredTeams = teams.map((team) => {
    const runners = (runnersByTeam.get(team.name) || []).sort((a, b) => a.teamPosition - b.teamPosition);
    const complete = runners.length >= 5;
    runners.forEach((runner) => { runner.scoring = complete && runner.teamPosition <= 5; });
    const score = complete
      ? runners.filter((r) => r.teamPosition <= 5).reduce((sum, r) => sum + r.placePoints, 0)
      : null;
    const sixthPlace = runners.find((r) => r.teamPosition === 6)?.placePoints ?? null;
    const seventhPlace = runners.find((r) => r.teamPosition === 7)?.placePoints ?? null;
    return {
      name: team.name,
      complete,
      score,
      sixthPlace,
      seventhPlace,
      runners: runners.map(({ teamName, ...rest }) => rest)
    };
  });

  const ranked = scoredTeams.filter((t) => t.complete).sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    // Team-score tie: the team whose sixth runner placed better wins,
    // matching the "team ties use sixth" rule already established for
    // the September 17 mock meets (Gahanna Lincoln over Springboro).
    const aSixth = a.sixthPlace ?? Infinity;
    const bSixth = b.sixthPlace ?? Infinity;
    return aSixth - bSixth;
  });
  ranked.forEach((team, index) => { team.mockRank = index + 1; });

  const incomplete = scoredTeams.filter((t) => !t.complete);
  return [...ranked, ...incomplete];
}
