-- Podium Watch Recruit Ratings and Performance History
-- Purpose:
--   1. Normalize verified cross country and track performances.
--   2. Add an original Podium Watch one through five star recruit rating system.
--   3. Track recruiting interest, offers, visits, commitments, and signings with source labels.
--   4. Support safe preview first performance imports.
--
-- Safety:
--   This migration is additive.
--   It does not delete or replace existing athletes, rankings, rosters, meets, results, or performances.
--   Run install/01_STATEWIDE_FOUNDATION_DATABASE.sql and
--   install/02_ATHLETE_PROFILE_FOUNDATION_DATABASE.sql first.
--
-- Editorial protection:
--   Published recruit ratings are Podium Watch editorial evaluations.
--   Ratings do not become official results and are never based on payment.
--   Public contact information is not created by this migration.

begin;

create extension if not exists pgcrypto;

create table if not exists public.athlete_event_catalog (
  event_key text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  display_name text not null,
  short_name text not null,
  sport_scope text not null check (
    sport_scope in ('cross_country', 'indoor_track', 'outdoor_track', 'all_track')
  ),
  event_group text not null check (
    event_group in (
      'distance',
      'sprints',
      'hurdles',
      'jumps',
      'pole_vault',
      'throws',
      'multis',
      'relays',
      'other'
    )
  ),
  measurement_type text not null check (
    measurement_type in ('time', 'distance', 'height', 'points', 'place', 'other')
  ),
  sort_direction text not null default 'asc' check (
    sort_direction in ('asc', 'desc')
  ),
  standard_unit text,
  public_visible boolean not null default true,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.athlete_event_aliases (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_key text not null references public.athlete_event_catalog(event_key) on delete cascade,
  alias text not null,
  normalized_alias text not null unique,
  notes text
);

alter table public.athlete_performances
  add column if not exists event_group text check (
    event_group is null or event_group in (
      'distance',
      'sprints',
      'hurdles',
      'jumps',
      'pole_vault',
      'throws',
      'multis',
      'relays',
      'other'
    )
  ),
  add column if not exists measurement_type text check (
    measurement_type is null or measurement_type in (
      'time',
      'distance',
      'height',
      'points',
      'place',
      'other'
    )
  ),
  add column if not exists mark_sort_value numeric,
  add column if not exists sort_direction text check (
    sort_direction is null or sort_direction in ('asc', 'desc')
  ),
  add column if not exists wind_legal boolean,
  add column if not exists course_context text,
  add column if not exists import_batch_id uuid,
  add column if not exists result_status text not null default 'official_result' check (
    result_status in (
      'official_result',
      'reviewed_result',
      'community_reported',
      'editorial_context'
    )
  );

create table if not exists public.athlete_recruit_rating_methodologies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  methodology_key text not null unique,
  name text not null,
  version_label text not null,
  status text not null default 'draft' check (
    status in ('draft', 'active', 'retired')
  ),
  effective_date date,
  description text not null,
  star_bands jsonb not null default '[]'::jsonb,
  principles jsonb not null default '[]'::jsonb,
  public_notes text,
  created_by text,
  updated_by text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.athlete_recruit_ratings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  profile_id uuid not null references public.athlete_profiles(id) on delete cascade,
  methodology_id uuid not null references public.athlete_recruit_rating_methodologies(id) on delete restrict,
  graduation_year integer not null check (
    graduation_year between 2000 and 2200
  ),
  gender text not null check (
    gender in ('boys', 'girls', 'unspecified')
  ),
  event_group text not null check (
    event_group in (
      'distance',
      'sprints',
      'hurdles',
      'jumps',
      'pole_vault',
      'throws',
      'multis',
      'other'
    )
  ),
  primary_event_key text references public.athlete_event_catalog(event_key) on delete set null,
  secondary_event_keys text[] not null default '{}'::text[],
  rating_score numeric(5,2) check (
    rating_score is null or rating_score between 70 and 100
  ),
  star_rating integer check (
    star_rating is null or star_rating between 1 and 5
  ),
  projection_level text check (
    projection_level is null or projection_level in (
      'national_elite',
      'high_division_one',
      'division_one',
      'division_two',
      'division_three_naia',
      'developing_college',
      'watch_list'
    )
  ),
  confidence_level text not null default 'developing' check (
    confidence_level in ('limited', 'developing', 'strong')
  ),
  evaluation text,
  strengths text,
  development_notes text,
  top_verified_mark_text text,
  top_verified_event_key text references public.athlete_event_catalog(event_key) on delete set null,
  based_on_verified_data boolean not null default false,
  verified_performance_count integer not null default 0 check (
    verified_performance_count >= 0
  ),
  data_cutoff_date date,
  status text not null default 'draft' check (
    status in ('draft', 'published', 'archived')
  ),
  published_at timestamptz,
  updated_by text,
  editorial_override_reason text,
  metadata jsonb not null default '{}'::jsonb,
  unique (profile_id, methodology_id, event_group)
);

