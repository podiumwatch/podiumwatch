-- Podium Watch: hand-picked "Also on the front page" stories
-- Purpose:
--   Admin > Front Page can place up to 4 stories under the lead, in a set
--   order. They are rows in front_page_leads with slot = 'also' and a
--   position (1 to 4); every existing row stays slot = 'lead'. Picks count
--   as being on the front page: the story's date line, /front-page/ and
--   the "Featured on the Podium Watch front page" badges include them.
--   With no picks up, the homepage keeps its automatic rule.
--
-- Safety: two additive columns with defaults and checks, one index. No
-- rows are changed or deleted.

begin;

alter table public.front_page_leads
  add column if not exists slot text not null default 'lead' check (slot in ('lead', 'also')),
  add column if not exists position smallint check (position is null or position between 1 and 4);

create index if not exists front_page_leads_slot_index on public.front_page_leads (slot, starts_at desc) where status = 'scheduled';

commit;

-- Check after running:
-- select slot, count(*) from public.front_page_leads group by slot;  -- every existing row is 'lead'
