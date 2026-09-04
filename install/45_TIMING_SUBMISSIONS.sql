-- Podium Watch Timing Company Submissions
-- Purpose:
--   A separate, no-login public intake channel for timing companies to hand
--   off finished race results directly -- distinct from the existing
--   Results Ingestion Engine (install/04-05, web crawling) and the existing
--   /submit-results/ text/paste path (lib/result_ingestion_engine.mjs's
--   createPublicResultsSubmission). This one is specifically a FILE upload
--   handoff: a raw file lands here, hidden, for an admin to manually review
--   and run through the existing import tooling themselves -- nothing here
--   parses, matches, or imports anything on its own.
--
-- Safety:
--   Purely additive. The bucket is private (public: false, matching the
--   existing result-source-documents precedent, install/05) -- a submitted
--   file is never reachable by a bare URL, only via an admin-generated
--   signed URL. The table defaults every row to unreviewed/pending and
--   never marks anything as verified or official on its own -- that
--   judgment call always stays with a human admin.

begin;

create extension if not exists pgcrypto;

-- 25 MB: a step up from result-source-documents' 12 MB (that bucket holds
-- single crawled pages; a timing company's own complete meet export --
-- especially a multi-division state-meet-sized file -- can reasonably run
-- larger). Not unbounded: still a real ceiling against abuse.
insert into storage.buckets (id, name, public, file_size_limit)
values ('timing-submissions', 'timing-submissions', false, 26214400)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit;

create table if not exists public.timing_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- What the timing company typed -- free text, exactly like every other
  -- no-login public submission on this site (createPublicResultsSubmission,
  -- recruiting_activity_tips). Never matched, validated, or trusted
  -- automatically; an admin reads this and decides what to do by hand.
  meet_name text not null,
  meet_date date,
  division_level text,
  timing_company_name text not null,
  submitter_email text not null,
  -- File metadata. storage_key points into the private timing-submissions
  -- bucket above; nothing about this table makes a file public on its own.
  storage_key text not null,
  original_filename text not null,
  content_type text,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  -- Hashed, never the raw address -- matches createPublicResultsSubmission's
  -- exact rate-limiting convention.
  submitter_ip_hash text,
  status text not null default 'pending' check (
    status in ('pending', 'reviewed', 'rejected')
  ),
  reviewed_at timestamptz,
  reviewed_by text,
  review_note text
);

create index if not exists timing_submissions_status_index
  on public.timing_submissions (status, created_at desc);

create index if not exists timing_submissions_ip_hash_index
  on public.timing_submissions (submitter_ip_hash, created_at desc)
  where submitter_ip_hash is not null;

-- Reuses the same generic updated_at trigger function the recruiting
-- foundation tables already created (install/03) -- it only sets
-- new.updated_at = now(), nothing table-specific.
drop trigger if exists timing_submissions_updated_at_trigger
  on public.timing_submissions;
create trigger timing_submissions_updated_at_trigger
before update on public.timing_submissions
for each row execute function public.set_recruiting_foundation_updated_at();

alter table public.timing_submissions enable row level security;
revoke all on table public.timing_submissions from anon, authenticated;
grant all on table public.timing_submissions to service_role;

-- Vercel Functions cap request bodies at 4.5 MB (confirmed against
-- Vercel's own docs, 2026-09) -- far below this feature's real 25 MB file
-- cap, so the file's bytes never pass through a serverless function at
-- all. The browser uploads directly to Supabase Storage using a
-- short-lived signed upload URL (lib/timing_submissions_service.mjs's
-- requestTimingSubmissionUploadSlot); this table exists purely so that
-- issuing those URLs can itself be rate limited (an abandoned or retried
-- upload should count against abuse limits even if it never becomes a
-- real timing_submissions row). Not a submission record -- see that table
-- above for the actual reviewed data.
create table if not exists public.timing_submission_upload_slots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  storage_key text not null,
  submitter_ip_hash text
);

create index if not exists timing_submission_upload_slots_ip_hash_index
  on public.timing_submission_upload_slots (submitter_ip_hash, created_at desc)
  where submitter_ip_hash is not null;

alter table public.timing_submission_upload_slots enable row level security;
revoke all on table public.timing_submission_upload_slots from anon, authenticated;
grant all on table public.timing_submission_upload_slots to service_role;

commit;
