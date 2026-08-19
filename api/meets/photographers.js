import { getMeetPhotographers } from "../../lib/photographer_service.mjs";

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The submitted request is invalid.");
      error.status = 400;
      throw error;
    }
  }
  return request.body || {};
}

// Public, no auth -- "who's covering this meet" / "galleries from this
// meet," for the real meet detail page. Only approved + public_visible
// photographers, only public coverage rows, only published + visible
// galleries (all enforced inside lib/photographer_service.mjs).
export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const body = parseBody(request);
    const data = await getMeetPhotographers(body.meet_id);
    return response.status(200).json(data);
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("The meet photographers request could not be completed.", error);
    return response.status(status).json({ error: status < 500 ? error.message : "The meet photographers request could not be completed." });
  }
}
