import { listPublicPhotographers } from "../../lib/photographer_service.mjs";

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The submitted search is invalid.");
      error.status = 400;
      throw error;
    }
  }
  return request.body || {};
}

// Fully public, no auth -- the Photographer Network directory search.
// Only ever returns status = 'approved' AND public_visible = true rows
// (enforced inside lib/photographer_service.mjs, not here).
export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const body = parseBody(request);
    const data = await listPublicPhotographers({
      search: body.search,
      school: body.school,
      sport: body.sport,
      region: body.region,
      city: body.city,
      page: body.page,
      pageSize: body.page_size
    });
    return response.status(200).json(data);
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("The photographer search could not be completed.", error);
    return response.status(status).json({ error: status < 500 ? error.message : "The photographer search could not be completed." });
  }
}
