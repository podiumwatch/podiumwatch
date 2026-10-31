// Districts -> Regionals -> State chained from REAL Oct 24, 2026 district
// results (dataimports/real_district_results_2026/real_district_results_2026_parsed.json),
// instead of src/lib/mock_scoring.mjs's season-best candidate dataset.
//
// D2-D4 only -- Division I has no district stage (real or mock) in 2026,
// so this universe simply has no D1 content; the page-data step falls
// back to the existing season-best D1 data in both toggle modes.
//
// Every number here (team scores, places, who advances) is recomputed
// from the real district finish times via the SAME scoring engine
// (src/lib/mock_scoring.mjs) the season-best "mock" universe uses --
// never hand-copied from the pasted district results' own reported
// scores, so ties/averaging/displacement are handled identically to the
// rest of the site. The real district race ALREADY determined who
// qualifies -- there is no separate "mock district" simulation step
// here, unlike build-postseason-chain.mjs.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const pkgDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(pkgDir, "../..");

const { scoreTeams, scoreRegionalField, selectIndividualQualifiers, computeStatePool } = await import(pathToFileURL(path.join(root, "src/lib/mock_scoring.mjs")).href);

const parsed = JSON.parse(fs.readFileSync(path.join(pkgDir, "real_district_results_2026_parsed.json"), "utf8"));
const district = JSON.parse(fs.readFileSync(path.join(root, "dataimports/district_meets_2026.json"), "utf8"));
const existingRegionals = JSON.parse(fs.readFileSync(path.join(root, "src/data/mock-regionals-2026.json"), "utf8"));

const REGIONAL_SITE_TO_KEY = { Pickerington: "central", Boardman: "northeast", Tiffin: "northwest", Troy: "southwest" };
const REGION_LABEL = { central: "Central", northeast: "Northeast", northwest: "Northwest", southwest: "Southwest" };
const SESSION_TO_RACE_LABEL = (session) => (session === 1 ? "Race 1" : `Race ${session}`);

function parseTimeToCentiseconds(timeStr) {
  const parts = timeStr.trim().split(":");
  let seconds = 0;
  for (const part of parts) seconds = seconds * 60 + Number.parseFloat(part);
  return Math.round(seconds * 100);
}

// Builds this race's team pool directly from the real individual results
// (every non-DNS/DNF finisher, grouped by the school name exactly as the
// real results reported it). scoreTeams() alone decides which of these
// are complete (>=5 runners) and therefore score -- no separate
// "scoring team" list is trusted from the pasted TEAM_SCORES block.
// Mirrors build-postseason-chain.mjs's scoreField(): a team's SCORE must
// never be inflated by a runner who can't score for any team -- an
// incomplete team's own runners (fewer than 5 finishers) still occupy
// real finish places in the combined field (correct, that's real overall
// order) but must be excluded from the pass that assigns each complete
// team's actual score/rank. Two passes: combined (every finisher
// together, for display/qualifier-selection) and team-only (complete
// teams only, for score/rank), then merge the second's score/sixthPlace/
// seventhPlace/mockRank onto the first's team rows. Missing this was a
// real bug found via verify-scores.mjs: every team's recomputed score
// came out higher than its real posted score, because incomplete
// schools' (e.g. "Zanesville") individual finishers were displacing
// scoring teams' runners in the SAME scoreTeams() call used for scoring.
function scoreField(teamsForScoring) {
  const combined = scoreTeams(teamsForScoring, []);
  const completeOnly = teamsForScoring.filter((t) => t.runners.length >= 5);
  const teamOnly = completeOnly.length ? scoreTeams(completeOnly, []) : { teams: [] };
  const teamOnlyByName = new Map(teamOnly.teams.map((t) => [t.name, t]));
  const mergedTeams = combined.teams.map((t) => {
    const only = teamOnlyByName.get(t.name);
    if (!only) return t;
    return { ...t, score: only.score, sixthPlace: only.sixthPlace, seventhPlace: only.seventhPlace, mockRank: only.mockRank };
  });
  const completeSorted = mergedTeams.filter((t) => t.complete).sort((a, b) => a.mockRank - b.mockRank);
  const incompleteTeams = mergedTeams.filter((t) => !t.complete);
  return { teams: [...completeSorted, ...incompleteTeams], individuals: combined.individuals };
}

