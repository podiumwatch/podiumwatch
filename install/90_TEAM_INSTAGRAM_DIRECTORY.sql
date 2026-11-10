-- Podium Watch: Team Instagram directory (WO-44)
-- Purpose:
--   More than one Instagram account per school, each with a label (Boys XC,
--   Girls XC, XC & Track, Boys Track, Girls Track, Athletics). Approved
--   accounts live in team_social_links (platform Instagram, label = one of
--   the six); team pages show every approved account with its label.
--   Submissions (public form at /teams/instagram/, bulk paste in admin)
--   keep using team_instagram_requests (install/81) and its pending ->
--   approve flow. This adds to each request:
--     label           which account this is (one of the six)
--     submitter_email optional, private: never shown publicly or exported
--     source          public | bulk | admin
--   and drops the requirement for an actor hash on admin bulk adds.
--
-- Safety: additive columns with checks; one NOT NULL relaxed. No rows are
-- changed or deleted.

begin;

alter table public.team_instagram_requests
  add column if not exists label text check (label is null or label in ('Boys XC', 'Girls XC', 'XC & Track', 'Boys Track', 'Girls Track', 'Athletics')),
  add column if not exists submitter_email text check (submitter_email is null or (char_length(submitter_email) <= 320 and submitter_email like '%@%')),
  add column if not exists source text not null default 'public' check (source in ('public', 'bulk', 'admin'));

alter table public.team_instagram_requests alter column actor_hash drop not null;

create index if not exists team_instagram_requests_status_index on public.team_instagram_requests (status, created_at);

commit;

-- Check after running:
-- select column_name from information_schema.columns
-- where table_name = 'team_instagram_requests' and column_name in ('label', 'submitter_email', 'source');
