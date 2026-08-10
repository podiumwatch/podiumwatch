-- Podium Watch Path to State
-- Purpose:
--   A four-stage (three for Division 1) OHSAA cross country tournament
--   advancement roadmap shown on team and athlete pages: Regular Season ->
--   District -> Regional -> State, with the real qualifying threshold at
--   each stage and a status per team per stage.
--
-- Source:
--   2026 OHSAA Cross Country Tournament Regulations (adopted June 11,
--   2026) and its qualifying-count tables. All numbers in this migration's
--   seed data are transcribed directly from that document, not invented or
--   estimated.
--
-- Scope decisions (see docs/DECISIONS.md for the full reasoning):
--   1. Advancement status is MANUALLY set by a Podium Watch admin for this
--      launch, not auto-computed from results ingestion, which is still
--      early and largely unverified. team_advancement_status below is
--      shaped so a future athlete_advancement_status table (same columns,
--      keyed by athlete_profile_id instead of team_id) can be added later
--      without changing anything here.
--   2. District/regional exact site address and tournament-manager contact
--      info is deliberately OUT of scope and not stored here. Real
--      research found only 3 of the 6 OHSAA athletic districts have
--      confirmed, current-season site data published at build time; the
--      rest are stale or locked behind documents that can't be reliably
--      read. public.ohio_tournament_sites already exists in this project's
--      schema for exactly this kind of data (see
--      install/01_STATEWIDE_FOUNDATION_DATABASE.sql) but currently holds
--      zero cross_country rows and uses a different (integer) regional
--      numbering scheme than the named regionals
--      (Central/Northeast/Northwest/Southwest) cross country actually
--      uses -- a future site-info pass needs a naming reconciliation, not
--      a new table, and should not duplicate this migration's tables.
--   3. Cross country only. Track and field can follow later with new rows
--      only, never a schema change -- see the `sport` column on every
--      table here, matching the same sport-aware shape already used by
--      ohio_school_divisions and fan_poll_weeks.
--
-- Design notes:
--   - Division 1 skips the district round entirely (OHSAA reg 3.1).
--     ohio_tournament_stage_calendar.stage_applies records this as DATA
--     (a stage_applies = false row), not a hardcoded branch in
--     application code -- lib/path_to_state_service.mjs's
--     stageSequenceFor() still hardcodes the 3-vs-4-node shape (that part
--     of the regulation is structural, not seasonal), but every date and
--     every qualifying number is data, re-seedable every year without a
--     code change.
--   - qualifying_teams/qualifying_individuals are constrained > 0, never
--     >= 0. A combination that does not exist in real life (there is no
--     Division I Northwest regional -- confirmed by its absence from the
--     official regional-to-state table) must be UNREPRESENTABLE as a
--     real-looking zero. Absence of a row is how "not applicable" is
--     encoded; the application layer must never fall back to displaying 0.
--   - ohio_tournament_regional_assignments bridges the two key spaces the
--     official tables use: district thresholds are keyed by athletic
--     district, regional thresholds are keyed by named regional, and nothing
--     else connects them. Where the mapping isn't confirmed (Division 1
--     teams in the East, Southeast, or Northwest athletic districts -- the
--     source document does not state which regional they feed into, and
--     guessing is not acceptable for a real qualifying number), the row is
--     seeded with assignment_status = 'unknown' rather than a guessed
--     regional_name.
--
-- Safety:
--   This migration is additive. It does not alter or drop any existing
--   table (team_pages, ohio_schools, ohio_school_divisions,
--   ohio_tournament_sites, or anything else). It only creates four new
--   tables, their indexes, one new trigger function, and seeds them with
--   real, sourced 2026 data.

begin;

create extension if not exists pgcrypto;

create table if not exists public.ohio_tournament_stage_calendar (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sport text not null check (sport in ('cross_country', 'track_and_field')),
  season_year integer not null check (season_year between 2000 and 2200),
  division_number integer not null check (division_number between 1 and 5),
  stage text not null check (stage in ('regular_season', 'district', 'regional', 'state')),
  -- The data-encoded form of "Division 1 has no district round."
  stage_applies boolean not null default true,
  stage_date date,
  stage_end_date date,
  entry_deadline date,
  display_label text,
  -- The only location field in this migration -- populated only for the
  -- state row in this pass. See the scope note above.
  site_label text,
  source_document text,
  source_adopted_date date,
  official boolean not null default true,
  source_id uuid references public.ohio_data_sources(id) on delete set null,
  last_verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (sport, season_year, division_number, stage)
);

