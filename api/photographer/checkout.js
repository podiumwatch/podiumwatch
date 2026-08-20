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

// Kill switch: the Photographer Network is temporarily unpublished
// (2026-08-20, not ready yet -- see docs/DECISIONS.md and
// scripts/build.mjs's matching note). The public/private pages that link
// here are gone from the build, but this serverless function is still
// deployed and directly reachable regardless of that -- Vercel deploys
// everything under api/ independently of what scripts/build.mjs writes.
// Real, live Stripe price IDs are configured, so this endpoint can
// genuinely start a real charge; this flag is the actual, unconditional
// stop, checked before auth even runs, not just "no page links here
// anymore." Flip back to true (and uncomment the routes in
// scripts/build.mjs) when ready to republish.
const CHECKOUT_ENABLED = false;

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

  if (!CHECKOUT_ENABLED) {
    return response.status(503).json({ error: "Photographer Network membership is not yet available." });
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
