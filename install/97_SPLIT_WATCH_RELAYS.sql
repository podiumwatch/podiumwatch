-- Split Watch for track, Phase 3: relays (4x800, 4x400, 4x200, 4x100, custom)
-- docs/SPLIT_WATCH_TRACK_HANDOFF.md, 2026-11-12
--
-- Needs install/96_SPLIT_WATCH_LAP_MODE.sql first (already run).
--
-- How relays are modeled: a relay team is ONE entry (a race_participants
-- row) that runs laps, so the existing rule of one split per entry per
-- checkpoint, lap mode, the double tap guard and undo all keep working.
-- Legs are a layer on top. A leg split is never stored: it is the
-- exchange time minus the previous exchange (or the start), worked out
-- when shown, so changing the leg order only changes names, never times.
--
-- What it adds (additive only; nothing existing is dropped, renamed or
-- changed, and every existing row keeps today's behavior):
--
--   race_sessions
--     relay_leg_meters   the relay's leg distances in order, e.g.
--                        [800, 800, 800, 800] or [1200, 400, 800, 1600].
--                        Null for every race that is not a relay.
--
--   race_participants
--     entry_type         'individual' (every existing row) or 'relay'
--                        (a relay team; manual_name holds the team's
--                        name, e.g. "A team"). Default 'individual'.
--
--   race_relay_legs (new table)
--     one row per leg of a relay team: the leg's order and distance, and
--     who runs it -- a rostered athlete (team_athlete_id), a typed name
--     (manual_name), or neither ("TBD"). Never both. Edited freely up to
--     and during the race. Deleting a team deletes its legs.
--
-- Safety: one new nullable column, one new defaulted column, one new
-- table with server-only access (same as every other race_ table). No
-- data is written. Safe to run while Split Watch is in use; safe to run
-- twice.
--
-- Run it BEFORE pushing the Phase 3 code. (The code also works without
-- it: relay events refuse to be created until these columns exist, and
-- everything else keeps working.)
--
-- To undo (only if no relay race has been created yet; this deletes the
-- new table and columns and anything stored in them):
--   drop table if exists public.race_relay_legs;
--   alter table public.race_participants drop column if exists entry_type;
--   alter table public.race_sessions drop column if exists relay_leg_meters;

begin;

alter table public.race_sessions
  add column if not exists relay_leg_meters jsonb;

alter table public.race_participants
  add column if not exists entry_type text not null default 'individual';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'race_participants_entry_type_check') then
    alter table public.race_participants
      add constraint race_participants_entry_type_check check (entry_type in ('individual', 'relay'));
  end if;
end $$;

create table if not exists public.race_relay_legs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  race_participant_id uuid not null references public.race_participants(id) on delete cascade,
  leg_order integer not null check (leg_order >= 1),
  distance_meters numeric not null check (distance_meters > 0),
  -- A rostered athlete, a typed name, or neither (TBD) -- never both, so
  -- a typed name can never be confused with a verified roster identity.
  team_athlete_id uuid references public.team_athletes(id) on delete set null,
  manual_name text,
  check (not (team_athlete_id is not null and manual_name is not null)),
  unique (race_participant_id, leg_order)
);

create index if not exists race_relay_legs_participant_idx on public.race_relay_legs (race_participant_id);
create index if not exists race_relay_legs_athlete_idx on public.race_relay_legs (team_athlete_id);

alter table public.race_relay_legs enable row level security;
revoke all on table public.race_relay_legs from anon, authenticated;
grant all on table public.race_relay_legs to service_role;

commit;

-- Check (read only): should list 3 columns and the new table.
-- select table_name, column_name from information_schema.columns
-- where table_schema = 'public'
--   and ((table_name = 'race_sessions' and column_name = 'relay_leg_meters')
--     or (table_name = 'race_participants' and column_name = 'entry_type')
--     or (table_name = 'race_relay_legs' and column_name = 'leg_order'))
-- order by table_name;
