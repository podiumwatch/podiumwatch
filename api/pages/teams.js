import { teamsDirectoryPage, cleanTeamFilters } from "../../src/pages/teamsdirectory.mjs";
import { loadDirectoryTeams } from "../../lib/teams_directory_service.mjs";
import { teamColor } from "../../lib/team_colors.mjs";
import { site } from "../../src/config/site.mjs";
import champions from "../../src/data/state-champions-2026.json" with { type: "json" };

// /teams/ rendered on the server (vercel.json rewrite; site redesign
// step 2). Search and filters come from the address (?search=, ?d=,
// ?region=), so every filtered view is a shareable URL. Edge-cached.
export default async function handler(request, response) {
  const filters = cleanTeamFilters(request.query || Object.fromEntries(new URL(request.url, "http://x").searchParams));
  let teams;
  try {
    teams = await loadDirectoryTeams();
  } catch (error) {
    console.error("Teams directory data error:", error);
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    return response.status(503).send(teamsDirectoryPage(site, { teams: [], filters, champions: null, colorOf: teamColor, unavailable: true }));
  }
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
  return response.status(200).send(teamsDirectoryPage(site, { teams, filters, champions, colorOf: teamColor }));
}
