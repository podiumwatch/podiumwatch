import { isAdminRequest } from "../../lib/admin_auth.mjs";
import { adminPartnerData, savePartnerSettings, setInquiryStatus } from "../../lib/partner_page_service.mjs";

// Admin only: partner page settings and inquiries (WO-26).
// POST actions: load, save_settings, set_inquiry_status.

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!isAdminRequest(request)) return response.status(401).json({ error: "Podium Watch admin sign in required." });
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }
  try {
    const body = typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body || {};
    const action = String(body.action || "load");
    let data;
    if (action === "load") data = await adminPartnerData();
    else if (action === "save_settings") data = await savePartnerSettings(body);
    else if (action === "set_inquiry_status") data = await setInquiryStatus({ id: body.id, status: body.status });
    else return response.status(400).json({ error: "Unsupported action." });
    return response.status(200).json(data);
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("Partner page admin error:", error);
    const missing = /partner_(page_settings|inquiries)/.test(String(error?.message || ""));
    return response.status(missing ? 409 : status).json({ error: missing ? "Run install/86_PARTNER_PAGE.sql first." : status < 500 ? error.message : "That action could not be completed." });
  }
}
