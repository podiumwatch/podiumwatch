import { supabaseAdmin } from "../../lib/supabase-admin.mjs";
import { isAdminRequest } from "../../lib/admin_auth.mjs";
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
        conference,
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
    query = query.or(
      [
        `school_name.ilike.${pattern}`,
        `city.ilike.${pattern}`,
        `mascot.ilike.${pattern}`,
        `conference.ilike.${pattern}`,
        `slug.ilike.${pattern}`
      ].join(",")
    );
  }

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  const teams = data || [];
  const teamIds = teams.map((team) => team.id);
  let items = [];

  if (teamIds.length > 0) {
    const { data: contentData, error: contentError } = await supabaseAdmin
      .from("team_content_items")
      .select("team_id, content_type, status, featured, suspended")
      .in("team_id", teamIds);

    if (contentError) {
      throw contentError;
    }

    items = contentData || [];
  }

  const contentCounts = new Map();

  items.forEach((item) => {
    const current = contentCounts.get(item.team_id) || {
      total: 0,
      published: 0,
      draft: 0,
      archived: 0,
      featured: 0,
      suspended: 0
    };

    current.total += 1;
    current.published += item.status === "published" ? 1 : 0;
    current.draft += item.status === "draft" ? 1 : 0;
    current.archived += item.status === "archived" ? 1 : 0;
    current.featured += item.featured ? 1 : 0;
    current.suspended += item.suspended ? 1 : 0;
    contentCounts.set(item.team_id, current);
  });

  return {
    teams: teams.map((team) => ({
      ...team,
      content_counts: contentCounts.get(team.id) || {
        total: 0,
        published: 0,
        draft: 0,
        archived: 0,
        featured: 0,
        suspended: 0
      }
    })),
    count: Number(count) || teams.length,
    limited: Number(count) > limit
  };
}

async function loadOverview() {
  const { data: recent, error: recentError } = await supabaseAdmin
    .from("team_content_items")
    .select(
      `
        id,
        team_id,
        content_type,
        title,
        status,
        featured,
        suspended,
        admin_locked,
        event_date,
        created_at,
        updated_at
      `
    )
    .order("updated_at", { ascending: false })
    .limit(40);

  if (recentError) {
    throw recentError;
  }

  const rows = recent || [];
  const teamIds = [...new Set(rows.map((item) => item.team_id).filter(Boolean))];
  let teams = [];

  if (teamIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("team_pages")
      .select("id, school_name, slug")
      .in("id", teamIds);

    if (error) {
      throw error;
    }

    teams = data || [];
  }

  const teamMap = new Map(teams.map((team) => [team.id, team]));

  const { data: allItems, error: allItemsError } = await supabaseAdmin
    .from("team_content_items")
    .select("status, featured, suspended, admin_locked");

  if (allItemsError) {
    throw allItemsError;
  }

  const summary = {
    total: 0,
    published: 0,
    draft: 0,
    archived: 0,
    featured: 0,
    suspended: 0,
    locked: 0
  };

  (allItems || []).forEach((item) => {
    summary.total += 1;
    summary.published += item.status === "published" ? 1 : 0;
    summary.draft += item.status === "draft" ? 1 : 0;
    summary.archived += item.status === "archived" ? 1 : 0;
    summary.featured += item.featured ? 1 : 0;
    summary.suspended += item.suspended ? 1 : 0;
    summary.locked += item.admin_locked ? 1 : 0;
  });

  return {
    summary,
    recent: rows.map((item) => ({
      ...item,
      team: teamMap.get(item.team_id) || null
    }))
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
    const body = parseContentBody(request);
    const action = cleanText(body.action, 80).toLowerCase() || "overview";

    if (action === "overview") {
      return response.status(200).json(await loadOverview());
    }

    if (action === "search_teams") {
      return response.status(200).json(await searchTeams(body));
    }

    const teamId = cleanText(body.team_id, 100);

    if (!teamId) {
      const error = new Error("Choose a team page.");
      error.status = 400;
      throw error;
    }

    const data = await handleTeamContentAction({
      teamId,
      body,
      actor: {
        type: "admin",
        id: "Podium Watch Admin",
        userId: null,
        label: "Podium Watch Admin"
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
          createdBy: "Podium Watch Admin"
        });
      }
    }

    return response.status(200).json(data);
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Admin Team Content Hub error:", error);
    }

    return response.status(status).json({
      error:
        status < 500
          ? error.message
          : "The Team Content Hub request could not be completed."
    });
  }
}
