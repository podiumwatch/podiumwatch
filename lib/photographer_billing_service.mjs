// Real Stripe integration for the Photographer Network membership --
// checkout, the billing portal, and webhook event handling. Builds on
// the entitlement architecture already proven in lib/photographer_service.mjs
// (getSubscription/upsertSubscriptionFields) rather than duplicating any
// of it. Whichever STRIPE_SECRET_KEY is configured (test or live)
// determines which Stripe mode this actually talks to -- nothing here
// hardcodes test vs. live.
//
// One product, two recurring prices (see lib/photographer_membership_config.mjs).
// A photographer's FIRST subscription is created through Checkout
// (createMyCheckoutSession). Switching monthly <-> annual, updating a
// payment method, or canceling all go through the Stripe-hosted
// Customer Portal (createMyBillingPortalSession) -- Stripe's own
// supported subscription-update flow, never a manual proration
// calculation invented here. The Customer Portal's "update subscription"
// option (which products/prices a customer may switch between) is
// configured once in the Stripe Dashboard (Settings -> Billing ->
// Customer portal), not from this codebase.
import { supabaseAdmin } from "./supabase-admin.mjs";
import { stripeClient } from "./stripe_client.mjs";
import { requirePhotographerOwnership } from "./photographer_auth.mjs";
import { getSubscription, upsertSubscriptionFields } from "./photographer_service.mjs";
import { STRIPE_PRICE_ID_MONTHLY, STRIPE_PRICE_ID_ANNUAL } from "./photographer_membership_config.mjs";
import { site } from "../src/config/site.mjs";

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function cleanUuid(value, label = "ID") {
  const cleaned = String(value ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleaned)) fail(`${label} is invalid.`);
  return cleaned;
}

const PRICE_ID_BY_INTERVAL = { monthly: STRIPE_PRICE_ID_MONTHLY, annual: STRIPE_PRICE_ID_ANNUAL };

// --- self-service: checkout + portal -------------------------------------------

export async function createMyCheckoutSession(userId, photographerId, { billing_interval }) {
  const cleanedId = cleanUuid(photographerId, "Photographer");
  await requirePhotographerOwnership(userId, cleanedId);

  if (!["monthly", "annual"].includes(billing_interval)) fail("Choose monthly or annual.");
  const priceId = PRICE_ID_BY_INTERVAL[billing_interval];
  if (!priceId) fail("Membership checkout is not configured yet. Contact Podium Watch.", 503);

  const { data: photographer, error } = await supabaseAdmin
    .from("photographers")
    .select("id, business_email")
    .eq("id", cleanedId)
    .maybeSingle();
  if (error) throw error;
  if (!photographer) fail("Photographer not found.", 404);

  const subscription = await getSubscription(cleanedId);

  const session = await stripeClient.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: cleanedId,
    // Set on BOTH the session and the resulting subscription -- the
    // subscription's own copy is what every later customer.subscription.*
    // webhook event actually carries, which is how this integration
    // resolves "which photographer is this?" without a customer-id
    // lookup in the common case.
    metadata: { photographer_id: cleanedId },
    subscription_data: { metadata: { photographer_id: cleanedId } },
    ...(subscription.stripe_customer_id
      ? { customer: subscription.stripe_customer_id }
      : { customer_email: photographer.business_email || undefined }),
    success_url: `${site.siteUrl}/photographer-dashboard/?checkout=success`,
    cancel_url: `${site.siteUrl}/photographer-dashboard/?checkout=canceled`
  });

  return { url: session.url };
}

