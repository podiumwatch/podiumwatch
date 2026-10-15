const DAY_MS = 24 * 60 * 60 * 1000;

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function weightedMean(values, weights) {
  let weightedTotal = 0;
  let weightTotal = 0;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const weight = weights[index];
    if (!Number.isFinite(value) || !Number.isFinite(weight) || weight <= 0) continue;
    weightedTotal += value * weight;
    weightTotal += weight;
  }
  return weightTotal > 0 ? weightedTotal / weightTotal : null;
}

function robustScale(values, fallback = 15) {
  const center = median(values);
  if (center === null) return fallback;
  const mad = median(values.map((value) => Math.abs(value - center)));
  if (Number.isFinite(mad) && mad > 0) return Math.max(1, mad * 1.4826);
  const squared = values.map((value) => (value - center) ** 2);
  const rms = Math.sqrt((squared.reduce((sum, value) => sum + value, 0) / Math.max(1, squared.length)) || 0);
  return rms > 0 ? rms : fallback;
}

function robustWeightedMean(values, weights, fallbackScale = 20) {
  if (!values.length) return null;
  let center = median(values);
  let scale = robustScale(values, fallbackScale);
  for (let pass = 0; pass < 4; pass += 1) {
    const limit = Math.max(6, 2.5 * scale);
    const adjustedWeights = values.map((value, index) => {
      const distance = Math.abs(value - center);
      const huberWeight = distance <= limit ? 1 : limit / distance;
      return weights[index] * huberWeight;
    });
    center = weightedMean(values, adjustedWeights) ?? center;
    scale = robustScale(values.map((value) => value - center), scale);
  }
  return center;
}

function dateAgeDays(date, cutoff) {
  const parsedDate = Date.parse(`${date}T00:00:00Z`);
  const parsedCutoff = Date.parse(`${cutoff}T00:00:00Z`);
  if (!Number.isFinite(parsedDate) || !Number.isFinite(parsedCutoff)) return null;
  return Math.max(0, (parsedCutoff - parsedDate) / DAY_MS);
}

function recordKey(row) {
  return [row.provider_athlete_id, row.provider_meet_id, row.meet_date, row.distance_meters].join("|");
}

function meetKey(row) {
  return `${row.provider_meet_id}|${row.meet_date}`;
}

export function prepareSimulatorRecords(rows, options = {}) {
  const season = Number(options.season ?? 2026);
  const cutoff = String(options.cutoff || "2026-10-10");
  const gender = String(options.gender || "Boys");
  const targetMeetId = options.targetMeetId === null || options.targetMeetId === undefined
    ? null
    : String(options.targetMeetId);
  const exclusions = [];
  const eligible = [];

  for (const row of rows || []) {
    let reason = null;
    if (Number(row.season) !== season) reason = "wrong_season";
    else if (row.gender !== gender) reason = "wrong_gender";
    else if (Number(row.distance_meters) !== 5000) reason = "wrong_distance";
    else if (!row.meet_date) reason = "missing_date";
    else if (targetMeetId && String(row.provider_meet_id) === targetMeetId) reason = "target_meet_excluded";
    else if (row.meet_date >= cutoff) reason = "cutoff_excluded";
    else if (!row.provider_athlete_id) reason = "missing_athlete_id";
    else if (!row.provider_team_id) reason = "missing_team_id";
    else if (!row.provider_meet_id) reason = "missing_meet_id";
    else if (!Number.isFinite(Number(row.time_seconds)) || Number(row.time_seconds) <= 0) reason = "invalid_time";
    if (reason) exclusions.push({ reason, row });
    else eligible.push({ ...row, time_seconds: Number(row.time_seconds) });
  }

  const groups = new Map();
  for (const row of eligible) {
    const key = recordKey(row);
    const group = groups.get(key) || [];
    group.push(row);
    groups.set(key, group);
  }

  const records = [];
  const duplicateGroups = [];
  for (const [key, group] of groups) {
    const distinctTimes = [...new Set(group.map((row) => row.time_seconds.toFixed(3)))];
    if (distinctTimes.length > 1) {
      duplicateGroups.push({ key, status: "conflicting_times_excluded", rows: group });
      continue;
    }
    records.push(group[0]);
    if (group.length > 1) {
      const places = [...new Set(group.map((row) => row.place).filter((value) => value !== null))];
      duplicateGroups.push({
        key,
        status: places.length > 1 ? "same_time_conflicting_places_collapsed" : "exact_duplicate_collapsed",
        rows: group
      });
    }
  }

  records.sort((left, right) => (
    left.meet_date.localeCompare(right.meet_date)
    || String(left.provider_meet_id).localeCompare(String(right.provider_meet_id))
    || String(left.provider_athlete_id).localeCompare(String(right.provider_athlete_id))
  ));

  return { records, exclusions, duplicateGroups };
}

