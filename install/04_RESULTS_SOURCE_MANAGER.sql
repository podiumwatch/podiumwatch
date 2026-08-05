-- Podium Watch Phase One
-- Bulk Meet Discovery and Original Source Matching

create extension if not exists pgcrypto;

create table if not exists public.results_source_providers (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null unique,
  provider_name text not null,
  provider_type text not null check (provider_type in ('governing_body','timing_company','archive','secondary_directory')),
  homepage_url text not null,
  source_priority smallint not null default 50 check (source_priority between 1 and 100),
  import_policy text not null default 'review_required' check (import_policy in ('official','authorized','review_required','link_only','blocked')),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discovered_meets (
  id uuid primary key default gen_random_uuid(),
  meet_key text not null unique,
  meet_name text not null,
  normalized_name text not null,
  meet_date date,
  season_year integer not null check (season_year between 2000 and 2200),
  sport text not null check (sport in ('cross_country','indoor_track','outdoor_track')),
  host_name text,
  location_name text,
  city text,
  state text not null default 'OH',
  discovery_status text not null default 'found' check (discovery_status in ('found','ready','needs_review','approved','ignored')),
  duplicate_of uuid references public.discovered_meets(id) on delete set null,
  confidence smallint not null default 50 check (confidence between 0 and 100),
  review_note text,
  approved_at timestamptz,
  approved_by text,
  first_discovered_at timestamptz not null default now(),
  last_discovered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discovered_meet_sources (
  id uuid primary key default gen_random_uuid(),
  meet_id uuid not null references public.discovered_meets(id) on delete cascade,
  provider_id uuid references public.results_source_providers(id) on delete set null,
  source_url text not null,
  canonical_url text not null,
  source_role text not null default 'candidate' check (source_role in ('original','official','host_archive','secondary','candidate','link_only')),
  file_format text not null default 'html' check (file_format in ('html','pdf','csv','txt','live_results','unknown')),
  permission_status text not null default 'unknown' check (permission_status in ('official','authorized','review_required','link_only','unknown','blocked')),
  source_priority smallint not null default 50 check (source_priority between 1 and 100),
  is_preferred boolean not null default false,
  source_title text,
  last_http_status integer,
  last_checked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meet_id, canonical_url)
);

create table if not exists public.results_discovery_runs (
  id uuid primary key default gen_random_uuid(),
  sport text not null check (sport in ('cross_country','indoor_track','outdoor_track')),
  season_year integer not null check (season_year between 2000 and 2200),
  provider_key text,
  status text not null default 'running' check (status in ('running','completed','partial','failed')),
  cursor_value text,
  pages_checked integer not null default 0,
  links_checked integer not null default 0,
  meets_found integer not null default 0,
  meets_created integer not null default 0,
  sources_created integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_by text not null default 'Podium Watch Admin'
);

create index if not exists discovered_meets_season_sport_idx on public.discovered_meets (season_year, sport, meet_date);
create index if not exists discovered_meets_status_idx on public.discovered_meets (discovery_status);
create index if not exists discovered_meets_normalized_idx on public.discovered_meets (normalized_name, meet_date);
create index if not exists discovered_sources_meet_idx on public.discovered_meet_sources (meet_id, source_priority);
create index if not exists discovered_sources_provider_idx on public.discovered_meet_sources (provider_id);
create index if not exists discovery_runs_recent_idx on public.results_discovery_runs (started_at desc);

alter table public.results_source_providers enable row level security;
alter table public.discovered_meets enable row level security;
alter table public.discovered_meet_sources enable row level security;
alter table public.results_discovery_runs enable row level security;

insert into public.results_source_providers
  (provider_key, provider_name, provider_type, homepage_url, source_priority, import_policy, notes)
values
  ('ohsaa', 'OHSAA', 'governing_body', 'https://www.ohsaa.org/', 10, 'official', 'Official Ohio tournament information and result links.'),
  ('baumspage', 'Baumspage', 'archive', 'https://www.baumspage.com/', 20, 'review_required', 'Ohio meet archive and host supplied result files.'),
  ('timing_first', 'Timing First', 'timing_company', 'https://results.timingfirst.com/', 10, 'review_required', 'Original timer archive.'),
  ('finish_timing', 'FinishTiming', 'timing_company', 'https://finishtiming.trackscoreboard.com/', 10, 'review_required', 'Original timer results system.'),
  ('pierre_timing', 'Pierre Timing', 'timing_company', 'https://live.pierretiming.com/', 10, 'review_required', 'Original timer live results.'),
  ('seo_timing', 'SEO Timing', 'timing_company', 'https://live.seotiming.com/', 10, 'review_required', 'Original timer live results.'),
  ('milesplit_ohio', 'MileSplit Ohio', 'secondary_directory', 'https://oh.milesplit.com/', 60, 'review_required', 'Secondary discovery and verification source.'),
  ('athletic_net', 'Athletic.net', 'secondary_directory', 'https://www.athletic.net/', 90, 'link_only', 'Discovery and verification only unless written permission is received.')
on conflict (provider_key) do update set
  provider_name = excluded.provider_name,
  provider_type = excluded.provider_type,
  homepage_url = excluded.homepage_url,
  source_priority = excluded.source_priority,
  import_policy = excluded.import_policy,
  notes = excluded.notes,
  updated_at = now();

comment on table public.discovered_meets is 'Phase One meet catalog. No athlete performances are imported by this table.';
comment on table public.discovered_meet_sources is 'Candidate, original, official, and secondary source links for each discovered meet.';
comment on table public.results_discovery_runs is 'Auditable, resumable batches used by the Results Source Manager.';
