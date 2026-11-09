import { isAdminRequest } from "../../lib/admin_auth.mjs";
import { listShortLinks, saveShortLink, setShortLinkActive } from "../../lib/short_links_service.mjs";
import { site } from "../../src/config/site.mjs";

// Admin only: short links (WO-34). POST actions: list, save, set_active.

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
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const body = bodyOf(request);
    const action = String(body.action || "list").trim().toLowerCase();
    let data;
    if (action === "list") data = await listShortLinks();
    else if (action === "save") data = await saveShortLink({ path: body.path, destination: body.destination, label: body.label, campaign: body.campaign, active: body.active !== false, siteUrl: site.siteUrl });
    else if (action === "set_active") data = await setShortLinkActive({ path: body.path, active: body.active === true });
    else return response.status(400).json({ error: "Unsupported action." });
    return response.status(200).json(data);
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("Short links admin error:", error);
    const missingTable = /short_link/.test(String(error?.message || "")) && ["42P01", "PGRST205"].includes(String(error?.code || ""));
    return response.status(missingTable ? 409 : status).json({
      error: missingTable ? "Run install/84_SHORT_LINKS.sql first." : status < 500 ? error.message : "That short link action could not be completed."
    });
  }
}
