begin;

-- Athlete of the Week goes back to separate boys/girls winners each week
-- (real request, 2026-09-14) -- the exact reverse of TOTW's own boys/
-- girls -> combined migration. aotw_nominations already captures a real
-- `gender` on every nomination (confirmed live: 'Boys'/'Girls' on every
-- real row) -- it was just never carried through to aotw_finalists,
-- which is what actually decides and displays a winner. This column is
-- purely additive and nullable: every finalist from before this feature
-- simply has no category, and keeps working exactly as it already does.
alter table public.aotw_finalists
  add column if not exists category text;

alter table public.aotw_finalists
  drop constraint if exists aotw_finalists_category_check;
alter table public.aotw_finalists
  add constraint aotw_finalists_category_check
  check (category is null or category in ('boys', 'girls'));

commit;