function groupBy(rows, keyBuilder) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyBuilder(row);
    const group = groups.get(key) || [];
    group.push(row);
    groups.set(key, group);
  }
  return groups;
}

function effectiveSampleSize(weights) {
  const sum = weights.reduce((total, value) => total + value, 0);
  const squared = weights.reduce((total, value) => total + value ** 2, 0);
  return squared > 0 ? (sum ** 2) / squared : 0;
}

export function fitCourseAdjustedModel(records, options = {}) {
  if (!records?.length) throw new Error("At least one eligible performance is required.");
  const cutoff = String(options.cutoff || "2026-10-10");
  const halfLifeDays = Number(options.halfLifeDays ?? 35);
  const meetPriorCount = Number(options.meetPriorCount ?? 20);
  const iterations = Number(options.fitIterations ?? 20);
  const bestPerformanceCount = Number(options.bestPerformanceCount ?? 4);
  if (!Number.isInteger(bestPerformanceCount) || bestPerformanceCount < 1) {
    throw new Error("Best performance count must be a positive integer.");
  }
  const athleteGroups = groupBy(records, (row) => String(row.provider_athlete_id));
  const meetGroups = groupBy(records, meetKey);
  const athleteAbility = new Map();
  const meetEffects = new Map([...meetGroups.keys()].map((key) => [key, 0]));

  const recencyWeight = (row) => {
    const age = dateAgeDays(row.meet_date, cutoff);
    return age === null ? 1 : Math.exp((-Math.log(2) * age) / Math.max(1, halfLifeDays));
  };

  for (const [athleteId, group] of athleteGroups) {
    athleteAbility.set(athleteId, robustWeightedMean(
      group.map((row) => row.time_seconds),
      group.map(recencyWeight)
    ));
  }

  // Keep robustification fixed during the alternating fit. Recomputing
  // Huber weights inside both the athlete and meet updates can make the
  // two parameter blocks oscillate. Fixed per-athlete weights preserve a
  // convex weighted least-squares problem while still limiting obvious
  // one-off marks far from an athlete's own season distribution.
  const qualityWeights = new Map();
  for (const group of athleteGroups.values()) {
    const values = group.map((row) => row.time_seconds);
    const center = median(values);
    const scale = Math.max(20, robustScale(values, 30));
    const limit = 3 * scale;
    for (const row of group) {
      const distance = Math.abs(row.time_seconds - center);
      qualityWeights.set(recordKey(row), distance <= limit ? 1 : limit / distance);
    }
  }

  let convergedAt = iterations;
  let converged = false;
  let finalMaximumChange = null;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let maximumChange = 0;
    for (const [key, group] of meetGroups) {
      const residuals = group.map((row) => row.time_seconds - athleteAbility.get(String(row.provider_athlete_id)));
      const weights = group.map((row) => qualityWeights.get(recordKey(row)) || 1);
      const rawEffect = weightedMean(residuals, weights) ?? 0;
      const effectiveCount = weights.reduce((sum, value) => sum + value, 0);
      const shrinkage = effectiveCount / (effectiveCount + meetPriorCount);
      const nextEffect = Math.max(-90, Math.min(90, rawEffect * shrinkage));
      maximumChange = Math.max(maximumChange, Math.abs(nextEffect - (meetEffects.get(key) || 0)));
      meetEffects.set(key, nextEffect);
    }

    for (const [athleteId, group] of athleteGroups) {
      const adjusted = group.map((row) => row.time_seconds - (meetEffects.get(meetKey(row)) || 0));
      const weights = group.map((row) => recencyWeight(row) * (qualityWeights.get(recordKey(row)) || 1));
      const nextAbility = weightedMean(adjusted, weights);
      maximumChange = Math.max(maximumChange, Math.abs(nextAbility - athleteAbility.get(athleteId)));
      athleteAbility.set(athleteId, nextAbility);
    }
    finalMaximumChange = maximumChange;
    if (maximumChange < 0.01) {
      convergedAt = iteration + 1;
      converged = true;
      break;
    }
  }

  // Estimate meet-day effects from the full connected history, then gauge
  // each athlete from only their best course-adjusted performances. This
  // keeps a workout or isolated off race from pulling the athlete estimate
  // down while retaining crossover evidence for meet comparison.
  const abilityGroups = new Map();
  const bestAthleteAbility = new Map();
  for (const [athleteId, group] of athleteGroups) {
    const selected = [...group].sort((left, right) => (
      (left.time_seconds - (meetEffects.get(meetKey(left)) || 0))
        - (right.time_seconds - (meetEffects.get(meetKey(right)) || 0))
      || right.meet_date.localeCompare(left.meet_date)
      || String(left.provider_meet_id).localeCompare(String(right.provider_meet_id))
    )).slice(0, bestPerformanceCount);
    abilityGroups.set(athleteId, selected);
    const adjusted = selected.map((row) => row.time_seconds - (meetEffects.get(meetKey(row)) || 0));
    const weights = selected.map((row) => recencyWeight(row) * (qualityWeights.get(recordKey(row)) || 1));
    bestAthleteAbility.set(athleteId, weightedMean(adjusted, weights));
  }

  const residualRows = [...abilityGroups].flatMap(([athleteId, group]) => group.map((row) => ({
    ...row,
    model_residual: row.time_seconds
      - bestAthleteAbility.get(athleteId)
      - (meetEffects.get(meetKey(row)) || 0)
  })));
  const teamMeetGroups = groupBy(residualRows, (row) => `${row.provider_team_id}|${meetKey(row)}`);
  const teamMeetEffects = new Map();
  for (const [key, group] of teamMeetGroups) {
    teamMeetEffects.set(key, group.length >= 3 ? median(group.map((row) => row.model_residual)) : 0);
  }
  const teamEffectValues = [...teamMeetGroups.entries()]
    .filter(([, group]) => group.length >= 3)
    .map(([key]) => teamMeetEffects.get(key));
  const teamDaySigma = Math.max(0, Math.min(25, robustScale(teamEffectValues, 0)));
  const individualResiduals = residualRows.map((row) => (
    row.model_residual - (teamMeetEffects.get(`${row.provider_team_id}|${meetKey(row)}`) || 0)
  ));
  const globalIndividualSigma = Math.max(8, Math.min(60, robustScale(individualResiduals, 18)));
  const residualByRecord = new Map(residualRows.map((row, index) => [recordKey(row), individualResiduals[index]]));

  const athleteModels = new Map();
  for (const [athleteId, group] of athleteGroups) {
    const abilityGroup = abilityGroups.get(athleteId);
    const weights = abilityGroup.map(recencyWeight);
    const nEff = effectiveSampleSize(weights);
    const residuals = abilityGroup.map((row) => residualByRecord.get(recordKey(row)) || 0);
    const sampleMean = residuals.reduce((sum, value) => sum + value, 0) / residuals.length;
    const sampleVariance = residuals.length > 1
      ? residuals.reduce((sum, value) => sum + (value - sampleMean) ** 2, 0) / (residuals.length - 1)
      : globalIndividualSigma ** 2;
    const priorDf = 4;
    const shrunkVariance = (((Math.max(0, residuals.length - 1)) * sampleVariance) + (priorDf * globalIndividualSigma ** 2))
      / (Math.max(0, residuals.length - 1) + priorDf);
    const raceSigma = Math.max(8, Math.min(70, Math.sqrt(shrunkVariance)));
    const abilitySe = Math.max(2, raceSigma / Math.sqrt(Math.max(0.75, nEff)));
    const latest = [...group].sort((left, right) => right.meet_date.localeCompare(left.meet_date))[0];
    athleteModels.set(athleteId, {
      provider_athlete_id: athleteId,
      athlete_name: latest.athlete_name,
      provider_team_id: latest.provider_team_id,
      team_name: latest.team_name,
      grade: latest.grade,
      history_count: group.length,
      distinct_meet_count: new Set(group.map(meetKey)).size,
      ability_performance_count: abilityGroup.length,
      discarded_performance_count: group.length - abilityGroup.length,
      ability_selection_rule: `best ${bestPerformanceCount} course-adjusted performances, or all available when fewer`,
      mean_seconds: bestAthleteAbility.get(athleteId),
      ability_standard_error_seconds: abilitySe,
      race_standard_deviation_seconds: raceSigma,
      predictive_standard_deviation_seconds: Math.sqrt(raceSigma ** 2 + abilitySe ** 2),
      latest_performance_date: latest.meet_date
    });
  }

  const gradePriors = new Map();
  const globalAbilities = [...athleteModels.values()].map((row) => row.mean_seconds);
  const globalPrior = {
    mean_seconds: median(globalAbilities),
    standard_deviation_seconds: Math.max(35, robustScale(globalAbilities, 75))
  };
  for (const grade of [9, 10, 11, 12]) {
    const values = [...athleteModels.values()].filter((row) => row.grade === grade).map((row) => row.mean_seconds);
    gradePriors.set(grade, values.length >= 20 ? {
      mean_seconds: median(values),
      standard_deviation_seconds: Math.max(30, robustScale(values, globalPrior.standard_deviation_seconds)),
      athlete_count: values.length
    } : { ...globalPrior, athlete_count: values.length });
  }

  const effectValues = [...meetEffects.values()];
  return {
    athleteModels,
    meetEffects,
    gradePriors,
    abilityRecordsByAthlete: abilityGroups,
    diagnostics: {
      performance_count: records.length,
      ability_performance_count: residualRows.length,
      best_performance_count_per_athlete: bestPerformanceCount,
      athlete_count: athleteModels.size,
      meet_count: meetEffects.size,
      fit_iterations: convergedAt,
      converged,
      final_maximum_parameter_change_seconds: finalMaximumChange,
      half_life_days: halfLifeDays,
      meet_prior_count: meetPriorCount,
      meet_effect_seconds: {
        minimum: Math.min(...effectValues),
        median: median(effectValues),
        maximum: Math.max(...effectValues)
      },
      global_individual_standard_deviation_seconds: globalIndividualSigma,
      team_day_standard_deviation_seconds: teamDaySigma,
      grade_priors: Object.fromEntries(gradePriors)
    }
  };
}

