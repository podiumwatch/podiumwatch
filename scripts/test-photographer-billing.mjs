import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

// Real Stripe integration for the Photographer Network membership. The
// live Vercel project's Price IDs are real, LIVE Stripe values -- this
// test file never calls Stripe's network API and never touches
// Supabase, on purpose. It verifies every piece of billing logic that
// CAN be tested as pure, deterministic functions (price/interval
// mapping, duplicate-subscription prevention, story eligibility and its
// one-time-only guarantee, cancellation/expiration/failed-payment
// status handling, webhook signature verification and out-of-order
// protection -- Stripe's signature check is pure local HMAC crypto, no
// network call, so it's genuinely testable here). Anything that
// necessarily touches the live database (the actual upsert, actual
// ownership lookups) is guarded at the source level below instead, the
// same way this project's other Supabase-dependent features are --
// full live verification is still required once migration 18 is
// confirmed run in Supabase.

const root = process.cwd();
process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY ||= "test-service-role-key";
process.env.STRIPE_SECRET_KEY ||= "sk_test_fake_for_local_tests_only";
process.env.STRIPE_PHOTOGRAPHER_MONTHLY_PRICE_ID ||= "price_fake_monthly_test";
process.env.STRIPE_PHOTOGRAPHER_ANNUAL_PRICE_ID ||= "price_fake_annual_test";

const {
  resolvePriceIdForInterval,
  resolveBillingIntervalFromPriceId,
  hasNonTerminalStripeSubscription,
  STRIPE_STATUS_MAP,
  isStaleStripeEvent,
  isMembershipActive
} = await import("../lib/photographer_billing_service.mjs");
const { isSubscriptionActive, shouldGrantPartnershipStoryEligibility } = await import("../lib/photographer_service.mjs");
const { stripeClient } = await import("../lib/stripe_client.mjs");

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), "utf8");
}

function includesAll(text, values, label) {
  for (const value of values) assert.ok(text.includes(value), `${label} is missing "${value}"`);
}

function excludesAll(text, values, label) {
  for (const value of values) assert.ok(!text.includes(value), `${label} must NOT contain "${value}"`);
}

// --- monthly / annual Price ID mapping ---------------------------------------
// The server decides which real Price ID a request maps to -- the
// browser only ever sends "monthly" or "annual".

assert.equal(resolvePriceIdForInterval("monthly"), process.env.STRIPE_PHOTOGRAPHER_MONTHLY_PRICE_ID);
assert.equal(resolvePriceIdForInterval("annual"), process.env.STRIPE_PHOTOGRAPHER_ANNUAL_PRICE_ID);
assert.equal(resolveBillingIntervalFromPriceId(process.env.STRIPE_PHOTOGRAPHER_MONTHLY_PRICE_ID), "monthly");
assert.equal(resolveBillingIntervalFromPriceId(process.env.STRIPE_PHOTOGRAPHER_ANNUAL_PRICE_ID), "annual");
assert.equal(resolveBillingIntervalFromPriceId("price_totally_unknown"), null, "An unrecognized price id must never be guessed at.");

// --- rejecting arbitrary plan values / arbitrary client-supplied Price IDs ---

for (const badValue of ["pro", "featured", "basic", "", null, undefined, "MONTHLY", "monthly "]) {
  assert.throws(() => resolvePriceIdForInterval(badValue), /Choose monthly or annual/, `"${badValue}" must be rejected, not silently coerced.`);
}

{
  const billingServiceSource = await read("lib/photographer_billing_service.mjs");
  assert.match(
    billingServiceSource,
    /export async function createMyCheckoutSession\(userId, photographerId, \{ billing_interval \}\)/,
    "createMyCheckoutSession must only ever accept a billing_interval choice from the caller, never a raw Stripe price id parameter."
  );
  includesAll(
    billingServiceSource,
    ["line_items: [{ price: priceId, quantity: 1 }]"],
    "Checkout must use the server-resolved priceId variable, never anything read directly off the request body"
  );
}

// --- authentication required / ownership enforcement (source-guarded) -------
// requirePhotographerUser/requirePhotographerOwnership need a live
// Supabase Auth call, so the actual rejection is guarded at the source
// level here, matching this project's established pattern for
// database-dependent checks.

{
  const billingServiceSource = await read("lib/photographer_billing_service.mjs");
  for (const fn of ["createMyCheckoutSession", "createMyBillingPortalSession"]) {
    const fnBody = billingServiceSource.slice(billingServiceSource.indexOf(`function ${fn}`));
    const nextFnIndex = fnBody.indexOf("\nexport async function", 1);
    const scoped = nextFnIndex === -1 ? fnBody : fnBody.slice(0, nextFnIndex);
    assert.match(scoped, /await requirePhotographerOwnership\(userId, cleanedId\)/, `${fn} must ownership-check before doing anything else with Stripe.`);
  }
  const checkoutApiSource = await read("api/photographer/checkout.js");
  const portalApiSource = await read("api/photographer/billing-portal.js");
  includesAll(checkoutApiSource, ["requirePhotographerUser"], "api/photographer/checkout.js must require a signed-in photographer.");
  includesAll(portalApiSource, ["requirePhotographerUser"], "api/photographer/billing-portal.js must require a signed-in photographer.");
}

