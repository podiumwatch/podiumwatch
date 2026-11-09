import { isAdminRequest } from "../../lib/admin_auth.mjs";
import { adminFrontPageState, editLead, endOrCancelLead, isMissingFrontPageTable, scheduleLead, searchFeatured } from "../../lib/front_page_service.mjs";

// Admin only: front page lead story (WO-43). POST actions: state,
// schedule, edit, end (ends a running lead now or cancels a future one),
// search (athlete or team picker). Every change is logged.

const ACTOR = "Podium Watch Admin";

function bodyOf(request) {
  if (typeof request.body === "string") {
    try { return JSON.parse(request.body); } catch { return {}; }
  }
  return request.body || {};
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!isAdminRequest(request)) return response.status(401).json({ error: "Podium Watch admin sign in required." });
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }
  try {
    const body = bodyOf(request);
    const action = String(body.action || "state").trim().toLowerCase();
    let data;
    if (action === "state") data = await adminFrontPageState();
    else if (action === "schedule") data = await scheduleLead({ story: body.story, startsAt: body.starts_at, endsAt: body.ends_at, kicker: body.kicker, linkedProfileIds: body.linked_profile_ids, linkedTeamIds: body.linked_team_ids, actor: ACTOR });
    else if (action === "edit") data = await editLead({ leadId: body.lead_id, startsAt: body.starts_at, endsAt: body.ends_at, kicker: body.kicker, linkedProfileIds: body.linked_profile_ids, linkedTeamIds: body.linked_team_ids, actor: ACTOR });
    else if (action === "end") data = await endOrCancelLead({ leadId: body.lead_id, actor: ACTOR });
    else if (action === "search") data = await searchFeatured({ kind: body.kind, query: body.query });
    else return response.status(400).json({ error: "Unsupported action." });
    return response.status(200).json(data ?? {});
  } catch (error) {
    if (isMissingFrontPageTable(error)) return response.status(409).json({ error: "Run install/88_FRONT_PAGE_LEADS.sql first." });
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("Front page admin error:", error);
    return response.status(status).json({ error: status < 500 ? error.message : "That front page action could not be completed." });
  }
}
