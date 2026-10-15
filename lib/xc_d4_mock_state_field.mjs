import { computeStatePool, scoreTeams } from "../src/lib/mock_scoring.mjs";

const REGION_ORDER = ["central", "northeast", "northwest", "southwest"];
const REGION_LABELS = { central: "Central", northeast: "Northeast", northwest: "Northwest", southwest: "Southwest" };

const TEAM_ALIASES = new Map([
  ["boys-d4|Central Christian (Kidron)", "Kid. Cent. Christian"]
]);

const ATHLETE_ALIASES = new Map([
  ["boys-d4|Con. Crestview|Andrew Heth", "Andy Heth"],
  ["boys-d4|Central Christian (Kidron)|Luke Nofziger", "Luke Nofzinger"],
  ["boys-d4|Lake Center Chr.|Zachary Varner", "Zach Varner"],
  ["girls-d4|Minster|cara Bornhorst", "Cara Bornhornst"],
  ["girls-d4|Mil. Edison|Juliana Johnson", "Julianna Johnson"]
]);

function normalizeIdentity(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function uniqueValues(rows, field) {
  return [...new Set(rows.map((row) => String(row[field] || "")).filter(Boolean))];
}

function sourceTeamFor(region, scoredTeam) {
  const matches = (region.teams || []).filter((team) => team.name === scoredTeam.name);
  if (matches.length !== 1) {
    throw new Error(`Expected one source team for ${scoredTeam.name}; found ${matches.length}.`);
  }
  return matches[0];
}

function resolveTeamRoster({
  divisionEntry,
  sourceTeam,
  regionalRank,
  workbookRows,
  eligibleAthleteIds,
  teamAliases,
  athleteAliases
}) {
  const teamAliasKey = `${divisionEntry.id}|${sourceTeam.name}`;
  const workbookTeamName = teamAliases.get(teamAliasKey) || sourceTeam.name;
  const teamRows = workbookRows.filter((row) => normalizeIdentity(row.team_name) === normalizeIdentity(workbookTeamName));
  const teamIds = uniqueValues(teamRows, "provider_team_id");
  const providerTeamId = teamIds.length === 1 ? teamIds[0] : null;
  const athletes = [];
  const issues = [];

  if (teamIds.length !== 1) {
    issues.push({
      type: teamIds.length ? "ambiguous_workbook_team_identity" : "missing_workbook_team_identity",
      team_name: sourceTeam.name,
      workbook_team_name: workbookTeamName,
      provider_team_ids: teamIds
    });
  }

  for (const [runnerIndex, runner] of sourceTeam.runners.entries()) {
    const athleteAliasKey = `${divisionEntry.id}|${sourceTeam.name}|${runner.name}`;
    const workbookAthleteName = athleteAliases.get(athleteAliasKey) || runner.name;
    const candidates = providerTeamId
      ? teamRows.filter((row) => (
        String(row.provider_team_id) === providerTeamId
        && normalizeIdentity(row.athlete_name) === normalizeIdentity(workbookAthleteName)
      ))
      : [];
    const athleteIds = uniqueValues(candidates, "provider_athlete_id");
    const providerAthleteId = athleteIds.length === 1 ? athleteIds[0] : null;
    const hasEligibleHistory = providerAthleteId ? eligibleAthleteIds.has(providerAthleteId) : false;
    let identityStatus;
    if (athleteIds.length > 1) identityStatus = "ambiguous_workbook_athlete_identity";
    else if (!providerAthleteId) identityStatus = "missing_workbook_athlete_identity";
    else if (!hasEligibleHistory) identityStatus = "no_eligible_pre_cutoff_5k_history";
    else identityStatus = athleteAliases.has(athleteAliasKey) ? "explicit_name_alias" : "exact_name_and_team";

    const athlete = {
      provider_athlete_id: providerAthleteId,
      provider_team_id: providerTeamId,
      athlete_name: runner.name,
      workbook_athlete_name: workbookAthleteName,
      team_name: sourceTeam.name,
      grade: Number.isFinite(Number(runner.grade)) ? Number(runner.grade) : null,
      graduation_year: Number.isFinite(Number(runner.graduationYear)) ? Number(runner.graduationYear) : null,
      official_entry: false,
      field_status: "website_mock_regional_roster",
      division_status: "ohio_d4_2026",
      region: sourceTeam.region,
      ohsaa_school_id: String(sourceTeam.ohsaaSchoolId),
      website_regional_rank: regionalRank,
      website_roster_position: runnerIndex + 1,
      website_season_best: runner.seasonBest,
      identity_status: identityStatus,
      eligible_for_simulation: hasEligibleHistory,
      identity_support: hasEligibleHistory
        ? `Athletic.net athlete ID has an eligible pre-cutoff 5K history within workbook team ${workbookTeamName}.`
        : "Excluded from the simulation because an eligible pre-cutoff workbook 5K history is unavailable."
    };
    athletes.push(athlete);
    if (!hasEligibleHistory) {
      issues.push({
        type: identityStatus,
        team_name: sourceTeam.name,
        athlete_name: runner.name,
        workbook_team_name: workbookTeamName,
        requested_workbook_athlete_name: workbookAthleteName,
        provider_athlete_ids: athleteIds
      });
    }
  }

  return {
    sourceTeam,
    providerTeamId,
    workbookTeamName,
    regionalRank,
    athletes,
    eligibleAthletes: athletes.filter((athlete) => athlete.eligible_for_simulation),
    issues
  };
}

function resolveIndividualCandidate({
  divisionEntry,
  candidate,
  workbookRows,
  eligibleAthleteIds,
  teamAliases,
  athleteAliases
}) {
  const schoolName = candidate.originalTeam || candidate.school;
  const teamAliasKey = `${divisionEntry.id}|${schoolName}`;
  const workbookTeamName = teamAliases.get(teamAliasKey) || schoolName;
  const teamRows = workbookRows.filter((row) => normalizeIdentity(row.team_name) === normalizeIdentity(workbookTeamName));
  const teamIds = uniqueValues(teamRows, "provider_team_id");
  const sourceProviderTeamId = teamIds.length === 1 ? teamIds[0] : null;
  const athleteAliasKey = `${divisionEntry.id}|${schoolName}|${candidate.name}`;
  const workbookAthleteName = athleteAliases.get(athleteAliasKey) || candidate.name;
  const suppliedAthleteId = candidate.athleticNetId ? String(candidate.athleticNetId) : null;
  const candidates = teamRows.filter((row) => (
    suppliedAthleteId
      ? String(row.provider_athlete_id) === suppliedAthleteId
      : normalizeIdentity(row.athlete_name) === normalizeIdentity(workbookAthleteName)
  ));
  const athleteIds = uniqueValues(candidates, "provider_athlete_id");
  const providerAthleteId = athleteIds.length === 1 ? athleteIds[0] : null;
  const hasEligibleHistory = providerAthleteId ? eligibleAthleteIds.has(providerAthleteId) : false;
  let identityStatus;
  if (teamIds.length > 1) identityStatus = "ambiguous_workbook_team_identity";
  else if (!sourceProviderTeamId) identityStatus = "missing_workbook_team_identity";
  else if (athleteIds.length > 1) identityStatus = "ambiguous_workbook_athlete_identity";
  else if (!providerAthleteId) identityStatus = "missing_workbook_athlete_identity";
  else if (!hasEligibleHistory) identityStatus = "no_eligible_pre_cutoff_5k_history";
  else if (athleteAliases.has(athleteAliasKey)) identityStatus = "explicit_name_alias";
  else identityStatus = suppliedAthleteId ? "stable_provider_athlete_id" : "exact_name_and_team";

  return {
    athlete: {
      provider_athlete_id: providerAthleteId,
      provider_team_id: null,
      source_provider_team_id: sourceProviderTeamId,
      athlete_name: candidate.name,
      workbook_athlete_name: workbookAthleteName,
      team_name: schoolName,
      workbook_team_name: workbookTeamName,
      grade: Number.isFinite(Number(candidate.grade)) ? Number(candidate.grade) : null,
      graduation_year: Number.isFinite(Number(candidate.graduationYear)) ? Number(candidate.graduationYear) : null,
      official_entry: false,
      field_status: "website_mock_individual_qualifier",
      division_status: "ohio_d4_2026",
      region: candidate.originalRegion || candidate.region,
      ohsaa_school_id: candidate.ohsaaSchoolId ? String(candidate.ohsaaSchoolId) : null,
      website_regional_place: candidate.placePoints,
      website_season_best: candidate.seasonBest,
      identity_status: identityStatus,
      eligible_for_simulation: hasEligibleHistory,
      identity_support: hasEligibleHistory
        ? `Athletic.net athlete ID has an eligible pre-cutoff 5K history within workbook team ${workbookTeamName}.`
        : "Excluded from the simulation because an eligible pre-cutoff workbook 5K history is unavailable."
    },
    issue: hasEligibleHistory ? null : {
      type: identityStatus,
      team_name: schoolName,
      athlete_name: candidate.name,
      workbook_team_name: workbookTeamName,
      requested_workbook_athlete_name: workbookAthleteName,
      provider_athlete_ids: athleteIds
    }
  };
}

export function buildMockStateRosterField(divisionEntry, workbookRows, options = {}) {
  if (!divisionEntry?.id || Number(divisionEntry.division) !== 4) {
    throw new Error("A Division IV mock-state division entry is required.");
  }
  const minimumEligibleAthletes = Number(options.minimumEligibleAthletes ?? 5);
  if (!Number.isInteger(minimumEligibleAthletes) || minimumEligibleAthletes < 5) {
    throw new Error("The minimum eligible team size must be an integer of at least five.");
  }
  const expectedGender = divisionEntry.gender === "girls" ? "Girls" : "Boys";
  const rows = (workbookRows || []).filter((row) => row.gender === expectedGender);
  const eligibleAthleteIds = options.eligibleAthleteIds
    ? new Set([...options.eligibleAthleteIds].map(String))
    : new Set(uniqueValues(rows, "provider_athlete_id"));
  const teamAliases = new Map([...TEAM_ALIASES, ...Object.entries(options.teamAliases || {})]);
  const athleteAliases = new Map([...ATHLETE_ALIASES, ...Object.entries(options.athleteAliases || {})]);
  const originalStatePool = computeStatePool(divisionEntry);
  const originalStateTeamMap = new Map(originalStatePool.teams.map((team) => [`${team.region}|${team.name}`, team.mockRank]));
  const accepted = [];
  const rejectedTeams = [];
  const regionalContexts = [];

  for (const regionKey of REGION_ORDER.filter((key) => divisionEntry.regions?.[key])) {
    const region = divisionEntry.regions[regionKey];
    const { teams: regionalTeams, individuals: regionalIndividuals } = scoreTeams(region.teams || [], region.individuals || []);
    const candidates = regionalTeams.filter((team) => team.complete);
    let acceptedCount = 0;
    for (const scoredTeam of candidates) {
      if (acceptedCount >= Number(region.stateQualifiers)) break;
      const sourceTeam = sourceTeamFor(region, scoredTeam);
      const resolution = resolveTeamRoster({
        divisionEntry,
        sourceTeam,
        regionalRank: scoredTeam.mockRank,
        workbookRows: rows,
        eligibleAthleteIds,
        teamAliases,
        athleteAliases
      });
      if (resolution.eligibleAthletes.length < minimumEligibleAthletes) {
        rejectedTeams.push({
          team_name: sourceTeam.name,
          region: sourceTeam.region,
          website_regional_rank: scoredTeam.mockRank,
          required_eligible_athletes: minimumEligibleAthletes,
          eligible_athletes: resolution.eligibleAthletes.length,
          listed_roster_athletes: sourceTeam.runners.length,
          reason: "fewer_than_five_eligible_pre_cutoff_workbook_histories",
          issues: resolution.issues
        });
        continue;
      }
      accepted.push(resolution);
      acceptedCount += 1;
    }
    if (acceptedCount !== Number(region.stateQualifiers)) {
      throw new Error(`Could not fill ${region.stateQualifiers} eligible ${regionKey} advancement slots for ${divisionEntry.id}; filled ${acceptedCount}.`);
    }
    regionalContexts.push({ regionKey, region, regionalTeams, regionalIndividuals });
  }

  const expectedTeamCount = REGION_ORDER.reduce((total, key) => (
    total + Number(divisionEntry.regions?.[key]?.stateQualifiers || 0)
  ), 0);
  if (accepted.length !== expectedTeamCount || accepted.length !== 24) {
    throw new Error(`Expected exactly 24 eligible mock-state teams for ${divisionEntry.id}; found ${accepted.length}.`);
  }

  const rescoredState = scoreTeams(accepted.map((resolution) => ({
    ...resolution.sourceTeam,
    runners: resolution.sourceTeam.runners
  })), []);
  const rescoredRank = new Map(rescoredState.teams.map((team) => [team.name, team.mockRank]));
  const field = [];
  const teams = [];
  const issues = [];

  for (const resolution of accepted) {
    const originalRank = originalStateTeamMap.get(`${resolution.sourceTeam.region}|${resolution.sourceTeam.name}`) || null;
    const teamRecord = {
      provider_team_id: resolution.providerTeamId,
      team_name: resolution.sourceTeam.name,
      workbook_team_name: resolution.workbookTeamName,
      ohsaa_school_id: String(resolution.sourceTeam.ohsaaSchoolId),
      region: resolution.sourceTeam.region,
      website_regional_rank: resolution.regionalRank,
      original_website_state_mock_rank: originalRank,
      evidence_eligible_state_mock_rank: rescoredRank.get(resolution.sourceTeam.name),
      selection_status: originalRank === null ? "replacement_after_history_gate" : "retained_original_state_team",
      listed_roster_size: resolution.sourceTeam.runners.length,
      eligible_roster_size: resolution.eligibleAthletes.length,
      excluded_roster_size: resolution.sourceTeam.runners.length - resolution.eligibleAthletes.length
    };
    teams.push(teamRecord);
    issues.push(...resolution.issues);
    for (const athlete of resolution.eligibleAthletes) {
      field.push({
        ...athlete,
        original_website_state_mock_rank: originalRank,
        evidence_eligible_state_mock_rank: teamRecord.evidence_eligible_state_mock_rank,
        team_selection_status: teamRecord.selection_status
      });
    }
  }

  const athleteIds = field.map((row) => row.provider_athlete_id);
  if (athleteIds.some((id) => !id) || new Set(athleteIds).size !== athleteIds.length) {
    throw new Error(`The ${divisionEntry.id} eligible mock-state field contains a missing or repeated athlete identity.`);
  }
  if (teams.some((team) => team.eligible_roster_size < minimumEligibleAthletes)) {
    throw new Error(`The ${divisionEntry.id} field contains a team below the five-athlete minimum.`);
  }

  const teamAthleteIds = new Set(athleteIds);
  const individuals = [];
  const rejectedIndividuals = [];
  for (const context of regionalContexts) {
    const regionLabel = REGION_LABELS[context.regionKey];
    const acceptedTeamNames = new Set(accepted
      .filter((resolution) => resolution.sourceTeam.region === regionLabel)
      .map((resolution) => resolution.sourceTeam.name));
    const candidatePool = [];
    for (const team of context.regionalTeams) {
      if (acceptedTeamNames.has(team.name)) continue;
      for (const runner of team.runners) {
        candidatePool.push({
          ...runner,
          originalTeam: team.name,
          originalRegion: team.region || regionLabel
        });
      }
    }
    for (const runner of context.regionalIndividuals || []) {
      candidatePool.push({
        ...runner,
        originalTeam: runner.school || runner.originalTeam,
        originalRegion: runner.region || runner.originalRegion || regionLabel
      });
    }
    candidatePool.sort((left, right) => (
      left.placePoints - right.placePoints
      || String(left.name).localeCompare(String(right.name))
    ));

    const requiredIndividuals = Number(context.region.individualQualifiers || 0);
    for (const candidate of candidatePool) {
      if (individuals.filter((row) => row.region === regionLabel).length >= requiredIndividuals) break;
      const resolution = resolveIndividualCandidate({
        divisionEntry,
        candidate,
        workbookRows: rows,
        eligibleAthleteIds,
        teamAliases,
        athleteAliases
      });
      if (!resolution.athlete.eligible_for_simulation || teamAthleteIds.has(resolution.athlete.provider_athlete_id)) {
        rejectedIndividuals.push({
          ...resolution.issue,
          region: regionLabel,
          website_regional_place: candidate.placePoints,
          reason: teamAthleteIds.has(resolution.athlete.provider_athlete_id)
            ? "already_on_qualifying_team"
            : "no_eligible_pre_cutoff_workbook_history"
        });
        continue;
      }
      teamAthleteIds.add(resolution.athlete.provider_athlete_id);
      individuals.push(resolution.athlete);
    }
    const selectedForRegion = individuals.filter((row) => row.region === regionLabel).length;
    if (selectedForRegion !== requiredIndividuals) {
      throw new Error(`Could not fill ${requiredIndividuals} eligible ${context.regionKey} individual slots for ${divisionEntry.id}; filled ${selectedForRegion}.`);
    }
  }

  return {
    field,
    individuals,
    teams: teams.sort((left, right) => left.evidence_eligible_state_mock_rank - right.evidence_eligible_state_mock_rank),
    issues,
    rejectedTeams,
    rejectedIndividuals,
    diagnostics: {
      division_id: divisionEntry.id,
      gender: expectedGender,
      minimum_eligible_athletes_per_team: minimumEligibleAthletes,
      state_teams: teams.length,
      simulated_athletes: field.length,
      listed_roster_athletes: teams.reduce((sum, team) => sum + team.listed_roster_size, 0),
      exact_identity_matches: field.filter((row) => row.identity_status === "exact_name_and_team").length,
      explicit_alias_matches: field.filter((row) => row.identity_status === "explicit_name_alias").length,
      excluded_selected_roster_athletes: issues.filter((issue) => issue.athlete_name).length,
      rejected_regional_team_candidates: rejectedTeams.length,
      replacement_state_teams: teams.filter((team) => team.selection_status === "replacement_after_history_gate").length,
      individual_qualifiers: individuals.length,
      rejected_individual_candidates: rejectedIndividuals.length
    }
  };
}
