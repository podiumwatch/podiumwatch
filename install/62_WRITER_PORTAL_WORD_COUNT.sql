begin;

-- Lets staff gauge how far along an intern's draft is from the Review
-- Queue list itself, without opening every one -- real request, 2026-09-14.
-- A real stored column (computed and saved every time the body is saved,
-- lib/writer_portal_service.mjs's updateOwnArticle()) rather than
-- re-parsing the full Tiptap body on every Review Queue load: the same
-- "precompute a real aggregate, don't re-derive from raw data on every
-- read" discipline this project already applies to vote counts (see
-- docs/DECISIONS.md, 2026-08-31). Defaults to 0 for the column itself;
-- every article that already exists before this migration gets its real
-- count backfilled once in a follow-up script (not by this migration),
-- since computing it means walking each row's actual Tiptap JSON in
-- JavaScript, not something plain SQL can do here.
alter table public.portal_articles
  add column if not exists word_count integer not null default 0;

commit;
