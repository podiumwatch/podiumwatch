import {
  requirePhotographerUser,
  photographerApiError
} from "../../lib/photographer_auth.mjs";
import { createMyBillingPortalSession } from "../../lib/photographer_billing_service.mjs";

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

// Opens Stripe's own hosted Customer Portal for the signed-in
// photographer's OWN existing billing account -- payment method,
// invoices, canceling, and switching monthly <-> annual all happen
// there, using Stripe's real supported subscription-update flow rather
// than anything invented in this codebase.
export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const user = await requirePhotographerUser(request);
    const body = parseBody(request);
    const result = await createMyBillingPortalSession(user.id, body.id);
    return response.status(200).json(result);
  } catch (error) {
    return photographerApiError(response, error, "The billing portal could not be opened.");
  }
}
