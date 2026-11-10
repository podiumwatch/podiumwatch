import { runVoteSnapshots } from "../../lib/yearly_awards_2026_service.mjs";

// Every 5 minutes (vercel.json). Writes only when something is due:
// an hourly backup of each open category's vote tallies (Redis to
// Postgres, install/89), or the frozen final tallies once a category's
// voting closes (Fri Nov 13, 9:00 PM ET). Otherwise it only reads the
// category list.

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && (request.headers?.authorization || "") === `Bearer ${secret}`;
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }
  if (!authorized(request)) return response.status(401).json({ error: "Unauthorized." });
  try {
    return response.status(200).json(await runVoteSnapshots());
  } catch (error) {
    console.error("Award vote snapshot error:", error);
    return response.status(500).json({ error: "Vote snapshot failed." });
  }
}
