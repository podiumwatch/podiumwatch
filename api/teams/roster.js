import { supabaseAdmin } from "../../lib/supabase-admin.mjs";

function cleanText(value, maxLength = 300) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

// team_seasons.sport only ever stores one of three display strings
// ("Cross Country", "Indoor Track", "Outdoor Track" -- see
// team_roster_service.mjs's normalizeSeasonSport), while
// athlete_performances.sport (and the athlete_best_performances view built
// from it) uses the normalized enum cross_country/indoor_track/outdoor_track.
// Confirmed live against production during verification -- an unconverted
// .eq("sport", selectedSeason.sport) silently matched zero rows every time.
function seasonSportToPerformanceSport(seasonSport) {
  const cleaned = String(seasonSport || "").trim().toLowerCase();

  if (cleaned === "cross country") {
    return "cross_country";
  }

  if (cleaned === "indoor track") {
    return "indoor_track";
  }

  if (cleaned === "outdoor track") {
    return "outdoor_track";
  }

  return null;
}

function athleteDisplayName(athlete) {
  return String(
    athlete?.display_name ||
    [athlete?.preferred_name || athlete?.first_name, athlete?.last_name].filter(Boolean).join(" ")
  ).trim();
}

function cleanSlug(value) {
  return cleanText(value, 300)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The submitted roster request is invalid.");
      error.status = 400;
      throw error;
    }
  }

  return request.body || {};
}

