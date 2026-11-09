-- Podium Watch 2026 Athlete, Team and Coach of the Year: voting (Part 2)
-- Purpose:
--   Adds finalists_published_at to yearly_award_categories. Finalists are
--   only shown publicly, and voting in a category only opens, once the
--   admin announces that category's finalists. This stops voting from
--   starting on a half-entered finalist list.
--
-- Votes:
--   Not stored in Postgres. Votes live in Redis under the yoty2026:
--   namespace (lib/yearly_awards_2026_votes.mjs), one per category per
--   browser token, so vote volume never writes Supabase rows.
--
-- Safety:
--   Additive only. One nullable column. Existing rows are untouched.

begin;

alter table public.yearly_award_categories
  add column if not exists finalists_published_at timestamptz;

commit;
