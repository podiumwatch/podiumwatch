// Podium Watch Photographer Network -- centralized membership pricing and
// Stripe configuration. Pure data plus plain env reads, zero imports, on
// purpose -- same reason as lib/photographer_constants.mjs: src/pages/*.mjs
// files run at BUILD time via scripts/build.mjs, which never touches
// Supabase, so anything a build-time page needs (like the public pricing
// page) must live somewhere with no supabaseAdmin import chain, or the
// build crashes immediately. Reading an unset process.env var is always
// safe (returns undefined, never throws) so this module is safe to import
// at build time even before any Stripe env vars exist.
//
// One Photographer Network membership, two recurring Stripe prices --
// finalized 2026-08-19. Never hard code these dollar amounts into a page
// template directly; read them from here so pricing can change in one
// place. See docs/DECISIONS.md's "Photographer Network Membership Pricing
// Finalized" entry for the full reasoning.

export const MONTHLY_PRICE_CENTS = 799; // $7.99 / month
export const ANNUAL_PRICE_CENTS = 3999; // $39.99 / year

export const TWELVE_MONTHLY_TOTAL_CENTS = MONTHLY_PRICE_CENTS * 12; // $95.88
export const ANNUAL_SAVINGS_CENTS = TWELVE_MONTHLY_TOTAL_CENTS - ANNUAL_PRICE_CENTS; // $55.89
export const ANNUAL_MONTHLY_EQUIVALENT_CENTS = Math.round(ANNUAL_PRICE_CENTS / 12); // $3.33

export function formatUsd(cents) {
  return "$" + (cents / 100).toFixed(2);
}

// --- Stripe configuration (centralized, never scattered) ---------------------
// Two separate Stripe products today (one for the monthly price, one for
// the annual price) -- not one product with two prices as originally
// sketched. The Price IDs themselves are the real source of truth for
// Checkout either way; which product each belongs to doesn't matter to
// this codebase. Every value below is read from environment
// configuration only -- never hard coded in an application file. These
// two env var names are already set in the live Vercel project (real,
// live Stripe prices -- $7.99/mo and $39.99/yr, matching the constants
// above) and must not be renamed without updating Vercel to match.
export const STRIPE_PHOTOGRAPHER_MONTHLY_PRICE_ID = process.env.STRIPE_PHOTOGRAPHER_MONTHLY_PRICE_ID || null;
export const STRIPE_PHOTOGRAPHER_ANNUAL_PRICE_ID = process.env.STRIPE_PHOTOGRAPHER_ANNUAL_PRICE_ID || null;
// STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are deliberately NOT
// re-exported from this module (or any module reachable from a browser
// script) -- they're read directly from process.env, server-side only,
// at the point of use (lib/stripe_client.mjs and api/stripe/webhook.js).
