import { supabaseAdmin } from "../../lib/supabase-admin.mjs";
import {
  requireTeamUser,
  teamApiError
} from "../../lib/team_auth.mjs";
import {
  handleTeamContentAction,
  parseContentBody
} from "../../lib/team_content_service.mjs";
import { queueTeamNotification } from "../../lib/engagement_service.mjs";

function cleanText(value, maxLength = 300) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const user = await requireTeamUser(request);
    const body = parseContentBody(request);
    const action = cleanText(body.action, 80).toLowerCase() || "get";
    const teamId = cleanText(body.team_id, 100);

    if (!teamId) {
      const error = new Error("Choose a team page.");
      error.status = 400;
      throw error;
    }

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from("team_members")
      .select("id, team_id, user_id, role, status, display_name")
      .eq("team_id", teamId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (membershipError) {
      throw membershipError;
    }

    if (!membership) {
      const error = new Error(
        "You do not have permission to manage this team's content."
      );
      error.status = 403;
      throw error;
    }

    const data = await handleTeamContentAction({
      teamId,
      body,
      actor: {
        type: "team_user",
        id: user.id,
        userId: user.id,
        label: membership.display_name || user.email || "Team manager",
        membership
      }
    });

    const item = data?.item;

    if (
      item &&
      item.status === "published" &&
      item.notify_followers !== false &&
      ["save_item", "change_status"].includes(action)
    ) {
      const categoryMap = {
        announcement: "announcements",
        achievement: "achievements",
        result: "results",
        coverage: "coverage",
        media: "media"
      };
      const category = categoryMap[item.content_type];

      if (category) {
        await queueTeamNotification({
          teamId,
          category,
          title: item.title,
          summary: item.summary || item.body_text || null,
          destinationUrl: `/team/?slug=${encodeURIComponent(data.team?.slug || "")}`,
          sourceType: "team_content",
          sourceId: item.id,
          dedupeKey: `content:${item.id}:${item.published_at || item.created_at}`,
          createdBy: membership.display_name || user.email || "Team manager"
        });
      }
    }

    return response.status(200).json(data);
  } catch (error) {
    return teamApiError(
      response,
      error,
      "The Team Content Hub request could not be completed."
    );
  }
}
