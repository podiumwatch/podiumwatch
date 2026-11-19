-- OATCCC Hall of Fame and awards (2026-11-17, full site move)
--
-- NOT RUN. Zachary runs SQL himself. Safe to run more than once.
--
-- The OATCCC gave written permission to copy oatccc.com's content to
-- podiumwatch.org. The data is loaded by scripts/import-oatccc-hall-of-fame.mjs
-- (not run) from the crawl in _private/oatccc-crawl/ (never committed: the
-- repository is public and the bios stay out of git). The pages read these
-- tables at build time (src/oatccc/more/hof.mjs), behind OATCCC_HOF_LIVE.
--
-- Everything here is already public on oatccc.com, so anyone may read it.
-- Only the server secret key (the import script) writes.
--
-- Nothing is invented: school and sport are columns because the handoff
-- asks for them, but oatccc.com has no separate school or sport field for
-- inductees, so the import leaves them empty. Bios are stored word for
-- word.

begin;

create table if not exists public.oatccc_hof_inductees (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (name = btrim(name) and name <> ''),
  sort_name text not null,
  induction_year integer not null check (induction_year between 1900 and 2100),
  ed_barker_recipient boolean not null default false,
  school text,
  sport text,
  bio text not null default '',
  photo_path text,            -- key in the oatccc-public Storage bucket, e.g. Portal/Admin/Hall-Of-Fame/Images/A-W-Hendricks-1973.jpg
  old_url text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists oatccc_hof_inductees_year on public.oatccc_hof_inductees (induction_year desc, sort_name);

create table if not exists public.oatccc_awards (
  key text primary key check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  slug text not null unique,
  title text not null,
  intro_html text not null default '',   -- the award page's own words, copied from oatccc.com
  old_url text not null unique,
  sort integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.oatccc_award_recipients (
  id uuid primary key default gen_random_uuid(),
  award_key text not null references public.oatccc_awards(key) on delete cascade,
  position integer not null,             -- order on the oatccc.com page
  year integer check (year is null or year between 1900 and 2100),
  year_label text,                       -- the year or heading as oatccc.com shows it
  name text not null check (name = btrim(name) and name <> ''),
  school text,
  details text,                          -- category, sport or award line, as shown
  photo_path text,
  inductee_id uuid references public.oatccc_hof_inductees(id) on delete set null,
  old_url text,
  updated_at timestamptz not null default now(),
  constraint oatccc_award_recipients_position unique (award_key, position)
);
create index if not exists oatccc_award_recipients_award on public.oatccc_award_recipients (award_key, year desc nulls last, position);

alter table public.oatccc_hof_inductees enable row level security;
alter table public.oatccc_awards enable row level security;
alter table public.oatccc_award_recipients enable row level security;

drop policy if exists oatccc_hof_inductees_read on public.oatccc_hof_inductees;
create policy oatccc_hof_inductees_read on public.oatccc_hof_inductees for select to anon, authenticated using (true);
drop policy if exists oatccc_awards_read on public.oatccc_awards;
create policy oatccc_awards_read on public.oatccc_awards for select to anon, authenticated using (true);
drop policy if exists oatccc_award_recipients_read on public.oatccc_award_recipients;
create policy oatccc_award_recipients_read on public.oatccc_award_recipients for select to anon, authenticated using (true);

-- Supabase grants new tables to everyone by default: take that away, then
-- give read only. Writes come only from the server secret key.
revoke all on public.oatccc_hof_inductees, public.oatccc_awards, public.oatccc_award_recipients from anon, authenticated;
grant select on public.oatccc_hof_inductees, public.oatccc_awards, public.oatccc_award_recipients to anon, authenticated;

commit;
