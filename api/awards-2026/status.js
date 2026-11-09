import { listPublicCategories, turnstileSiteKey } from "../../lib/yearly_awards_2026_service.mjs";

// Public, read-only: every 2026 Athlete, Team and Coach of the Year
// category with its status worked out from the clock, plus announced
// finalists. Never includes vote counts. Cached briefly at the edge so an
// Instagram crowd doesn't each hit the database.

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const categories = await listPublicCategories();
    response.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
    return response.status(200).json({ now: new Date().toISOString(), turnstile_site_key: turnstileSiteKey(), categories });
  } catch (error) {
    console.error("Yearly awards status error:", error);
    response.setHeader("Cache-Control", "no-store");
    return response.status(500).json({ error: "Award status could not be loaded right now." });
  }
}
