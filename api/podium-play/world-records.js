// Public, same as the other Podium Play leaderboards -- no sign-in
// required to see the site-wide record for each game.
import { getPodiumPlayWorldRecords } from "../../lib/podium_play_service.mjs";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "public, max-age=30, s-maxage=60");

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const records = await getPodiumPlayWorldRecords();
    return response.status(200).json({ records });
  } catch (error) {
    console.error("Podium Play world records error:", error);
    return response.status(500).json({ error: "Unable to load world records right now." });
  }
}
