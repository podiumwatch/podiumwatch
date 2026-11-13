import { homePageHtml } from "../../src/pages/home.mjs";
import { homeStories } from "../../lib/home_stories.mjs";
import { getFrontPageNow, publicLead } from "../../lib/front_page_service.mjs";
import { rememberGood, sendLastGood } from "../../lib/page_cache.mjs";
import { site } from "../../src/config/site.mjs";

// The homepage, rendered on the server (vercel.json rewrite for "/"; site
// redesign step 7, 2026-11-13). The lead story an admin set is decided
// here, before the page is sent, so the first screen shows right away and
// never changes after it loads (Zachary, 2026-11-13). Stories come from
// content/stories/ (lib/home_stories.mjs). If the front page settings
// can't be read, the newest stories lead, as before. Cached at the edge for
// 60 seconds, so a lead set in admin shows within about a minute.

const ASSET_VERSION = String(process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 10) || Date.now().toString(36);
const stamp = (html) => html
  .replace(/(src="\/scripts\/[^"?]+\.m?js)(")/g, `$1?v=${ASSET_VERSION}$2`)
  .replace(/(href="\/styles\/[^"?]+\.css)(")/g, `$1?v=${ASSET_VERSION}$2`);

export default async function handler(request, response) {
  let frontPage = null;
  try {
    const now = await getFrontPageNow();
    frontPage = { lead: publicLead(now.lead), also: now.also.map(publicLead) };
  } catch (error) {
    console.error("Homepage front page settings error:", error);
  }
  let html;
  try {
    html = stamp(homePageHtml({ stories: homeStories(), frontPage, now: new Date(), site }));
  } catch (error) {
    console.error("Homepage render error:", error);
    if (sendLastGood(response, "home")) return;
    response.setHeader("Cache-Control", "no-store");
    return response.status(503).send("Podium Watch could not load right now. Please try again shortly.");
  }
  rememberGood("home", "text/html; charset=utf-8", html);
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Cache-Control", frontPage ? "public, s-maxage=60, stale-while-revalidate=300" : "public, s-maxage=15, stale-while-revalidate=60");
  return response.status(200).send(html);
}
