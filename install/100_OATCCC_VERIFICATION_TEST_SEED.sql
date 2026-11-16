-- OATCCC verification: TEST data only (2026-11-16)
--
-- NOT RUN. Needs install/99_OATCCC_VERIFICATION.sql first, and Zachary's OK.
-- Safe to run more than once (fixed ids, "on conflict do nothing").
--
-- Every row here is marked TEST: the season and school names start with
-- "TEST " and is_test = true, which the database checks. TEST schools can
-- only use TEST seasons, never appear on the public verified list, and
-- (unlike real ones) can be deleted with their whole trail.
--
-- The TEST season opens now, not on Dec 1, so the pages can be tried
-- before the real form window. Its due time and late window match the
-- published 2027 dates (Feb 5, 2027, 11:59 pm and Feb 15, 2027, 5:00 pm
-- Eastern).
--
-- No real school, athletic director or season is created here.

begin;

insert into public.oatccc_seasons (id, name, meet_year, opens_at, due_at, late_closes_at, is_test) values
  ('7e570000-0000-4000-8000-000000002027', 'TEST 2027 Indoor State Meet', 2027,
   '2026-11-01 00:00:00-05', '2027-02-05 23:59:59-05', '2027-02-15 17:00:00-05', true)
on conflict (id) do nothing;

insert into public.oatccc_schools (id, name, city, is_test) values
  ('7e570000-0000-4000-8000-00000000000a', 'TEST Alpha High School', 'Testville', true),
  ('7e570000-0000-4000-8000-00000000000b', 'TEST Bravo High School', 'Testville', true),
  ('7e570000-0000-4000-8000-00000000000c', 'TEST Charlie High School', 'Testville', true)
on conflict (id) do nothing;

-- Test sign-ins: create the accounts in Supabase (Authentication > Users)
-- with email addresses you control, then put their user ids below and
-- uncomment. One admin and one AD per TEST school is enough.
--
-- insert into public.oatccc_staff (user_id, display_name) values
--   ('<test admin user id>', 'TEST Admin')
-- on conflict (user_id) do nothing;
--
-- insert into public.oatccc_school_contacts (school_id, user_id, display_name) values
--   ('7e570000-0000-4000-8000-00000000000a', '<test AD 1 user id>', 'TEST AD Alpha'),
--   ('7e570000-0000-4000-8000-00000000000b', '<test AD 2 user id>', 'TEST AD Bravo')
-- on conflict (school_id, user_id) do nothing;

commit;

-- To remove all TEST verification data later (comments and the audit
-- trail of TEST schools go with their submissions):
--
-- begin;
-- delete from public.oatccc_submissions where school_id in (select id from public.oatccc_schools where is_test);
-- delete from public.oatccc_school_contacts where school_id in (select id from public.oatccc_schools where is_test);
-- delete from public.oatccc_schools where is_test;
-- delete from public.oatccc_seasons where is_test;
-- commit;