create table if not exists public.athlete_recruiting_activity (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  profile_id uuid not null references public.athlete_profiles(id) on delete cascade,
  activity_type text not null check (
    activity_type in (
      'interest',
      'offer',
      'visit',
      'commitment',
      'signing',
      'other'
    )
  ),
  college_name text not null,
  college_division text,
  event_group text,
  activity_date date,
  verification_status text not null default 'reported' check (
    verification_status in (
      'reported',
      'confirmed_by_athlete',
      'confirmed_by_coach',
      'publicly_announced',
      'disputed'
    )
  ),
  source_label text not null,
  source_url text,
  public_visible boolean not null default false,
  notes text,
  created_by text,
  updated_by text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.athlete_performance_import_batches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  import_key text not null,
  source_label text not null,
  source_url text,
  source_type text not null default 'official' check (
    source_type in ('official', 'supplied_reference', 'editorial', 'community')
  ),
  status text not null default 'started' check (
    status in ('started', 'completed', 'failed')
  ),
  requested_by text,
  options jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  error_message text
);

alter table public.athlete_performances
  drop constraint if exists athlete_performances_import_batch_id_fkey;

alter table public.athlete_performances
  add constraint athlete_performances_import_batch_id_fkey
  foreign key (import_batch_id)
  references public.athlete_performance_import_batches(id)
  on delete set null;

create table if not exists public.athlete_performance_import_rows (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  batch_id uuid not null references public.athlete_performance_import_batches(id) on delete cascade,
  row_number integer not null,
  row_status text not null check (
    row_status in (
      'ready',
      'imported',
      'duplicate',
      'unmatched',
      'ambiguous',
      'invalid',
      'skipped'
    )
  ),
  profile_id uuid references public.athlete_profiles(id) on delete set null,
  performance_id uuid references public.athlete_performances(id) on delete set null,
  original_row jsonb not null default '{}'::jsonb,
  normalized_row jsonb not null default '{}'::jsonb,
  match_summary jsonb not null default '{}'::jsonb,
  error_message text,
  unique (batch_id, row_number)
);

create index if not exists athlete_event_catalog_group_index
  on public.athlete_event_catalog (event_group, sort_order, display_name);

create index if not exists athlete_performance_best_index
  on public.athlete_performances (
    profile_id,
    event_key,
    verification_status,
    public_visible,
    archived_at,
    mark_sort_value
  );

create index if not exists athlete_performance_import_batch_index
  on public.athlete_performances (import_batch_id)
  where import_batch_id is not null;

create index if not exists athlete_recruit_ratings_public_index
  on public.athlete_recruit_ratings (
    status,
    graduation_year,
    gender,
    event_group,
    star_rating desc,
    rating_score desc
  )
  where archived_at is null;

create index if not exists athlete_recruit_ratings_profile_index
  on public.athlete_recruit_ratings (profile_id, status, updated_at desc);

