-- Weekly Awards admin tooling: Athlete of the Week / Team of the Week
-- currently have no admin UI at all -- aotw_weeks/totw_weeks,
-- aotw_nominations/totw_nominations, and aotw_finalists/totw_finalists
-- were all created directly in Supabase before this project's migration
-- system existed (confirmed: no CREATE TABLE for any of them anywhere
-- in install/), and every status transition/finalist promotion has been
-- done by hand in the SQL editor. The nominations tables already carry
-- `reviewed`/`selected` boolean columns from that earlier hand-built
-- design -- this migration adds just the two link columns needed to
-- track which nomination (if any) a finalist was promoted from, so the
-- new admin tool can show "already promoted" and avoid creating a
-- second finalist row for the same nomination.
--
-- Purely additive: two nullable foreign keys, one per award type, in
-- each direction. No existing column, constraint, or row is touched.
-- A finalist can still be created without a nomination behind it (an
-- admin featuring an athlete/team nobody happened to submit) --
-- source_nomination_id is optional, not required.

alter table public.aotw_nominations
  add column if not exists promoted_finalist_id uuid references public.aotw_finalists(id) on delete set null;

alter table public.totw_nominations
  add column if not exists promoted_finalist_id uuid references public.totw_finalists(id) on delete set null;

alter table public.aotw_finalists
  add column if not exists source_nomination_id uuid references public.aotw_nominations(id) on delete set null;

alter table public.totw_finalists
  add column if not exists source_nomination_id uuid references public.totw_nominations(id) on delete set null;

create index if not exists aotw_nominations_promoted_finalist_idx on public.aotw_nominations (promoted_finalist_id);
create index if not exists totw_nominations_promoted_finalist_idx on public.totw_nominations (promoted_finalist_id);
create index if not exists aotw_finalists_source_nomination_idx on public.aotw_finalists (source_nomination_id);
create index if not exists totw_finalists_source_nomination_idx on public.totw_finalists (source_nomination_id);
