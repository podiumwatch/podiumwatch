import { CACHE_PAGE, CACHE_API_60, rememberGood, sendLastGood } from "../../lib/page_cache.mjs";
import { teamPageHtml } from "../../lib/render/team_page.mjs";
import { loadTeamPage } from "../../lib/team_page_service.mjs";
import { site } from "../../src/config/site.mjs";

// /teams/{slug}/ rendered on the server (WO-11; vercel.json rewrite).
// A merged team 301s to the team it was merged into; an unknown, private,
// suspended or archived team gets the real 404 page.

async function notFound(request, response) {
  response.setHeader("Cache-Control", "public, s-maxage=300");
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  try {
    const host = request.headers?.["x-forwarded-host"] || request.headers?.host || "www.podiumwatch.org";
    const page = await fetch(`https://${host}/404.html`);
    if (page.ok) return response.status(404).send(await page.text());
  } catch {
    // fall through
  }
  return response.status(404).send('<!doctype html><meta charset="utf-8"><title>Team Not Found | Podium Watch</title><p>Team not found. <a href="/teams/">All teams</a></p>');
}

export default async function handler(request, response) {
  const slug = String(request.query?.slug || "").toLowerCase();
  if (!/^[a-z0-9-]{1,200}$/.test(slug)) return notFound(request, response);
  let data;
  try {
    data = await loadTeamPage(slug);
  } catch (error) {
    console.error("Team page error:", error);
    if (sendLastGood(response, `team:${slug}`)) return;
    response.setHeader("Cache-Control", "no-store");
    return response.status(503).send("This team page could not be loaded right now. Please try again shortly.");
  }
  if (data?.merged) {
    if (!data.redirect_slug) return notFound(request, response);
    response.setHeader("Location", `/teams/${data.redirect_slug}/`);
    response.setHeader("Cache-Control", "public, s-maxage=3600");
    return response.status(301).end();
  }
  if (!data || data.private) return notFound(request, response);
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  const html = teamPageHtml(site, data);
  rememberGood(`team:${slug}`, "text/html; charset=utf-8", html);
  response.setHeader("Cache-Control", CACHE_PAGE);
  return response.status(200).send(html);
}
