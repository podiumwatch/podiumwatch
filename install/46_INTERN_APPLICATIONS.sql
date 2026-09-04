-- Podium Watch Intern Writer Applications
-- Purpose:
--   A separate, no-login public intake channel for high school students to
--   apply to write for Podium Watch -- matches the same "held for review,
--   never public on its own" pattern already used by every other public
--   submission on this site (createPublicResultsSubmission,
--   recruiting_activity_tips, timing_submissions). An application is never
--   auto-accepted or auto-published; an admin reviews it by hand in the
--   Operations Center.
--
-- Safety:
--   Purely additive. Applicants are minors, so the schema requires a
--   parent/guardian name, email, and an explicit consent flag before a
--   submission is even accepted -- enforced again in
--   lib/intern_applications_service.mjs, not just the public form. RLS
--   locks the table to service_role only, matching every other public
--   intake table on this site -- the anon/public key can never read or
--   write applications directly.

begin;

create extension if not exists pgcrypto;

create table if not exists public.intern_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  full_name text not null,
  email text not null,
  phone text,
  school text not null,
  grade text not null,

  -- Applicants are minors -- required, not optional, and checked again in
  -- the service layer regardless of what the public form enforces.
  parent_name text not null,
  parent_email text not null,
  parent_consent boolean not null default false,

  coverage_interests text[] not null default '{}',
  availability text,
  why_interested text not null,
  writing_sample text not null,
  portfolio_link text,

  -- Hashed, never the raw address -- matches every other public submission
  -- table's exact rate-limiting convention on this site.
  submitter_ip_hash text,

  status text not null default 'pending' check (
    status in ('pending', 'reviewed', 'accepted', 'rejected')
  ),
  reviewed_at timestamptz,
  reviewed_by text,
  review_note text
);

create index if not exists intern_applications_status_index
  on public.intern_applications (status, created_at desc);

create index if not exists intern_applications_ip_hash_index
  on public.intern_applications (submitter_ip_hash, created_at desc)
  where submitter_ip_hash is not null;

-- Reuses the same generic updated_at trigger function the recruiting
-- foundation tables already created (install/03) -- it only sets
-- new.updated_at = now(), nothing table-specific.
drop trigger if exists intern_applications_updated_at_trigger
  on public.intern_applications;
create trigger intern_applications_updated_at_trigger
before update on public.intern_applications
for each row execute function public.set_recruiting_foundation_updated_at();

alter table public.intern_applications enable row level security;
revoke all on table public.intern_applications from anon, authenticated;
grant all on table public.intern_applications to service_role;

comment on table public.intern_applications is
  'Applications submitted through the Podium Watch high school intern writer program (/apply/). Always starts pending; an admin reviews and decides by hand in the Operations Center.';

commit;
