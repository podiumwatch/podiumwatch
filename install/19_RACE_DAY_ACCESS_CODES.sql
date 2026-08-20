-- Race Command Center -- Race Day Access Codes
-- Purpose:
--   A second, lighter-weight way into Race Command Center, alongside
--   the existing full Podium Watch coach account (Supabase Auth +
--   team_members) -- a short, team-owner-issued code that a race-day
--   volunteer (someone at the Mile 1 marker, someone at Mile 2, who may
--   never have or want a full account) can type once to get straight
--   into that ONE team's Race Command Center. Deliberately scoped:
--   this grants Race Command Center access only -- nothing here reads
--   or writes roster, schedule, or content tables, which keep their own,
--   completely separate auth checks.
--
-- Design notes:
--   - The human-typeable code itself is never stored -- only its SHA-256
--     hash (team_race_day_codes.code_hash), matching the hash-only
--     storage already established for athlete_invites/guardian_invites
--     tokens (lib/engagement_service.mjs's createToken()/hashToken()).
--     One active code per team (unique team_id) -- regenerating replaces
--     it outright, there's one current code per team, not a history of
--     several simultaneously valid ones.
--   - race_day_sessions is the actual session store, created the moment
--     a code is successfully verified -- an opaque, unguessable token is
--     handed to the browser as an HttpOnly cookie, and only ITS hash is
--     stored server-side (same pattern as the code itself). Deliberately
--     NOT a Supabase Auth session and NOT tied to any auth.users row --
--     there is no real identity here, only "this browser was recently
--     shown this team's current code."
--   - Regenerating or revoking a team's code deletes every
--     race_day_sessions row for that team (application-layer, not a
--     trigger) -- a coach doing this because a code leaked needs every
--     outstanding session built from the old code to actually stop
--     working, immediately.
--   - race_day_code_attempts exists purely to rate-limit FAILED
--     verification attempts by hashed IP (never the raw address, same
--     convention as lib/team_instagram_service.mjs's existing rate
--     limiting) -- a correct code is never recorded here.
--
-- Safety:
--   Purely additive. Three new tables, nothing existing altered.

begin;

create extension if not exists pgcrypto;

create table if not exists public.team_race_day_codes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  team_id uuid not null unique references public.team_pages(id) on delete cascade,
  code_hash text not null,
  active boolean not null default true,
  created_by_user_id uuid,
  last_used_at timestamptz
);

create table if not exists public.race_day_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  team_id uuid not null references public.team_pages(id) on delete cascade,
  session_token_hash text not null unique,
  expires_at timestamptz not null,
  last_seen_at timestamptz
);

create index if not exists race_day_sessions_team_index
  on public.race_day_sessions (team_id);

create table if not exists public.race_day_code_attempts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  hashed_ip text not null
);

create index if not exists race_day_code_attempts_lookup_index
  on public.race_day_code_attempts (hashed_ip, created_at);

create or replace function public.set_team_race_day_code_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists team_race_day_codes_updated_at_trigger
  on public.team_race_day_codes;
create trigger team_race_day_codes_updated_at_trigger
before update on public.team_race_day_codes
for each row execute function public.set_team_race_day_code_updated_at();

alter table public.team_race_day_codes enable row level security;
alter table public.race_day_sessions enable row level security;
alter table public.race_day_code_attempts enable row level security;

revoke all on table public.team_race_day_codes from anon, authenticated;
revoke all on table public.race_day_sessions from anon, authenticated;
revoke all on table public.race_day_code_attempts from anon, authenticated;

grant all on table public.team_race_day_codes to service_role;
grant all on table public.race_day_sessions to service_role;
grant all on table public.race_day_code_attempts to service_role;

commit;
