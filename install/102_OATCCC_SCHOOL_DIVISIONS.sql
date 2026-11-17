-- OATCCC school list, divisions, AD school choice and signatures (2026-11-17)
--
-- RUN by Zachary on 2026-11-17 (after install/99 and install/101).
-- Safe to run more than once.
--
-- From Anjanette's answers (OATCCC_ANJANETTE_ANSWERS_HANDOFF.md, Parts 2-4):
--
-- 1. School list. oatccc_schools gains the OHSAA tournament name (the name
--    athletic directors pick in the form), the OHSAA id, the HyTek code and
--    "on_verification_list". Only the 812 names on the OATCCC's
--    "Verification School Names" list are on it. They are loaded by
--    scripts/import-oatccc-school-divisions.mjs (not run), never typed here.
--
-- 2. Divisions by gender: oatccc_school_divisions, keyed on (meet year,
--    gender, tournament name), with OHSAA id, enrollment, division and
--    HyTek code exactly as the OATCCC's workbook gives them. A public view
--    (oatccc_division_list) shows real rows only, for the "Divisions by
--    school" table (behind OATCCC_DIVISION_LIST_LIVE).
--
-- 3. How an AD is tied to a school (Zachary, 2026-11-17): the AD signs in
--    with the emailed link and PICKS the school; one submission per school;
--    the Chair's approval is the real check. Kept easy to change:
--      oatccc_config.ad_school_choice = 'pick'    (default) the AD picks any
--                                                 school on the list
--                                     = 'linked'  back to install/99: only
--                                                 ADs an admin linked to the
--                                                 school can submit
--    Switch with one line in the SQL editor:
--      update public.oatccc_config set value = 'linked' where key = 'ad_school_choice';
--    In 'pick' mode the first person to submit for a school becomes its
--    contact; nobody else can then submit for it or see its submission
--    (they are told to contact the Indoor State Meet Chairperson). An admin
--    can still link or unlink contacts by hand. What happens when the AD
--    changes mid-season is waiting on Anjanette.
--
-- 4. Signatures. The AD signs on screen. oatccc_signatures keeps, for every
--    submit and resubmit: the typed name, the signature image (PNG), the
--    date and time, the school, the season, who signed, and a fingerprint
--    of the exact form text they saw. Permanent: never edited, deleted only
--    with a TEST school's submission.
--
-- 5. Submitting now goes through oatccc_submit_signed(...). The install/99
--    oatccc_submit (no signature) is no longer callable by signed-in users.
--
-- 6. The real 2027 season (dates from the OATCCC's form text): opens
--    12/1/2026 12:00am, due 2/5/2027 11:59pm, late until 2/15/2027 5:00pm,
--    Eastern. Late = after the due time, i.e. from 2/6/2027 12:00am.
--
-- 7. MileSplit export view (oatccc_milesplit_export): verified (approved)
--    real schools for the newest real season with tournament name, HyTek
--    code and boys/girls division. Read by the private CSV link
--    (api/oatccc/milesplit.js, behind OATCCC_VERIFICATION_LIVE and a secret
--    token). The same schools appear on the public verified list anyway.

begin;

-- ---------------------------------------------------------------------------
-- 1. School list columns
-- ---------------------------------------------------------------------------

alter table public.oatccc_schools add column if not exists tournament_name text;
alter table public.oatccc_schools add column if not exists ohsaa_id integer;
alter table public.oatccc_schools add column if not exists ohsaa_school_name text;
alter table public.oatccc_schools add column if not exists hytek_code text;
alter table public.oatccc_schools add column if not exists on_verification_list boolean not null default false;

do $$ begin
  alter table public.oatccc_schools add constraint oatccc_schools_tournament_name_unique unique (tournament_name);
exception when duplicate_object or duplicate_table then null; end $$;
alter table public.oatccc_schools drop constraint if exists oatccc_schools_tournament_name_trimmed;
alter table public.oatccc_schools add constraint oatccc_schools_tournament_name_trimmed
  check (tournament_name is null or (tournament_name = btrim(tournament_name) and tournament_name <> ''));
-- TEST schools are never on the real list and have no tournament name.
alter table public.oatccc_schools drop constraint if exists oatccc_schools_test_not_listed;
alter table public.oatccc_schools add constraint oatccc_schools_test_not_listed
  check (not is_test or (tournament_name is null and not on_verification_list));
alter table public.oatccc_schools drop constraint if exists oatccc_schools_listed_named;
alter table public.oatccc_schools add constraint oatccc_schools_listed_named
  check (not on_verification_list or tournament_name is not null);

-- ---------------------------------------------------------------------------
-- 2. Divisions by gender
-- ---------------------------------------------------------------------------

create table if not exists public.oatccc_school_divisions (
  id uuid primary key default gen_random_uuid(),
  meet_year integer not null,
  gender text not null check (gender in ('boys', 'girls')),
  tournament_name text not null check (tournament_name = btrim(tournament_name) and tournament_name <> ''),
  ohsaa_id integer,
  ohsaa_school_name text,
  city text,
  athletic_district text,
  enrollment integer check (enrollment is null or enrollment >= 0),
  division text not null check (division in ('D-1', 'D-2', 'D-3', 'D-4')),
  hytek_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint oatccc_school_divisions_key unique (meet_year, gender, tournament_name)
);

alter table public.oatccc_school_divisions enable row level security;
drop policy if exists oatccc_school_divisions_read on public.oatccc_school_divisions;
create policy oatccc_school_divisions_read on public.oatccc_school_divisions
  for select to authenticated using (public.oatccc_is_staff());
revoke all on public.oatccc_school_divisions from anon, authenticated;
grant select on public.oatccc_school_divisions to authenticated;

-- Public "Divisions by school": real data only, no enrollment figures.
create or replace view public.oatccc_division_list
with (security_invoker = false) as
select d.meet_year, d.tournament_name,
       max(d.city) as city,
       max(d.division) filter (where d.gender = 'boys') as boys_division,
       max(d.division) filter (where d.gender = 'girls') as girls_division
from public.oatccc_school_divisions d
group by d.meet_year, d.tournament_name;

revoke all on public.oatccc_division_list from public;
grant select on public.oatccc_division_list to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. How an AD is tied to a school
-- ---------------------------------------------------------------------------

create table if not exists public.oatccc_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.oatccc_config drop constraint if exists oatccc_config_values;
alter table public.oatccc_config add constraint oatccc_config_values
  check (key <> 'ad_school_choice' or value in ('pick', 'linked'));
insert into public.oatccc_config (key, value) values ('ad_school_choice', 'pick')
on conflict (key) do nothing;

alter table public.oatccc_config enable row level security;
drop policy if exists oatccc_config_read on public.oatccc_config;
create policy oatccc_config_read on public.oatccc_config for select to authenticated using (true);
revoke all on public.oatccc_config from anon, authenticated;
grant select on public.oatccc_config to authenticated;

-- How each contact was linked: by an admin, or by picking the school.
alter table public.oatccc_school_contacts add column if not exists linked_by text not null default 'admin';
alter table public.oatccc_school_contacts drop constraint if exists oatccc_school_contacts_linked_by;
alter table public.oatccc_school_contacts add constraint oatccc_school_contacts_linked_by
  check (linked_by in ('admin', 'picked'));

create or replace function public.oatccc_ad_school_choice()
returns text
language sql stable security definer
set search_path = public
as $$
  select coalesce((select value from public.oatccc_config where key = 'ad_school_choice'), 'linked');
$$;

-- People testing with TEST data: OATCCC admins, and anyone an admin linked
-- to a TEST school (install/100). Only they see TEST schools to pick.
create or replace function public.oatccc_is_tester()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    public.oatccc_is_staff()
    or exists (select 1 from public.oatccc_school_contacts c join public.oatccc_schools s on s.id = c.school_id
               where c.user_id = auth.uid() and s.is_test)
  );
