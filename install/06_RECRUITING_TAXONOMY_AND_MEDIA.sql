-- Podium Watch Recruiting Phase Two: Event Group Taxonomy, Media, and Rank Movement
-- Purpose:
--   1. Replace the original event group taxonomy with the approved nine group set:
--      Cross Country, Distance, Middle Distance, Sprints, Hurdles, Jumps, Pole Vault,
--      Throws, and Combined Events, keeping an "other" fallback bucket.
--   2. Record the taxonomy change as a new Recruit Ratings methodology version instead
--      of silently changing the retired version.
--   3. Add an athlete media table for photos, video, and articles.
--   4. Add a rank snapshot table so Recruit Ratings can show ranking movement the same
--      way editorial rankings already do.
--
-- Safety:
--   This migration is additive. It does not delete any athlete, performance, rating,
--   or activity record. No rating has been published yet, so the taxonomy backfill
--   below has no live published data to migrate.
--   Run install/01, install/02, and install/03 before this migration.

begin;

create extension if not exists pgcrypto;

-- 1. Widen the event group constraints to the new taxonomy before backfilling values,
--    so old and new values are both briefly valid during the transition.

alter table public.athlete_event_catalog
  drop constraint if exists athlete_event_catalog_event_group_check;

alter table public.athlete_event_catalog
  add constraint athlete_event_catalog_event_group_check check (
    event_group in (
      'cross_country',
      'distance',
      'middle_distance',
      'sprints',
      'hurdles',
      'jumps',
      'pole_vault',
      'throws',
      'combined_events',
      'other',
      -- retired values, allowed only until the backfill below runs in this transaction
      'multis',
      'relays'
    )
  );

alter table public.athlete_performances
  drop constraint if exists athlete_performances_event_group_check;

alter table public.athlete_performances
  add constraint athlete_performances_event_group_check check (
    event_group is null or event_group in (
      'cross_country',
      'distance',
      'middle_distance',
      'sprints',
      'hurdles',
      'jumps',
      'pole_vault',
      'throws',
      'combined_events',
      'other',
      'multis',
      'relays'
    )
  );

alter table public.athlete_recruit_ratings
  drop constraint if exists athlete_recruit_ratings_event_group_check;

alter table public.athlete_recruit_ratings
  add constraint athlete_recruit_ratings_event_group_check check (
    event_group in (
      'cross_country',
      'distance',
      'middle_distance',
      'sprints',
      'hurdles',
      'jumps',
      'pole_vault',
      'throws',
      'combined_events',
      'other',
      'multis',
      'relays'
    )
  );

-- 2. Backfill the event catalog into the new taxonomy.
--    800 meters is classified as Middle Distance and 600 meters as Sprints, per the
--    approved Phase One architecture decision.
--
--    This runs against every row in the table, not a hardcoded list of expected
--    event keys, so it cannot miss a row. Any event key matching one of the
--    known 35 events gets its specific new group. Anything left over that still
--    carries a retired "multis" or "relays" value falls back to a safe group
--    (Combined Events or Other) instead of being left invalid. Anything already
--    valid under the new taxonomy is left unchanged.

update public.athlete_event_catalog
set event_group = case
  when event_key in ('xc_2_mile', 'xc_3k', 'xc_3200', 'xc_5k') then 'cross_country'
  when event_key in ('track_800', 'track_1000', 'track_1600', 'track_mile') then 'middle_distance'
  when event_key in ('track_3200', 'track_2_mile', 'track_5000') then 'distance'
  when event_key in ('track_60', 'track_100', 'track_200', 'track_300', 'track_400', 'track_500', 'track_600') then 'sprints'
  when event_key like 'hurdles_%' then 'hurdles'
  when event_key in ('high_jump', 'long_jump', 'triple_jump') then 'jumps'
  when event_key = 'pole_vault' then 'pole_vault'
  when event_key in ('shot_put', 'discus', 'weight_throw', 'hammer', 'javelin') then 'throws'
  when event_key in ('pentathlon', 'heptathlon', 'decathlon') then 'combined_events'
  when event_group = 'multis' then 'combined_events'
  when event_group = 'relays' then 'other'
  else event_group
