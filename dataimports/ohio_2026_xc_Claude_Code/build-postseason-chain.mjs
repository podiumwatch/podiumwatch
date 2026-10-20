// Steps 2-4 of the Mock Postseason brief: Districts -> Regionals -> State,
// chained from the real-roster candidate dataset. Local-only output;
// nothing wired into scripts/build.mjs or src/pages/*.
//
// Districts (D2-D4 only; D1 has no districts in 2026):
//   - Normal race: score with the existing engine, cut at teams_advance,
//     select individuals via selectIndividualQualifiers.
//   - Hilliard Darby's 5 ambiguous site/gender/division combos (Race 1 +
//     Race 2, can't tell which team is in which): shown as ONE combined
//     field, NO cut line, no qualifiers determined -- status "pending".
//     These teams are deliberately excluded from the Regional field below
//     rather than guessed into either race.
//   - GlenOak/Lorain County CC/Madison (Northeast, teams_advance null):
//     same treatment, status "pending", explicit "Qualifier numbers
//     pending" rather than a silent skip.
//   - 49 entered schools with no roster at all in our dataset are listed
//     per-race as "Entered, no projection data" -- never dropped from the
//     visible field, just not scoreable.
//
// Regionals: field = district-qualifying TEAMS (full 7-runner roster) +
// district individual qualifiers (scored as individuals only -- NEVER
// added to a team roster or team score) for D2-D4; the FULL resolved
// roster for D1 (no district stage). Cut line uses the existing, real
// per-region stateQualifiers/individualQualifiers counts already in
// src/data/mock-regionals-2026.json -- unchanged, per the brief.
//
// State: reuses computeStatePool() UNCHANGED by constructing a
// divisionEntry-shaped object from the Regionals output, so State is
// provably scored by the exact same code path as today's site.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const pkgDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(pkgDir, "../..");

const { scoreTeams, selectIndividualQualifiers, computeStatePool } = await import(pathToFileURL(path.join(root, "src/lib/mock_scoring.mjs")).href);

const candidate = JSON.parse(fs.readFileSync(path.join(pkgDir, "ohio_2026_xc_full_statewide_2026.json"), "utf8"));
const district = JSON.parse(fs.readFileSync(path.join(root, "dataimports/district_meets_2026.json"), "utf8"));
const existingRegionals = JSON.parse(fs.readFileSync(path.join(root, "src/data/mock-regionals-2026.json"), "utf8"));
const districtFieldReport = JSON.parse(fs.readFileSync(path.join(pkgDir, "district_field_report.json"), "utf8"));

const DIV_NUM = { D1: 1, D2: 2, D3: 3, D4: 4 };
// The real 4 regional sites (what mock-regionals-2026.json's "region" key
// actually means) vs. district_meets_2026.json's 6-value district-only
// grouping (Central/East/Southeast/Northeast/Northwest/Southwest, which
// funnels 3-to-1 into Pickerington). Confirmed against the existing
// data's own siteName fields: Pickerington=central, Boardman=northeast,
// Tiffin=northwest, Troy=southwest. Grouping by district region directly
// (instead of regional site) would wrongly split Central/East/Southeast
// into three separate regional fields instead of the one real regional
// (Pickerington) they all actually feed.
const REGIONAL_SITE_TO_KEY = {
  Pickerington: "central",
  Boardman: "northeast",
  Tiffin: "northwest",
  Troy: "southwest"
};
const REGION_LABEL = { central: "Central", northeast: "Northeast", northwest: "Northwest", southwest: "Southwest" };

// Northeast district sites still waiting on real OHSAA numbers.
const NE_PENDING_SITES = new Set(["GO", "LCCC", "MAD"]);
const NE_REGION_TOTALS = {
  "boys_d2": 38, "girls_d2": 37,
  "boys_d3": 26, "girls_d3": 32,
  "boys_d4": 21, "girls_d4": 22
};

function toScoringRunner(r) {
  return { name: r.name, seasonBest: r.seasonBest, timeCentiseconds: r.timeCentiseconds, grade: r.grade };
}

