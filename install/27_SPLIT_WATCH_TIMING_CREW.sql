-- Split Watch: Timing Crew system (race day build plan, Project 3)
-- Purpose:
--   Today a race-day code is entirely anonymous and team-wide: anyone who
--   enters it can push a split for ANY checkpoint in the race, and
--   revoking access means wiping every helper's session at once -- there
--   is no way to remove just the one person whose phone was left in a
--   car, or to know who is actually covering Mile 1 versus the finish.
--
-- Design:
--   race_positions is a per-race, coach-defined timing role ("Mile 1",
--   "Finish", "Pack Capture", "Backup timer"). capability distinguishes
--   HOW that position is allowed to capture: a plain checkpoint tap, a
--   Pack Capture tap (both still bound to one specific checkpoint via
--   race_checkpoint_id), or "backup" (no fixed checkpoint -- can cover
--   any of them, matching how a real backup timer is used).
--
--   race_day_sessions gains display_name (asked for at join, not just an
--   anonymous cookie anymore), race_session_id (which race this
--   session's assignment belongs to -- null until assigned),
--   race_position_id (null = "waiting to be assigned," matching an open
--   position with nobody in it yet), and revoked_at (lets a coach remove
--   ONE helper's access without touching anyone else's, unlike today's
--   only lever -- wiping every session for the whole team).
--
--   Deliberately backward compatible: a race with zero rows in
--   race_positions is unrestricted, exactly like every race today --
--   checkpoint-scoped enforcement (lib/race_day_auth.mjs) only turns on
--   once a coach actually creates at least one position for that race.
--   No existing team's helper workflow changes unless they opt in.
--
-- Safety:
--   Purely additive. race_positions is a new table with its own RLS
--   posture (revoke all from anon/authenticated, service_role only) --
--   every read/write goes through the app's own service layer, matching
--   every other Split Watch table since install/11. The two new foreign
--   keys on race_day_sessions both use "on delete set null" (not
--   cascade) -- deleting a race or a position must never delete a
--   helper's session outright, only clear its now-invalid assignment.

begin;

create table if not exists public.race_positions (
  id uuid primary key default gen_random_uuid(),
  race_session_id uuid not null references public.race_sessions(id) on delete cascade,
  label text not null,
  race_checkpoint_id uuid references public.race_checkpoints(id) on delete cascade,
  capability text not null default 'checkpoint' check (capability in ('checkpoint', 'pack_capture', 'backup')),
  instructions text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists race_positions_session_index
  on public.race_positions (race_session_id);

alter table public.race_day_sessions
  add column if not exists display_name text,
  add column if not exists race_session_id uuid references public.race_sessions(id) on delete set null,
  add column if not exists race_position_id uuid references public.race_positions(id) on delete set null,
  add column if not exists revoked_at timestamptz;

create index if not exists race_day_sessions_race_session_index
  on public.race_day_sessions (race_session_id)
  where race_session_id is not null;

alter table public.race_positions enable row level security;
revoke all on table public.race_positions from anon, authenticated;
grant all on table public.race_positions to service_role;

commit;