export function buildD4TargetField(entries) {
  return (entries || [])
    .filter((entry) => entry.official_entry === true && entry.division_status === "ohio_d4_2026")
    .map((entry) => ({
      provider_athlete_id: String(entry.provider_athlete_id),
      provider_team_id: String(entry.provider_team_id),
      athlete_name: entry.athlete_name,
      team_name: entry.school_identity?.canonical_school_name || entry.team_name,
      grade: finiteNumber(entry.grade),
      graduation_year: finiteNumber(entry.graduation_year),
      official_entry: true,
      division_status: "ohio_d4_2026"
    }))
    .sort((left, right) => (
      left.team_name.localeCompare(right.team_name)
      || left.athlete_name.localeCompare(right.athlete_name)
      || left.provider_athlete_id.localeCompare(right.provider_athlete_id)
    ));
}

export function attachFieldEstimates(field, fittedModel) {
  const globalPriorValues = [...fittedModel.gradePriors.values()];
  const globalMean = median(globalPriorValues.map((row) => row.mean_seconds));
  const globalSpread = median(globalPriorValues.map((row) => row.standard_deviation_seconds));
  return field.map((entry) => {
    const history = fittedModel.athleteModels.get(entry.provider_athlete_id);
    if (history) return {
      ...entry,
      ...history,
      // Model history remembers the athlete's source school, but field
      // attachment is authoritative for scoring. Individual qualifiers
      // intentionally carry null here so they displace without scoring.
      provider_team_id: entry.provider_team_id,
      team_name: entry.team_name,
      estimate_source: "workbook_history"
    };
    const prior = fittedModel.gradePriors.get(entry.grade) || {
      mean_seconds: globalMean,
      standard_deviation_seconds: globalSpread
    };
    const raceSigma = Math.max(25, fittedModel.diagnostics.global_individual_standard_deviation_seconds * 1.5);
    const abilitySe = Math.max(35, prior.standard_deviation_seconds);
    return {
      ...entry,
      history_count: 0,
      distinct_meet_count: 0,
      ability_performance_count: 0,
      discarded_performance_count: 0,
      ability_selection_rule: "grade prior because no eligible earlier performance is available",
      mean_seconds: prior.mean_seconds,
      ability_standard_error_seconds: abilitySe,
      race_standard_deviation_seconds: raceSigma,
      predictive_standard_deviation_seconds: Math.sqrt(raceSigma ** 2 + abilitySe ** 2),
      latest_performance_date: null,
      estimate_source: "grade_prior_no_history"
    };
  });
}