function raceKey(race) {
  return `${race.site}|${race.gender}|${race.division}|${race.race_label || ""}`;
}

// Team scoring must never be inflated by a runner who can't score for any
// team -- a pooled individual qualifier, or an incomplete team's own
// runners (fewer than 5 scorers). Real XC rule: a team's score is the sum
// of its own top-five runners' places AMONG SCORING TEAMS ONLY; a fast
// individual or incomplete-team runner finishing ahead of some of a
// team's own scorers must not push that team's score up. The combined
// field (every entrant together) is still the correct source for real
// overall finish order -- the Top-N combined display list, and selecting
// individual qualifiers by real overall place (selectIndividualQualifiers
// reads placePoints off exactly this combined field) -- so this computes
// BOTH: combined for display/qualifier-selection (unchanged), team-only
// for score/rank (new), then merges the second's
// score/sixthPlace/seventhPlace/mockRank onto the first's team rows.
// Mirrors the pattern already established, unmodified, in
// computeStatePool() (src/lib/mock_scoring.mjs): scoreTeams(pooledTeams, [])
// for team scoring vs. scoreTeams(pooledTeams, pooledIndividuals) for the
// full field -- the difference here is computeStatePool's pooledTeams
// already excludes incomplete teams by construction (only complete teams
// ever qualify to State), whereas Districts/Regionals must also strip
// incomplete teams out of the team-only pass by hand, since the live
// field here still has to show them.
function scoreField(teamsForScoring, individualsForScoring) {
  const combined = scoreTeams(teamsForScoring, individualsForScoring);
  const completeOnly = teamsForScoring.filter((t) => t.runners.length >= 5);
  const teamOnly = completeOnly.length ? scoreTeams(completeOnly, []) : { teams: [] };
  const teamOnlyByName = new Map(teamOnly.teams.map((t) => [t.name, t]));
  // mock_scoring.mjs's scoreTeams() returns a FIXED shape for each team
  // ({name, region, complete, score, sixthPlace, seventhPlace, runners})
  // -- it does not spread the input team object, so any extra field the
  // caller attached (provisional, qualifiedFromDistrict/Ordinal,
  // qualifiedFromRegional/Ordinal) is silently dropped. Found 2026-10-20
  // while wiring "Qualified from" onto team rows: the "Prov." tag has
  // never actually rendered for the same reason, since team.provisional
  // was always undefined after scoring. Re-attached here from the
  // original INPUT team (by name) rather than touching the shared engine.
  const inputByName = new Map(teamsForScoring.map((t) => [t.name, t]));
  const mergedTeams = combined.teams.map((t) => {
    const input = inputByName.get(t.name);
    const only = teamOnlyByName.get(t.name);
    const withOriginal = input
      ? { ...t, provisional: input.provisional, qualifiedFromDistrict: input.qualifiedFromDistrict, qualifiedFromDistrictOrdinal: input.qualifiedFromDistrictOrdinal, qualifiedFromRegional: input.qualifiedFromRegional, qualifiedFromRegionalOrdinal: input.qualifiedFromRegionalOrdinal }
      : t;
    if (!only) return withOriginal; // incomplete team -- no team-only score to merge; keep combined's (already null/not complete)
    // The roster dropdown (Round 3) shows each runner's OWN team-scoring
    // place ("points in this meet"), which must come from this team-only
    // field, not the combined field's runner-level placePoints (that's
    // real overall finish order, inflated by individuals/incomplete
    // teams -- exactly what A1 fixed for the team SCORE; runner-level
    // display needs the same fix). Matched by name since team-only and
    // combined share the identical runner set for any complete team.
    const onlyByName = new Map(only.runners.map((r) => [r.name, r]));
    const runners = withOriginal.runners.map((r) => ({ ...r, teamPlacePoints: onlyByName.get(r.name)?.placePoints ?? null }));
    return { ...withOriginal, runners, score: only.score, sixthPlace: only.sixthPlace, seventhPlace: only.seventhPlace, mockRank: only.mockRank };
  });
  const completeSorted = mergedTeams.filter((t) => t.complete).sort((a, b) => a.mockRank - b.mockRank);
  const incompleteTeams = mergedTeams.filter((t) => !t.complete);
  return { teams: [...completeSorted, ...incompleteTeams], individuals: combined.individuals };
}

