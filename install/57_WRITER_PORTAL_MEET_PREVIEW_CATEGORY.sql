begin;

-- Adds "Meet Preview" as a real Writer Portal article category, alongside
-- the original set from 47_WRITER_PORTAL.sql (race_recap, feature,
-- rankings_polls, recruiting, other). A meet preview (an upcoming race --
-- who's in it, what to watch for) is a distinct, common piece type from a
-- race recap (after the fact), so it belongs as its own category rather
-- than being lumped into "feature" or "other".
alter type public.portal_article_category add value if not exists 'meet_preview';

commit;