// --- duplicate active subscription prevention --------------------------------
// The server inspects existing subscription state before creating a new
// Checkout Session -- never merely a hidden button.

assert.equal(hasNonTerminalStripeSubscription({ stripe_subscription_id: "sub_123", status: "active" }), true, "An active real subscription must block a second Checkout Session.");
assert.equal(hasNonTerminalStripeSubscription({ stripe_subscription_id: "sub_123", status: "trialing" }), true);
assert.equal(hasNonTerminalStripeSubscription({ stripe_subscription_id: "sub_123", status: "past_due" }), true, "past_due still has a real, unresolved subscription -- must go to the portal, not start a second one.");
assert.equal(hasNonTerminalStripeSubscription({ stripe_subscription_id: "sub_123", status: "canceled" }), false, "A fully lapsed photographer must be able to resubscribe.");
assert.equal(hasNonTerminalStripeSubscription({ stripe_subscription_id: null, status: "inactive" }), false, "A photographer who never subscribed must be able to start.");

{
  const billingServiceSource = await read("lib/photographer_billing_service.mjs");
  includesAll(
    billingServiceSource,
    ["if (hasNonTerminalStripeSubscription(subscription))", "You already have a membership"],
    "createMyCheckoutSession must actually call the duplicate-prevention check and fail loudly, not just define it"
  );
}

// --- annual story eligibility: granted once, never twice ---------------------

assert.equal(
  shouldGrantPartnershipStoryEligibility({ status: "active", billing_interval: "annual", current_period_end: null }, "not_eligible"),
  true,
  "A real active annual subscription with no prior grant must become eligible."
);
assert.equal(
  shouldGrantPartnershipStoryEligibility({ status: "active", billing_interval: "annual", current_period_end: null }, undefined),
  true,
  "A brand-new subscription row (no prior partnership_story_status at all) must be treated the same as not_eligible."
);
assert.equal(
  shouldGrantPartnershipStoryEligibility({ status: "active", billing_interval: "annual", current_period_end: null }, "eligible"),
  false,
  "Already-eligible must never be re-granted (which would look harmless but proves the guard fires on every state, not just 'published')."
);
assert.equal(
  shouldGrantPartnershipStoryEligibility({ status: "active", billing_interval: "annual", current_period_end: null }, "published"),
  false,
  "An already-consumed story benefit must never be granted again -- switching plans repeatedly must not create unlimited stories."
);
assert.equal(
  shouldGrantPartnershipStoryEligibility({ status: "active", billing_interval: "monthly", current_period_end: null }, "not_eligible"),
  false,
  "Monthly members never receive the story benefit, active or not."
);
assert.equal(
  shouldGrantPartnershipStoryEligibility({ status: "inactive", billing_interval: "annual", current_period_end: null }, "not_eligible"),
  false,
  "An incomplete/never-activated annual subscription must not grant eligibility."
);
assert.equal(
  shouldGrantPartnershipStoryEligibility({ status: "active", billing_interval: "annual", current_period_end: new Date(Date.now() - 86400000).toISOString() }, "not_eligible"),
  false,
  "An annual subscription whose period has already ended must not grant eligibility even if status still says active."
);

// Simulates monthly -> annual -> monthly -> annual switching (the exact
// "switch back and forth" scenario the business rule worries about):
// eligibility grants once on the FIRST real annual activation, and the
// second annual activation later (after a monthly detour) must not
// grant it again because the story status is already past 'not_eligible'.
{
  let storyStatus = "not_eligible";
  const firstAnnualActivation = shouldGrantPartnershipStoryEligibility({ status: "active", billing_interval: "annual", current_period_end: null }, storyStatus);
  assert.equal(firstAnnualActivation, true);
  storyStatus = "eligible"; // what upsertSubscriptionFields would have set
  const switchToMonthly = shouldGrantPartnershipStoryEligibility({ status: "active", billing_interval: "monthly", current_period_end: null }, storyStatus);
  assert.equal(switchToMonthly, false, "Switching to monthly must never touch story status either way.");
  const switchBackToAnnual = shouldGrantPartnershipStoryEligibility({ status: "active", billing_interval: "annual", current_period_end: null }, storyStatus);
  assert.equal(switchBackToAnnual, false, "Switching back to annual a second time must NOT grant a second story.");
}

// --- cancellation at period end / expired subscription behavior --------------

