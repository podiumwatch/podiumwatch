import { isAdminRequest } from "../../lib/admin_auth.mjs";
import { getLivePresence } from "../../lib/engagement_service.mjs";

// A dedicated, deliberately small endpoint rather than another action on
// api/admin/engagement.js -- the Engagement Center's dashboard fires 8
// parallel Supabase queries per load (see getDashboard() there), which is
// fine for a page that loads once, but this one is meant to be polled
// every few seconds while the "Live now" tab is open, so it stays a
// single indexed query.
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

  try {
    const result = await getLivePresence({ windowSeconds: 90 });
    return response.status(200).json(result);
  } catch (error) {
    console.error("Admin presence error:", error);
    return response.status(500).json({
      error: "The live activity request could not be completed."
    });
  }
}
