-- Split Watch: race archiving + one team-day parent link
-- Purpose:
--   1. A coach's race list (the race switcher on Plan/Live/Review, and
--      the main Split Watch hub's "Your races" list) accumulates old
--      meets all season and has no way to tidy it up short of deleting
--      results outright. archived_at lets a coach hide an old race from
--      those working lists without losing it or its recorded times --
--      it stays reachable by direct link (Plan/Live/Review, Review
--      results) exactly as before; only the "what am I actively
--      managing" lists start excluding it.
--   2. The parent/spectator link (install/13's spectator_visible) was
--      always exactly one link per race. A meet day with an HS and JH
--      race (or boys and girls) meant sending parents a different link
--      per race, with no way to move between them. No schema change is
--      needed for this half -- lib/race_viewer_service.mjs's
--      loadSpectatorDay() groups a team's already-spectator_visible,
--      already-non-rehearsal, already-non-archived races by race_date
--      and lets the public page switch between siblings -- this
--      migration exists only to make archived_at (used by both halves)
--      real.
--
-- Design:
--   archived_at is a plain nullable timestamp, not a boolean, so "when"
--   an old race was tidied away is preserved for free, matching this
--   project's existing convention (race_started_at/race_ended_at are
--   timestamps, not booleans, for the same reason). Every existing row
--   is implicitly archived_at = null (never archived), so no existing
--   race's meaning changes. A live race can never be archived (enforced
--   in lib/split_watch_service.mjs, not here) -- archiving also turns
--   spectator_visible off, so an archived race can never linger on a
--   parent's day-switcher either.
--
-- Safety:
--   Purely additive -- one new nullable column, no index needed at this
--   site's scale (every query already filters by team_id first).

begin;

alter table public.race_sessions
  add column if not exists archived_at timestamptz;

commit;
