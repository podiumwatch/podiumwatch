-- Podium Watch Ohio Statewide School and Division Foundation
-- Purpose:
--   1. Store official Ohio school identity records separately from public team pages.
--   2. Store season specific sport and gender division assignments with source history.
--   3. Store tournament site and representation records.
--   4. Link existing Podium Watch team pages to official school records without deleting data.
--
-- Safety:
--   This migration is additive. It does not delete team pages, results, rankings, or content.
--   Run this file before using the Statewide Data admin importer.

begin;

create extension if not exists pgcrypto;

create table if not exists public.ohio_data_sources (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_key text not null unique,
  source_name text not null,
  source_organization text,
  source_type text not null default 'official' check (
    source_type in ('official', 'supplied_reference', 'editorial', 'community')
  ),
  document_title text,
  source_url text,
  source_file text,
  season_label text,
  published_date date,
  last_verified_at timestamptz,
  subject_to_change boolean not null default false,
  notes text
);

create table if not exists public.ohio_schools (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ohsaa_school_id integer not null unique,
  school_name text not null,
  normalized_name text not null,
  city text not null,
  normalized_city text not null,
  athletic_district text check (
    athletic_district is null or athletic_district in (
      'Central',
      'East',
      'Northeast',
      'Northwest',
      'Southeast',
      'Southwest'
    )
  ),
  county text,
  conference text,
  mascot text,
  school_website_url text,
  athletics_website_url text,
  program_level text not null default 'high_school' check (
    program_level in ('high_school', 'middle_school', 'club')
  ),
  status text not null default 'active' check (
    status in ('active', 'closed', 'merged', 'inactive')
  ),
  source_id uuid references public.ohio_data_sources(id) on delete set null,
  last_verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.ohio_school_aliases (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  school_id uuid not null references public.ohio_schools(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  source_id uuid references public.ohio_data_sources(id) on delete set null,
  notes text,
  unique (school_id, normalized_alias)
);

create table if not exists public.ohio_school_divisions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  school_id uuid not null references public.ohio_schools(id) on delete cascade,
  sport text not null check (
    sport in ('cross_country', 'track_and_field')
  ),
  gender text not null check (
    gender in ('boys', 'girls')
  ),
  season_start_year integer not null check (
    season_start_year between 2000 and 2200
  ),
  season_end_year integer not null check (
    season_end_year between 2000 and 2201
  ),
  season_label text not null,
  division text not null,
  previous_division text,
  base_enrollment integer,
  official boolean not null default true,
  current boolean not null default true,
  source_id uuid references public.ohio_data_sources(id) on delete set null,
  last_verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (
    school_id,
    sport,
    gender,
    season_start_year,
    season_end_year
  )
);

create table if not exists public.ohio_tournament_sites (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sport text not null check (
    sport in ('cross_country', 'track_and_field')
  ),
  season_year integer not null check (
    season_year between 2000 and 2200
  ),
  division integer not null,
  region integer not null,
  site_city text,
  site_name text not null,
  address text,
  prelim_date date,
  prelim_time text,
  semifinal_date date,
  semifinal_field_time text,
  semifinal_running_time text,
  final_date date,
  final_field_time text,
  final_running_time text,
  meet_manager text,
  meet_manager_email text,
  athletic_director text,
  athletic_director_email text,
  site_manager text,
  site_manager_email text,
  boys_representation text,
  girls_representation text,
  source_note text,
  subject_to_change boolean not null default false,
  current boolean not null default true,
  source_id uuid references public.ohio_data_sources(id) on delete set null,
  last_verified_at timestamptz,
  unique (sport, season_year, division, region)
);

create table if not exists public.ohio_import_batches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  import_key text not null,
  status text not null default 'started' check (
    status in ('started', 'completed', 'failed')
  ),
  source_id uuid references public.ohio_data_sources(id) on delete set null,
  requested_by text,
  options jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  error_message text
);

create table if not exists public.ohio_data_conflicts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  conflict_key text not null unique,
  team_id uuid references public.team_pages(id) on delete cascade,
  school_id uuid references public.ohio_schools(id) on delete cascade,
  assignment_id uuid references public.ohio_school_divisions(id) on delete cascade,
  field_name text not null,
  current_value text,
  official_value text,
  source_id uuid references public.ohio_data_sources(id) on delete set null,
  status text not null default 'open' check (
    status in ('open', 'accepted_official', 'kept_existing', 'resolved')
  ),
  resolution_note text,
  resolved_by text
);

alter table public.team_pages
  add column if not exists ohio_school_id uuid references public.ohio_schools(id) on delete set null;

create unique index if not exists team_pages_ohio_school_unique
  on public.team_pages (ohio_school_id)
  where ohio_school_id is not null
    and archived_at is null
    and merged_into_team_id is null;

create index if not exists ohio_schools_name_index
  on public.ohio_schools (normalized_name, normalized_city);

create index if not exists ohio_schools_district_index
  on public.ohio_schools (athletic_district, school_name);

