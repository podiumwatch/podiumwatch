import crypto from "node:crypto";
import { isAdminRequest } from "../../lib/admin_auth.mjs";
import { listPendingInstagramRequests, listRecentInstagramChanges, reviewInstagramRequest, revertTeamInstagramChange } from "../../lib/team_instagram_service.mjs";
import { bulkAddInstagram, businessDiscovery, instagramDirectory, instagramExportCsv, instagramExportRows } from "../../lib/instagram_directory_service.mjs";

function bodyOf(request) {
  if (typeof request.body === "string") {
    try { return JSON.parse(request.body); } catch { const error = new Error("The request is invalid."); error.status = 400; throw error; }
  }
  return request.body || {};
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!isAdminRequest(request)) return response.status(401).json({ error: "Podium Watch admin sign in required." });
  // Export (WO-44): GET ?format=csv|json, approved accounts only (school,
  // label, handle). Never includes a submitter's email.
  if (request.method === "GET" && ["csv", "json"].includes(String(request.query?.format || ""))) {
    try {
      const rows = await instagramExportRows();
      const stamp = new Date().toISOString().slice(0, 10);
      if (request.query.format === "json") {
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.setHeader("Content-Disposition", `attachment; filename="podium-watch-team-instagram-${stamp}.json"`);
        return response.status(200).send(JSON.stringify(rows, null, 2));
      }
      response.setHeader("Content-Type", "text/csv; charset=utf-8");
      response.setHeader("Content-Disposition", `attachment; filename="podium-watch-team-instagram-${stamp}.csv"`);
      return response.status(200).send(instagramExportCsv(rows));
    } catch (error) {
      console.error("Team Instagram export error", error);
      return response.status(500).json({ error: "The export could not be made." });
    }
  }
  if (request.method !== "POST") { response.setHeader("Allow", "GET, POST"); return response.status(405).json({ error: "Method not allowed." }); }

  try {
    const body = bodyOf(request);
    const action = String(body.action || "list").trim().toLowerCase();
    let data;

    if (action === "list") {
      const sinceDays = Number(body.since_days) || 90;
      const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
      data = { changes: await listRecentInstagramChanges({ since, limit: Number(body.limit) || 200 }) };
    } else if (action === "pending") {
      data = { requests: await listPendingInstagramRequests() };
    } else if (action === "review") {
      data = await reviewInstagramRequest({ requestId: body.request_id, decision: body.decision, note: body.note, label: body.label || null, adminName: "Podium Watch Admin" });
    } else if (action === "directory") {
      data = await instagramDirectory();
    } else if (action === "bulk_add") {
      data = await bulkAddInstagram(body.text);
    } else if (action === "discovery") {
      data = await businessDiscovery(body.handle);
    } else if (action === "revert") {
      if (!body.change_id) { const error = new Error("Choose a change to revert."); error.status = 400; throw error; }
      data = await revertTeamInstagramChange({ changeLogId: body.change_id, adminName: "Podium Watch Admin" });
    } else {
      const error = new Error("Unsupported team Instagram action.");
      error.status = 400;
      throw error;
    }

    return response.status(200).json(data);
  } catch (error) {
    const status = Number(error?.status) || 500;
    const requestId = crypto.randomUUID();
    if (status >= 500) console.error("Team Instagram admin error", { requestId, code: error?.code || null, message: error?.message || String(error) });
    return response.status(status).json({
      error: status < 500 ? error.message : `The team Instagram admin request could not be completed. Request ${requestId}.`,
      request_id: requestId,
      code: error?.code || null
    });
  }
}