function buildTeamsFromRace(race) {
  const bySchool = new Map();
  for (const row of race.individualResults) {
    if (!row.time || /^(DNS|DNF)$/i.test(row.time)) continue;
    if (!bySchool.has(row.school)) bySchool.set(row.school, []);
    bySchool.get(row.school).push({
      name: row.name,
      grade: row.grade || null,
      seasonBest: row.time,
      timeCentiseconds: parseTimeToCentiseconds(row.time)
    });
  }
  return [...bySchool.entries()].map(([name, runners]) => ({ name, runners }));
}

const districtRaceByKey = new Map();
for (const race of district.races) {
  if (race.division === 1) continue;
  const key = `${race.site}|${race.gender}|${race.division}|${race.race_label || ""}`;
  districtRaceByKey.set(key, race);
}

const districtResults = [];
for (const race of parsed.races) {
  const raceLabel = parsed.races.filter((r) => r.siteKey === race.siteKey && r.gender === race.gender && r.division === race.division).length > 1
    ? SESSION_TO_RACE_LABEL(race.session)
    : "";
  const key = `${race.siteKey}|${race.gender}|${race.division}|${raceLabel}`;
  const meta = districtRaceByKey.get(key);
  if (!meta) {
    console.warn(`No district_meets_2026.json race entry for ${key} -- skipping (teams_advance/individuals_advance unknown).`);
    continue;
  }

  const teamsForScoring = buildTeamsFromRace(race);
  const { teams: scored, individuals } = scoreField(teamsForScoring);
  const complete = scored.filter((t) => t.complete);
  const qualifyingTeams = complete.slice(0, meta.teams_advance);
  const qualifiers = selectIndividualQualifiers(scored, individuals, meta.teams_advance, meta.individuals_advance || 0)
    .map((q, i) => ({ ...q, districtQualifyOrdinal: i + 1 }));

  districtResults.push({
    site: race.siteKey, gender: race.gender, division: race.division, raceLabel,
    teamsAdvance: meta.teams_advance, individualsAdvance: meta.individuals_advance,
    fieldSize: teamsForScoring.length, scoredTeams: scored, qualifyingTeams, qualifiers
  });
}

// --- Regionals: pool each site's real district qualifiers by real regional site ---
const regionalResults = {};
for (const genderLower of ["boys", "girls"]) {
  for (const divNum of [2, 3, 4]) {
    const racesForCategory = districtResults.filter((r) => r.gender === genderLower && r.division === divNum);
    const byRegionKey = new Map();
    for (const dr of racesForCategory) {
      const site = district.sites.find((s) => s.key === dr.site);
      if (!site) continue;
      const regionalKey = REGIONAL_SITE_TO_KEY[site.regional];
      if (!byRegionKey.has(regionalKey)) byRegionKey.set(regionalKey, { teams: [], individuals: [] });
      for (const t of dr.qualifyingTeams) {
        byRegionKey.get(regionalKey).teams.push({
          name: t.name, region: REGION_LABEL[regionalKey],
          runners: t.runners.map(({ scoring, placePoints, teamPosition, ...rest }) => rest),
          qualifiedFromDistrict: site.name, qualifiedFromDistrictOrdinal: t.mockRank
        });
      }
      for (const q of dr.qualifiers) {
        byRegionKey.get(regionalKey).individuals.push({
          name: q.name, seasonBest: q.seasonBest, timeCentiseconds: q.timeCentiseconds, grade: q.grade,
          originalTeam: q.originalTeam, originalRegion: REGION_LABEL[regionalKey],
          qualifiedFromDistrict: site.name, qualifiedFromDistrictOrdinal: q.districtQualifyOrdinal
        });
      }
    }
    for (const [regionalKey, pool] of byRegionKey) {
      const key = `${genderLower}_${divNum}_${regionalKey}`;
      // scoreRegionalField (2026-10-31): team-only standings, combined finish order -- same rule as every page.
      const { teams: scored, individuals } = scoreRegionalField(pool.teams, pool.individuals);
      regionalResults[key] = { gender: genderLower, division: divNum, regionKey: regionalKey, teams: scored, individuals, source: "real_district_qualifiers" };
    }
  }
}

