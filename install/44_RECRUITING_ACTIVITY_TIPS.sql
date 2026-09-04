-- Podium Watch Recruiting Activity Tips
-- Purpose:
--   Let athletes, coaches, and fans report recruiting activity (interest,
--   offers, visits, commitments, signings) without an account -- matching
--   the same "no login, held for review, nothing goes public
--   automatically" pattern already used by public results submissions
--   (result_ingestion_jobs, see lib/result_ingestion_engine.mjs's
--   createPublicResultsSubmission) and official performance imports
--   (lib/recruiting_service.mjs's commitPerformanceImport).
--
-- Safety:
--   This migration is purely additive. A submitted tip never becomes a
--   real athlete_recruiting_activity row, never changes
--   athlete_profiles.college_commitment, and is never public on its own --
--   an admin must explicitly promote it (matching an existing or newly
--   confirmed athlete profile) before any of that happens. Nothing here
--   deletes or replaces any existing table.

begin;

create extension if not exists pgcrypto;

create table if not exists public.recruiting_activity_tips (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- What the submitter typed -- free text, since there is no login and no
  -- guarantee the athlete already has a Podium Watch profile. Matching to
  -- a real profile happens by hand during admin review, the same "never
  -- match on name alone, never auto-publish" rule the rest of the
  -- recruiting system already follows.
  submitted_athlete_name text not null,
  submitted_school_name text not null,
  submitted_graduation_year integer check (
    submitted_graduation_year is null or submitted_graduation_year between 2000 and 2200
  ),
  submitted_gender text check (
    submitted_gender is null or submitted_gender in ('boys', 'girls', 'unspecified')
  ),
  activity_type text not null check (
    activity_type in ('interest', 'offer', 'visit', 'commitment', 'signing', 'other')
  ),
  college_name text not null,
  college_division text,
  activity_date date,
  notes text,
  source_url text,
  submitter_name text,
  submitter_email text,
  submitter_role text check (
    submitter_role is null or submitter_role in ('athlete', 'coach', 'family', 'fan', 'other')
  ),
  -- Hashed, never the raw address -- matches the exact same rate-limiting
  -- convention already used by createPublicResultsSubmission.
  submitter_ip_hash text,
  status text not null default 'pending' check (
    status in ('pending', 'promoted', 'rejected', 'spam')
  ),
  resolved_profile_id uuid references public.athlete_profiles(id) on delete set null,
  promoted_activity_id uuid references public.athlete_recruiting_activity(id) on delete set null,
  reviewed_at timestamptz,
  reviewed_by text,
  review_note text
);

create index if not exists recruiting_activity_tips_status_index
  on public.recruiting_activity_tips (status, created_at desc);

create index if not exists recruiting_activity_tips_ip_hash_index
  on public.recruiting_activity_tips (submitter_ip_hash, created_at desc)
  where submitter_ip_hash is not null;

-- Reuses the same trigger function install/03 already created for every
-- other recruiting-foundation table's updated_at column.
drop trigger if exists recruiting_activity_tips_updated_at_trigger
  on public.recruiting_activity_tips;
create trigger recruiting_activity_tips_updated_at_trigger
before update on public.recruiting_activity_tips
for each row execute function public.set_recruiting_foundation_updated_at();

alter table public.recruiting_activity_tips enable row level security;
revoke all on table public.recruiting_activity_tips from anon, authenticated;
grant all on table public.recruiting_activity_tips to service_role;

commit;
