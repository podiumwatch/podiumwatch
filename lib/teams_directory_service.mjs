import { supabaseAdmin } from "./supabase-admin.mjs";

// Every published team for the /teams/ directory (site redesign step 2):
// one small row per team, the same "published" rules as /api/teams/. Kept
// 5 minutes per server instance; the page itself is edge-cached too.
const FIELDS = "id, school_name, slug, mascot, city, conference, region, logo_url, primary_color, cross_country_boys_division, cross_country_girls_division";
const CACHE_MS = 5 * 60 * 1000;
let cache = null;

export async function loadDirectoryTeams({ now = Date.now() } = {}) {
  if (cache && now - cache.at < CACHE_MS) return cache.teams;
  const teams = [];
  for (let start = 0; start < 5000; start += 1000) {
    const { data, error } = await supabaseAdmin
      .from("team_pages")
      .select(FIELDS)
      .eq("published", true)
      .eq("suspended", false)
      .is("archived_at", null)
      .is("merged_into_team_id", null)
      .order("school_name", { ascending: true })
      .order("id", { ascending: true })
      .range(start, start + 999);
    if (error) throw error;
    teams.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  cache = { at: now, teams };
  return teams;
}
