import { supabaseAdmin } from "../../lib/supabase-admin.mjs";
import { featuredRunsFor } from "../../lib/front_page_service.mjs";

// Public: front page lead stories that featured a team (WO-43), for the
// "Featured on the Podium Watch front page" line on team pages (team
// pages render in the browser). Athlete pages get it server-side.
// GET ?team=<team page slug>
export default async function handler(request, response) {
  const slug = String(request.query?.team || "");
  if (!/^[a-z0-9-]{1,200}$/.test(slug)) return response.status(400).json({ error: "Missing team." });
  try {
    const { data: team } = await supabaseAdmin.from("team_pages").select("id").eq("slug", slug).maybeSingle();
    const stories = team ? await featuredRunsFor({ teamId: team.id }) : [];
    response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=900");
    return response.status(200).json({ stories });
  } catch (error) {
    console.error("Front page featured error:", error);
    return response.status(200).json({ stories: [] });
  }
}
