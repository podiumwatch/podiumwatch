-- Podium Watch: Banquet Pack coach settings (WO-35)
-- Purpose:
--   A coach on a claimed team can hide athletes from the team's Banquet Pack
--   (/teams/{slug}/season/2026/banquet/) and add a short note. Nobody can
--   edit times: the pack reads results as stored. One row per team and
--   season. Written only by the server (service role) after it checks the
--   coach's team membership.
--
-- Safety: one new table. No existing rows are changed or deleted.

begin;

create table if not exists public.team_banquet_settings (
  team_id uuid not null references public.team_pages(id) on delete cascade,
  season_year integer not null check (season_year between 2000 and 2200),
  hidden_profile_ids uuid[] not null default '{}',
  note text check (note is null or char_length(note) <= 280),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (team_id, season_year)
);

alter table public.team_banquet_settings enable row level security;
-- No policies: only the server's service role reads or writes this table.

commit;

-- Check after running:
-- select count(*) from public.team_banquet_settings;  -- 0
