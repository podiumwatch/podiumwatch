-- Podium Watch Photographer Network -- Phase One
-- Purpose:
--   Database foundation for a statewide sports-photography directory:
--   athletes/parents/coaches search by school, city, or region to find
--   photographers who cover their sport nearby; photographers get a
--   public profile; Podium Watch admins control what's published.
--
-- Source of the design decisions below: the Phase Zero repository audit
-- (docs/DECISIONS.md, 2026-08-18) -- read that entry for the full
-- reasoning, not repeated in full here.
--
-- Design notes:
--   - Deliberately mirrors team_pages/team_members: `photographers` is
--     the identity/listing record, `photographer_members` is a separate
--     ownership join table (user_id, role, status), not a single
--     owner_user_id column on `photographers` itself. This is Phase
--     One's forward-looking piece: no self-serve photographer account
--     system exists yet (that's Phase Two), so nothing populates
--     photographer_members today, but the shape is right from the
--     start rather than requiring a schema change later.
--   - No lat/long or geocoding exists anywhere in this project (confirmed
--     by direct repo search). photographer_service_areas matches on
--     plain city/county/region text values instead of computed
--     distance -- region values reuse ohio_schools' own existing
--     Central/East/Northeast/Northwest/Southeast/Southwest taxonomy
--     (install/01_STATEWIDE_FOUNDATION_DATABASE.sql) rather than
--     inventing a second one.
--   - photographer_portfolio.image_url and photographers.profile_image_url/
--     logo_url are plain URL text columns, not an upload/Storage system.
--     Phase One has no photographer-facing upload flow (admin enters
--     everything manually, or a photographer's own externally-hosted
--     image URL is used directly) -- matching the project's existing
--     caution about not becoming responsible for hosting large photo
--     libraries. A real upload pipeline (mirroring
--     install/08_TEAM_MEDIA_UPLOADS.sql's pattern) is a later decision,
--     not assumed here.
--   - photographer_plans is a config table, seeded with the four named
--     tiers, with price_cents left null (pricing not finalized) -- no
--     billing logic of any kind exists yet. Confirmed: zero Stripe or
--     billing infrastructure exists anywhere in this project today.
--   - `status` is the single source of truth for the publication
--     workflow (draft/submitted/pending_review/approved/rejected/
--     suspended); `public_visible` is a separate admin kill-switch that
--     can hide an otherwise-approved listing without walking it back
--     through the status workflow -- the public directory/profile
--     queries always require BOTH status = 'approved' AND
--     public_visible = true.
--   - Sports and service areas are separate child tables (many rows per
--     photographer), not arrays on the parent row, matching this
--     project's established preference for relational join tables
--     (e.g. athlete_recruit_ratings' event-group taxonomy) over array
--     columns.
--
-- Safety:
--   This migration is purely additive. It creates six new tables and
--   seeds only photographer_plans (four rows describing tiers, no
--   pricing finalized, no billing wired up). It does not alter or drop
--   any existing table.

begin;

create extension if not exists pgcrypto;

create table if not exists public.photographer_plans (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null unique,
  -- Left null deliberately -- pricing is not finalized. Never hard code
  -- a price directly into a page template; read it from here so it can
  -- change without a code deploy.
  price_cents integer check (price_cents is null or price_cents >= 0),
  description text,
  sort_order integer not null default 0,
  active boolean not null default true
);

create table if not exists public.photographers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  business_name text not null,
  -- The individual's name, when different from the business name.
  -- Nullable -- a studio may only want the business name shown.
  photographer_name text,
  slug text not null unique,
  short_description text,
  about text,
  city text,
  state text,
  zip_code text,
  website_url text,
  instagram_url text,
  facebook_url text,
  business_email text,
  business_phone text,
  profile_image_url text,
  logo_url text,
  statewide_travel boolean not null default false,
  status text not null default 'draft' check (
    status in ('draft', 'submitted', 'pending_review', 'approved', 'rejected', 'suspended')
  ),
  featured boolean not null default false,
  founding_photographer boolean not null default false,
  -- Two states only, deliberately -- see the design note above. Never
  -- set to 'verified' just because a plan was purchased.
  verification_status text not null default 'unverified' check (
    verification_status in ('unverified', 'verified')
  ),
  plan_id uuid references public.photographer_plans(id) on delete set null,
  -- Independent of `status` -- see the design note above.
  public_visible boolean not null default true,
  admin_notes text,
  metadata jsonb not null default '{}'::jsonb
);

-- One row per (photographer, user) pair -- mirrors team_members exactly.
-- Not populated by anything yet in Phase One (no self-serve photographer
-- account system exists until Phase Two); the shape exists now so
-- ownership can be added later without a schema change.
create table if not exists public.photographer_members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  photographer_id uuid not null references public.photographers(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'owner',
  status text not null default 'active' check (status in ('active', 'revoked')),
  unique (photographer_id, user_id)
);

create table if not exists public.photographer_sports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  photographer_id uuid not null references public.photographers(id) on delete cascade,
  sport text not null check (sport in (
    'cross_country', 'track_and_field', 'football', 'soccer', 'basketball',
    'volleyball', 'wrestling', 'swimming', 'baseball', 'softball',
    'lacrosse', 'golf', 'tennis', 'cheer', 'gymnastics', 'other'
  )),
  unique (photographer_id, sport)
);

create table if not exists public.photographer_service_areas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  photographer_id uuid not null references public.photographers(id) on delete cascade,
  area_type text not null check (area_type in ('county', 'region', 'city')),
  -- For area_type = 'region', area_value is constrained to the same
  -- six named regions ohio_schools.athletic_district already uses --
  -- reusing that taxonomy rather than inventing a second one.
  area_value text not null,
  check (
    area_type <> 'region'
    or area_value in ('Central', 'East', 'Northeast', 'Northwest', 'Southeast', 'Southwest')
  ),
  unique (photographer_id, area_type, area_value)
);

