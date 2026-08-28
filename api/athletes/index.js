import { supabaseAdmin } from "../../lib/supabase-admin.mjs";
import {
  cleanAthleteText,
  loadAthleteSeed,
  normalizeAthleteGender,
  normalizeAthleteName,
  isMissingAthleteFoundationError
} from "../../lib/athlete_foundation_service.mjs";

function parseInput(request) {
  if (request.method === "GET") {
    return request.query || {};
  }

  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The athlete directory request is invalid.");
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

  return Math.max(min, Math.min(max, Math.trunc(number)));
}

function divisionNumber(value) {
  const match = cleanAthleteText(value, 50).match(/([1-5])/);
  return match ? Number(match[1]) : null;
}

// PostgREST sends .in(column, values) as a URL query parameter, so a
// large id list (this table has 800+ public profiles in production)
// blows past the request's URL length limit and the whole query fails
// with an opaque "Bad Request" -- confirmed directly against production
// data on 2026-08-28, not a hypothetical: 300 ids succeeded, 400+ ids
// failed every time. Chunking keeps each request well under that limit
// regardless of how large the athlete directory grows.
const ID_BATCH_SIZE = 150;

function chunk(values, size) {
  const batches = [];
  for (let index = 0; index < values.length; index += size) {
    batches.push(values.slice(index, index + size));
  }
  return batches;
}

async function selectInBatches(table, select, column, ids, extra) {
  if (!ids.length) {
    return [];
  }

  const batches = await Promise.all(
    chunk(ids, ID_BATCH_SIZE).map((batchIds) => {
      let query = supabaseAdmin.from(table).select(select).in(column, batchIds);
      if (extra) {
        query = extra(query);
      }
      return query;
    })
  );

  const rows = [];
  for (const batch of batches) {
    if (batch.error) {
      throw batch.error;
    }
    rows.push(...(batch.data || []));
  }
  return rows;
}

function safeSearch(value) {
  return normalizeAthleteName(
    cleanAthleteText(value, 200)
  );
}

function verificationLabel(profile) {
  if (profile.verified || profile.verification_status === "admin_verified") {
    return "Verified profile";
  }

  if (profile.verification_status === "source_verified") {
    return "Source verified";
  }

  if (profile.verification_status === "team_roster_linked") {
    return "Team roster linked";
  }

  if (profile.verification_status === "editorial_source_linked") {
    return "Ranking source linked";
  }

  return "Unverified profile";
}

function buildFallbackProfiles(dataset) {
  return (dataset.athletes || []).map((seed) => ({
    id: null,
    slug: seed.profile_slug,
    display_name: seed.display_name,
    gender: seed.gender,
    graduation_year: seed.graduation_year,
    school: {
      id: null,
      ohsaa_school_id: seed.ohsaa_school_id,
      school_name: seed.official_school_name || seed.school_name,
      city: seed.school_city,
      athletic_district: seed.athletic_district
    },
    team: null,
    primary_events: [seed.event],
    college_commitment: null,
    recruiting_enabled: false,
    recruiting_headline: null,
    verified: false,
    verification_status: "editorial_source_linked",
    verification_label: "Ranking source linked",
    ranking: {
      rank: seed.ranking.rank,
      title: seed.ranking.title,
      href: seed.ranking.ranking_href,
      division: seed.division,
      division_number: seed.division_number,
      event_name: seed.event,
      mark_snapshot: seed.ranking.mark_snapshot,
      updated_date: seed.ranking.updated_date,
      ranking_type: seed.ranking.ranking_type
    },
    top_performance: null,
    source_mode: "bundled_editorial_seed"
  }));
}

