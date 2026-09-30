-- Podium Watch Photo Submissions
-- Purpose:
--   A no-login public intake channel for parents, coaches, and photographers
--   to hand off bulk meet photos for articles and Instagram posts, either by
--   direct upload or by sharing an existing album link. See the storage-cost
--   plan discussed 2026-09-30 for the full reasoning.
--
-- Storage discipline (the entire point of this design):
--   Every submitted photo is represented by up to three Storage objects,
--   never more:
--     preview_storage_key           -- ~60 KB, 480px browsing thumbnail.
--                                       Generated client-side for every
--                                       photo. Kept forever (it's tiny).
--     pending_original_storage_key  -- a client-resized "as-submitted" copy
--                                       (upload path only; a link submission
--                                       never has one). Purged automatically
--                                       90 days after submission unless the
--                                       item is selected first.
--     kept_storage_key              -- ~600 KB, 2400px compressed copy.
--                                       Only ever created the moment an
--                                       admin selects a photo for real use,
--                                       regardless of which path it came
--                                       from. This is the only image bytes
--                                       retained indefinitely for the large
--                                       majority of photos that are never
--                                       selected.
--   All three are ordinary JPEGs produced by the browser's own Canvas
--   encoder (client-side, both the submitter's browser and, for the
--   select-from-a-link and select-a-pending-original actions, the admin's
--   browser) -- nothing here trusts an arbitrary uploaded file's bytes
--   directly, so no server-side image library or magic-byte sniffing is
--   needed, matching this project's existing zero image-processing
--   dependencies.
--
-- Safety:
--   Purely additive. The bucket is public (matching the existing
--   team-media/award-media/photographer-media precedent -- these are
--   ordinary photos meant to be browsed, not sensitive documents like
--   timing-submissions). Every submission defaults to pending/unselected;
--   nothing here publishes a photo anywhere on its own -- an admin always
--   makes the "select for use" call by hand.

begin;

create extension if not exists pgcrypto;

-- 12 MB: generous for a client-resized "as-submitted" copy (the true raw
-- original never leaves the submitter's device -- see the design note
-- above), while still a real ceiling against abuse.
insert into storage.buckets (id, name, public, file_size_limit)
values ('photo-submissions', 'photo-submissions', true, 12582912)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit;

create table if not exists public.photo_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_type text not null check (source_type in ('upload', 'link')),
  submitter_name text not null,
  submitter_email text not null,
  submitter_role text not null default 'other' check (
    submitter_role in ('parent', 'coach', 'photographer', 'other')
  ),
  -- Exactly how the contributor wants to be credited -- required on every
  -- submission, never optional, per the project's own preserve-credit rule.
  credit_name text not null,
  permission_confirmed boolean not null default false,
  permission_note text,
  meet_name text not null,
  meet_date date,
  -- Free-text contributor-typed tags, never matched against ohio_schools --
  -- this is context for an admin's own browsing/search, not a verified
  -- identity, matching this project's "never guess identity" convention
  -- for anything that isn't run through real matching logic.
  school_name text,
  album_url text,
  submitter_ip_hash text,
  status text not null default 'pending' check (
    status in ('pending', 'reviewed')
  ),
  reviewed_at timestamptz,
  reviewed_by text
);

create index if not exists photo_submissions_status_index
  on public.photo_submissions (status, created_at desc);

create index if not exists photo_submissions_meet_index
  on public.photo_submissions (meet_name, meet_date);

create index if not exists photo_submissions_ip_hash_index
  on public.photo_submissions (submitter_ip_hash, created_at desc)
  where submitter_ip_hash is not null;

create table if not exists public.photo_submission_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  submission_id uuid not null references public.photo_submissions(id) on delete cascade,
  item_status text not null default 'pending' check (
    item_status in ('pending', 'selected', 'archived')
  ),
  preview_storage_key text,
  pending_original_storage_key text,
  kept_storage_key text,
  original_filename text,
  athlete_tag text,
  school_tag text,
  -- Computed at insert time so the purge cron can filter on a plain
  -- indexed column instead of recomputing created_at + 90 days on every
  -- run.
  purge_after date not null default (current_date + 90),
  selected_at timestamptz,
  selected_by text
);

create index if not exists photo_submission_items_submission_index
  on public.photo_submission_items (submission_id);

create index if not exists photo_submission_items_status_index
  on public.photo_submission_items (item_status, created_at desc);

-- The purge cron's exact query shape: unselected upload-path items whose
-- window has passed.
create index if not exists photo_submission_items_purge_index
  on public.photo_submission_items (purge_after)
  where item_status = 'pending' and pending_original_storage_key is not null;

-- Reuses the same generic updated_at trigger function the recruiting
-- foundation tables already created (install/03).
drop trigger if exists photo_submissions_updated_at_trigger
  on public.photo_submissions;
create trigger photo_submissions_updated_at_trigger
before update on public.photo_submissions
for each row execute function public.set_recruiting_foundation_updated_at();

alter table public.photo_submissions enable row level security;
revoke all on table public.photo_submissions from anon, authenticated;
grant all on table public.photo_submissions to service_role;

alter table public.photo_submission_items enable row level security;
revoke all on table public.photo_submission_items from anon, authenticated;
grant all on table public.photo_submission_items to service_role;

-- Matches timing_submission_upload_slots' exact purpose: a lightweight
-- audit trail of issued signed-upload slots, purely so an abandoned or
-- retried upload can still be counted against the rate limit even if it
-- never becomes a real submission.
create table if not exists public.photo_submission_upload_slots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  storage_key text not null,
  submitter_ip_hash text
);

create index if not exists photo_submission_upload_slots_ip_hash_index
  on public.photo_submission_upload_slots (submitter_ip_hash, created_at desc)
  where submitter_ip_hash is not null;

alter table public.photo_submission_upload_slots enable row level security;
revoke all on table public.photo_submission_upload_slots from anon, authenticated;
grant all on table public.photo_submission_upload_slots to service_role;

commit;