end;

-- 3. Backfill any existing performance and rating rows to match the catalog,
--    then apply the same safety net directly to each table so no row can be
--    left holding a retired value even if its event_key does not match the
--    catalog (for example, a row whose event was later removed from the
--    catalog). Both are expected to affect zero rows today, since no
--    performance has been committed and no rating has been published yet,
--    but this keeps the migration correct if that changes before it is run.

update public.athlete_performances performance
set event_group = catalog.event_group
from public.athlete_event_catalog catalog
where performance.event_key = catalog.event_key
  and performance.event_group is distinct from catalog.event_group;

update public.athlete_performances
set event_group = case
  when event_group = 'multis' then 'combined_events'
  when event_group = 'relays' then 'other'
  else event_group
end
where event_group in ('multis', 'relays');

update public.athlete_recruit_ratings rating
set event_group = catalog.event_group
from public.athlete_event_catalog catalog
where rating.primary_event_key = catalog.event_key
  and rating.event_group is distinct from catalog.event_group;

update public.athlete_recruit_ratings
set event_group = case
  when event_group = 'multis' then 'combined_events'
  when event_group = 'relays' then 'other'
  else event_group
end
where event_group in ('multis', 'relays');

-- 4. Now that no row uses a retired value, remove "multis" and "relays" from the
--    allowed sets.

alter table public.athlete_event_catalog
  drop constraint if exists athlete_event_catalog_event_group_check;

alter table public.athlete_event_catalog
  add constraint athlete_event_catalog_event_group_check check (
    event_group in (
      'cross_country',
      'distance',
      'middle_distance',
      'sprints',
      'hurdles',
      'jumps',
      'pole_vault',
      'throws',
      'combined_events',
      'other'
    )
  );

alter table public.athlete_performances
  drop constraint if exists athlete_performances_event_group_check;

alter table public.athlete_performances
  add constraint athlete_performances_event_group_check check (
    event_group is null or event_group in (
      'cross_country',
      'distance',
      'middle_distance',
      'sprints',
      'hurdles',
      'jumps',
      'pole_vault',
      'throws',
      'combined_events',
      'other'
    )
  );

alter table public.athlete_recruit_ratings
  drop constraint if exists athlete_recruit_ratings_event_group_check;

alter table public.athlete_recruit_ratings
  add constraint athlete_recruit_ratings_event_group_check check (
    event_group in (
      'cross_country',
      'distance',
      'middle_distance',
      'sprints',
      'hurdles',
      'jumps',
      'pole_vault',
      'throws',
      'combined_events',
      'other'
    )
  );

-- 5. Record the taxonomy change as a new methodology version. The scoring rubric,
--    star bands, and publication rules are unchanged; only the event group set is
--    different, so the prior version is retired rather than edited in place.

update public.athlete_recruit_rating_methodologies
set status = 'retired'
where methodology_key = 'podium-watch-recruit-ratings-2026-1';