assert.equal(
  isSubscriptionActive({ status: "active", cancel_at_period_end: true, current_period_end: new Date(Date.now() + 86400000).toISOString() }),
  true,
  "cancel_at_period_end=true must NOT immediately remove access -- membership stays active through the paid period."
);
assert.equal(
  isSubscriptionActive({ status: "active", current_period_end: new Date(Date.now() - 86400000).toISOString() }),
  false,
  "An expired period_end must remove entitlement even if status still says active."
);
assert.equal(
  isSubscriptionActive({ status: "active", current_period_end: null }),
  true,
  "No period_end set at all (e.g. immediately after activation) must not be treated as expired."
);
assert.equal(
  isSubscriptionActive({ status: "canceled", current_period_end: new Date(Date.now() + 86400000).toISOString() }),
  false,
  "Once Stripe itself reports status=canceled, that is authoritative regardless of any period_end value."
);
assert.equal(isSubscriptionActive(null), false, "No subscription row at all must never be treated as active.");

// --- failed / incomplete payment must never activate membership --------------

for (const failureStatus of ["incomplete", "incomplete_expired", "unpaid", "paused"]) {
  assert.equal(STRIPE_STATUS_MAP[failureStatus], "inactive", `Stripe status "${failureStatus}" must map to inactive, never active.`);
}
assert.equal(STRIPE_STATUS_MAP.active, "active");
assert.equal(STRIPE_STATUS_MAP.trialing, "trialing");
assert.equal(STRIPE_STATUS_MAP.past_due, "past_due");
assert.equal(STRIPE_STATUS_MAP.canceled, "canceled");

// --- complimentary access as a separate entitlement source -------------------

assert.equal(isMembershipActive({ status: "inactive", admin_complimentary_access: true }), true, "Complimentary access must grant membership even with zero real Stripe subscription.");
assert.equal(isMembershipActive({ status: "active", current_period_end: new Date(Date.now() + 86400000).toISOString(), admin_complimentary_access: false }), true);
assert.equal(isMembershipActive({ status: "inactive", admin_complimentary_access: false }), false);
{
  const serviceSource = await read("lib/photographer_service.mjs");
  assert.match(
    serviceSource,
    /export async function adminSetComplimentaryAccess\(photographerId, \{ admin_complimentary_access, admin_notes \}\)/,
    "adminSetComplimentaryAccess must only ever accept admin_complimentary_access/admin_notes -- never status/billing_interval/period fields."
  );
  const fnBody = serviceSource.slice(serviceSource.indexOf("export async function adminSetComplimentaryAccess"));
  const scoped = fnBody.slice(0, fnBody.indexOf("\nexport async function", 1));
  excludesAll(
    scoped,
    ["status,", "billing_interval:", "current_period_end:", "stripe_customer_id", "stripe_subscription_id"],
    "adminSetComplimentaryAccess must never write Stripe-owned fields -- a manual admin save must never be able to stomp a real Stripe subscription"
  );
}

// --- webhook signature verification (real, local Stripe crypto -- no network) -

{
  const payload = JSON.stringify({ id: "evt_test", object: "event", type: "customer.subscription.updated", created: Math.floor(Date.now() / 1000), data: { object: { id: "sub_test" } } });
  const secret = "whsec_test_only_for_local_verification";
  const validHeader = stripeClient.webhooks.generateTestHeaderString({ payload, secret });

  const verified = stripeClient.webhooks.constructEvent(payload, validHeader, secret);
  assert.equal(verified.type, "customer.subscription.updated", "A correctly signed payload must verify and parse.");

  assert.throws(
    () => stripeClient.webhooks.constructEvent(payload, validHeader, "whsec_the_wrong_secret"),
    "A signature verified against the wrong secret must be rejected."
  );

  const tamperedPayload = payload.replace("customer.subscription.updated", "customer.subscription.deleted");
  assert.throws(
    () => stripeClient.webhooks.constructEvent(tamperedPayload, validHeader, secret),
    "A payload modified after signing must be rejected -- the signature covers the exact raw bytes."
  );

  assert.throws(
    () => stripeClient.webhooks.constructEvent(payload, "t=123,v1=not_a_real_signature", secret),
    "A malformed signature header must be rejected."
  );
}

{
  const webhookSource = await read("api/stripe/webhook.js");
  includesAll(
    webhookSource,
    ["bodyParser: false", "stripeClient.webhooks.constructEvent(rawBody, signature, webhookSecret)", "return response.status(400).json({ error: \"Invalid signature.\" });"],
    "The real webhook endpoint must disable automatic body parsing and reject bad signatures with 400"
  );
}

// --- webhook idempotency / duplicate and out-of-order event delivery ---------

