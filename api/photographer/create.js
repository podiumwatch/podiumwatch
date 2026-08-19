import {
  requirePhotographerUser,
  photographerApiError
} from "../../lib/photographer_auth.mjs";
import { createMyPhotographerListing } from "../../lib/photographer_service.mjs";

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

// Creates a brand-new photographer listing (status: draft) owned by the
// signed-in user, mirroring api/team/create.js's open-self-serve
// pattern -- a real Supabase Auth account first (client-side signUp()),
// then this endpoint creates the record and the ownership row together.
export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const user = await requirePhotographerUser(request);
    const body = parseBody(request);
    const photographer = await createMyPhotographerListing(user.id, body);
    return response.status(200).json({ photographer });
  } catch (error) {
    return photographerApiError(response, error, "The photographer listing could not be created.");
  }
}
