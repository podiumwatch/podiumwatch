-- Podium Watch Analytics: allow the Podium Watch Shop card's events
-- Purpose:
--   The shop card (src/lib/merch_card.mjs, public/scripts/merch-card.js)
--   records three events on team_analytics_events, the same table and
--   endpoint as page_view (/api/engagement/track):
--     merch_view    the card was at least half in view (once per page and placement)
--     merch_swatch  a color was picked
--     merch_click   the photo, the button or the selected color was clicked
--   content_type = placement (vote-page, ballot, after-vote, story-end,
--   results-end, rankings-end, wrapped), content_id = product id,
--   metadata.color = color. Admin > Engagement > Merch reads them.
--
--   Same precedent as install/30 and install/40: the event_type check
--   constraint must list every value lib/engagement_service.mjs's
--   ANALYTICS_EVENT_TYPES allows, or inserts are rejected (23514). Until
--   this runs, the server drops merch events quietly.
--
-- Safety:
--   Does not touch any row. Only widens the constraint: every value
--   install/40 allowed stays allowed, plus the three merch events.

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
    'podium_play_vote_again_clicked',
    'merch_view',
    'merch_swatch',
    'merch_click'
  ));

-- The admin Merch panel reads the last 7 days of these events.
create index if not exists team_analytics_events_merch_recent
  on public.team_analytics_events (event_type, created_at desc)
  where event_type in ('merch_view', 'merch_swatch', 'merch_click');

commit;