insert into public.athlete_recruit_rating_methodologies (
  methodology_key,
  name,
  version_label,
  status,
  effective_date,
  description,
  star_bands,
  principles,
  public_notes,
  created_by,
  updated_by,
  metadata
) values (
  'podium-watch-recruit-ratings-2026-2',
  'Podium Watch Recruit Ratings',
  '2026.2',
  'active',
  current_date,
  'An original Podium Watch editorial recruiting evaluation that combines verified performance level, championship evidence, consistency, development, versatility, graduation year context, and competition context. Version 2026.2 separates cross country from track distance events and splits Distance into Middle Distance and Distance so class and event group ranks are sport aware.',
  jsonb_build_array(
    jsonb_build_object('stars', 5, 'minimum_score', 95, 'maximum_score', 100, 'label', 'National level recruit'),
    jsonb_build_object('stars', 4, 'minimum_score', 90, 'maximum_score', 94.99, 'label', 'High level Division I prospect'),
    jsonb_build_object('stars', 3, 'minimum_score', 84, 'maximum_score', 89.99, 'label', 'Strong college prospect'),
    jsonb_build_object('stars', 2, 'minimum_score', 78, 'maximum_score', 83.99, 'label', 'Developing college prospect'),
    jsonb_build_object('stars', 1, 'minimum_score', 70, 'maximum_score', 77.99, 'label', 'Recruiting watch list')
  ),
  jsonb_build_array(
    'Verified performance level carries the most weight.',
    'Offers, school popularity, social following, and payment do not affect the rating.',
    'Championship performance, consistency, development, versatility, class year, and competition context may affect the evaluation.',
    'Every published rating requires at least one source linked or verified performance.',
    'Ratings are Podium Watch editorial analysis and are not official college offers or scholarship guarantees.',
    'Event groups are Cross Country, Distance, Middle Distance, Sprints, Hurdles, Jumps, Pole Vault, Throws, and Combined Events, so cross country and track distance runners are never ranked against each other.'
  ),
  'Ratings are independent editorial evaluations. Athletes may submit corrections and source links. No private contact information is published.',
  'Podium Watch',
  'Podium Watch',
  jsonb_build_object(
    'score_minimum', 70,
    'score_maximum', 100,
    'pay_to_play', false,
    'offers_affect_score', false,
    'replaces_methodology_key', 'podium-watch-recruit-ratings-2026-1',
    'taxonomy_version', 2
  )
)
on conflict (methodology_key) do update set
  name = excluded.name,
  version_label = excluded.version_label,
  status = excluded.status,
  effective_date = excluded.effective_date,
  description = excluded.description,
  star_bands = excluded.star_bands,
  principles = excluded.principles,
  public_notes = excluded.public_notes,
  updated_by = excluded.updated_by,
  metadata = athlete_recruit_rating_methodologies.metadata || excluded.metadata;

-- 6. Athlete media table, mirroring the existing team_content_items shape.

create table if not exists public.athlete_content_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  profile_id uuid not null references public.athlete_profiles(id) on delete cascade,
  content_type text not null check (
    content_type in ('photo', 'video', 'article', 'other')
  ),
  title text,
  url text not null,
  caption text,
  credit text,
  source_label text,
  source_url text,
  source_type text not null default 'community' check (
    source_type in ('official', 'supplied_reference', 'editorial', 'community')
  ),
  status text not null default 'draft' check (
    status in ('draft', 'published', 'hidden', 'archived')
  ),
  featured boolean not null default false,
  sort_order integer not null default 100,
  created_by text,
  updated_by text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists athlete_content_items_profile_index
  on public.athlete_content_items (profile_id, status, featured, sort_order)
  where archived_at is null;

create or replace function public.set_athlete_content_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists athlete_content_items_updated_at_trigger
  on public.athlete_content_items;
create trigger athlete_content_items_updated_at_trigger
before update on public.athlete_content_items
for each row execute function public.set_athlete_content_updated_at();

alter table public.athlete_content_items enable row level security;
revoke all on table public.athlete_content_items from anon, authenticated;
grant all on table public.athlete_content_items to service_role;

-- 7. Rank snapshot table, so Recruit Ratings can show movement the same way
--    athlete_ranking_entries.previous_rank already does for editorial rankings.

create table if not exists public.athlete_recruit_rating_rank_snapshots (
  id uuid primary key default gen_random_uuid(),
  captured_at timestamptz not null default now(),
  profile_id uuid not null references public.athlete_profiles(id) on delete cascade,
  methodology_id uuid not null references public.athlete_recruit_rating_methodologies(id) on delete cascade,
  event_group text not null,
  graduation_year integer not null,
  gender text not null,
  state_class_rank integer,
  event_group_rank integer
);

create index if not exists athlete_recruit_rank_snapshots_lookup_index
  on public.athlete_recruit_rating_rank_snapshots (
    profile_id,
    methodology_id,
    event_group,
    captured_at desc
  );

alter table public.athlete_recruit_rating_rank_snapshots enable row level security;
revoke all on table public.athlete_recruit_rating_rank_snapshots from anon, authenticated;
grant all on table public.athlete_recruit_rating_rank_snapshots to service_role;

commit;