export function selectProvisionalLineups(fieldEstimates, maxRunners = 7) {
  const teams = groupBy(fieldEstimates, (row) => row.provider_team_id);
  const selectedIds = new Set();
  const lineups = [];
  for (const [teamId, athletes] of teams) {
    const ordered = [...athletes].sort((left, right) => (
      Number(left.history_count === 0) - Number(right.history_count === 0)
      || left.mean_seconds - right.mean_seconds
      || left.provider_athlete_id.localeCompare(right.provider_athlete_id)
    ));
    const selected = ordered.slice(0, maxRunners);
    selected.forEach((row) => selectedIds.add(row.provider_athlete_id));
    lineups.push({
      provider_team_id: teamId,
      team_name: ordered[0]?.team_name || teamId,
      entered_athletes: ordered.length,
      selected_athletes: selected.length,
      can_score: selected.length >= 5,
      athlete_ids: selected.map((row) => row.provider_athlete_id)
    });
  }
  return {
    athletes: fieldEstimates.map((row) => ({
      ...row,
      provisional_lineup: selectedIds.has(row.provider_athlete_id),
      lineup_selection_rule: selectedIds.has(row.provider_athlete_id)
        ? `selected among up to ${maxRunners} evidence-backed athletes first, ordered by lowest pre-meet estimated time; no-history entries only fill an otherwise open slot`
        : `not selected under the school's evidence-first ${maxRunners}-runner rule`
    })),
    lineups: lineups.sort((left, right) => left.team_name.localeCompare(right.team_name))
  };
}

