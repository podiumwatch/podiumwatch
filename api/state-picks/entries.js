import { listEntries } from "../../lib/state_picks_service.mjs";

// Public, read-only. Before the lock: only the number of entries. After the
// first race starts: every entry and the per-race tally. Cached briefly at
// the edge so a crowd refreshing the page doesn't each hit the database.

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const result = await listEntries();
    response.setHeader("Cache-Control", "public, s-maxage=20, stale-while-revalidate=40");
    return response.status(200).json(result);
  } catch (error) {
    console.error("State picks list error:", error);
    response.setHeader("Cache-Control", "no-store");
    return response.status(500).json({ error: "Picks could not be loaded right now." });
  }
}
