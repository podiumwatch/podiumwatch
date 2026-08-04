import { supabaseAdmin } from "../../lib/supabase-admin.mjs";
import {
  cleanText,
  getEngagementSettings,
  loadSponsorPlacements
} from "../../lib/engagement_service.mjs";

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The engagement request is invalid.");
      error.status = 400;
      throw error;
    }
  }

  return request.body || {};
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const body = parseBody(request);
    const slug = cleanText(body.slug, 300);
    const page = cleanText(body.page, 80) || "team";
    const settings = await getEngagementSettings();
    let team = null;

    if (slug) {
      const { data, error } = await supabaseAdmin
        .from("team_pages")
        .select("id, school_name, slug, mascot, city, state")
        .eq("slug", slug)
        .eq("published", true)
        .eq("suspended", false)
        .is("archived_at", null)
        .is("merged_into_team_id", null)
        .maybeSingle();

      if (error) {
        throw error;
      }

      team = data;
    }

    const placementTypes = page === "directory"
      ? ["directory"]
      : ["team_profile", "schedule", "roster", "results"];

    const placements = await loadSponsorPlacements({
      teamId: team?.id || null,
      placementTypes
    });

    let followerCount = 0;

    if (team) {
      const { count, error } = await supabaseAdmin
        .from("team_follows")
        .select("id", { count: "exact", head: true })
        .eq("team_id", team.id)
        .eq("active", true);

      if (error) {
        throw error;
      }

      followerCount = Number(count) || 0;
    }

    return response.status(200).json({
      team,
      follower_count: followerCount,
      following_enabled:
        Boolean(settings.public_following_enabled) &&
        settings.notification_mode !== "paused" &&
        Boolean(process.env.RESEND_API_KEY) &&
        Boolean(process.env.RESEND_FROM_EMAIL),
      notification_mode:
        settings.notification_mode === "live" ? "live" : "testing",
      analytics_enabled: Boolean(settings.analytics_enabled),
      sponsor_display_enabled: Boolean(settings.sponsor_display_enabled),
      placements
    });
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Public engagement data error:", error);
    }

    return response.status(status).json({
      error: status < 500 ? error.message : "Engagement information could not be loaded."
    });
  }
}