export function selectTopTeams(lineupData, maximumTeams = 24) {
  if (!Number.isInteger(maximumTeams) || maximumTeams < 1) {
    throw new Error("Maximum teams must be a positive integer.");
  }
  const athleteById = new Map((lineupData.athletes || []).map((row) => [row.provider_athlete_id, row]));
  const rankedTeams = (lineupData.lineups || []).filter((team) => team.can_score).map((team) => {
    const projectedScorers = team.athlete_ids.map((id) => athleteById.get(id)).filter(Boolean)
      .sort((left, right) => left.mean_seconds - right.mean_seconds)
      .slice(0, 5);
    return {
      ...team,
      projected_five_runner_seconds: projectedScorers.reduce((sum, athlete) => sum + athlete.mean_seconds, 0)
    };
  }).sort((left, right) => (
    left.projected_five_runner_seconds - right.projected_five_runner_seconds
    || left.team_name.localeCompare(right.team_name)
    || left.provider_team_id.localeCompare(right.provider_team_id)
  ));
  const selectedTeams = rankedTeams.slice(0, maximumTeams);
  const selectedTeamIds = new Set(selectedTeams.map((team) => team.provider_team_id));
  return {
    athletes: (lineupData.athletes || []).filter((athlete) => (
      athlete.provisional_lineup && selectedTeamIds.has(athlete.provider_team_id)
    )),
    lineups: selectedTeams,
    teamSelection: {
      maximum_teams: maximumTeams,
      eligible_scoring_teams: rankedTeams.length,
      selected_teams: selectedTeams.length,
      excluded_scoring_teams: Math.max(0, rankedTeams.length - selectedTeams.length),
      incomplete_teams_excluded: (lineupData.lineups || []).filter((team) => !team.can_score).length,
      selection_rule: "Lowest projected sum of five pre-meet athlete estimates; target performances are not used.",
      ranked_teams: rankedTeams.map((team, index) => ({
        provider_team_id: team.provider_team_id,
        team_name: team.team_name,
        projected_five_runner_seconds: team.projected_five_runner_seconds,
        selected: index < maximumTeams
      }))
    }
  };
}

function createRandom(seed) {
  let state = Number(seed) >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function normalSampler(random) {
  let spare = null;
  return () => {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return value;
    }
    const first = Math.max(Number.EPSILON, random());
    const second = random();
    const magnitude = Math.sqrt(-2 * Math.log(first));
    const angle = 2 * Math.PI * second;
    spare = magnitude * Math.sin(angle);
    return magnitude * Math.cos(angle);
  };
}

