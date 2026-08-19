// Server-only Stripe SDK singleton. Mirrors lib/supabase-admin.mjs's own
// pattern exactly: throw clearly at import time if the required env var
// is missing, rather than failing confusingly deep inside a request.
// Safe to do here for the same reason it's safe there -- this module is
// only ever imported by api/*.js request handlers (which always run with
// real environment variables in Vercel), never by anything under
// src/pages/*.mjs that scripts/build.mjs executes at build time.
//
// Whichever key is configured (test or live) determines which Stripe
// mode this actually talks to -- nothing in this codebase hardcodes
// test vs. live. STRIPE_SECRET_KEY never leaves the server: nothing
// re-exports it, and no browser-reachable script ever imports this file.
import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  throw new Error("Stripe environment variables are missing.");
}

export const stripeClient = new Stripe(secretKey);
