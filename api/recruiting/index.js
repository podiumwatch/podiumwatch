import { supabaseAdmin } from "../../lib/supabase-admin.mjs";
import {
  cleanAthleteText,
  normalizeAthleteGender,
  normalizeAthleteName
} from "../../lib/athlete_foundation_service.mjs";
import {
  EVENT_GROUPS,
  eventDefinitions,
  isMissingRecruitingFoundationError,
  loadLatestRankSnapshots,
  starLabel
} from "../../lib/recruiting_service.mjs";

function parseInput(request) {
  if (request.method === "GET") {
    return request.query || {};
  }

  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The recruiting search request is invalid.");
      error.status = 400;
      throw error;
    }
  }

  return request.body || {};
}

function numberValue(value, fallback, min, max) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, number));
}

function cleanBoolean(value) {
  if (typeof value === "boolean") return value;

  return ["1", "true", "yes", "on"].includes(
    cleanAthleteText(value, 20).toLowerCase()
  );
}

function activityStatusLabel(status) {
  return {
    reported: "Reported",
    confirmed_by_athlete: "Confirmed by athlete or family",
    confirmed_by_coach: "Confirmed by coach",
    publicly_announced: "Publicly announced",
    disputed: "Disputed"
  }[status] || "Reported";
}

async function loadRecruitingRows() {
  const { data: ratings, error: ratingError } = await supabaseAdmin
    .from("athlete_published_recruit_ratings")
    .select("*")
    .order("rating_score", { ascending: false })
    .limit(5000);

  if (ratingError) throw ratingError;

  const profileIds = [...new Set((ratings || []).map((row) => row.profile_id))];

  if (!profileIds.length) {
    return {
      ratings: [],
      profiles: new Map(),
      schools: new Map(),
      teams: new Map(),
      bestByProfile: new Map(),
      activitiesByProfile: new Map()
    };
  }

  const [
    profilesResult,
    bestResult,
    activitiesResult
  ] = await Promise.all([
    supabaseAdmin
      .from("athlete_profiles")
      .select(`
        id,
        slug,
        display_name,
        gender,
        graduation_year,
        current_school_id,
        current_team_id,
        college_commitment,
        college_commitment_verified,
        recruiting_enabled,
        recruiting_headline,
        public_visible,
        suspended,
        archived_at,
        merged_into_profile_id
      `)
      .in("id", profileIds)
      .eq("public_visible", true)
      .eq("suspended", false)
      .is("archived_at", null)
      .is("merged_into_profile_id", null),
    supabaseAdmin
      .from("athlete_best_performances")
      .select(`
        id,
        profile_id,
        sport,
        season_year,
        event_name,
        event_key,
        event_group,
        measurement_type,
        mark_text,
        mark_sort_value,
        mark_unit,
        meet_name,
        meet_date,
        source_label,
        source_url,
        verification_status
      `)
      .in("profile_id", profileIds)
      .limit(10000),
    supabaseAdmin
      .from("athlete_recruiting_activity")
      .select(`
        id,
        profile_id,
        activity_type,
        college_name,
        college_division,
        event_group,
        activity_date,
        verification_status,
        source_label,
        source_url
      `)
      .in("profile_id", profileIds)
      .eq("public_visible", true)
      .is("archived_at", null)
      .order("activity_date", { ascending: false })
      .limit(10000)
  ]);

  for (const result of [profilesResult, bestResult, activitiesResult]) {
    if (result.error) throw result.error;
  }

  const profiles = new Map((profilesResult.data || []).map((row) => [row.id, row]));
  const schoolIds = [...new Set((profilesResult.data || []).map((row) => row.current_school_id).filter(Boolean))];
  const teamIds = [...new Set((profilesResult.data || []).map((row) => row.current_team_id).filter(Boolean))];

  const [schoolsResult, teamsResult] = await Promise.all([
    schoolIds.length
      ? supabaseAdmin
          .from("ohio_schools")
          .select("id, school_name, city, athletic_district")
          .in("id", schoolIds)
      : Promise.resolve({ data: [], error: null }),
    teamIds.length
      ? supabaseAdmin
          .from("team_pages")
          .select("id, school_name, slug, city, state, logo_url")
          .in("id", teamIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (schoolsResult.error) throw schoolsResult.error;
  if (teamsResult.error) throw teamsResult.error;

  const schools = new Map((schoolsResult.data || []).map((row) => [row.id, row]));
  const teams = new Map((teamsResult.data || []).map((row) => [row.id, row]));
  const bestByProfile = new Map();

  for (const performance of bestResult.data || []) {
    const list = bestByProfile.get(performance.profile_id) || [];
    list.push(performance);
    bestByProfile.set(performance.profile_id, list);
  }

  const activitiesByProfile = new Map();

  for (const activity of activitiesResult.data || []) {
    const list = activitiesByProfile.get(activity.profile_id) || [];
    list.push({
      ...activity,
      verification_label: activityStatusLabel(activity.verification_status)
    });
    activitiesByProfile.set(activity.profile_id, list);
  }

  return {
    ratings: ratings || [],
    profiles,
    schools,
    teams,
    bestByProfile,
    activitiesByProfile
  };
}

function chooseTopPerformance(rating, performances = []) {
  if (!performances.length) return null;

  const matching = performances.find(
    (item) => item.event_key === rating.top_verified_event_key
  );

  if (matching) return matching;

  const primary = performances.find(
    (item) => item.event_key === rating.primary_event_key
  );

  return primary || performances[0];
}

function applyFilters(rows, input) {
  const search = normalizeAthleteName(
    cleanAthleteText(input.search || input.q, 200)
  );
  const gender = normalizeAthleteGender(input.gender);
  const graduationYear = Number(input.graduation_year) || 0;
  const eventGroup = cleanAthleteText(input.event_group, 80).toLowerCase();
  const primaryEvent = cleanAthleteText(input.event_key, 100).toLowerCase();
  const minimumStars = numberValue(input.minimum_stars, 0, 0, 5);
  const minimumScore = numberValue(input.minimum_score, 0, 0, 100);
  const commitment = cleanAthleteText(input.commitment, 40).toLowerCase();
  const maximumTime = Number(input.maximum_time);
  const minimumMark = Number(input.minimum_mark);
  const recruitingOnly = cleanBoolean(input.recruiting_only);

  return rows.filter((row) => {
    const searchText = normalizeAthleteName([
      row.athlete.display_name,
      row.school?.school_name,
      row.team?.school_name,
      row.school?.city,
      row.athlete.graduation_year,
      row.event_group,
      row.primary_event_key,
      row.evaluation,
      row.athlete.college_commitment,
      row.top_performance?.event_name,
      row.top_performance?.mark_text
    ].filter(Boolean).join(" "));

    if (search && !searchText.includes(search)) return false;
    if (gender !== "unspecified" && row.athlete.gender !== gender) return false;
    if (graduationYear && Number(row.graduation_year) !== graduationYear) return false;
    if (eventGroup && EVENT_GROUPS.has(eventGroup) && row.event_group !== eventGroup) return false;

    const requestedPerformance = primaryEvent
      ? row.best_performances.find(
          (performance) => performance.event_key === primaryEvent
        ) || null
      : row.top_performance;

    if (primaryEvent && !requestedPerformance) return false;
    if (minimumStars && Number(row.star_rating) < minimumStars) return false;
    if (minimumScore && Number(row.rating_score) < minimumScore) return false;
    if (recruitingOnly && !row.athlete.recruiting_enabled) return false;

    const committed = Boolean(row.athlete.college_commitment);

    if (commitment === "committed" && !committed) return false;
    if (commitment === "uncommitted" && committed) return false;

    if (Number.isFinite(maximumTime) && maximumTime > 0) {
      if (
        requestedPerformance?.measurement_type !== "time" ||
        Number(requestedPerformance.mark_sort_value) > maximumTime
      ) {
        return false;
      }
    }

    if (Number.isFinite(minimumMark) && minimumMark > 0) {
      if (
        !["distance", "height", "points"].includes(
          requestedPerformance?.measurement_type
        ) ||
        Number(requestedPerformance.mark_sort_value) < minimumMark
      ) {
        return false;
      }
    }

    return true;
  });
}

function summary(rows) {
  const stars = {};
  const groups = {};
  const classes = {};

  for (const row of rows) {
    stars[row.star_rating] = (stars[row.star_rating] || 0) + 1;
    groups[row.event_group] = (groups[row.event_group] || 0) + 1;
    classes[row.graduation_year] = (classes[row.graduation_year] || 0) + 1;
  }

  return {
    total: rows.length,
    stars,
    event_groups: groups,
    graduation_years: classes,
    committed: rows.filter((row) => row.athlete.college_commitment).length,
    uncommitted: rows.filter((row) => !row.athlete.college_commitment).length
  };
}

export default async function handler(request, response) {
  response.setHeader(
    "Cache-Control",
    "public, max-age=30, s-maxage=120, stale-while-revalidate=600"
  );

  if (!["GET", "POST"].includes(request.method)) {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const input = parseInput(request);
    const data = await loadRecruitingRows();
    const { data: activeMethodology, error: methodologyError } = await supabaseAdmin
      .from("athlete_recruit_rating_methodologies")
      .select("methodology_key, name, version_label, metadata")
      .eq("status", "active")
      .order("effective_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (methodologyError) throw methodologyError;
    const latestSnapshots = await loadLatestRankSnapshots(
      [...new Set(data.ratings.map((rating) => rating.profile_id))]
    );
    const joined = data.ratings
      .map((rating) => {
        const athlete = data.profiles.get(rating.profile_id);

        if (!athlete) return null;

        const school = data.schools.get(athlete.current_school_id) || null;
        const team = data.teams.get(athlete.current_team_id) || null;
        const performances = data.bestByProfile.get(rating.profile_id) || [];
        const topPerformance = chooseTopPerformance(rating, performances);

        return {
          id: rating.id,
          profile_id: rating.profile_id,
          graduation_year: rating.graduation_year,
          gender: rating.gender,
          event_group: rating.event_group,
          primary_event_key: rating.primary_event_key,
          secondary_event_keys: rating.secondary_event_keys || [],
          rating_score: Number(rating.rating_score),
          star_rating: Number(rating.star_rating),
          star_label: starLabel(rating.star_rating),
          projection_level: rating.projection_level,
          confidence_level: rating.confidence_level,
          evaluation: rating.evaluation,
          strengths: rating.strengths,
          development_notes: rating.development_notes,
          based_on_verified_data: rating.based_on_verified_data,
          verified_performance_count: rating.verified_performance_count,
          data_cutoff_date: rating.data_cutoff_date,
          published_at: rating.published_at,
          updated_at: rating.updated_at,
          state_class_rank: Number(rating.state_class_rank),
          event_group_rank: Number(rating.event_group_rank),
          previous_state_class_rank:
            latestSnapshots.get(`${rating.profile_id}|${rating.event_group}`)?.state_class_rank ?? null,
          previous_event_group_rank:
            latestSnapshots.get(`${rating.profile_id}|${rating.event_group}`)?.event_group_rank ?? null,
          athlete,
          school,
          team,
          top_performance: topPerformance,
          best_performances: performances.slice(0, 12),
          recruiting_activity: (data.activitiesByProfile.get(rating.profile_id) || []).slice(0, 20)
        };
      })
      .filter(Boolean);

    const filtered = applyFilters(joined, input);
    const requestedEventKey = cleanAthleteText(
      input.event_key,
      100
    ).toLowerCase();
    const displayRows = filtered.map((row) => ({
      ...row,
      display_performance: requestedEventKey
        ? row.best_performances.find(
            (performance) => performance.event_key === requestedEventKey
          ) || row.top_performance
        : row.top_performance
    }));
    const sort = cleanAthleteText(input.sort, 50).toLowerCase();

    displayRows.sort((first, second) => {
      if (sort === "name") {
        return first.athlete.display_name.localeCompare(second.athlete.display_name);
      }

      if (sort === "class") {
        return (
          first.graduation_year - second.graduation_year ||
          second.rating_score - first.rating_score
        );
      }

      return (
        second.rating_score - first.rating_score ||
        first.athlete.display_name.localeCompare(second.athlete.display_name)
      );
    });

    const page = Math.max(1, Math.trunc(numberValue(input.page, 1, 1, 10000)));
    const pageSize = Math.max(1, Math.trunc(numberValue(input.page_size, 50, 1, 100)));
    const totalPages = Math.max(1, Math.ceil(displayRows.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * pageSize;

    return response.status(200).json({
      source_mode: "database",
      methodology: {
        key: activeMethodology?.methodology_key || "podium-watch-recruit-ratings-2026-1",
        label: activeMethodology
          ? `${activeMethodology.name} ${activeMethodology.version_label}`
          : "Podium Watch Recruit Ratings 2026.1",
        public_path: "/recruiting/methodology/",
        pay_to_play: activeMethodology?.metadata?.pay_to_play ?? false,
        offers_affect_score: activeMethodology?.metadata?.offers_affect_score ?? false
      },
      events: eventDefinitions(),
      summary: summary(displayRows),
      pagination: {
        page: currentPage,
        page_size: pageSize,
        total_pages: totalPages,
        total_results: displayRows.length
      },
      ratings: displayRows.slice(start, start + pageSize)
    });
  } catch (error) {
    if (isMissingRecruitingFoundationError(error)) {
      return response.status(409).json({
        error:
          "The Recruit Ratings database migration has not been installed yet.",
        migration_path:
          "install/03_RECRUIT_RATINGS_AND_PERFORMANCE_HISTORY.sql"
      });
    }

    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Recruiting directory error:", error);
    }

    return response.status(status).json({
      error: status < 500
        ? error.message
        : "The recruiting directory could not be loaded."
    });
  }
}