// --- 49 "entered, no roster" schools, indexed by site for per-race display ---
const noRosterBySite = new Map();
for (const u of districtFieldReport.unmatchedEntries) {
  if (!noRosterBySite.has(u.site)) noRosterBySite.set(u.site, []);
  noRosterBySite.get(u.site).push(u.fullName || u.athleticNetName);
}
// 24 more found 2026-10-20 (NORTHEAST_QUALIFIERS_UPDATE.md): real schools
// in the 8 Northeast PDFs' entry lists with no matching team anywhere in
// our roster (any division), same "entered, no roster" treatment as the
// original 49 -- not a silent drop. (Boys D2 Madison's Glenville, also
// originally flagged this way, turned out to be a division mismatch,
// not a missing school -- already fixed by moving it from D3 to D2, so
// it is NOT in this list.)
const EXTRA_NO_ROSTER_BY_SITE = {
  GO: ["Theodore Roosevelt", "North (Akron)", "Acad. Urban Scholars", "St. Vincent St. Mary", "Sebring McKinley", "Southern Local"],
  LCCC: ["John Hay", "Maple Hts", "Cle. Central Cath", "Clearview", "East Tech"],
  MAD: ["Bedford", "Lakeside", "Max Hayes", "Harvey", "VASJ", "Warrensville", "Richmond Hts"]
};
for (const [site, names] of Object.entries(EXTRA_NO_ROSTER_BY_SITE)) {
  if (!noRosterBySite.has(site)) noRosterBySite.set(site, []);
  noRosterBySite.get(site).push(...names);
}

// --- build the team pool per (site, gender, divisionNumber, raceLabel) ---
// raceLabel is only meaningful for Hilliard Darby's 5 real two-session
// races (Boys D2/D3/D4, Girls D2/D4) -- apply-hd-race-split.mjs
// (2026-10-20, real athletic.net entry lists) sets `districtRaceLabel`
// ("Race 1"/"Race 2") on each HD team so this key can tell the two
// sessions' fields apart; every other team's districtRaceLabel is
// undefined, matching district.races' own null race_label there.
const teamsBySiteGenderDiv = new Map();
for (const cat of Object.values(candidate.categories)) {
  if (cat.division === "D1") continue;
  for (const team of cat.teams) {
    if (!team.districtSiteKey) continue;
    const key = `${team.districtSiteKey}|${cat.gender.toLowerCase()}|${DIV_NUM[cat.division]}|${team.districtRaceLabel || ""}`;
    if (!teamsBySiteGenderDiv.has(key)) teamsBySiteGenderDiv.set(key, []);
    teamsBySiteGenderDiv.get(key).push(team);
  }
}

const districtResults = []; // one entry per real race

for (const race of district.races) {
  const comboKey = `${race.site}|${race.gender}|${race.division}|${race.race_label || ""}`;

  const teams = teamsBySiteGenderDiv.get(comboKey) || [];
  const noRosterSchools = noRosterBySite.get(race.site) || [];
  const isNePending = NE_PENDING_SITES.has(race.site) && race.teams_advance == null;

  const teamsForScoring = teams.map((t) => ({ name: t.name, region: t.region, runners: t.runners.map(toScoringRunner), provisional: t.provisional }));
  const { teams: scored, individuals } = teams.length ? scoreField(teamsForScoring, []) : { teams: [], individuals: [] };
  const complete = scored.filter((t) => t.complete);

  let status, qualifyingTeams = [], qualifiers = [];
  if (isNePending) {
    status = "qualifier_numbers_pending";
  } else {
    status = "scored";
    qualifyingTeams = complete.slice(0, race.teams_advance);
    // Ordinal added (Round 4) for "Qualified from: Cedarville district,
    // 1st" -- same uniform wording teams already got via
    // qualifiedFromDistrictOrdinal above. selectIndividualQualifiers
    // already returns them in real qualifying order, so the array index
    // IS the ordinal.
    qualifiers = selectIndividualQualifiers(scored, individuals, race.teams_advance, race.individuals_advance || 0).map((q, i) => ({ ...q, districtQualifyOrdinal: i + 1 }));
  }

  districtResults.push({
    site: race.site, gender: race.gender, division: race.division, raceLabel: race.race_label,
    startTime: race.start_time, teamsAdvance: race.teams_advance, individualsAdvance: race.individuals_advance,
    status, fieldSize: teams.length, scoredTeams: scored, qualifyingTeams, qualifiers,
    enteredNoProjectionData: noRosterSchools
  });
}

