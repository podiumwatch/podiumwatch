import { CACHE_PAGE, CACHE_API_60, rememberGood, sendLastGood } from "../../lib/page_cache.mjs";
import { commitmentsPage } from "../../src/pages/commitments.mjs";
import { COMMITMENT_CLASSES } from "../../src/lib/commitment_rows.mjs";
import { listCommitments } from "../../lib/commitments_service.mjs";
import { site } from "../../src/config/site.mjs";

// /commitments/YYYY/ rendered on the server (vercel.json rewrite) with the
// class's public, sourced commitments in the HTML. Unknown class years 404.

export default async function handler(request, response) {
  const classYear = Number(request.query?.class);
  if (!COMMITMENT_CLASSES.includes(classYear)) {
    response.setHeader("Location", `/commitments/${COMMITMENT_CLASSES[0]}/`);
    return response.status(302).end();
  }
  let rows = [];
  try {
    rows = await listCommitments({ classYear });
  } catch (error) {
    console.error("Commitments page error:", error);
    if (sendLastGood(response, `commitments:${classYear}`)) return;
    response.setHeader("Cache-Control", "no-store");
    return response.status(503).send("Commitments could not be loaded right now. Please try again shortly.");
  }
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  const html = commitmentsPage(site, classYear, COMMITMENT_CLASSES, rows);
  rememberGood(`commitments:${classYear}`, "text/html; charset=utf-8", html);
  response.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=86400");
  return response.status(200).send(html);
}
