-- Podium Watch: correct season_year on Finish Timing meets
-- Purpose:
--   Audit 2026-11-09 found old track meets (for example "2021 Warrior /
--   Elk Dual", dated 2021-05-03) labeled season 2026 in the meet catalog.
--   Cause: when Finish Timing's meet type couldn't be classified, the
--   discovery code fell back to the current year instead of the meet's
--   date. Fixed in lib/finish_timing_ingestion_service.mjs for new meets.
--   This corrects the rows already stored.
--
--   Checked read-only on 2026-11-09: 1,025 Finish Timing meets, 643 with
--   the wrong season, all of them 'ignored' (not cross country, never
--   processed), none missing a date.
--
-- Rule (same as deriveSeasonYearFromMeetDate in
-- lib/athlete_foundation_service.mjs):
--   cross country: the meet's calendar year
--   track: the spring year (a meet after June counts toward next spring)
--
-- Safety:
--   Only Finish Timing rows (meet_key 'finish_timing:%') with a meet_date
--   whose stored season differs. Nothing deleted. Preview first.

-- Preview:
-- select meet_name, meet_date, sport, season_year,
--   case when sport = 'cross_country' then extract(year from meet_date)::int
--        else extract(year from meet_date)::int + case when extract(month from meet_date) > 6 then 1 else 0 end
--   end as corrected
-- from public.discovered_meets
-- where meet_key like 'finish_timing:%' and meet_date is not null
-- order by meet_date;

begin;

update public.discovered_meets
set season_year = case
      when sport = 'cross_country' then extract(year from meet_date)::int
      else extract(year from meet_date)::int + case when extract(month from meet_date) > 6 then 1 else 0 end
    end,
    updated_at = now()
where meet_key like 'finish_timing:%'
  and meet_date is not null
  and season_year is distinct from case
      when sport = 'cross_country' then extract(year from meet_date)::int
      else extract(year from meet_date)::int + case when extract(month from meet_date) > 6 then 1 else 0 end
    end;

commit;
