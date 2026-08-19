-- Podium Watch Photographer Network -- Real Stripe Integration
-- Purpose:
--   Migrations 16 and 17 have already been applied to the real production
--   database. Neither is modified here -- this is the next additive
--   migration, using the repository's established numbering. It adds
--   what the REAL (not manually-admin-simulated) Stripe integration
--   needs on photographer_subscriptions: a reconciliation-friendly price
--   id, an explicit complimentary-access entitlement source separate
--   from Stripe, and out-of-order-webhook protection.
--
-- Design notes:
--   - stripe_price_id: nullable, set only by the real webhook sync
--     (lib/photographer_billing_service.mjs). billing_interval already
--     carries the semantic meaning (monthly/annual) derived FROM this
--     price id, so this column is not needed for entitlement logic --
--     it exists purely so an admin (or a future support investigation)
--     can see exactly which literal Stripe price a photographer is on,
--     without needing Stripe Dashboard access.
--   - admin_complimentary_access / admin_complimentary_granted_at: a
--     manual admin grant is now an explicitly SEPARATE entitlement
--     source from a real Stripe subscription, not a second way to write
--     the same status/billing_interval/period fields a real webhook
--     writes. Before this migration, Phase Four's adminSetSubscription
--     wrote directly into status/billing_interval/current_period_end/
--     etc. -- the same fields the real webhook now owns -- which meant
--     an admin manually saving the billing form for a photographer who
--     ALSO has a real, live Stripe subscription could stomp genuine
--     Stripe-derived data with stale form values. Going forward,
--     status/billing_interval/current_period_start/current_period_end/
--     cancel_at_period_end/canceled_at/payment_status/stripe_customer_id/
--     stripe_subscription_id/stripe_price_id are written ONLY by the
--     real Stripe webhook sync (lib/photographer_billing_service.mjs's
--     syncPhotographerSubscriptionFromStripe). The admin billing tool
--     now only ever writes admin_complimentary_access/admin_notes (see
--     lib/photographer_service.mjs's adminSetComplimentaryAccess,
--     replacing the old adminSetSubscription). Membership entitlement
--     becomes: a real active-and-current Stripe subscription, OR
--     admin_complimentary_access = true -- either is sufficient, and
--     they can never accidentally overwrite each other because they
--     are different columns written by different code paths.
--   - last_stripe_event_id / last_stripe_event_at: Stripe does not
--     guarantee webhook delivery order. Without this, a retried older
--     event delivered AFTER a newer one already updated the row could
--     silently overwrite current, correct state with stale state. The
--     webhook sync compares an incoming event's own `created` timestamp
--     against last_stripe_event_at before applying it, and skips (does
--     not touch the row at all) if the incoming event is older than
--     what's already recorded -- this is the guard that makes repeated/
--     out-of-order webhook delivery safe, on top of the upsert-by-
--     photographer_id shape (migration 16) already making simple
--     duplicate delivery of the SAME event a no-op.
--
-- Safety:
--   Purely additive -- five new nullable-or-safely-defaulted columns on
--   an existing table. No table dropped, no column dropped, no row
--   deleted, no existing constraint tightened.

begin;

alter table public.photographer_subscriptions
  add column if not exists stripe_price_id text,
  add column if not exists admin_complimentary_access boolean not null default false,
  add column if not exists admin_complimentary_granted_at timestamptz,
  add column if not exists last_stripe_event_id text,
  add column if not exists last_stripe_event_at timestamptz;

create index if not exists photographer_subscriptions_complimentary_index
  on public.photographer_subscriptions (admin_complimentary_access)
  where admin_complimentary_access = true;

commit;
