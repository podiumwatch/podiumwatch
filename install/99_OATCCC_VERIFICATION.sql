-- OATCCC Indoor State Meet team verification (Part B groundwork, 2026-11-16)
--
-- NOT RUN. Written for Zachary to review first (OATCCC_SECTION_BUILD_HANDOFF).
-- Creates no school, AD or season rows. Test data lives in
-- install/100_OATCCC_VERIFICATION_TEST_SEED.sql (also not run).
--
-- Who uses it
--   Admin (Anjanette, maybe one backup): a row in oatccc_staff. Sees every
--     submission, approves it or returns it with a comment.
--   Athletic directors: a row in oatccc_school_contacts per school. Submit
--     once per school per season, see status and comments, resubmit.
--   Public: only the oatccc_verified_teams view.
--
-- Rules the database enforces (not just the pages)
--   1. One submission per school per season (unique key). A second attempt
--      through oatccc_submit() returns the existing submission instead of
--      creating a new one.
--   2. Statuses: submitted, returned, resubmitted, approved. Allowed moves:
--        submitted   -> returned | approved   (admin)
--        resubmitted -> returned | approved   (admin)
--        returned    -> resubmitted           (that school's AD)
--      "returned" needs a comment from the same admin in the same
--      transaction (oatccc_return_submission() does both).
--   3. A first submission is flagged late when it arrives after the
--      season's due time, and refused after the late window closes.
--   4. Every submission, status change and comment is written to
--      oatccc_submission_events (who and when), by trigger. Comments and
--      events can never be edited, and never deleted except for TEST data.
--   5. Row-level security: an AD reads only their own school's rows; the
--      admin reads everything; nobody else reads anything but the public
--      view. Writes go through the functions below, and RLS plus the guard
--      trigger apply to them too (they run as the signed-in user).
--
-- Left open (waiting on Anjanette): how ADs sign in, the exact form
-- questions (stored as jsonb `answers` until then), what the public list
-- shows and how often, whether late fines are tracked, who else is admin,
-- and whether a returned form may be resubmitted after the late window
-- closes (allowed for now).

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.oatccc_seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  meet_year integer not null,
  opens_at timestamptz not null,
  due_at timestamptz not null,
  late_closes_at timestamptz not null,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  constraint oatccc_seasons_order check (opens_at < due_at and due_at < late_closes_at),
  constraint oatccc_seasons_test_name check (not is_test or name like 'TEST %')
);
create unique index if not exists oatccc_seasons_year_unique
  on public.oatccc_seasons (meet_year, is_test);

create table if not exists public.oatccc_schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  ohio_school_id uuid references public.ohio_schools(id) on delete set null,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  constraint oatccc_schools_test_name check (not is_test or name like 'TEST %'),
  constraint oatccc_schools_test_unlinked check (not is_test or ohio_school_id is null)
);
create unique index if not exists oatccc_schools_ohio_school_unique
  on public.oatccc_schools (ohio_school_id) where ohio_school_id is not null;

-- Admins. One row per Supabase Auth user.
create table if not exists public.oatccc_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now()
);

-- Athletic directors, linked to the school(s) they may submit for.
create table if not exists public.oatccc_school_contacts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.oatccc_schools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'athletic_director' check (role in ('athletic_director')),
  created_at timestamptz not null default now(),
  unique (school_id, user_id)
);
create index if not exists oatccc_school_contacts_user on public.oatccc_school_contacts (user_id);

do $$ begin
  create type public.oatccc_submission_status as enum ('submitted', 'returned', 'resubmitted', 'approved');
exception when duplicate_object then null; end $$;

create table if not exists public.oatccc_submissions (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.oatccc_seasons(id) on delete restrict,
  school_id uuid not null references public.oatccc_schools(id) on delete restrict,
  status public.oatccc_submission_status not null default 'submitted',
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  is_late boolean not null default false,
  first_submitted_at timestamptz not null default now(),
  last_submitted_at timestamptz not null default now(),
  submitted_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint oatccc_submissions_one_per_school_season unique (season_id, school_id)
);
create index if not exists oatccc_submissions_status on public.oatccc_submissions (season_id, status);

