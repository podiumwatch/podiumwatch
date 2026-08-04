import { supabaseAdmin } from "../../lib/supabase-admin.mjs";

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
      const error = new Error("The submitted content request is invalid.");
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
  published,
  suspended,
  archived_at,
  merged_into_team_id,
  public_contact_email,
  recruiting_contact_email,
  recruiting_questionnaire_url,
  website_url,
  athletics_url,
  links_page_url,
  team_store_url,
  fundraiser_url,
  head_coach_setup,
  head_coach,
  head_boys_coach,
  head_girls_coach
`;

const PUBLIC_CONTENT_FIELDS = `
  id,
  content_type,
  title,
  summary,
  body_text,
  event_date,
  season_label,
  sport_scope,
  program_scope,
  meet_name,
  result_place,
  result_score,
  url,
  cta_label,
  image_url,
  video_url,
  media_kind,
  photographer_name,
  photographer_url,
  source_name,
  featured,
  featured_rank,
  sort_order,
  published_at,
  created_at,
  updated_at
`;

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

    const { data: requestedTeam, error: teamError } = await supabaseAdmin
      .from("team_pages")
      .select(PUBLIC_TEAM_FIELDS)
      .ilike("slug", slug)
      .maybeSingle();

    if (teamError) {
      throw teamError;
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

    const { data: items, error: contentError } = await supabaseAdmin
      .from("team_content_items")
      .select(PUBLIC_CONTENT_FIELDS)
      .eq("team_id", requestedTeam.id)
      .eq("status", "published")
      .eq("suspended", false)
      .order("featured", { ascending: false })
      .order("featured_rank", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("event_date", { ascending: false, nullsFirst: false })
      .order("published_at", { ascending: false, nullsFirst: false });

    if (contentError) {
      throw contentError;
    }

    return response.status(200).json({
      team: requestedTeam,
      items: items || []
    });
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Public Team Content Hub error:", error);
    }

    return response.status(status).json({
      error:
        status < 500
          ? error.message
          : "The team content could not be loaded."
    });
  }
}
