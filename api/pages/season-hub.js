import { CACHE_PAGE, CACHE_API_60, rememberGood, sendLastGood } from "../../lib/page_cache.mjs";
import { seasonHubPage, hubDivisions } from "../../src/pages/seasonhub.mjs";
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
    if (sendLastGood(response, `hub:${stageKey}:${year}:${String(request.query?.division || "")}`)) return;
    response.setHeader("Cache-Control", "no-store");
    return response.status(503).send("Results could not be loaded right now. Please try again shortly.");
  }
  if (!hub) return response.status(404).send("Not found");
  // One division per page (redesign step 5): /state/2026/boys-d1/. A
  // division with no races here goes back to the main page.
  const division = String(request.query?.division || "") || null;
  if (division && !hubDivisions(hub.races).includes(division)) {
    response.setHeader("Location", hubPath(stageKey, year));
    return response.status(302).end();
  }
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  const html = seasonHubPage(site, hub, { division });
  rememberGood(`hub:${stageKey}:${year}:${division || ""}`, "text/html; charset=utf-8", html);
  response.setHeader("Cache-Control", CACHE_PAGE);
  return response.status(200).send(html);
}
