begin;

-- Records the real Story path a published Writer Portal article was
-- synced to (content/stories/<slug>.md, committed via GitHub's Contents
-- API -- see lib/github_content_service.mjs), once that best-effort
-- sync succeeds. Nullable: an article published before this feature
-- existed, or one where the sync failed, simply has no synced_story_path
-- and keeps working exactly as it already does at its own standalone
-- /writer-portal/articles/?slug=... URL.
alter table public.portal_articles
  add column if not exists synced_story_path text;

commit;
