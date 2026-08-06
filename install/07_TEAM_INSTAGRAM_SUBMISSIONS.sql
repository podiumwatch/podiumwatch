-- Podium Watch Team Instagram Submissions
-- Purpose:
--   1. Let anyone submit or update a team's Instagram handle from the public team
--      page, with no login required -- separate from the existing coach-managed
--      instagram_url / team_social_links, which stay untouched and keep showing
--      whatever a claimed team's own coach has set.
--   2. Every accepted submission is validated automatically (handle format, a basic
--      blocklist, and confirmation that the handle resolves to a real Instagram
--      account) and takes effect immediately -- unlike almost everything else in
--      this project, there is no hidden-until-approved review step for this one
--      feature. Every change is still fully logged and instantly reversible.
--   3. Reuses the existing public.team_change_log table (and its writeTeamChange()
--      helper in lib/team_audit.mjs) as the change history this feature needs,
--      instead of creating a second, redundant history table. That table already
--      stores team_id, actor_type, actor_id (used here to hold a hashed submitter
--      address, never a raw IP, and never displayed publicly), action, summary,
--      changed_fields, before_data, after_data, and created_at -- exactly the
--      old value / new value / submitted_at / submitter identifier shape this
--      feature needs. See docs/DECISIONS.md, 2026-08-06, for the reasoning.
--
-- Safety:
--   This migration is additive. It only adds new nullable columns to the existing
--   public.team_pages table and one supporting index to the existing
--   public.team_change_log table. Neither table is created here -- both already
--   exist in this project's Supabase schema from before this repository's
--   install/ migration convention started, so this file intentionally never
--   issues a `create table` for either one. No existing column, row, or
--   constraint is changed or removed.
--   Run this after every earlier install/ migration that has already been run.

begin;

-- 1. The community-submitted handle itself (bare handle, no "@", no URL) and when
--    it was last changed by this feature specifically. Both start null: most teams
--    have never had a public submission yet.
alter table public.team_pages
  add column if not exists instagram_handle text,
  add column if not exists instagram_handle_updated_at timestamptz;

-- 2. Supports two query patterns this feature relies on:
--    a. Rate limiting -- "how many submissions has this hashed address made for
--       this team recently" (team_id, actor_type, actor_id, created_at).
--    b. The admin review page and the weekly digest -- "every Instagram change,
--       most recent first" (actor_type, created_at), filtered to this feature's
--       own action values so it never mixes in unrelated team change history.
create index if not exists team_change_log_instagram_lookup_index
  on public.team_change_log (team_id, actor_type, actor_id, created_at desc)
  where actor_type in ('public_instagram_submission', 'admin_instagram_revert');

commit;