function percentileFromHistogram(histogram, percentile) {
  const total = histogram.reduce((sum, count) => sum + count, 0);
  if (!total) return null;
  const target = Math.max(1, Math.ceil(total * percentile));
  let cumulative = 0;
  for (let index = 0; index < histogram.length; index += 1) {
    cumulative += histogram[index];
    if (cumulative >= target) return index;
  }
  return histogram.length - 1;
}

export function scoreFinishOrder(finishOrder) {
  // Individual qualifiers occupy real finish places and displace team
  // scorers, but they never form a scoring team of their own. Keeping
  // their provider_team_id null makes that boundary explicit.
  const teamGroups = groupBy(
    finishOrder.filter((row) => row.provider_team_id),
    (row) => row.provider_team_id
  );
  const teams = [];
  for (const [teamId, athletes] of teamGroups) {
    const places = athletes.map((row) => row.place).sort((a, b) => a - b);
    const complete = places.length >= 5;
    teams.push({
      provider_team_id: teamId,
      team_name: athletes[0].team_name,
      finisher_count: places.length,
      complete,
      scoring_places: complete ? places.slice(0, 5) : [],
      sixth_place: complete ? places[5] ?? null : null,
      seventh_place: complete ? places[6] ?? null : null,
      score: complete ? places.slice(0, 5).reduce((sum, place) => sum + place, 0) : null
    });
  }
  const ranked = teams.filter((team) => team.complete).sort((left, right) => (
    left.score - right.score
    || (left.sixth_place ?? Infinity) - (right.sixth_place ?? Infinity)
    || left.provider_team_id.localeCompare(right.provider_team_id)
  ));
  let index = 0;
  while (index < ranked.length) {
    let end = index;
    while (
      end + 1 < ranked.length
      && ranked[end + 1].score === ranked[index].score
      && (ranked[end + 1].sixth_place ?? Infinity) === (ranked[index].sixth_place ?? Infinity)
    ) end += 1;
    const averageRank = ((index + 1) + (end + 1)) / 2;
    for (let cursor = index; cursor <= end; cursor += 1) {
      ranked[cursor].rank = averageRank;
      ranked[cursor].unresolved_tie_size = end - index + 1;
      ranked[cursor].occupied_rank_start = index + 1;
      ranked[cursor].occupied_rank_end = end + 1;
    }
    index = end + 1;
  }
  return { ranked, incomplete: teams.filter((team) => !team.complete) };
}

function topKCredit(team, cutoff) {
  const occupied = Math.max(0, Math.min(team.occupied_rank_end, cutoff) - team.occupied_rank_start + 1);
  return occupied / team.unresolved_tie_size;
}

