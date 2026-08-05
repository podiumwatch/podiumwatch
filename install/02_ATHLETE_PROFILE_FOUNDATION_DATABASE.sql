-- Podium Watch Athlete Profile and Recruiting Foundation
-- Purpose:
--   1. Create one permanent statewide identity for each athlete.
--   2. Connect athlete identities to official schools, team pages, rosters, rankings, stories, and future results.
--   3. Preserve source and verification status so editorial information is never presented as an official result.
--   4. Add a privacy safe recruiting foundation without publishing personal contact information.
--
-- Safety:
--   This migration is additive.
--   It does not delete team rosters, rankings, stories, meets, results, or existing athlete records.
--   Run install/01_STATEWIDE_FOUNDATION_DATABASE.sql before this migration.

begin;

create extension if not exists pgcrypto;

create table if not exists public.athlete_data_sources (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_key text not null unique,
  source_name text not null,
  source_organization text,
  source_type text not null default 'editorial' check (
    source_type in (
      'official',
      'supplied_reference',
      'editorial',
      'community',
      'team_roster'
    )
  ),
  source_url text,
  source_file text,
  season_label text,
  last_reviewed_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.athlete_profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  archived_at timestamptz,
  merged_into_profile_id uuid references public.athlete_profiles(id) on delete set null,
  source_identity_key text unique,
  slug text not null unique,
  first_name text not null,
  last_name text not null,
  preferred_name text,
  display_name text not null,
  normalized_name text not null,
  gender text not null default 'unspecified' check (
    gender in ('boys', 'girls', 'unspecified')
  ),
  graduation_year integer check (
    graduation_year is null or graduation_year between 2000 and 2200
  ),
  graduation_year_source text,
  current_school_id uuid references public.ohio_schools(id) on delete set null,
  current_team_id uuid references public.team_pages(id) on delete set null,
  athlete_status text not null default 'active' check (
    athlete_status in (
      'active',
      'inactive',
      'graduated',
      'transferred',
      'other'
    )
  ),
  bio text,
  photo_url text,
  hometown text,
  college_commitment text,
  college_commitment_verified boolean not null default false,
  public_visible boolean not null default false,
  verified boolean not null default false,
  verification_status text not null default 'unverified' check (
    verification_status in (
      'unverified',
      'community_submitted',
      'team_roster_linked',
      'editorial_source_linked',
      'source_verified',
      'admin_verified',
      'disputed'
    )
  ),
  suspended boolean not null default false,
  admin_locked boolean not null default false,
  recruiting_enabled boolean not null default false,
  recruiting_headline text,
  primary_events text[] not null default '{}'::text[],
  college_interests text,
  recruiting_contact_route text not null default 'none' check (
    recruiting_contact_route in ('none', 'team', 'podium_watch')
  ),
  recruiting_consent_confirmed boolean not null default false,
  recruiting_consent_recorded_at timestamptz,
  source_id uuid references public.athlete_data_sources(id) on delete set null,
  last_source_reviewed_at timestamptz,
  created_by text,
  updated_by text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.athlete_profile_aliases (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  profile_id uuid not null references public.athlete_profiles(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  source_id uuid references public.athlete_data_sources(id) on delete set null,
  notes text,
  unique (profile_id, normalized_alias)
);

create table if not exists public.athlete_school_history (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  profile_id uuid not null references public.athlete_profiles(id) on delete cascade,
  school_id uuid references public.ohio_schools(id) on delete set null,
  team_id uuid references public.team_pages(id) on delete set null,
  school_name_snapshot text not null,
  season_start_year integer check (
    season_start_year is null or season_start_year between 2000 and 2200
  ),
  season_end_year integer check (
    season_end_year is null or season_end_year between 2000 and 2201
  ),
  grade_label text,
  current boolean not null default false,
  verified boolean not null default false,
  source_id uuid references public.athlete_data_sources(id) on delete set null,
  notes text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.athlete_performances (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  profile_id uuid not null references public.athlete_profiles(id) on delete cascade,
  school_id uuid references public.ohio_schools(id) on delete set null,
  team_id uuid references public.team_pages(id) on delete set null,
  sport text not null check (
    sport in ('cross_country', 'indoor_track', 'outdoor_track')
  ),
  season_year integer not null check (
    season_year between 2000 and 2200
  ),
  event_name text not null,
  event_key text not null,
  mark_text text not null,
  mark_value numeric,
  mark_unit text,
  record_type text not null default 'race_result' check (
    record_type in (
      'race_result',
      'personal_best',
      'season_best',
      'split',
      'other'
    )
  ),
  meet_name text,
  meet_date date,
  place integer,
  grade integer check (
    grade is null or grade between 6 and 12
  ),
  wind_text text,
  source_key text unique,
  source_label text not null,
  source_url text,
  source_type text not null default 'community' check (
    source_type in ('official', 'supplied_reference', 'editorial', 'community', 'team_roster')
  ),
  verification_status text not null default 'unverified' check (
    verification_status in ('unverified', 'source_linked', 'verified', 'disputed')
  ),
  public_visible boolean not null default true,
  source_id uuid references public.athlete_data_sources(id) on delete set null,
  verified_at timestamptz,
  verified_by text,
  notes text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.athlete_ranking_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  profile_id uuid not null references public.athlete_profiles(id) on delete cascade,
  ranking_entry_key text not null unique,
  ranking_title text not null,
  ranking_slug text not null,
  ranking_href text not null,
  ranking_type text not null default 'Podium Watch editorial ranking',
  sport text not null,
  gender text not null,
  division text,
  division_number integer,
  season_year integer,
  event_name text,
  rank integer not null check (rank > 0),
  previous_rank integer,
  mark_snapshot text,
  explanation text,
  source_label text,
  source_file text,
  updated_date date,
  current boolean not null default true,
  source_id uuid references public.athlete_data_sources(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.athlete_story_links (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  profile_id uuid not null references public.athlete_profiles(id) on delete cascade,
  story_slug text not null,
  story_title text,
  story_href text,
  story_date date,
  relationship text not null default 'mentioned' check (
    relationship in ('featured', 'interviewed', 'ranked', 'awarded', 'mentioned')
  ),
  source text not null default 'manual' check (
    source in ('manual', 'automatic', 'admin')
  ),
  public_visible boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  unique (profile_id, story_slug, relationship)
);

create table if not exists public.athlete_profile_corrections (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  profile_id uuid references public.athlete_profiles(id) on delete set null,
  athlete_slug text,
  correction_type text not null check (
    correction_type in (
      'name',
      'school',
      'graduation_year',
      'performance',
      'division',
      'college_commitment',
      'duplicate',
      'privacy',
      'other'
    )
  ),
  details text not null,
  source_url text,
  submitter_name text,
  submitter_email text,
  submitted_ip_hash text,
  status text not null default 'open' check (
    status in ('open', 'reviewing', 'resolved', 'rejected')
  ),
  resolution_note text,
  resolved_by text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.athlete_import_batches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  import_key text not null,
  status text not null default 'started' check (
    status in ('started', 'completed', 'failed')
  ),
  source_id uuid references public.athlete_data_sources(id) on delete set null,
  requested_by text,
  options jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  error_message text
);

create table if not exists public.athlete_profile_merges (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source_profile_id uuid not null references public.athlete_profiles(id) on delete restrict,
  target_profile_id uuid not null references public.athlete_profiles(id) on delete restrict,
  merged_by text not null,
  reason text,
  summary jsonb not null default '{}'::jsonb
);

alter table public.team_athletes
  add column if not exists athlete_profile_id uuid references public.athlete_profiles(id) on delete set null;

create index if not exists athlete_profiles_public_lookup_index
  on public.athlete_profiles (public_visible, suspended, archived_at, normalized_name);

create index if not exists athlete_profiles_school_index
  on public.athlete_profiles (current_school_id, graduation_year, gender);

create index if not exists athlete_profiles_team_index
  on public.athlete_profiles (current_team_id, graduation_year, gender);

create index if not exists athlete_profiles_verification_index
  on public.athlete_profiles (verification_status, verified, updated_at desc);

create index if not exists athlete_profile_alias_lookup_index
  on public.athlete_profile_aliases (normalized_alias);

create unique index if not exists athlete_school_history_unique_index
  on public.athlete_school_history (
    profile_id,
    coalesce(school_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(season_start_year, 0),
    coalesce(season_end_year, 0)
  );

create index if not exists athlete_school_history_profile_index
  on public.athlete_school_history (profile_id, current desc, season_start_year desc);

create index if not exists athlete_performances_profile_index
  on public.athlete_performances (profile_id, season_year desc, event_key, mark_value);

create index if not exists athlete_performances_public_index
  on public.athlete_performances (public_visible, verification_status, meet_date desc);

create index if not exists athlete_ranking_profile_index
  on public.athlete_ranking_entries (profile_id, current desc, updated_date desc, rank);

create index if not exists athlete_ranking_filter_index
  on public.athlete_ranking_entries (sport, gender, division_number, season_year, current, rank);

create index if not exists athlete_story_profile_index
  on public.athlete_story_links (profile_id, public_visible, story_date desc);

create index if not exists athlete_corrections_status_index
  on public.athlete_profile_corrections (status, created_at desc);

create index if not exists athlete_import_batches_recent_index
  on public.athlete_import_batches (created_at desc);

create index if not exists team_athletes_global_profile_index
  on public.team_athletes (athlete_profile_id)
  where athlete_profile_id is not null;

create or replace function public.set_athlete_foundation_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.require_athlete_recruiting_consent()
returns trigger
language plpgsql
as $$
begin
  if new.recruiting_enabled and not new.recruiting_consent_confirmed then
    raise exception 'ATHLETE_RECRUITING_CONSENT_REQUIRED';
  end if;

  if new.recruiting_enabled and new.recruiting_contact_route = 'none' then
    raise exception 'ATHLETE_RECRUITING_CONTACT_ROUTE_REQUIRED';
  end if;

  if new.recruiting_consent_confirmed and new.recruiting_consent_recorded_at is null then
    new.recruiting_consent_recorded_at = now();
  end if;

  return new;
end;
$$;

create or replace function public.athlete_commit_seed_import_v1(
  p_rows jsonb,
  p_source_id uuid,
  p_actor text,
  p_publish boolean default true,
  p_link_rosters boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_profile_id uuid;
  v_existing_profile_id uuid;
  v_school_id uuid;
  v_team_id uuid;
  v_ranking jsonb;
  v_roster_id text;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_rankings integer := 0;
  v_school_links integer := 0;
  v_roster_links integer := 0;
begin
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'ATHLETE_IMPORT_ROWS_REQUIRED';
  end if;

  for v_row in
    select value from jsonb_array_elements(p_rows)
  loop
    v_existing_profile_id := nullif(v_row->>'existing_profile_id', '')::uuid;
    v_school_id := nullif(v_row->>'school_id', '')::uuid;
    v_team_id := nullif(v_row->>'team_id', '')::uuid;
    v_ranking := coalesce(v_row->'ranking', '{}'::jsonb);

    if v_existing_profile_id is not null then
      update public.athlete_profiles
      set
        source_identity_key = coalesce(source_identity_key, v_row->>'source_identity_key'),
        first_name = case
          when verification_status in ('team_roster_linked', 'source_verified', 'admin_verified')
            then first_name
          else v_row->>'first_name'
        end,
        last_name = case
          when verification_status in ('team_roster_linked', 'source_verified', 'admin_verified')
            then last_name
          else v_row->>'last_name'
        end,
        display_name = case
          when verification_status in ('team_roster_linked', 'source_verified', 'admin_verified')
            then display_name
          else v_row->>'display_name'
        end,
        normalized_name = case
          when verification_status in ('team_roster_linked', 'source_verified', 'admin_verified')
            then normalized_name
          else v_row->>'normalized_name'
        end,
        gender = case
          when verification_status in ('team_roster_linked', 'source_verified', 'admin_verified')
            then gender
          else v_row->>'gender'
        end,
        graduation_year = case
          when verification_status in ('team_roster_linked', 'source_verified', 'admin_verified')
            then graduation_year
          else nullif(v_row->>'graduation_year', '')::integer
        end,
        graduation_year_source = case
          when verification_status in ('team_roster_linked', 'source_verified', 'admin_verified')
            then graduation_year_source
          else v_row->>'graduation_year_source'
        end,
        current_school_id = coalesce(current_school_id, v_school_id),
        current_team_id = coalesce(current_team_id, v_team_id),
        public_visible = public_visible or p_publish,
        published_at = case
          when public_visible or p_publish then coalesce(published_at, now())
          else published_at
        end,
        verification_status = case
          when verification_status in ('team_roster_linked', 'source_verified', 'admin_verified')
            then verification_status
          else 'editorial_source_linked'
        end,
        source_id = coalesce(source_id, p_source_id),
        last_source_reviewed_at = now(),
        updated_by = p_actor,
        metadata = metadata || jsonb_build_object(
          'seed_dataset', 'podium-watch-2026-xc-ranking-athlete-seed',
          'seed_school_name', v_row->>'school_name',
          'seed_grade_label', v_row->>'grade_label'
        )
      where id = v_existing_profile_id
      returning id into v_profile_id;

      v_updated := v_updated + 1;
    else
      insert into public.athlete_profiles (
        source_identity_key,
        slug,
        first_name,
        last_name,
        display_name,
        normalized_name,
        gender,
        graduation_year,
        graduation_year_source,
        current_school_id,
        current_team_id,
        athlete_status,
        public_visible,
        published_at,
        verification_status,
        source_id,
        last_source_reviewed_at,
        created_by,
        updated_by,
        metadata
      ) values (
        v_row->>'source_identity_key',
        v_row->>'profile_slug',
        v_row->>'first_name',
        v_row->>'last_name',
        v_row->>'display_name',
        v_row->>'normalized_name',
        v_row->>'gender',
        nullif(v_row->>'graduation_year', '')::integer,
        v_row->>'graduation_year_source',
        v_school_id,
        v_team_id,
        'active',
        p_publish,
        case when p_publish then now() else null end,
        'editorial_source_linked',
        p_source_id,
        now(),
        p_actor,
        p_actor,
        jsonb_build_object(
          'seed_dataset', 'podium-watch-2026-xc-ranking-athlete-seed',
          'seed_school_name', v_row->>'school_name',
          'seed_grade_label', v_row->>'grade_label'
        )
      )
      on conflict (source_identity_key) do update set
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        display_name = excluded.display_name,
        normalized_name = excluded.normalized_name,
        gender = excluded.gender,
        graduation_year = excluded.graduation_year,
        graduation_year_source = excluded.graduation_year_source,
        current_school_id = coalesce(excluded.current_school_id, athlete_profiles.current_school_id),
        current_team_id = coalesce(excluded.current_team_id, athlete_profiles.current_team_id),
        public_visible = athlete_profiles.public_visible or excluded.public_visible,
        published_at = case
          when athlete_profiles.public_visible or excluded.public_visible
            then coalesce(athlete_profiles.published_at, excluded.published_at, now())
          else athlete_profiles.published_at
        end,
        verification_status = case
          when athlete_profiles.verification_status in ('source_verified', 'admin_verified')
            then athlete_profiles.verification_status
          else 'editorial_source_linked'
        end,
        source_id = coalesce(athlete_profiles.source_id, excluded.source_id),
        last_source_reviewed_at = now(),
        updated_by = excluded.updated_by,
        metadata = athlete_profiles.metadata || excluded.metadata
      returning id into v_profile_id;

      if exists (
        select 1 from public.athlete_profiles
        where id = v_profile_id and created_at = updated_at
      ) then
        v_inserted := v_inserted + 1;
      else
        v_updated := v_updated + 1;
      end if;
    end if;

    insert into public.athlete_profile_aliases (
      profile_id,
      alias,
      normalized_alias,
      source_id,
      notes
    ) values (
      v_profile_id,
      v_row->>'display_name',
      v_row->>'normalized_name',
      p_source_id,
      'Name imported from the supplied Podium Watch ranking files.'
    )
    on conflict (profile_id, normalized_alias) do update set
      alias = excluded.alias,
      source_id = excluded.source_id;

    if v_school_id is not null then
      update public.athlete_school_history
      set
        team_id = coalesce(v_team_id, team_id),
        school_name_snapshot = v_row->>'school_name',
        grade_label = v_row->>'grade_label',
        current = true,
        source_id = p_source_id,
        notes = 'School connection came from a Podium Watch editorial ranking source.',
        metadata = metadata || jsonb_build_object('official_school_match', true)
      where profile_id = v_profile_id
        and coalesce(school_id, '00000000-0000-0000-0000-000000000000'::uuid) =
            coalesce(v_school_id, '00000000-0000-0000-0000-000000000000'::uuid)
        and coalesce(season_start_year, 0) =
            coalesce(nullif(v_row->>'season_year', '')::integer, 0)
        and coalesce(season_end_year, 0) =
            coalesce(nullif(v_row->>'season_year', '')::integer, 0);

      if not found then
        insert into public.athlete_school_history (
          profile_id,
          school_id,
          team_id,
          school_name_snapshot,
          season_start_year,
          season_end_year,
          grade_label,
          current,
          verified,
          source_id,
          notes,
          metadata
        ) values (
          v_profile_id,
          v_school_id,
          v_team_id,
          v_row->>'school_name',
          nullif(v_row->>'season_year', '')::integer,
          nullif(v_row->>'season_year', '')::integer,
          v_row->>'grade_label',
          true,
          false,
          p_source_id,
          'School connection came from a Podium Watch editorial ranking source.',
          jsonb_build_object('official_school_match', true)
        );
      end if;

      v_school_links := v_school_links + 1;
    end if;

    insert into public.athlete_ranking_entries (
      profile_id,
      ranking_entry_key,
      ranking_title,
      ranking_slug,
      ranking_href,
      ranking_type,
      sport,
      gender,
      division,
      division_number,
      season_year,
      event_name,
      rank,
      previous_rank,
      mark_snapshot,
      explanation,
      source_label,
      source_file,
      updated_date,
      current,
      source_id,
      metadata
    ) values (
      v_profile_id,
      v_ranking->>'ranking_entry_key',
      v_ranking->>'title',
      v_ranking->>'ranking_slug',
      v_ranking->>'ranking_href',
      coalesce(v_ranking->>'ranking_type', 'Podium Watch editorial ranking'),
      v_row->>'sport',
      v_row->>'gender',
      v_row->>'division',
      nullif(v_row->>'division_number', '')::integer,
      nullif(v_row->>'season_year', '')::integer,
      v_row->>'event',
      nullif(v_ranking->>'rank', '')::integer,
      nullif(v_ranking->>'previous_rank', '')::integer,
      v_ranking->>'mark_snapshot',
      v_ranking->>'explanation',
      v_ranking->>'source_label',
      v_ranking->>'source_file',
      nullif(v_ranking->>'updated_date', '')::date,
      true,
      p_source_id,
      jsonb_build_object(
        'editorial_only', true,
        'mark_is_verified_performance', false
      )
    )
    on conflict (ranking_entry_key) do update set
      profile_id = excluded.profile_id,
      ranking_title = excluded.ranking_title,
      ranking_slug = excluded.ranking_slug,
      ranking_href = excluded.ranking_href,
      ranking_type = excluded.ranking_type,
      sport = excluded.sport,
      gender = excluded.gender,
      division = excluded.division,
      division_number = excluded.division_number,
      season_year = excluded.season_year,
      event_name = excluded.event_name,
      rank = excluded.rank,
      previous_rank = excluded.previous_rank,
      mark_snapshot = excluded.mark_snapshot,
      explanation = excluded.explanation,
      source_label = excluded.source_label,
      source_file = excluded.source_file,
      updated_date = excluded.updated_date,
      current = true,
      source_id = excluded.source_id,
      metadata = athlete_ranking_entries.metadata || excluded.metadata;

    v_rankings := v_rankings + 1;

    if p_link_rosters and jsonb_typeof(v_row->'roster_athlete_ids') = 'array' then
      for v_roster_id in
        select jsonb_array_elements_text(v_row->'roster_athlete_ids')
      loop
        update public.team_athletes
        set athlete_profile_id = v_profile_id
        where id = v_roster_id::uuid
          and (
            athlete_profile_id is null or
            athlete_profile_id = v_profile_id
          );

        if found then
          v_roster_links := v_roster_links + 1;
        end if;
      end loop;
    end if;
  end loop;

  return jsonb_build_object(
    'inserted_profiles', v_inserted,
    'updated_profiles', v_updated,
    'ranking_entries', v_rankings,
    'school_links', v_school_links,
    'roster_links', v_roster_links
  );
end;
$$;

create or replace function public.athlete_merge_profiles_v1(
  p_source_profile_id uuid,
  p_target_profile_id uuid,
  p_actor text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.athlete_profiles%rowtype;
  v_target public.athlete_profiles%rowtype;
  v_team_links integer := 0;
  v_performances integer := 0;
  v_rankings integer := 0;
  v_stories integer := 0;
  v_history integer := 0;
begin
  if p_source_profile_id = p_target_profile_id then
    raise exception 'ATHLETE_MERGE_TARGET_MUST_DIFFER';
  end if;

  select * into v_source
  from public.athlete_profiles
  where id = p_source_profile_id
  for update;

  select * into v_target
  from public.athlete_profiles
  where id = p_target_profile_id
  for update;

  if v_source.id is null or v_target.id is null then
    raise exception 'ATHLETE_MERGE_PROFILE_NOT_FOUND';
  end if;

  if v_source.merged_into_profile_id is not null then
    raise exception 'ATHLETE_MERGE_SOURCE_ALREADY_MERGED';
  end if;

  update public.team_athletes
  set athlete_profile_id = p_target_profile_id
  where athlete_profile_id = p_source_profile_id;
  get diagnostics v_team_links = row_count;

  delete from public.athlete_school_history source_row
  using public.athlete_school_history target_row
  where source_row.profile_id = p_source_profile_id
    and target_row.profile_id = p_target_profile_id
    and coalesce(source_row.school_id, '00000000-0000-0000-0000-000000000000'::uuid) =
        coalesce(target_row.school_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and coalesce(source_row.season_start_year, 0) = coalesce(target_row.season_start_year, 0)
    and coalesce(source_row.season_end_year, 0) = coalesce(target_row.season_end_year, 0);

  update public.athlete_school_history
  set profile_id = p_target_profile_id
  where profile_id = p_source_profile_id;
  get diagnostics v_history = row_count;

  delete from public.athlete_performances source_row
  using public.athlete_performances target_row
  where source_row.profile_id = p_source_profile_id
    and target_row.profile_id = p_target_profile_id
    and source_row.source_key is not null
    and source_row.source_key = target_row.source_key;

  update public.athlete_performances
  set profile_id = p_target_profile_id
  where profile_id = p_source_profile_id;
  get diagnostics v_performances = row_count;

  delete from public.athlete_ranking_entries source_row
  using public.athlete_ranking_entries target_row
  where source_row.profile_id = p_source_profile_id
    and target_row.profile_id = p_target_profile_id
    and source_row.ranking_entry_key = target_row.ranking_entry_key;

  update public.athlete_ranking_entries
  set profile_id = p_target_profile_id
  where profile_id = p_source_profile_id;
  get diagnostics v_rankings = row_count;

  delete from public.athlete_story_links source_row
  using public.athlete_story_links target_row
  where source_row.profile_id = p_source_profile_id
    and target_row.profile_id = p_target_profile_id
    and source_row.story_slug = target_row.story_slug
    and source_row.relationship = target_row.relationship;

  update public.athlete_story_links
  set profile_id = p_target_profile_id
  where profile_id = p_source_profile_id;
  get diagnostics v_stories = row_count;

  update public.athlete_profile_corrections
  set profile_id = p_target_profile_id
  where profile_id = p_source_profile_id;

  insert into public.athlete_profile_aliases (
    profile_id,
    alias,
    normalized_alias,
    notes
  ) values (
    p_target_profile_id,
    v_source.display_name,
    v_source.normalized_name,
    'Alias preserved from a merged athlete profile.'
  )
  on conflict (profile_id, normalized_alias) do nothing;

  update public.athlete_profiles
  set
    preferred_name = coalesce(preferred_name, v_source.preferred_name),
    bio = coalesce(bio, v_source.bio),
    photo_url = coalesce(photo_url, v_source.photo_url),
    hometown = coalesce(hometown, v_source.hometown),
    college_commitment = coalesce(college_commitment, v_source.college_commitment),
    college_commitment_verified = college_commitment_verified or v_source.college_commitment_verified,
    current_school_id = coalesce(current_school_id, v_source.current_school_id),
    current_team_id = coalesce(current_team_id, v_source.current_team_id),
    public_visible = public_visible or v_source.public_visible,
    verified = verified or v_source.verified,
    recruiting_enabled = recruiting_enabled or v_source.recruiting_enabled,
    primary_events = array(
      select distinct value
      from unnest(primary_events || v_source.primary_events) as value
      where value is not null and btrim(value) <> ''
    ),
    updated_by = p_actor,
    metadata = metadata || jsonb_build_object(
      'merged_profile_id', p_source_profile_id,
      'merged_at', now()
    )
  where id = p_target_profile_id;

  update public.athlete_profiles
  set
    merged_into_profile_id = p_target_profile_id,
    public_visible = false,
    archived_at = coalesce(archived_at, now()),
    updated_by = p_actor,
    metadata = metadata || jsonb_build_object(
      'merge_reason', p_reason,
      'merged_at', now()
    )
  where id = p_source_profile_id;

  insert into public.athlete_profile_merges (
    source_profile_id,
    target_profile_id,
    merged_by,
    reason,
    summary
  ) values (
    p_source_profile_id,
    p_target_profile_id,
    p_actor,
    p_reason,
    jsonb_build_object(
      'team_links', v_team_links,
      'school_history', v_history,
      'performances', v_performances,
      'rankings', v_rankings,
      'stories', v_stories
    )
  );

  return jsonb_build_object(
    'source_profile_id', p_source_profile_id,
    'target_profile_id', p_target_profile_id,
    'team_links', v_team_links,
    'school_history', v_history,
    'performances', v_performances,
    'rankings', v_rankings,
    'stories', v_stories
  );
end;
$$;

drop trigger if exists athlete_data_sources_updated_at_trigger
  on public.athlete_data_sources;
create trigger athlete_data_sources_updated_at_trigger
before update on public.athlete_data_sources
for each row execute function public.set_athlete_foundation_updated_at();

drop trigger if exists athlete_profiles_updated_at_trigger
  on public.athlete_profiles;
create trigger athlete_profiles_updated_at_trigger
before update on public.athlete_profiles
for each row execute function public.set_athlete_foundation_updated_at();

drop trigger if exists athlete_school_history_updated_at_trigger
  on public.athlete_school_history;
create trigger athlete_school_history_updated_at_trigger
before update on public.athlete_school_history
for each row execute function public.set_athlete_foundation_updated_at();

drop trigger if exists athlete_performances_updated_at_trigger
  on public.athlete_performances;
create trigger athlete_performances_updated_at_trigger
before update on public.athlete_performances
for each row execute function public.set_athlete_foundation_updated_at();

drop trigger if exists athlete_ranking_entries_updated_at_trigger
  on public.athlete_ranking_entries;
create trigger athlete_ranking_entries_updated_at_trigger
before update on public.athlete_ranking_entries
for each row execute function public.set_athlete_foundation_updated_at();

drop trigger if exists athlete_story_links_updated_at_trigger
  on public.athlete_story_links;
create trigger athlete_story_links_updated_at_trigger
before update on public.athlete_story_links
for each row execute function public.set_athlete_foundation_updated_at();

drop trigger if exists athlete_profile_corrections_updated_at_trigger
  on public.athlete_profile_corrections;
create trigger athlete_profile_corrections_updated_at_trigger
before update on public.athlete_profile_corrections
for each row execute function public.set_athlete_foundation_updated_at();

drop trigger if exists athlete_profiles_recruiting_consent_trigger
  on public.athlete_profiles;
create trigger athlete_profiles_recruiting_consent_trigger
before insert or update on public.athlete_profiles
for each row execute function public.require_athlete_recruiting_consent();

alter table public.athlete_data_sources enable row level security;
alter table public.athlete_profiles enable row level security;
alter table public.athlete_profile_aliases enable row level security;
alter table public.athlete_school_history enable row level security;
alter table public.athlete_performances enable row level security;
alter table public.athlete_ranking_entries enable row level security;
alter table public.athlete_story_links enable row level security;
alter table public.athlete_profile_corrections enable row level security;
alter table public.athlete_import_batches enable row level security;
alter table public.athlete_profile_merges enable row level security;

revoke all on table public.athlete_data_sources from anon, authenticated;
revoke all on table public.athlete_profiles from anon, authenticated;
revoke all on table public.athlete_profile_aliases from anon, authenticated;
revoke all on table public.athlete_school_history from anon, authenticated;
revoke all on table public.athlete_performances from anon, authenticated;
revoke all on table public.athlete_ranking_entries from anon, authenticated;
revoke all on table public.athlete_story_links from anon, authenticated;
revoke all on table public.athlete_profile_corrections from anon, authenticated;
revoke all on table public.athlete_import_batches from anon, authenticated;
revoke all on table public.athlete_profile_merges from anon, authenticated;

grant all on table public.athlete_data_sources to service_role;
grant all on table public.athlete_profiles to service_role;
grant all on table public.athlete_profile_aliases to service_role;
grant all on table public.athlete_school_history to service_role;
grant all on table public.athlete_performances to service_role;
grant all on table public.athlete_ranking_entries to service_role;
grant all on table public.athlete_story_links to service_role;
grant all on table public.athlete_profile_corrections to service_role;
grant all on table public.athlete_import_batches to service_role;
grant all on table public.athlete_profile_merges to service_role;

revoke all on function public.athlete_commit_seed_import_v1(jsonb, uuid, text, boolean, boolean)
  from public, anon, authenticated;
revoke all on function public.athlete_merge_profiles_v1(uuid, uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.athlete_commit_seed_import_v1(jsonb, uuid, text, boolean, boolean)
  to service_role;
grant execute on function public.athlete_merge_profiles_v1(uuid, uuid, text, text)
  to service_role;

insert into public.athlete_data_sources (
  source_key,
  source_name,
  source_organization,
  source_type,
  source_file,
  season_label,
  last_reviewed_at,
  notes,
  metadata
) values (
  'podium-watch-2026-xc-ranking-athlete-seed',
  'Podium Watch 2026 Cross Country Ranking Athlete Seed',
  'Podium Watch',
  'editorial',
  'content/rankings/2026_d1_boys_rankings.csv and seven related ranking files',
  '2026 Cross Country',
  '2026-08-03 12:00:00+00',
  'Profiles and ranking context from eight supplied Podium Watch ranking files. Ranking marks are not imported as verified personal bests.',
  jsonb_build_object(
    'record_count', 200,
    'editorial_only', true,
    'graduation_years_derived_from_grade', true
  )
)
on conflict (source_key) do update set
  source_name = excluded.source_name,
  source_organization = excluded.source_organization,
  source_type = excluded.source_type,
  source_file = excluded.source_file,
  season_label = excluded.season_label,
  last_reviewed_at = excluded.last_reviewed_at,
  notes = excluded.notes,
  metadata = athlete_data_sources.metadata || excluded.metadata;

commit;
