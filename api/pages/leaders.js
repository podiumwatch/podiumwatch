import { rankingLeadersPage, LEADERS_FIRST_VIEW } from "../../src/pages/rankingleaders.mjs";
import { getLeaders, getLeadersFilters } from "../../lib/athlete_leaders_service.mjs";
import { site } from "../../src/config/site.mjs";

// /rankings/leaders/ rendered on the server (vercel.json rewrite; site
// fixes A2, 2026-11-13). The first view (boys, all divisions, newest
// season, top 50) is in the HTML, so rows show without waiting for a
// second request. Cached at the edge for 5 minutes. If the data can't be
// read, the page renders as before and the browser loads the rows.

export default async function handler(request, response) {
  let initial = null;
  try {
    const filters = await getLeadersFilters();
    const seasonYear = filters.years[0];
    if (seasonYear) {
      const { entries, total_before_limit } = await getLeaders({ gender: "boys", seasonYear, limit: LEADERS_FIRST_VIEW });
      initial = { years: filters.years, season_year: seasonYear, entries, total_before_limit };
    }
  } catch (error) {
    console.error("State Leaders page data error:", error);
  }
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Cache-Control", initial ? "public, s-maxage=300, stale-while-revalidate=3600" : "no-store");
  return response.status(200).send(rankingLeadersPage(site, initial));
}
