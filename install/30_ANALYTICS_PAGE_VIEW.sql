-- Podium Watch Analytics: allow "page_view" as a real event type
-- Purpose:
--   The OATCCC Coaches Poll page (/rankings/oatccc/) is a real, public
--   utility page with no team and no article behind it -- team_id is
--   already nullable on team_analytics_events (see
--   lib/engagement_service.mjs's recordAnalyticsEvent(), which only
--   validates team_id against team_pages when one is actually
--   supplied), and story_view already proved this same table can carry
--   a generic content_id-keyed view count for non-team content
--   (install/23_ANALYTICS_STORY_VIEW.sql). "page_view" is the same
--   pattern generalized to any standalone page, not just articles --
--   content_id carries the page's own path (e.g. "/rankings/oatccc/"),
--   so a single event type covers this page and any future one like it
--   without a new migration each time.
--
--   Matches install/23's exact precedent: this table's event_type
--   column carries a check constraint that must be explicitly widened
--   whenever lib/engagement_service.mjs's ANALYTICS_EVENT_TYPES set
--   gains a new value, or every real insert attempt is silently
--   rejected at the database layer (23514) even though application-
--   level validation already allowed it.
--
-- Safety:
--   Does not touch any existing row. Broadens the constraint (adds one
--   allowed value, "page_view"); does not narrow it, drop the column,
--   or alter anything else about the table. Every value install/23 and
--   the original table already allowed stays allowed.

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
    'page_view'
  ));

commit;
