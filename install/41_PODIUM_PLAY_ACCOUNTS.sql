-- Podium Watch -- Podium Play Accounts (My Podium account bridge + guests)
--
-- Purpose:
--   Server-authoritative points/records backing the Podium Play
--   leaderboard -- for a signed-in My Podium user AND for a guest who
--   never signs in at all (explicit direction, 2026-09-01: "I also want
--   people who havent signed in to be able to be on the leaderboard,
--   something like podiumwatchguest(random set of numbers)"). The local
--   (localStorage) guest profile in public/scripts/podium-play.js is
--   untouched by this -- it keeps working exactly as before regardless
--   of sign-in state, and a local point total is never blindly copied
--   into this table (a local total can't be verified after the fact; see
--   lib/podium_play_service.mjs's own header for why). A row here always
--   starts from 0 and accumulates only from real, server-validated game
--   attempts, computed independently from raw inputs -- never trusted
--   from a client-calculated score or point total, whether the caller is
--   signed in or a guest.
--
-- Two identity kinds, one table:
--   - A signed-in row is keyed by user_id (a real My Podium / Supabase
--     Auth account, verified server-side on every request via
--     lib/my_podium_auth.mjs -- unchanged from before this file added
--     guests).
--   - A guest row is keyed by install_id -- the SAME anonymous
--     crypto.randomUUID() the local guest profile already generates and
--     persists in localStorage (podiumWatch.podiumPlay.profile.v1,
--     public/scripts/podium-play.js). This is NOT an authenticated
--     identity the way user_id is -- nothing server-side proves a given
--     install_id actually belongs to the browser presenting it, the same
--     way nothing proves who is behind an anonymous vote. A real,
--     disclosed trade-off of a no-signup leaderboard entry, not a silent
--     gap: the raw-input validation (lib/podium_play_service.mjs's
--     validateRawInput) and the per-identity rate limit (last_submission_at)
--     both still apply equally to guest rows, so no single guest identity
--     can report an unrealistic score or flood submissions -- but a
--     determined caller could still script many distinct fake install_ids
--     to create many small guest rows, the same class of risk this
--     project already accepts for e.g. anonymous poll/vote participation.
--     display_name for a new guest row is server-assigned once
--     ("podiumwatchguest" + a random 4-digit number, see
--     generateGuestLabel() in lib/podium_play_service.mjs) and reused on
--     every later submission from that same install_id -- never client-
--     supplied, so a guest can never pick an impersonating or offensive
--     label.
--   - Exactly one of user_id/install_id is set on any row, enforced by
--     podium_play_accounts_identity_check below -- never both, never
--     neither.
--
-- Design notes (mirrors install/31_MY_PODIUM_ACCOUNTS.sql where it
-- still applies -- user_id itself is no longer `not null` here, the one
-- deliberate departure, to make room for a guest row):
--   - No FK to auth.users on user_id -- matches every existing ownership
--     table in this project.
--   - display_name is denormalized -- a signed-in row's is a snapshot of
--     the account's real My Podium display name (auth.users.raw_user_
--     meta_data), refreshed on every submission; a guest row's is the
--     server-assigned guest label, set once. auth.users lives in a
--     separate schema not joinable via the normal public REST API, and
--     the leaderboard needs to show many rows' names in one query.
--     Length-capped and control-character-stripped before storage (see
--     cleanDisplayName in lib/podium_play_service.mjs) -- NOT a
--     profanity filter, which this codebase has no existing utility for;
--     a real, disclosed limitation, not a silent gap.
--   - Three independent personal-record columns per game (not one JSON
--     blob) so the leaderboard/points logic can query and compare them
--     directly, matching the local guest profile's own three-independent-
--     bests shape for Hurdle Dash.
--   - points_awarded_date/points_awarded_today mirror the local guest
--     profile's own daily-cap fields exactly, server-side, for both
--     identity kinds equally.
--   - last_submission_at is a simple rate-limit gate (see
--     RATE_LIMIT_MIN_INTERVAL_MS in lib/podium_play_service.mjs) --
--     every real Podium Play game has its own real minimum completion
--     time already, so this only needs to catch a scripted flood, not
--     throttle real play.
--   - No RLS policies for anon/authenticated -- matches this project's
--     universal pattern: enable row level security, revoke all from
--     anon/authenticated, grant all to service_role. Authorization
--     happens entirely in application code (lib/my_podium_auth.mjs for
--     the signed-in path, a validated-UUID check for the guest path, both
--     in lib/podium_play_service.mjs).
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
  user_id uuid,
  install_id uuid,
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
  last_submission_at timestamptz,
  constraint podium_play_accounts_identity_check
    check ((user_id is not null and install_id is null) or (user_id is null and install_id is not null))
);

create unique index if not exists podium_play_accounts_user_unique
  on public.podium_play_accounts (user_id) where user_id is not null;

create unique index if not exists podium_play_accounts_install_unique
  on public.podium_play_accounts (install_id) where install_id is not null;

-- Powers the leaderboard's own top-N query and the "your rank" count,
-- across both identity kinds equally.
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
