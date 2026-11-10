import { wrappedPageHtml, wrappedPath, wrappedSoonHtml } from "../../lib/render/wrapped_page.mjs";
import { loadWrapped, wrappedIsLive, wrappedLaunch } from "../../lib/wrapped_service.mjs";
import { isAdminRequest } from "../../lib/admin_auth.mjs";
import { site } from "../../src/config/site.mjs";

// /wrapped/2026/{slug}/ (WO-36; vercel.json rewrite). Hidden, private,
// suspended or archived profiles get the real 404 page; a merged one 301s.
// Before the admin launch date, visitors see "coming soon" and admins see
// a preview.

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
  return response.status(404).send('<!doctype html><meta charset="utf-8"><title>Not Found | Podium Watch</title><p>Not found. <a href="/wrapped/">Find a runner</a></p>');
}

export default async function handler(request, response) {
  const slug = String(request.query?.slug || "").toLowerCase();
  if (!/^[a-z0-9-]{1,200}$/.test(slug)) return notFound(request, response);
  const admin = isAdminRequest(request);
  try {
    const [live, launchAt] = await Promise.all([wrappedIsLive(), wrappedLaunch()]);
    if (!live && !admin) {
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.setHeader("Cache-Control", "public, s-maxage=60");
      return response.status(200).send(wrappedSoonHtml(site, { pathname: wrappedPath(slug), launchAt }));
    }
    const w = await loadWrapped(slug);
    if (w?.merged) {
      if (!w.redirect_slug) return notFound(request, response);
      response.setHeader("Location", wrappedPath(w.redirect_slug));
      response.setHeader("Cache-Control", "public, s-maxage=3600");
      return response.status(301).end();
    }
    if (!w || w.private) return notFound(request, response);
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Cache-Control", admin && !live ? "private, no-store" : "public, s-maxage=900, stale-while-revalidate=86400");
    return response.status(200).send(wrappedPageHtml(site, w, { preview: !live, launchAt }));
  } catch (error) {
    console.error("Wrapped page error:", error);
    response.setHeader("Cache-Control", "no-store");
    return response.status(503).send("This Wrapped card could not be loaded right now. Please try again shortly.");
  }
}
