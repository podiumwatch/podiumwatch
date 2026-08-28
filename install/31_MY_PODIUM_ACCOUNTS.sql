-- Podium Watch -- My Podium Accounts (Project 5, Slice B)
--
-- Purpose:
--   A new, lightweight, self-serve account so a My Podium visitor can
--   sync their own device-local preferences (followed team, sport,
--   gender, followed athletes -- see public/scripts/my-podium-store.js)
--   across more than one device. Modeled on this project's OPEN
--   self-serve account pattern (lib/team_auth.mjs, lib/photographer_auth.mjs
--   -- anyone can sign up, no invite needed), NOT the coach-invite-only
--   pattern (athlete_accounts/guardian_accounts) -- a My Podium account
--   only ever grants a signed-in user access to their OWN preferences,
--   never another person's data, and never any athlete's private
--   information. See docs/MY_PODIUM_MASTER_BUILD_PLAN.md, Project 5.
--
-- Design notes:
--   - user_id uuid not null, no FK to auth.users -- matches every
--     existing ownership table in this project (photographer_members,
--     team_members, confirmed in install/14_PHOTOGRAPHER_NETWORK.sql).
--     unique(user_id) enforces exactly one row per account.
--   - preferences jsonb is one opaque document, not a normalized
--     relational schema -- it's a server-side mirror of exactly what
--     public/scripts/my-podium-store.js's getPreferences() already
--     produces locally. Re-normalizing it server-side would just be a
--     second schema to keep in sync with the local one for no benefit.
--   - client_updated_at is a denormalized copy of the synced
--     preferences.updatedAt field (indexable/comparable without
--     unpacking jsonb), used by api/my-podium/sync.js for last-write-
--     wins conflict resolution between two devices.
--   - No RLS policies for anon/authenticated -- matches this project's
--     universal pattern (install/01 onward): enable row level
--     security, revoke all from anon/authenticated, grant all to
--     service_role. Authorization happens entirely in application code
--     via lib/my_podium_auth.mjs (mirroring team_auth.mjs/
--     photographer_auth.mjs exactly), never client-direct-to-Supabase
--     RLS policies -- this project has never used that pattern and
--     this table does not start.
--   - No email column -- an account's email lives in Supabase Auth
--     (auth.users), read via supabaseAdmin when needed, matching
--     team_members/photographer_members.
--
-- Safety:
--   Purely additive. Creates exactly one new table. Does not alter or
--   drop any existing table, column, or row.

begin;

create extension if not exists pgcrypto;

create table if not exists public.my_podium_accounts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null unique,
  preferences jsonb not null default '{}'::jsonb,
  client_updated_at timestamptz
);

create index if not exists my_podium_accounts_user_index
  on public.my_podium_accounts (user_id);

create or replace function public.set_my_podium_accounts_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists my_podium_accounts_updated_at_trigger
  on public.my_podium_accounts;
create trigger my_podium_accounts_updated_at_trigger
before update on public.my_podium_accounts
for each row execute function public.set_my_podium_accounts_updated_at();

alter table public.my_podium_accounts enable row level security;

revoke all on table public.my_podium_accounts from anon, authenticated;

grant all on table public.my_podium_accounts to service_role;

commit;
