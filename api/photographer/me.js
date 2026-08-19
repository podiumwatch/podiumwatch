import {
  requirePhotographerUser,
  photographerApiError
} from "../../lib/photographer_auth.mjs";
import { getMyPhotographerListings } from "../../lib/photographer_service.mjs";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const user = await requirePhotographerUser(request);
    const listings = await getMyPhotographerListings(user.id);
    return response.status(200).json({ user: { id: user.id, email: user.email }, listings });
  } catch (error) {
    return photographerApiError(response, error, "The account request could not be completed.");
  }
}
