// Regional stage of the real-results Mock Postseason universe
// (/mock-postseason/real/), one level up from
// dataimports/real_district_results_2026/build-postseason-chain-real.mjs.
//
// Reads the real Oct 31, 2026 regional results
// (real_regional_results_2026_parsed.json, parsed verbatim from Zachary's
// workbook) plus the district-stage chain output, and writes
// postseason_chain_output_real_regionals.json with:
//
//   regionalResults          OFFICIAL. Every number comes from the workbook:
//                            team scores and places from the Team Scores
//                            tab, overall places from the finish order, who
//                            advances from the State Qualifier column. The
//                            only derived value is each scoring runner's
//                            team-scoring place (walk the finish order,
//                            count only runners from scored teams, up to 7
//                            per team), which verify-regional-results.mjs
//                            already proved reproduces every posted score.
//                            Nothing is re-scored by the engine and nobody's
//                            advancement is recomputed. Includes D1 (the
//                            district stage had no D1 content).
//   projectedRegionalResults What both universes projected before the race
//                            (pre_regional_projections_snapshot.json: the
//                            season-best projection and the district-fed
//                            projection as committed), so each regional card
//                            can show projection vs. actual.
//   stateResults             PROJECTED. The real State field (every runner
//                            marked Team or Individual) scored by the same
//                            engine rule the rest of the site uses: one
//                            team-only pass for team scores, one combined
//                            pass for the finish order; individual
//                            qualifiers run unattached and never take a
//                            point from a team runner. Time basis is each
//                            runner's regional time, from four different
//                            courses, not course-adjusted.
//   stateResultsByBasis      The same real State field scored on four time
//                            bases (Zachary, 2026-11-01): "district" (Oct
//                            24 district time only, exact name + school;
//                            D2-D4 only, D1 has no districts), "regional"
//                            (identical to stateResults), "bestDistrict
//                            Regional" (faster of the two) and "season"
//                            (fastest of the Podium Watch roster season
//                            best, the district time and the regional
//                            time). Only real marks are used. A runner
//                            with no time on a basis is listed in noTime
//                            and not scored -- never estimated.
//
// Run order: build-postseason-chain-real.mjs (districts) -> this ->
// build-postseason-page-data-real.mjs.
//
// Run: node dataimports/real_regional_results_2026/apply-real-regionals.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const pkgDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(pkgDir, "../..");
const { scoreTeams } = await import(pathToFileURL(path.join(root, "src/lib/mock_scoring.mjs")).href);

const parsed = JSON.parse(fs.readFileSync(path.join(pkgDir, "real_regional_results_2026_parsed.json"), "utf8"));
const districtChain = JSON.parse(fs.readFileSync(path.join(root, "dataimports/real_district_results_2026/postseason_chain_output_real.json"), "utf8"));
// What the site projected BEFORE the regionals (both universes, as
// committed), frozen so projection-vs-actual is never measured against a
// projection that was itself rebuilt after the regional PRs were applied.
const preRegionalSnapshot = JSON.parse(fs.readFileSync(path.join(pkgDir, "pre_regional_projections_snapshot.json"), "utf8"));
// For the alternate State time bases: the real Oct 24 district results
// and the Podium Watch season-best roster.
const districtParsed = JSON.parse(fs.readFileSync(path.join(root, "dataimports/real_district_results_2026/real_district_results_2026_parsed.json"), "utf8"));
const seasonRoster = JSON.parse(fs.readFileSync(path.join(root, "dataimports/ohio_2026_xc_Claude_Code/ohio_2026_xc_full_statewide_2026.json"), "utf8"));

