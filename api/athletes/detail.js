import { supabaseAdmin } from "../../lib/supabase-admin.mjs";
import {
  cleanAthleteText,
  loadAthleteSeed,
  isMissingAthleteFoundationError
} from "../../lib/athlete_foundation_service.mjs";
import {
  isMissingRecruitingFoundationError,
  loadLatestRankSnapshots,
  starLabel
} from "../../lib/recruiting_service.mjs";
import {
  loadAthletePathToState,
  isMissingPathToStateError
} from "../../lib/path_to_state_service.mjs";

function parseInput(request) {
  if (request.method === "GET") {
    return request.query || {};
  }

  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The athlete profile request is invalid.");
      error.status = 400;
      throw error;
    }
  }

  return request.body || {};
}

function cleanSlug(value) {
  return cleanAthleteText(value, 500)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function profileStatus(profile) {
  if (profile.verified || profile.verification_status === "admin_verified") {
    return {
      label: "Verified athlete profile",
      tone: "verified",
      detail:
        "Podium Watch has reviewed the athlete identity and core profile information. Individual performances still keep their own source status."
    };
  }

  if (profile.verification_status === "source_verified") {
    return {
      label: "Source verified profile",
      tone: "verified",
      detail:
        "The profile identity is connected to reviewed source information. Performance records are labeled separately."
    };
  }

  if (profile.verification_status === "team_roster_linked") {
    return {
      label: "Team roster linked",
      tone: "source",
      detail:
        "The athlete identity is connected to a Podium Watch team roster. This does not make every performance official."
    };
  }

  if (profile.verification_status === "editorial_source_linked") {
    return {
      label: "Podium Watch ranking source linked",
      tone: "editorial",
      detail:
        "This profile was created from a Podium Watch editorial ranking. Ranking order and mark snapshots are analysis, not official OHSAA results."
    };
  }

  return {
    label: "Unverified profile",
    tone: "warning",
    detail:
      "This profile is waiting for stronger source confirmation. Use the correction form to share an official source."
  };
}

function fallbackProfile(seed) {
  return {
    source_mode: "bundled_editorial_seed",
    profile: {
      id: null,
      slug: seed.profile_slug,
      display_name: seed.display_name,
      first_name: seed.first_name,
      last_name: seed.last_name,
      preferred_name: null,
      gender: seed.gender,
      graduation_year: seed.graduation_year,
      graduation_year_source: seed.graduation_year_source,
      athlete_status: "active",
      bio: null,
      photo_url: null,
      hometown: null,
      college_commitment: null,
      college_commitment_verified: false,
      verified: false,
      verification_status: "editorial_source_linked",
      recruiting_enabled: false,
      recruiting_headline: null,
      primary_events: [seed.event],
      college_interests: null,
      recruiting_contact_route: "none",
      updated_at: seed.ranking.updated_date
    },
    status: profileStatus({
      verified: false,
      verification_status: "editorial_source_linked"
    }),
    school: {
      id: null,
      ohsaa_school_id: seed.ohsaa_school_id,
      school_name: seed.official_school_name || seed.school_name,
      city: seed.school_city,
      athletic_district: seed.athletic_district
    },
    team: null,
    school_history: [{
      id: null,
      school_name_snapshot: seed.school_name,
      season_start_year: seed.season_year,
      season_end_year: seed.season_year,
      grade_label: seed.grade_label,
      current: true,
      verified: false,
      source_note: "Podium Watch editorial ranking source"
    }],
    performances: [],
    rankings: [{
      id: null,
      rank: seed.ranking.rank,
      previous_rank: seed.ranking.previous_rank,
      ranking_title: seed.ranking.title,
      ranking_slug: seed.ranking.ranking_slug,
      ranking_href: seed.ranking.ranking_href,
      ranking_type: seed.ranking.ranking_type,
      sport: seed.sport,
      gender: seed.gender,
      division: seed.division,
      division_number: seed.division_number,
      season_year: seed.season_year,
      event_name: seed.event,
      mark_snapshot: seed.ranking.mark_snapshot,
      explanation: seed.ranking.explanation,
      source_label: seed.ranking.source_label,
      updated_date: seed.ranking.updated_date,
      editorial_only: true
    }],
    stories: [],
    social_links: [],
    recruiting: null,
    recruit_ratings: [],
    recruiting_activity: [],
    best_performances: [],
    content_items: [],
    source_note:
      "This profile is currently loaded from the bundled 2026 Podium Watch ranking seed. No verified performance history has been imported."
  };
}

async function loadDatabaseProfile(slug) {
  const { data: profile, error } = await supabaseAdmin
    .from("athlete_profiles")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!profile) {
    return null;
  }

  if (profile.merged_into_profile_id) {
    const { data: target, error: targetError } = await supabaseAdmin
      .from("athlete_profiles")
      .select("slug")
      .eq("id", profile.merged_into_profile_id)
      .maybeSingle();

    if (targetError) {
      throw targetError;
    }

    return {
      merged: true,
      redirect_slug: target?.slug || null
    };
  }

  if (
    !profile.public_visible ||
    profile.suspended ||
    profile.archived_at
  ) {
    return {
      private: true
    };
  }

  const [
    schoolResult,
    teamResult,
    historyResult,
    performanceResult,
    rankingResult,
    storyResult,
    rosterResult
  ] = await Promise.all([
    profile.current_school_id
      ? supabaseAdmin
          .from("ohio_schools")
          .select("id, ohsaa_school_id, school_name, city, athletic_district, school_website_url, athletics_website_url")
          .eq("id", profile.current_school_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    profile.current_team_id
      ? supabaseAdmin
          .from("team_pages")
          .select("id, school_name, slug, mascot, city, state, logo_url, published, ohio_school_id, cross_country_boys_division, cross_country_girls_division")
          .eq("id", profile.current_team_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabaseAdmin
      .from("athlete_school_history")
      .select(`
        id,
        school_id,
        team_id,
        school_name_snapshot,
        season_start_year,
        season_end_year,
        grade_label,
        current,
        verified,
        notes
      `)
      .eq("profile_id", profile.id)
      .order("current", { ascending: false })
      .order("season_start_year", { ascending: false }),
    supabaseAdmin
      .from("athlete_performances")
      .select(`
        id,
        sport,
        season_year,
        event_name,
        event_key,
        mark_text,
        mark_value,
        mark_unit,
        record_type,
        meet_name,
        meet_date,
        place,
        grade,
        wind_text,
        source_label,
        source_url,
        source_type,
        verification_status,
        verified_at,
        notes
      `)
      .eq("profile_id", profile.id)
      .eq("public_visible", true)
      .is("archived_at", null)
      .order("season_year", { ascending: false })
      .order("meet_date", { ascending: false }),
    supabaseAdmin
      .from("athlete_ranking_entries")
      .select("*")
      .eq("profile_id", profile.id)
      .eq("current", true)
      .order("updated_date", { ascending: false })
      .order("rank", { ascending: true }),
    supabaseAdmin
      .from("athlete_story_links")
      .select(`
        id,
        story_slug,
        story_title,
        story_href,
        story_date,
        relationship
      `)
      .eq("profile_id", profile.id)
      .eq("public_visible", true)
      .order("story_date", { ascending: false }),
    supabaseAdmin
      .from("team_athletes")
      .select("id, team_id")
      .eq("athlete_profile_id", profile.id)
      .eq("public_visible", true)
      .limit(30)
  ]);

  for (const result of [
    schoolResult,
    teamResult,
    historyResult,
    performanceResult,
    rankingResult,
    storyResult,
    rosterResult
  ]) {
    if (result.error) {
      throw result.error;
    }
  }

  // Guarded so a missing migration (install/10_PATH_TO_STATE.sql not run
  // yet) or any other Path to State failure never breaks the whole
  // athlete page -- it just quietly shows no roadmap panel.
  // loadAthletePathToState itself returns null for profile.gender ===
  // "unspecified" and when there's no school/team to build a path from.
  let pathToState = null;
  try {
    pathToState = await loadAthletePathToState({
      profile,
      school: schoolResult.data,
      team: teamResult.data
    });
  } catch (error) {
    if (!isMissingPathToStateError(error)) {
      console.error("Path to State could not be loaded for athlete:", error);
    }
  }

  const rosterAthleteIds = (rosterResult.data || []).map((row) => row.id);
  let socialLinks = [];

  if (rosterAthleteIds.length) {
    const { data, error: socialError } = await supabaseAdmin
      .from("athlete_social_links")
      .select("id, athlete_id, platform, label, url, verified, sort_order")
      .in("athlete_id", rosterAthleteIds)
      .eq("published", true)
      .eq("athlete_consent_confirmed", true)
      .eq("guardian_consent_confirmed", true)
      .eq("approved_by_team", true)
      .order("sort_order", { ascending: true });

    if (socialError) {
      throw socialError;
    }

    socialLinks = data || [];
  }

  const recruiting = profile.recruiting_enabled &&
    profile.recruiting_consent_confirmed
    ? {
        headline: profile.recruiting_headline,
        primary_events: profile.primary_events || [],
        college_interests: profile.college_interests,
        contact_route: profile.recruiting_contact_route,
        contact_label: profile.recruiting_contact_route === "team"
          ? "Contact the athlete's team through its public team page."
          : profile.recruiting_contact_route === "podium_watch"
            ? "Contact Podium Watch for the approved recruiting connection process."
            : "No recruiting contact route is published."
      }
    : null;

  let recruitRatings = [];
  let recruitingActivity = [];
  let bestPerformances = [];
  let contentItems = [];

  try {
    const [
      recruitRatingResult,
      recruitingActivityResult,
      bestPerformanceResult,
      contentItemResult
    ] = await Promise.all([
      supabaseAdmin
        .from("athlete_published_recruit_ratings")
        .select("*")
        .eq("profile_id", profile.id)
        .order("rating_score", { ascending: false }),
      supabaseAdmin
        .from("athlete_recruiting_activity")
        .select(`
          id,
          activity_type,
          college_name,
          college_division,
          event_group,
          activity_date,
          verification_status,
          source_label,
          source_url,
          notes
        `)
        .eq("profile_id", profile.id)
        .eq("public_visible", true)
        .is("archived_at", null)
        .order("activity_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("athlete_best_performances")
        .select(`
          id,
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
        .eq("profile_id", profile.id)
        .order("event_key", { ascending: true }),
      supabaseAdmin
        .from("athlete_content_items")
        .select(`
          id,
          content_type,
          title,
          url,
          caption,
          credit,
          source_label,
          source_url,
          featured,
          sort_order
        `)
        .eq("profile_id", profile.id)
        .eq("status", "published")
        .is("archived_at", null)
        .order("sort_order", { ascending: true })
    ]);

    for (const result of [
      recruitRatingResult,
      recruitingActivityResult,
      bestPerformanceResult,
      contentItemResult
    ]) {
      if (result.error) {
        throw result.error;
      }
    }

    const latestSnapshots = await loadLatestRankSnapshots([profile.id]);

    recruitRatings = (recruitRatingResult.data || []).map((rating) => ({
      ...rating,
      star_label: starLabel(rating.star_rating),
      previous_state_class_rank:
        latestSnapshots.get(`${profile.id}|${rating.event_group}`)?.state_class_rank ?? null,
      previous_event_group_rank:
        latestSnapshots.get(`${profile.id}|${rating.event_group}`)?.event_group_rank ?? null
    }));
    recruitingActivity = recruitingActivityResult.data || [];
    bestPerformances = bestPerformanceResult.data || [];
    contentItems = contentItemResult.data || [];
  } catch (error) {
    if (!isMissingRecruitingFoundationError(error)) {
      throw error;
    }
  }

  return {
    source_mode: "database",
    profile: {
      id: profile.id,
      slug: profile.slug,
      display_name: profile.display_name,
      first_name: profile.first_name,
      last_name: profile.last_name,
      preferred_name: profile.preferred_name,
      gender: profile.gender,
      graduation_year: profile.graduation_year,
      graduation_year_source: profile.graduation_year_source,
      athlete_status: profile.athlete_status,
      bio: profile.bio,
      photo_url: profile.photo_url,
      hometown: profile.hometown,
      college_commitment: profile.college_commitment,
      college_commitment_verified: profile.college_commitment_verified,
      verified: profile.verified,
      verification_status: profile.verification_status,
      recruiting_enabled: profile.recruiting_enabled,
      recruiting_headline: profile.recruiting_headline,
      primary_events: profile.primary_events || [],
      college_interests: profile.college_interests,
      recruiting_contact_route: profile.recruiting_contact_route,
      updated_at: profile.updated_at
    },
    status: profileStatus(profile),
    school: schoolResult.data || null,
    team: teamResult.data || null,
    path_to_state: pathToState,
    school_history: historyResult.data || [],
    performances: performanceResult.data || [],
    rankings: (rankingResult.data || []).map((ranking) => ({
      ...ranking,
      editorial_only: true
    })),
    stories: storyResult.data || [],
    social_links: socialLinks,
    recruiting,
    recruit_ratings: recruitRatings,
    recruiting_activity: recruitingActivity,
    best_performances: bestPerformances,
    content_items: contentItems,
    source_note:
      "Every performance and ranking keeps its own source and verification label. A verified athlete identity does not automatically verify every listed mark."
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
    const slug = cleanSlug(input.slug);

    if (!slug) {
      return response.status(400).json({
        error: "Choose an athlete profile."
      });
    }

    try {
      const profile = await loadDatabaseProfile(slug);

      if (profile?.merged) {
        return response.status(200).json(profile);
      }

      if (profile?.private) {
        return response.status(404).json({
          error: "Published athlete profile not found."
        });
      }

      if (profile) {
        return response.status(200).json(profile);
      }
    } catch (error) {
      if (!isMissingAthleteFoundationError(error)) {
        throw error;
      }
    }

    const dataset = await loadAthleteSeed();
    const seed = (dataset.athletes || []).find(
      (athlete) => athlete.profile_slug === slug
    );

    if (!seed) {
      return response.status(404).json({
        error: "Published athlete profile not found."
      });
    }

    return response.status(200).json(fallbackProfile(seed));
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Athlete profile error:", error);
    }

    return response.status(status).json({
      error: status < 500
        ? error.message
        : "The athlete profile could not be loaded."
    });
  }
}
