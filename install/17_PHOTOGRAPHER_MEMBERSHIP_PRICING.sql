-- Podium Watch Photographer Network -- Membership Pricing Finalized
-- Purpose:
--   install/16_PHOTOGRAPHER_BILLING.sql has already been applied to the
--   real production database (confirmed live in the Phase Four report).
--   This is the NEXT additive migration, not an edit to 16 -- 16 is never
--   modified, so migration history stays consistent with what's already
--   run. This migration reshapes the entitlement layer to match the
--   final, real business decision: one Photographer Network membership,
--   two recurring billing intervals (monthly $7.99, annual $39.99), both
--   granting identical core features, with a one-time launch benefit
--   (a partnership announcement story) for annual members only.
--
-- Design notes:
--   - Purely additive to `photographer_subscriptions`: five new nullable
--     (or safely-defaulted) columns, no existing column touched, no
--     existing row's meaning changed. Every row created by migration 16
--     (there should be none yet in a fresh install, and any real ones
--     keep working) continues to read exactly as before; the new columns
--     just start null/default until set.
--   - `billing_interval` ('monthly' | 'annual') replaces the old
--     Basic/Featured/Pro *tier* concept for entitlement purposes -- there
--     is now exactly one membership, distinguished only by how often it's
--     paid, not by which features it unlocks. Both intervals grant
--     identical core functionality; nothing in this codebase reads
--     billing_interval to gate a feature except partnership-story
--     eligibility (annual only), matching the business decision exactly.
--   - `current_period_start`, `canceled_at`, `payment_status` fill in the
--     billing facts the finalized model needs to distinguish, alongside
--     the `current_period_end`/`cancel_at_period_end`/`status` columns
--     migration 16 already added.
--   - Deliberately NOT added: a stored "membership entitlement status"
--     column. Whether a photographer's membership is currently entitled
--     to perks stays a DERIVED read (status = 'active' AND
--     current_period_end is null or still in the future) computed in
--     lib/photographer_service.mjs, exactly like migration 16 already
--     established. Storing that as a second column would create two
--     sources of truth that can drift out of sync (the classic "stale
--     active status past its own expiration" bug migration 16's own
--     tests already proved must never happen) -- so this migration keeps
--     the existing, already-proven pattern instead of duplicating it.
--   - `partnership_story_status` lives on `photographer_subscriptions`
--     (workflow/state, one value, quick to check) rather than on the new
--     `photographer_partnership_stories` table below (content). This
--     mirrors the existing `photographers.status` (workflow) vs.
--     `photographer_portfolio` (content rows) split from install/14 --
--     one column drives the workflow, a separate table holds the
--     submitted content. Progression is one-way and never resets:
--     not_eligible -> eligible -> info_submitted -> in_review ->
--     published. Once a photographer reaches 'published' (or anything
--     past 'not_eligible'), a later downgrade, cancellation, or repeated
--     monthly<->annual plan switch never grants a second story and never
--     rewinds this column -- application code only ever advances it
--     forward, and only out of 'not_eligible' the first time a
--     subscription is confirmed active AND annual.
--   - `photographer_partnership_stories`: one row per photographer
--     (unique photographer_id), created on first submission. Holds only
--     the raw submitted content and the admin's review notes/published
--     reference -- publishing the actual announcement story still goes
--     through this project's existing editorial content pipeline
--     (a real Markdown file under content/stories/, reviewed and
--     committed like any other story) exactly like every other article
--     on this site. This table never auto-publishes anything; it is the
--     intake/review record, not the CMS.
--
-- Retiring the old tiers (data-only, not destructive):
--   Basic / Featured / Pro / "Founding Photographer" (the seeded
--   photographer_plans rows from install/14) no longer describe anything
--   real -- there is one membership now, and Founding Photographer is a
--   separate, permanent admin-awarded badge (photographers.founding_
--   photographer, already existed since install/14, untouched by this
--   migration) rather than a plan a photographer selects. Per this
--   project's standing rule against destroying data without proof it's
--   safe, none of the four rows are deleted -- `photographer_plans.active`
--   (already existed since install/14) is simply flipped to false on all
--   four, exactly the retirement mechanism that column was designed for.
--   A single new row represents the real product going forward. Any
--   photographer whose photographers.plan_id still points at a retired
--   row keeps that historical value; nothing here reassigns it, and
--   nothing in the application reads plan_id for entitlement anymore
--   (billing_interval + status on photographer_subscriptions is the only
--   source of truth for what a photographer's membership actually grants).
--
-- Safety:
--   Purely additive: new columns (nullable or safely defaulted) on an
--   existing table, one new child table, and a data-only UPDATE/INSERT
--   against photographer_plans. No table dropped, no column dropped, no
--   row deleted, no existing constraint tightened in a way that could
--   reject previously-valid data.

begin;

alter table public.photographer_subscriptions
  add column if not exists billing_interval text check (billing_interval in ('monthly', 'annual')),
  add column if not exists current_period_start timestamptz,
  add column if not exists canceled_at timestamptz,
  add column if not exists payment_status text check (payment_status in ('succeeded', 'failed', 'pending')),
  add column if not exists partnership_story_status text not null default 'not_eligible' check (
    partnership_story_status in ('not_eligible', 'eligible', 'info_submitted', 'in_review', 'published')
  );

create table if not exists public.photographer_partnership_stories (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  photographer_id uuid not null unique references public.photographers(id) on delete cascade,
  business_name text,
  photographer_name text,
  city_or_area text,
  biography text,
  sports_covered text,
  areas_covered text,
  how_started text,
  services_offered text,
  website_url text,
  instagram_url text,
  facebook_url text,
  -- Approved images the photographer has confirmed Podium Watch may use
  -- in the article -- plain URLs, matching this project's existing
  -- external-URL-only approach to photographer imagery (no upload/
  -- storage pipeline exists for photographer content; see install/14).
  image_urls jsonb not null default '[]'::jsonb,
  admin_notes text,
  -- Set once Podium Watch actually writes and publishes the real
  -- Markdown story -- a reference for admins, never a trigger that
  -- auto-publishes anything.
  published_story_url text,
  submitted_at timestamptz,
  published_at timestamptz
);

create index if not exists photographer_partnership_stories_photographer_index
  on public.photographer_partnership_stories (photographer_id);

-- Reuses install/14's generic set_photographer_updated_at() trigger
-- function (new.updated_at = now(), no table-specific field references)
-- rather than defining a duplicate function for the same behavior.
drop trigger if exists photographer_partnership_stories_updated_at_trigger
  on public.photographer_partnership_stories;
create trigger photographer_partnership_stories_updated_at_trigger
before update on public.photographer_partnership_stories
for each row execute function public.set_photographer_updated_at();

alter table public.photographer_partnership_stories enable row level security;

revoke all on table public.photographer_partnership_stories from anon, authenticated;
grant all on table public.photographer_partnership_stories to service_role;

-- Retire the old per-tier plan rows (data-only, non-destructive -- see
-- design notes above). `active` already existed on photographer_plans
-- since install/14; this is exactly its intended use.
update public.photographer_plans
set active = false
where name in ('Founding Photographer', 'Basic', 'Featured', 'Pro');

insert into public.photographer_plans (name, price_cents, description, sort_order, active)
values (
  'Photographer Network Membership',
  null, -- two recurring prices (monthly/annual), not one flat price -- see lib/photographer_membership_config.mjs
  'The one Podium Watch Photographer Network membership. Monthly ($7.99/mo) and annual ($39.99/yr) billing options grant identical core features; annual additionally includes one Podium Watch partnership announcement story.',
  0,
  true
)
on conflict (name) do nothing;

commit;
