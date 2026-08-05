-- Podium Watch Phase Two and Phase Three
-- Durable results discovery, parsing, review, import, and reversal

create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public, file_size_limit)
values ('result-source-documents', 'result-source-documents', false, 12582912)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit;

create table if not exists public.result_ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null check (job_type in ('urls','catalog','provider','upload','paste')),
  provider_key text,
  sport text check (sport in ('cross_country','indoor_track','outdoor_track')),
  season_year integer check (season_year between 2000 and 2200),
  status text not null default 'queued' check (status in ('queued','running','paused','completed','partial','failed','cancelled','approved','imported','reversed')),
  seeds jsonb not null default '[]'::jsonb,
  options jsonb not null default '{}'::jsonb,
  checkpoint jsonb not null default '{}'::jsonb,
  progress jsonb not null default '{"queued":0,"visited":0,"documents":0,"rows":0,"errors":0}'::jsonb,
  error_summary jsonb not null default '{}'::jsonb,
  cancel_requested boolean not null default false,
  parser_version text not null default 'results-v1',
  created_by text not null default 'Podium Watch Admin',
  started_at timestamptz,
  completed_at timestamptz,
  approved_at timestamptz,
  imported_at timestamptz,
  reversed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.result_crawl_pages (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.result_ingestion_jobs(id) on delete cascade,
  url text not null,
  canonical_url text not null,
  depth smallint not null default 0 check (depth between 0 and 12),
  provider_key text,
  status text not null default 'queued' check (status in ('queued','fetching','fetched','skipped','blocked','failed')),
  http_status integer,
  content_type text,
  content_length bigint,
  etag text,
  last_modified text,
  content_sha256 text,
  title text,
  result_score smallint not null default 0 check (result_score between 0 and 100),
  result_evidence jsonb not null default '[]'::jsonb,
  reason_codes jsonb not null default '[]'::jsonb,
  fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, canonical_url)
);

create table if not exists public.result_crawl_edges (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.result_ingestion_jobs(id) on delete cascade,
  from_page_id uuid references public.result_crawl_pages(id) on delete cascade,
  to_page_id uuid references public.result_crawl_pages(id) on delete cascade,
  anchor_text text,
  surrounding_text text,
  link_score smallint not null default 0 check (link_score between 0 and 100),
  reason_codes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (job_id, from_page_id, to_page_id)
);

