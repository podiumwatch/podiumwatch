-- Team of the Week: allow the combined category on the votes table too
-- Purpose:
--   install/37 widened totw_nominations.category/totw_finalists.category
--   and install/38 widened totw_vote_cooldowns.category, both to allow
--   the new fixed 'overall' value used since Team of the Week combined
--   its boys/girls categories into one. A real live vote attempt still
--   failed after both of those, on a FOURTH table with the identical
--   restriction: totw_votes.category itself (the individual vote log the
--   existing cast_totw_vote() RPC inserts into after passing the
--   cooldown table) -- confirmed live 2026-08-31 via a real 23514
--   violation on "totw_votes_category_check".
--
--   This is now confirmed to be every table with a category column on
--   either award (checked via the full live schema, not guessed):
--   totw_nominations, totw_finalists, totw_vote_cooldowns, totw_votes.
--   aotw_* has no category column on any table and was never affected.
--
-- Safety:
--   Purely additive to the constraint's allowed values -- 'boys' and
--   'girls' remain valid. No table, column, or row is created, dropped,
--   or renamed.

begin;

alter table public.totw_votes drop constraint if exists totw_votes_category_check;
alter table public.totw_votes add constraint totw_votes_category_check
  check (category in ('boys', 'girls', 'overall'));

commit;