create index if not exists athlete_recruit_activity_profile_index
  on public.athlete_recruiting_activity (
    profile_id,
    public_visible,
    activity_date desc,
    created_at desc
  )
  where archived_at is null;

create index if not exists athlete_performance_import_batches_recent_index
  on public.athlete_performance_import_batches (created_at desc);

create index if not exists athlete_performance_import_rows_status_index
  on public.athlete_performance_import_rows (batch_id, row_status, row_number);

create or replace view public.athlete_best_performances as
with ranked as (
  select
    performance.*,
    row_number() over (
      partition by performance.profile_id, performance.event_key, performance.sport
      order by
        case
          when coalesce(performance.sort_direction, catalog.sort_direction, 'asc') = 'asc'
            then performance.mark_sort_value
        end asc nulls last,
        case
          when coalesce(performance.sort_direction, catalog.sort_direction, 'asc') = 'desc'
            then performance.mark_sort_value
        end desc nulls last,
        performance.meet_date desc nulls last,
        performance.created_at desc
    ) as best_rank
  from public.athlete_performances performance
  left join public.athlete_event_catalog catalog
    on catalog.event_key = performance.event_key
  where performance.public_visible = true
    and performance.archived_at is null
    and performance.verification_status in ('source_linked', 'verified')
    and (
      performance.source_type in ('official', 'supplied_reference')
      or (
        performance.source_type = 'community'
        and performance.verification_status = 'verified'
      )
    )
    and performance.result_status in ('official_result', 'reviewed_result')
    and performance.mark_sort_value is not null
)
select *
from ranked
where best_rank = 1;

create or replace view public.athlete_published_recruit_ratings as
with published as (
  select *
  from public.athlete_recruit_ratings
  where status = 'published'
    and archived_at is null
),
profile_scores as (
  select
    profile_id,
    graduation_year,
    gender,
    max(rating_score) as overall_rating_score
  from published
  group by profile_id, graduation_year, gender
)
select
  rating.*,
  dense_rank() over (
    partition by rating.graduation_year, rating.gender
    order by profile_scores.overall_rating_score desc nulls last
  ) as state_class_rank,
  dense_rank() over (
    partition by rating.graduation_year, rating.gender, rating.event_group
    order by rating.rating_score desc nulls last, rating.updated_at asc
  ) as event_group_rank
from published rating
join profile_scores
  on profile_scores.profile_id = rating.profile_id
  and profile_scores.graduation_year = rating.graduation_year
  and profile_scores.gender = rating.gender;

create or replace function public.set_recruiting_foundation_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.require_publishable_recruit_rating()
returns trigger
language plpgsql
as $$
declare
  evidence_count integer := 0;
