-- Podium Watch: "Partner with Podium Watch" page (WO-26)
-- Purpose:
--   /sponsors/ becomes the partner page. Two things it needs that only
--   Zachary can supply are stored here and edited at /admin/partner-page/:
--     - partner_page_settings: Instagram reach (typed in from Instagram's
--       own insights), the as-of date, and each package's price and
--       whether it's offered. Prices are never hard-coded in the site.
--     - partner_inquiries: every inquiry from the page's form. The form
--       also emails media@podiumwatch.org; this table keeps the record.
--   Site audience numbers (visitors, page views) are computed live from
--   the page_view events already recorded on every page.
--
-- Privacy:
--   An inquiry stores what the person typed (name, organization, email,
--   package, message) and a hashed network address for rate limiting.
--
-- Safety:
--   Additive only: two new tables (one seeded with an empty settings
--   row), service role only.

begin;

create extension if not exists pgcrypto;

create table if not exists public.partner_page_settings (
  id integer primary key default 1 check (id = 1),
  updated_at timestamptz not null default now(),
  instagram_followers integer check (instagram_followers is null or instagram_followers >= 0),
  instagram_monthly_reach integer check (instagram_monthly_reach is null or instagram_monthly_reach >= 0),
  instagram_as_of date,
  packages jsonb not null default '{}'::jsonb
);

insert into public.partner_page_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.partner_inquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 120),
  organization text check (organization is null or char_length(organization) <= 160),
  email text not null check (char_length(email) between 3 and 254),
  package text check (package is null or char_length(package) <= 80),
  message text check (message is null or char_length(message) <= 2000),
  ip_hash text,
  status text not null default 'new' check (status in ('new', 'replied', 'closed'))
);

create index if not exists partner_inquiries_created on public.partner_inquiries (created_at desc);

alter table public.partner_page_settings enable row level security;
alter table public.partner_inquiries enable row level security;
revoke all on table public.partner_page_settings from anon, authenticated;
revoke all on table public.partner_inquiries from anon, authenticated;
grant all on table public.partner_page_settings to service_role;
grant all on table public.partner_inquiries to service_role;

commit;
