import { publicPartnerData } from "../../lib/partner_page_service.mjs";

// Public: numbers and packages for the "Partner with Podium Watch" page
// (/sponsors/, WO-26). No prices are hard-coded; they come from
// /admin/partner-page/. Cached for an hour.

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }
  try {
    const data = await publicPartnerData();
    response.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    return response.status(200).json(data);
  } catch (error) {
    console.error("Partner page data error:", error);
    response.setHeader("Cache-Control", "no-store");
    return response.status(500).json({ error: "Partner details could not be loaded right now." });
  }
}
