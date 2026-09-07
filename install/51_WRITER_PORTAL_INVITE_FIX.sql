-- Podium Watch Writer Portal -- fix: only real writer invites get a
-- portal_profiles row
-- Purpose:
--   install/47's handle_new_portal_user() trigger fires on every insert
--   into auth.users, with no check on WHY that user was created. auth.
--   users is shared, real infrastructure across this whole site -- team
--   accounts already self-register through the exact same table
--   (lib/team_auth.mjs). That means the next real team signup would
--   silently also receive a portal_profiles row (role defaults to
--   'writer') and full access to /writer-portal/, despite never having
--   applied or been invited as a writer. Confirmed this hadn't happened
--   yet (only one portal_profiles row exists, created by hand for the
--   site owner) before fixing it.
--
-- Fix:
--   The trigger now only creates a profile when the new auth user's own
--   metadata explicitly says so (raw_user_meta_data->>'portal_invite' =
--   'true') -- set only by inviteWriter() in
--   lib/writer_portal_service.mjs, the new staff-only "Invite a writer"
--   action, which is the only path that should ever create a writer
--   account going forward. A plain team signup never sets this key, so
--   it never gets a profile. This replaces manually inviting through the
--   Supabase dashboard (which has no way to set custom metadata at
--   invite time in its basic UI, which is exactly why this couldn't be
--   fixed by just remembering to check a box there).
--
-- Safety:
--   Purely additive -- replaces one function's body, nothing dropped.
--   The 25 existing auth.users accounts (all pre-dating this fix,
--   none carrying the new metadata key) are unaffected either way: the
--   trigger only ever ran once, at each account's own creation.

begin;

create or replace function public.handle_new_portal_user()
returns trigger as $$
begin
  if coalesce(new.raw_user_meta_data->>'portal_invite', '') = 'true' then
    insert into public.portal_profiles (id, full_name, role)
    values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), 'writer')
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

commit;
