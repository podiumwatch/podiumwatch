import { supabaseAdmin } from "../../lib/supabase-admin.mjs";
import { calculateTeamCompletion } from "../../lib/team_audit.mjs";
import { loadTeamPathToState, isMissingPathToStateError } from "../../lib/path_to_state_service.mjs";

function cleanSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The submitted request is invalid.");
      error.status = 400;
      throw error;
    }
  }

  return request.body || {};
}

const PUBLIC_TEAM_FIELDS = `
  id,
  school_name,
  slug,
  ohio_school_id,
  mascot,
  city,
  state,
  zip_code,
  conference,
  region,
  program_level,
  program_scope,
  cross_country_boys_division,
  cross_country_girls_division,
  track_boys_division,
  track_girls_division,
  head_coach_setup,
  head_coach,
  head_boys_coach,
  head_girls_coach,
  assistant_coaches_text,
  public_contact_email,
  recruiting_contact_email,
  description,
  history_text,
  traditions_text,
  primary_color,
  secondary_color,
  logo_url,
  banner_image_url,
  website_url,
  athletics_url,
  links_page_url,
  recruiting_questionnaire_url,
  team_store_url,
  fundraiser_url,
  published,
  verified,
  social_links_verified,
  suspended,
  archived_at,
  merged_into_team_id,
  claimed_at,
  updated_at
`;

const PUBLIC_MEET_FIELDS = `
  id,
  name,
  slug,
  sport,
  meet_date,
  start_time,
  end_date,
  venue_name,
  address,
  city,
  state,
  zip_code,
  host_school,
  meet_type,
  division,
  results_url,
  athleticnet_url,
  milesplit_url,
  registration_url,
  official_website_url,
  google_maps_url,
  published,
  featured
`;

async function loadPublicSchedule(teamId) {
  const { data: connections, error: connectionError } = await supabaseAdmin
    .from("team_meet_connections")
    .select(
      "id, meet_id, sport_scope, program_scope, schedule_note, results_url_override, sort_order"
    )
    .eq("team_id", teamId)
    .eq("published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (connectionError) {
    throw connectionError;
  }

  const rows = connections || [];
  const meetIds = [...new Set(rows.map((item) => item.meet_id).filter(Boolean))];

  if (meetIds.length === 0) {
    return [];
  }

  const { data: meets, error: meetError } = await supabaseAdmin
    .from("meets")
    .select(PUBLIC_MEET_FIELDS)
    .in("id", meetIds)
    .eq("published", true)
    .order("meet_date", { ascending: true })
    .order("name", { ascending: true });

  if (meetError) {
    throw meetError;
  }

  const meetMap = new Map((meets || []).map((meet) => [meet.id, meet]));

  return rows
    .map((connection) => ({
      ...connection,
      meet: meetMap.get(connection.meet_id) || null
    }))
    .filter((connection) => connection.meet)
    .sort((a, b) => {
      const dateCompare = String(a.meet.meet_date || "")
        .localeCompare(String(b.meet.meet_date || ""));

      if (dateCompare !== 0) {
        return dateCompare;
      }

      return String(a.meet.name || "")
        .localeCompare(String(b.meet.name || ""));
    });
}

export default async function handler(request, response) {
  response.setHeader(
    "Cache-Control",
    "public, max-age=30, s-maxage=60, stale-while-revalidate=300"
  );

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const body = parseBody(request);
    const slug = cleanSlug(body.slug);

    if (!slug) {
      const error = new Error("Team page address is required.");
      error.status = 400;
      throw error;
    }

    const { data: requestedTeam, error: requestedError } = await supabaseAdmin
      .from("team_pages")
      .select(PUBLIC_TEAM_FIELDS)
      .ilike("slug", slug)
      .maybeSingle();

    if (requestedError) {
      throw requestedError;
    }

    if (!requestedTeam) {
      const error = new Error("This team page could not be found.");
      error.status = 404;
      throw error;
    }

    if (requestedTeam.merged_into_team_id) {
      const { data: target, error: targetError } = await supabaseAdmin
        .from("team_pages")
        .select("id, slug, school_name")
        .eq("id", requestedTeam.merged_into_team_id)
        .maybeSingle();

      if (targetError) {
        throw targetError;
      }

      if (target?.slug) {
        return response.status(200).json({
          redirected: true,
          redirect_slug: target.slug,
          redirect_team_name: target.school_name
        });
      }
    }

    if (
      requestedTeam.published !== true ||
      requestedTeam.suspended === true ||
      requestedTeam.archived_at
    ) {
      const error = new Error(
        "This team page is not published or could not be found."
      );
      error.status = 404;
      throw error;
    }

    const [socialResult, memberResult, schedule, pathToState, liveRaces] = await Promise.all([
      supabaseAdmin
        .from("team_social_links")
        .select(
          `
            id,
            platform,
            label,
            url,
            sport_scope,
            program_scope,
            verified,
            published,
            sort_order
          `
        )
        .eq("team_id", requestedTeam.id)
        .eq("published", true)
        .order("sort_order", { ascending: true })
        .order("platform", { ascending: true }),
      supabaseAdmin
        .from("team_members")
        .select("id", { count: "exact", head: true })
        .eq("team_id", requestedTeam.id)
        .eq("status", "active"),
      loadPublicSchedule(requestedTeam.id),
      // Guarded so a missing migration (install/10_PATH_TO_STATE.sql not
      // run yet) or any other Path to State failure never breaks the
      // whole team page -- it just quietly shows no roadmap section.
      loadTeamPathToState({ team: requestedTeam }).catch((error) => {
        if (isMissingPathToStateError(error)) return null;
        console.error("Path to State could not be loaded:", error);
        return null;
      }),
      // "Live Now" discovery strip (Team Workspace Phase Three) --
      // guarded the same way so a missing install/13 migration never
      // breaks the whole team page.
      supabaseAdmin
        .from("race_sessions")
        .select("id, name")
        .eq("team_id", requestedTeam.id)
        .eq("status", "live")
        .eq("spectator_visible", true)
        .then(
          ({ data, error }) => (error ? [] : data || []),
          () => []
        )
    ]);

    if (socialResult.error) {
      throw socialResult.error;
    }

    if (memberResult.error) {
      throw memberResult.error;
    }

    const socialLinks = socialResult.data || [];
    const claimed = Number(memberResult.count) > 0;

    return response.status(200).json({
      team: {
        ...requestedTeam,
        claimed,
        completion_score: calculateTeamCompletion(requestedTeam, socialLinks)
      },
      social_links: socialLinks,
      schedule,
      path_to_state: pathToState,
      live_races: liveRaces
    });
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Public team profile error:", error);
    }

    return response.status(status).json({
      error: status < 500
        ? error.message
        : "The team profile could not be loaded."
    });
  }
}
