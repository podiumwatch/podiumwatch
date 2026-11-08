-- Podium Watch 2026 Athlete of the Year and Team of the Year
-- Purpose:
--   16 categories (Athlete and Team of the Year, Boys and Girls, Divisions
--   I-IV), public nominations, finalists picked by the admin, then voting.
--   See lib/yearly_awards_2026_service.mjs.
--
-- Nominees:
--   Only real 2026 state qualifiers, from public/data/yearly-awards-2026-pool.json
--   (built by scripts/build-yearly-awards-2026-pool.mjs). The server checks
--   every nominee against that pool and its category before writing a row.
--   nominee_key is the Athletic.net ID for an athlete, and the ohio_schools
--   id for a team. Six state teams have no ohio_schools row; they use
--   "unmatched-<name>" with school_id left null. No athlete_profiles rows
--   are created.
--
-- Status:
--   Worked out from the timestamps on every request (no cron, no status
--   column). voting_closed_early_at and results_published_at are set from
--   the admin screen.
--
-- Identity:
--   browser_token_hash and ip_hash are HMAC-SHA256 hashes (VOTE_HASH_SECRET).
--   No email is collected; nominator_first_name is optional.
--
-- Votes:
--   Not stored here. Votes are Redis counters (Part 2).
--
-- Safety:
--   Additive only. Creates three new tables and seeds 16 category rows.
--   Does not touch the weekly aotw_/totw_ tables.

begin;

create extension if not exists pgcrypto;

create table if not exists public.yearly_award_categories (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  slug text not null unique,
  award text not null check (award in ('athlete', 'team')),
  gender text not null check (gender in ('boys', 'girls')),
  division integer not null check (division between 1 and 4),
  label text not null,
  season integer not null default 2026,
  nominations_open_at timestamptz not null,
  nominations_close_at timestamptz not null,
  voting_open_at timestamptz not null,
  voting_close_at timestamptz not null,
  voting_closed_early_at timestamptz,
  results_published_at timestamptz,
  unique (season, award, gender, division),
  check (nominations_open_at < nominations_close_at),
  check (nominations_close_at <= voting_open_at),
  check (voting_open_at < voting_close_at)
);

create table if not exists public.yearly_award_nominations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  category_id uuid not null references public.yearly_award_categories(id) on delete cascade,
  nominee_key text not null,
  athletic_net_id text,
  school_id uuid references public.ohio_schools(id) on delete set null,
  reason text check (reason is null or char_length(reason) <= 300),
  nominator_first_name text check (nominator_first_name is null or char_length(nominator_first_name) <= 40),
  browser_token_hash text not null,
  ip_hash text,
  -- One nomination per nominee per category per browser.
  unique (category_id, nominee_key, browser_token_hash)
);

create index if not exists yearly_award_nominations_category_index
  on public.yearly_award_nominations (category_id, nominee_key);

create index if not exists yearly_award_nominations_ip_index
  on public.yearly_award_nominations (ip_hash, created_at);

create table if not exists public.yearly_award_finalists (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  category_id uuid not null references public.yearly_award_categories(id) on delete cascade,
  nominee_key text not null,
  athletic_net_id text,
  school_id uuid references public.ohio_schools(id) on delete set null,
  display_name text not null,
  school text,
  note text check (note is null or char_length(note) <= 160),
  sort_order integer not null default 0,
  winner boolean not null default false,
  unique (category_id, nominee_key)
);

create index if not exists yearly_award_finalists_category_index
  on public.yearly_award_finalists (category_id, sort_order);

alter table public.yearly_award_categories enable row level security;
alter table public.yearly_award_nominations enable row level security;
alter table public.yearly_award_finalists enable row level security;

revoke all on table public.yearly_award_categories from anon, authenticated;
revoke all on table public.yearly_award_nominations from anon, authenticated;
revoke all on table public.yearly_award_finalists from anon, authenticated;
grant all on table public.yearly_award_categories to service_role;
grant all on table public.yearly_award_nominations to service_role;
grant all on table public.yearly_award_finalists to service_role;

-- Schedule (stored in UTC):
--   Nominations: open now (2026-11-08 00:00 UTC), close Mon Nov 9, 9:00 PM ET
--   Voting: Tue Nov 10, 12:00 AM ET to Fri Nov 13, 9:00 PM ET
insert into public.yearly_award_categories
  (slug, award, gender, division, label, nominations_open_at, nominations_close_at, voting_open_at, voting_close_at)
select v.slug, v.award, v.gender, v.division, v.label,
  timestamptz '2026-11-08 00:00:00+00',
  timestamptz '2026-11-10 02:00:00+00',
  timestamptz '2026-11-10 05:00:00+00',
  timestamptz '2026-11-14 02:00:00+00'
from (values
  ('athlete-boys-d1', 'athlete', 'boys', 1, 'Boys Division I Athlete of the Year'),
  ('athlete-boys-d2', 'athlete', 'boys', 2, 'Boys Division II Athlete of the Year'),
  ('athlete-boys-d3', 'athlete', 'boys', 3, 'Boys Division III Athlete of the Year'),
  ('athlete-boys-d4', 'athlete', 'boys', 4, 'Boys Division IV Athlete of the Year'),
  ('athlete-girls-d1', 'athlete', 'girls', 1, 'Girls Division I Athlete of the Year'),
  ('athlete-girls-d2', 'athlete', 'girls', 2, 'Girls Division II Athlete of the Year'),
  ('athlete-girls-d3', 'athlete', 'girls', 3, 'Girls Division III Athlete of the Year'),
  ('athlete-girls-d4', 'athlete', 'girls', 4, 'Girls Division IV Athlete of the Year'),
  ('team-boys-d1', 'team', 'boys', 1, 'Boys Division I Team of the Year'),
  ('team-boys-d2', 'team', 'boys', 2, 'Boys Division II Team of the Year'),
  ('team-boys-d3', 'team', 'boys', 3, 'Boys Division III Team of the Year'),
  ('team-boys-d4', 'team', 'boys', 4, 'Boys Division IV Team of the Year'),
  ('team-girls-d1', 'team', 'girls', 1, 'Girls Division I Team of the Year'),
  ('team-girls-d2', 'team', 'girls', 2, 'Girls Division II Team of the Year'),
  ('team-girls-d3', 'team', 'girls', 3, 'Girls Division III Team of the Year'),
  ('team-girls-d4', 'team', 'girls', 4, 'Girls Division IV Team of the Year')
) as v(slug, award, gender, division, label)
on conflict (slug) do nothing;

commit;