async function loadDatabaseProfiles() {
  const [countResult, profileResult] = await Promise.all([
    supabaseAdmin
      .from("athlete_profiles")
      .select("id", { count: "exact", head: true })
      .is("merged_into_profile_id", null)
      .is("archived_at", null),
    supabaseAdmin
      .from("athlete_profiles")
      .select(`
      id,
      slug,
      display_name,
      normalized_name,
      gender,
      graduation_year,
      current_school_id,
      current_team_id,
      college_commitment,
      public_visible,
      verified,
      verification_status,
      recruiting_enabled,
      recruiting_headline,
      primary_events,
      updated_at
      `)
      .eq("public_visible", true)
      .eq("suspended", false)
      .is("archived_at", null)
      .is("merged_into_profile_id", null)
      .limit(5000)
  ]);

  if (countResult.error) {
    throw countResult.error;
  }

  if (profileResult.error) {
    throw profileResult.error;
  }

  const rows = profileResult.data || [];
  const profileIds = rows.map((profile) => profile.id);
  const schoolIds = [...new Set(
    rows.map((profile) => profile.current_school_id).filter(Boolean)
  )];
  const teamIds = [...new Set(
    rows.map((profile) => profile.current_team_id).filter(Boolean)
  )];

  // Each of these ran as one unbounded .in(profileIds) query before --
  // fine while the athlete directory was small, but it now silently
  // fails every request once the id list gets long enough to blow past
  // the request's URL length limit (confirmed directly: this is exactly
  // why /api/athletes/ has been returning "could not be loaded" in
  // production). selectInBatches splits each id list into batches under
  // that limit and merges the results back into one array; sorting is
  // applied client-side afterward instead of via .order() so the "first
  // entry wins" logic below still resolves the same ranking/performance
  // per profile regardless of which batch a row came back in.
  const [schoolRows, teamRows, rankingRows, performanceRows] = await Promise.all([
    selectInBatches("ohio_schools", "id, ohsaa_school_id, school_name, city, athletic_district", "id", schoolIds),
    selectInBatches("team_pages", "id, school_name, slug, city, published", "id", teamIds),
    selectInBatches(
      "athlete_ranking_entries",
      "profile_id, rank, ranking_title, ranking_href, ranking_type, division, division_number, event_name, mark_snapshot, updated_date, current",
      "profile_id",
      profileIds,
      (query) => query.eq("current", true)
    ),
    selectInBatches(
      "athlete_performances",
      "profile_id, event_name, mark_text, meet_name, meet_date, verification_status, source_url",
      "profile_id",
      profileIds,
      (query) => query.eq("public_visible", true).is("archived_at", null).limit(10000)
    )
  ]);

  rankingRows.sort((first, second) =>
    String(second.updated_date || "").localeCompare(String(first.updated_date || "")) ||
    Number(first.rank || 999999) - Number(second.rank || 999999)
  );
  performanceRows.sort((first, second) =>
    String(second.meet_date || "").localeCompare(String(first.meet_date || ""))
  );

  const schoolMap = new Map(schoolRows.map((school) => [school.id, school]));
  const teamMap = new Map(teamRows.map((team) => [team.id, team]));
  const rankingByProfile = new Map();
  const performanceByProfile = new Map();

  rankingRows.forEach((ranking) => {
    if (!rankingByProfile.has(ranking.profile_id)) {
      rankingByProfile.set(ranking.profile_id, {
        rank: ranking.rank,
        title: ranking.ranking_title,
        href: ranking.ranking_href,
        division: ranking.division,
        division_number: ranking.division_number,
        event_name: ranking.event_name,
        mark_snapshot: ranking.mark_snapshot,
        updated_date: ranking.updated_date,
        ranking_type: ranking.ranking_type
      });
    }
  });

  performanceRows.forEach((performance) => {
    if (!performanceByProfile.has(performance.profile_id)) {
      performanceByProfile.set(performance.profile_id, performance);
    }
  });

  return {
    total_profile_count: Number(countResult.count || 0),
    profiles: rows.map((profile) => ({
      id: profile.id,
      slug: profile.slug,
      display_name: profile.display_name,
      normalized_name: profile.normalized_name,
      gender: profile.gender,
      graduation_year: profile.graduation_year,
      school: schoolMap.get(profile.current_school_id) || null,
      team: teamMap.get(profile.current_team_id) || null,
      primary_events: profile.primary_events || [],
      college_commitment: profile.college_commitment,
      recruiting_enabled: profile.recruiting_enabled,
      recruiting_headline: profile.recruiting_headline,
      verified: profile.verified,
      verification_status: profile.verification_status,
      verification_label: verificationLabel(profile),
      ranking: rankingByProfile.get(profile.id) || null,
      top_performance: performanceByProfile.get(profile.id) || null,
      updated_at: profile.updated_at,
      source_mode: "database"
    }))
  };
}

