import { isAdminRequest } from "../../lib/admin_auth.mjs";
import { setWrappedLaunch, wrappedIsLive, wrappedLaunch } from "../../lib/wrapped_service.mjs";

// Admin only: Podium Watch Wrapped launch date (WO-36).
// POST { action: "state" } or { action: "set", launch_at: ISO | null }.
export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!isAdminRequest(request)) return response.status(401).json({ error: "Podium Watch admin sign in required." });
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }
  try {
    const body = typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body || {};
    if (body.action === "set") await setWrappedLaunch(body.launch_at || null);
    const launchAt = await wrappedLaunch({ fresh: true }); const live = Boolean(launchAt) && new Date(launchAt).getTime() <= Date.now();
    return response.status(200).json({ launch_at: launchAt, live });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("Wrapped admin error:", error);
    return response.status(status).json({ error: status < 500 ? error.message : "The launch date could not be saved." });
  }
}