assert.equal(isStaleStripeEvent(null, Math.floor(Date.now() / 1000)), false, "No prior recorded event yet -- the first delivery must always apply.");
{
  const earlier = Math.floor(Date.now() / 1000) - 3600;
  const later = Math.floor(Date.now() / 1000);
  assert.equal(isStaleStripeEvent(new Date(earlier * 1000).toISOString(), later), false, "A genuinely newer event must be applied.");
  assert.equal(isStaleStripeEvent(new Date(later * 1000).toISOString(), earlier), true, "A late-arriving OLDER event must be skipped, not allowed to overwrite newer state.");
  assert.equal(isStaleStripeEvent(new Date(later * 1000).toISOString(), later), false, "Re-delivery of the SAME event's own timestamp must not be treated as stale (upsert-by-photographer_id already makes exact redelivery a safe no-op).");
}
{
  const billingServiceSource = await read("lib/photographer_billing_service.mjs");
  includesAll(
    billingServiceSource,
    ["last_stripe_event_id: eventMeta.id, last_stripe_event_at: toIso(eventMeta.created)"],
    "Every applied webhook event must record its own id/timestamp so the next delivery can be checked against it"
  );
}

// --- monthly and annual feature parity (structural, locked in as a regression test) -

{
  const serviceSource = await read("lib/photographer_service.mjs");
  excludesAll(
    serviceSource,
    ["PLAN_PORTFOLIO_BONUS", "getPortfolioLimit"],
    "The old per-tier portfolio bonus must stay fully removed -- monthly and annual must never differ in normal functionality"
  );
  assert.match(serviceSource, /const SELF_SERVICE_PORTFOLIO_LIMIT = 12;/, "The portfolio limit must be a single flat constant shared by every photographer, paid or not.");
}

// --- admin visibility without exposing Stripe secrets -------------------------

{
  const adminPageSource = await read("src/pages/adminphotographers.mjs");
  const adminScriptSource = await read("public/scripts/admin-photographers.js");
  excludesAll(adminPageSource + adminScriptSource, ["STRIPE_SECRET_KEY", "sk_test_", "sk_live_", "STRIPE_WEBHOOK_SECRET"], "The admin tool must never reference or display a Stripe secret value");
  includesAll(
    adminScriptSource,
    ["shortenStripeId"],
    "Stripe customer/subscription identifiers shown to admins must be shortened, not the full raw id string"
  );
  includesAll(
    adminPageSource,
    ["Billing interval", "Subscription status", "Renews / expires", "Cancel at period end", "Complimentary access"],
    "The admin billing readout must show the useful subscription fields the business owner asked for"
  );
}

// --- migration safety (additive only, matching install/16 and 17) ------------

{
  const migration18 = await read("install/18_PHOTOGRAPHER_STRIPE_INTEGRATION.sql");
  excludesAll(
    migration18.toLowerCase(),
    ["drop table", "delete from", "truncate"],
    "install/18 must be purely additive -- no dropped tables, no deleted rows"
  );
  includesAll(migration18, ["add column if not exists"], "install/18 must use additive, idempotent column adds.");
}

console.log("Photographer Network Stripe integration billing logic validated.");
console.log("Price ID mapping (monthly/annual) checked, including rejection of arbitrary plan values and confirmation the browser can never supply a raw Stripe price id.");
console.log("Authentication/ownership enforcement checked at the source level for checkout and billing-portal session creation.");
console.log("Duplicate active subscription prevention checked directly (active/trialing/past_due blocks a second Checkout Session; canceled/never-subscribed does not) and confirmed wired into createMyCheckoutSession.");
console.log("Annual story eligibility checked: granted once on real activation, never re-granted (including a simulated annual -> monthly -> annual switch), never granted to monthly, never granted to an inactive or already-expired period.");
console.log("Cancellation-at-period-end, expiration, and failed/incomplete payment status handling checked directly against isSubscriptionActive and STRIPE_STATUS_MAP.");
console.log("Complimentary access checked as a fully separate entitlement source, structurally confirmed to never write any Stripe-owned field.");
console.log("Webhook signature verification checked with REAL local Stripe crypto (no network call): valid signature accepted, wrong secret rejected, tampered payload rejected, malformed header rejected.");
console.log("Webhook idempotency/out-of-order protection checked directly against isStaleStripeEvent, plus confirmed every sync records its own event id/timestamp.");
console.log("Monthly/annual feature parity locked in as a regression test: the old per-tier portfolio bonus is confirmed gone, replaced by one flat shared limit.");
console.log("Admin billing visibility checked: no Stripe secret value referenced anywhere, Stripe object ids always shortened, all requested fields present.");
console.log("Migration 18 checked to be purely additive -- no drops, no deletes, no truncates.");
console.log("NOT covered here (requires migration 18 live in Supabase + a real webhook call): the actual upsert into photographer_subscriptions, actual ownership-rejection against a second real account, and an end-to-end Checkout -> webhook -> entitlement round trip -- see the final report for what's still needed to run that live.");
