-- Podium Watch: typeable short links (WO-34)
-- Purpose:
--   Instagram captions can't hold clickable links, so people type what a
--   graphic shows. Short paths like podiumwatch.org/state point at the
--   exact page a post is about and can be repointed next season (they
--   answer with a temporary 302). Managed at /admin/short-links/, served
--   by api/s/[path].js. (The handoff reserved 82 for this file; 82 and 83
--   were used by WO-03 and WO-04, so it is 84.)
--
-- Privacy:
--   A hit stores the path, time, the referring site's host name and a
--   device class (phone, tablet, desktop, bot). No IP address, no
--   visitor id, nothing personal.
--
-- Safety:
--   Additive only: two new tables, service role only.

begin;

create extension if not exists pgcrypto;

create table if not exists public.short_links (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  path text not null unique check (path ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  destination text not null check (destination ~ '^/' or destination ~ '^https://'),
  label text check (label is null or char_length(label) <= 120),
  campaign text check (campaign is null or char_length(campaign) <= 80),
  active boolean not null default true
);

create table if not exists public.short_link_hits (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  hit_at timestamptz not null default now(),
  referrer_host text check (referrer_host is null or char_length(referrer_host) <= 120),
  device_class text check (device_class in ('phone', 'tablet', 'desktop', 'bot', 'unknown'))
);

create index if not exists short_link_hits_path_time
  on public.short_link_hits (path, hit_at desc);

alter table public.short_links enable row level security;
alter table public.short_link_hits enable row level security;
revoke all on table public.short_links from anon, authenticated;
revoke all on table public.short_link_hits from anon, authenticated;
grant all on table public.short_links to service_role;
grant all on table public.short_link_hits to service_role;

commit;
