-- Podium Watch Race Command Center
-- Purpose:
--   Coach-facing race Plan -> Race -> Review tooling: race setup with
--   coach-defined checkpoints, full-team goal planning (Goals A/B/C, Even
--   Pace or Custom Pace), local-first live split recording (single-tap and
--   multi-athlete "Pack Capture"), and individual/team review, all scoped
--   to a coach's own team via the existing team_members authorization
--   model (lib/team_auth.mjs, api/team/roster.js). No new auth system.
--
-- Phase One scope (see docs/DECISIONS.md for the full reasoning):
--   This migration intentionally does NOT build: multi-device live sync
--   (the metadata this needs -- device_id, capture_method, revision -- is
--   present on every split/revision row so it can be added later without
--   a schema change), public athlete share codes, a course/checkpoint
--   template database (checkpoints are coach-entered per race, never
--   prepopulated or invented), true cross country team scoring (no
--   team-score column or computation exists anywhere in this schema --
--   one team's own times cannot determine a real team score without race
--   position data this project does not yet capture), official-result
--   promotion (race_splits is coaching data and is never read by, or
--   written into, athlete_performances or any verified-results table),
--   or season-long analytics. None of these are precluded later.
--
-- Design notes:
--   - Every table that references team_pages does so through
--     race_sessions.team_id -- there is exactly one authorization root,
--     matching the rest of the codebase's per-team scoping model.
--   - race_participants references team_athletes.id directly (the same
--     team-scoped athlete identity install/*roster* tables use) for
--     rostered runners, OR carries a manual_name for ad hoc participants
--     -- never both, never neither, and never a new athlete table. See
--     lib/team_roster_service.mjs for the athlete identity this reuses.
--   - race_targets stores the plan's per-checkpoint target time once, at
--     save time, and is never silently recomputed later even if the
--     underlying pace formula changes -- a past race's review must always
--     reflect what the coach actually planned against.
--   - race_splits holds the CURRENT value per (participant, checkpoint).
--     client_split_id is a client-minted idempotency key (matching the
--     pw_-prefixed token style already used by AOTW/TOTW voting) that a
--     retried sync can safely conflict on -- it can never create a
--     duplicate row. race_split_revisions is a separate, append-only
--     audit log: Undo writes a new revision and updates the current
--     value, it never deletes history.
--   - There is no "synchronization state" column anywhere in this
--     schema. A split existing in this table already means it is synced
--     -- sync state (pending/synced) is tracked only client-side, in the
--     browser's local IndexedDB store, which avoids an entire class of
--     stale-sync-flag bugs.
--   - Race review is deliberately NOT a stored table. It is computed on
--     demand from race_splits + race_targets + race_participants at
--     render time, so it can never go stale, and a future Race Replay
--     feature can reuse the same computation with zero migration.
--
-- Safety:
--   This migration is additive only. It does not alter or drop any
--   existing table -- team_pages, team_athletes, team_roster_entries,
--   team_seasons, meets, athlete_performances, and every public
--   results/rankings/recruiting table are untouched. It creates eight new
--   tables, their indexes, one new trigger function, and seeds no data
--   (there is nothing to seed -- every race, checkpoint, and target here
--   is coach-entered, never invented).

begin;

create extension if not exists pgcrypto;

create table if not exists public.race_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  team_id uuid not null references public.team_pages(id) on delete cascade,
  created_by_user_id uuid,
  -- Optional link to a real meet. Race Command Center must also support
  -- ad hoc races with no linked meet at all (a coach-run time trial,
  -- for example), so this is nullable.
  meet_id uuid references public.meets(id) on delete set null,
  name text not null,
  sport text not null default 'cross_country' check (sport in ('cross_country', 'track')),
  -- Coach-defined free text (e.g. 'varsity', 'jv', 'invitational', 'dual')
  -- -- never validated against an invented fixed enum.
  race_type text,
  distance_meters numeric not null check (distance_meters > 0),
  distance_unit_display text not null default 'miles' check (
    distance_unit_display in ('miles', 'km', 'meters')
  ),
  race_date date not null,
  scheduled_start_time time,
  status text not null default 'draft' check (
    status in ('draft', 'scheduled', 'live', 'finished', 'reviewed', 'cancelled')
  ),
  -- The wall-clock anchor for timer recovery after a refresh or
  -- backgrounding. Set once, the instant the coach performs the
  -- deliberate race-start action. The browser's monotonic
  -- performance.now() value is never persisted here -- it resets to 0 on
  -- every page load and is meaningless across sessions or devices; only
  -- this real timestamp can anchor a recovered race.
  race_started_at timestamptz,
  race_ended_at timestamptz,
  duplicated_from_session_id uuid references public.race_sessions(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.race_checkpoints (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  race_session_id uuid not null references public.race_sessions(id) on delete cascade,
  -- Coach-defined label, e.g. "Mile 1", "2K", "1600m" -- never invented
  -- or prepopulated from a course template. See the Phase One scope note
  -- above: no course/checkpoint database exists yet.
  label text not null,
  distance_meters numeric not null check (distance_meters > 0),
  sort_order integer not null,
  is_finish boolean not null default false,
  unique (race_session_id, sort_order)
);

create table if not exists public.race_participants (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  race_session_id uuid not null references public.race_sessions(id) on delete cascade,
  -- Exactly one of these two is set -- a rostered athlete or a manual ad
  -- hoc entry, kept structurally distinct so a manual participant can
  -- never be confused with a verified roster identity.
  team_athlete_id uuid references public.team_athletes(id) on delete set null,
  manual_name text,
  check (
    (team_athlete_id is not null and manual_name is null)
    or (team_athlete_id is null and manual_name is not null)
  ),
  -- Coach-defined grouping, e.g. "Varsity", "JV" -- free text.
  race_group text,
  status text not null default 'scheduled' check (
    status in ('scheduled', 'started', 'active', 'finished', 'dns', 'dnf')
  ),
  strategy text not null default 'even_pace' check (strategy in ('even_pace', 'custom_pace')),
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.race_goals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  race_participant_id uuid not null references public.race_participants(id) on delete cascade,
  -- A = the highest (most ambitious) target, framed non-negatively --
  -- never a "worst case". At least one of A/B/C is required by the
  -- application layer; the schema itself does not force which slots
  -- exist so a coach can plan with just an A goal.
  goal_slot text not null check (goal_slot in ('A', 'B', 'C')),
  goal_seconds numeric not null check (goal_seconds > 0),
  unique (race_participant_id, goal_slot)
);

-- Persisted, immutable per-checkpoint target time for every
-- (participant, checkpoint, goal) combination. Computed once when the
-- plan is saved -- Even Pace derives it from the goal time and each
-- checkpoint's distance; Custom Pace stores exactly what the coach
-- entered, validated strictly increasing and never silently modified --
-- and is never recomputed later even if the underlying formula changes,
-- so a past race's review always reflects what was actually planned.
create table if not exists public.race_targets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  race_participant_id uuid not null references public.race_participants(id) on delete cascade,
  race_checkpoint_id uuid not null references public.race_checkpoints(id) on delete cascade,
  goal_slot text not null check (goal_slot in ('A', 'B', 'C')),
  target_elapsed_seconds numeric not null check (target_elapsed_seconds > 0),
  unique (race_participant_id, race_checkpoint_id, goal_slot)
);

-- One row per Pack Capture event -- a single frozen timestamp applied to
-- several selected participants at once. race_splits.pack_capture_id
-- links which splits came from it, purely for audit/traceability.
create table if not exists public.race_pack_captures (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  race_session_id uuid not null references public.race_sessions(id) on delete cascade,
  race_checkpoint_id uuid not null references public.race_checkpoints(id) on delete cascade,
  captured_wall_clock_at timestamptz not null,
  device_id text
);

-- The CURRENT split value per (participant, checkpoint) -- what Live
-- Race Mode and Review both read. client_split_id is a client-minted
-- idempotency key (mirroring the pw_-prefixed voter-token style already
-- used by AOTW/TOTW): the browser generates it once at capture time and
-- it is what sync upserts conflict on, so a retried or duplicate sync
-- request can never create a duplicate row.
create table if not exists public.race_splits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  race_session_id uuid not null references public.race_sessions(id) on delete cascade,
  race_participant_id uuid not null references public.race_participants(id) on delete cascade,
  race_checkpoint_id uuid not null references public.race_checkpoints(id) on delete cascade,
  client_split_id text not null unique check (client_split_id ~ '^pw_rcc_[a-zA-Z0-9._-]{16,80}$'),
  -- Null only for a DNS/DNF marker row -- never a fabricated 0.
  elapsed_seconds numeric check (elapsed_seconds is null or elapsed_seconds >= 0),
  wall_clock_captured_at timestamptz not null,
  capture_method text not null check (
    capture_method in ('single_tap', 'pack_capture', 'manual_entry', 'edited')
  ),
  pack_capture_id uuid references public.race_pack_captures(id) on delete set null,
  device_id text,
  revision integer not null default 1 check (revision > 0),
  is_dns boolean not null default false,
  is_dnf boolean not null default false,
  unique (race_participant_id, race_checkpoint_id)
);

-- Append-only audit trail. Undo never destroys a synced split's history
-- -- it writes a new revision here and updates race_splits' current
-- value, so the full correction history is always reconstructable
-- rather than silently discarded.
create table if not exists public.race_split_revisions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  race_split_id uuid not null references public.race_splits(id) on delete cascade,
  revision integer not null check (revision > 0),
  elapsed_seconds numeric,
  wall_clock_captured_at timestamptz,
  capture_method text,
  change_reason text not null check (
    change_reason in ('recorded', 'undo', 'manual_correction', 'pack_capture_correction')
  ),
  device_id text,
  created_by_user_id uuid,
  unique (race_split_id, revision)
);

create table if not exists public.race_coach_notes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  race_session_id uuid not null references public.race_sessions(id) on delete cascade,
  -- Null = a team-wide note rather than one about a specific runner.
  race_participant_id uuid references public.race_participants(id) on delete cascade,
  note_text text not null,
  created_by_user_id uuid
);

create index if not exists race_sessions_team_index
  on public.race_sessions (team_id, race_date desc);

create index if not exists race_sessions_status_index
  on public.race_sessions (team_id, status);

create index if not exists race_checkpoints_session_index
  on public.race_checkpoints (race_session_id, sort_order);

create index if not exists race_participants_session_index
  on public.race_participants (race_session_id, sort_order);

create index if not exists race_participants_athlete_index
  on public.race_participants (team_athlete_id);

create index if not exists race_goals_participant_index
  on public.race_goals (race_participant_id);

create index if not exists race_targets_participant_index
  on public.race_targets (race_participant_id, race_checkpoint_id);

create index if not exists race_pack_captures_session_index
  on public.race_pack_captures (race_session_id, race_checkpoint_id);

create index if not exists race_splits_session_index
  on public.race_splits (race_session_id, race_checkpoint_id);

create index if not exists race_splits_participant_index
  on public.race_splits (race_participant_id);

create index if not exists race_split_revisions_split_index
  on public.race_split_revisions (race_split_id, revision desc);

create index if not exists race_coach_notes_session_index
  on public.race_coach_notes (race_session_id);

create or replace function public.set_race_command_center_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists race_sessions_updated_at_trigger
  on public.race_sessions;
create trigger race_sessions_updated_at_trigger
before update on public.race_sessions
for each row execute function public.set_race_command_center_updated_at();

drop trigger if exists race_splits_updated_at_trigger
  on public.race_splits;
create trigger race_splits_updated_at_trigger
before update on public.race_splits
for each row execute function public.set_race_command_center_updated_at();

alter table public.race_sessions enable row level security;
alter table public.race_checkpoints enable row level security;
alter table public.race_participants enable row level security;
alter table public.race_goals enable row level security;
alter table public.race_targets enable row level security;
alter table public.race_pack_captures enable row level security;
alter table public.race_splits enable row level security;
alter table public.race_split_revisions enable row level security;
alter table public.race_coach_notes enable row level security;

revoke all on table public.race_sessions from anon, authenticated;
revoke all on table public.race_checkpoints from anon, authenticated;
revoke all on table public.race_participants from anon, authenticated;
revoke all on table public.race_goals from anon, authenticated;
revoke all on table public.race_targets from anon, authenticated;
revoke all on table public.race_pack_captures from anon, authenticated;
revoke all on table public.race_splits from anon, authenticated;
revoke all on table public.race_split_revisions from anon, authenticated;
revoke all on table public.race_coach_notes from anon, authenticated;

grant all on table public.race_sessions to service_role;
grant all on table public.race_checkpoints to service_role;
grant all on table public.race_participants to service_role;
grant all on table public.race_goals to service_role;
grant all on table public.race_targets to service_role;
grant all on table public.race_pack_captures to service_role;
grant all on table public.race_splits to service_role;
grant all on table public.race_split_revisions to service_role;
grant all on table public.race_coach_notes to service_role;

commit;
