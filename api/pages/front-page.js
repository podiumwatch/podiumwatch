import { CACHE_PAGE, CACHE_API_60, rememberGood, sendLastGood } from "../../lib/page_cache.mjs";
import { frontPageArchivePage } from "../../src/pages/frontpagearchive.mjs";
import { frontPageArchive, getCurrentLead } from "../../lib/front_page_service.mjs";
import { site } from "../../src/config/site.mjs";

// /front-page/ (archive of every lead story) and /front (302 to today's
// lead story, or to the archive when no lead is set). WO-43.

export default async function handler(request, response) {
  if (request.query?.go) {
    try {
      const lead = await getCurrentLead();
      response.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
      response.setHeader("Location", lead ? `/stories/${lead.story_slug}/?utm_source=front_link&utm_medium=short_link` : "/front-page/");
    } catch {
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Location", "/");
    }
    return response.status(302).end();
  }
  let entries = [];
  try {
    entries = await frontPageArchive();
  } catch (error) {
    console.error("Front page archive error:", error);
    if (sendLastGood(response, "front-page")) return;
    response.setHeader("Cache-Control", "no-store");
    return response.status(503).send("The front page archive could not be loaded right now. Please try again shortly.");
  }
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  const html = frontPageArchivePage(site, entries);
  rememberGood("front-page", "text/html; charset=utf-8", html);
  response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
  return response.status(200).send(html);
}
