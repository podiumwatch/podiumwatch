import { stripeClient } from "../../lib/stripe_client.mjs";
import {
  syncPhotographerSubscriptionFromStripe,
  syncFromCheckoutSession,
  recordPaymentStatusFromInvoice
} from "../../lib/photographer_billing_service.mjs";

// Stripe signature verification requires the exact raw request bytes --
// a JSON-parsed-then-restringified body will not match the signature
// Stripe sent, even if the content is logically identical (whitespace/
// key-order differences break the HMAC). Disabling Vercel's automatic
// body parsing for this one route (the standard, documented way to get
// raw access to a Vercel Node.js function's request body) and buffering
// it manually below is required, not optional.
export const config = {
  api: {
    bodyParser: false
  }
};

async function readRawBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// Server-to-server only -- Stripe calling Podium Watch, never a browser.
// No photographer/admin auth applies here; the ONLY authorization is the
// signature check below, which is why it happens before anything else
// and why a bad signature returns immediately without touching the
// database at all.
export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured -- refusing to process an unverifiable webhook.");
    return response.status(500).json({ error: "Webhook not configured." });
  }

  const signature = request.headers["stripe-signature"];
  let event;
  try {
    const rawBody = await readRawBody(request);
    event = stripeClient.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed.", error.message);
    return response.status(400).json({ error: "Invalid signature." });
  }

  try {
    switch (event.type) {
      // The primary source of subscription-state truth -- Stripe's own
      // recommended pattern. eventMeta (id + created) lets the sync
      // function detect and skip an out-of-order redelivery rather than
      // overwriting newer state with stale state.
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncPhotographerSubscriptionFromStripe(event.data.object, { id: event.id, created: event.created });
        break;
      // Defense in depth only -- re-fetches CURRENT live subscription
      // state directly from Stripe rather than trusting this event's own
      // payload, in case customer.subscription.created is ever delayed
      // relative to the customer's redirect back to Podium Watch. The
      // success redirect itself is never trusted as proof of payment --
      // only a real webhook-driven sync (this, or the events above) ever
      // changes entitlement.
      case "checkout.session.completed":
        await syncFromCheckoutSession(event.data.object);
        break;
      case "invoice.payment_succeeded":
        await recordPaymentStatusFromInvoice(event.data.object, "succeeded");
        break;
      case "invoice.payment_failed":
        await recordPaymentStatusFromInvoice(event.data.object, "failed");
        break;
      default:
        // Stripe sends many more event types than this integration
        // needs to act on -- anything else is intentionally ignored.
        break;
    }
  } catch (error) {
    console.error("Stripe webhook event handling failed.", event.type, event.id, error);
    // Non-2xx so Stripe retries with its own backoff -- every write path
    // here is an idempotent upsert, so a retried delivery is safe.
    return response.status(500).json({ error: "Webhook handling failed." });
  }

  return response.status(200).json({ received: true });
}
