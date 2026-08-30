-- Automatic Finish Timing Results Pipeline
--
-- Purely additive: new settings/health columns on the existing
-- results_source_providers table (install/04), two new tables that extend
-- the existing Phase Two ingestion pipeline (install/05) rather than
-- duplicate it, one widened check constraint, and one new event-catalog row.
--
-- Nothing here creates a competing performance system -- Finish Timing
-- results still flow through the same result_ingestion_jobs /
-- result_source_documents / result_staging_rows / result_ingestion_audit
-- tables every other provider (Baumspage, MileSplit, etc.) already uses.

create extension if not exists pgcrypto;

-- 1. Provider settings/health columns. results_source_providers.active is
-- the one real, already-read on/off switch for this whole pipeline
-- (confirmed: result_provider_adapters.enabled/rate_limit_ms are seeded
-- but never read anywhere in application code -- left untouched, not
-- wired, to avoid maintaining two parallel unused toggles).
alter table public.results_source_providers
  add column if not exists auto_publish_enabled boolean not null default false,
  add column if not exists lookback_days integer not null default 3
    check (lookback_days between 0 and 365),
  add column if not exists currently_scanning_since timestamptz,
  add column if not exists last_scan_started_at timestamptz,
  add column if not exists last_scan_completed_at timestamptz,
  add column if not exists last_scan_status text
    check (last_scan_status is null or last_scan_status in ('ok', 'skipped_overlap', 'partial', 'failed')),
  add column if not exists last_scan_summary jsonb not null default '{}'::jsonb,
  add column if not exists pause_reason text,
  add column if not exists paused_at timestamptz,
  add column if not exists paused_by text;

-- The existing seed row (install/04) defaults active=true. Deliberately
-- pause Finish Timing here so running this migration can never itself
-- start unattended scanning -- an admin flips it on explicitly afterward,
-- and only after a private dry run (auto_publish_enabled stays false)
-- proves the acceptance counts are correct.
update public.results_source_providers
set
  active = false,
  pause_reason = 'Paused pending Finish Timing automation rollout.',
  paused_at = now(),
  paused_by = 'Podium Watch Admin'
where provider_key = 'finish_timing';

-- 2. Team scores, stored separately from athlete_performances per the
-- explicit requirement never to force team scores into the athlete
-- performance table. Provider-neutral shape/name so a second timing
-- company can write into the same table later.
create table if not exists public.result_team_scores (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null references public.results_source_providers(provider_key) on delete restrict,
  discovered_meet_id uuid references public.discovered_meets(id) on delete set null,
  provider_meet_id text not null,
  provider_event_id text not null,
  job_id uuid references public.result_ingestion_jobs(id) on delete set null,
  meet_name text not null,
  meet_date date,
  sport text not null check (sport in ('cross_country', 'indoor_track', 'outdoor_track')),
  season_year integer not null check (season_year between 2000 and 2200),
  competition_level text not null check (
    competition_level in ('middle_school', 'junior_varsity', 'high_school', 'open')
  ),
  gender text not null check (gender in ('boys', 'girls')),
  division text,
  event_name text not null,
  team_name text not null,
  normalized_team_name text not null,
  matched_school_id uuid references public.ohio_schools(id) on delete set null,
  matched_team_id uuid references public.team_pages(id) on delete set null,
  provider_team_id text,
  -- Finish Timing's own data has a real "did not place" team row (place
  -- shown as the literal string "DNP", score blank) -- a plain integer
  -- place column can't hold that without lying, so both a text and a
  -- numeric column exist and did_not_place is explicit rather than
  -- inferred from a null.
  place_text text,
  place_numeric integer,
  did_not_place boolean not null default false,
  score numeric,
  num_runners integer,
  scoring_breakdown jsonb not null default '{}'::jsonb,
  source_url text,
  public_visible boolean not null default false,
  verification_status text not null default 'source_linked'
    check (verification_status in ('unverified', 'source_linked', 'verified', 'disputed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_key, provider_meet_id, provider_event_id, normalized_team_name)
);

create index if not exists result_team_scores_meet_idx
  on public.result_team_scores (discovered_meet_id);
create index if not exists result_team_scores_public_idx
  on public.result_team_scores (public_visible, sport, season_year, meet_date desc);

-- 3. The "remembered school match" cache. A school (or a confidently
-- determined non-match, e.g. a junior-high team) is looked up here first
-- on every later scan so results match automatically without re-running
-- fuzzy name matching every 15 minutes. Kept Finish-Timing-specific for
-- now; generalizing to other providers later only needs one more column
-- plus a widened unique key, deferred until a second provider exists.
create table if not exists public.finish_timing_team_links (
  id uuid primary key default gen_random_uuid(),
  provider_team_id text not null,
  provider_team_name text not null,
  normalized_team_name text not null,
  matched_school_id uuid references public.ohio_schools(id) on delete set null,
  matched_team_id uuid references public.team_pages(id) on delete set null,
  competition_level_hint text
    check (competition_level_hint is null or competition_level_hint in ('middle_school', 'junior_varsity', 'high_school', 'open')),
  confidence smallint not null default 100 check (confidence between 0 and 100),
  confirmed_by text not null default 'automatic_exact_match',
  first_matched_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  notes text,
  unique (provider_team_id)
);

create index if not exists finish_timing_team_links_school_idx
  on public.finish_timing_team_links (matched_school_id);

-- 4. A staging row whose identity a later correction superseded (a new
-- resultFingerprint each time a mark changes, by the existing engine's
-- own design) needs a status distinct from 'reversed' (which means a
-- whole imported BATCH was undone, not one superseded row).
alter table public.result_staging_rows
  drop constraint if exists result_staging_rows_review_status_check;
alter table public.result_staging_rows
  add constraint result_staging_rows_review_status_check
  check (review_status in ('pending', 'approved', 'rejected', 'imported', 'reversed', 'superseded'));

-- 5. Finish Timing's junior-high and high-school cross country races
-- (both levels) are run at "1 Mile"/"2 Mile" -- xc_2_mile already exists,
-- but there is no cross-country 1-mile event key anywhere in the catalog.
insert into public.athlete_event_catalog (
  event_key, display_name, short_name, sport_scope, event_group,
  measurement_type, sort_direction, standard_unit, sort_order
) values
  ('xc_1_mile', 'Cross Country 1 Mile', '1 Mile XC', 'cross_country', 'cross_country', 'time', 'asc', 'seconds', 5)
on conflict (event_key) do update set
  display_name = excluded.display_name,
  short_name = excluded.short_name,
  sport_scope = excluded.sport_scope,
  event_group = excluded.event_group,
  measurement_type = excluded.measurement_type,
  sort_direction = excluded.sort_direction,
  standard_unit = excluded.standard_unit,
  sort_order = excluded.sort_order;

-- Matches this pipeline's own established convention (install/04,
-- install/05): row level security enabled, no explicit policies, no
-- explicit grant/revoke -- service_role bypasses RLS by default in
-- Supabase, and nothing else is ever granted access to these tables.
alter table public.result_team_scores enable row level security;
alter table public.finish_timing_team_links enable row level security;

comment on table public.result_team_scores is 'Team scoring rows discovered from an automated results provider, kept separate from athlete_performances.';
comment on table public.finish_timing_team_links is 'Remembered Finish Timing team-id to ohio_schools/team_pages matches (and confirmed non-matches), so results match automatically on later scans.';
