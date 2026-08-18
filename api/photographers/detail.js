import { getPublicPhotographerBySlug } from "../../lib/photographer_service.mjs";

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

// Fully public, no auth -- a single approved+visible photographer profile.
export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const body = parseBody(request);
    const data = await getPublicPhotographerBySlug(body.slug);
    return response.status(200).json({ photographer: data });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("The photographer profile could not be loaded.", error);
    return response.status(status).json({ error: status < 500 ? error.message : "The photographer profile could not be loaded." });
  }
}