// --- Regionals ---
const regionalResults = {}; // key: `${gender}_${division}_${regionKey}`
const underReviewByCategory = {}; // D1 schools with no confirmed regional assignment
for (const cat of Object.values(candidate.categories)) {
  const genderLower = cat.gender.toLowerCase();
  const divNum = DIV_NUM[cat.division];

  if (cat.division === "D1") {
    // No district stage -- full resolved roster per region. Group by the
    // REAL regional site (team.regional, e.g. "Pickerington"), not the
    // 6-value district bucket (team.region) -- Central/East/Southeast all
    // feed the same real regional.
    const byRegionKey = new Map();
    const d1NorthwestResolved = [];
    for (const team of cat.teams) {
      let regionalKey = REGIONAL_SITE_TO_KEY[team.regional];
      // RESTORED 2026-10-20: a prior round reverted this fold on the
      // belief that the user's 8 real Northeast-district PDFs
      // (ohsaa_source_pdfs/northeast/, dated 2026-10-20) conflicted with
      // it -- they don't. Those PDFs are the Northeast district
      // coordinator's own entry-tracking sheets (Northeast-district
      // schools only); D1SchoolsandSitesBoys.pdf / D1SchoolsandSitesGirls.pdf
      // (ohsaa_source_pdfs/) is OHSAA's actual statewide D1 site
      // ASSIGNMENT document and is the authority here. It lists every
      // Northwest-athletic-district D1 school (Anthony Wayne, Whitmer
      // boys; Whitmer girls) with "Regional Site: Youngstown (Boardman)"
      // -- Perrysburg is also assigned there but has no roster data in
      // this package at all (see perrysburgNoRosterByGender below). No
      // other Northwest-district D1 school (Findlay included) appears
      // anywhere in either document.
      if (regionalKey === "northwest") {
        regionalKey = "northeast";
        d1NorthwestResolved.push(team.name);
      }
      if (!regionalKey) continue;
      if (!byRegionKey.has(regionalKey)) byRegionKey.set(regionalKey, []);
      byRegionKey.get(regionalKey).push(team);
    }
    // Perrysburg: confirmed assigned to Boardman by the same OHSAA D1
    // site document (both boys and girls), but has no roster at all in
    // this package -- shown as "Entered, no projection data" rather than
    // silently dropped, same treatment as the 49 district-level gaps.
    // John Hay (girls only -- not on the boys D1 list at all) is the
    // same situation.
    const d1NoRosterByGender = { Boys: ["Perrysburg"], Girls: ["Perrysburg", "John Hay"] };
    for (const [regionalKey, teams] of byRegionKey) {
      const key = `${cat.gender.toLowerCase()}_${cat.division}_${regionalKey}`;
      const teamsForScoring = teams.map((t) => ({ name: t.name, region: REGION_LABEL[regionalKey], runners: t.runners.map(toScoringRunner), provisional: t.provisional }));
      const { teams: scored, individuals } = scoreField(teamsForScoring, []);
      const enteredNoProjectionData = regionalKey === "northeast" ? (d1NoRosterByGender[cat.gender] || []) : [];
      regionalResults[key] = { gender: cat.gender, division: cat.division, regionKey: regionalKey, teams: scored, individuals, enteredNoProjectionData, source: "full_roster_no_districts" };
    }
    if (d1NorthwestResolved.length) {
      console.log(`  [${cat.gender} D1] ${d1NorthwestResolved.length} Northwest-district school(s) resolved to Northeast/Boardman per OHSAA's real D1 site assignment document: ${d1NorthwestResolved.join(", ")}`);
    }
    continue;
  }

  // D2-D4: pool district-qualifying teams + district individual qualifiers,
  // grouped by the REAL regional site each district site feeds (via
  // district.regional_by_region), not the 6-value district bucket.
  const districtRacesForCategory = districtResults.filter((r) => r.gender === genderLower && r.division === divNum);
  const byRegionKey = new Map();
  for (const dr of districtRacesForCategory) {
    const site = district.sites.find((s) => s.key === dr.site);
    if (!site) continue;
    const regionalKey = REGIONAL_SITE_TO_KEY[site.regional];
    if (!byRegionKey.has(regionalKey)) byRegionKey.set(regionalKey, { teams: [], individuals: [], pendingSites: [] });
    if (dr.status !== "scored") {
      byRegionKey.get(regionalKey).pendingSites.push({ site: dr.site, status: dr.status });
      continue;
    }
    for (const t of dr.qualifyingTeams) {
      const original = teamsBySiteGenderDiv.get(`${dr.site}|${genderLower}|${divNum}|${dr.raceLabel || ""}`).find((x) => x.name === t.name);
      // "Qualified from: Cedarville district, 3rd" (Round 4) -- same
      // pattern as the individuals' qualifiedFromDistrict below, but for
      // the TEAM itself, using its own real district mockRank.
      byRegionKey.get(regionalKey).teams.push({ name: t.name, region: REGION_LABEL[regionalKey], runners: original.runners.map(toScoringRunner), provisional: original.provisional, qualifiedFromDistrict: site.name, qualifiedFromDistrictOrdinal: t.mockRank });
    }
    for (const q of dr.qualifiers) {
      byRegionKey.get(regionalKey).individuals.push({ name: q.name, seasonBest: q.seasonBest, timeCentiseconds: q.timeCentiseconds, grade: q.grade, originalTeam: q.originalTeam, originalRegion: REGION_LABEL[regionalKey], qualifiedFromDistrict: site.name, qualifiedFromDistrictOrdinal: q.districtQualifyOrdinal });
    }
  }
  for (const [regionalKey, pool] of byRegionKey) {
    const key = `${cat.gender.toLowerCase()}_${cat.division}_${regionalKey}`;
    const { teams: scored, individuals } = scoreField(pool.teams, pool.individuals);
    // Hilliard Darby's 5 real two-session races (Boys D2/D3/D4, Girls
    // D2/D4) were resolved 2026-10-20 via the real athletic.net entry
    // list (apply-hd-race-split.mjs) -- no district race ever reports
    // status "race_assignments_pending" anymore, so this is always false
    // now. Left in place (rather than deleted) in case a future site
    // ever needs the same "pending status blocks this regional" pattern.
    const hdPending = pool.pendingSites.some((p) => p.site === "HD" && p.status === "race_assignments_pending");
    regionalResults[key] = {
      gender: cat.gender, division: cat.division, regionKey: regionalKey,
      teams: scored, individuals, pendingSites: pool.pendingSites, source: "district_qualifiers",
      incomplete: hdPending,
      incompleteReason: hdPending ? "Hilliard Darby race assignments pending -- 104 Central-region teams excluded; who makes the regional cut here may change once resolved." : null
    };
  }
}

