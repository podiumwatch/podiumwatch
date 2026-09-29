-- Extends this week's (2026-09-30) Athlete of the Week and Team of the Week
-- voting windows from their normal close time (Wed 2026-10-01 01:00 UTC,
-- i.e. Wed 9pm Eastern) to Thu 2026-10-02 01:00 UTC (Thu 9pm Eastern), at
-- the user's request.
--
-- api/aotw/vote.js and api/totw/vote.js gate whether a vote is accepted on
-- three things: week.status === 'voting_open' AND currentTime is between
-- voting_opens and voting_closes. There is no cron job that auto-closes
-- voting (confirmed -- only nomination open/close are cron-scheduled, see
-- api/cron/open-scheduled-nominations.js and
-- api/cron/close-scheduled-nominations.js). So simply moving voting_closes
-- later is sufficient on its own -- no status change and no scheduled job
-- needed; votes are rejected automatically once the new voting_closes
-- timestamp passes.
--
-- Targets exactly the two specific, currently-voting_open week rows by id
-- (the real 2026-09-30 AOTW/TOTW weeks) -- nothing else is touched.
begin;

update public.aotw_weeks
set voting_closes = '2026-10-02T01:00:00+00:00'
where id = '62a52804-1c84-45e7-bcf0-3e808539852c'
  and status = 'voting_open';

update public.totw_weeks
set voting_closes = '2026-10-02T01:00:00+00:00'
where id = 'b5f91523-44df-4f92-b78a-786bb3fb237c'
  and status = 'voting_open';

commit;