function applyFilters(profiles, input) {
  const search = safeSearch(input.search || input.q);
  const gender = normalizeAthleteGender(input.gender);
  const graduationYear = numberValue(input.graduation_year, 0, 2000, 2200);
  const division = divisionNumber(input.division);
  const event = safeSearch(input.event);
  const school = safeSearch(input.school);
  const verification = cleanAthleteText(input.verification, 50).toLowerCase();
  const recruitingOnly = ["1", "true", "yes", "on"].includes(
    cleanAthleteText(input.recruiting_only, 20).toLowerCase()
  );

  return profiles.filter((profile) => {
    const schoolName = profile.school?.school_name || profile.team?.school_name || "";
    const searchText = normalizeAthleteName([
      profile.display_name,
      schoolName,
      profile.school?.city,
      profile.school?.athletic_district,
      profile.graduation_year,
      profile.ranking?.title,
      profile.ranking?.division,
      profile.primary_events?.join(" "),
      profile.college_commitment
    ].filter(Boolean).join(" "));

    if (search && !searchText.includes(search)) {
      return false;
    }

    if (gender !== "unspecified" && profile.gender !== gender) {
      return false;
    }

    if (graduationYear && Number(profile.graduation_year) !== graduationYear) {
      return false;
    }

    if (division && Number(profile.ranking?.division_number) !== division) {
      return false;
    }

    if (event) {
      const eventText = normalizeAthleteName([
        profile.ranking?.event_name,
        profile.ranking?.mark_snapshot,
        profile.top_performance?.event_name,
        ...(profile.primary_events || [])
      ].filter(Boolean).join(" "));

      if (!eventText.includes(event)) {
        return false;
      }
    }

    if (school && !normalizeAthleteName(schoolName).includes(school)) {
      return false;
    }

    if (verification === "verified" && !profile.verified) {
      return false;
    }

    if (
      verification === "source_linked" &&
      ![
        "editorial_source_linked",
        "team_roster_linked",
        "source_verified",
        "admin_verified"
      ].includes(profile.verification_status)
    ) {
      return false;
    }

    if (recruitingOnly && !profile.recruiting_enabled) {
      return false;
    }

    return true;
  });
}

function buildSummary(profiles) {
  const graduationYears = {};
  const genders = {};
  const divisions = {};

  profiles.forEach((profile) => {
    const year = profile.graduation_year || "Unknown";
    const gender = profile.gender || "unspecified";
    const division = profile.ranking?.division || "Not listed";

    graduationYears[year] = (graduationYears[year] || 0) + 1;
    genders[gender] = (genders[gender] || 0) + 1;
    divisions[division] = (divisions[division] || 0) + 1;
  });

  return {
    total: profiles.length,
    verified: profiles.filter((profile) => profile.verified).length,
    recruiting: profiles.filter((profile) => profile.recruiting_enabled).length,
    graduation_years: graduationYears,
    genders,
    divisions
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
    const page = numberValue(input.page, 1, 1, 10000);
    const pageSize = numberValue(input.page_size, 24, 1, 100);
    let profiles;
    let sourceMode;

    try {
      const database = await loadDatabaseProfiles();

      if (database.total_profile_count === 0) {
        const dataset = await loadAthleteSeed();
        profiles = buildFallbackProfiles(dataset);
        sourceMode = "bundled_editorial_seed";
      } else {
        profiles = database.profiles;
        sourceMode = "database";
      }
    } catch (error) {
      if (!isMissingAthleteFoundationError(error)) {
        throw error;
      }

      const dataset = await loadAthleteSeed();
      profiles = buildFallbackProfiles(dataset);
      sourceMode = "bundled_editorial_seed";
    }

    const filtered = applyFilters(profiles, input)
      .sort((first, second) => {
        const firstRank = Number(first.ranking?.rank || 999999);
        const secondRank = Number(second.ranking?.rank || 999999);

        return firstRank - secondRank ||
          String(first.display_name || "").localeCompare(
            String(second.display_name || "")
          );
      });
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;

    return response.status(200).json({
      source_mode: sourceMode,
      source_note: sourceMode === "database"
        ? "Profiles are loaded from the Podium Watch athlete foundation."
        : "The athlete database has not been populated yet, so this directory is using the bundled Podium Watch editorial ranking seed.",
      page: safePage,
      page_size: pageSize,
      total: filtered.length,
      total_pages: totalPages,
      summary: buildSummary(profiles),
      filters: {
        search: cleanAthleteText(input.search || input.q, 200),
        gender: normalizeAthleteGender(input.gender),
        graduation_year: input.graduation_year || "",
        division: input.division || "",
        event: cleanAthleteText(input.event, 100),
        school: cleanAthleteText(input.school, 200),
        verification: cleanAthleteText(input.verification, 50),
        recruiting_only: input.recruiting_only || false
      },
      athletes: filtered.slice(start, start + pageSize)
    });
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Athlete directory error:", error);
    }

    return response.status(status).json({
      error: status < 500
        ? error.message
        : "The athlete directory could not be loaded."
    });
  }
}
