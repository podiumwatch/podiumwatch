-- Team of the Week: combine the boys/girls categories into one
-- Purpose:
--   Team of the Week used to run as two separate competitions each week
--   (a boys winner and a girls winner). Too few nominations came in each
--   week to fill two categories well, so the app now treats Team of the
--   Week as one combined competition with a single winner -- the same
--   shape Athlete of the Week has always used.
--
--   totw_nominations.category and totw_finalists.category are real,
--   NOT NULL columns on this pre-migration-system schema (confirmed live,
--   no default) with an existing check constraint that only allows
--   'boys'/'girls' (confirmed live via a real 23514 violation on 'overall'
--   before this migration existed). Every new nomination and finalist row
--   the app writes from now on uses the fixed value 'overall' instead of
--   asking anyone to choose a category -- this migration widens both
--   check constraints to allow it, without touching any existing row.
--
--   totw_votes.category has no separate check constraint (confirmed live:
--   the earlier 23514 errors were only on totw_finalists and
--   totw_nominations), and cast_totw_vote() derives its votes row's
--   category from the finalist it's voting for, so no change is needed
--   there -- once every finalist carries 'overall', votes for them will
--   too, which is also what keeps the (voter_hash, category)-scoped
--   cooldown in that existing RPC correctly shared across the whole
--   combined list.
--
-- Safety:
--   Purely additive to the constraint's allowed values -- 'boys' and
--   'girls' remain valid (existing rows are untouched, and nothing
--   prevents a future admin from using them again). No table, column, or
--   row is created, dropped, or renamed.

begin;

alter table public.totw_nominations drop constraint if exists totw_nominations_category_check;
alter table public.totw_nominations add constraint totw_nominations_category_check
  check (category in ('boys', 'girls', 'overall'));

alter table public.totw_finalists drop constraint if exists totw_finalists_category_check;
alter table public.totw_finalists add constraint totw_finalists_category_check
  check (category in ('boys', 'girls', 'overall'));

commit;
