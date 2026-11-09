import { storyFrontPageRuns } from "../../lib/front_page_service.mjs";

// Public: when a story ran as the front page lead (WO-43), for the
// "On the Podium Watch front page, Nov 9 to Nov 11, 2026" line and the
// share card buttons on the story page. GET ?slug=
export default async function handler(request, response) {
  const slug = String(request.query?.slug || "");
  if (!/^[a-z0-9-]{1,200}$/.test(slug)) return response.status(400).json({ error: "Missing story." });
  try {
    const runs = await storyFrontPageRuns(slug);
    response.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=600");
    return response.status(200).json({ runs });
  } catch (error) {
    console.error("Front page story runs error:", error);
    response.setHeader("Cache-Control", "no-store");
    return response.status(200).json({ runs: [] });
  }
}
