-- 94_PUBLISH_RESULTS_TEAM_PAGES.sql (2026-11-11)
--
-- Team pages for 8 schools that have real results in the database but no
-- published team page, so their names couldn't link (docs/review/
-- unmatched-name-links-2026-11-11.md). Counts checked 2026-11-11:
--
--   school (city)                 public performances  team scores  public athletes  team page
--   Delaware Hayes (Delaware)     42                   2            25               exists, unpublished
--   Indian Valley (Gnadenhutten)  38                   4            13               exists, unpublished
--   Miller City (Miller City)     20                   0             7               none
--   Portsmouth (Portsmouth)       14                   0             4               none
--   Wellington School (Columbus)  22                   1             8               none
--   Oak Harbor (Oak Harbor)       21                   2             6               none
--   Patrick Henry (Hamler)        19                   1             6               none
--   Mohawk (Sycamore)             29                   3            12               none
--
-- 1. Publishes the two existing pages (only if still unpublished and live).
-- 2. Adds the six missing pages the same way the statewide import does
--    (api/admin/statewide-data.js): slug name-city-OHSAA id, school_key,
--    OHSAA id, region from the athletic district, high school, combined.
--    Names are title case (the Ohio schools list has them in capitals).
--    Divisions are left empty: the Ohio schools list has no current
--    division rows for these six, and nothing is guessed.
-- Safe to run twice: nothing is inserted for a school that already has a
-- team page, or for a slug already in use.

begin;

update public.team_pages
set published = true,
    last_admin_action_at = now()
where id in (
    'c4c2f9c5-f2de-467d-9506-f53258975459', -- Delaware Hayes
    'a962a6cd-5829-4309-9ef4-40c1b16c1a73'  -- Indian Valley
  )
  and published = false
  and suspended is not true
  and archived_at is null
  and merged_into_team_id is null;

insert into public.team_pages (
  school_name, slug, school_key, source_name, source_school_id, ohio_school_id,
  profile_origin, imported_at, city, state, region, program_level, program_scope,
  published, verified, suspended
)
select
  initcap(s.school_name),
  v.slug,
  v.school_key,
  'Ohio schools list (team page added for results, 2026-11-11)',
  s.ohsaa_school_id::text,
  s.id,
  'admin_import',
  now(),
  s.city,
  'Ohio',
  s.athletic_district,
  'high_school',
  'combined',
  true,
  false,
  false
from (values
  ('ca88071c-6e04-480d-9d6b-ff2954597718'::uuid, 'miller-city-miller-city-1038',     'miller-city|miller-city|high-school'),
  ('1da3c715-81e1-42d3-aed8-6f0e3734e176'::uuid, 'portsmouth-portsmouth-1268',       'portsmouth|portsmouth|high-school'),
  ('5498731d-88d0-45d4-8b52-097039ca1bb8'::uuid, 'wellington-school-columbus-1529',  'wellington-school|columbus|high-school'),
  ('f020f7aa-0a98-4b00-b806-7a504e270d09'::uuid, 'oak-harbor-oak-harbor-1184',       'oak-harbor|oak-harbor|high-school'),
  ('d8b62fba-99dc-4eaf-bfb9-deafa26b8ad1'::uuid, 'patrick-henry-hamler-1234',        'patrick-henry|hamler|high-school'),
  ('c66abf5a-33c6-4d8f-9c35-cc187eb6ace9'::uuid, 'mohawk-sycamore-1060',             'mohawk|sycamore|high-school')
) as v(school_id, slug, school_key)
join public.ohio_schools s on s.id = v.school_id
where not exists (select 1 from public.team_pages t where t.ohio_school_id = s.id)
  and not exists (select 1 from public.team_pages t where t.slug = v.slug);

commit;

-- Check: all eight should show published = true.
select school_name, slug, published
from public.team_pages
where ohio_school_id in (
  '31a83f1a-591c-4dae-adb9-ee197739014f', '83c768e2-62f2-4e8b-a725-221867197beb',
  'ca88071c-6e04-480d-9d6b-ff2954597718', '1da3c715-81e1-42d3-aed8-6f0e3734e176',
  '5498731d-88d0-45d4-8b52-097039ca1bb8', 'f020f7aa-0a98-4b00-b806-7a504e270d09',
  'd8b62fba-99dc-4eaf-bfb9-deafa26b8ad1', 'c66abf5a-33c6-4d8f-9c35-cc187eb6ace9'
)
order by school_name;
