-- OATCCC private school directory: athletic directors and head coaches (2026-11-17)
--
-- NOT RUN. Needs install/99, 101 and 102 first, and Zachary's OK.
-- Safe to run more than once.
--
-- Numbered 104, not 103: branch oatccc-full-site already has a 103
-- (Hall of Fame).
--
-- Source: the OHSAA directory spreadsheet "Ohio_XC_Track_Coach_AD_Directory"
-- (High Schools tab), loaded by scripts/import-oatccc-directory.mjs (not
-- run). It is PRIVATE contact data (Zachary, 2026-11-17):
--   - the spreadsheet is never committed;
--   - nothing from it is ever shown on a public page;
--   - in the database only OATCCC staff can read it (row-level security);
--     there is no public view, and anon has no access at all.
-- Only what verification needs is stored: OHSAA ID, school, the AD's name
-- and emails, and the head coaches' names and emails for boys/girls cross
-- country and track & field, with the directory's date. Phone numbers and
-- assistant ADs are not stored.
--
-- What it is for:
--   1. AD sign-in: when the signed-in email is a school's AD email in the
--      directory, the form preselects that school and the AD can only
--      submit for it (oatccc_my_directory_schools, oatccc_claim_school).
--   2. When it is not, the AD picks the school as before and the
--      submission is flagged "AD email not in directory" for the Chair
--      (oatccc_submissions.ad_email_in_directory = false).

begin;

-- ---------------------------------------------------------------------------
-- 1. The directory (staff only)
-- ---------------------------------------------------------------------------

create table if not exists public.oatccc_directory_schools (
  ohsaa_id integer primary key,
  school_name text not null,
  city text,
  county text,
  ohsaa_district text,
  ad_name text,
  ad_emails text[] not null default '{}',
  boys_xc_coach text,
  boys_xc_emails text[] not null default '{}',
  girls_xc_coach text,
  girls_xc_emails text[] not null default '{}',
  boys_tf_coach text,
  boys_tf_emails text[] not null default '{}',
  girls_tf_coach text,
  girls_tf_emails text[] not null default '{}',
  directory_date date not null,
  oatccc_school_id uuid references public.oatccc_schools(id) on delete set null,
  updated_at timestamptz not null default now(),
  -- Emails are stored lower case so sign-in matching is exact.
  constraint oatccc_directory_emails_lower check (
    ad_emails::text = lower(ad_emails::text)
    and boys_xc_emails::text = lower(boys_xc_emails::text)
    and girls_xc_emails::text = lower(girls_xc_emails::text)
    and boys_tf_emails::text = lower(boys_tf_emails::text)
    and girls_tf_emails::text = lower(girls_tf_emails::text)
  )
);
create index if not exists oatccc_directory_ad_emails on public.oatccc_directory_schools using gin (ad_emails);
create index if not exists oatccc_directory_school on public.oatccc_directory_schools (oatccc_school_id);

alter table public.oatccc_directory_schools enable row level security;
drop policy if exists oatccc_directory_staff_read on public.oatccc_directory_schools;
create policy oatccc_directory_staff_read on public.oatccc_directory_schools
  for select to authenticated using (public.oatccc_is_staff());
-- Supabase grants new tables to everyone by default: take it all away.
-- Staff read through the policy; only the server secret key (the import)
-- writes. No view, no function that returns directory columns.
revoke all on public.oatccc_directory_schools from anon, authenticated;
grant select on public.oatccc_directory_schools to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Which schools the signed-in person is the AD of (by email)
-- ---------------------------------------------------------------------------

-- The signed-in user's email, lower case (Supabase Auth).
create or replace function public.oatccc_my_email()
returns text
language sql stable security definer
set search_path = public
as $$
  select lower(nullif(btrim(email), '')) from auth.users where id = auth.uid();
$$;

-- Real schools on the verification list whose directory AD email is the
-- signed-in user's. Returns only the school id and its public name: never
-- any directory contact data.
create or replace function public.oatccc_my_directory_schools()
returns table (school_id uuid, name text)
language sql stable security definer
set search_path = public
as $$
  select s.id, s.name
  from public.oatccc_directory_schools d
  join public.oatccc_schools s on s.id = d.oatccc_school_id
  where public.oatccc_my_email() is not null
    and public.oatccc_my_email() = any (d.ad_emails)
    and s.on_verification_list and not s.is_test
  order by s.name;
$$;

revoke all on function public.oatccc_my_email() from public, anon, authenticated;
revoke all on function public.oatccc_my_directory_schools() from public, anon;
grant execute on function public.oatccc_my_directory_schools() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Flag submissions whose AD email is not in the directory
-- ---------------------------------------------------------------------------

alter table public.oatccc_submissions add column if not exists ad_email_in_directory boolean;

-- Runs after oatccc_submissions_guard (triggers fire in name order). Real
-- schools only; TEST schools stay null.
create or replace function public.oatccc_submissions_directory_flag()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.oatccc_schools where id = new.school_id and not is_test) then
    new.ad_email_in_directory := exists (
      select 1 from public.oatccc_directory_schools d
      where d.oatccc_school_id = new.school_id
        and public.oatccc_my_email() is not null
        and public.oatccc_my_email() = any (d.ad_emails)
    );
  else
    new.ad_email_in_directory := null;
  end if;
  return new;
end;
$$;

drop trigger if exists oatccc_submissions_zz_directory_flag on public.oatccc_submissions;
create trigger oatccc_submissions_zz_directory_flag
  before insert on public.oatccc_submissions
  for each row execute function public.oatccc_submissions_directory_flag();

-- ---------------------------------------------------------------------------
-- 4. AD sign-in lock: an AD listed in the directory submits only for
--    their own school(s). Same as install/102 plus that one rule.
-- ---------------------------------------------------------------------------

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
  elsif exists (select 1 from public.oatccc_my_directory_schools())
        and not exists (select 1 from public.oatccc_my_directory_schools() m where m.school_id = p_school) then
    -- The directory lists this email as the AD of another school.
    raise exception 'OATCCC verification: your email is listed as the athletic director of another school. Submit for that school, or contact the Indoor State Meet Chairperson'
      using errcode = '42501';
  end if;
  if exists (select 1 from public.oatccc_school_contacts where school_id = p_school) then
    raise exception 'OATCCC verification: a form has already been started for this school. If that was not you, contact the Indoor State Meet Chairperson'
      using errcode = '42501';
  end if;
  insert into public.oatccc_school_contacts (school_id, user_id, linked_by)
  values (p_school, auth.uid(), 'picked');
end;
$$;

revoke all on function public.oatccc_claim_school(uuid) from public, anon, authenticated;

commit;
