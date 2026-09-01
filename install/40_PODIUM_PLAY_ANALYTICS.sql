-- Podium Play (Phase 1): allow its analytics event types
-- Purpose:
--   team_analytics_events' event_type check constraint predates this
--   project's migration convention and has been widened before exactly
--   this way (see install/23_ANALYTICS_STORY_VIEW.sql, "story_view") --
--   an application-level allowlist alone is not enough, since a value the
--   app permits but the database constraint doesn't reject every real
--   insert with a 23514 violation, confirmed live during that incident.
--   lib/engagement_service.mjs's ANALYTICS_EVENT_TYPES is broadened in
--   the same commit as this migration; this file is what actually lets
--   those new values reach the table.
--
-- What this does:
--   Adds the 5 Podium Play Phase 1 event types to the existing allowed
--   list. Every other currently-allowed value is preserved exactly.
--
-- Safety:
--   Does not touch any existing row. Broadens the constraint only; does
--   not narrow it, drop the column, or alter anything else.
--
-- NOT RUN AUTOMATICALLY. Run only after explicit approval, same as every
-- other migration in this project.

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
    'story_view',
    'page_view',
    'podium_play_panel_viewed',
    'podium_play_game_started',
    'podium_play_game_completed',
    'podium_play_personal_record',
    'podium_play_vote_again_clicked'
  ));

commit;
