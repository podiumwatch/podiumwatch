begin;

-- Tracks whether an accepted intern applicant has already been sent the
-- "welcome to Podium Watch" email (rules, process, account setup link),
-- so the bulk send in the admin Interns tab never emails the same person
-- twice. Nullable -- null means "not yet welcomed", matching the same
-- convention as portal_articles.writer_notified_at.
alter table public.intern_applications
  add column if not exists welcomed_at timestamptz;

commit;