create table if not exists public.oatccc_submission_comments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.oatccc_submissions(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author_role text not null check (author_role in ('admin', 'athletic_director')),
  body text not null check (length(btrim(body)) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index if not exists oatccc_submission_comments_submission on public.oatccc_submission_comments (submission_id, created_at);

create table if not exists public.oatccc_submission_events (
  id bigint generated always as identity primary key,
  submission_id uuid not null references public.oatccc_submissions(id) on delete cascade,
  event text not null check (event in ('submitted', 'returned', 'resubmitted', 'approved', 'commented')),
  from_status public.oatccc_submission_status,
  to_status public.oatccc_submission_status,
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text check (actor_role in ('admin', 'athletic_director')),
  is_late boolean,
  comment_id uuid references public.oatccc_submission_comments(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists oatccc_submission_events_submission on public.oatccc_submission_events (submission_id, created_at);

-- ---------------------------------------------------------------------------
-- Who is asking (security definer so RLS policies can call them)
-- ---------------------------------------------------------------------------

create or replace function public.oatccc_is_staff()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select auth.uid() is not null
     and exists (select 1 from public.oatccc_staff where user_id = auth.uid());
$$;

create or replace function public.oatccc_is_school_contact(p_school uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select auth.uid() is not null
     and exists (select 1 from public.oatccc_school_contacts where school_id = p_school and user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Guard trigger on submissions: statuses, who, when, what may change
-- ---------------------------------------------------------------------------

create or replace function public.oatccc_submissions_guard()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_season public.oatccc_seasons;
  v_school_test boolean;
begin
  if auth.uid() is null then
    raise exception 'OATCCC verification: a signed-in user is required for every change' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    select * into v_season from public.oatccc_seasons where id = new.season_id;
    select is_test into v_school_test from public.oatccc_schools where id = new.school_id;
    if v_season.is_test is distinct from v_school_test then
      raise exception 'OATCCC verification: TEST schools use TEST seasons only, and real schools real seasons';
    end if;
    if not public.oatccc_is_school_contact(new.school_id) then
      raise exception 'OATCCC verification: only this school''s athletic director can submit' using errcode = '42501';
    end if;
    if now() < v_season.opens_at then
      raise exception 'OATCCC verification: the form is not open yet';
    end if;
    if now() > v_season.late_closes_at then
      raise exception 'OATCCC verification: the late window has closed; no forms are accepted';
    end if;
    new.status := 'submitted';
    new.is_late := now() > v_season.due_at;
    new.first_submitted_at := now();
    new.last_submitted_at := now();
    new.submitted_by := auth.uid();
    new.decided_at := null;
    new.decided_by := null;
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  -- UPDATE
  if new.season_id <> old.season_id or new.school_id <> old.school_id
     or new.first_submitted_at <> old.first_submitted_at or new.is_late <> old.is_late
     or new.created_at <> old.created_at or new.submitted_by is distinct from old.submitted_by then
    raise exception 'OATCCC verification: season, school, first-submitted time, late flag and submitter never change';
  end if;
  if new.status = old.status then
    raise exception 'OATCCC verification: a submission changes only by moving to a new status';
  end if;

  if (old.status in ('submitted', 'resubmitted') and new.status in ('returned', 'approved')) then
    if not public.oatccc_is_staff() then
      raise exception 'OATCCC verification: only an OATCCC admin can approve or return' using errcode = '42501';
    end if;
    if new.answers <> old.answers then
      raise exception 'OATCCC verification: an admin cannot change the athletic director''s answers';
    end if;
    if new.status = 'returned' and not exists (
      select 1 from public.oatccc_submission_comments c
      where c.submission_id = new.id and c.author_id = auth.uid() and c.created_at = now()
    ) then
      raise exception 'OATCCC verification: returning a submission needs a comment (use oatccc_return_submission)';
    end if;
    new.decided_at := now();
    new.decided_by := auth.uid();
  elsif old.status = 'returned' and new.status = 'resubmitted' then
    if not public.oatccc_is_school_contact(old.school_id) then
      raise exception 'OATCCC verification: only this school''s athletic director can resubmit' using errcode = '42501';
    end if;
    new.last_submitted_at := now();
    new.decided_at := null;
    new.decided_by := null;
  else
    raise exception 'OATCCC verification: % -> % is not an allowed status change', old.status, new.status;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists oatccc_submissions_guard on public.oatccc_submissions;
create trigger oatccc_submissions_guard
  before insert or update on public.oatccc_submissions
  for each row execute function public.oatccc_submissions_guard();

-- Audit trail for submissions.
create or replace function public.oatccc_submissions_audit()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.oatccc_submission_events (submission_id, event, from_status, to_status, actor_id, actor_role, is_late)
    values (new.id, 'submitted', null, new.status, auth.uid(), 'athletic_director', new.is_late);
  elsif new.status <> old.status then
    insert into public.oatccc_submission_events (submission_id, event, from_status, to_status, actor_id, actor_role, is_late)
    values (new.id, new.status::text, old.status, new.status, auth.uid(),
            case when new.status = 'resubmitted' then 'athletic_director' else 'admin' end, new.is_late);
  end if;
  return null;
end;
$$;

drop trigger if exists oatccc_submissions_audit on public.oatccc_submissions;
create trigger oatccc_submissions_audit
  after insert or update on public.oatccc_submissions
  for each row execute function public.oatccc_submissions_audit();

-- ---------------------------------------------------------------------------
-- Comments: author and role come from the signed-in user, never the client
-- ---------------------------------------------------------------------------

create or replace function public.oatccc_comments_guard()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_school uuid;
begin
  if auth.uid() is null then
    raise exception 'OATCCC verification: a signed-in user is required to comment' using errcode = '42501';
  end if;
  select school_id into v_school from public.oatccc_submissions where id = new.submission_id;
  if public.oatccc_is_staff() then
    new.author_role := 'admin';
  elsif public.oatccc_is_school_contact(v_school) then
    new.author_role := 'athletic_director';
  else
    raise exception 'OATCCC verification: you cannot comment on this submission' using errcode = '42501';
  end if;
  new.author_id := auth.uid();
  new.body := btrim(new.body);
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists oatccc_comments_guard on public.oatccc_submission_comments;
create trigger oatccc_comments_guard
  before insert on public.oatccc_submission_comments
  for each row execute function public.oatccc_comments_guard();

create or replace function public.oatccc_comments_audit()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.oatccc_submission_events (submission_id, event, actor_id, actor_role, comment_id)
  values (new.submission_id, 'commented', new.author_id, new.author_role, new.id);
  return null;
end;
$$;

drop trigger if exists oatccc_comments_audit on public.oatccc_submission_comments;
create trigger oatccc_comments_audit
  after insert on public.oatccc_submission_comments
  for each row execute function public.oatccc_comments_audit();

-- Comments and events are permanent. Updates are always refused; deletes
-- only for TEST schools (so the test seed can be cleaned up).
create or replace function public.oatccc_permanent_rows()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_test boolean;
begin
  if tg_op = 'UPDATE' then
    raise exception 'OATCCC verification: % rows are permanent and cannot be edited', tg_table_name;
  end if;
  select sc.is_test into v_test
  from public.oatccc_submissions s join public.oatccc_schools sc on sc.id = s.school_id
  where s.id = old.submission_id;
  -- v_test is null when the submission row is already gone (a cascade
  -- from deleting a TEST submission, which itself was checked below).
  if v_test is false then
    raise exception 'OATCCC verification: % rows are permanent and cannot be deleted', tg_table_name;
  end if;
  return old;
end;
$$;

drop trigger if exists oatccc_comments_permanent on public.oatccc_submission_comments;
create trigger oatccc_comments_permanent
  before update or delete on public.oatccc_submission_comments
  for each row execute function public.oatccc_permanent_rows();

drop trigger if exists oatccc_events_permanent on public.oatccc_submission_events;
create trigger oatccc_events_permanent
  before update or delete on public.oatccc_submission_events
  for each row execute function public.oatccc_permanent_rows();

-- Submissions themselves can only be deleted when they belong to a TEST
-- school (the audit trail of a real school is never removed).
create or replace function public.oatccc_submissions_no_delete()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.oatccc_schools where id = old.school_id and is_test) then
    raise exception 'OATCCC verification: real submissions cannot be deleted';
  end if;
  return old;
end;
$$;

drop trigger if exists oatccc_submissions_no_delete on public.oatccc_submissions;
create trigger oatccc_submissions_no_delete
  before delete on public.oatccc_submissions
  for each row execute function public.oatccc_submissions_no_delete();

-- ---------------------------------------------------------------------------
-- Actions (run as the signed-in user: RLS and the guard trigger apply)
-- ---------------------------------------------------------------------------

-- Submit, or open the existing one. A returned submission is resubmitted
-- with the new answers; any other existing submission is returned as is.
create or replace function public.oatccc_submit(p_season uuid, p_school uuid, p_answers jsonb)
returns public.oatccc_submissions
language plpgsql security invoker
set search_path = public
as $$
declare
  v_row public.oatccc_submissions;
begin
  if not public.oatccc_is_school_contact(p_school) then
    raise exception 'OATCCC verification: only this school''s athletic director can submit' using errcode = '42501';
  end if;
  -- No FOR UPDATE here: under RLS that would also apply the update
  -- policies and hide a submission that is not currently "returned".
  select * into v_row from public.oatccc_submissions
  where season_id = p_season and school_id = p_school;
  if found then
    if v_row.status = 'returned' then
      update public.oatccc_submissions
        set status = 'resubmitted', answers = coalesce(p_answers, '{}'::jsonb)
        where id = v_row.id and status = 'returned'
        returning * into v_row;
      if v_row.id is null then
        -- Resubmitted from another tab a moment ago: open that one.
        select * into v_row from public.oatccc_submissions where season_id = p_season and school_id = p_school;
      end if;
    end if;
    return v_row;
  end if;
  begin
    insert into public.oatccc_submissions (season_id, school_id, answers)
    values (p_season, p_school, coalesce(p_answers, '{}'::jsonb))
    returning * into v_row;
  exception when unique_violation then
    -- Two tabs at once: the other one won; open its submission.
    select * into v_row from public.oatccc_submissions where season_id = p_season and school_id = p_school;
  end;
  return v_row;
end;
$$;

create or replace function public.oatccc_return_submission(p_submission uuid, p_comment text)
returns public.oatccc_submissions
language plpgsql security invoker
set search_path = public
as $$
declare
  v_row public.oatccc_submissions;
begin
  if p_comment is null or length(btrim(p_comment)) = 0 then
    raise exception 'OATCCC verification: say what needs fixing before returning a submission';
  end if;
  insert into public.oatccc_submission_comments (submission_id, author_role, body)
  values (p_submission, 'admin', p_comment);
  update public.oatccc_submissions set status = 'returned' where id = p_submission returning * into v_row;
  if v_row.id is null then
    raise exception 'OATCCC verification: submission not found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

create or replace function public.oatccc_approve_submission(p_submission uuid, p_comment text default null)
returns public.oatccc_submissions
language plpgsql security invoker
set search_path = public
as $$
declare
  v_row public.oatccc_submissions;
begin
  if p_comment is not null and length(btrim(p_comment)) > 0 then
    insert into public.oatccc_submission_comments (submission_id, author_role, body)
    values (p_submission, 'admin', p_comment);
  end if;
  update public.oatccc_submissions set status = 'approved' where id = p_submission returning * into v_row;
  if v_row.id is null then
    raise exception 'OATCCC verification: submission not found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.oatccc_seasons enable row level security;
alter table public.oatccc_schools enable row level security;
alter table public.oatccc_staff enable row level security;
alter table public.oatccc_school_contacts enable row level security;
alter table public.oatccc_submissions enable row level security;
alter table public.oatccc_submission_comments enable row level security;
alter table public.oatccc_submission_events enable row level security;

drop policy if exists oatccc_seasons_read on public.oatccc_seasons;
create policy oatccc_seasons_read on public.oatccc_seasons
  for select to authenticated using (true);

drop policy if exists oatccc_schools_read on public.oatccc_schools;
create policy oatccc_schools_read on public.oatccc_schools
  for select to authenticated using (public.oatccc_is_staff() or public.oatccc_is_school_contact(id));

drop policy if exists oatccc_staff_read on public.oatccc_staff;
create policy oatccc_staff_read on public.oatccc_staff
  for select to authenticated using (user_id = auth.uid() or public.oatccc_is_staff());

drop policy if exists oatccc_contacts_read on public.oatccc_school_contacts;
create policy oatccc_contacts_read on public.oatccc_school_contacts
  for select to authenticated using (user_id = auth.uid() or public.oatccc_is_staff());

drop policy if exists oatccc_submissions_read on public.oatccc_submissions;
create policy oatccc_submissions_read on public.oatccc_submissions
  for select to authenticated using (public.oatccc_is_staff() or public.oatccc_is_school_contact(school_id));

drop policy if exists oatccc_submissions_ad_insert on public.oatccc_submissions;
create policy oatccc_submissions_ad_insert on public.oatccc_submissions
  for insert to authenticated with check (public.oatccc_is_school_contact(school_id) and status = 'submitted');

drop policy if exists oatccc_submissions_ad_resubmit on public.oatccc_submissions;
create policy oatccc_submissions_ad_resubmit on public.oatccc_submissions
  for update to authenticated
  using (public.oatccc_is_school_contact(school_id) and status = 'returned')
  with check (public.oatccc_is_school_contact(school_id) and status = 'resubmitted');

drop policy if exists oatccc_submissions_staff_decide on public.oatccc_submissions;
create policy oatccc_submissions_staff_decide on public.oatccc_submissions
  for update to authenticated
  using (public.oatccc_is_staff())
  with check (public.oatccc_is_staff() and status in ('returned', 'approved'));

drop policy if exists oatccc_comments_read on public.oatccc_submission_comments;
create policy oatccc_comments_read on public.oatccc_submission_comments
  for select to authenticated using (
    public.oatccc_is_staff()
    or exists (select 1 from public.oatccc_submissions s where s.id = submission_id and public.oatccc_is_school_contact(s.school_id))
  );

drop policy if exists oatccc_comments_insert on public.oatccc_submission_comments;
create policy oatccc_comments_insert on public.oatccc_submission_comments
  for insert to authenticated with check (
    public.oatccc_is_staff()
    or exists (select 1 from public.oatccc_submissions s where s.id = submission_id and public.oatccc_is_school_contact(s.school_id))
  );

drop policy if exists oatccc_events_read on public.oatccc_submission_events;
create policy oatccc_events_read on public.oatccc_submission_events
  for select to authenticated using (
    public.oatccc_is_staff()
    or exists (select 1 from public.oatccc_submissions s where s.id = submission_id and public.oatccc_is_school_contact(s.school_id))
  );
-- No insert/update/delete policies on events: only the audit triggers write them.

-- Grants: Supabase gives new tables full privileges by default, so take
-- everything away first. Nothing for anon on the tables; signed-in users
-- get only these, and the policies above narrow them further.
revoke all on public.oatccc_seasons, public.oatccc_schools, public.oatccc_staff, public.oatccc_school_contacts,
  public.oatccc_submissions, public.oatccc_submission_comments, public.oatccc_submission_events from anon, authenticated;
grant select on public.oatccc_seasons, public.oatccc_schools, public.oatccc_staff, public.oatccc_school_contacts,
  public.oatccc_submissions, public.oatccc_submission_comments, public.oatccc_submission_events to authenticated;
grant insert, update on public.oatccc_submissions to authenticated;
grant insert on public.oatccc_submission_comments to authenticated;

revoke all on function public.oatccc_submit(uuid, uuid, jsonb) from public, anon;
revoke all on function public.oatccc_return_submission(uuid, text) from public, anon;
revoke all on function public.oatccc_approve_submission(uuid, text) from public, anon;
grant execute on function public.oatccc_submit(uuid, uuid, jsonb) to authenticated;
grant execute on function public.oatccc_return_submission(uuid, text) to authenticated;
grant execute on function public.oatccc_approve_submission(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Public verified-teams list: school name, city and meet year only, real
-- (non-TEST) approved submissions only. Runs as its owner, so it shows
-- these columns without opening the tables. What it shows, and whether it
-- updates instantly or weekly, is waiting on Anjanette.
-- ---------------------------------------------------------------------------

create or replace view public.oatccc_verified_teams
with (security_invoker = false) as
select se.meet_year, sc.name as school_name, sc.city
from public.oatccc_submissions s
join public.oatccc_schools sc on sc.id = s.school_id
join public.oatccc_seasons se on se.id = s.season_id
where s.status = 'approved' and not sc.is_test and not se.is_test;

revoke all on public.oatccc_verified_teams from public;
grant select on public.oatccc_verified_teams to anon, authenticated;

commit;
