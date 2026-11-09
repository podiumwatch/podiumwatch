-- Podium Watch: site sponsor click counting (WO-25)
-- Purpose:
--   Every sponsor link on a ranking page goes through
--   /go/{sponsor}/{placement}/ (api/go/[sponsor]/[placement].js), which
--   records one row here and then redirects to the sponsor. The admin
--   Sponsor Report (/admin/sponsor-report/) reads clicks from here and
--   impressions from the page views already recorded in
--   team_analytics_events (event_type page_view).
--
-- Sponsors and placements themselves live in src/data/sponsors.json, not
-- in a table: the existing team_sponsors / team_sponsor_placements tables
-- are the team-page sponsor feature (team-scoped placement types, a
-- required destination link), and are left as they are.
--
-- Privacy:
--   sponsor, placement, the page the click came from, time and device
--   class only. No IP address, no visitor id.
--
-- Safety:
--   Additive only: one new table, service role only.

begin;

create extension if not exists pgcrypto;

create table if not exists public.site_sponsor_clicks (
  id uuid primary key default gen_random_uuid(),
  clicked_at timestamptz not null default now(),
  sponsor_id text not null check (sponsor_id ~ '^[a-z0-9-]{1,80}$'),
  placement_id text not null check (placement_id ~ '^[a-z0-9-]{1,80}$'),
  page_path text check (page_path is null or char_length(page_path) <= 300),
  device_class text check (device_class in ('phone', 'tablet', 'desktop', 'bot', 'unknown'))
);

create index if not exists site_sponsor_clicks_lookup
  on public.site_sponsor_clicks (sponsor_id, clicked_at desc);

alter table public.site_sponsor_clicks enable row level security;
revoke all on table public.site_sponsor_clicks from anon, authenticated;
grant all on table public.site_sponsor_clicks to service_role;

commit;