// --- State: reuse computeStatePool() unchanged, using the real per-region stateQualifiers/individualQualifiers (unchanged, real counts) ---
const stateResults = {};
for (const divEntry of existingRegionals.divisions) {
  if (divEntry.division === 1) continue; // no real district data for D1 -- this universe has no D1 content
  const divKey = `${divEntry.gender}_D${divEntry.division}`;
  const newDivEntry = { ...divEntry, regions: {} };

  for (const [regionKeyLower, regionData] of Object.entries(divEntry.regions)) {
    const built = regionalResults[`${divEntry.gender.toLowerCase()}_${divEntry.division}_${regionKeyLower}`];
    newDivEntry.regions[regionKeyLower] = {
      ...regionData,
      teams: built ? built.teams.map((t) => ({ ...t, qualifiedFromRegional: regionData.siteName, qualifiedFromRegionalOrdinal: t.mockRank })) : [],
      individuals: built ? built.individuals : []
    };
    if (built) {
      built.stateQualifiers = regionData.stateQualifiers;
      built.individualQualifiers = regionData.individualQualifiers;
      built.siteName = regionData.siteName;
    }
  }

  const regionalQualifyOrder = new Map();
  for (const [regionKeyLower, regionData] of Object.entries(newDivEntry.regions)) {
    if (!regionData.stateQualifiers) continue;
    const regionScored = scoreRegionalField(regionData.teams, regionData.individuals || []);
    const qualifying = selectIndividualQualifiers(regionScored.teams, regionScored.individuals, regionData.stateQualifiers, regionData.individualQualifiers || 0);
    qualifying.forEach((q, i) => regionalQualifyOrder.set(`${q.name}|${q.originalTeam}`, { ordinal: i + 1, siteName: regionData.siteName }));
    const built = regionalResults[`${divEntry.gender.toLowerCase()}_${divEntry.division}_${regionKeyLower}`];
    if (built) built.stateQualifyingIndividualKeys = qualifying.map((q) => `${q.name}|${q.originalTeam}`);
  }

  const teamOriginByName = new Map();
  for (const regionData of Object.values(newDivEntry.regions)) {
    for (const t of regionData.teams) teamOriginByName.set(t.name, { qualifiedFromRegional: t.qualifiedFromRegional, qualifiedFromRegionalOrdinal: t.qualifiedFromRegionalOrdinal });
  }

  const statePool = computeStatePool(newDivEntry);
  const ordinalWord = (n) => (n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`);
  const stateTeams = statePool.teams.map((t) => {
    const origin = teamOriginByName.get(t.name);
    return { ...t, ...origin, runners: t.runners.map((r) => ({ ...r, teamPlacePoints: r.placePoints })) };
  });
  const enrichedIndividuals = statePool.individuals.map((ind) => {
    const origin = regionalQualifyOrder.get(`${ind.name}|${ind.originalTeam}`);
    return origin ? { ...ind, qualifiedFromRegional: origin.siteName, qualifiedFromRegionalOrdinal: ordinalWord(origin.ordinal) } : ind;
  });

  stateResults[divKey] = { ...statePool, teams: stateTeams, individuals: enrichedIndividuals };
}

console.log("=== Districts (real results) ===");
for (const dr of districtResults) {
  console.log(`[${dr.site}] ${dr.gender} D${dr.division} ${dr.raceLabel || ""}: field ${dr.fieldSize}, ${dr.qualifyingTeams.length} teams + ${dr.qualifiers.length} individuals advance`);
}
console.log("\n=== Regionals (team + individual counts) ===");
for (const [key, r] of Object.entries(regionalResults)) {
  console.log(`${key}: ${r.teams.filter((t) => t.complete).length} scoring teams, ${r.individuals.length} individuals`);
}

fs.writeFileSync(path.join(pkgDir, "postseason_chain_output_real.json"), JSON.stringify({ districtResults, regionalResults, stateResults }, null, 2));
console.log("\nWrote postseason_chain_output_real.json");
