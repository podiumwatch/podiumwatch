-- OATCCC admin roles (2026-11-16)
--
-- NOT RUN. Needs install/99_OATCCC_VERIFICATION.sql first, and Zachary's OK.
-- Safe to run more than once.
--
-- Replaces the single "admin" role from install/99 with five roles:
--   president        everything, and may add, change and remove admins
--   indoor_chair     the Indoor State Meet (verification); membership lookup later
--   ms_indoor_chair  nothing yet ("Coming later" in the admin area)
--   clinic_chair     nothing yet ("Coming later" in the admin area)
--   site_admin       everything, and may add, change and remove admins
--
-- The database decides access, not the menu:
--   - oatccc_is_staff(), which every install/99 rule and policy uses, now
--     means "may work on indoor verification": president, indoor_chair or
--     site_admin. The middle school and clinic chairs have no access to
--     submissions, comments or the audit trail.
--   - Admins are added, changed and removed only through the functions
--     below (signed-in users have no direct write access to oatccc_staff).
--     A president or site_admin may manage admins; only a site_admin may
--     make or remove another site_admin (Zachary, 2026-11-16).
--   - The last site_admin can never be removed or demoted, by anyone,
--     including the database owner (trigger).
--   - Every admin change is written to oatccc_staff_events, which can never
--     be edited or deleted.
--
-- Adding an admin needs an existing Supabase sign-in account for that
-- email. Invites by email (an admin with no account yet) are planned for
-- summer 2027 with the rest of the admin area. Nothing here sends email.
--
-- First site_admin: run this in the SQL editor once, with the user id of
-- Zachary's account (the trigger allows it because no one is signed in):
--   insert into public.oatccc_staff (user_id, display_name, role)
--   values ('<user id>', 'Zachary Bell', 'site_admin');

begin;

-- ---------------------------------------------------------------------------
-- Roles on oatccc_staff
-- ---------------------------------------------------------------------------

alter table public.oatccc_staff drop constraint if exists oatccc_staff_role_check;
alter table public.oatccc_staff alter column role drop default;
-- install/99 allowed only 'admin', which meant the Indoor State Meet Chair.
update public.oatccc_staff set role = 'indoor_chair' where role = 'admin';
alter table public.oatccc_staff add constraint oatccc_staff_role_check
  check (role in ('president', 'indoor_chair', 'ms_indoor_chair', 'clinic_chair', 'site_admin'));
alter table public.oatccc_staff add column if not exists updated_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- Who is asking
-- ---------------------------------------------------------------------------

create or replace function public.oatccc_staff_role()
returns text
language sql stable security definer
set search_path = public
as $$
  select role from public.oatccc_staff where user_id = auth.uid();
$$;

create or replace function public.oatccc_has_role(p_roles text[])
returns boolean
language sql stable security definer
set search_path = public
as $$
  select auth.uid() is not null
     and exists (select 1 from public.oatccc_staff where user_id = auth.uid() and role = any (p_roles));
$$;

-- Indoor verification access (used by every install/99 rule and policy).
create or replace function public.oatccc_is_staff()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.oatccc_has_role(array['president', 'indoor_chair', 'site_admin']);
$$;

create or replace function public.oatccc_can_manage_admins()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.oatccc_has_role(array['president', 'site_admin']);
$$;

-- Admins may see who the other admins are; everyone else only their own row.
drop policy if exists oatccc_staff_read on public.oatccc_staff;
create policy oatccc_staff_read on public.oatccc_staff
  for select to authenticated using (
    user_id = auth.uid()
    -- Through the security-definer helper: a policy on oatccc_staff that
    -- queried oatccc_staff directly would recurse.
    or public.oatccc_has_role(array['president', 'indoor_chair', 'ms_indoor_chair', 'clinic_chair', 'site_admin'])
  );

-- ---------------------------------------------------------------------------
-- Record of admin changes (permanent)
-- ---------------------------------------------------------------------------

