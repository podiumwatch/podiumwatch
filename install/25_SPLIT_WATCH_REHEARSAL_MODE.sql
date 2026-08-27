-- Split Watch: Rehearsal Mode (race day build plan, Project 1)
-- Purpose:
--   A coach must be able to test the complete timing flow the night
--   before a race -- start a clock, capture splits, invite helpers, go
--   offline, reload, undo -- without any of that practice data ever
--   being confused with the real race. The original ~10-second real
--   timing bug (fixed 2026-08-26) was traced to exactly this: a device's
--   stale local cache from an earlier test of the SAME race_session_id
--   was indistinguishable from that session's real state.
--
-- Design:
--   A rehearsal is its own separate race_sessions row, not a shared-row
--   "environment" flag. Every existing safety boundary in this codebase
--   (the parent link, Review, pullState, Athlete/Guardian access,
--   follower notifications, helper smart-routing) is already scoped by
--   an exact session id -- a rehearsal being a genuinely different row
--   means those boundaries are correct by construction, not by every
--   query remembering to filter an environment column. A missing filter
--   fails closed (wrong id -> no row), never "shows official data by
--   mistake." Local storage (IndexedDB, keyed by race_session_id) is
--   isolated the same way, for free, with no schema change of its own.
--
--   is_rehearsal marks a row as practice data. rehearsal_of_session_id
--   points a rehearsal row back at the real, official race it is
--   practicing -- null on every official row, including every row that
--   existed before this migration. race_sessions.status (draft/live/
--   finished/etc.) is reused unchanged for a rehearsal row's own
--   lifecycle; no new status values are introduced.
--
-- Safety:
--   Purely additive -- two new nullable/defaulted columns and one
--   partial index. Every existing row is implicitly is_rehearsal=false
--   with rehearsal_of_session_id null, so no existing race's meaning or
--   behavior changes. on delete cascade matches every other Split Watch
--   child-table cascade already in install/11 -- deleting an official
--   race also removes any rehearsal rows practicing it, rather than
--   leaving them orphaned.

begin;

alter table public.race_sessions
  add column if not exists is_rehearsal boolean not null default false,
  add column if not exists rehearsal_of_session_id uuid references public.race_sessions(id) on delete cascade;

create index if not exists race_sessions_rehearsal_of_index
  on public.race_sessions (rehearsal_of_session_id)
  where rehearsal_of_session_id is not null;

commit;