const REGION_LABEL = { central: "Central", northeast: "Northeast", northwest: "Northwest", southwest: "Southwest" };
const REGION_ORDER = ["central", "northeast", "northwest", "southwest"];
const ordinalWord = (n) => (n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`);

const problems = [];
const fail = (message) => problems.push(message);

// --- Regionals: official ---
const regionalResults = {};
for (const race of parsed.races) {
  const key = `${race.gender}_${race.division}_${race.regionKey}`;
  const label = `${race.site} D${race.division} ${race.gender}`;
  const projected = districtChain.regionalResults[key] || null;
  const projectedTeamByName = new Map((projected?.teams || []).map((t) => [t.name, t]));
  const projectedIndByKey = new Map((projected?.individuals || []).map((q) => [`${q.name}|${q.originalTeam}`, q]));

  const scoring = new Map(race.teamScores.map((t) => [t.school, t]));
  const finishers = race.results.filter((r) => !r.dnf).sort((a, b) => a.place - b.place);

  // Team-scoring places: the walk that reproduces every posted score.
  const counted = new Map();
  const teamPlaceByRunner = new Map();
  let n = 0;
  for (const r of finishers) {
    if (!scoring.has(r.school)) continue;
    const c = counted.get(r.school) || 0;
    if (c >= 7) continue;
    counted.set(r.school, c + 1);
    n += 1;
    teamPlaceByRunner.set(`${r.name}|${r.school}|${r.place}`, n);
  }

  const runnerRow = (r) => ({
    name: r.name,
    grade: r.grade,
    seasonBest: r.time,
    timeCentiseconds: r.timeCentiseconds,
    athleticNetId: r.athleticNetId,
    placePoints: r.place,
    qualifierMark: r.stateQualifier
  });

  const teams = race.teamScores.map((t) => {
    const own = finishers.filter((r) => r.school === t.school);
    const runners = own.map((r, i) => ({
      ...runnerRow(r),
      teamPosition: i + 1,
      scoring: i < 5,
      teamPlacePoints: teamPlaceByRunner.get(`${r.name}|${r.school}|${r.place}`) ?? null
    }));
    const sum = runners.slice(0, 5).reduce((s, r) => s + (r.teamPlacePoints ?? 0), 0);
    if (runners.length < 5 || sum !== t.points) fail(`${label}: ${t.school} first-five team places sum to ${sum}, posted score is ${t.points}.`);
    const from = projectedTeamByName.get(t.school);
    return {
      name: t.school,
      region: race.region,
      complete: true,
      official: true,
      score: t.points,
      officialPlace: t.place,
      mockRank: t.place,
      advanced: t.advanced,
      sixthPlace: runners[5]?.teamPlacePoints ?? null,
      seventhPlace: runners[6]?.teamPlacePoints ?? null,
      qualifiedFromDistrict: from?.qualifiedFromDistrict ?? null,
      qualifiedFromDistrictOrdinal: from?.qualifiedFromDistrictOrdinal ?? null,
      runners
    };
  });

  // Everyone not on a scored team ran unattached (district individual
  // qualifiers, and schools that sent fewer than five). They are listed
  // as individuals with their real overall place.
  const individuals = finishers.filter((r) => !scoring.has(r.school)).map((r) => {
    const from = projectedIndByKey.get(`${r.name}|${r.school}`);
    return {
      ...runnerRow(r),
      originalTeam: r.school,
      originalRegion: race.region,
      stateQualifier: r.stateQualifier === "Individual",
      qualifiedFromDistrict: from?.qualifiedFromDistrict ?? null,
      qualifiedFromDistrictOrdinal: from?.qualifiedFromDistrictOrdinal ?? null
    };
  });

  // An individual State berth can go to a runner on a scored team that
  // did not advance (e.g. the 6th-place team) as well as to an unattached
  // runner, so this list is built from the whole finish order, not from
  // `individuals` alone.
  const individualQualifierRows = finishers.filter((r) => r.stateQualifier === "Individual").map((r) => {
    const from = projectedIndByKey.get(`${r.name}|${r.school}`);
    return { ...runnerRow(r), originalTeam: r.school, originalRegion: race.region, onScoredTeam: scoring.has(r.school), qualifiedFromDistrict: from?.qualifiedFromDistrict ?? null, qualifiedFromDistrictOrdinal: from?.qualifiedFromDistrictOrdinal ?? null };
  });
  const stateQualifyingIndividualKeys = individualQualifierRows.map((r) => `${r.name}|${r.originalTeam}`);
  const advancedTeams = teams.filter((t) => t.advanced);
  if (advancedTeams.length !== race.teamsToState) fail(`${label}: ${advancedTeams.length} advancing teams vs ${race.teamsToState} expected.`);
  if (stateQualifyingIndividualKeys.length !== race.individualsToState) fail(`${label}: ${stateQualifyingIndividualKeys.length} individual qualifiers vs ${race.individualsToState} expected.`);
  for (const r of finishers) {
    if (r.stateQualifier === "Team" && !advancedTeams.some((t) => t.name === r.school)) fail(`${label}: ${r.name} marked Team but ${r.school} did not advance.`);
  }

  const tieGroups = new Map();
  for (const t of race.teamScores) { if (!tieGroups.has(t.points)) tieGroups.set(t.points, []); tieGroups.get(t.points).push(t); }
  const teamTies = [...tieGroups.values()].filter((g) => g.length > 1).map((g) => ({
    points: g[0].points,
    teams: g.map((t) => ({ school: t.school, place: t.place, advanced: t.advanced })),
    note: "Tie broken by Athletic.net's official team places (sixth-runner tiebreak)."
  }));

  regionalResults[key] = {
    gender: race.gender,
    division: race.division,
    regionKey: race.regionKey,
    siteName: race.siteName,
    site: race.site,
    stateQualifiers: race.teamsToState,
    individualQualifiers: race.individualsToState,
    official: true,
    source: "athletic_net_official",
    sourceLabel: "Official Athletic.net results",
    meetId: race.meetId,
    raceId: race.raceId,
    asOf: parsed.asOf,
    asOfLabel: parsed.asOfLabel,
    finishers: finishers.length,
    teams,
    individuals,
    individualQualifierRows,
    stateQualifyingIndividualKeys,
    teamTies,
    dnf: race.results.filter((r) => r.dnf).map((r) => ({ name: r.name, school: r.school, grade: r.grade, athleticNetId: r.athleticNetId }))
  };
}

// Stable card order: D1..D4, boys then girls, Central/Northeast/Northwest/Southwest.
const orderedRegionalResults = {};
for (const division of [1, 2, 3, 4]) for (const gender of ["boys", "girls"]) for (const regionKey of REGION_ORDER) {
  const key = `${gender}_${division}_${regionKey}`;
  if (regionalResults[key]) orderedRegionalResults[key] = regionalResults[key];
}

// --- State time bases ---
function timeToCentiseconds(value) {
  const parts = String(value).trim().split(":");
  let seconds = 0;
  for (const part of parts) seconds = seconds * 60 + Number.parseFloat(part);
  return Number.isFinite(seconds) ? Math.round(seconds * 100) : null;
}
const districtTimeByKey = new Map();
for (const race of districtParsed.races) {
  for (const row of race.individualResults) {
    if (!row.time || /^(DNS|DNF|DQ)/i.test(row.time)) continue;
    const cs = timeToCentiseconds(row.time);
    if (cs == null) continue;
    districtTimeByKey.set(`${race.gender.toLowerCase()}|${row.school}|${row.name}`, { display: row.time, cs, site: race.siteKey });
  }
}
const seasonById = new Map();
const seasonByKey = new Map();
for (const [catKey, cat] of Object.entries(seasonRoster.categories)) {
  const g = String(cat.gender || catKey.split("_")[0]).toLowerCase();
  for (const team of cat.teams) {
    for (const r of team.runners) {
      if (!Number.isFinite(r.timeCentiseconds)) continue;
      const entry = { display: r.seasonBest, cs: r.timeCentiseconds };
      if (r.athleticNetId) seasonById.set(String(r.athleticNetId), entry);
      for (const id of r.mergedAthleticNetIds || []) seasonById.set(String(id), entry);
      seasonByKey.set(`${g}|${team.name}|${r.name}`, entry);
    }
  }
}
const STATE_BASES = {
  district: {
    label: "Use only district results",
    timeBasis: "Each runner's Oct 24, 2026 district time, matched by exact name and school. Different district courses, not course-adjusted.",
    noTimeReason: "no district time found under the same name and school"
  },
  regional: {
    label: "Use only regional results",
    timeBasis: "Each runner's Oct 31, 2026 regional time. Four different courses, not course-adjusted."
  },
  bestDistrictRegional: {
    label: "Use best from district and regional",
    timeBasis: "The faster of each runner's Oct 24 district time and Oct 31 regional time (regional time when no district time matches). Different courses, not course-adjusted."
  },
  season: {
    label: "Use best from the season",
    timeBasis: "Each runner's fastest known 2026 time: the Podium Watch season-best roster, the Oct 24 district time or the Oct 31 regional time, whichever is fastest. Different courses, not course-adjusted."
  }
};
// Returns { display, cs, source } or null for one runner on one basis.
function timeOnBasis(basis, gender, school, runner) {
  const regional = { display: runner.seasonBest, cs: runner.timeCentiseconds, source: "regional" };
  const dist = districtTimeByKey.get(`${gender}|${school}|${runner.name}`);
  const district = dist ? { display: dist.display, cs: dist.cs, source: "district" } : null;
  if (basis === "regional") return regional;
  if (basis === "district") return district;
  const candidates = [regional, district];
  if (basis === "season") {
    const sb = (runner.athleticNetId && seasonById.get(String(runner.athleticNetId))) || seasonByKey.get(`${gender}|${school}|${runner.name}`);
    if (sb) candidates.push({ display: sb.display, cs: sb.cs, source: "season best" });
  }
  return candidates.filter(Boolean).sort((a, b) => a.cs - b.cs)[0];
}

// One State entry from a pooled field: same two passes as
// computeStatePool() -- team scores from a team-only field, the shared
// finish order from the combined field.
function scoreStateField(pooledTeams, pooledIndividuals, poolLog, timeBasis) {
  const teamScored = scoreTeams(pooledTeams, []);
  const individualScored = scoreTeams(pooledTeams, pooledIndividuals);
  const stateTeamPlace = new Map(teamScored.teams.flatMap((t) => t.runners.map((r) => [`${t.name}|${r.name}`, r.placePoints])));
  const originByName = new Map(pooledTeams.map((t) => [t.name, { qualifiedFromRegional: t.qualifiedFromRegional, qualifiedFromRegionalOrdinal: t.qualifiedFromRegionalOrdinal, regionalScore: t.regionalScore }]));
  const teams = teamScored.teams.map((t) => ({ ...t, ...originByName.get(t.name), runners: t.runners.map((r) => ({ ...r, teamPlacePoints: r.placePoints })) }));
  const teamsForFullField = individualScored.teams.map((t) => ({ ...t, ...originByName.get(t.name), runners: t.runners.map((r) => ({ ...r, teamPlacePoints: stateTeamPlace.get(`${t.name}|${r.name}`) ?? null })) }));
  return { projected: true, timeBasis, teams, teamsForFullField, individuals: individualScored.individuals, poolLog, missing: [] };
}

// Re-times a pooled field on one basis. Runners with no time on that
// basis are removed and listed in noTime, never estimated; a team left
// with fewer than five timed runners stays in the field but is not
// scored (the engine marks it incomplete).
function retimeField(basis, gender, pooledTeams, pooledIndividuals) {
  const noTime = [];
  const sourceCounts = {};
  const retime = (runner, school, kind) => {
    const t = timeOnBasis(basis, gender, school, runner);
    if (!t) { noTime.push({ name: runner.name, school, kind, regionalTime: runner.seasonBest }); return null; }
    sourceCounts[t.source] = (sourceCounts[t.source] || 0) + 1;
    return { ...runner, seasonBest: t.display, timeCentiseconds: t.cs, timeSource: t.source, regionalTime: runner.seasonBest };
  };
  const teams = pooledTeams.map((team) => ({ ...team, runners: team.runners.map((r) => retime(r, team.name, "team")).filter(Boolean) }));
  const individuals = pooledIndividuals.map((q) => retime(q, q.originalTeam, "individual")).filter(Boolean);
  return { teams, individuals, noTime, sourceCounts };
}

// --- State: projected from the real qualifiers ---
const stateResults = {};
const stateResultsByBasis = { district: {}, regional: {}, bestDistrictRegional: {}, season: {} };
for (const division of [1, 2, 3, 4]) for (const gender of ["boys", "girls"]) {
  const divKey = `${gender}_D${division}`;
  const pooledTeams = [];
  const pooledIndividuals = [];
  const poolLog = [];
  for (const regionKey of REGION_ORDER) {
    const region = orderedRegionalResults[`${gender}_${division}_${regionKey}`];
    if (!region) continue;
    const advanced = region.teams.filter((t) => t.advanced);
    for (const t of advanced) {
      pooledTeams.push({
        name: t.name,
        region: REGION_LABEL[regionKey],
        qualifiedFromRegional: region.siteName,
        qualifiedFromRegionalOrdinal: t.officialPlace,
        regionalScore: t.score,
        runners: t.runners.map(({ scoring, placePoints, teamPosition, teamPlacePoints, ...rest }) => rest)
      });
    }
    const qualifiers = [...region.individualQualifierRows].sort((a, b) => a.placePoints - b.placePoints);
    qualifiers.forEach((q, i) => {
      const { placePoints, qualifierMark, onScoredTeam, ...rest } = q;
      pooledIndividuals.push({
        ...rest,
        regionalPlace: placePoints,
        qualifiedFromRegional: region.siteName,
        qualifiedFromRegionalOrdinal: ordinalWord(i + 1)
      });
    });
    poolLog.push({ region: REGION_LABEL[regionKey], teamCount: advanced.length, teamQualifiers: region.stateQualifiers, individualCount: qualifiers.length, individualQualifiers: region.individualQualifiers });
  }
  if (!pooledTeams.length) continue;

  stateResults[divKey] = scoreStateField(pooledTeams, pooledIndividuals, poolLog, STATE_BASES.regional.timeBasis);
  const { teams } = stateResults[divKey];
  const expectedTeams = division === 1 ? 20 : 24;
  const expectedInd = division === 1 ? 40 : 48;
  if (teams.length !== expectedTeams) fail(`State ${divKey}: ${teams.length} teams pooled, expected ${expectedTeams}.`);
  if (stateResults[divKey].individuals.length !== expectedInd) fail(`State ${divKey}: ${stateResults[divKey].individuals.length} individuals pooled, expected ${expectedInd}.`);

  // The same field on every basis.
  stateResultsByBasis.regional[divKey] = { ...stateResults[divKey], basis: "regional", noTime: [] };
  for (const basis of ["district", "bestDistrictRegional", "season"]) {
    if (basis === "district" && division === 1) {
      stateResultsByBasis.district[divKey] = { basis, unavailable: true, unavailableReason: "Division I has no district meet; D1 teams and individuals enter at regionals." };
      continue;
    }
    const field = retimeField(basis, gender, pooledTeams, pooledIndividuals);
    const entry = scoreStateField(field.teams, field.individuals, poolLog, STATE_BASES[basis].timeBasis);
    entry.basis = basis;
    entry.noTime = field.noTime;
    entry.noTimeReason = STATE_BASES[basis].noTimeReason || null;
    entry.timeSourceCounts = field.sourceCounts;
    entry.unscoredTeams = entry.teams.filter((t) => !t.complete).map((t) => ({ name: t.name, timedRunners: t.runners.length }));
    if (basis !== "district" && field.noTime.length) fail(`State ${divKey} ${basis}: ${field.noTime.length} runner(s) without a time, expected none.`);
    stateResultsByBasis[basis][divKey] = entry;
  }
}

if (problems.length) {
  console.error(`${problems.length} PROBLEM(S) -- nothing written:`);
  for (const p of problems) console.error(` - ${p}`);
  process.exit(1);
}

const output = {
  generatedAt: new Date().toISOString(),
  asOf: parsed.asOf,
  asOfLabel: parsed.asOfLabel,
  regionalDate: parsed.meetDate,
  stateDate: "2026-11-07",
  stateVenue: "Fortress Obetz",
  source: parsed.source,
  workbookNotes: parsed.workbookNotes,
  regionalResults: orderedRegionalResults,
  projectedRegionalResults: preRegionalSnapshot.regionals,
  projectedRegionalResultsNote: preRegionalSnapshot.snapshotOf,
  stateResults,
  stateBases: Object.fromEntries(Object.entries(STATE_BASES).map(([k, v]) => [k, { label: v.label, timeBasis: v.timeBasis }])),
  stateDefaultBasis: "regional",
  stateResultsByBasis
};
const outPath = path.join(pkgDir, "postseason_chain_output_real_regionals.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

console.log("=== Regionals (official) ===");
for (const [key, r] of Object.entries(orderedRegionalResults)) {
  const tie = r.teamTies.length ? ` -- tie at ${r.teamTies.map((t) => t.points).join(", ")}` : "";
  const dnf = r.dnf.length ? ` -- DNF: ${r.dnf.map((d) => d.name).join(", ")}` : "";
  console.log(`${key}: ${r.teams.length} scored teams, ${r.individuals.length} unattached, ${r.teams.filter((t) => t.advanced).length}/${r.stateQualifiers} teams + ${r.stateQualifyingIndividualKeys.length}/${r.individualQualifiers} individuals to State${tie}${dnf}`);
}
console.log("\n=== State (projected from real qualifiers) ===");
for (const [key, s] of Object.entries(stateResults)) {
  const top = s.teams.slice(0, 3).map((t) => `${t.name} ${t.score}`).join(", ");
  console.log(`${key}: ${s.teams.length} teams + ${s.individuals.length} individuals -- ${top}`);
}
console.log("\n=== State on each time basis ===");
for (const [basis, byDiv] of Object.entries(stateResultsByBasis)) {
  for (const [key, s] of Object.entries(byDiv)) {
    if (s.unavailable) { console.log(`[${basis}] ${key}: unavailable (${s.unavailableReason})`); continue; }
    const top = s.teams.filter((t) => t.complete).slice(0, 3).map((t) => `${t.name} ${t.score}`).join(", ");
    const extra = s.noTime.length ? ` -- ${s.noTime.length} without a time${s.unscoredTeams.length ? `, unscored: ${s.unscoredTeams.map((t) => `${t.name} (${t.timedRunners})`).join(", ")}` : ""}` : "";
    console.log(`[${basis}] ${key}: ${top}${extra}${s.timeSourceCounts ? ` | sources ${JSON.stringify(s.timeSourceCounts)}` : ""}`);
  }
}
console.log(`\nWrote ${outPath}`);
