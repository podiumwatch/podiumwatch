import { isAdminRequest } from "../../lib/admin_auth.mjs";

// Admin "Live now" (Engagement Center). Presence is turned off
// (2026-11-10): a heartbeat from every open tab cost Redis commands, and
// Redis holds the award votes. Nothing is recorded any more, so this
// answers without touching Redis and the admin tab says it is off.
export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (!isAdminRequest(request)) {
    return response.status(401).json({
      error: "Podium Watch admin sign in required."
    });
  }

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

  return response.status(200).json({ disabled: true, generated_at: new Date().toISOString(), total_active: 0, unique_visitors: 0, pages: [] });
}
