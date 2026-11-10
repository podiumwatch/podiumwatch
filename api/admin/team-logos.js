import { isAdminRequest } from "../../lib/admin_auth.mjs";
import { adminLogoState, assignPoolLogo, searchTeamsForLogo } from "../../lib/team_logo_service.mjs";

// Admin only: Logo Review (WO-11). POST actions: state, search (team
// picker), assign (set a team's logo from a pool file; logged).

function bodyOf(request) {
  if (typeof request.body === "string") { try { return JSON.parse(request.body); } catch { return {}; } }
  return request.body || {};
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!isAdminRequest(request)) return response.status(401).json({ error: "Podium Watch admin sign in required." });
  if (request.method !== "POST") { response.setHeader("Allow", "POST"); return response.status(405).json({ error: "Method not allowed." }); }
  try {
    const body = bodyOf(request);
    const action = String(body.action || "state");
    if (action === "state") return response.status(200).json(await adminLogoState());
    if (action === "search") return response.status(200).json({ teams: await searchTeamsForLogo(body.query) });
    if (action === "assign") return response.status(200).json(await assignPoolLogo({ teamId: body.team_id, poolKey: body.pool_key }));
    return response.status(400).json({ error: "Unsupported action." });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("Logo review error:", error);
    return response.status(status).json({ error: status < 500 ? error.message : "That logo action could not be completed." });
  }
}
