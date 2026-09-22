begin;

-- Site Presence: a lightweight "who's on the site right now" table,
-- separate from team_analytics_events (which is an append-only event
-- log used for historical counts, e.g. the Engagement Center's "Top
-- pages" panel). Presence needs the opposite shape -- one row per
-- active browser session, overwritten in place on every heartbeat --
-- so a real-time "currently active" admin view never has to scan a
-- growing history table just to answer "who's here right now".
--
-- session_id is the primary key (not a separate id column): the
-- client's own sessionStorage-scoped id (public/scripts/presence.js,
-- shared with public/scripts/page-view.js's podium_session_id) is
-- already a stable per-tab identity, so upserting on conflict(session_id)
-- is exactly "update this tab's current page and heartbeat time" with
-- no separate lookup needed.
create table if not exists public.site_presence (
  session_id text primary key,
  visitor_id text,
  path text not null,
  updated_at timestamptz not null default now()
);

-- Every read (lib/engagement_service.mjs's getLivePresence()) filters
-- on updated_at, and every cleanup pass deletes on it too -- the one
-- column this table is ever queried by.
create index if not exists site_presence_updated_at_idx
  on public.site_presence (updated_at);

commit;