create table if not exists public.result_source_documents (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.result_ingestion_jobs(id) on delete cascade,
  page_id uuid references public.result_crawl_pages(id) on delete set null,
  provider_key text,
  source_url text,
  source_chain jsonb not null default '[]'::jsonb,
  document_type text not null check (document_type in ('html','pre','text','csv','pdf','spreadsheet','json','unknown')),
  storage_key text,
  content_sha256 text not null,
  parser_version text not null,
  verification_score smallint not null default 0 check (verification_score between 0 and 100),
  verification_evidence jsonb not null default '[]'::jsonb,
  warning_codes jsonb not null default '[]'::jsonb,
  raw_excerpt text,
  status text not null default 'verified' check (status in ('candidate','verified','parsed','needs_review','rejected','superseded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, content_sha256)
);

create table if not exists public.result_staging_rows (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.result_ingestion_jobs(id) on delete cascade,
  document_id uuid not null references public.result_source_documents(id) on delete cascade,
  row_number integer not null,
  meet_name text,
  meet_date date,
  meet_location text,
  sport text,
  season_year integer,
  competition_level text,
  gender text,
  division text,
  event_name text,
  event_code text,
  distance_meters integer,
  heat text,
  flight text,
  round text,
  athlete_name text,
  athlete_grade text,
  school_name text,
  relay_team text,
  relay_members jsonb not null default '[]'::jsonb,
  place integer,
  mark_text text,
  mark_value numeric,
  points numeric,
  wind_text text,
  result_status text,
  parser_confidence smallint not null default 0 check (parser_confidence between 0 and 100),
  match_confidence smallint not null default 0 check (match_confidence between 0 and 100),
  matched_meet_id uuid,
  matched_school_id uuid,
  matched_athlete_id uuid,
  warning_codes jsonb not null default '[]'::jsonb,
  raw_row jsonb not null default '{}'::jsonb,
  source_fingerprint text not null,
  result_fingerprint text not null,
  review_status text not null default 'pending' check (review_status in ('pending','approved','rejected','imported','reversed')),
  review_note text,
  reviewed_at timestamptz,
  imported_performance_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, result_fingerprint)
);

create table if not exists public.result_ingestion_audit (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.result_ingestion_jobs(id) on delete cascade,
  action text not null,
  target_type text,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  actor text not null default 'Podium Watch Admin',
  created_at timestamptz not null default now()
);

alter table public.result_ingestion_jobs
  add column if not exists import_batch_id uuid references public.athlete_performance_import_batches(id) on delete set null;

alter table public.result_crawl_pages
  add column if not exists parent_page_id uuid references public.result_crawl_pages(id) on delete set null,
  add column if not exists source_chain jsonb not null default '[]'::jsonb,
  add column if not exists page_context jsonb not null default '{}'::jsonb,
  add column if not exists error_detail jsonb not null default '{}'::jsonb;

insert into public.athlete_event_catalog (
  event_key, display_name, short_name, sport_scope, event_group,
  measurement_type, sort_direction, standard_unit, sort_order
) values
  ('track_1500', '1500 Meters', '1500', 'all_track', 'distance', 'time', 'asc', 'seconds', 185),
  ('track_3000', '3000 Meters', '3000', 'all_track', 'distance', 'time', 'asc', 'seconds', 205),
  ('relay', 'Relay', 'Relay', 'all_track', 'relays', 'time', 'asc', 'seconds', 700)
on conflict (event_key) do update set
  display_name = excluded.display_name,
  short_name = excluded.short_name,
  sport_scope = excluded.sport_scope,
  event_group = excluded.event_group,
  measurement_type = excluded.measurement_type,
  sort_direction = excluded.sort_direction,
  standard_unit = excluded.standard_unit,
  sort_order = excluded.sort_order;

create table if not exists public.result_provider_adapters (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null unique,
  display_name text not null,
  host_patterns text[] not null default '{}'::text[],
  access_mode text not null check (access_mode in ('direct','link_only','fallback_upload','blocked')),
  direct_discovery boolean not null default false,
  parser_status text not null default 'generic' check (parser_status in ('provider','generic','fallback','unsupported')),
  rate_limit_ms integer not null default 500 check (rate_limit_ms between 0 and 60000),
  enabled boolean not null default true,
  fallback_instructions text,
  evidence jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.result_provider_adapters (provider_key, display_name, host_patterns, access_mode, direct_discovery, parser_status, fallback_instructions)
values
  ('baumspage','Baumspage',array['baumspage.com'],'direct',true,'provider','Paste a meet, archive, or catalog URL. Upload the linked file if a remote document is blocked.'),
  ('milesplit_ohio','MileSplit Ohio',array['oh.milesplit.com','milesplit.com'],'direct',true,'generic','Paste a public meet or results URL. If result depth is account restricted, upload an authorized export or paste copied results.'),
  ('athletic_net','Athletic.net',array['athletic.net','live.athletic.net'],'link_only',true,'generic','Use public result links for discovery. Upload an authorized export or paste copied results for bulk import.'),
  ('finish_timing','FinishTiming',array['finishtiming.com','trackscoreboard.com'],'direct',true,'generic','Paste a public meet URL or upload the timer export.'),
  ('timing_first','Timing First',array['timingfirst.com','live.athletic.net'],'direct',true,'generic','Paste a public meet URL or upload the timer export.'),
  ('championship_timing','Championship Timing',array['championshiptiming.org'],'direct',true,'generic','Paste the public meet URL or upload the timer export.'),
  ('runsignup','RunSignup',array['runsignup.com'],'direct',true,'generic','Paste the public results URL or upload its CSV export.'),
  ('manual_upload','Uploaded or pasted results',array[]::text[],'fallback_upload',false,'generic','Upload PDF, HTML, TXT, CSV, XLS, or XLSX, or paste copied result text.')
on conflict (provider_key) do update set display_name=excluded.display_name, host_patterns=excluded.host_patterns, access_mode=excluded.access_mode, direct_discovery=excluded.direct_discovery, parser_status=excluded.parser_status, fallback_instructions=excluded.fallback_instructions, updated_at=now();

create unique index if not exists athlete_performance_import_batches_import_key_unique
on public.athlete_performance_import_batches(import_key);

create index if not exists result_jobs_status_idx on public.result_ingestion_jobs(status, created_at desc);
create index if not exists result_pages_queue_idx on public.result_crawl_pages(job_id, status, depth, result_score desc);
create index if not exists result_documents_job_idx on public.result_source_documents(job_id, status);
create index if not exists result_rows_review_idx on public.result_staging_rows(job_id, review_status, parser_confidence);
create index if not exists result_rows_source_fingerprint_idx on public.result_staging_rows(source_fingerprint);
create index if not exists result_rows_result_fingerprint_idx on public.result_staging_rows(result_fingerprint);
create index if not exists result_pages_parent_idx on public.result_crawl_pages(parent_page_id);
create index if not exists result_jobs_import_batch_idx on public.result_ingestion_jobs(import_batch_id) where import_batch_id is not null;

alter table public.result_ingestion_jobs enable row level security;
alter table public.result_crawl_pages enable row level security;
alter table public.result_crawl_edges enable row level security;
alter table public.result_source_documents enable row level security;
alter table public.result_staging_rows enable row level security;
alter table public.result_ingestion_audit enable row level security;
alter table public.result_provider_adapters enable row level security;

comment on table public.result_ingestion_jobs is 'Resumable administrative result discovery and import jobs.';
comment on table public.result_crawl_pages is 'Every queued and visited page, including failures and stopping reasons.';
comment on table public.result_crawl_edges is 'Auditable source chain between discovered pages.';
comment on table public.result_source_documents is 'Verified source documents with parser evidence and immutable fingerprints.';
comment on table public.result_staging_rows is 'Normalized result rows held for review before import.';
comment on table public.result_provider_adapters is 'Auditable access, parser, pacing, and fallback policy for each result provider.';
