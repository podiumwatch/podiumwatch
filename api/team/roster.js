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
import {
  generateInvite,
  listInvitesForAthlete,
  revokeInvite,
  revokeAthleteAccess
} from "../../lib/athlete_access_service.mjs";
import {
  generateInvite as generateGuardianInvite,
  listInvitesForAthlete as listGuardianInvitesForAthlete,
  revokeInvite as revokeGuardianInvite,
  revokeGuardianAccess
} from "../../lib/guardian_access_service.mjs";

// Athlete-invite actions are handled here directly, before falling
// through to handleTeamRosterAction() -- kept out of the 1700+ line
// lib/team_roster_service.mjs entirely, in its own service file
// (lib/athlete_access_service.mjs), rather than adding a new dispatch
// branch to an already-large, unrelated action dispatcher.
const ATHLETE_ACCESS_ACTIONS = new Set([
  "invite_athlete",
  "list_athlete_invites",
  "revoke_athlete_invite",
  "revoke_athlete_access"
]);

// Team Workspace Phase Three's guardian tier -- same reasoning as
// ATHLETE_ACCESS_ACTIONS above, kept in lib/guardian_access_service.mjs
// rather than lib/team_roster_service.mjs.
const GUARDIAN_ACCESS_ACTIONS = new Set([
  "invite_guardian",
  "list_guardian_invites",
  "revoke_guardian_invite",
  "revoke_guardian_access"
]);

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

    const action = cleanText(body.action).toLowerCase();

    if (ATHLETE_ACCESS_ACTIONS.has(action)) {
      const actorUserId = user.id;
      let athleteData;

      if (action === "invite_athlete") {
        athleteData = await generateInvite({
          teamId,
          teamAthleteId: body.team_athlete_id,
          invitedEmail: body.invited_email,
          invitedName: body.invited_name,
          actor: { userId: actorUserId }
        });
      } else if (action === "list_athlete_invites") {
        athleteData = { invites: await listInvitesForAthlete({ teamId, teamAthleteId: body.team_athlete_id }) };
      } else if (action === "revoke_athlete_invite") {
        athleteData = { invite: await revokeInvite({ teamId, inviteId: body.invite_id, actorUserId }) };
      } else if (action === "revoke_athlete_access") {
        athleteData = { revoked: await revokeAthleteAccess({ teamId, teamAthleteId: body.team_athlete_id, actorUserId }) };
      }

      return response.status(200).json(athleteData);
    }

    if (GUARDIAN_ACCESS_ACTIONS.has(action)) {
      const actorUserId = user.id;
      let guardianData;

      if (action === "invite_guardian") {
        guardianData = await generateGuardianInvite({
          teamId,
          teamAthleteId: body.team_athlete_id,
          invitedEmail: body.invited_email,
          invitedName: body.invited_name,
          actor: { userId: actorUserId }
        });
      } else if (action === "list_guardian_invites") {
        guardianData = { invites: await listGuardianInvitesForAthlete({ teamId, teamAthleteId: body.team_athlete_id }) };
      } else if (action === "revoke_guardian_invite") {
        guardianData = { invite: await revokeGuardianInvite({ teamId, inviteId: body.invite_id, actorUserId }) };
      } else if (action === "revoke_guardian_access") {
        // Scoped to a single invite/guardian, not the whole athlete --
        // see lib/guardian_access_service.mjs's revokeGuardianAccess()
        // header comment for why (more than one guardian per athlete is
        // the normal case).
        guardianData = { revoked: await revokeGuardianAccess({ teamId, inviteId: body.invite_id, actorUserId }) };
      }

      return response.status(200).json(guardianData);
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
