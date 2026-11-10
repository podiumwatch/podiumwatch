import pool from "../../public/data/yearly-awards-2026-pool.json" with { type: "json" };
import { yearlyAwardsCategoryPage } from "../../src/pages/yearlyawards2026.mjs";
import { CATEGORY_SLUG, categoryPath, finalistPath, findFinalist, shareImageUrl, shareMeta, finalistSlugs } from "../../lib/awards_share.mjs";
import { loadShareCategory } from "../../lib/awards_share_service.mjs";
import { site } from "../../src/config/site.mjs";

// /awards/2026/{category}/ and /awards/2026/{category}/{finalist}/
// (vercel.json rewrites; 2026-11-10). The category page is the same page
// the static build used to write; it is rendered here so its share tags
// (og/twitter title, description, 1200x630 image) follow the real
// finalists and switch to the winner on their own. A finalist link gets
// their own preview and opens the category page scrolled to them.
// If the finalists can't be loaded, the page still works with the plain
// category tags.

const ASSET_VERSION = String(process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 10) || Date.now().toString(36);

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
  return response.status(404).send('<!doctype html><meta charset="utf-8"><title>Not Found | Podium Watch</title><p>Not found. <a href="/awards/2026/">See all award categories</a></p>');
}

export default async function handler(request, response) {
  const slug = String(request.query?.category || "").toLowerCase();
  const finalistSlug = String(request.query?.finalist || "").toLowerCase();
  const poolCategory = CATEGORY_SLUG.test(slug) ? pool.categories.find((item) => item.slug === slug) : null;
  if (!poolCategory || (finalistSlug && !/^[a-z0-9-]{1,100}$/.test(finalistSlug))) return notFound(request, response);

  let share = null;
  try {
    const data = await loadShareCategory(slug);
    if (data) {
      const row = finalistSlug ? findFinalist(data.finalists, finalistSlug) : null;
      if (finalistSlug && !row) {
        // Not (or no longer) a finalist here: the category page.
        response.setHeader("Location", categoryPath(slug));
        response.setHeader("Cache-Control", "public, s-maxage=300");
        return response.status(302).end();
      }
      const finalist = row ? data.share.finalists.find((item) => item.key === row.nominee_key) : null;
      if (finalistSlug && !finalist) {
        // A finalist row before finalists are announced: nothing to show yet.
        response.setHeader("Location", categoryPath(slug));
        response.setHeader("Cache-Control", "public, s-maxage=60");
        return response.status(302).end();
      }
      const meta = shareMeta(data.category, data.share, finalist);
      share = {
        ...meta,
        image: shareImageUrl(site.siteUrl, data.category, data.share, finalist),
        ...(finalist ? { url: `${site.siteUrl}${finalistPath(slug, finalistSlugs(data.finalists).get(finalist.key))}`, robots: "noindex, follow", focus: finalistSlug } : {})
      };
    }
  } catch (error) {
    console.error("Awards share data error:", error);
  }

  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Cache-Control", share ? "public, s-maxage=300, stale-while-revalidate=3600" : "public, s-maxage=60");
  return response.status(200).send(yearlyAwardsCategoryPage(site, pool, poolCategory, { share, assetVersion: ASSET_VERSION }));
}
