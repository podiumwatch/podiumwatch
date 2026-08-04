import { supabaseAdmin } from "../../lib/supabase-admin.mjs";
import { isAdminRequest } from "../../lib/admin_auth.mjs";
import {
  handleTeamRosterAction,
  parseRosterBody
} from "../../lib/team_roster_service.mjs";

function cleanText(value, maxLength = 300) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function cleanSearch(value) {
  return cleanText(value, 200)
    .replace(/[,%()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function searchTeams(body) {
  const search = cleanSearch(body.search);
  const limit = Math.max(1, Math.min(250, Number(body.limit) || 100));

  let query = supabaseAdmin
    .from("team_pages")
    .select(
      `
        id,
        school_name,
        slug,
        mascot,
        city,
        state,
        program_level,
        program_scope,
        published,
        verified,
        suspended,
        editing_locked,
        archived_at,
        merged_into_team_id
      `,
      { count: "exact" }
    )
    .is("merged_into_team_id", null)
    .order("school_name", { ascending: true })
    .limit(limit);

  if (search) {
    const pattern = `%${search}%`;
    query = query.or([
      `school_name.ilike.${pattern}`,
      `city.ilike.${pattern}`,
      `mascot.ilike.${pattern}`,
      `conference.ilike.${pattern}`,
      `slug.ilike.${pattern}`
    ].join(","));
  }

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  const teams = data || [];
  const teamIds = teams.map((team) => team.id);
  let seasons = [];

  if (teamIds.length > 0) {
    const { data: seasonData, error: seasonError } = await supabaseAdmin
      .from("team_seasons")
      .select("id, team_id, status, is_current")
      .in("team_id", teamIds);

    if (seasonError) {
      throw seasonError;
    }

    seasons = seasonData || [];
  }

  const seasonCounts = new Map();
  seasons.forEach((season) => {
    const current = seasonCounts.get(season.team_id) || {
      total: 0,
      published: 0,
      current: 0
    };
    current.total += 1;
    current.published += season.status === "published" ? 1 : 0;
    current.current += season.is_current ? 1 : 0;
    seasonCounts.set(season.team_id, current);
  });

  return {
    teams: teams.map((team) => ({
      ...team,
      season_counts: seasonCounts.get(team.id) || {
        total: 0,
        published: 0,
        current: 0
      }
    })),
    count: Number(count) || teams.length,
    limited: Number(count) > limit
  };
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (!isAdminRequest(request)) {
    return response.status(401).json({
      error: "Podium Watch admin sign in required."
    });
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const body = parseRosterBody(request);
    const action = cleanText(body.action, 80).toLowerCase() || "search_teams";

    if (action === "search_teams") {
      return response.status(200).json(await searchTeams(body));
    }

    const teamId = cleanText(body.team_id, 100);

    if (!teamId) {
      const error = new Error("Choose a team page.");
      error.status = 400;
      throw error;
    }

    const data = await handleTeamRosterAction({
      teamId,
      body,
      actor: {
        type: "admin",
        id: "Podium Watch Admin",
        userId: null,
        label: "Podium Watch Admin"
      }
    });

    return response.status(200).json(data);
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Admin team roster error:", error);
    }

    return response.status(status).json({
      error: status < 500
        ? error.message
        : "The team roster request could not be completed."
    });
  }
}