$$;

-- Signed-in users may read the schools they can pick (the dropdown):
-- real schools on the list in 'pick' mode, TEST schools for testers.
drop policy if exists oatccc_schools_pick_read on public.oatccc_schools;
create policy oatccc_schools_pick_read on public.oatccc_schools
  for select to authenticated using (
    (on_verification_list and public.oatccc_ad_school_choice() = 'pick')
    or (is_test and public.oatccc_is_tester())
  );

-- Makes the signed-in user this school's contact, if allowed. Called only
-- from oatccc_submit_signed (not callable by clients).
create or replace function public.oatccc_claim_school(p_school uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_school public.oatccc_schools;
begin
  if auth.uid() is null then
    raise exception 'OATCCC verification: please sign in' using errcode = '42501';
  end if;
  -- One claim at a time per school (two ADs submitting at once).
  perform pg_advisory_xact_lock(hashtext('oatccc_school:' || p_school::text));
  if public.oatccc_is_school_contact(p_school) then
    return;
  end if;
  select * into v_school from public.oatccc_schools where id = p_school;
  if not found then
    raise exception 'OATCCC verification: pick your school from the list';
  end if;
  if v_school.is_test then
    if not public.oatccc_is_tester() then
      raise exception 'OATCCC verification: pick your school from the list';
    end if;
  elsif not (v_school.on_verification_list and public.oatccc_ad_school_choice() = 'pick') then
    raise exception 'OATCCC verification: only this school''s athletic director can submit' using errcode = '42501';
  end if;
  if exists (select 1 from public.oatccc_school_contacts where school_id = p_school) then
    raise exception 'OATCCC verification: a form has already been started for this school. If that was not you, contact the Indoor State Meet Chairperson'
      using errcode = '42501';
  end if;
  insert into public.oatccc_school_contacts (school_id, user_id, linked_by)
  values (p_school, auth.uid(), 'picked');
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Signatures
-- ---------------------------------------------------------------------------

create table if not exists public.oatccc_signatures (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.oatccc_submissions(id) on delete cascade,
  season_id uuid not null references public.oatccc_seasons(id) on delete restrict,
  school_id uuid not null references public.oatccc_schools(id) on delete restrict,
  signer_id uuid references auth.users(id) on delete set null,
  typed_name text not null check (typed_name = btrim(typed_name) and length(typed_name) between 2 and 120),
  signature_png text not null check (signature_png like 'data:image/png;base64,%' and length(signature_png) <= 300000),
  form_text_sha256 text not null check (form_text_sha256 ~ '^[0-9a-f]{64}$'),
  signed_at timestamptz not null default now()
);
create index if not exists oatccc_signatures_submission on public.oatccc_signatures (submission_id, signed_at);

-- Permanent: never edited; deleted only with a TEST school's submission.
create or replace function public.oatccc_signatures_permanent()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'OATCCC verification: signatures are permanent and cannot be edited';
  end if;
  if exists (select 1 from public.oatccc_schools where id = old.school_id and not is_test)
     and exists (select 1 from public.oatccc_submissions where id = old.submission_id) then
    raise exception 'OATCCC verification: signatures are permanent and cannot be deleted';
  end if;
  return old;
end;
$$;

drop trigger if exists oatccc_signatures_permanent on public.oatccc_signatures;
create trigger oatccc_signatures_permanent
  before update or delete on public.oatccc_signatures
  for each row execute function public.oatccc_signatures_permanent();

alter table public.oatccc_signatures enable row level security;
drop policy if exists oatccc_signatures_read on public.oatccc_signatures;
create policy oatccc_signatures_read on public.oatccc_signatures
  for select to authenticated using (public.oatccc_is_staff() or public.oatccc_is_school_contact(school_id));
-- No insert/update/delete for clients: only oatccc_submit_signed writes.
revoke all on public.oatccc_signatures from anon, authenticated;
grant select on public.oatccc_signatures to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Submit with a signature
-- ---------------------------------------------------------------------------

-- Claims the school if needed (see 3), then submits, or resubmits a
-- returned form, and records the signature in the same transaction. An
-- existing submission that is not "returned" is opened as is (no new
-- signature). The guard trigger from install/99 still checks every rule.
create or replace function public.oatccc_submit_signed(
  p_season uuid, p_school uuid, p_answers jsonb,
  p_typed_name text, p_signature_png text, p_form_text_sha256 text)
returns public.oatccc_submissions
language plpgsql security definer
set search_path = public
as $$
declare
  v_row public.oatccc_submissions;
  v_signed boolean := false;
begin
  if auth.uid() is null then
    raise exception 'OATCCC verification: please sign in' using errcode = '42501';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'OATCCC verification: fill in the form before submitting';
  end if;
  if p_typed_name is null or length(btrim(p_typed_name)) < 2 then
    raise exception 'OATCCC verification: type your name to sign';
  end if;
  if p_signature_png is null or p_signature_png not like 'data:image/png;base64,%' then
    raise exception 'OATCCC verification: sign in the signature box';
  end if;

  perform public.oatccc_claim_school(p_school);

  select * into v_row from public.oatccc_submissions where season_id = p_season and school_id = p_school;
  if found then
    if v_row.status = 'returned' then
      update public.oatccc_submissions set status = 'resubmitted', answers = p_answers
        where id = v_row.id and status = 'returned'
        returning * into v_row;
      v_signed := v_row.id is not null;
      if not v_signed then
        select * into v_row from public.oatccc_submissions where season_id = p_season and school_id = p_school;
      end if;
    end if;
  else
    insert into public.oatccc_submissions (season_id, school_id, answers)
    values (p_season, p_school, p_answers)
    returning * into v_row;
    v_signed := true;
  end if;

  if v_signed then
    insert into public.oatccc_signatures (submission_id, season_id, school_id, signer_id, typed_name, signature_png, form_text_sha256)
    values (v_row.id, v_row.season_id, v_row.school_id, auth.uid(), btrim(p_typed_name), p_signature_png, p_form_text_sha256);
  end if;
  return v_row;
end;
$$;

revoke all on function public.oatccc_claim_school(uuid) from public, anon, authenticated;
revoke all on function public.oatccc_submit_signed(uuid, uuid, jsonb, text, text, text) from public, anon;
grant execute on function public.oatccc_submit_signed(uuid, uuid, jsonb, text, text, text) to authenticated;
-- The unsigned install/99 submit is retired for clients.
revoke all on function public.oatccc_submit(uuid, uuid, jsonb) from authenticated;

-- ---------------------------------------------------------------------------
-- 6. The real 2027 season
-- ---------------------------------------------------------------------------

insert into public.oatccc_seasons (name, meet_year, opens_at, due_at, late_closes_at, is_test)
values ('2027 Indoor State Track & Field Meet', 2027,
        '2026-12-01 00:00:00-05', '2027-02-05 23:59:59-05', '2027-02-15 17:00:00-05', false)
on conflict (meet_year, is_test) do nothing;

-- ---------------------------------------------------------------------------
-- 7. MileSplit export (verified real schools, newest real season)
-- ---------------------------------------------------------------------------

create or replace view public.oatccc_milesplit_export
with (security_invoker = false) as
with season as (
  select id, meet_year from public.oatccc_seasons where not is_test order by meet_year desc limit 1
)
select sc.tournament_name,
       sc.hytek_code,
       (select d.division from public.oatccc_school_divisions d
         where d.meet_year = se.meet_year and d.gender = 'boys' and d.tournament_name = sc.tournament_name) as boys_division,
       (select d.division from public.oatccc_school_divisions d
         where d.meet_year = se.meet_year and d.gender = 'girls' and d.tournament_name = sc.tournament_name) as girls_division,
       coalesce((s.answers ->> 'has_boys')::boolean, false) as has_boys_team,
       coalesce((s.answers ->> 'has_girls')::boolean, false) as has_girls_team,
       s.decided_at as verified_at
from public.oatccc_submissions s
join season se on se.id = s.season_id
join public.oatccc_schools sc on sc.id = s.school_id
where s.status = 'approved' and not sc.is_test;

revoke all on public.oatccc_milesplit_export from public;
grant select on public.oatccc_milesplit_export to anon, authenticated;

commit;
