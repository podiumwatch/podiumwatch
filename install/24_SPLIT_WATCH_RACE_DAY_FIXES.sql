-- Split Watch: Live Race Day Fixes
-- Purpose:
--   Three small additive changes driven by real race-day feedback
--   (Shelby County Preview, 2026-08-25), not a redesign:
--     1. team_race_day_codes gains expires_at -- the helper code is
--        changing from an 8-character alphanumeric code (~1.1 trillion
--        possible values, effectively never collides) to a 4-digit
--        numeric code (only 10,000 possible values). A code that never
--        expires would eventually have to be checked for collisions
--        against every code ever generated, across every team, forever.
--        A short expiry means "currently active" is a small, bounded
--        set, and an expired code's value becomes safely reusable
--        automatically -- no separate reuse/cleanup step needed.
--     2. race_sessions gains a small, audited clock-correction pair --
--        Race Clock Adjustment (a coach-only "align Split Watch with
--        the official scoreboard" action). race_start_adjustment_seconds
--        is a signed correction applied on top of the untouched
--        race_started_at when computing official elapsed time; it never
--        rewrites any raw captured timestamp
--        (race_splits.wall_clock_captured_at is never touched by this).
--        race_clock_adjusted_at is the audit stamp -- its mere presence
--        is what lets the Review screen show "this race's clock was
--        adjusted," without needing a separate history table for what
--        is, in practice, a rare, single, deliberate coach action.
--   See lib/race_day_auth.mjs and lib/split_watch_service.mjs for the
--   application code that reads/writes these columns.
--
-- Safety:
--   Purely additive -- three new nullable/defaulted columns, no existing
--   column altered or dropped, no existing row's meaning changes
--   (race_start_adjustment_seconds defaults to 0, i.e. "no correction,"
--   which is exactly how every already-recorded elapsed_seconds value on
--   every existing race must keep behaving).

begin;

alter table public.team_race_day_codes
  add column if not exists expires_at timestamptz;

alter table public.race_sessions
  add column if not exists race_start_adjustment_seconds numeric not null default 0,
  add column if not exists race_clock_adjusted_at timestamptz,
  add column if not exists race_clock_adjustment_note text;

commit;
