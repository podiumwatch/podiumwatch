import { supabaseAdmin } from "../../lib/supabase-admin.mjs";
import { calculateTeamCompletion } from "../../lib/team_audit.mjs";

function cleanSearch(value) {
  return String(value ?? "")
    .trim()
    .replace(/[^a-z0-9'&\s]/gi, " ")
    .replace(/\s+/g, " ")
    .slice(0, 100);
}

function cleanFilter(value) {
  return String(value ?? "")
    .trim()
    .replace(/[^a-z0-9'&\s]/gi, " ")
    .replace(/\s+/g, " ")
    .slice(0, 100);
}

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The submitted search is invalid.");
      error.status = 400;
      throw error;
    }
  }

  return request.body || {};
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
    const search = cleanSearch(body.search);
    const region = cleanFilter(body.region);
    const programLevel = String(body.program_level ?? "").trim();
    const programScope = String(body.program_scope ?? "").trim();
    const boysXcDivision = cleanFilter(
      body.cross_country_boys_division
    );
    const allowedLevels = new Set(["", "high_school", "middle_school", "club"]);
    const allowedScopes = new Set(["", "combined", "boys", "girls"]);

    const maxResults = 2000;
    const pageSize = 1000;
    const teams = [];
    const selectFields = `
      id,
      school_name,
      slug,
      mascot,
      city,
      state,
      conference,
      region,
      program_level,
      program_scope,
      primary_color,
      secondary_color,
      logo_url,
      banner_image_url,
      description,
      athletics_url,
      website_url,
      public_contact_email,
      head_coach,
      head_boys_coach,
      head_girls_coach,
      source_school_id,
      ohio_school_id,
      cross_country_boys_division,
      cross_country_girls_division,
      track_boys_division,
      track_girls_division,
      verified,
      social_links_verified,
      claimed_at,
      updated_at
    `;

    function buildTeamQuery(start, end) {
      let query = supabaseAdmin
        .from("team_pages")
        .select(selectFields)
        .eq("published", true)
        .eq("suspended", false)
        .is("archived_at", null)
        .is("merged_into_team_id", null)
        .order("verified", {
          ascending: false
        })
        .order("school_name", {
          ascending: true
        })
        .range(start, end);

      if (search) {
        query = query.or(
          [
            `school_name.ilike.%${search}%`,
            `city.ilike.%${search}%`,
            `mascot.ilike.%${search}%`,
            `conference.ilike.%${search}%`,
            `region.ilike.%${search}%`
          ].join(",")
        );
      }

      if (region) {
        query = query.ilike(
          "region",
          region
        );
      }

      if (
        allowedLevels.has(programLevel) &&
        programLevel
      ) {
        query = query.eq(
          "program_level",
          programLevel
        );
      }

      if (
        allowedScopes.has(programScope) &&
        programScope
      ) {
        query = query.eq(
          "program_scope",
          programScope
        );
      }

      if (boysXcDivision) {
        query = query.ilike(
          "cross_country_boys_division",
          boysXcDivision
        );
      }

      return query;
    }

    for (
      let start = 0;
      start < maxResults;
      start += pageSize
    ) {
      const end = Math.min(
        start + pageSize - 1,
        maxResults - 1
      );
      const {
        data,
        error
      } = await buildTeamQuery(
        start,
        end
      );

      if (error) {
        throw error;
      }

      const page = Array.isArray(data)
        ? data
        : [];
      teams.push(...page);

      if (page.length < pageSize) {
        break;
      }
    }

    const teamIds = teams.map((team) => team.id);
    const platformsByTeam = new Map();
    const socialLinksByTeam = new Map();
    const claimedTeamIds = new Set();

    if (teamIds.length > 0) {
      for (let index = 0; index < teamIds.length; index += 200) {
        const chunk = teamIds.slice(index, index + 200);
        const [socialResult, memberResult] = await Promise.all([
          supabaseAdmin
            .from("team_social_links")
            .select("team_id, platform, url, published, sort_order")
            .in("team_id", chunk)
            .eq("published", true)
            .order("sort_order", { ascending: true }),
          supabaseAdmin
            .from("team_members")
            .select("team_id")
            .in("team_id", chunk)
            .eq("status", "active")
        ]);

        if (socialResult.error) {
          throw socialResult.error;
        }

        if (memberResult.error) {
          throw memberResult.error;
        }

        (socialResult.data || []).forEach((link) => {
          if (!platformsByTeam.has(link.team_id)) {
            platformsByTeam.set(link.team_id, []);
            socialLinksByTeam.set(link.team_id, []);
          }

          const platforms = platformsByTeam.get(link.team_id);

          if (!platforms.includes(link.platform)) {
            platforms.push(link.platform);
          }

          socialLinksByTeam.get(link.team_id).push(link);
        });

        (memberResult.data || []).forEach((member) => {
          claimedTeamIds.add(member.team_id);
        });
      }
    }

    const results = teams.map((team) => ({
      ...team,
      claimed: claimedTeamIds.has(team.id),
      social_platforms: platformsByTeam.get(team.id) || [],
      completion_score: calculateTeamCompletion(
        team,
        socialLinksByTeam.get(team.id) || []
      )
    }));

    return response.status(200).json({
      teams: results,
      count: results.length
    });
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Team directory error:", error);
    }

    return response.status(status).json({
      error: status < 500
        ? error.message
        : "The team directory could not be loaded."
    });
  }
}
