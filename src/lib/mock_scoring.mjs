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
// individualQualifierCount for that region/division/gender.
//
// Operates on an already-scored regional field: scoredTeams (the .teams
// array) and scoredIndividuals (the .individuals array) from the SAME
// scoreTeams(regionTeams, regionIndividuals) call, so every runner --
// whether on a team roster or a supplemental top-500 individual entry --
// already carries its real regional placePoints from one shared race
// field. "After the qualifying teams are selected, remove every runner
// from those teams before selecting individual qualifiers": the pool
// here is every runner NOT on a qualifying team's roster, whether that's
// a non-qualifying team's own runner or an unattached supplemental
// individual (who was never on any team's roster to begin with, so is
// always eligible unless already excluded upstream at data-entry time --
// see validateDivisionRoster's top-75-school check).
//
// A tie sitting exactly on the cutoff line is included whole rather than
// arbitrarily cut -- e.g. if the 16th and 17th fastest non-qualifying-team
// runners are tied, both advance -- matching how a real meet resolves a
// tie for the last qualifying spot (nobody is arbitrarily excluded from a
// dead-even tie).
export function selectIndividualQualifiers(scoredTeams, scoredIndividuals, stateQualifiers, individualQualifierCount) {
  if (!individualQualifierCount) return [];

  const qualifyingNames = new Set(
    scoredTeams.filter((t) => t.complete && t.mockRank <= stateQualifiers).map((t) => t.name)
  );

  const pool = [];
  for (const team of scoredTeams) {
    if (qualifyingNames.has(team.name)) continue;
    for (const runner of team.runners) {
      pool.push({ ...runner, originalTeam: team.name, originalRegion: team.region ?? null });
    }
  }
  for (const individual of scoredIndividuals || []) {
    // A supplemental individual is never "on" any team roster, so it's
    // always eligible here -- originalTeam/originalRegion normalize its
    // own school/region fields to the same display shape a team-roster
    // runner gets above, so individualsTableHtml() (mockregionals.mjs)
    // can render both kinds identically without caring which one it is.
    pool.push({ ...individual, originalTeam: individual.school ?? individual.originalTeam ?? null, originalRegion: individual.region ?? individual.originalRegion ?? null });
  }
  pool.sort((a, b) => a.placePoints - b.placePoints);

  if (pool.length <= individualQualifierCount) return pool;

  const cutoffPoints = pool[individualQualifierCount - 1].placePoints;
  return pool.filter((runner, index) => index < individualQualifierCount || runner.placePoints === cutoffPoints);
}

const KNOWN_REGIONS = new Set(["Central", "Northeast", "Northwest", "Southwest"]);