create table if not exists public.photographer_portfolio (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  photographer_id uuid not null references public.photographers(id) on delete cascade,
  image_url text not null,
  caption text,
  sport text check (sport in (
    'cross_country', 'track_and_field', 'football', 'soccer', 'basketball',
    'volleyball', 'wrestling', 'swimming', 'baseball', 'softball',
    'lacrosse', 'golf', 'tennis', 'cheer', 'gymnastics', 'other'
  )),
  sort_order integer not null default 0,
  public_visible boolean not null default true
);

create index if not exists photographers_status_index
  on public.photographers (status, public_visible);

create index if not exists photographers_featured_index
  on public.photographers (featured) where featured = true;

create index if not exists photographer_members_photographer_index
  on public.photographer_members (photographer_id, status);

create index if not exists photographer_members_user_index
  on public.photographer_members (user_id, status);

create index if not exists photographer_sports_photographer_index
  on public.photographer_sports (photographer_id);

create index if not exists photographer_sports_sport_index
  on public.photographer_sports (sport);

create index if not exists photographer_service_areas_photographer_index
  on public.photographer_service_areas (photographer_id);

create index if not exists photographer_service_areas_lookup_index
  on public.photographer_service_areas (area_type, area_value);

create index if not exists photographer_portfolio_photographer_index
  on public.photographer_portfolio (photographer_id, sort_order);

create or replace function public.set_photographer_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists photographers_updated_at_trigger
  on public.photographers;
create trigger photographers_updated_at_trigger
before update on public.photographers
for each row execute function public.set_photographer_updated_at();

alter table public.photographer_plans enable row level security;
alter table public.photographers enable row level security;
alter table public.photographer_members enable row level security;
alter table public.photographer_sports enable row level security;
alter table public.photographer_service_areas enable row level security;
alter table public.photographer_portfolio enable row level security;

revoke all on table public.photographer_plans from anon, authenticated;
revoke all on table public.photographers from anon, authenticated;
revoke all on table public.photographer_members from anon, authenticated;
revoke all on table public.photographer_sports from anon, authenticated;
revoke all on table public.photographer_service_areas from anon, authenticated;
revoke all on table public.photographer_portfolio from anon, authenticated;

grant all on table public.photographer_plans to service_role;
grant all on table public.photographers to service_role;
grant all on table public.photographer_members to service_role;
grant all on table public.photographer_sports to service_role;
grant all on table public.photographer_service_areas to service_role;
grant all on table public.photographer_portfolio to service_role;

insert into public.photographer_plans (name, price_cents, description, sort_order, active)
values
  ('Founding Photographer', null, 'Launch offer for early photographers. Price not yet finalized.', 0, true),
  ('Basic', null, 'Public directory listing, profile, location, sports, service area, website, Instagram, basic portfolio.', 1, true),
  ('Featured', null, 'Everything in Basic, plus featured placement, additional portfolio images, and upcoming meet coverage.', 2, true),
  ('Pro', null, 'Everything in Featured, plus advanced analytics and expanded profile options.', 3, true)
on conflict (name) do nothing;

commit;
