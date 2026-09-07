begin;

-- getPortalStats() originally fetched every portal_articles row (status,
-- view_count) and every portal_profiles row (role) with a plain,
-- unbounded select() and tallied status/role/total-views counts in
-- JavaScript. That's the exact shape that caused the 2026-08-31 vote-
-- undercounting incident (docs/DECISIONS.md): Supabase/PostgREST silently
-- caps an unbounded select at 1,000 rows, so once article/writer counts
-- passed 1,000 the staff stats view would have quietly started
-- undercounting with no error. Fixed in lib/writer_portal_service.mjs to
-- use real count("exact") aggregates per status/role instead of a
-- client-side tally. The one piece a count() can't express -- total
-- view count across every article -- needs a real SUM, hence this RPC.
create or replace function public.portal_total_article_views()
returns bigint as $$
  select coalesce(sum(view_count), 0)::bigint from public.portal_articles;
$$ language sql stable;

commit;