function normalizeIdentityText(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

// The fallback identity used when no Athletic.net ID is available:
// normalized name + normalized school + graduation year. Deliberately
// omits gender -- this validator is already called once per division,
// which is already gender-scoped, so every entry being compared shares
// the same gender by construction.  Mirrors the shape (not the exact
// key) of athleteIdentityKey() in lib/athlete_foundation_service.mjs.
function fallbackAthleteKey(name, school, graduationYear) {
  return `${normalizeIdentityText(name)}|${normalizeIdentityText(school)}|${graduationYear || "unknown"}`;
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
//
// Checks, in order: (1) a team stored in more than one region, (2) a
// team's own region field disagreeing with the region bucket it's stored
// under, (3) missing/unrecognized region on a team or individual, (4) a
// team/individual's own optional gender/division fields (if present)
// disagreeing with the divisionEntry they're stored under, (5) duplicate
// Athletic.net ID across every team runner AND every supplemental
// individual combined, (6) duplicate fallback identity (name+school+
// graduation year) when no Athletic.net ID is present, on the same
// combined set, (7) missing or invalid timeCentiseconds/seasonBest, and
// (8) a supplemental individual whose school already has a team roster
// in this division -- the real rule (see selectIndividualQualifiers'
// header comment and mock-regionals-2026.json's own notes) is that a
// runner from a top-75 team's school is never a standalone individual,
// whether or not they're one of that team's own listed seven.
export function validateDivisionRoster(divisionEntry, regionEntries) {
  const problems = [];
  const divisionLabel = divisionEntry.label;
  const seenTeams = new Map();
  const seenTeamNames = new Set();
  const seenAthleteNetIds = new Map();
  const seenFallbackKeys = new Map();

  function checkAthlete({ name, school, graduationYear, athleticNetId, timeCentiseconds, seasonBest }, label, regionKey) {
    if (athleticNetId) {
      const key = normalizeIdentityText(athleticNetId);
      if (seenAthleteNetIds.has(key)) {
        const prior = seenAthleteNetIds.get(key);
        problems.push(`${divisionLabel}: Athletic.net ID "${athleticNetId}" ("${name}") appears on both ${prior.label} (${prior.regionKey}) and ${label} (${regionKey}).`);
      } else {
        seenAthleteNetIds.set(key, { label, regionKey });
      }
    } else {
      const fallback = fallbackAthleteKey(name, school, graduationYear);
      if (seenFallbackKeys.has(fallback)) {
        const prior = seenFallbackKeys.get(fallback);
        problems.push(`${divisionLabel}: "${name}" (no Athletic.net ID -- matched by name, school, and graduation year) appears on both ${prior.label} (${prior.regionKey}) and ${label} (${regionKey}).`);
      } else {
        seenFallbackKeys.set(fallback, { label, regionKey });
      }
    }

    if (timeCentiseconds == null || !Number.isFinite(timeCentiseconds) || timeCentiseconds <= 0) {
      problems.push(`${divisionLabel}: "${name}" (${label}) has a missing or invalid timeCentiseconds value.`);
    }
    if (!seasonBest || !String(seasonBest).trim()) {
      problems.push(`${divisionLabel}: "${name}" (${label}) is missing a seasonBest display time.`);
    }
  }

  function checkGenderDivision(entry, entityLabel, regionKey) {
    if (entry.gender && entry.gender !== divisionEntry.gender) {
      problems.push(`${divisionLabel}: ${entityLabel} has gender "${entry.gender}" but is stored in the ${divisionEntry.gender} division (${regionKey}).`);
    }
    if (entry.division != null && Number(entry.division) !== divisionEntry.division) {
      problems.push(`${divisionLabel}: ${entityLabel} has division ${entry.division} but is stored in Division ${divisionEntry.division} (${regionKey}).`);
    }
  }

  for (const [regionKey, region] of regionEntries) {
    for (const team of region.teams) {
      const teamKey = normalizeIdentityText(team.name);
      if (seenTeams.has(teamKey)) {
        problems.push(`${divisionLabel}: "${team.name}" appears in both ${seenTeams.get(teamKey)} and ${regionKey} -- a team can only be in one region.`);
      } else {
        seenTeams.set(teamKey, regionKey);
      }
      seenTeamNames.add(teamKey);

      if (team.region && team.region !== region.region) {
        problems.push(`${divisionLabel}: "${team.name}" is stored under ${regionKey} (${region.region}) but its own region field says "${team.region}".`);
      }
      if (!team.region || !KNOWN_REGIONS.has(team.region)) {
        problems.push(`${divisionLabel}: "${team.name}" has a missing or unrecognized region assignment.`);
      }
      checkGenderDivision(team, `"${team.name}"`, regionKey);

      for (const runner of team.runners) {
        checkAthlete(
          { name: runner.name, school: team.name, graduationYear: runner.graduationYear, athleticNetId: runner.athleticNetId, timeCentiseconds: runner.timeCentiseconds, seasonBest: runner.seasonBest },
          team.name,
          regionKey
        );
      }
    }
  }

  for (const [regionKey, region] of regionEntries) {
    for (const individual of region.individuals || []) {
      const label = `individual entry`;
      checkAthlete(
        { name: individual.name, school: individual.school, graduationYear: individual.graduationYear, athleticNetId: individual.athleticNetId, timeCentiseconds: individual.timeCentiseconds, seasonBest: individual.seasonBest },
        label,
        regionKey
      );

      if (individual.region && individual.region !== region.region) {
        problems.push(`${divisionLabel}: individual "${individual.name}" is stored under ${regionKey} (${region.region}) but its own region field says "${individual.region}".`);
      }
      if (!individual.region || !KNOWN_REGIONS.has(individual.region)) {
        problems.push(`${divisionLabel}: individual "${individual.name}" has a missing or unrecognized region assignment.`);
      }
      checkGenderDivision(individual, `individual "${individual.name}"`, regionKey);

      if (individual.school && seenTeamNames.has(normalizeIdentityText(individual.school))) {
        problems.push(`${divisionLabel}: individual "${individual.name}" is listed as a standalone entrant from "${individual.school}", but that school already has a top-75 team roster in this division -- it must be excluded, not added as a supplemental individual.`);
      }
    }
  }

  return problems;
}
