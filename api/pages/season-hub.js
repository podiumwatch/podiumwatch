import { seasonHubPage } from "../../src/pages/seasonhub.mjs";
import { loadSeasonHub } from "../../lib/season_hub_service.mjs";
import { HUB_STAGES, HUB_YEARS, hubPath, newestHubYear } from "../../src/config/season_hubs.mjs";
import { site } from "../../src/config/site.mjs";

// /state/YYYY/, /regionals/YYYY/, /districts/YYYY/ rendered on the server
// (vercel.json rewrites) with every official result in the HTML (WO-37).
// No year, or a year without imported results, goes to the newest year.

export default async function handler(request, response) {
  const stageKey = String(request.query?.stage || "");
  if (!HUB_STAGES[stageKey]) return response.status(404).send("Not found");
  const year = Number(request.query?.year);
  if (!(HUB_YEARS[stageKey] || []).includes(year)) {
    const newest = newestHubYear(stageKey);
    if (!newest) return response.status(404).send("Not found");
    response.setHeader("Location", hubPath(stageKey, newest));
    return response.status(request.query?.year ? 302 : 301).end();
  }
  let hub;
  try {
    hub = await loadSeasonHub({ stageKey, year });
  } catch (error) {
    console.error("Season hub error:", error);
    response.setHeader("Cache-Control", "no-store");
    return response.status(503).send("Results could not be loaded right now. Please try again shortly.");
  }
  if (!hub) return response.status(404).send("Not found");
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");
  return response.status(200).send(seasonHubPage(site, hub));
}
