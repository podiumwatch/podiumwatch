import { supabaseAdmin } from "../../lib/supabase-admin.mjs";
import {
  requireTeamUser,
  teamApiError
} from "../../lib/team_auth.mjs";
import {
  handleTeamRosterAction,
  parseRosterBody
} from "../../lib/team_roster_service.mjs";
import { queueTeamNotification } from "../../lib/engagement_service.mjs";

function cleanText(value) {
  return String(value ?? "").trim();
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const user = await requireTeamUser(request);
    const body = parseRosterBody(request);
    const teamId = cleanText(body.team_id);

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
      const error = new Error("You do not have permission to manage this team roster.");
      error.status = 403;
      throw error;
    }

    const data = await handleTeamRosterAction({
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

    const context = data?.context || data;
    const season = context?.selected_season;
    const notificationActions = new Set([
      "save_season",
      "save_athlete",
      "remove_entry",
      "commit_import",
      "rollover"
    ]);

    if (
      notificationActions.has(String(body.action || "").toLowerCase()) &&
      season?.status === "published"
    ) {
      await queueTeamNotification({
        teamId,
        category: "roster",
        title: `${season.name || "Team roster"} was updated`,
        summary: `${context?.completion?.total || 0} athlete${context?.completion?.total === 1 ? "" : "s"} are listed.`,
        destinationUrl: `/team/?slug=${encodeURIComponent(context?.team?.slug || "")}`,
        sourceType: "team_roster",
        sourceId: season.id,
        dedupeKey: `roster:${season.id}:${new Date().toISOString().slice(0, 10)}`,
        createdBy: membership.display_name || user.email || "Team manager"
      });
    }

    return response.status(200).json(data);
  } catch (error) {
    return teamApiError(
      response,
      error,
      "The team roster request could not be completed."
    );
  }
}