async function findPublicTeam(body) {
  const teamId = cleanText(body.team_id, 100);
  const slug = cleanSlug(body.slug);

  let query = supabaseAdmin
    .from("team_pages")
    .select("id, school_name, slug, published, suspended, archived_at, merged_into_team_id");

  if (teamId) {
    query = query.eq("id", teamId);
  } else if (slug) {
    query = query.ilike("slug", slug);
  } else {
    const error = new Error("Choose a team page.");
    error.status = 400;
    throw error;
  }

  const { data: team, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  if (
    !team ||
    !team.published ||
    team.suspended ||
    team.archived_at ||
    team.merged_into_team_id
  ) {
    const publicError = new Error("Published team roster not found.");
    publicError.status = 404;
    throw publicError;
  }

  return team;
}

async function loadSeasonRoster(team, requestedSeasonId) {
  const { data: seasons, error: seasonError } = await supabaseAdmin
    .from("team_seasons")
    .select(
      `
        id,
        season_year,
        academic_year_start,
        sport,
        name,
        program_scope,
        status,
        is_current,
        start_date,
        end_date,
        published_at
      `
    )
    .eq("team_id", team.id)
    .in("status", ["published", "archived"])
    .order("is_current", { ascending: false })
    .order("season_year", { ascending: false })
    .order("created_at", { ascending: false });

  if (seasonError) {
    throw seasonError;
  }

  const publicSeasons = seasons || [];
  const selectedSeason = requestedSeasonId
    ? publicSeasons.find((season) => season.id === requestedSeasonId) || null
    : publicSeasons.find((season) => season.is_current) || publicSeasons[0] || null;

  if (!selectedSeason) {
    return {
      team: {
        id: team.id,
        school_name: team.school_name,
        slug: team.slug
      },
      seasons: publicSeasons,
      selected_season: null,
      entries: [],
      performance_leaders: []
    };
  }

  const { data: entries, error: entryError } = await supabaseAdmin
    .from("team_roster_entries")
    .select(
      `
        id,
        athlete_id,
        grade,
        captain,
        events,
        personal_bests,
        roster_status,
        sort_order
      `
    )
    .eq("team_id", team.id)
    .eq("season_id", selectedSeason.id)
    .eq("public_visible", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (entryError) {
    throw entryError;
  }

  const rows = entries || [];
  const athleteIds = [...new Set(rows.map((entry) => entry.athlete_id).filter(Boolean))];
  let athletes = [];
  let socialLinks = [];
  let publicProfileIds = [];

  if (athleteIds.length > 0) {
    const athleteFields = `
      id,
      athlete_profile_id,
      first_name,
      last_name,
      preferred_name,
      display_name,
      gender,
      graduation_year,
      bio,
      photo_url,
      hometown,
      college_commitment
    `;
    let athleteResult = await supabaseAdmin
      .from("team_athletes")
      .select(athleteFields)
      .eq("team_id", team.id)
      .eq("public_visible", true)
      .in("id", athleteIds);

    if (athleteResult.error && String(athleteResult.error.code || "") === "42703") {
      athleteResult = await supabaseAdmin
        .from("team_athletes")
        .select(
          `
            id,
            first_name,
            last_name,
            preferred_name,
            display_name,
            gender,
            graduation_year,
            bio,
            photo_url,
            hometown,
            college_commitment
          `
        )
        .eq("team_id", team.id)
        .eq("public_visible", true)
        .in("id", athleteIds);
    }

    const socialResult = await supabaseAdmin
      .from("athlete_social_links")
      .select("id, athlete_id, platform, label, url, verified, sort_order")
      .eq("team_id", team.id)
      .eq("published", true)
      .eq("athlete_consent_confirmed", true)
      .eq("guardian_consent_confirmed", true)
      .eq("approved_by_team", true)
      .in("athlete_id", athleteIds)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (athleteResult.error) {
      throw athleteResult.error;
    }

    if (socialResult.error) {
      throw socialResult.error;
    }

    athletes = athleteResult.data || [];
    socialLinks = socialResult.data || [];

    const profileIds = [...new Set(
      athletes.map((athlete) => athlete.athlete_profile_id).filter(Boolean)
    )];

    if (profileIds.length > 0) {
      const { data: profiles, error: profileError } = await supabaseAdmin
        .from("athlete_profiles")
        .select("id, slug, public_visible, suspended, archived_at, merged_into_profile_id")
        .in("id", profileIds);

      if (!profileError) {
        const profileMap = new Map(
          (profiles || [])
            .filter((profile) =>
              profile.public_visible &&
              !profile.suspended &&
              !profile.archived_at &&
              !profile.merged_into_profile_id
            )
            .map((profile) => [profile.id, profile])
        );

        athletes = athletes.map((athlete) => ({
          ...athlete,
          global_profile: profileMap.get(athlete.athlete_profile_id) || null
        }));
        publicProfileIds = [...profileMap.keys()];
      }
    }
  }

  const athleteMap = new Map(athletes.map((athlete) => [athlete.id, athlete]));
  const linksByAthlete = new Map();

  socialLinks.forEach((link) => {
    const current = linksByAthlete.get(link.athlete_id) || [];
    current.push(link);
    linksByAthlete.set(link.athlete_id, current);
  });

  const combined = rows
    .map((entry) => ({
      ...entry,
      athlete: athleteMap.get(entry.athlete_id) || null,
      social_links: linksByAthlete.get(entry.athlete_id) || []
    }))
    .filter((entry) => entry.athlete)
    .sort((a, b) => {
      const genderCompare = String(a.athlete.gender || "").localeCompare(String(b.athlete.gender || ""));

      if (genderCompare !== 0) {
        return genderCompare;
      }

      const gradeCompare = Number(b.grade || 0) - Number(a.grade || 0);

      if (gradeCompare !== 0) {
        return gradeCompare;
      }

      return String(a.athlete.last_name || "").localeCompare(String(b.athlete.last_name || "")) ||
        String(a.athlete.first_name || "").localeCompare(String(b.athlete.first_name || ""));
    });

  // Season leaders: never coach-authored free text -- computed only from
  // athlete_best_performances, the same SQL view the athlete profile page
  // uses for personal records (verified/source-linked, public, not
  // archived, official/reviewed only). This is each roster athlete's
  // ALL-TIME best in the season's sport, not a season-specific aggregate
  // (no such per-season query exists yet) -- an intentional reuse of
  // already-computed data rather than a new one, and an honest label on
  // the rendered section reflects that.
  let performanceLeaders = [];
  const performanceSport = seasonSportToPerformanceSport(selectedSeason.sport);

  if (publicProfileIds.length > 0 && performanceSport) {
    const { data: bestRows, error: bestError } = await supabaseAdmin
      .from("athlete_best_performances")
      .select("profile_id, event_key, event_name, measurement_type, mark_text, mark_sort_value, meet_name, meet_date")
      .in("profile_id", publicProfileIds)
      .eq("sport", performanceSport)
      .limit(2000);

    if (!bestError) {
      const genderByProfileId = new Map(
        combined
          .filter((entry) => entry.athlete?.athlete_profile_id)
          .map((entry) => [entry.athlete.athlete_profile_id, entry.athlete.gender])
      );
      const nameByProfileId = new Map(
        combined
          .filter((entry) => entry.athlete?.athlete_profile_id)
          .map((entry) => [entry.athlete.athlete_profile_id, entry.athlete])
      );
      const slugByProfileId = new Map(
        (athletes || [])
          .filter((athlete) => athlete.athlete_profile_id && athlete.global_profile?.slug)
          .map((athlete) => [athlete.athlete_profile_id, athlete.global_profile.slug])
      );
      const groups = new Map();

      (bestRows || []).forEach((row) => {
        const gender = genderByProfileId.get(row.profile_id);

        if (!gender || row.mark_sort_value === null || row.mark_sort_value === undefined) {
          return;
        }

        const groupKey = `${row.event_key}|${gender}`;
        const list = groups.get(groupKey) || [];
        list.push(row);
        groups.set(groupKey, list);
      });

      performanceLeaders = [...groups.entries()].map(([groupKey, rows]) => {
        const [eventKey, gender] = groupKey.split("|");
        const ascending = rows[0]?.measurement_type === "time";
        const ranked = rows
          .slice()
          .sort((a, b) => ascending
            ? Number(a.mark_sort_value) - Number(b.mark_sort_value)
            : Number(b.mark_sort_value) - Number(a.mark_sort_value)
          )
          .slice(0, 3)
          .map((row) => ({
            display_name: athleteDisplayName(nameByProfileId.get(row.profile_id)),
            profile_slug: slugByProfileId.get(row.profile_id) || null,
            mark_text: row.mark_text,
            meet_name: row.meet_name,
            meet_date: row.meet_date
          }));

        return {
          event_key: eventKey,
          event_name: rows[0]?.event_name || eventKey,
          gender,
          leaders: ranked
        };
      }).filter((group) => group.leaders.length > 0)
        .sort((a, b) => a.gender.localeCompare(b.gender) || a.event_name.localeCompare(b.event_name));
    }
  }

  return {
    team: {
      id: team.id,
      school_name: team.school_name,
      slug: team.slug
    },
    seasons: publicSeasons,
    selected_season: selectedSeason,
    entries: combined,
    performance_leaders: performanceLeaders
  };
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "public, max-age=30, s-maxage=60, stale-while-revalidate=300");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const body = parseBody(request);
    const team = await findPublicTeam(body);
    const data = await loadSeasonRoster(team, cleanText(body.season_id, 100));
    return response.status(200).json(data);
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Public team roster error:", error);
    }

    return response.status(status).json({
      error: status < 500
        ? error.message
        : "The team roster could not be loaded."
    });
  }
}
