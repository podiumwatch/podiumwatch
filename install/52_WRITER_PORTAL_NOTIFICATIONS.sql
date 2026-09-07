-- Podium Watch Writer Portal -- unify the "needs attention" signal
-- Purpose:
--   The dashboard banner only ever covered needs_revision -- a writer
--   got a signal for bad news but not good news (their piece was
--   approved or published). writer_notified_at tracks whether the
--   writer has actually SEEN an article since its last staff-initiated
--   status change: NULL means "there's a change they haven't seen yet";
--   every review-queue transition (approve/publish/archive/request
--   revision) clears it back to NULL, and simply opening that article
--   in the writer's own editor (getOwnArticle with includeNotes -- the
--   writer-facing detail fetch) stamps it seen again.
--
-- Safety:
--   Purely additive -- one nullable column, defaulting to now() for
--   every existing row so nothing pre-existing suddenly appears as a
--   fresh unseen update the moment this ships.

begin;

alter table public.portal_articles
  add column if not exists writer_notified_at timestamptz default now();

commit;