create table if not exists public.ohio_tournament_qualification_thresholds (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sport text not null check (sport in ('cross_country', 'track_and_field')),
  season_year integer not null check (season_year between 2000 and 2200),
  division_number integer not null check (division_number between 1 and 5),
  gender text not null check (gender in ('boys', 'girls')),
  -- The TRANSITION this row describes (advancing FROM the district round
  -- INTO the regional round), not the stage a team is currently standing on.
  stage text not null check (stage in ('district_to_regional', 'regional_to_state')),
  scope_type text not null check (scope_type in ('athletic_district', 'regional')),
  scope_name text not null,
  check (
    scope_type <> 'athletic_district'
    or scope_name in ('Central', 'East', 'Northeast', 'Northwest', 'Southeast', 'Southwest')
  ),
  -- Never >= 0. A combination that does not exist in real life must be
  -- unrepresentable as a real-looking zero -- see the design note above.
  qualifying_teams integer check (qualifying_teams is null or qualifying_teams > 0),
  qualifying_individuals integer check (qualifying_individuals is null or qualifying_individuals > 0),
  -- 2026 regs section 11a: 2 non-team individual qualifiers per qualifying
  -- team that advances. Stored for documentation only -- the displayed
  -- number is always qualifying_individuals as officially published,
  -- never recomputed from this ratio.
  individual_ratio_per_team numeric(4, 2) not null default 2,
  -- 2026 regs section 11.2 note: team designation is based on the number
  -- of athletes who FINISH and score (minimum 5), not the number entered.
  min_scoring_finishers integer not null default 5 check (min_scoring_finishers > 0),
  notes text,
  source_document text,
  source_adopted_date date,
  official boolean not null default true,
  source_id uuid references public.ohio_data_sources(id) on delete set null,
  last_verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (sport, season_year, division_number, gender, stage, scope_type, scope_name)
);

create table if not exists public.ohio_tournament_regional_assignments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sport text not null check (sport in ('cross_country', 'track_and_field')),
  season_year integer not null check (season_year between 2000 and 2200),
  division_number integer not null check (division_number between 1 and 5),
  athletic_district text not null check (
    athletic_district in ('Central', 'East', 'Northeast', 'Northwest', 'Southeast', 'Southwest')
  ),
  regional_name text,
  assignment_status text not null default 'published' check (
    assignment_status in ('published', 'not_applicable', 'unknown')
  ),
  check (assignment_status <> 'published' or regional_name is not null),
  notes text,
  source_document text,
  official boolean not null default true,
  source_id uuid references public.ohio_data_sources(id) on delete set null,
  last_verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (sport, season_year, division_number, athletic_district)
);

create table if not exists public.team_advancement_status (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  team_id uuid not null references public.team_pages(id) on delete cascade,
  sport text not null default 'cross_country' check (sport in ('cross_country', 'track_and_field')),
  -- Boys and girls advance separately and can sit in different divisions,
  -- so status is never school-wide.
  gender text not null check (gender in ('boys', 'girls')),
  season_year integer not null check (season_year between 2000 and 2200),
  -- The stage a team is standing on -- deliberately the calendar's
  -- vocabulary (regular_season/district/regional/state), not the
  -- thresholds table's transition vocabulary.
  stage text not null check (stage in ('regular_season', 'district', 'regional', 'state')),
  status text not null default 'not_started' check (
    status in ('not_started', 'upcoming', 'qualified_team', 'qualified_individuals', 'eliminated')
  ),
  individual_qualifier_count integer check (
    individual_qualifier_count is null or individual_qualifier_count > 0
  ),
  note text,
  set_by text,
  set_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (team_id, sport, gender, season_year, stage)
);
-- Forward hook: a future public.athlete_advancement_status table, with
-- this exact same column shape but keyed by athlete_profile_id instead of
-- team_id, is designed to slot into lib/path_to_state_service.mjs's
-- buildPathToState() through its already-present athleteStatusRows
-- parameter (always an empty array in this launch) -- no rework of this
-- table or the builder required when that table is added.

