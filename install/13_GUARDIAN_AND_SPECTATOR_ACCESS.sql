-- Podium Watch Guardian & Spectator Access (Team Workspace Phase Three)
-- Purpose:
--   Two additions on top of Race Command Center and Athlete Access:
--     1. A per-race coach opt-in (race_sessions.spectator_visible) that
--        controls whether a race can be viewed live by anyone other than
--        the coach or a signed-in athlete/guardian -- off by default.
--     2. A "guardian" tier: a parent/guardian signs in to a real Podium
--        Watch account, coach-invited only (no open self-serve signup),
--        and sees their own linked athlete's races -- goals, targets,
--        and splits included, exactly as that athlete would see them.
--        A separate, lighter, fully anonymous "spectator" tier (no
--        account at all) can also follow a spectator_visible race live,
--        but only ever sees checkpoints/names/times -- never goals,
--        targets, or coach notes. That anonymous tier needs no new
--        tables here; it is authorized purely by
--        race_sessions.spectator_visible and enforced in application
--        code (lib/race_viewer_service.mjs), the same way Race Command
--        Center already enforces everything else.
--
-- Source of the design decisions below: docs/DECISIONS.md, 2026-08-16
-- "Team Workspace Phase Three: guardian & spectator access" -- read that
-- entry for the full reasoning, not repeated in full here.
--
-- Design notes:
--   - guardian_invites / guardian_accounts are a deliberate, near-exact
--     mirror of athlete_invites / athlete_accounts
--     (install/12_ATHLETE_ACCESS.sql) -- same reasoning applies in full:
--     keyed off team_athletes.id (never athlete_profiles.id, which
--     isn't safely 1:1 across a transfer), coach-issued-invite-only,
--     raw token never stored (token_hash only, via the existing
--     lib/engagement_service.mjs createToken()/hashToken() pair --
--     server-generated 256-bit token, hashing is defense-in-depth
--     against a DB leak, no HMAC secret needed), single-flag consent,
--     status-flip revocation (never a row delete).
--   - Unlike athlete_accounts, more than one guardian per athlete is the
--     normal case (two parents, a parent and a grandparent), so the
--     uniqueness constraint is on (user_id, team_athlete_id) only --
--     never on team_athlete_id alone.
--   - race_sessions.spectator_visible defaults to false. A coach must
--     take a deliberate action per race to let anyone outside the team
--     (guardians and anonymous spectators alike) watch it live -- this
--     is the "explicit public/private split" the original one-line
--     Phase Three spec called for.
--   - RLS posture matches Race Command Center and Athlete Access
--     exactly: revoke all from anon/authenticated, grant all to
--     service_role. All authorization happens in application code
--     (lib/guardian_access_service.mjs, lib/race_viewer_service.mjs),
--     never in Postgres policies.
--
-- Safety:
--   This migration is additive only. It does not alter or drop any
--   existing column, and the new race_sessions column is added with
--   `if not exists` and a safe default so it cannot break any existing
--   row or query. It creates two new tables and seeds no data.

begin;

create extension if not exists pgcrypto;

alter table public.race_sessions
  add column if not exists spectator_visible boolean not null default false;

create table if not exists public.guardian_invites (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  team_id uuid not null references public.team_pages(id) on delete cascade,
  team_athlete_id uuid not null references public.team_athletes(id) on delete cascade,
  invited_email text not null,
  invited_name text not null,
  -- SHA-256 hex digest of the raw token -- see the design note above.
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
  -- deliberately lighter than a multi-flag publishing-consent pattern.
  consent_confirmed_at timestamptz,
  consent_confirmed_by text,
  revoked_at timestamptz,
  revoked_by_user_id uuid,
  metadata jsonb not null default '{}'::jsonb
);

-- One row per (auth user, team_athletes) pair. More than one guardian
-- per athlete is normal (two parents) -- the uniqueness constraint
-- below reflects that; it is never enforced on team_athlete_id alone.
create table if not exists public.guardian_accounts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null,
  team_athlete_id uuid not null references public.team_athletes(id) on delete cascade,
  -- Denormalized for direct authorization queries without a join back
  -- through team_athletes on every request.
  team_id uuid not null references public.team_pages(id) on delete cascade,
  linked_at timestamptz not null default now(),
  linked_via_invite_id uuid references public.guardian_invites(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'revoked')),
  revoked_at timestamptz,
  revoked_by_user_id uuid,
  unique (user_id, team_athlete_id)
);

create index if not exists guardian_invites_team_athlete_index
  on public.guardian_invites (team_athlete_id, status);

create index if not exists guardian_invites_team_index
  on public.guardian_invites (team_id, status);

create index if not exists guardian_accounts_user_index
  on public.guardian_accounts (user_id, status);

create index if not exists guardian_accounts_team_athlete_index
  on public.guardian_accounts (team_athlete_id, status);

create index if not exists race_sessions_spectator_visible_index
  on public.race_sessions (spectator_visible)
  where spectator_visible = true;

alter table public.guardian_invites enable row level security;
alter table public.guardian_accounts enable row level security;

revoke all on table public.guardian_invites from anon, authenticated;
revoke all on table public.guardian_accounts from anon, authenticated;

grant all on table public.guardian_invites to service_role;
grant all on table public.guardian_accounts to service_role;

commit;
