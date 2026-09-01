-- Podium Watch -- Podium Play Accounts (My Podium account bridge)
--
-- Purpose:
--   Server-authoritative points/records for a signed-in My Podium user,
--   backing the Podium Play leaderboard. The guest (local-only,
--   localStorage) profile in public/scripts/podium-play.js is untouched
--   by this -- it keeps working exactly as before for anyone not signed
--   in, and is never blindly merged into an account's points here (a
--   local total can't be verified after the fact; see
--   lib/podium_play_service.mjs's own header for why). Once signed in,
--   NEW game attempts are additionally submitted to the server, which
--   independently recomputes score/points from the raw inputs -- never
--   trusts a client-calculated point total, matching the explicit rule
--   this whole feature was built under.
--
-- Design notes (mirrors install/31_MY_PODIUM_ACCOUNTS.sql exactly):
--   - user_id uuid not null unique, no FK to auth.users -- matches every
--     existing ownership table in this project.
--   - display_name is a denormalized snapshot of the account's real My
--     Podium display name (auth.users.raw_user_meta_data), refreshed on
--     every submission -- auth.users lives in a separate schema not
--     joinable via the normal public REST API, and the leaderboard needs
--     to show many accounts' names in one query. Length-capped and
--     control-character-stripped before storage (see cleanDisplayName in
--     lib/podium_play_service.mjs) -- NOT a profanity filter, which this
--     codebase has no existing utility for; a real, disclosed limitation,
--     not a silent gap.
--   - Three independent personal-record columns per game (not one JSON
--     blob) so the leaderboard/points logic can query and compare them
--     directly, matching the local guest profile's own three-independent-
--     bests shape for Hurdle Dash.
--   - points_awarded_date/points_awarded_today mirror the local guest
--     profile's own daily-cap fields exactly, server-side.
--   - last_submission_at is a simple rate-limit gate (see
--     RATE_LIMIT_MIN_INTERVAL_MS in lib/podium_play_service.mjs) --
--     every real Podium Play game has its own real minimum completion
--     time already, so this only needs to catch a scripted flood, not
--     throttle real play.
--   - No RLS policies for anon/authenticated -- matches this project's
--     universal pattern: enable row level security, revoke all from
--     anon/authenticated, grant all to service_role. Authorization
--     happens entirely in application code via lib/my_podium_auth.mjs,
--     reused unchanged from every other My Podium endpoint.
--
-- Safety:
--   Purely additive. Creates exactly one new table. Does not alter or
--   drop any existing table, column, or row.

begin;

create extension if not exists pgcrypto;

create table if not exists public.podium_play_accounts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null unique,
  display_name text,
  points integer not null default 0 check (points >= 0),
  points_awarded_date date,
  points_awarded_today integer not null default 0 check (points_awarded_today >= 0),
  photo_finish_best_diff_seconds numeric,
  photo_finish_best_elapsed_seconds numeric,
  starting_gun_best_reaction_ms numeric,
  starting_gun_best_suspicious boolean not null default false,
  hurdle_dash_best_distance integer,
  hurdle_dash_best_hurdles_cleared integer,
  hurdle_dash_best_game_score integer,
  last_submission_at timestamptz
);

create index if not exists podium_play_accounts_user_index
  on public.podium_play_accounts (user_id);

-- Powers the leaderboard's own top-N query and the "your rank" count.
create index if not exists podium_play_accounts_points_index
  on public.podium_play_accounts (points desc);

create or replace function public.set_podium_play_accounts_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists podium_play_accounts_updated_at_trigger
  on public.podium_play_accounts;
create trigger podium_play_accounts_updated_at_trigger
before update on public.podium_play_accounts
for each row execute function public.set_podium_play_accounts_updated_at();

alter table public.podium_play_accounts enable row level security;

revoke all on table public.podium_play_accounts from anon, authenticated;

grant all on table public.podium_play_accounts to service_role;

commit;
