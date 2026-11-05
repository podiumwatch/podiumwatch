-- Podium Watch State Meet Picks (2026)
-- Purpose:
--   Stores reader picks for the eight 2026 OHSAA state cross country team
--   champions (Boys and Girls Divisions I-IV), each with the name the reader
--   typed. Picks lock when the first race starts (Nov. 7, 2026, 10:00 AM ET);
--   after that every entry is shown on /state-picks/. See
--   lib/state_picks_service.mjs.
--
-- Identity model:
--   Same as article_poll_votes (install/22_ARTICLE_POLLS.sql): an anonymous
--   browser token, stored only as an HMAC-SHA256 hash (VOTE_HASH_SECRET).
--   One entry per browser; submitting again before the lock updates it.
--   No email is collected. display_name is whatever the reader typed and is
--   shown publicly after the lock.
--
-- Moderation:
--   Set hidden = true on a row to keep it off the public list.
--
-- Validation:
--   picks is a JSON object of race key -> team name. The server only writes
--   it after checking every race key and team name against
--   public/data/state-picks-2026.json.
--
-- Safety:
--   Additive only. Creates one new table and nothing else.

begin;

create extension if not exists pgcrypto;

create table if not exists public.state_picks_2026 (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  display_name text not null check (char_length(display_name) between 2 and 40),
  picks jsonb not null,
  voter_token_hash text not null unique,
  voter_ip_hash text,
  hidden boolean not null default false
);

create index if not exists state_picks_2026_ip_index
  on public.state_picks_2026 (voter_ip_hash);

alter table public.state_picks_2026 enable row level security;

revoke all on table public.state_picks_2026 from anon, authenticated;
grant all on table public.state_picks_2026 to service_role;

commit;