create index if not exists ohio_tournament_stage_calendar_lookup_index
  on public.ohio_tournament_stage_calendar (sport, season_year, division_number, stage);

create index if not exists ohio_tournament_qualification_thresholds_lookup_index
  on public.ohio_tournament_qualification_thresholds
    (sport, season_year, division_number, gender, stage, scope_type, scope_name);

create index if not exists ohio_tournament_regional_assignments_lookup_index
  on public.ohio_tournament_regional_assignments
    (sport, season_year, division_number, athletic_district);

create index if not exists team_advancement_status_team_index
  on public.team_advancement_status (team_id, sport, gender, season_year);

create index if not exists team_advancement_status_season_index
  on public.team_advancement_status (sport, season_year, status);

create or replace function public.set_path_to_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ohio_tournament_stage_calendar_updated_at_trigger
  on public.ohio_tournament_stage_calendar;
create trigger ohio_tournament_stage_calendar_updated_at_trigger
before update on public.ohio_tournament_stage_calendar
for each row execute function public.set_path_to_state_updated_at();

drop trigger if exists ohio_tournament_qualification_thresholds_updated_at_trigger
  on public.ohio_tournament_qualification_thresholds;
create trigger ohio_tournament_qualification_thresholds_updated_at_trigger
before update on public.ohio_tournament_qualification_thresholds
for each row execute function public.set_path_to_state_updated_at();

drop trigger if exists ohio_tournament_regional_assignments_updated_at_trigger
  on public.ohio_tournament_regional_assignments;
create trigger ohio_tournament_regional_assignments_updated_at_trigger
before update on public.ohio_tournament_regional_assignments
for each row execute function public.set_path_to_state_updated_at();

drop trigger if exists team_advancement_status_updated_at_trigger
  on public.team_advancement_status;
create trigger team_advancement_status_updated_at_trigger
before update on public.team_advancement_status
for each row execute function public.set_path_to_state_updated_at();

alter table public.ohio_tournament_stage_calendar enable row level security;
alter table public.ohio_tournament_qualification_thresholds enable row level security;
alter table public.ohio_tournament_regional_assignments enable row level security;
alter table public.team_advancement_status enable row level security;

revoke all on table public.ohio_tournament_stage_calendar from anon, authenticated;
revoke all on table public.ohio_tournament_qualification_thresholds from anon, authenticated;
revoke all on table public.ohio_tournament_regional_assignments from anon, authenticated;
revoke all on table public.team_advancement_status from anon, authenticated;

grant all on table public.ohio_tournament_stage_calendar to service_role;
grant all on table public.ohio_tournament_qualification_thresholds to service_role;
grant all on table public.ohio_tournament_regional_assignments to service_role;
grant all on table public.team_advancement_status to service_role;

-- ---------------------------------------------------------------------------
-- Real 2026 seed data, transcribed from the 2026 OHSAA Cross Country
-- Tournament Regulations (adopted June 11, 2026). Uses ON CONFLICT so this
-- migration is safely re-runnable.
-- ---------------------------------------------------------------------------

insert into public.ohio_tournament_stage_calendar
  (sport, season_year, division_number, stage, stage_applies, stage_date, entry_deadline, display_label, site_label, source_document, source_adopted_date)
