-- Podium Watch: team Instagram submissions go to admin review
-- Purpose:
--   Audit 2026-11-09: the public "Team Instagram" form had never saved a
--   single submission. Its "is this a real account?" check fetched
--   instagram.com from Vercel, and Instagram serves a login wall there, so
--   every real account (for example @archboldxctf) was rejected as "could
--   not be found". That check is removed. Because a submission can no
--   longer be confirmed automatically, it no longer goes live on its own:
--   it waits here until an admin approves it on /admin/team-instagram/.
--   Approving sets team_pages.instagram_handle and writes the same
--   team_change_log entry as before, so history and revert keep working.
--
-- Identity:
--   actor_hash is an HMAC of the submitter's network address (same as the
--   old flow). No names or emails are collected.
--
-- Safety:
--   Additive only. One new table, service role only. Nothing else changes.

begin;

create extension if not exists pgcrypto;

create table if not exists public.team_instagram_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  team_id uuid not null references public.team_pages(id) on delete cascade,
  handle text not null check (char_length(handle) between 1 and 30),
  previous_handle text,
  actor_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  reviewed_by text,
  review_note text check (review_note is null or char_length(review_note) <= 300)
);

create index if not exists team_instagram_requests_status_index
  on public.team_instagram_requests (status, created_at);

create index if not exists team_instagram_requests_rate_index
  on public.team_instagram_requests (team_id, actor_hash, created_at desc);

alter table public.team_instagram_requests enable row level security;
revoke all on table public.team_instagram_requests from anon, authenticated;
grant all on table public.team_instagram_requests to service_role;

commit;
