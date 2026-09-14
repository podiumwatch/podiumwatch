begin;

-- Discovered live while verifying install/59 (2026-09-14): a real,
-- hand-built constraint named aotw_one_winner_per_week enforces at the
-- database level that only ONE aotw_finalists row per week_id can have
-- winner = true -- a hard block on this whole feature (a boys' AND a
-- girls' Athlete of the Week is exactly two winners in one week).
-- Application code (announceWinner(), lib/awards_service.mjs) already
-- enforces "at most one winner per category" -- this migration relaxes
-- the database-level rule to match: one winner per (week, category)
-- instead of one per week, dropped and recreated under whichever DDL
-- form it actually is (a bare unique index vs. a table constraint --
-- Postgres backs a unique constraint with an index of the same name, so
-- only one of these two drops will ever find something real; the other
-- is a harmless no-op).
alter table public.aotw_finalists drop constraint if exists aotw_one_winner_per_week;
drop index if exists public.aotw_one_winner_per_week;

create unique index aotw_one_winner_per_week_category
  on public.aotw_finalists (week_id, category)
  where winner = true;

commit;
