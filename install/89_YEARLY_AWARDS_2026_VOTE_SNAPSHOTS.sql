-- Podium Watch: 2026 Athlete, Team and Coach of the Year vote snapshots
-- Purpose:
--   Votes live in Redis (lib/yearly_awards_2026_votes.mjs). This table
--   keeps a copy of the tallies in Postgres so no votes are lost if Redis
--   has a problem:
--     kind = 'hourly': once an hour, one row per finalist with its running
--       vote total at that time (snapshot_at = the top of the hour, UTC).
--     kind = 'final': once, when a category's voting closes (Fri Nov 13,
--       9:00 PM ET), the frozen final tallies with the time they were taken.
--       Final rows are never overwritten.
--   Written by api/cron/awards-2026-votes.js (every 5 minutes; it writes
--   only when an hourly or final snapshot is due).
--
-- Safety: one new table, service role only (RLS on, no public policies).
-- About 120 small rows per hour while voting is open.

begin;

create table if not exists public.yearly_award_vote_snapshots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  category_id uuid not null references public.yearly_award_categories(id) on delete cascade,
  category_slug text not null,
  kind text not null check (kind in ('hourly', 'final')),
  snapshot_at timestamptz not null,
  finalist_key text not null,
  finalist_name text,
  votes integer not null check (votes >= 0),
  category_total integer not null check (category_total >= 0),
  category_voided integer not null default 0 check (category_voided >= 0),
  unique (category_slug, kind, snapshot_at, finalist_key)
);

create index if not exists yearly_award_vote_snapshots_lookup_index
  on public.yearly_award_vote_snapshots (category_slug, kind, snapshot_at desc);

alter table public.yearly_award_vote_snapshots enable row level security;

commit;

-- Check after running:
-- select count(*) from public.yearly_award_vote_snapshots;   -- 0
