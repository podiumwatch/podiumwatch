-- Podium Watch Photographer Network -- Phase Four (entitlement layer only)
-- Purpose:
--   The database and entitlement architecture for photographer billing --
--   deliberately NOT a Stripe integration. Per the original spec's own
--   explicit instruction: "Do not immediately implement a payment
--   provider... If Stripe does not exist, build the database and
--   entitlement architecture first, then show me the proposed Stripe
--   implementation before adding billing." Confirmed in the Phase Zero
--   audit: zero Stripe or billing infrastructure exists anywhere in this
--   project. This migration makes real entitlement-granting possible
--   TODAY (an admin can activate a photographer's plan manually, e.g.
--   for an early/offline payment) without inventing any payment
--   processor details.
--
-- Design notes:
--   - One row per photographer (unique photographer_id), representing
--     their CURRENT subscription state -- not a full billing-event
--     history table. If real payment history/audit ever becomes
--     necessary once Stripe webhooks are actually flowing, that's a
--     future additive table, not a redesign of this one.
--   - Which PLAN a photographer is on is deliberately still tracked on
--     `photographers.plan_id` (already existed since Phase One) --
--     this table only tracks whether that plan is actually paid for and
--     in good standing (status/period/cancellation), not which plan it
--     is. Avoids duplicating plan_id in two places.
--   - stripe_customer_id / stripe_subscription_id are real columns,
--     already shaped for when Stripe is wired up later, but stay null
--     for every row created by this pass -- there is no Stripe
--     integration yet, so nothing here is fabricated Stripe data.
--   - status defaults to 'inactive' (no admin action taken yet).
--     'active'/'trialing'/'past_due'/'canceled' mirror Stripe's own
--     subscription status vocabulary directly, specifically so that a
--     future webhook handler can write into this table with zero
--     status-mapping logic of its own.
--
-- Safety:
--   Purely additive. One new table, nothing existing altered.

begin;

create extension if not exists pgcrypto;

create table if not exists public.photographer_subscriptions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  photographer_id uuid not null unique references public.photographers(id) on delete cascade,
  status text not null default 'inactive' check (
    status in ('inactive', 'active', 'trialing', 'past_due', 'canceled')
  ),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  admin_notes text
);

create index if not exists photographer_subscriptions_status_index
  on public.photographer_subscriptions (status);

create or replace function public.set_photographer_subscription_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists photographer_subscriptions_updated_at_trigger
  on public.photographer_subscriptions;
create trigger photographer_subscriptions_updated_at_trigger
before update on public.photographer_subscriptions
for each row execute function public.set_photographer_subscription_updated_at();

alter table public.photographer_subscriptions enable row level security;

revoke all on table public.photographer_subscriptions from anon, authenticated;

grant all on table public.photographer_subscriptions to service_role;

commit;
