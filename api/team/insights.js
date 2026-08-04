import { supabaseAdmin } from "../../lib/supabase-admin.mjs";
import {
  requireTeamUser,
  teamApiError
} from "../../lib/team_auth.mjs";
import {
  aggregateAnalytics,
  cleanText
} from "../../lib/engagement_service.mjs";

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The team insights request is invalid.");
      error.status = 400;
      throw error;
    }
  }

  return request.body || {};
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const user = await requireTeamUser(request);
    const body = parseBody(request);
    const teamId = cleanText(body.team_id, 100);
    const days = [7, 30, 90].includes(Number(body.days))
      ? Number(body.days)
      : 30;

    if (!teamId) {
      const error = new Error("Choose a team page.");
      error.status = 400;
      throw error;
    }

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from("team_members")
      .select("id, role, status")
      .eq("team_id", teamId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (membershipError) {
      throw membershipError;
    }

    if (!membership) {
      const error = new Error("You do not have permission to view this team's insights.");
      error.status = 403;
      throw error;
    }

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const [teamResult, analyticsResult, followerResult, eventResult, deliveryResult] = await Promise.all([
      supabaseAdmin
        .from("team_pages")
        .select("id, school_name, slug, mascot, city, state, published")
        .eq("id", teamId)
        .single(),
      supabaseAdmin
        .from("team_analytics_events")
        .select("event_type, section, visitor_id, sponsor_id, created_at")
        .eq("team_id", teamId)
        .gte("created_at", since)
        .limit(20000),
      supabaseAdmin
        .from("team_follows")
        .select("id", { count: "exact", head: true })
        .eq("team_id", teamId)
        .eq("active", true),
      supabaseAdmin
        .from("team_notification_events")
        .select("id, category, title, status, created_at, processed_at")
        .eq("team_id", teamId)
        .order("created_at", { ascending: false })
        .limit(25),
      supabaseAdmin
        .from("team_notification_deliveries")
        .select("status, delivery_type, created_at")
        .eq("team_id", teamId)
        .gte("created_at", since)
        .limit(10000)
    ]);

    for (const result of [teamResult, analyticsResult, followerResult, eventResult, deliveryResult]) {
      if (result.error) {
        throw result.error;
      }
    }

    const analytics = aggregateAnalytics(analyticsResult.data || []);
    const deliverySummary = (deliveryResult.data || []).reduce(
      (summary, row) => {
        summary[row.status] = (summary[row.status] || 0) + 1;
        return summary;
      },
      {}
    );

    return response.status(200).json({
      team: teamResult.data,
      days,
      follower_count: Number(followerResult.count) || 0,
      analytics,
      notification_events: eventResult.data || [],
      delivery_summary: deliverySummary
    });
  } catch (error) {
    return teamApiError(
      response,
      error,
      "The team insights could not be loaded."
    );
  }
}