// --- District -> Regional statewide check: each D2-D4 gender/division should
// advance exactly 96 teams + 192 individuals once Northeast is filled in.
// This is a DISTRICT-level reconciliation (sum of every race's
// teams_advance/individuals_advance in that category), separate from the
// Regional -> State stateQualifiers numbers used below, which are already
// real/unchanged.
const districtStatewideCheck = {};
for (const categoryKey of Object.keys(NE_REGION_TOTALS)) {
  const [genderLower, divLower] = categoryKey.split("_");
  const divNum = DIV_NUM[divLower[0].toUpperCase() + divLower.slice(1)];
  const racesForCategory = district.races.filter((r) => r.gender === genderLower && r.division === divNum);
  const neRaces = racesForCategory.filter((r) => NE_PENDING_SITES.has(r.site));
  const nonNeRaces = racesForCategory.filter((r) => !NE_PENDING_SITES.has(r.site));
  const nonNeTeams = nonNeRaces.reduce((n, r) => n + (r.teams_advance || 0), 0);
  const nonNeIndividuals = nonNeRaces.reduce((n, r) => n + (r.individuals_advance || 0), 0);
  const neHasNulls = neRaces.some((r) => r.teams_advance == null);
  const neExpectedTeams = NE_REGION_TOTALS[categoryKey];
  const projectedTotalTeams = nonNeTeams + neExpectedTeams;
  // Bug found 2026-10-20 (NORTHEAST_QUALIFIERS_UPDATE.md): once
  // Northeast's real numbers are filled in, neHasNulls correctly goes
  // false, but this check used to compare nonNeTeams alone against 96 --
  // never actually ADDING Northeast's own (now real) teams_advance to
  // the total, so it reported a permanent false "MISMATCH" even when the
  // real statewide total was exactly right. Fixed to use the real NE
  // total once it's no longer pending.
  const neTeamsReal = neRaces.reduce((n, r) => n + (r.teams_advance || 0), 0);
  const realTotalTeams = nonNeTeams + neTeamsReal;
  districtStatewideCheck[categoryKey] = {
    nonNortheastTeamsAdvance: nonNeTeams,
    nonNortheastIndividualsAdvance: nonNeIndividuals,
    northeastStillPending: neHasNulls,
    northeastExpectedTeamsOnceFilled: neExpectedTeams,
    projectedStatewideTeamsOnceNEFilled: projectedTotalTeams,
    status: neHasNulls
      ? `blocked on NE -- ${nonNeTeams} non-NE teams advance now; once Northeast's real numbers are entered, expect ${projectedTotalTeams} (should be 96)`
      : (realTotalTeams === 96 ? `OK: 96 teams statewide (${nonNeTeams} non-NE + ${neTeamsReal} NE)` : `MISMATCH: ${realTotalTeams} teams (${nonNeTeams} non-NE + ${neTeamsReal} NE), expected 96`)
  };
}

