begin;

-- Media-credibility overhaul (2026-10-28), P0-1 backfill: the live
-- meets/results feed stopped at 2026-09-30 (last conference meets),
-- which meant OHSAA Districts (2026-10-24), Regionals (2026-10-31),
-- and the State Championships (2026-11-07) were all missing from
-- Results and Upcoming Meets. Site/date/region data below comes
-- directly from dataimports/district_meets_2026.json (the real,
-- already-verified source used to build the real-results Mock
-- Postseason chain) and src/data/mock-regionals-2026.json; the state
-- meet's date and venue come from the user's own pasted article
-- drafts. City is populated only where the venue's own name states
-- it unambiguously (e.g. "Columbus Grove HS" -> Columbus Grove);
-- nothing here is guessed. See docs/DECISIONS.md.
--
-- Reviewed and approved by Zachary before running (2026-10-28).

-- No DB-level unique constraint on public.meets.slug is confirmed to
-- exist (only app-level duplicate checking in api/admin/meets.js), so
-- this uses "insert ... select ... where not exists" per row instead
-- of "on conflict (slug)", which would error if that constraint isn't
-- actually there. Safe to re-run.
insert into public.meets (name, slug, year, sport, meet_date, venue_name, city, state, meet_type, published, results_url)
select v.name, v.slug, v.year, v.sport, v.meet_date, v.venue_name, v.city, v.state, v.meet_type, v.published, v.results_url
from (values
  -- Districts, 2026-10-24
  ('OHSAA Cross Country District - Hilliard Darby', '2026-ohsaa-district-hilliard-darby', 2026, 'Cross Country', date '2026-10-24', 'Hilliard Darby High School', 'Hilliard', 'OH', 'District', true, 'https://www.athletic.net/CrossCountry/meet/286386/info'),
  ('OHSAA Cross Country District - Cambridge', '2026-ohsaa-district-cambridge', 2026, 'Cross Country', date '2026-10-24', 'Cambridge High School', 'Cambridge', 'OH', 'District', true, 'https://www.athletic.net/CrossCountry/meet/286394/info'),
  ('OHSAA Cross Country District - GlenOak', '2026-ohsaa-district-glenoak', 2026, 'Cross Country', date '2026-10-24', 'GlenOak High School', null, 'OH', 'District', true, 'https://www.athletic.net/CrossCountry/meet/286397/info'),
  ('OHSAA Cross Country District - Lorain County CC', '2026-ohsaa-district-lorain-county-cc', 2026, 'Cross Country', date '2026-10-24', 'Lorain County Community College', null, 'OH', 'District', true, 'https://www.athletic.net/CrossCountry/meet/286398/info'),
  ('OHSAA Cross Country District - Madison', '2026-ohsaa-district-madison', 2026, 'Cross Country', date '2026-10-24', 'Madison High School', null, 'OH', 'District', true, 'https://www.athletic.net/CrossCountry/meet/286401/info'),
  ('OHSAA Cross Country District - Galion (Amann''s Park)', '2026-ohsaa-district-galion', 2026, 'Cross Country', date '2026-10-24', 'Amann''s Park', 'Galion', 'OH', 'District', true, 'https://www.athletic.net/CrossCountry/meet/286413/info'),
  ('OHSAA Cross Country District - Columbus Grove', '2026-ohsaa-district-columbus-grove', 2026, 'Cross Country', date '2026-10-24', 'Columbus Grove High School', 'Columbus Grove', 'OH', 'District', true, 'https://www.athletic.net/CrossCountry/meet/286411/info'),
  ('OHSAA Cross Country District - Napoleon (Leaders Farms)', '2026-ohsaa-district-napoleon', 2026, 'Cross Country', date '2026-10-24', 'Leaders Farms', 'Napoleon', 'OH', 'District', true, 'https://www.athletic.net/CrossCountry/meet/286409/info'),
  ('OHSAA Cross Country District - Findlay (Owens CC)', '2026-ohsaa-district-findlay-owens-cc', 2026, 'Cross Country', date '2026-10-24', 'Owens Community College', 'Findlay', 'OH', 'District', true, 'https://www.athletic.net/CrossCountry/meet/286408/info'),
  ('OHSAA Cross Country District - Rio Grande', '2026-ohsaa-district-rio-grande', 2026, 'Cross Country', date '2026-10-24', 'Rio Grande', 'Rio Grande', 'OH', 'District', true, 'https://www.athletic.net/CrossCountry/meet/286414/info'),
  ('OHSAA Cross Country District - Cedarville', '2026-ohsaa-district-cedarville', 2026, 'Cross Country', date '2026-10-24', 'Cedarville University', 'Cedarville', 'OH', 'District', true, 'https://www.athletic.net/CrossCountry/meet/286416/info'),
  ('OHSAA Cross Country District - Voice of America Park', '2026-ohsaa-district-voice-of-america-park', 2026, 'Cross Country', date '2026-10-24', 'Voice of America Park', null, 'OH', 'District', true, 'https://www.athletic.net/CrossCountry/meet/286417/info'),

  -- Regionals, 2026-10-31
  ('OHSAA Cross Country Regional - Pickerington', '2026-ohsaa-regional-pickerington', 2026, 'Cross Country', date '2026-10-31', null, 'Pickerington', 'OH', 'Regional', true, null),
  ('OHSAA Cross Country Regional - Boardman', '2026-ohsaa-regional-boardman', 2026, 'Cross Country', date '2026-10-31', null, 'Boardman', 'OH', 'Regional', true, null),
  ('OHSAA Cross Country Regional - Tiffin', '2026-ohsaa-regional-tiffin', 2026, 'Cross Country', date '2026-10-31', null, 'Tiffin', 'OH', 'Regional', true, null),
  ('OHSAA Cross Country Regional - Troy', '2026-ohsaa-regional-troy', 2026, 'Cross Country', date '2026-10-31', null, 'Troy', 'OH', 'Regional', true, null),

  -- State Championships, 2026-11-07
  ('OHSAA Cross Country State Championships', '2026-ohsaa-state-championships', 2026, 'Cross Country', date '2026-11-07', 'Fortress Obetz', 'Obetz', 'OH', 'State', true, null)
) as v(name, slug, year, sport, meet_date, venue_name, city, state, meet_type, published, results_url)
where not exists (select 1 from public.meets m where m.slug = v.slug);

commit;
