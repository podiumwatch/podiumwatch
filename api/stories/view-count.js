import { getStoryViewCount } from "../../lib/engagement_service.mjs";

// Public, no-login, read-only. One slug's real story_view count, read
// straight from team_analytics_events -- see getStoryViewCount for why this
// is safe to call on every article page load (a single scoped count(*),
// not a batch fetch like admin's aggregateAnalytics).

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

  const slug = String(request.query?.slug || "").trim();
  if (!slug) {
    return response.status(400).json({ error: "A slug is required." });
  }

  try {
    const views = await getStoryViewCount(slug);
    return response.status(200).json({ slug, views });
  } catch (error) {
    console.error("Story view count error:", error);
    return response.status(500).json({ error: "View count could not be loaded." });
  }
}
