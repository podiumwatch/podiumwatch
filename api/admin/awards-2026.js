import { isAdminRequest } from "../../lib/admin_auth.mjs";
import { adminSummary, deleteNomination, nominationsCsv } from "../../lib/yearly_awards_2026_service.mjs";

// Admin only: 2026 Athlete/Team of the Year nominations. POST actions:
// summary, delete_nomination. GET ?format=csv downloads every category's
// ranked nominees with their reasons.

function bodyOf(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      return {};
    }
  }
  return request.body || {};
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!isAdminRequest(request)) return response.status(401).json({ error: "Podium Watch admin sign in required." });

  try {
    if (request.method === "GET" && String(request.query?.format || "") === "csv") {
      const csv = await nominationsCsv();
      response.setHeader("Content-Type", "text/csv; charset=utf-8");
      response.setHeader("Content-Disposition", 'attachment; filename="podium-watch-2026-yearly-award-nominations.csv"');
      return response.status(200).send(csv);
    }

    if (request.method !== "POST") {
      response.setHeader("Allow", "GET, POST");
      return response.status(405).json({ error: "Method not allowed." });
    }

    const body = bodyOf(request);
    const action = String(body.action || "summary").trim().toLowerCase();
    let data;
    if (action === "summary") data = { categories: await adminSummary() };
    else if (action === "delete_nomination") data = await deleteNomination(body.nomination_id);
    else return response.status(400).json({ error: "Unsupported action." });

    return response.status(200).json(data);
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("Yearly awards admin error:", error);
    return response.status(status).json({ error: status < 500 ? error.message : "That action could not be completed." });
  }
}
