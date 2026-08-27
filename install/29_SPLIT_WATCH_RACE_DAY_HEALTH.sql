-- Split Watch: Race Day Health (build plan Project 5)
-- Purpose:
--   The readiness checklist has reserved this exact gap since Project 2
--   shipped -- see lib/race_readiness_service.mjs's own header comment:
--   "'No unresolved synchronization or clock problem for this race' is
--   DELIBERATELY OMITTED, not faked... no health/sync/clock-integrity
--   signal exists anywhere in this codebase yet." This migration adds
--   the two honest, server-observable signals that make a real answer
--   possible:
--     1. last_sync_at -- stamped on every push_splits/pull_state call
--        from ANY device (coach or helper) while a race is live. The
--        server can never see an unsynced split still sitting in one
--        device's own IndexedDB (see race-local-store.js) -- but it CAN
--        see whether ANY device has actually talked to it recently,
--        which is exactly the objective, honest question "is someone
--        actively timing this race right now."
--     2. last_reported_clock_offset_ms / last_reported_clock_offset_at
--        -- every device already computes its own clock offset from the
--        server on each sync round trip (split-watch-live.js's
--        updateClockOffset()), purely to correct its own recovered-time
--        display. This is the first time that number is ever reported
--        back to the server, so a genuinely large disagreement can
--        surface on the coach's own readiness checklist instead of
--        silently only affecting one device's own precision.
--   Deliberately simple, not a full per-device audit table: the LATEST
--   report wins, from whichever device happened to sync most recently
--   -- an honest "most recent signal available," not a claim to track
--   every device separately. Good enough to catch "nobody has synced
--   in minutes" or "a phone's clock is badly off," which is the real
--   problem this project exists to catch.
--
-- Safety:
--   Purely additive -- three new nullable columns on race_sessions, no
--   existing column altered or dropped, no existing row's meaning
--   changes (all three are simply null until the next real sync call).

begin;

alter table public.race_sessions
  add column if not exists last_sync_at timestamptz,
  add column if not exists last_reported_clock_offset_ms numeric,
  add column if not exists last_reported_clock_offset_at timestamptz;

commit;
