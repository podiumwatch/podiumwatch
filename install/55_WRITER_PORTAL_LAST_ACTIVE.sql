begin;

-- Supabase's own account metadata turned out not to answer "did this
-- person actually finish setting up / are they actively using their
-- account" -- encrypted_password is never exposed via any API, even
-- service-role, and last_sign_in_at can't distinguish a one-time
-- recovery-link click from a real return visit. Tracked properly in
-- the app's own data instead: stamped on every authenticated Writer
-- Portal request (lib/portal_auth.mjs's requirePortalUser(), the one
-- choke point every action already goes through), so it reflects real
-- use of the portal, not an auth-provider implementation detail.
alter table public.portal_profiles
  add column if not exists last_active_at timestamptz;

commit;
