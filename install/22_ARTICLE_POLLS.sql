-- Podium Watch Article Reader Predictions
-- Purpose:
--   Real, shared-results voting for the three "Reader Predictions" polls
--   embedded in each 2026 preseason cross country article (see
--   public/data/podium-watch-2026-preseason-interactive-data.json for the
--   poll questions/options themselves -- they are static per-article data,
--   not stored in this table). This migration only stores the votes.
--
-- Why this is a new table rather than reusing fan_poll_* (install/09_FAN_POLL.sql):
--   Fan Poll is a full 16-team ranked ballot, identified by a hashed EMAIL,
--   with one ballot per email per week. Reader Predictions is the opposite
--   shape on every axis: a single-option pick across up to three small,
--   fixed-choice questions per article, identified by an ANONYMOUS hashed
--   browser token (explicitly no email/name collection, per the article
--   spec), with one vote per article/poll/token. Forcing this into the Fan
--   Poll schema would mean either collecting an email it has no reason to
--   need or bending fan_poll_ballots' one-ballot-per-week model to mean
--   something it doesn't. A new, much smaller table is the honest fit.
--
-- Identity model:
--   voter_token_hash is HMAC-SHA256 (VOTE_HASH_SECRET, same secret Fan Poll
--   and AOTW/TOTW already use for their own voter hashes) of a random token
--   the browser generates itself (crypto.randomUUID(), kept in
--   localStorage). The raw token never reaches this table -- only its hash,
--   and only a hash, never anything that identifies a real person.
--
-- Validation:
--   article_slug/poll_id/option_id are only ever written by
--   lib/article_poll_service.mjs after it has confirmed all three are real,
--   supplied values from the bundled JSON (see lib/preseason_data.mjs) --
--   this table itself does not (and cannot, since the valid set lives in a
--   JSON file, not another table) constrain them by foreign key. That
--   server-side check is what stands in for it.
--
-- Safety:
--   Additive only. Creates one new table and nothing else.

begin;

create extension if not exists pgcrypto;

create table if not exists public.article_poll_votes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  article_slug text not null,
  poll_id text not null,
  option_id text not null,
  voter_token_hash text not null,
  voter_ip_hash text,
  -- The real one-vote-per-article-per-poll-per-browser enforcement --
  -- a race-prone check-then-insert is never relied on; this constraint is
  -- the actual guarantee, matching fan_poll_ballots' own
  -- unique(week_id, voter_email_hash) approach.
  unique (article_slug, poll_id, voter_token_hash)
);

create index if not exists article_poll_votes_tally_index
  on public.article_poll_votes (article_slug, poll_id, option_id);

create index if not exists article_poll_votes_voter_index
  on public.article_poll_votes (article_slug, voter_token_hash);

alter table public.article_poll_votes enable row level security;

revoke all on table public.article_poll_votes from anon, authenticated;
grant all on table public.article_poll_votes to service_role;

commit;
