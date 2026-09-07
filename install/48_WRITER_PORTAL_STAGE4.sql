-- Podium Watch Writer Portal -- Stage 4 schema
-- Purpose:
--   1. An atomic view-count increment for published articles (a plain
--      read-modify-write from application code would race under
--      concurrent readers; this pushes the +1 into the database so it's
--      safe regardless of how many requests land at once).
--   2. portal_story_ideas: a real, date-based editorial calendar. Staff
--      creates ideas (optionally assigning one to a specific writer, or
--      leaving it open); any signed-in writer can see the calendar and
--      claim an open idea; starting to write from an idea creates a real
--      portal_articles draft and links the two.

begin;

create or replace function public.increment_portal_article_view_count(p_article_id uuid)
returns void as $$
  update public.portal_articles
  set view_count = view_count + 1
  where id = p_article_id and status = 'published';
$$ language sql;

create table if not exists public.portal_story_ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category public.portal_article_category,
  target_date date,
  assigned_to uuid references public.portal_profiles(id) on delete set null,
  created_by uuid not null references public.portal_profiles(id),
  article_id uuid references public.portal_articles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portal_story_ideas_target_date_idx on public.portal_story_ideas (target_date);
create index if not exists portal_story_ideas_assigned_to_idx on public.portal_story_ideas (assigned_to);

drop trigger if exists portal_story_ideas_updated_at_trigger on public.portal_story_ideas;
create trigger portal_story_ideas_updated_at_trigger
before update on public.portal_story_ideas
for each row execute function public.set_recruiting_foundation_updated_at();

alter table public.portal_story_ideas enable row level security;
revoke all on table public.portal_story_ideas from anon, authenticated;
grant select, insert, update on table public.portal_story_ideas to authenticated;
grant all on table public.portal_story_ideas to service_role;

-- Any signed-in portal user can see the calendar (to find ideas to
-- claim); only staff can create/edit/delete. A writer claiming an open
-- idea, or the API linking it to a new draft, both go through the
-- service-role API layer, not a direct client write -- this select
-- policy is what actually matters here.
drop policy if exists "portal_story_ideas_select_any_portal_user" on public.portal_story_ideas;
create policy "portal_story_ideas_select_any_portal_user" on public.portal_story_ideas for select
  using (exists (select 1 from public.portal_profiles where id = auth.uid()));

drop policy if exists "portal_story_ideas_write_staff" on public.portal_story_ideas;
create policy "portal_story_ideas_write_staff" on public.portal_story_ideas for all
  using (public.portal_is_staff())
  with check (public.portal_is_staff());

comment on table public.portal_story_ideas is 'Editorial calendar: staff-created story ideas, optionally assigned to a writer and/or a target date, optionally linked to the portal_articles draft started from them.';

commit;
