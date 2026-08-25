import { supabaseAdmin } from "../../lib/supabase-admin.mjs";
import {
  requireTeamUser,
  teamApiError
} from "../../lib/team_auth.mjs";
import {
  calculateTeamCompletion
} from "../../lib/team_audit.mjs";
import {
  getNextRacesForTeams
} from "../../lib/team_workspace_service.mjs";

export default async function handler(
  request,
  response
) {
  response.setHeader(
    "Cache-Control",
    "no-store"
  );

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");

    return response.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    const user =
      await requireTeamUser(request);

    const {
      data: memberships,
      error: membershipError
    } = await supabaseAdmin
      .from("team_members")
      .select(
        "id, team_id, role, status, display_name"
      )
      .eq("user_id", user.id)
      .eq("status", "active");

    if (membershipError) {
      throw membershipError;
    }

    const teamIds = [
      ...new Set(
        (memberships || []).map(
          (membership) =>
            membership.team_id
        )
      )
    ];

    let teams = [];

    if (teamIds.length > 0) {
      const {
        data: teamRows,
        error: teamError
      } = await supabaseAdmin
        .from("team_pages")
        .select("*")
        .in("id", teamIds)
        .order("school_name", {
          ascending: true
        });

      if (teamError) {
        throw teamError;
      }

      const {
        data: socialRows,
        error: socialError
      } = await supabaseAdmin
        .from("team_social_links")
        .select("*")
        .in("team_id", teamIds)
        .order("sort_order", {
          ascending: true
        })
        .order("platform", {
          ascending: true
        });

      if (socialError) {
        throw socialError;
      }

      const membershipByTeam =
        new Map(
          (memberships || []).map(
            (membership) => [
              membership.team_id,
              membership
            ]
          )
        );

      // Powers the "your race is live right now" banner on
      // /team-dashboard/ -- the actual first screen a coach sees after
      // signing in, so this needs to be unmissable on race day rather
      // than requiring a click into Team Home first.
      const nextRaceByTeam =
        await getNextRacesForTeams(teamIds);

      // Bulk existence check for calculateTeamCompletion()'s
      // roster/schedule signals -- a coach's own "my teams" list is
      // always small, so one un-chunked query each is fine (contrast
      // with api/teams/index.js's public directory, which chunks by
      // 200 for potentially hundreds of teams at once).
      const [scheduleSignalResult, rosterSignalResult] = await Promise.all([
        supabaseAdmin
          .from("team_meet_connections")
          .select("team_id")
          .in("team_id", teamIds)
          .eq("published", true),
        supabaseAdmin
          .from("team_seasons")
          .select("team_id")
          .in("team_id", teamIds)
          .in("status", ["published", "archived"])
      ]);

      if (scheduleSignalResult.error) {
        throw scheduleSignalResult.error;
      }

      if (rosterSignalResult.error) {
        throw rosterSignalResult.error;
      }

      const scheduledTeamIds = new Set(
        (scheduleSignalResult.data || []).map((row) => row.team_id)
      );
      const rosteredTeamIds = new Set(
        (rosterSignalResult.data || []).map((row) => row.team_id)
      );

      const socialByTeam = new Map();

      (socialRows || []).forEach(
        (link) => {
          if (
            !socialByTeam.has(
              link.team_id
            )
          ) {
            socialByTeam.set(
              link.team_id,
              []
            );
          }

          socialByTeam
            .get(link.team_id)
            .push(link);
        }
      );

      teams = (teamRows || []).map(
        (team) => ({
          ...team,
          membership:
            membershipByTeam.get(
              team.id
            ) || null,
          social_links:
            socialByTeam.get(
              team.id
            ) || [],
          completion_score:
            calculateTeamCompletion(
              team,
              socialByTeam.get(
                team.id
              ) || [],
              {
                hasPublishedSchedule: scheduledTeamIds.has(team.id),
                hasPublishedRoster: rosteredTeamIds.has(team.id)
              }
            ),
          next_race:
            nextRaceByTeam.get(
              team.id
            ) || null
        })
      );
    }

    const ownerTeamIds = (memberships || [])
      .filter(
        (membership) =>
          membership.role === "owner" &&
          membership.status === "active"
      )
      .map((membership) => membership.team_id);

    let teamAccess = [];

    if (ownerTeamIds.length > 0) {
      const [memberResult, pendingClaimResult] = await Promise.all([
        supabaseAdmin
          .from("team_members")
          .select(
            "id, team_id, user_id, role, status, display_name, created_at, updated_at"
          )
          .in("team_id", ownerTeamIds)
          .eq("status", "active")
          .order("role", {
            ascending: true
          })
          .order("created_at", {
            ascending: true
          }),
        supabaseAdmin
          .from("team_claim_requests")
          .select(
            "id, team_id, user_id, requester_name, requester_email, requester_role, message, status, created_at"
          )
          .in("team_id", ownerTeamIds)
          .eq("status", "pending")
          .order("created_at", {
            ascending: true
          })
      ]);

      if (memberResult.error) {
        throw memberResult.error;
      }

      if (pendingClaimResult.error) {
        throw pendingClaimResult.error;
      }

      const enrichedMembers = await Promise.all(
        (memberResult.data || []).map(
          async (member) => {
            try {
              const {
                data,
                error
              } = await supabaseAdmin.auth.admin.getUserById(
                member.user_id
              );

              if (error) {
                throw error;
              }

              return {
                ...member,
                email:
                  data.user?.email || "",
                account_display_name:
                  data.user?.user_metadata
                    ?.display_name ||
                  data.user?.user_metadata
                    ?.full_name ||
                  ""
              };
            } catch {
              return {
                ...member,
                email: "",
                account_display_name: ""
              };
            }
          }
        )
      );

      const membersByTeam = new Map();
      const claimsByTeam = new Map();
      const teamById = new Map(
        teams.map((team) => [
          team.id,
          team
        ])
      );

      enrichedMembers.forEach((member) => {
        if (!membersByTeam.has(member.team_id)) {
          membersByTeam.set(member.team_id, []);
        }

        membersByTeam
          .get(member.team_id)
          .push(member);
      });

      (pendingClaimResult.data || []).forEach((claim) => {
        if (!claimsByTeam.has(claim.team_id)) {
          claimsByTeam.set(claim.team_id, []);
        }

        claimsByTeam
          .get(claim.team_id)
          .push(claim);
      });

      teamAccess = ownerTeamIds.map((teamId) => ({
        team_id: teamId,
        school_name:
          teamById.get(teamId)?.school_name ||
          "Team page",
        slug:
          teamById.get(teamId)?.slug ||
          "",
        members:
          membersByTeam.get(teamId) || [],
        pending_claims:
          claimsByTeam.get(teamId) || []
      }));
    }

    const {
      data: claims,
      error: claimError
    } = await supabaseAdmin
      .from("team_claim_requests")
      .select(
        "id, team_id, requested_school_name, requested_city, requester_role, status, created_at, review_notes"
      )
      .eq("user_id", user.id)
      .order("created_at", {
        ascending: false
      });

    if (claimError) {
      throw claimError;
    }

    return response.status(200).json({
      user: {
        id: user.id,
        email: user.email || "",
        display_name:
          user.user_metadata
            ?.display_name || ""
      },
      teams,
      claims: claims || [],
      team_access: teamAccess
    });
  } catch (error) {
    return teamApiError(
      response,
      error,
      "Unable to load your team account."
    );
  }
}