create table if not exists public.oatccc_staff_events (
  id bigint generated always as identity primary key,
  action text not null check (action in ('added', 'role_changed', 'removed')),
  target_user_id uuid not null,
  target_name text not null,
  old_role text,
  new_role text,
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists oatccc_staff_events_created on public.oatccc_staff_events (created_at desc);

alter table public.oatccc_staff_events enable row level security;
drop policy if exists oatccc_staff_events_read on public.oatccc_staff_events;
create policy oatccc_staff_events_read on public.oatccc_staff_events
  for select to authenticated using (public.oatccc_can_manage_admins());
revoke all on public.oatccc_staff_events from anon, authenticated;
grant select on public.oatccc_staff_events to authenticated;

create or replace function public.oatccc_staff_events_permanent()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'OATCCC admin roles: the record of admin changes cannot be edited or deleted';
end;
$$;

drop trigger if exists oatccc_staff_events_permanent on public.oatccc_staff_events;
create trigger oatccc_staff_events_permanent
  before update or delete on public.oatccc_staff_events
  for each row execute function public.oatccc_staff_events_permanent();

-- ---------------------------------------------------------------------------
-- Guard on oatccc_staff: last site_admin, who may grant site_admin, record
-- ---------------------------------------------------------------------------

create or replace function public.oatccc_staff_guard()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_signed_in boolean := auth.uid() is not null;
  v_caller_site_admin boolean := public.oatccc_has_role(array['site_admin']);
  v_site_admins integer;
begin
  -- Removing or demoting a site_admin: never the last one, and when a
  -- person (not the database owner) does it, only another site_admin.
  if tg_op in ('UPDATE', 'DELETE') and old.role = 'site_admin'
     and (tg_op = 'DELETE' or new.role <> 'site_admin') then
    select count(*) into v_site_admins from public.oatccc_staff where role = 'site_admin';
    if v_site_admins <= 1 then
      raise exception 'OATCCC admin roles: the last site_admin cannot be removed or changed';
    end if;
    if v_signed_in and not v_caller_site_admin then
      raise exception 'OATCCC admin roles: only a site_admin can remove or change a site_admin' using errcode = '42501';
    end if;
  end if;

  -- Making someone a site_admin: only a site_admin (the database owner may
  -- add the first one; see the top of this file).
  if tg_op in ('INSERT', 'UPDATE') and new.role = 'site_admin'
     and (tg_op = 'INSERT' or old.role <> 'site_admin')
     and v_signed_in and not v_caller_site_admin then
    raise exception 'OATCCC admin roles: only a site_admin can make someone a site_admin' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    insert into public.oatccc_staff_events (action, target_user_id, target_name, old_role, new_role, actor_id)
    values ('added', new.user_id, new.display_name, null, new.role, auth.uid());
    return new;
  elsif tg_op = 'UPDATE' then
    if new.role <> old.role then
      insert into public.oatccc_staff_events (action, target_user_id, target_name, old_role, new_role, actor_id)
      values ('role_changed', new.user_id, new.display_name, old.role, new.role, auth.uid());
    end if;
    new.updated_at := now();
    return new;
  else
    insert into public.oatccc_staff_events (action, target_user_id, target_name, old_role, new_role, actor_id)
    values ('removed', old.user_id, old.display_name, old.role, null, auth.uid());
    return old;
  end if;
end;
$$;

drop trigger if exists oatccc_staff_guard on public.oatccc_staff;
create trigger oatccc_staff_guard
  before insert or update or delete on public.oatccc_staff
  for each row execute function public.oatccc_staff_guard();

-- ---------------------------------------------------------------------------
-- Managing admins (president or site_admin)
-- ---------------------------------------------------------------------------

-- Add an admin by the email of their existing sign-in account, or change
-- the role of an existing admin.
create or replace function public.oatccc_set_admin(p_email text, p_role text, p_display_name text)
returns public.oatccc_staff
language plpgsql security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_row public.oatccc_staff;
begin
  if not public.oatccc_can_manage_admins() then
    raise exception 'OATCCC admin roles: only the president or a site_admin can manage admins' using errcode = '42501';
  end if;
  if p_role not in ('president', 'indoor_chair', 'ms_indoor_chair', 'clinic_chair', 'site_admin') then
    raise exception 'OATCCC admin roles: unknown role %', p_role;
  end if;
  if p_display_name is null or length(btrim(p_display_name)) = 0 then
    raise exception 'OATCCC admin roles: give the admin a name';
  end if;
  select id into v_user from auth.users where lower(email) = lower(btrim(p_email));
  if v_user is null then
    raise exception 'OATCCC admin roles: there is no sign-in account for that email yet';
  end if;
  -- Update first, insert only if there is no row. (An insert ... on
  -- conflict would fire the insert trigger and record a false "added".)
  update public.oatccc_staff set role = p_role, display_name = btrim(p_display_name)
  where user_id = v_user
  returning * into v_row;
  if v_row.user_id is null then
    insert into public.oatccc_staff (user_id, display_name, role)
    values (v_user, btrim(p_display_name), p_role)
    returning * into v_row;
  end if;
  return v_row;
end;
$$;

create or replace function public.oatccc_remove_admin(p_user uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.oatccc_can_manage_admins() then
    raise exception 'OATCCC admin roles: only the president or a site_admin can manage admins' using errcode = '42501';
  end if;
  delete from public.oatccc_staff where user_id = p_user;
  if not found then
    raise exception 'OATCCC admin roles: that person is not an admin' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.oatccc_set_admin(text, text, text) from public, anon;
revoke all on function public.oatccc_remove_admin(uuid) from public, anon;
grant execute on function public.oatccc_set_admin(text, text, text) to authenticated;
grant execute on function public.oatccc_remove_admin(uuid) to authenticated;

commit;
