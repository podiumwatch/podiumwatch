// Public -- no My Podium sign-in required to VIEW the leaderboard, only
// to appear on it. Anonymous visitors and signed-in visitors alike can
// see who's on top; only a signed-in account's own real, server-
// validated points ever get submitted to it (see submit.js).
import { getPodiumPlayLeaderboard } from "../../lib/podium_play_service.mjs";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "public, max-age=30, s-maxage=60");

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const limit = Number(request.query?.limit) || 10;
    const leaders = await getPodiumPlayLeaderboard(limit);
    return response.status(200).json({ leaders });
  } catch (error) {
    console.error("Podium Play leaderboard error:", error);
    return response.status(500).json({ error: "Unable to load the Podium Play leaderboard right now." });
  }
}
