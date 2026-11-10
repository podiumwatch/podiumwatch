import { banquetPageHtml, banquetSlidesHtml, banquetPath } from "../../lib/render/banquet_page.mjs";
import { loadBanquetPack } from "../../lib/banquet_service.mjs";
import { placementForPath, sponsorSlotHtml } from "../../lib/site_sponsors.mjs";
import { site } from "../../src/config/site.mjs";

// /teams/{slug}/season/{year}/banquet/ and .../slides/ (WO-35; vercel.json
// rewrites). One "Presented by" placement on the /banquet/ path covers every
// team's pack; with none set, nothing shows.

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
  return response.status(404).send('<!doctype html><meta charset="utf-8"><title>Not Found | Podium Watch</title><p>Page not found. <a href="/banquet/">Find a team</a></p>');
}

export default async function handler(request, response) {
  const slug = String(request.query?.slug || "").toLowerCase();
  const year = Number(request.query?.year);
  const slides = request.query?.view === "slides";
  if (!/^[a-z0-9-]{1,200}$/.test(slug) || !Number.isInteger(year)) return notFound(request, response);
  let pack;
  try {
    pack = await loadBanquetPack(slug, year);
  } catch (error) {
    console.error("Banquet page error:", error);
    response.setHeader("Cache-Control", "no-store");
    return response.status(503).send("This Banquet Pack could not be loaded right now. Please try again shortly.");
  }
  if (pack?.merged) {
    if (!pack.redirect_slug) return notFound(request, response);
    response.setHeader("Location", `${banquetPath(pack.redirect_slug, year)}${slides ? "slides/" : ""}`);
    response.setHeader("Cache-Control", "public, s-maxage=3600");
    return response.status(301).end();
  }
  if (!pack || pack.private) return notFound(request, response);
  if (slides && !pack.eligible) {
    response.setHeader("Location", banquetPath(pack.team.slug, year));
    response.setHeader("Cache-Control", "public, s-maxage=300");
    return response.status(302).end();
  }
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  // Short cache: a coach's change shows within a minute.
  response.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=600");
  const html = slides
    ? banquetSlidesHtml(site, pack, { sponsorName: placementForPath("/banquet/")?.sponsor?.name || "" })
    : banquetPageHtml(site, pack, { sponsorHtml: sponsorSlotHtml("/banquet/") });
  return response.status(200).send(html);
}
