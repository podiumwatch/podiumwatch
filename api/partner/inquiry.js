import { submitInquiry } from "../../lib/partner_page_service.mjs";
import { site } from "../../src/config/site.mjs";

// Public: the partner page's inquiry form (WO-26). Saves the inquiry and
// emails media@podiumwatch.org. Hidden trap field, 3 per network per hour.

function clientAddress(request) {
  return String(request.headers["x-forwarded-for"] || request.socket?.remoteAddress || "unknown").split(",")[0].trim().slice(0, 100);
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }
  try {
    const body = typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body || {};
    if (String(body.pw_hp_field || "").trim()) return response.status(201).json({ received: true });
    const result = await submitInquiry({ body, address: clientAddress(request), siteUrl: site.siteUrl, contactEmail: site.contactEmail });
    return response.status(201).json(result);
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("Partner inquiry error:", error);
    return response.status(status).json({ error: status < 500 ? error.message : `Your message could not be sent right now. Email ${site.contactEmail} instead.` });
  }
}
