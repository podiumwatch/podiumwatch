import { resolveNames } from "../../lib/name_links_service.mjs";
import { LINK_LIMITS } from "../../lib/name_links.mjs";

// GET /api/links/?s=School|School&a=Name~School|Name~School&i=schoolId|schoolId
// Returns the team and athlete page for each name that matches exactly one
// page (lib/name_links.mjs), for public/scripts/name-links.js. The browser
// sends the names sorted, so every visitor to the same page asks the same
// URL and the CDN answers it (15 minutes, then stale while it refreshes).
// Read-only. If the index can't load, the answer is empty: no links, no error.

const split = (value, max) => String(value || "").split("|").map((part) => part.trim()).filter(Boolean).slice(0, max);

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }
  const query = {
    s: split(request.query?.s, LINK_LIMITS.schools),
    a: split(request.query?.a, LINK_LIMITS.athletes).map((pair) => pair.split("~")).filter((pair) => pair.length === 2),
    i: split(request.query?.i, LINK_LIMITS.ids).filter((id) => /^[0-9a-f-]{36}$/.test(id))
  };
  try {
    const result = await resolveNames(query);
    response.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=86400");
    return response.status(200).json(result);
  } catch {
    response.setHeader("Cache-Control", "public, s-maxage=60");
    return response.status(200).json({ schools: {}, athletes: {}, ids: {} });
  }
}
