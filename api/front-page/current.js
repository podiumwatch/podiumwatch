import { getCurrentLead, publicLead } from "../../lib/front_page_service.mjs";

// Public: the current front page lead story (WO-43), or null when none is
// set (the homepage then keeps the newest story it was built with).
export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }
  try {
    const lead = publicLead(await getCurrentLead());
    response.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return response.status(200).json({ lead });
  } catch (error) {
    console.error("Front page current error:", error);
    response.setHeader("Cache-Control", "no-store");
    return response.status(200).json({ lead: null });
  }
}
