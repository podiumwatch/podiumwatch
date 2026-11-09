import { athletePageHtml } from "../../lib/render/athlete_page.mjs";
import { cleanSlug, loadDatabaseProfile } from "../../lib/athlete_profile_service.mjs";
import { featuredRunsFor } from "../../lib/front_page_service.mjs";
import { site } from "../../src/config/site.mjs";

// /athletes/{slug}/ rendered on the server (WO-09; vercel.json rewrite).
// A merged profile 301s to the profile it was merged into; an unknown,
// private, suspended or archived profile gets the real 404 page.

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
  return response.status(404).send('<!doctype html><meta charset="utf-8"><title>Athlete Not Found | Podium Watch</title><p>Athlete not found. <a href="/athletes/">Search athletes</a></p>');
}

export default async function handler(request, response) {
  const slug = cleanSlug(request.query?.slug);
  if (!slug) return notFound(request, response);
  let data;
  try {
    data = await loadDatabaseProfile(slug);
  } catch (error) {
    console.error("Athlete page error:", error);
    response.setHeader("Cache-Control", "no-store");
    return response.status(503).send("This athlete page could not be loaded right now. Please try again shortly.");
  }
  if (data?.merged) {
    if (!data.redirect_slug) return notFound(request, response);
    response.setHeader("Cache-Control", "public, s-maxage=3600");
    response.setHeader("Location", `/athletes/${data.redirect_slug}/`);
    return response.status(301).end();
  }
  if (!data || data.private || !data.profile) return notFound(request, response);
  // Lead stories that featured this athlete (WO-43); never blocks the page.
  try {
    data.front_page = data.profile.id ? await featuredRunsFor({ profileId: data.profile.id }) : [];
  } catch (error) {
    console.error("Athlete front page badge error:", error);
    data.front_page = [];
  }
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=86400");
  return response.status(200).send(athletePageHtml(site, data));
}