export async function createMyBillingPortalSession(userId, photographerId) {
  const cleanedId = cleanUuid(photographerId, "Photographer");
  await requirePhotographerOwnership(userId, cleanedId);

  const subscription = await getSubscription(cleanedId);
  if (!subscription.stripe_customer_id) fail("No billing account yet -- start a membership first.", 409);

  const session = await stripeClient.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${site.siteUrl}/photographer-dashboard/`
  });
  return { url: session.url };
}

// --- webhook-driven writes -------------------------------------------------
// Every function below is only ever called from api/stripe/webhook.js,
// AFTER the raw request body has already been verified against
// STRIPE_WEBHOOK_SECRET -- these never run on caller-supplied input.

const STRIPE_STATUS_MAP = {
  trialing: "trialing",
  active: "active",
  past_due: "past_due",
  canceled: "canceled",
  // A failed or incomplete payment must never activate membership --
  // all three map to 'inactive', never 'active'.
  incomplete: "inactive",
  incomplete_expired: "inactive",
  unpaid: "inactive",
  paused: "inactive"
};

function toIso(unixSeconds) {
  return unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null;
}

function resolveBillingInterval(subscription) {
  const priceId = subscription.items?.data?.[0]?.price?.id;
  if (priceId && priceId === STRIPE_PRICE_ID_MONTHLY) return "monthly";
  if (priceId && priceId === STRIPE_PRICE_ID_ANNUAL) return "annual";
  return null;
}

function resolveCustomerId(subscriptionOrInvoice) {
  const customer = subscriptionOrInvoice.customer;
  return typeof customer === "string" ? customer : customer?.id || null;
}

// Normally resolved directly from subscription.metadata.photographer_id
// (set at checkout time -- see createMyCheckoutSession above, and
// preserved by Stripe across the subscription's whole lifecycle,
// including portal-driven price switches). Falls back to matching the
// Stripe customer id we already have on file only for the unlikely case
// of a subscription that lost its metadata (e.g. edited directly in the
// Stripe Dashboard) -- never drops an event silently without at least
// trying both.
async function resolvePhotographerId(subscription) {
  if (subscription.metadata?.photographer_id) return subscription.metadata.photographer_id;

  const customerId = resolveCustomerId(subscription);
  if (!customerId) return null;

  const { data, error } = await supabaseAdmin
    .from("photographer_subscriptions")
    .select("photographer_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (error) throw error;
  return data?.photographer_id || null;
}

// Drives ALL subscription-state writes off customer.subscription.created/
// updated/deleted -- not off checkout.session.completed, which doesn't
// reliably carry full subscription state and would risk a second,
// slightly different write path for the same fact. This is Stripe's own
// recommended pattern for keeping subscription state in sync.
export async function applyStripeSubscriptionEvent(subscription) {
  const photographerId = await resolvePhotographerId(subscription);
  if (!photographerId) {
    console.error("Stripe subscription event could not be matched to a photographer.", subscription.id);
    return;
  }

  const item = subscription.items?.data?.[0];
  const periodStart = subscription.current_period_start ?? item?.current_period_start;
  const periodEnd = subscription.current_period_end ?? item?.current_period_end;

  await upsertSubscriptionFields(photographerId, {
    status: STRIPE_STATUS_MAP[subscription.status] || "inactive",
    billing_interval: resolveBillingInterval(subscription),
    stripe_customer_id: resolveCustomerId(subscription),
    stripe_subscription_id: subscription.id,
    current_period_start: toIso(periodStart),
    current_period_end: toIso(periodEnd),
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    canceled_at: toIso(subscription.canceled_at)
    // admin_notes deliberately NOT included -- leaving the key out
    // means the upsert never touches it, so a webhook sync can never
    // clobber a human-entered admin note.
  });
}

// invoice.payment_succeeded / invoice.payment_failed are the ONLY writer
// of payment_status -- applyStripeSubscriptionEvent above deliberately
// never touches it, so there's no risk of a coarser status-derived guess
// overwriting this more precise, payment-specific signal. Written
// directly (not through upsertSubscriptionFields) since these events
// never carry a billing_interval/status change of their own, only a
// payment outcome.
export async function recordPaymentStatusFromInvoice(invoice, paymentStatus) {
  const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
  if (!subscriptionId) return;

  const { data, error } = await supabaseAdmin
    .from("photographer_subscriptions")
    .select("photographer_id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    console.error("Stripe invoice event could not be matched to a photographer.", subscriptionId);
    return;
  }

  const { error: updateError } = await supabaseAdmin
    .from("photographer_subscriptions")
    .update({ payment_status: paymentStatus })
    .eq("photographer_id", data.photographer_id);
  if (updateError) throw updateError;
}
