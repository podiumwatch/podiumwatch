-- Podium Watch Fan Poll
-- Purpose:
--   A weekly fan-voted top 16 ranking per sport, gender, and division --
--   modeled after the real OATCCC Coaches Poll, but built and clearly
--   labeled as Podium Watch's own unofficial fan poll, never presented as
--   an official ranking. Follows the same overall shape already
--   established by aotw_weeks/totw_weeks (a *_weeks table with a
--   nomination/voting window and a status field, an atomic RPC vote-cast
--   function, and an HMAC-hashed voter identifier instead of anything
--   raw) -- those tables were created directly in Supabase before this
--   repository's install/ migration convention started, so there is no
--   earlier install/*.sql file to diff against; this migration's shape
--   was reverse-engineered from api/aotw/vote.js, api/totw/vote.js,
--   api/aotw/current.js, and api/aotw/archive.js instead. See
--   docs/DECISIONS.md, 2026-08-06, for the full reasoning.
--
-- How this differs from AOTW/TOTW, on purpose:
--   1. A full 16-team ranked ballot, not a single pick, so there are two
--      new tables AOTW/TOTW don't need: fan_poll_ballots (one row per
--      submitted ballot) and fan_poll_ballot_entries (16 rows per
--      ballot, one per ranked team, each carrying its own AP-style point
--      value computed at submission time -- 16 for 1st place down to 1
--      for 16th).
--   2. There is no nomination phase and no *_finalists table. A ballot
--      picks directly from the real teams already assigned to that
--      week's sport/gender/division in public.team_pages -- never free
--      text -- so there is nothing to curate ahead of voting.
--   3. The voter identifier is a hashed email address, not a hashed
--      anonymous browser token, and the database enforces one ballot per
--      email per week (which, since a week is already sport/gender/
--      division scoped, means one ballot per email per week per division
--      per gender) via a real unique constraint, not a time-based
--      cooldown like AOTW/TOTW use.
--   4. A results-email opt-in is a genuinely separate table
--      (fan_poll_email_subscribers), never merged into the ballot table
--      itself. The ballot table only ever holds a hashed email, which
--      cannot be used to send anything -- an actual, sendable address is
--      only ever written to fan_poll_email_subscribers, and only when a
--      voter explicitly checks the opt-in box. Voting works identically
--      whether or not that box is checked.
--   5. Every week's results stay in their own permanent row -- nothing
--      is ever overwritten -- so a future week can always show a team's
--      point and rank change from the immediately preceding week for the
--      same sport/gender/division. fan_poll_week_results is a plain view
--      over the ballot data (not a snapshot table) for exactly this
--      reason: it can never drift out of sync with the ballots it
--      summarizes, and re-deriving it costs nothing meaningful at this
--      site's real traffic.
--
-- Scope of this migration vs. what's actually turned on:
--   The schema below is sport-aware from the start (cross_country,
--   indoor_track, outdoor_track) and division_number allows up to 5, so
--   track and field (which uses 5 divisions elsewhere on this site, not
--   4) can be turned on later with zero schema changes -- just new
--   fan_poll_weeks rows. Only cross country is actually launched in this
--   pass, boys and girls, divisions 1 through 4 (8 combinations), because
--   that is the only sport with real, official division data behind
--   every team right now.
--
-- Safety:
--   This migration is additive. It only creates new tables, a new view,
--   and a new function -- it does not alter or drop anything that
--   already exists. public.team_pages is only referenced by foreign key,
--   never altered here.

begin;

create extension if not exists pgcrypto;

create table if not exists public.fan_poll_weeks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  week_slug text not null unique,
  title text not null,
  sport text not null check (
    sport in ('cross_country', 'indoor_track', 'outdoor_track')
  ),
  gender text not null check (gender in ('boys', 'girls')),
  division_number integer not null check (
    division_number between 1 and 5
  ),
  season_year integer not null check (
    season_year between 2000 and 2200
  ),
  voting_opens timestamptz not null,
  voting_closes timestamptz not null check (voting_closes > voting_opens),
  status text not null default 'scheduled' check (
    status in ('scheduled', 'voting_open', 'voting_closed')
  ),
  created_by text,
  updated_by text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.fan_poll_ballots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  week_id uuid not null references public.fan_poll_weeks(id) on delete cascade,
  -- HMAC-SHA256 of the voter's email, using VOTE_HASH_SECRET, the same
  -- secret and approach AOTW/TOTW already use for their voter tokens.
  -- The raw email is never written here -- see fan_poll_email_subscribers
  -- below for the one place a real, sendable address is ever stored, and
  -- only when the voter opts in.
  voter_email_hash text not null,
  voter_ip_hash text,
  metadata jsonb not null default '{}'::jsonb,
  -- The actual database-level enforcement of "one ballot per email per
  -- week per division per gender" -- a week is already scoped to exactly
  -- one sport/gender/division, so this single constraint covers all of
  -- it. cast_fan_poll_ballot_v1 below relies on this constraint being
  -- violated to atomically reject a repeat vote, the same way AOTW/TOTW's
  -- functions rely on their own cooldown check.
  unique (week_id, voter_email_hash)
);

create table if not exists public.fan_poll_ballot_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ballot_id uuid not null references public.fan_poll_ballots(id) on delete cascade,
  team_id uuid not null references public.team_pages(id) on delete restrict,
  rank_position integer not null check (rank_position between 1 and 16),
  -- Standard AP-style points: 1st place = 16, 16th place = 1. Stored
  -- explicitly (not recomputed from rank_position on every read) so a
  -- past week's real, submitted scoring stays exactly what it was even
  -- if the point scale is ever revisited in the future -- permanent
  -- history should never quietly change shape.
  points integer not null check (points between 1 and 16),
  unique (ballot_id, rank_position),
  unique (ballot_id, team_id)
);

create table if not exists public.fan_poll_email_subscribers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  week_id uuid not null references public.fan_poll_weeks(id) on delete cascade,
  -- The one place in this whole feature a real, sendable email address is
  -- stored. Only ever inserted when a voter explicitly checks "Email me
  -- when this week's poll results are published" -- never populated just
  -- because someone voted.
  email text not null,
  notified_at timestamptz,
  unsubscribed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists fan_poll_weeks_lookup_index
  on public.fan_poll_weeks (sport, gender, division_number, voting_opens desc);

create index if not exists fan_poll_weeks_status_index
  on public.fan_poll_weeks (status, voting_opens desc);

create index if not exists fan_poll_ballot_entries_team_index
  on public.fan_poll_ballot_entries (team_id);

create index if not exists fan_poll_email_subscribers_week_index
  on public.fan_poll_email_subscribers (week_id, notified_at)
  where unsubscribed_at is null;

-- Pre-aggregated points per team per week. A plain view, not a snapshot
-- table, so it can never drift out of sync with the ballots it
-- summarizes -- re-deriving this on every read costs nothing meaningful
-- at this site's real traffic, and it keeps "permanently queryable
-- history" trivially true: nothing here is ever written to directly.
create or replace view public.fan_poll_week_results as
select
  b.week_id,
  e.team_id,
  sum(e.points)::integer as total_points,
  count(*)::integer as ballot_count
from public.fan_poll_ballot_entries e
join public.fan_poll_ballots b on b.id = e.ballot_id
group by b.week_id, e.team_id;

create or replace function public.set_fan_poll_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists fan_poll_weeks_updated_at_trigger
  on public.fan_poll_weeks;
create trigger fan_poll_weeks_updated_at_trigger
before update on public.fan_poll_weeks
for each row execute function public.set_fan_poll_updated_at();

-- Atomically casts one full ballot: validates the week is real and
-- currently open for voting, validates the ballot is exactly 16 entries
-- naming 16 distinct teams, then inserts the ballot and its 16 entries
-- together. Team eligibility for the week's specific sport/gender/
-- division (not just "is this a real team") is validated by the caller
-- before this function is ever invoked, matching how AOTW/TOTW's own
-- vote.js validates the finalist before calling their RPC -- this
-- function's own job is purely the atomic part: the one-ballot-per-email
-- constraint (via a real unique index, not a race-prone check-then-
-- insert) and giving every rejection reason a clean, structured name
-- instead of a raw Postgres error.
--
-- points are computed here from rank_position (17 - rank_position),
-- never trusted from the caller -- the same principle as never trusting
-- client-supplied scoring anywhere else in this project.
create or replace function public.cast_fan_poll_ballot_v1(
  p_week_id uuid,
  p_voter_email_hash text,
  p_voter_ip_hash text,
  p_entries jsonb
)
returns table (
  accepted boolean,
  reason text,
  ballot_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week public.fan_poll_weeks%rowtype;
  v_entry jsonb;
  v_new_ballot_id uuid;
  v_distinct_teams integer;
begin
  select * into v_week
  from public.fan_poll_weeks
  where id = p_week_id
  for update;

  if v_week.id is null then
    return query select false, 'week_not_found'::text, null::uuid;
    return;
  end if;

  if v_week.status <> 'voting_open'
    or now() < v_week.voting_opens
    or now() > v_week.voting_closes
  then
    return query select false, 'voting_closed'::text, null::uuid;
    return;
  end if;

  if p_entries is null or jsonb_array_length(p_entries) <> 16 then
    return query select false, 'invalid_ballot_size'::text, null::uuid;
    return;
  end if;

  select count(distinct (value->>'team_id'))
  into v_distinct_teams
  from jsonb_array_elements(p_entries);

  if v_distinct_teams <> 16 then
    return query select false, 'duplicate_teams'::text, null::uuid;
    return;
  end if;

  begin
    insert into public.fan_poll_ballots (
      week_id,
      voter_email_hash,
      voter_ip_hash
    ) values (
      p_week_id,
      p_voter_email_hash,
      p_voter_ip_hash
    )
    returning id into v_new_ballot_id;

    for v_entry in select * from jsonb_array_elements(p_entries)
    loop
      insert into public.fan_poll_ballot_entries (
        ballot_id,
        team_id,
        rank_position,
        points
      ) values (
        v_new_ballot_id,
        (v_entry->>'team_id')::uuid,
        (v_entry->>'rank_position')::integer,
        17 - (v_entry->>'rank_position')::integer
      );
    end loop;
  exception
    -- A real duplicate ballot (week_id, voter_email_hash already exists)
    -- is by far the most likely way to land here, since the caller
    -- already validated ballot shape and team eligibility before calling
    -- this function -- the ballot-entry unique constraints exist purely
    -- as a last-resort backstop, not an expected path.
    when unique_violation then
      return query select false, 'already_voted'::text, null::uuid;
      return;
    when foreign_key_violation then
      return query select false, 'invalid_team'::text, null::uuid;
      return;
    when check_violation then
      return query select false, 'invalid_ballot'::text, null::uuid;
      return;
  end;

  return query select true, null::text, v_new_ballot_id;
end;
$$;

alter table public.fan_poll_weeks enable row level security;
alter table public.fan_poll_ballots enable row level security;
alter table public.fan_poll_ballot_entries enable row level security;
alter table public.fan_poll_email_subscribers enable row level security;

revoke all on table public.fan_poll_weeks from anon, authenticated;
revoke all on table public.fan_poll_ballots from anon, authenticated;
revoke all on table public.fan_poll_ballot_entries from anon, authenticated;
revoke all on table public.fan_poll_email_subscribers from anon, authenticated;
revoke all on public.fan_poll_week_results from anon, authenticated;

grant all on table public.fan_poll_weeks to service_role;
grant all on table public.fan_poll_ballots to service_role;
grant all on table public.fan_poll_ballot_entries to service_role;
grant all on table public.fan_poll_email_subscribers to service_role;
grant select on public.fan_poll_week_results to service_role;

revoke all on function public.cast_fan_poll_ballot_v1(uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.cast_fan_poll_ballot_v1(uuid, text, text, jsonb)
  to service_role;

commit;
