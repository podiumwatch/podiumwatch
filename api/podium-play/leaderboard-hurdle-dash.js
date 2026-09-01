// Public, same as the points leaderboard -- no sign-in required to view
// who has the best/furthest real Hurdle Dash distance.
import { getHurdleDashDistanceLeaderboard } from "../../lib/podium_play_service.mjs";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "public, max-age=30, s-maxage=60");

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const limit = Number(request.query?.limit) || 5;
    const leaders = await getHurdleDashDistanceLeaderboard(limit);
    return response.status(200).json({ leaders });
  } catch (error) {
    console.error("Hurdle Dash distance leaderboard error:", error);
    return response.status(500).json({ error: "Unable to load the Hurdle Dash leaderboard right now." });
  }
}
