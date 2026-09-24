import {
  requirePhotographerUser,
  photographerApiError
} from "../../lib/photographer_auth.mjs";
import { createMyCheckoutSession } from "../../lib/photographer_billing_service.mjs";

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

// Starts a real Stripe Checkout Session for the signed-in photographer's
// OWN listing, ownership-checked the same way as every other
// self-service action. Only ever used for a photographer's FIRST
// subscription -- switching monthly <-> annual on an existing one goes
// through api/photographer/billing-portal.js instead (Stripe's own
// supported subscription-update flow).
export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const user = await requirePhotographerUser(request);
    const body = parseBody(request);
    const result = await createMyCheckoutSession(user.id, body.id, { billing_interval: body.billing_interval });
    return response.status(200).json(result);
  } catch (error) {
    return photographerApiError(response, error, "Membership checkout could not be started.");
  }
}
