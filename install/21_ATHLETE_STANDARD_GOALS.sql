-- Athlete Standard Goals (the "goal book")
-- Purpose:
--   A goal an athlete is chasing shouldn't only exist inside one specific
--   race. Today race_goals is scoped entirely to race_participants (one
--   race, one athlete, one number) with no idea what distance that number
--   is even for -- which is exactly why the existing "carry the goal
--   forward from their most recent race" feature (copyMostRecentGoals())
--   can silently port a 2-mile goal forward as a "5K goal": it sorts by
--   date only, never by distance. This table gives every athlete one
--   goal PER standard distance, independent of any single race, so a
--   coach (and eventually the athlete) sets it once and it's the right
--   number every time that distance comes up again.
--
-- Design notes:
--   - Distances are bucketed into a small, fixed set of the distances
--     Ohio HS/JH cross country and track actually race, rather than
--     matching on exact meters -- a certified "5K" course is rarely
--     literally 5000.00m, and a coach thinks in "5K"/"2 Mile", not raw
--     meters. 1600m and the Mile are treated as one bucket (0.6%
--     difference, meaningless for pacing); same for 3200m and 2 Mile.
--     A real race's distance_meters maps to whichever bucket is
--     numerically closest -- see nearestDistanceBucket() in
--     lib/athlete_goal_service.mjs, the one place that mapping lives.
--   - Keyed by team_athlete_id, never by race_participant_id or season --
--     a goal book entry survives across seasons and even a roster season
--     move (see the Team Roster "move to a different season" feature)
--     since it's tied to the athlete, not to any one roster placement.
--   - One row per (athlete, distance bucket) -- setting a new goal for a
--     distance replaces the old one outright; this is "what am I
--     chasing right now," not a history of every goal ever set. A
--     bigger goal-history/PR-tracking feature, if ever wanted, is a
--     separate concern from this table.
--   - RLS posture matches every other Race Command Center / roster table
--     in this codebase: revoke all from anon/authenticated, all access
--     goes through supabaseAdmin in application code, never a Postgres
--     policy.
--
-- Safety:
--   Purely additive. One new table, nothing existing altered.

begin;

create extension if not exists pgcrypto;

create table if not exists public.athlete_standard_goals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  team_athlete_id uuid not null references public.team_athletes(id) on delete cascade,
  distance_bucket text not null check (
    distance_bucket in ('800m', '1600m', '3200m', '3000m', '4000m', '5000m', '8000m')
  ),
  goal_seconds numeric not null check (goal_seconds > 0),
  updated_by_user_id uuid,
  unique (team_athlete_id, distance_bucket)
);

create index if not exists athlete_standard_goals_athlete_index
  on public.athlete_standard_goals (team_athlete_id);

create or replace function public.set_athlete_standard_goal_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists athlete_standard_goals_updated_at_trigger
  on public.athlete_standard_goals;
create trigger athlete_standard_goals_updated_at_trigger
before update on public.athlete_standard_goals
for each row execute function public.set_athlete_standard_goal_updated_at();

alter table public.athlete_standard_goals enable row level security;

revoke all on table public.athlete_standard_goals from anon, authenticated;
grant all on table public.athlete_standard_goals to service_role;

commit;
