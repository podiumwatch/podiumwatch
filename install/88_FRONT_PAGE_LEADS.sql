-- Podium Watch: front page lead story (WO-43)
-- Purpose:
--   1. front_page_leads: each story an admin makes the homepage lead, with
--      a start time and an optional end time. One lead shows at a time:
--      the latest-starting lead whose window covers "now". Future leads
--      wait in the queue; a later start takes over from an earlier one.
--      With no lead set, the homepage leads with the newest published
--      story (not recorded here).
--      Story details (title, summary, kicker, photo and credit, byline,
--      date) are copied in when the lead is set, so the homepage, the
--      /front-page/ archive and the share cards never need the story file.
--      linked_profile_ids / linked_team_ids are the athletes and teams the
--      admin marked as featured; their profiles show "Featured on the
--      Podium Watch front page".
--   2. front_page_lead_events: every change (scheduled, edited, ended
--      early, cancelled), with who and when.
--
-- Safety: two new tables, service role only (RLS on, no public policies;
-- the site reads them through server functions). Nothing else changes.

begin;

create table if not exists public.front_page_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  story_slug text not null check (story_slug ~ '^[a-z0-9-]{1,200}$'),
  title text not null check (char_length(title) between 1 and 300),
  summary text check (summary is null or char_length(summary) <= 500),
  kicker text check (kicker is null or char_length(kicker) <= 40),
  image_url text check (image_url is null or char_length(image_url) <= 600),
  image_alt text check (image_alt is null or char_length(image_alt) <= 400),
  image_credit text check (image_credit is null or char_length(image_credit) <= 200),
  byline text check (byline is null or char_length(byline) <= 200),
  story_date date,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  linked_profile_ids uuid[] not null default '{}',
  linked_team_ids uuid[] not null default '{}',
  created_by text,
  cancelled_at timestamptz,
  cancelled_by text,
  check (ends_at is null or ends_at > starts_at)
);

create index if not exists front_page_leads_starts_index on public.front_page_leads (starts_at desc) where status = 'scheduled';
create index if not exists front_page_leads_story_index on public.front_page_leads (story_slug);
create index if not exists front_page_leads_profiles_index on public.front_page_leads using gin (linked_profile_ids);
create index if not exists front_page_leads_teams_index on public.front_page_leads using gin (linked_team_ids);

create table if not exists public.front_page_lead_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lead_id uuid not null references public.front_page_leads(id) on delete cascade,
  action text not null check (action in ('scheduled', 'edited', 'ended_early', 'cancelled')),
  actor text,
  details jsonb not null default '{}'::jsonb
);

create index if not exists front_page_lead_events_lead_index on public.front_page_lead_events (lead_id, created_at desc);

alter table public.front_page_leads enable row level security;
alter table public.front_page_lead_events enable row level security;

commit;

-- Check after running:
-- select count(*) from public.front_page_leads;   -- 0
