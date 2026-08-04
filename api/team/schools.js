import { supabaseAdmin } from "../../lib/supabase-admin.mjs";
import {
  requireTeamUser,
  teamApiError
} from "../../lib/team_auth.mjs";

function cleanText(value) {
  return String(value ?? "")
    .trim()
    .replace(/[%_,()]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 100);
}

function parseBody(request) {
  if (typeof request.body === "string") {
    return JSON.parse(request.body);
  }

  return request.body || {};
}

export default async function handler(
  request,
  response
) {
  response.setHeader(
    "Cache-Control",
    "no-store"
  );

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");

    return response.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    await requireTeamUser(request);

    const body = parseBody(request);
    const query = cleanText(body.query);

    if (!query) {
      const error = new Error(
        "Enter a school, city, or mascot."
      );

      error.status = 400;
      throw error;
    }

    const {
      data: teams,
      error
    } = await supabaseAdmin
      .from("team_pages")
      .select(
        "id, school_name, slug, mascot, city, state, conference, region, program_level, program_scope, published, verified, suspended"
      )
      .eq("suspended", false)
      .is("archived_at", null)
      .is("merged_into_team_id", null)
      .or(
        "school_name.ilike.%" +
        query +
        "%,city.ilike.%" +
        query +
        "%,mascot.ilike.%" +
        query +
        "%,slug.ilike.%" +
        query +
        "%"
      )
      .order("school_name", {
        ascending: true
      })
      .limit(40);

    if (error) {
      throw error;
    }

    const teamIds = (teams || []).map(
      (team) => team.id
    );

    let claimedTeamIds = new Set();

    if (teamIds.length > 0) {
      const {
        data: members,
        error: memberError
      } = await supabaseAdmin
        .from("team_members")
        .select("team_id")
        .in("team_id", teamIds)
        .eq("status", "active");

      if (memberError) {
        throw memberError;
      }

      claimedTeamIds = new Set(
        (members || []).map(
          (member) => member.team_id
        )
      );
    }

    return response.status(200).json({
      teams: (teams || []).map(
        (team) => ({
          ...team,
          claimed:
            claimedTeamIds.has(
              team.id
            )
        })
      )
    });
  } catch (error) {
    return teamApiError(
      response,
      error,
      "Unable to search for schools."
    );
  }
}