-- Podium Watch Analytics: allow "story_view" as a real event type
-- Purpose:
--   team_analytics_events predates this project's install/ migration
--   convention (created directly in Supabase, like aotw_weeks/totw_weeks
--   and fan_poll's precedents -- see lib/engagement_service.mjs's header
--   comment), so there is no earlier install/*.sql file to diff against
--   for it. Its event_type column carries a check constraint
--   (team_analytics_events_event_type_check) that was never updated when
--   "story_view" was added to ANALYTICS_EVENT_TYPES in
--   lib/engagement_service.mjs -- every real per-article view attempt
--   was silently rejected at the database layer (23514, check
--   constraint violation) even though the application-level validation
--   correctly allowed it. Confirmed directly: a real view on
--   /stories/2026-preseason-boys-d1-top-20/ never reached the table.
--
-- What this does:
--   Drops and recreates that one check constraint with "story_view"
--   added to the allowed list -- every other currently-allowed value is
--   preserved exactly (matching lib/engagement_service.mjs's
--   ANALYTICS_EVENT_TYPES, which is the real, single source of truth for
--   what the application ever attempts to insert; nothing can reach this
--   table with a value outside that set regardless of what the database
--   constraint itself allows).
--
-- Safety:
--   Does not touch any existing row. Broadens the constraint (adds one
--   allowed value); does not narrow it, drop the column, or alter
--   anything else about the table.

begin;

alter table public.team_analytics_events
  drop constraint if exists team_analytics_events_event_type_check;

alter table public.team_analytics_events
  add constraint team_analytics_events_event_type_check
  check (event_type in (
    'team_profile_view',
    'directory_view',
    'schedule_view',
    'roster_view',
    'content_view',
    'social_click',
    'recruiting_click',
    'follow_submit',
    'sponsor_impression',
    'sponsor_click',
    'pace_calculator_use',
    'story_view'
  ));

commit;
