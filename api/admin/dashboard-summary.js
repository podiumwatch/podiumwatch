import { isAdminRequest } from "../../lib/admin_auth.mjs";
import { getDashboard, summarizeDashboard } from "../../lib/operations_service.mjs";

// A narrow, admin-sidebar-sized slice of Operations Center's dashboard:
// {tasks, summary} only, not the full response (which carries meets/
// teams/content/athletes/awards/engagement/sponsors/config, hundreds of
// KB) -- the right size to fetch from every /admin/* page's sidebar for
// badges and the dashboard's needs-attention panel. Query cost is
// unchanged from getDashboard() itself in this pass (still ~24 parallel
// Supabase queries); the win here is payload size and a stable contract
// a future cheap-count-query optimization can drop behind with zero
// client changes. See docs/DECISIONS.md, 2026-08-16.
export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (!isAdminRequest(request)) {
    return response.status(401).json({
      error: "Podium Watch admin sign in required."
    });
  }

  if (!["GET", "POST"].includes(request.method)) {
    response.setHeader("Allow", "GET, POST");

    return response.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    const dashboard = await getDashboard(30);
    return response.status(200).json(summarizeDashboard(dashboard));
  } catch (error) {
    console.error("Admin dashboard summary error:", error);

    return response.status(500).json({
      error: "The dashboard summary could not be loaded."
    });
  }
}
