-- Podium Watch Athlete Access (Team Workspace Phase Two)
-- Purpose:
--   Lets an athlete sign in to their own Podium Watch account and see
--   their own race plan (Goals A/B/C, checkpoint targets) and review
--   (target vs. actual per checkpoint) -- coach-issued invite only, no
--   open self-serve signup. Athletes and coaches share the same Supabase
--   Auth users table (there is only one auth provider in this project);
--   what's new here is the authorization layer connecting a real auth
--   account to a specific team_athletes row.
--
-- Source of the design decisions below: docs/DECISIONS.md, 2026-08-11
-- "Athlete Access Phase Two architecture" -- read that entry for the
-- full reasoning, not repeated in full here.
--
-- Design notes:
--   - Every invite and account link keys off a specific team_athletes.id,
--     never athlete_profiles.id. A repository audit confirmed
--     team_athletes.athlete_profile_id is not safely 1:1 -- a cross-team
--     transfer usually creates a second, duplicate athlete_profiles row
--     (existing behavior, not something this migration touches). An
--     athlete who is invited by two different teams over their career
--     simply ends up with two separate athlete_accounts rows, one per
--     team_athletes.id -- no special-casing needed.
--   - The raw invite token is NEVER stored -- only token_hash (a plain
--     SHA-256 digest). Reuses lib/engagement_service.mjs's existing
--     createToken()/hashToken() pair as-is (already used for team
--     follower unsubscribe links) rather than the AOTW/TOTW HMAC-with-a-
--     secret pattern: that pattern exists because AOTW's token is
--     CLIENT-generated (weaker, needs a server secret as defense in
--     depth); this token is SERVER-generated via crypto.randomBytes(32)
--     (256 bits of real entropy), so a keyed HMAC adds nothing -- the
--     token itself is already unguessable, and hashing it is purely
--     about not handing out a live token if the database ever leaks.
--     No new secret needed.
--   - Revocation is a status flip (revoked), never a row delete, on both
--     tables -- matching this project's established "traceable, not
--     destructive" pattern (Race Command Center's Undo/revision model:
--     install/11_RACE_COMMAND_CENTER.sql).
--   - Consent is a single flag here (consent_confirmed_at/by on
--     athlete_invites), deliberately lighter than the three-flag
--     athlete_consent_confirmed/guardian_consent_confirmed/approved_by_team
--     pattern install/*.sql already uses for athlete_social_links. That
--     pattern gates PUBLISHING to the public internet; this one gates
--     VIEWING already coach-controlled, non-public data the coach
--     explicitly invited this person to see, and the coach already
--     vouched for the athlete's identity by generating the invite in the
--     first place -- a meaningfully lower-stakes action.
--
-- Safety:
--   This migration is additive only. It does not alter or drop any
--   existing table. It creates two new tables and seeds no data --
--   there is nothing to seed; every invite is coach-entered.

begin;

create extension if not exists pgcrypto;

create table if not exists public.athlete_invites (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  team_id uuid not null references public.team_pages(id) on delete cascade,
  team_athlete_id uuid not null references public.team_athletes(id) on delete cascade,
  invited_email text not null,
  invited_name text not null,
  -- HMAC-SHA256 hex digest of the raw token -- see the design note above.
  -- The raw token itself exists only in the invite email/link, never
  -- persisted anywhere.
  token_hash text not null unique,
  status text not null default 'pending' check (
    status in ('pending', 'redeemed', 'revoked', 'expired')
  ),
  created_by_user_id uuid,
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by_user_id uuid,
  -- Single-flag consent -- see the design note above for why this is
  -- deliberately lighter than the social-links three-flag pattern.
  consent_confirmed_at timestamptz,
  consent_confirmed_by text,
  revoked_at timestamptz,
  revoked_by_user_id uuid,
  metadata jsonb not null default '{}'::jsonb
);

-- One row per (auth user, team_athletes) pair -- not a single FK per
-- user -- so an athlete who is later invited by a second team (a
-- transfer) just gets a second row here, never a conflict.
create table if not exists public.athlete_accounts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null,
  team_athlete_id uuid not null references public.team_athletes(id) on delete cascade,
  -- Denormalized for direct authorization queries without a join back
  -- through team_athletes on every request.
  team_id uuid not null references public.team_pages(id) on delete cascade,
  linked_at timestamptz not null default now(),
  linked_via_invite_id uuid references public.athlete_invites(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'revoked')),
  revoked_at timestamptz,
  revoked_by_user_id uuid,
  unique (user_id, team_athlete_id)
);

create index if not exists athlete_invites_team_athlete_index
  on public.athlete_invites (team_athlete_id, status);

create index if not exists athlete_invites_team_index
  on public.athlete_invites (team_id, status);

create index if not exists athlete_accounts_user_index
  on public.athlete_accounts (user_id, status);

create index if not exists athlete_accounts_team_athlete_index
  on public.athlete_accounts (team_athlete_id, status);

alter table public.athlete_invites enable row level security;
alter table public.athlete_accounts enable row level security;

revoke all on table public.athlete_invites from anon, authenticated;
revoke all on table public.athlete_accounts from anon, authenticated;

grant all on table public.athlete_invites to service_role;
grant all on table public.athlete_accounts to service_role;

commit;