create index if not exists ohio_school_aliases_lookup_index
  on public.ohio_school_aliases (normalized_alias);

create index if not exists ohio_school_divisions_lookup_index
  on public.ohio_school_divisions (
    sport,
    gender,
    season_start_year,
    division,
    current
  );

create index if not exists ohio_tournament_sites_lookup_index
  on public.ohio_tournament_sites (
    sport,
    season_year,
    division,
    region
  );

create index if not exists ohio_import_batches_recent_index
  on public.ohio_import_batches (created_at desc);

create index if not exists ohio_data_conflicts_status_index
  on public.ohio_data_conflicts (status, created_at desc);

create or replace function public.set_ohio_foundation_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ohio_data_sources_updated_at_trigger
  on public.ohio_data_sources;

create trigger ohio_data_sources_updated_at_trigger
before update on public.ohio_data_sources
for each row
execute function public.set_ohio_foundation_updated_at();

drop trigger if exists ohio_schools_updated_at_trigger
  on public.ohio_schools;

create trigger ohio_schools_updated_at_trigger
before update on public.ohio_schools
for each row
execute function public.set_ohio_foundation_updated_at();

drop trigger if exists ohio_school_divisions_updated_at_trigger
  on public.ohio_school_divisions;

create trigger ohio_school_divisions_updated_at_trigger
before update on public.ohio_school_divisions
for each row
execute function public.set_ohio_foundation_updated_at();

drop trigger if exists ohio_tournament_sites_updated_at_trigger
  on public.ohio_tournament_sites;

create trigger ohio_tournament_sites_updated_at_trigger
before update on public.ohio_tournament_sites
for each row
execute function public.set_ohio_foundation_updated_at();

drop trigger if exists ohio_data_conflicts_updated_at_trigger
  on public.ohio_data_conflicts;

create trigger ohio_data_conflicts_updated_at_trigger
before update on public.ohio_data_conflicts
for each row
execute function public.set_ohio_foundation_updated_at();

alter table public.ohio_data_sources enable row level security;
alter table public.ohio_schools enable row level security;
alter table public.ohio_school_aliases enable row level security;
alter table public.ohio_school_divisions enable row level security;
alter table public.ohio_tournament_sites enable row level security;
alter table public.ohio_import_batches enable row level security;
alter table public.ohio_data_conflicts enable row level security;

revoke all on table public.ohio_data_sources from anon, authenticated;
revoke all on table public.ohio_schools from anon, authenticated;
revoke all on table public.ohio_school_aliases from anon, authenticated;
revoke all on table public.ohio_school_divisions from anon, authenticated;
revoke all on table public.ohio_tournament_sites from anon, authenticated;
revoke all on table public.ohio_import_batches from anon, authenticated;
revoke all on table public.ohio_data_conflicts from anon, authenticated;

grant all on table public.ohio_data_sources to service_role;
grant all on table public.ohio_schools to service_role;
grant all on table public.ohio_school_aliases to service_role;
grant all on table public.ohio_school_divisions to service_role;
grant all on table public.ohio_tournament_sites to service_role;
grant all on table public.ohio_import_batches to service_role;
grant all on table public.ohio_data_conflicts to service_role;

insert into public.ohio_data_sources (
  source_key,
  source_name,
  source_organization,
  source_type,
  document_title,
  source_url,
  source_file,
  season_label,
  published_date,
  last_verified_at,
  subject_to_change,
  notes
) values
(
  'ohsaa-boys-xc-divisions-2026-27',
  'OHSAA Boys Cross Country Division Assignments',
  'Ohio High School Athletic Association',
  'official',
  '2026-27 and 2027-28 Boys Cross Country Divisions',
  'https://www.ohsaa.org/sports/cc/tournament-info',
  '2026-27-boys-cross-country-divisions.pdf',
  '2026-27 and 2027-28',
  null,
  '2026-08-03 12:00:00+00',
  false,
  'Official boys cross country school assignments from the supplied OHSAA document.'
),
(
  'ohsaa-track-regional-sites-2026',
  'OHSAA Track Regional Sites and Representation',
  'Ohio High School Athletic Association',
  'official',
  '2026 Regional Sites, Dates, Managers and Representation',
  'https://www.ohsaa.org/sports/track/tournament-info',
  '2026-track-regional-sites-and-representation.pdf',
  '2026',
  '2026-04-03',
  '2026-08-03 12:00:00+00',
  true,
  'Updated April 3, 2026 and marked subject to change by OHSAA.'
)
on conflict (source_key) do update set
  source_name = excluded.source_name,
  source_organization = excluded.source_organization,
  source_type = excluded.source_type,
  document_title = excluded.document_title,
  source_url = excluded.source_url,
  source_file = excluded.source_file,
  season_label = excluded.season_label,
  published_date = excluded.published_date,
  last_verified_at = excluded.last_verified_at,
  subject_to_change = excluded.subject_to_change,
  notes = excluded.notes;

commit;