export function simulateMeet(lineupData, options = {}) {
  const iterations = Number(options.iterations ?? 50000);
  const seed = Number(options.seed ?? 20261010);
  const teamDaySigma = Number(options.teamDaySigma ?? 0);
  if (!Number.isInteger(iterations) || iterations < 1) throw new Error("Simulation iterations must be a positive integer.");
  const athletes = lineupData.athletes.filter((row) => row.provisional_lineup);
  if (!athletes.length) throw new Error("The provisional field is empty.");
  const teams = lineupData.lineups;
  const random = createRandom(seed);
  const normal = normalSampler(random);
  const athleteStats = new Map(athletes.map((athlete) => [athlete.provider_athlete_id, {
    place_histogram: Array(athletes.length + 1).fill(0),
    place_sum: 0,
    wins: 0,
    top3: 0,
    top5: 0,
    top10: 0,
    top25: 0
  }]));
  const teamStats = new Map(teams.map((team) => [team.provider_team_id, {
    rank_histogram: Array(teams.length + 1).fill(0),
    rank_sum: 0,
    score_sum: 0,
    score_values: [],
    scoring_trials: 0,
    win_credit: 0,
    top3_credit: 0,
    top5_credit: 0
  }]));

  for (let trial = 0; trial < iterations; trial += 1) {
    const teamShocks = new Map(teams.map((team) => [team.provider_team_id, normal() * teamDaySigma]));
    const finishOrder = athletes.map((athlete) => ({
      ...athlete,
      simulated_seconds: athlete.mean_seconds
        + (teamShocks.get(athlete.provider_team_id) || 0)
        + normal() * athlete.predictive_standard_deviation_seconds
    })).sort((left, right) => (
      left.simulated_seconds - right.simulated_seconds
      || left.provider_athlete_id.localeCompare(right.provider_athlete_id)
    ));
    finishOrder.forEach((athlete, index) => {
      athlete.place = index + 1;
      const stats = athleteStats.get(athlete.provider_athlete_id);
      stats.place_histogram[athlete.place] += 1;
      stats.place_sum += athlete.place;
      if (athlete.place === 1) stats.wins += 1;
      if (athlete.place <= 3) stats.top3 += 1;
      if (athlete.place <= 5) stats.top5 += 1;
      if (athlete.place <= 10) stats.top10 += 1;
      if (athlete.place <= 25) stats.top25 += 1;
    });

    const scored = scoreFinishOrder(finishOrder);
    for (const team of scored.ranked) {
      const stats = teamStats.get(team.provider_team_id);
      stats.rank_histogram[Math.round(team.rank)] += 1;
      stats.rank_sum += team.rank;
      stats.score_sum += team.score;
      stats.score_values.push(team.score);
      stats.scoring_trials += 1;
      stats.win_credit += topKCredit(team, 1);
      stats.top3_credit += topKCredit(team, 3);
      stats.top5_credit += topKCredit(team, 5);
    }
  }

  const athleteResults = athletes.map((athlete) => {
    const stats = athleteStats.get(athlete.provider_athlete_id);
    return {
      provider_athlete_id: athlete.provider_athlete_id,
      athlete_name: athlete.athlete_name,
      provider_team_id: athlete.provider_team_id,
      team_name: athlete.team_name,
      history_count: athlete.history_count,
      ability_performance_count: athlete.ability_performance_count,
      discarded_performance_count: athlete.discarded_performance_count,
      ability_selection_rule: athlete.ability_selection_rule,
      estimate_source: athlete.estimate_source,
      estimated_neutral_5k_seconds: athlete.mean_seconds,
      predictive_standard_deviation_seconds: athlete.predictive_standard_deviation_seconds,
      win_probability: stats.wins / iterations,
      top_3_probability: stats.top3 / iterations,
      top_5_probability: stats.top5 / iterations,
      top_10_probability: stats.top10 / iterations,
      top_25_probability: stats.top25 / iterations,
      mean_place: stats.place_sum / iterations,
      median_place: percentileFromHistogram(stats.place_histogram, 0.5),
      place_10th_percentile: percentileFromHistogram(stats.place_histogram, 0.1),
      place_90th_percentile: percentileFromHistogram(stats.place_histogram, 0.9)
    };
  }).sort((left, right) => left.mean_place - right.mean_place);

  const teamResults = teams.map((team) => {
    const stats = teamStats.get(team.provider_team_id);
    if (!team.can_score || !stats.scoring_trials) {
      return { ...team, scoring_probability: 0, win_probability: 0, top_3_probability: 0, top_5_probability: 0, mean_rank: null, mean_score: null };
    }
    const sortedScores = stats.score_values.sort((a, b) => a - b);
    return {
      ...team,
      scoring_probability: stats.scoring_trials / iterations,
      win_probability: stats.win_credit / iterations,
      top_3_probability: stats.top3_credit / iterations,
      top_5_probability: stats.top5_credit / iterations,
      mean_rank: stats.rank_sum / stats.scoring_trials,
      median_rank: percentileFromHistogram(stats.rank_histogram, 0.5),
      mean_score: stats.score_sum / stats.scoring_trials,
      score_10th_percentile: sortedScores[Math.floor((sortedScores.length - 1) * 0.1)],
      median_score: sortedScores[Math.floor((sortedScores.length - 1) * 0.5)],
      score_90th_percentile: sortedScores[Math.floor((sortedScores.length - 1) * 0.9)]
    };
  }).sort((left, right) => (
    (right.win_probability || 0) - (left.win_probability || 0)
    || (left.mean_rank ?? Infinity) - (right.mean_rank ?? Infinity)
    || left.team_name.localeCompare(right.team_name)
  ));

  return { iterations, seed, athleteResults, teamResults };
}

function spearmanRankCorrelation(pairs) {
  if (pairs.length < 2) return null;
  const predictedOrder = [...pairs].sort((a, b) => a.predicted - b.predicted);
  const actualOrder = [...pairs].sort((a, b) => a.actual - b.actual);
  const predictedRanks = new Map(predictedOrder.map((row, index) => [row.id, index + 1]));
  const actualRanks = new Map(actualOrder.map((row, index) => [row.id, index + 1]));
  const squaredDifference = pairs.reduce((sum, row) => (
    sum + (predictedRanks.get(row.id) - actualRanks.get(row.id)) ** 2
  ), 0);
  const n = pairs.length;
  return 1 - ((6 * squaredDifference) / (n * (n ** 2 - 1)));
}

