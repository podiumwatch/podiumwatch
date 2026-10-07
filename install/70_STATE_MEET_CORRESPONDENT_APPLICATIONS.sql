-- Podium Watch State Meet Media Correspondent Applications
-- Purpose:
--   A separate, no-login public intake channel for the paid Podium Watch
--   State Meet Media Correspondent role covering the 2026 OHSAA State
--   Cross Country Championships (Fortress Obetz, Saturday, November 7,
--   2026). Matches the same "held for review, never public on its own"
--   pattern already used by every other public submission on this site
--   (intern_applications, recruiting_activity_tips, timing_submissions).
--   A submission here is never auto-accepted or auto-credentialed -- OHSAA
--   controls final media credential approval, and Podium Watch only
--   submits the person it selects through that process by hand.
--
-- Safety:
--   Purely additive, its own table. RLS locks the table to service_role
--   only, matching every other public intake table on this site -- the
--   anon/public key can never read, write, or update applications
--   directly. Applicant contact info (email, phone) is private; nothing
--   here is ever rendered into public page source.

begin;

create extension if not exists pgcrypto;

create table if not exists public.state_meet_correspondent_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,

  college text not null,
  major text not null,
  college_year text not null check (
    college_year in ('Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate Student', 'Other')
  ),

  is_18_or_older boolean not null,
  available_nov_7 boolean not null,
  available_full_day boolean not null,

  interest_reason text not null,
  experience text,

  comfortable_interviewing boolean not null,
  comfortable_video boolean not null,
  xc_track_familiarity text not null check (
    xc_track_familiarity in ('Very familiar', 'Somewhat familiar', 'A little familiar', 'Not familiar yet')
  ),

  portfolio_url text,
  linkedin_url text,
  social_handle text,
  video_url text,
  other_url text,
  additional_notes text,

  -- Required on the public form -- re-checked here, not just trusted from
  -- the client. Confirms the applicant understands a submission is not a
  -- selection and not an OHSAA credential.
  credential_acknowledgement boolean not null default false,

  -- Hashed, never the raw address -- matches every other public submission
  -- table's exact rate-limiting convention on this site.
  submitter_ip_hash text,

  status text not null default 'new' check (
    status in ('new', 'reviewing', 'contacted', 'interview', 'selected', 'declined')
  ),
  reviewed_at timestamptz,
  reviewed_by text,
  review_note text,

  constraint state_meet_correspondent_applications_credential_ack_check
    check (credential_acknowledgement = true)
);

create index if not exists state_meet_correspondent_applications_status_index
  on public.state_meet_correspondent_applications (status, created_at desc);

create index if not exists state_meet_correspondent_applications_ip_hash_index
  on public.state_meet_correspondent_applications (submitter_ip_hash, created_at desc)
  where submitter_ip_hash is not null;

-- Reuses the same generic updated_at trigger function the recruiting
-- foundation tables already created (install/03) -- it only sets
-- new.updated_at = now(), nothing table-specific.
drop trigger if exists state_meet_correspondent_applications_updated_at_trigger
  on public.state_meet_correspondent_applications;
create trigger state_meet_correspondent_applications_updated_at_trigger
before update on public.state_meet_correspondent_applications
for each row execute function public.set_recruiting_foundation_updated_at();

alter table public.state_meet_correspondent_applications enable row level security;
revoke all on table public.state_meet_correspondent_applications from anon, authenticated;
grant all on table public.state_meet_correspondent_applications to service_role;

comment on table public.state_meet_correspondent_applications is
  'Applications for the paid Podium Watch State Meet Media Correspondent role at the 2026 OHSAA State Cross Country Championships (/apply/state-meet-correspondent/). Always starts new; an admin reviews and decides by hand in the Operations Center. Podium Watch submits the selected person through OHSAA''s own media credential process -- a submission here is never a credential or a selection.';

commit;
