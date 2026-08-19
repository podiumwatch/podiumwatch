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
// One Podium Watch Photographer Network product, two recurring prices.
// Every value below is read from environment configuration only -- never
// hard coded in an application file, and the SECRET key is never exported
// anywhere a browser bundle could reach it. All three remain null until
// the user provides a real Stripe account; nothing in this codebase reads
// a fabricated value here. See the final report for exactly what's needed
// to go from null to real.
export const STRIPE_PRICE_ID_MONTHLY = process.env.STRIPE_PRICE_ID_MONTHLY || null;
export const STRIPE_PRICE_ID_ANNUAL = process.env.STRIPE_PRICE_ID_ANNUAL || null;
export const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || null;
// STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are deliberately NOT
// re-exported from this module (or any module reachable from a browser
// script) -- once the real checkout/webhook endpoints are built, they
// read process.env.STRIPE_SECRET_KEY / process.env.STRIPE_WEBHOOK_SECRET
// directly, server-side only, at the point of use.
