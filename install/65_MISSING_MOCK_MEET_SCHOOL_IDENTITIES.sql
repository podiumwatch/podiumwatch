begin;

-- Five schools referenced by src/data/mock-regionals-2026.json (Hamilton
-- boys/girls, Groveport Madison, Danville, Elgin, Crestline) have never
-- existed in public.ohio_schools under any name, alias, or OHSAA ID --
-- confirmed directly against production data before writing this
-- migration (zero matches by ohsaa_school_id, school_name, city, or
-- ohio_school_aliases; zero matches in athlete_performance_import_rows'
-- original_row.school_name across all 1,813 imported rows). That gap is
-- what left all five team entries in the mock meet export tool's
-- "unresolved teams" report, unable to receive real approved
-- performances. This migration adds only these five rows, using OHSAA
-- school-identity values the user verified directly against OHSAA's
-- official school enrollment page (source below) -- never guessed.
--
-- Two identity mixups this migration deliberately avoids (both already
-- present in ohio_schools under a different real OHSAA ID, confirmed
-- distinct from the school actually being added here):
--   - Hamilton (685, Southwest) is not Hamilton Township (686, Central).
--   - Crestline (432, Northwest) is not Colonel Crawford (400,
--     Northwest) -- Colonel Crawford's own city field happens to read
--     "Crestline", but it is a separate, differently named school.
insert into public.ohio_data_sources (
  source_key,
  source_name,
  source_organization,
  source_type,
  document_title,
  source_url,
  season_label,
  last_verified_at,
  subject_to_change,
  notes
) values (
  'ohsaa-school-enrollment-2026',
  'OHSAA School Enrollment / Directory',
  'Ohio High School Athletic Association',
  'official',
  'OHSAA School Enrollment',
  'https://www.ohsaa.org/school-resources/school-enrollment',
  '2026',
  now(),
  true,
  'Used to verify OHSAA school ID, city, and athletic district for five schools (Hamilton, Groveport Madison, Danville, Elgin, Crestline) referenced in the mock regionals/state data but missing from ohio_schools.'
)
on conflict (source_key) do nothing;

insert into public.ohio_schools (
  ohsaa_school_id,
  school_name,
  normalized_name,
  city,
  normalized_city,
  athletic_district,
  source_id
) values
  (
    685,
    'Hamilton',
    'hamilton',
    'Hamilton',
    'hamilton',
    'Southwest',
    (select id from public.ohio_data_sources where source_key = 'ohsaa-school-enrollment-2026')
  ),
  (
    682,
    'Groveport Madison',
    'groveport madison',
    'Groveport',
    'groveport',
    'Central',
    (select id from public.ohio_data_sources where source_key = 'ohsaa-school-enrollment-2026')
  ),
  (
    454,
    'Danville',
    'danville',
    'Danville',
    'danville',
    'Central',
    (select id from public.ohio_data_sources where source_key = 'ohsaa-school-enrollment-2026')
  ),
  (
    524,
    'Elgin',
    'elgin',
    'Marion',
    'marion',
    'Central',
    (select id from public.ohio_data_sources where source_key = 'ohsaa-school-enrollment-2026')
  ),
  (
    432,
    'Crestline',
    'crestline',
    'Crestline',
    'crestline',
    'Northwest',
    (select id from public.ohio_data_sources where source_key = 'ohsaa-school-enrollment-2026')
  )
-- Conflict protection: if any of these five OHSAA IDs already exists
-- (it does not, as of this migration -- verified directly), this
-- insert leaves the existing row completely untouched rather than
-- overwriting it.
on conflict (ohsaa_school_id) do nothing;

-- The mock meet data spells this school "Groveport-Madison" (hyphenated)
-- while the canonical OHSAA record is "Groveport Madison" (space). Add
-- the hyphenated form as an alias so the existing matching system (which
-- already looks schools up by alias, e.g. Beaver Local -> Beaver) can
-- resolve either spelling to the same school. No other aliases are
-- added: none of the other four schools' mock-data or imported-
-- performance spellings differ from their canonical name above.
insert into public.ohio_school_aliases (
  school_id,
  alias,
  normalized_alias,
  source_id,
  notes
) values (
  (select id from public.ohio_schools where ohsaa_school_id = 682),
  'Groveport-Madison',
  'groveport madison',
  (select id from public.ohio_data_sources where source_key = 'ohsaa-school-enrollment-2026'),
  'Hyphenated spelling used in src/data/mock-regionals-2026.json for Groveport Madison (OHSAA 682).'
)
on conflict (school_id, normalized_alias) do nothing;

commit;