begin
  if new.rating_score is not null then
    new.star_rating := case
      when new.rating_score >= 95 then 5
      when new.rating_score >= 90 then 4
      when new.rating_score >= 84 then 3
      when new.rating_score >= 78 then 2
      else 1
    end;
  else
    new.star_rating := null;
  end if;

  if new.status = 'published' then
    if new.rating_score is null then
      raise exception 'RECRUIT_RATING_SCORE_REQUIRED';
    end if;

    select count(*)
    into evidence_count
    from public.athlete_performances performance
    where performance.profile_id = new.profile_id
      and performance.archived_at is null
      and performance.verification_status in ('source_linked', 'verified')
      and (
        performance.source_type in ('official', 'supplied_reference')
        or (
          performance.source_type = 'community'
          and performance.verification_status = 'verified'
        )
      )
      and performance.result_status in ('official_result', 'reviewed_result')
      and (
        performance.event_group = new.event_group
        or (
          new.primary_event_key is not null
          and performance.event_key = new.primary_event_key
        )
      );

    if not new.based_on_verified_data or evidence_count < 1 then
      raise exception 'RECRUIT_RATING_VERIFIED_PERFORMANCE_REQUIRED';
    end if;

    if new.top_verified_event_key is not null and not exists (
      select 1
      from public.athlete_performances performance
      where performance.profile_id = new.profile_id
        and performance.archived_at is null
        and performance.verification_status in ('source_linked', 'verified')
        and (
          performance.source_type in ('official', 'supplied_reference')
          or (
            performance.source_type = 'community'
            and performance.verification_status = 'verified'
          )
        )
        and performance.result_status in ('official_result', 'reviewed_result')
        and performance.event_key = new.top_verified_event_key
        and (
          performance.event_group = new.event_group
          or performance.event_key = new.primary_event_key
        )
    ) then
      raise exception 'RECRUIT_RATING_TOP_PERFORMANCE_REQUIRED';
    end if;

    new.verified_performance_count := evidence_count;

    if new.evaluation is null or length(btrim(new.evaluation)) < 40 then
      raise exception 'RECRUIT_RATING_EVALUATION_REQUIRED';
    end if;

    if new.data_cutoff_date is null then
      raise exception 'RECRUIT_RATING_DATA_CUTOFF_REQUIRED';
    end if;

    new.published_at := coalesce(new.published_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists athlete_event_catalog_updated_at_trigger
  on public.athlete_event_catalog;
create trigger athlete_event_catalog_updated_at_trigger
before update on public.athlete_event_catalog
for each row execute function public.set_recruiting_foundation_updated_at();

drop trigger if exists athlete_recruit_methodologies_updated_at_trigger
  on public.athlete_recruit_rating_methodologies;
create trigger athlete_recruit_methodologies_updated_at_trigger
before update on public.athlete_recruit_rating_methodologies
for each row execute function public.set_recruiting_foundation_updated_at();

drop trigger if exists athlete_recruit_ratings_updated_at_trigger
  on public.athlete_recruit_ratings;
create trigger athlete_recruit_ratings_updated_at_trigger
before update on public.athlete_recruit_ratings
for each row execute function public.set_recruiting_foundation_updated_at();

drop trigger if exists athlete_recruit_ratings_publish_trigger
  on public.athlete_recruit_ratings;
create trigger athlete_recruit_ratings_publish_trigger
before insert or update on public.athlete_recruit_ratings
for each row execute function public.require_publishable_recruit_rating();

drop trigger if exists athlete_recruit_activity_updated_at_trigger
  on public.athlete_recruiting_activity;
create trigger athlete_recruit_activity_updated_at_trigger
before update on public.athlete_recruiting_activity
for each row execute function public.set_recruiting_foundation_updated_at();

alter table public.athlete_event_catalog enable row level security;
alter table public.athlete_event_aliases enable row level security;
alter table public.athlete_recruit_rating_methodologies enable row level security;
alter table public.athlete_recruit_ratings enable row level security;
alter table public.athlete_recruiting_activity enable row level security;
alter table public.athlete_performance_import_batches enable row level security;
alter table public.athlete_performance_import_rows enable row level security;

revoke all on table public.athlete_event_catalog from anon, authenticated;
revoke all on table public.athlete_event_aliases from anon, authenticated;
revoke all on table public.athlete_recruit_rating_methodologies from anon, authenticated;
revoke all on table public.athlete_recruit_ratings from anon, authenticated;
revoke all on table public.athlete_recruiting_activity from anon, authenticated;
revoke all on table public.athlete_performance_import_batches from anon, authenticated;
revoke all on table public.athlete_performance_import_rows from anon, authenticated;
revoke all on table public.athlete_best_performances from anon, authenticated;
revoke all on table public.athlete_published_recruit_ratings from anon, authenticated;

grant all on table public.athlete_event_catalog to service_role;
grant all on table public.athlete_event_aliases to service_role;
grant all on table public.athlete_recruit_rating_methodologies to service_role;
grant all on table public.athlete_recruit_ratings to service_role;
grant all on table public.athlete_recruiting_activity to service_role;
grant all on table public.athlete_performance_import_batches to service_role;
grant all on table public.athlete_performance_import_rows to service_role;
grant select on table public.athlete_best_performances to service_role;
grant select on table public.athlete_published_recruit_ratings to service_role;

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
  'podium-watch-recruit-ratings-2026-1',
  'Podium Watch Recruit Ratings',
  '2026.1',
  'active',
  '2026-08-03',
  'An original Podium Watch editorial recruiting evaluation that combines verified performance level, championship evidence, consistency, development, versatility, graduation year context, and competition context.',
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
    'Ratings are Podium Watch editorial analysis and are not official college offers or scholarship guarantees.'
  ),
  'Ratings are independent editorial evaluations. Athletes may submit corrections and source links. No private contact information is published.',
  'Podium Watch',
  'Podium Watch',
  jsonb_build_object(
    'score_minimum', 70,
    'score_maximum', 100,
    'pay_to_play', false,
    'offers_affect_score', false
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

insert into public.athlete_event_catalog (
  event_key,
  display_name,
  short_name,
  sport_scope,
  event_group,
  measurement_type,
  sort_direction,
  standard_unit,
  sort_order
) values
  ('xc_2_mile', 'Cross Country 2 Mile', '2 Mile XC', 'cross_country', 'distance', 'time', 'asc', 'seconds', 10),
  ('xc_3k', 'Cross Country 3K', '3K XC', 'cross_country', 'distance', 'time', 'asc', 'seconds', 20),
  ('xc_3200', 'Cross Country 3200', '3200 XC', 'cross_country', 'distance', 'time', 'asc', 'seconds', 30),
  ('xc_5k', 'Cross Country 5K', '5K XC', 'cross_country', 'distance', 'time', 'asc', 'seconds', 40),
  ('track_60', '60 Meters', '60', 'indoor_track', 'sprints', 'time', 'asc', 'seconds', 100),
  ('track_100', '100 Meters', '100', 'outdoor_track', 'sprints', 'time', 'asc', 'seconds', 110),
  ('track_200', '200 Meters', '200', 'all_track', 'sprints', 'time', 'asc', 'seconds', 120),
  ('track_300', '300 Meters', '300', 'indoor_track', 'sprints', 'time', 'asc', 'seconds', 130),
  ('track_400', '400 Meters', '400', 'all_track', 'sprints', 'time', 'asc', 'seconds', 140),
  ('track_500', '500 Meters', '500', 'indoor_track', 'sprints', 'time', 'asc', 'seconds', 150),
  ('track_600', '600 Meters', '600', 'indoor_track', 'distance', 'time', 'asc', 'seconds', 160),
  ('track_800', '800 Meters', '800', 'all_track', 'distance', 'time', 'asc', 'seconds', 170),
  ('track_1000', '1000 Meters', '1000', 'indoor_track', 'distance', 'time', 'asc', 'seconds', 180),
  ('track_1600', '1600 Meters', '1600', 'all_track', 'distance', 'time', 'asc', 'seconds', 190),
  ('track_mile', 'One Mile', 'Mile', 'all_track', 'distance', 'time', 'asc', 'seconds', 200),
  ('track_3200', '3200 Meters', '3200', 'all_track', 'distance', 'time', 'asc', 'seconds', 210),
  ('track_2_mile', 'Two Mile', '2 Mile', 'all_track', 'distance', 'time', 'asc', 'seconds', 220),
  ('track_5000', '5000 Meters', '5000', 'all_track', 'distance', 'time', 'asc', 'seconds', 230),
  ('hurdles_60', '60 Meter Hurdles', '60H', 'indoor_track', 'hurdles', 'time', 'asc', 'seconds', 300),
  ('hurdles_100', '100 Meter Hurdles', '100H', 'outdoor_track', 'hurdles', 'time', 'asc', 'seconds', 310),
  ('hurdles_110', '110 Meter Hurdles', '110H', 'outdoor_track', 'hurdles', 'time', 'asc', 'seconds', 320),
  ('hurdles_300', '300 Meter Hurdles', '300H', 'outdoor_track', 'hurdles', 'time', 'asc', 'seconds', 330),
  ('hurdles_400', '400 Meter Hurdles', '400H', 'outdoor_track', 'hurdles', 'time', 'asc', 'seconds', 340),
  ('high_jump', 'High Jump', 'HJ', 'all_track', 'jumps', 'height', 'desc', 'meters', 400),
  ('long_jump', 'Long Jump', 'LJ', 'all_track', 'jumps', 'distance', 'desc', 'meters', 410),
  ('triple_jump', 'Triple Jump', 'TJ', 'all_track', 'jumps', 'distance', 'desc', 'meters', 420),
  ('pole_vault', 'Pole Vault', 'PV', 'all_track', 'pole_vault', 'height', 'desc', 'meters', 430),
  ('shot_put', 'Shot Put', 'Shot', 'all_track', 'throws', 'distance', 'desc', 'meters', 500),
  ('discus', 'Discus', 'Discus', 'outdoor_track', 'throws', 'distance', 'desc', 'meters', 510),
  ('weight_throw', 'Weight Throw', 'Weight', 'indoor_track', 'throws', 'distance', 'desc', 'meters', 520),
  ('hammer', 'Hammer Throw', 'Hammer', 'outdoor_track', 'throws', 'distance', 'desc', 'meters', 530),
  ('javelin', 'Javelin', 'Javelin', 'outdoor_track', 'throws', 'distance', 'desc', 'meters', 540),
  ('pentathlon', 'Pentathlon', 'Pentathlon', 'indoor_track', 'multis', 'points', 'desc', 'points', 600),
  ('heptathlon', 'Heptathlon', 'Heptathlon', 'all_track', 'multis', 'points', 'desc', 'points', 610),
  ('decathlon', 'Decathlon', 'Decathlon', 'outdoor_track', 'multis', 'points', 'desc', 'points', 620)
on conflict (event_key) do update set
  display_name = excluded.display_name,
  short_name = excluded.short_name,
  sport_scope = excluded.sport_scope,
  event_group = excluded.event_group,
  measurement_type = excluded.measurement_type,
  sort_direction = excluded.sort_direction,
  standard_unit = excluded.standard_unit,
  sort_order = excluded.sort_order;

insert into public.athlete_event_aliases (
  event_key,
  alias,
  normalized_alias
) values
  ('xc_5k', '5K', '5k'),
  ('xc_5k', '5000 Cross Country', '5000 cross country'),
  ('xc_2_mile', '2 Mile Cross Country', '2 mile cross country'),
  ('track_60', '60m', '60m'),
  ('track_100', '100m', '100m'),
  ('track_200', '200m', '200m'),
  ('track_400', '400m', '400m'),
  ('track_800', '800m', '800m'),
  ('track_1600', '1600m', '1600m'),
  ('track_1600', '1600', '1600'),
  ('track_mile', 'Mile', 'mile'),
  ('track_mile', '1 Mile', '1 mile'),
  ('track_3200', '3200m', '3200m'),
  ('track_3200', '3200', '3200'),
  ('track_2_mile', '2 Mile', '2 mile'),
  ('track_5000', '5000m', '5000m'),
  ('hurdles_60', '60H', '60h'),
  ('hurdles_100', '100H', '100h'),
  ('hurdles_110', '110H', '110h'),
  ('hurdles_300', '300H', '300h'),
  ('hurdles_400', '400H', '400h'),
  ('high_jump', 'HJ', 'hj'),
  ('long_jump', 'LJ', 'lj'),
  ('triple_jump', 'TJ', 'tj'),
  ('pole_vault', 'PV', 'pv'),
  ('shot_put', 'Shot', 'shot'),
  ('shot_put', 'Shot Put', 'shot put'),
  ('discus', 'Discus', 'discus')
on conflict (normalized_alias) do update set
  event_key = excluded.event_key,
  alias = excluded.alias;

commit;
