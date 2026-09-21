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
// in sync. This engine is authoritative: an upstream source (ChatGPT or
// otherwise) may supply its own scores/ranks as a quality-check
// cross-reference, but only this file's output is ever rendered or relied
// on for qualification decisions.
//
// Methodology matches the September 17 mock meets package this reuses:
// top five score, sixth and seventh displace, identical times share their
// averaged occupied place (fractional points are real, not rounded), and
// a team with fewer than five runners cannot score a team result (the
// same real NFHS/OHSAA rule -- such a team is still listed, just marked
// incomplete rather than given a fabricated score).

// scoreTeams(teams, individuals?) -- individuals is an optional array of
// unattached runners (State-meet individual qualifiers) who are ranked in
// the SAME shared place/tie computation as every team runner -- so they
// correctly displace team scorers exactly like a real meet, where an
// individual entrant still occupies a real finishing place -- but are
// never added to any team's own five/six/seven and never contribute to a
// team score. Called with no second argument (every regional page, and
// every pre-2026-09-21 caller) individuals is simply empty and behavior
// is unchanged from before this was added -- verified directly against
// the September 17 mock meets' independently-checked scores.
//
// Return shape is always { teams, individuals } (individuals is an empty
// array when none were passed in). This is a deliberate, explicit change
// from the previous plain-array return -- callers were updated to
// destructure .teams rather than overloading the return shape based on
// which arguments were passed.
export function scoreTeams(teams, individuals = []) {
  const allRunners = [];
  for (const team of teams) {
    const sorted = [...team.runners].sort((a, b) => a.timeCentiseconds - b.timeCentiseconds);
    sorted.forEach((runner, index) => {
      allRunners.push({ ...runner, teamName: team.name, teamPosition: index + 1, unattached: false });
    });
  }
  individuals.forEach((runner) => {
    // teamName here is the scoring-attachment field (deliberately null --
    // an individual scores for no team); the runner's real team/region of
    // origin travels separately as originalTeam/originalRegion so it
    // can't collide with or get overwritten by this attachment field.
    allRunners.push({ ...runner, teamName: null, teamPosition: null, unattached: true });
  });
  allRunners.sort((a, b) => a.timeCentiseconds - b.timeCentiseconds);

  // Assign places, averaging ties: a group of N runners with the identical
  // timeCentiseconds all get the average of the N consecutive place
  // numbers they occupy (e.g. two tied for 7th/8th both get 7.5). This
  // pass runs across the WHOLE field (team runners and individuals
  // together), matching how a real meet's finish order works.
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
  const rankedIndividuals = [];
  for (const runner of allRunners) {
    if (runner.unattached) {
      // teamPosition/scoring are stale team-scoring artifacts a pooled
      // individual can carry over from an earlier regional scoreTeams()
      // pass (e.g. State pooling an individual qualifier who scored for
      // their own team in the regional) -- meaningless once unattached,
      // dropped here rather than trusting every caller to strip them.
      // originalTeam/region are kept: real, non-stale display metadata
      // (which team and region this individual actually came from) that
      // src/pages/mockregionals.mjs needs for "preserve each state
      // entrant's original region."
      const { unattached, teamPosition, scoring, teamName, ...rest } = runner;
      rankedIndividuals.push(rest);
      continue;
    }
    if (!runnersByTeam.has(runner.teamName)) runnersByTeam.set(runner.teamName, []);
    runnersByTeam.get(runner.teamName).push(runner);
  }
  rankedIndividuals.sort((a, b) => a.placePoints - b.placePoints);

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
      region: team.region ?? null,
      complete,
      score,
      sixthPlace,
      seventhPlace,
      runners: runners.map(({ teamName, unattached, ...rest }) => rest)
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
  return { teams: [...ranked, ...incomplete], individuals: rankedIndividuals };
}

// selectIndividualQualifiers -- OHSAA's real rule: the fastest finishers
// NOT on a team that already qualified, taken in real overall finish
// order (not re-ranked among themselves), up to the official
// individualQualifierCount for that region/division/gender. Operates on
// an already-scored regional field (the .teams array from a plain
// scoreTeams(regionTeams) call, so every runner already carries its real
// regional placePoints) plus the region's real stateQualifiers count, so
// it never has to re-derive qualification itself.
//
// A tie sitting exactly on the cutoff line is included whole rather than
// arbitrarily cut -- e.g. if the 16th and 17th fastest non-qualifying-team
// runners are tied, both advance -- matching how a real meet resolves a
// tie for the last qualifying spot (nobody is arbitrarily excluded from a
// dead-even tie).
export function selectIndividualQualifiers(scoredRegionTeams, stateQualifiers, individualQualifierCount) {
  if (!individualQualifierCount) return [];

  const qualifyingNames = new Set(
    scoredRegionTeams.filter((t) => t.complete && t.mockRank <= stateQualifiers).map((t) => t.name)
  );

  const pool = [];
  for (const team of scoredRegionTeams) {
    if (qualifyingNames.has(team.name)) continue;
    for (const runner of team.runners) {
      pool.push({ ...runner, originalTeam: team.name, originalRegion: team.region ?? null });
    }
  }
  pool.sort((a, b) => a.placePoints - b.placePoints);

  if (pool.length <= individualQualifierCount) return pool;

  const cutoffPoints = pool[individualQualifierCount - 1].placePoints;
  return pool.filter((runner, index) => index < individualQualifierCount || runner.placePoints === cutoffPoints);
}

// Division-wide validation, run once per division/gender across every one
// of its regions combined (a team or athlete can't legitimately appear
// twice within the same real division/gender, regardless of which region
// bucket the data entry happened to land in). Returns a list of plain-
// text problem descriptions rather than throwing directly, so a caller
// can decide whether to fail the build (the established pattern for bad
// data in this codebase -- see validateStory() in src/lib/content.mjs) or
// just report; src/pages/mockregionals.mjs throws on any non-empty list,
// since a silently-wrong regional/state field is worse than a loud build
// failure that points at exactly which row is wrong.
export function validateDivisionRoster(divisionLabel, regionEntries) {
  const problems = [];
  const seenTeams = new Map();
  const seenAthletes = new Map();

  for (const [regionKey, region] of regionEntries) {
    for (const team of region.teams) {
      const teamKey = team.name.trim().toLowerCase();
      if (seenTeams.has(teamKey)) {
        problems.push(`${divisionLabel}: "${team.name}" appears in both ${seenTeams.get(teamKey)} and ${regionKey} -- a team can only be in one region.`);
      } else {
        seenTeams.set(teamKey, regionKey);
      }

      if (team.region && team.region !== region.region) {
        problems.push(`${divisionLabel}: "${team.name}" is stored under ${regionKey} (${region.region}) but its own region field says "${team.region}".`);
      }

      for (const runner of team.runners) {
        const athleteKey = runner.name.trim().toLowerCase();
        if (seenAthletes.has(athleteKey)) {
          const prior = seenAthletes.get(athleteKey);
          problems.push(`${divisionLabel}: "${runner.name}" appears on both ${prior.team} (${prior.regionKey}) and ${team.name} (${regionKey}) -- an athlete can only run for one team.`);
        } else {
          seenAthletes.set(athleteKey, { team: team.name, regionKey });
        }
      }
    }
  }

  return problems;
}