values
  ('cross_country', 2026, 1, 'regular_season', true, null, null, 'Through late October', null, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 2, 'regular_season', true, null, null, 'Through late October', null, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 3, 'regular_season', true, null, null, 'Through late October', null, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 4, 'regular_season', true, null, null, 'Through late October', null, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),

  ('cross_country', 2026, 1, 'district', false, null, null, null, null, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 2, 'district', true, '2026-10-24', '2026-10-18', 'District tournament', null, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 3, 'district', true, '2026-10-24', '2026-10-18', 'District tournament', null, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 4, 'district', true, '2026-10-24', '2026-10-18', 'District tournament', null, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),

  ('cross_country', 2026, 1, 'regional', true, '2026-10-31', '2026-10-25', 'Regional tournament', null, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 2, 'regional', true, '2026-10-31', null, 'Regional tournament', null, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 3, 'regional', true, '2026-10-31', null, 'Regional tournament', null, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 4, 'regional', true, '2026-10-31', null, 'Regional tournament', null, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),

  ('cross_country', 2026, 1, 'state', true, '2026-11-07', null, 'State championship', 'Fortress Obetz, Obetz', '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 2, 'state', true, '2026-11-07', null, 'State championship', 'Fortress Obetz, Obetz', '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 3, 'state', true, '2026-11-07', null, 'State championship', 'Fortress Obetz, Obetz', '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 4, 'state', true, '2026-11-07', null, 'State championship', 'Fortress Obetz, Obetz', '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11')
on conflict (sport, season_year, division_number, stage) do update set
  stage_applies = excluded.stage_applies,
  stage_date = excluded.stage_date,
  entry_deadline = excluded.entry_deadline,
  display_label = excluded.display_label,
  site_label = excluded.site_label,
  source_document = excluded.source_document,
  source_adopted_date = excluded.source_adopted_date;

-- District -> Regional thresholds (Divisions 2, 3, 4 only -- Division 1
-- has no district round and contributes zero rows here).
insert into public.ohio_tournament_qualification_thresholds
  (sport, season_year, division_number, gender, stage, scope_type, scope_name, qualifying_teams, qualifying_individuals, source_document, source_adopted_date)
values
  -- Division 2
  ('cross_country', 2026, 2, 'boys',  'district_to_regional', 'athletic_district', 'Central',   11, 22, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 2, 'girls', 'district_to_regional', 'athletic_district', 'Central',   10, 20, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 2, 'boys',  'district_to_regional', 'athletic_district', 'East',       3,  6, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 2, 'girls', 'district_to_regional', 'athletic_district', 'East',       4,  8, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 2, 'boys',  'district_to_regional', 'athletic_district', 'Southeast',  6, 12, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 2, 'girls', 'district_to_regional', 'athletic_district', 'Southeast',  6, 12, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 2, 'boys',  'district_to_regional', 'athletic_district', 'Northeast', 38, 76, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 2, 'girls', 'district_to_regional', 'athletic_district', 'Northeast', 37, 74, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 2, 'boys',  'district_to_regional', 'athletic_district', 'Northwest', 18, 36, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 2, 'girls', 'district_to_regional', 'athletic_district', 'Northwest', 15, 30, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 2, 'boys',  'district_to_regional', 'athletic_district', 'Southwest', 20, 40, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 2, 'girls', 'district_to_regional', 'athletic_district', 'Southwest', 24, 48, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),

  -- Division 3
  ('cross_country', 2026, 3, 'boys',  'district_to_regional', 'athletic_district', 'Central',    9, 18, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 3, 'girls', 'district_to_regional', 'athletic_district', 'Central',    6, 12, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 3, 'boys',  'district_to_regional', 'athletic_district', 'East',      12, 24, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 3, 'girls', 'district_to_regional', 'athletic_district', 'East',      13, 26, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 3, 'boys',  'district_to_regional', 'athletic_district', 'Southeast', 11, 22, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 3, 'girls', 'district_to_regional', 'athletic_district', 'Southeast',  8, 16, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 3, 'boys',  'district_to_regional', 'athletic_district', 'Northeast', 26, 52, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 3, 'girls', 'district_to_regional', 'athletic_district', 'Northeast', 32, 64, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 3, 'boys',  'district_to_regional', 'athletic_district', 'Northwest', 17, 34, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 3, 'girls', 'district_to_regional', 'athletic_district', 'Northwest', 20, 40, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 3, 'boys',  'district_to_regional', 'athletic_district', 'Southwest', 21, 42, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 3, 'girls', 'district_to_regional', 'athletic_district', 'Southwest', 17, 34, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),

  -- Division 4
  ('cross_country', 2026, 4, 'boys',  'district_to_regional', 'athletic_district', 'Central',    8, 16, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 4, 'girls', 'district_to_regional', 'athletic_district', 'Central',    9, 18, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 4, 'boys',  'district_to_regional', 'athletic_district', 'East',       4,  8, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 4, 'girls', 'district_to_regional', 'athletic_district', 'East',       4,  8, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 4, 'boys',  'district_to_regional', 'athletic_district', 'Southeast', 11, 22, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 4, 'girls', 'district_to_regional', 'athletic_district', 'Southeast',  8, 16, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 4, 'boys',  'district_to_regional', 'athletic_district', 'Northeast', 21, 42, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 4, 'girls', 'district_to_regional', 'athletic_district', 'Northeast', 22, 44, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 4, 'boys',  'district_to_regional', 'athletic_district', 'Northwest', 33, 66, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 4, 'girls', 'district_to_regional', 'athletic_district', 'Northwest', 34, 68, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 4, 'boys',  'district_to_regional', 'athletic_district', 'Southwest', 19, 38, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 4, 'girls', 'district_to_regional', 'athletic_district', 'Southwest', 19, 38, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),

  -- Regional -> State (all 4 divisions; Division 1 Northwest is
  -- intentionally absent -- no Northwest Division 1 regional exists).
  ('cross_country', 2026, 1, 'boys',  'regional_to_state', 'regional', 'Central',    8, 16, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 1, 'girls', 'regional_to_state', 'regional', 'Central',    9, 18, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 1, 'boys',  'regional_to_state', 'regional', 'Northeast',  5, 10, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 1, 'girls', 'regional_to_state', 'regional', 'Northeast',  5, 10, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 1, 'boys',  'regional_to_state', 'regional', 'Southwest',  7, 14, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 1, 'girls', 'regional_to_state', 'regional', 'Southwest',  6, 12, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),

  ('cross_country', 2026, 2, 'boys',  'regional_to_state', 'regional', 'Central',    5, 10, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 2, 'girls', 'regional_to_state', 'regional', 'Central',    5, 10, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 2, 'boys',  'regional_to_state', 'regional', 'Northeast', 10, 20, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 2, 'girls', 'regional_to_state', 'regional', 'Northeast',  9, 18, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 2, 'boys',  'regional_to_state', 'regional', 'Northwest',  4,  8, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 2, 'girls', 'regional_to_state', 'regional', 'Northwest',  4,  8, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 2, 'boys',  'regional_to_state', 'regional', 'Southwest',  5, 10, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 2, 'girls', 'regional_to_state', 'regional', 'Southwest',  6, 12, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),

  ('cross_country', 2026, 3, 'boys',  'regional_to_state', 'regional', 'Central',    8, 16, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 3, 'girls', 'regional_to_state', 'regional', 'Central',    7, 14, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 3, 'boys',  'regional_to_state', 'regional', 'Northeast',  7, 14, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 3, 'girls', 'regional_to_state', 'regional', 'Northeast',  8, 16, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 3, 'boys',  'regional_to_state', 'regional', 'Northwest',  4,  8, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 3, 'girls', 'regional_to_state', 'regional', 'Northwest',  5, 10, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 3, 'boys',  'regional_to_state', 'regional', 'Southwest',  5, 10, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 3, 'girls', 'regional_to_state', 'regional', 'Southwest',  4,  8, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),

  ('cross_country', 2026, 4, 'boys',  'regional_to_state', 'regional', 'Central',    6, 12, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 4, 'girls', 'regional_to_state', 'regional', 'Central',    5, 10, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 4, 'boys',  'regional_to_state', 'regional', 'Northeast',  5, 10, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 4, 'girls', 'regional_to_state', 'regional', 'Northeast',  5, 10, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 4, 'boys',  'regional_to_state', 'regional', 'Northwest',  8, 16, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 4, 'girls', 'regional_to_state', 'regional', 'Northwest',  9, 18, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 4, 'boys',  'regional_to_state', 'regional', 'Southwest',  5, 10, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11'),
  ('cross_country', 2026, 4, 'girls', 'regional_to_state', 'regional', 'Southwest',  5, 10, '2026 OHSAA Cross Country Tournament Regulations', '2026-06-11')
on conflict (sport, season_year, division_number, gender, stage, scope_type, scope_name) do update set
  qualifying_teams = excluded.qualifying_teams,
  qualifying_individuals = excluded.qualifying_individuals,
  source_document = excluded.source_document,
  source_adopted_date = excluded.source_adopted_date;

-- Athletic district -> named regional. Divisions 2/3/4 come directly from
-- the district-to-regional table's own "regional" column, so all 18 rows
-- are confidently "published". Division 1 has no district round, so this
-- mapping is not directly stated anywhere in the source document -- only
-- the 3 athletic districts that share an identically-named regional
-- (Central, Northeast, Southwest) are recorded as "published"; East,
-- Southeast, and Northwest are recorded as "unknown" rather than guessed.
insert into public.ohio_tournament_regional_assignments
  (sport, season_year, division_number, athletic_district, regional_name, assignment_status, source_document)
values
  ('cross_country', 2026, 2, 'Central',   'Central',   'published', '2026 OHSAA Cross Country Tournament Regulations'),
  ('cross_country', 2026, 2, 'East',      'Central',   'published', '2026 OHSAA Cross Country Tournament Regulations'),
  ('cross_country', 2026, 2, 'Southeast', 'Central',   'published', '2026 OHSAA Cross Country Tournament Regulations'),
  ('cross_country', 2026, 2, 'Northeast', 'Northeast', 'published', '2026 OHSAA Cross Country Tournament Regulations'),
  ('cross_country', 2026, 2, 'Northwest', 'Northwest', 'published', '2026 OHSAA Cross Country Tournament Regulations'),
  ('cross_country', 2026, 2, 'Southwest', 'Southwest', 'published', '2026 OHSAA Cross Country Tournament Regulations'),

  ('cross_country', 2026, 3, 'Central',   'Central',   'published', '2026 OHSAA Cross Country Tournament Regulations'),
  ('cross_country', 2026, 3, 'East',      'Central',   'published', '2026 OHSAA Cross Country Tournament Regulations'),
  ('cross_country', 2026, 3, 'Southeast', 'Central',   'published', '2026 OHSAA Cross Country Tournament Regulations'),
  ('cross_country', 2026, 3, 'Northeast', 'Northeast', 'published', '2026 OHSAA Cross Country Tournament Regulations'),
  ('cross_country', 2026, 3, 'Northwest', 'Northwest', 'published', '2026 OHSAA Cross Country Tournament Regulations'),
  ('cross_country', 2026, 3, 'Southwest', 'Southwest', 'published', '2026 OHSAA Cross Country Tournament Regulations'),

  ('cross_country', 2026, 4, 'Central',   'Central',   'published', '2026 OHSAA Cross Country Tournament Regulations'),
  ('cross_country', 2026, 4, 'East',      'Central',   'published', '2026 OHSAA Cross Country Tournament Regulations'),
  ('cross_country', 2026, 4, 'Southeast', 'Central',   'published', '2026 OHSAA Cross Country Tournament Regulations'),
  ('cross_country', 2026, 4, 'Northeast', 'Northeast', 'published', '2026 OHSAA Cross Country Tournament Regulations'),
  ('cross_country', 2026, 4, 'Northwest', 'Northwest', 'published', '2026 OHSAA Cross Country Tournament Regulations'),
  ('cross_country', 2026, 4, 'Southwest', 'Southwest', 'published', '2026 OHSAA Cross Country Tournament Regulations'),

  ('cross_country', 2026, 1, 'Central',   'Central',   'published', '2026 OHSAA Cross Country Tournament Regulations'),
  ('cross_country', 2026, 1, 'Northeast', 'Northeast', 'published', '2026 OHSAA Cross Country Tournament Regulations'),
  ('cross_country', 2026, 1, 'Southwest', 'Southwest', 'published', '2026 OHSAA Cross Country Tournament Regulations'),
  ('cross_country', 2026, 1, 'East',      null,        'unknown',   '2026 OHSAA Cross Country Tournament Regulations'),
  ('cross_country', 2026, 1, 'Southeast', null,        'unknown',   '2026 OHSAA Cross Country Tournament Regulations'),
  ('cross_country', 2026, 1, 'Northwest', null,        'unknown',   '2026 OHSAA Cross Country Tournament Regulations')
on conflict (sport, season_year, division_number, athletic_district) do update set
  regional_name = excluded.regional_name,
  assignment_status = excluded.assignment_status,
  source_document = excluded.source_document;

commit;
