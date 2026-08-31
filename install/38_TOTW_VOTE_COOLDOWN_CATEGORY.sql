-- Team of the Week: allow the combined category on the vote cooldown table too
-- Purpose:
--   install/37_TOTW_SINGLE_CATEGORY.sql widened totw_nominations.category
--   and totw_finalists.category to allow the new fixed 'overall' value
--   used since Team of the Week combined its boys/girls categories into
--   one. It missed a THIRD table with the same restriction:
--   totw_vote_cooldowns (composite primary key week_id/category/
--   voter_hash, written internally by the existing cast_totw_vote() RPC
--   to enforce the per-voter voting cooldown) -- not discovered until a
--   real live vote attempt failed with a 23514 violation on
--   "totw_vote_cooldowns_category_check" (confirmed live 2026-08-31).
--   This migration widens that constraint the same way.
--
-- Safety:
--   Purely additive to the constraint's allowed values -- 'boys' and
--   'girls' remain valid. No table, column, or row is created, dropped,
--   or renamed. aotw_vote_cooldowns has no category column at all
--   (confirmed live) and is unaffected -- Athlete of the Week voting was
--   never broken by this.

begin;

alter table public.totw_vote_cooldowns drop constraint if exists totw_vote_cooldowns_category_check;
alter table public.totw_vote_cooldowns add constraint totw_vote_cooldowns_category_check
  check (category in ('boys', 'girls', 'overall'));

commit;