export function evaluateSimulation(simulationOutput, targetEntries) {
  const predictionByAthlete = new Map(simulationOutput.athletes.map((row) => [row.provider_athlete_id, row]));
  const selectedIds = new Set(simulationOutput.athletes.map((row) => row.provider_athlete_id));
  const actualFinishers = (targetEntries || [])
    .filter((entry) => selectedIds.has(String(entry.provider_athlete_id)) && entry.observed_outcome?.finished)
    .sort((left, right) => Number(left.observed_outcome.place) - Number(right.observed_outcome.place))
    .map((entry, index) => ({
      provider_athlete_id: String(entry.provider_athlete_id),
      provider_team_id: String(entry.provider_team_id),
      athlete_name: entry.athlete_name,
      team_name: entry.school_identity?.canonical_school_name || entry.team_name,
      published_overall_place: Number(entry.observed_outcome.place),
      actual_d4_selected_lineup_place: index + 1,
      time_display: entry.observed_outcome.time_display
    }));
  const actualByAthlete = new Map(actualFinishers.map((row) => [row.provider_athlete_id, row]));
  const comparable = simulationOutput.athletes
    .filter((row) => actualByAthlete.has(row.provider_athlete_id))
    .map((row) => ({
      id: row.provider_athlete_id,
      predicted: row.mean_place,
      actual: actualByAthlete.get(row.provider_athlete_id).actual_d4_selected_lineup_place
    }));
  const meanAbsolutePlaceError = comparable.length
    ? comparable.reduce((sum, row) => sum + Math.abs(row.predicted - row.actual), 0) / comparable.length
    : null;
  const meanAbsolutePercentileError = comparable.length
    ? comparable.reduce((sum, row) => {
      const predictedPercentile = (row.predicted - 0.5) / simulationOutput.athletes.length;
      const actualPercentile = (row.actual - 0.5) / actualFinishers.length;
      return sum + Math.abs(predictedPercentile - actualPercentile);
    }, 0) / comparable.length
    : null;

  const actualOrder = actualFinishers.map((row) => ({ ...row, place: row.actual_d4_selected_lineup_place }));
  const actualScored = scoreFinishOrder(actualOrder);
  const predictedTeamById = new Map(simulationOutput.teams.map((row) => [row.provider_team_id, row]));
  const actualTeams = actualScored.ranked.map((team) => ({
    ...team,
    predicted_mean_rank: predictedTeamById.get(team.provider_team_id)?.mean_rank ?? null,
    predicted_win_probability: predictedTeamById.get(team.provider_team_id)?.win_probability ?? null
  }));
  const predictedFavorite = simulationOutput.teams.find((team) => team.can_score);
  const actualWinner = actualTeams[0] || null;

  return {
    evaluation_scope: "Authoritative D4 entrants selected to the provisional seven-runner lineups, re-ranked within that D4 subset. This is not the official mixed D3/D4 race score.",
    selected_athletes: simulationOutput.athletes.length,
    selected_athletes_with_target_finish: actualFinishers.length,
    selected_athletes_without_target_finish: simulationOutput.athletes.length - actualFinishers.length,
    athlete_metrics: {
      comparable_finishers: comparable.length,
      mean_absolute_d4_place_error: meanAbsolutePlaceError,
      mean_absolute_finish_percentile_error: meanAbsolutePercentileError,
      spearman_rank_correlation: spearmanRankCorrelation(comparable)
    },
    team_winner_check: {
      predicted_favorite: predictedFavorite?.team_name || null,
      predicted_favorite_win_probability: predictedFavorite?.win_probability ?? null,
      actual_d4_selected_lineup_winner: actualWinner?.team_name || null,
      favorite_won: Boolean(predictedFavorite && actualWinner && predictedFavorite.provider_team_id === actualWinner.provider_team_id)
    },
    actual_d4_selected_lineup_finishers: actualFinishers,
    actual_d4_selected_lineup_team_scores: actualTeams,
    incomplete_teams: actualScored.incomplete
  };
}