// --- apply the EXISTING, real per-region stateQualifiers/individualQualifiers (unchanged) and compute State via computeStatePool unchanged ---
const stateResults = {};
for (const divEntry of existingRegionals.divisions) {
  const divKey = `${divEntry.gender}_D${divEntry.division}`;
  const newDivEntry = { ...divEntry, regions: {} };

  let stateIncomplete = false;
  let stateIncompleteReason = null;
  for (const [regionKeyLower, regionData] of Object.entries(divEntry.regions)) {
    const built = regionalResults[`${divEntry.gender.toLowerCase()}_D${divEntry.division}_${regionKeyLower}`];
    if (built) {
      // Attach the real, unchanged per-region State-qualifier counts so
      // the regional page can draw its own real cut line without a
      // second lookup against mock-regionals-2026.json at render time.
      built.stateQualifiers = regionData.stateQualifiers;
      built.individualQualifiers = regionData.individualQualifiers;
      built.siteName = regionData.siteName;
      if (built.incomplete) {
        stateIncomplete = true;
        stateIncompleteReason = built.incompleteReason;
      }
    }
    // "Qualified from: Troy regional, 1st" (Round 4) for TEAMS, same
    // idea as individuals below -- attach each qualifying team's own
    // regional site name + regional mockRank BEFORE computeStatePool
    // recomputes a fresh state-only rank, since that real-games rank
    // would otherwise be gone by the time state scoring runs.
    // MUST keep incomplete teams in this list (not filter them out):
    // computeStatePool's own scoreTeams() call re-derives every runner's
    // finish place from the full field passed in here. Dropping incomplete
    // teams removes their runners from that field, which shifts every
    // remaining runner's place/score and can flip the real regional
    // rank order (found in QA: Black River, regional rank 5, silently
    // lost its state slot to rank-6 Lake Center Chr. once incomplete
    // teams were excluded from this re-score).
    const teamsWithOrigin = built
      ? built.teams.map((t) => ({ ...t, qualifiedFromRegional: regionData.siteName, qualifiedFromRegionalOrdinal: t.mockRank }))
      : [];
    newDivEntry.regions[regionKeyLower] = {
      ...regionData,
      teams: teamsWithOrigin,
      individuals: built ? built.individuals : []
    };
  }

  // "Qualified from: Troy regional, 1st" (Round 3) needs each state
  // individual qualifier's REGION OF ORIGIN site name and their ordinal
  // rank among that region's own individual qualifiers. computeStatePool
  // (src/lib/mock_scoring.mjs, unmodified) doesn't expose that -- its own
  // selectIndividualQualifiers() call is reproduced here with the exact
  // same inputs per region (pure function, so this is deterministic and
  // matches internally) purely to recover that ordinal before pooling.
  const regionalQualifyOrder = new Map(); // `${name}|${originalTeam}` -> { ordinal, siteName }
  for (const [regionKeyLower, regionData] of Object.entries(newDivEntry.regions)) {
    if (!regionData.stateQualifiers) continue;
    const regionScored = scoreTeams(regionData.teams, regionData.individuals || []);
    const qualifying = selectIndividualQualifiers(regionScored.teams, regionScored.individuals, regionData.stateQualifiers, regionData.individualQualifiers || 0);
    qualifying.forEach((q, i) => {
      regionalQualifyOrder.set(`${q.name}|${q.originalTeam}`, { ordinal: i + 1, siteName: regionData.siteName });
    });
  }
  // Lookup for each team's real regional origin (site + ordinal) and
  // provisional flag, built from the per-region team lists just above --
  // computeStatePool's own scoreTeams() call drops these same unknown
  // fields (see scoreField's comment), so they must be re-merged after.
  const teamOriginByName = new Map();
  for (const regionData of Object.values(newDivEntry.regions)) {
    for (const t of regionData.teams) {
      teamOriginByName.set(t.name, { qualifiedFromRegional: t.qualifiedFromRegional, qualifiedFromRegionalOrdinal: t.qualifiedFromRegionalOrdinal, provisional: t.provisional });
    }
  }
  const statePool = computeStatePool(newDivEntry);
  // Found in QA 2026-10-20: computeStatePool (mock_scoring.mjs, unmodified)
  // picks each region's qualifying TEAMS by re-scoring region.teams WITH
  // individuals mixed into the finish order (mock_scoring.mjs line ~347),
  // but scoreField's own team-only "A1" pass above -- the basis for the
  // mockRank/score every team already shows on its regional page, and for
  // the qualifiedFromRegionalOrdinal on every team row -- deliberately
  // excludes individuals (and incomplete teams) from that same finish
  // order. When an individual's displacement shifts order near the state
  // cut line, computeStatePool can silently pool the WRONG team: boys D4
  // Northeast real rank 5 (Black River) lost its state slot to real rank
  // 6 (Lake Center Chr.) this way. Recompute each region's real top-N by
  // the authoritative mockRank and, if computeStatePool's own selection
  // disagrees, rebuild the team pool with the real N ourselves using the
  // same scoreTeams(pooledTeams, []) team-only step computeStatePool uses
  // for final team scoring (so the actual STATE SCORE computation is
  // unchanged) -- individuals' own separate qualifier-selection logic
  // above (regionalQualifyOrder) is untouched by this.
  const REGION_LABELS_STATE = { central: "Central", northeast: "Northeast", northwest: "Northwest", southwest: "Southwest" };
  const realRegionTeams = {};
  for (const [regionKeyLower, regionData] of Object.entries(newDivEntry.regions)) {
    if (!regionData.stateQualifiers) continue;
    realRegionTeams[regionKeyLower] = regionData.teams.filter((t) => t.complete).sort((a, b) => a.mockRank - b.mockRank).slice(0, regionData.stateQualifiers);
  }
  const realNames = new Set();
  for (const list of Object.values(realRegionTeams)) for (const t of list) realNames.add(t.name);
  const poolNames = new Set(statePool.teams.map((t) => t.name));
  const teamSelectionMismatched = realNames.size !== poolNames.size || [...realNames].some((n) => !poolNames.has(n));
  if (teamSelectionMismatched) {
    const correctedPooledTeams = [];
    for (const [regionKeyLower, list] of Object.entries(realRegionTeams)) {
      for (const team of list) {
        correctedPooledTeams.push({ name: team.name, region: REGION_LABELS_STATE[regionKeyLower], runners: team.runners.map(({ scoring, placePoints, teamPosition, ...rest }) => rest) });
      }
    }
    statePool.teams = scoreTeams(correctedPooledTeams, []).teams;
    console.log(`  [${divKey}] corrected state team selection (computeStatePool's own individuals-displaced re-score disagreed with the real team-only regional mockRank)`);
  }
  // Bug found in Round 3 review: computeStatePool's returned team.runners
  // objects still carry whatever `teamPlacePoints` scoreField() attached
  // at the REGIONAL stage (object spreads preserve unknown keys, and
  // scoreTeams/selectIndividualQualifiers both spread runners through
  // unchanged) -- so a roster dropdown showing the real STATE team score
  // (e.g. Mason "90 pts") was displaying each scorer's STALE regional
  // place (summing to 58), not their real state place. computeStatePool's
  // own internal team-only pass (the one that makes team.score correct
  // already) puts the REAL state-only place on each runner's own
  // `placePoints` -- this just copies that over `teamPlacePoints` so the
  // roster shows the same number the team's own displayed score was
  // summed from.
  const stateTeams = statePool.teams.map((t) => {
    const origin = teamOriginByName.get(t.name);
    return { ...t, ...origin, runners: t.runners.map((r) => ({ ...r, teamPlacePoints: r.placePoints })) };
  });
  const ordinalWord = (n) => (n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`);
  const enrichedIndividuals = statePool.individuals.map((ind) => {
    const origin = regionalQualifyOrder.get(`${ind.name}|${ind.originalTeam}`);
    return origin ? { ...ind, qualifiedFromRegional: origin.siteName, qualifiedFromRegionalOrdinal: ordinalWord(origin.ordinal) } : ind;
  });

  stateResults[divKey] = { ...statePool, teams: stateTeams, individuals: enrichedIndividuals, incomplete: stateIncomplete, incompleteReason: stateIncompleteReason };
}

console.log("=== Districts ===");
for (const dr of districtResults) {
  console.log(`[${dr.site}] ${dr.gender} D${dr.division} ${dr.raceLabel || ""}: field ${dr.fieldSize}, status ${dr.status}` + (dr.status === "scored" ? `, ${dr.qualifyingTeams.length} teams + ${dr.qualifiers.length} individuals advance` : "") + (dr.enteredNoProjectionData.length ? `, ${dr.enteredNoProjectionData.length} entered-no-data` : ""));
}

console.log("\n=== Regionals (team + individual counts) ===");
for (const [key, r] of Object.entries(regionalResults)) {
  const completeTeams = r.teams.filter((t) => t.complete).length;
  console.log(`${key}: ${completeTeams} scoring teams, ${r.individuals.length} individuals` + (r.pendingSites && r.pendingSites.length ? ` (PENDING: ${r.pendingSites.map((p) => p.site + "=" + p.status).join(", ")})` : ""));
}

console.log("\n=== Statewide 96+192 check (District -> Regional advancement) ===");
for (const [key, chk] of Object.entries(districtStatewideCheck)) {
  console.log(`${key}: ${chk.status}`);
}

fs.writeFileSync(path.join(pkgDir, "postseason_chain_output.json"), JSON.stringify({ districtResults, regionalResults, stateResults, districtStatewideCheck, underReviewByCategory }, null, 2));
console.log("\nWrote postseason_chain_output.json");
