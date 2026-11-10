import { isAdminRequest } from "../../lib/admin_auth.mjs";
import { merchStatus, setMerchEnabled } from "../../lib/merch_service.mjs";

// Admin only: the Podium Watch Store card switch. POST { action: "state" }
// or { action: "set", enabled: true|false }.
export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!isAdminRequest(request)) return response.status(401).json({ error: "Podium Watch admin sign in required." });
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }
  try {
    const body = typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body || {};
    if (body.action === "set") return response.status(200).json(await setMerchEnabled(Boolean(body.enabled)));
    return response.status(200).json(await merchStatus({ fresh: true }));
  } catch (error) {
    console.error("Merch admin error:", error);
    return response.status(500).json({ error: "The store card setting could not be changed." });
  }
}
