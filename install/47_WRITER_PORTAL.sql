-- Podium Watch Writer Portal -- Stage 1 schema
-- Purpose:
--   Accounts for intern writers (see docs/DECISIONS.md-style precedent:
--   this reuses real Supabase Auth, exactly like team accounts already do
--   -- lib/team_auth.mjs verifies a bearer token via
--   supabaseAdmin.auth.getUser(), NOT the site's separate shared admin
--   password (lib/admin_auth.mjs). A writer never touches that password;
--   an "editor" role can review submissions without ever holding it,
--   which is the whole point of having a separate role at all.
--
-- Safety:
--   RLS enforces the real boundary even though most reads/writes in this
--   codebase go through service-role API routes (matching every other
--   feature this session) -- kept as genuine defense in depth, and
--   because a writer's own draft autosave (Stage 2) may query directly.
--   A writer can only ever touch their own editable (draft/needs_revision)
--   articles; only 'published' articles are visible to anyone else.

begin;

create extension if not exists pgcrypto;

do $$ begin
  create type public.portal_user_role as enum ('writer', 'editor', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.portal_article_status as enum ('draft', 'submitted', 'needs_revision', 'approved', 'published', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.portal_article_category as enum ('race_recap', 'feature', 'rankings_polls', 'recruiting', 'other');
exception when duplicate_object then null; end $$;

-- One row per Supabase Auth user (auth.users), matching how team accounts
-- already relate a real login to a Podium Watch-specific profile row.
create table if not exists public.portal_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.portal_user_role not null default 'writer',
  full_name text not null default '',
  school text,
  grade text,
  bio text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portal_articles (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.portal_profiles(id) on delete cascade,
  title text not null default '',
  slug text unique,
  dek text,
  body jsonb not null default '{}'::jsonb,
  status public.portal_article_status not null default 'draft',
  category public.portal_article_category,
  tags text[] not null default '{}',
  featured_image_url text,
  photo_credit text,
  submitted_at timestamptz,
  scheduled_for timestamptz,
  published_at timestamptz,
  reviewed_by uuid references public.portal_profiles(id),
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portal_article_revisions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.portal_articles(id) on delete cascade,
  snapshot jsonb not null,
  status_at_snapshot public.portal_article_status not null,
  created_at timestamptz not null default now()
);

create table if not exists public.portal_editor_notes (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.portal_articles(id) on delete cascade,
  editor_id uuid not null references public.portal_profiles(id),
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists portal_articles_author_status_idx on public.portal_articles (author_id, status);
create index if not exists portal_articles_status_idx on public.portal_articles (status, updated_at desc);
create index if not exists portal_article_revisions_article_idx on public.portal_article_revisions (article_id, created_at desc);
create index if not exists portal_editor_notes_article_idx on public.portal_editor_notes (article_id, created_at desc);

-- Auto-create a writer profile whenever a new Supabase Auth user is
-- created (i.e. whenever a writer is invited). Promote to editor/admin by
-- hand -- see lib/writer_portal_service.mjs's setPortalRole().
create or replace function public.handle_new_portal_user()
returns trigger as $$
begin
  insert into public.portal_profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), 'writer')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created_portal on auth.users;
create trigger on_auth_user_created_portal
  after insert on auth.users
  for each row execute procedure public.handle_new_portal_user();

-- Reuses the same generic updated_at trigger function the recruiting
-- foundation tables already created (install/03).
drop trigger if exists portal_profiles_updated_at_trigger on public.portal_profiles;
create trigger portal_profiles_updated_at_trigger
before update on public.portal_profiles
for each row execute function public.set_recruiting_foundation_updated_at();

drop trigger if exists portal_articles_updated_at_trigger on public.portal_articles;
create trigger portal_articles_updated_at_trigger
before update on public.portal_articles
for each row execute function public.set_recruiting_foundation_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table public.portal_profiles enable row level security;
alter table public.portal_articles enable row level security;
alter table public.portal_article_revisions enable row level security;
alter table public.portal_editor_notes enable row level security;

-- Service role (every existing api/*.js route in this codebase) always
-- bypasses RLS -- these policies govern only a client using its own
-- Supabase Auth session, e.g. a future direct-from-browser draft autosave.
revoke all on table public.portal_profiles from anon, authenticated;
revoke all on table public.portal_articles from anon, authenticated;
revoke all on table public.portal_article_revisions from anon, authenticated;
revoke all on table public.portal_editor_notes from anon, authenticated;
grant select, insert, update on table public.portal_profiles to authenticated;
grant select, insert, update on table public.portal_articles to authenticated;
grant select, insert on table public.portal_article_revisions to authenticated;
grant select, insert on table public.portal_editor_notes to authenticated;
grant all on table public.portal_profiles to service_role;
grant all on table public.portal_articles to service_role;
grant all on table public.portal_article_revisions to service_role;
grant all on table public.portal_editor_notes to service_role;

-- Helper: is the current authenticated user staff (editor or admin)?
create or replace function public.portal_is_staff()
returns boolean as $$
  select exists (
    select 1 from public.portal_profiles
    where id = auth.uid() and role in ('editor', 'admin')
  );
$$ language sql security definer stable set search_path = public;

drop policy if exists "portal_profiles_select_own_or_staff" on public.portal_profiles;
create policy "portal_profiles_select_own_or_staff" on public.portal_profiles for select
  using (auth.uid() = id or public.portal_is_staff());

drop policy if exists "portal_profiles_update_own" on public.portal_profiles;
create policy "portal_profiles_update_own" on public.portal_profiles for update
  using (auth.uid() = id);

drop policy if exists "portal_profiles_update_staff" on public.portal_profiles;
create policy "portal_profiles_update_staff" on public.portal_profiles for update
  using (public.portal_is_staff());

drop policy if exists "portal_articles_select" on public.portal_articles;
create policy "portal_articles_select" on public.portal_articles for select
  using (
    author_id = auth.uid()
    or status = 'published'
    or public.portal_is_staff()
  );

drop policy if exists "portal_articles_insert_own" on public.portal_articles;
create policy "portal_articles_insert_own" on public.portal_articles for insert
  with check (author_id = auth.uid());

drop policy if exists "portal_articles_update_own_while_editable" on public.portal_articles;
create policy "portal_articles_update_own_while_editable" on public.portal_articles for update
  using (author_id = auth.uid() and status in ('draft', 'needs_revision'))
  with check (author_id = auth.uid());

drop policy if exists "portal_articles_update_staff" on public.portal_articles;
create policy "portal_articles_update_staff" on public.portal_articles for update
  using (public.portal_is_staff());

drop policy if exists "portal_revisions_select" on public.portal_article_revisions;
create policy "portal_revisions_select" on public.portal_article_revisions for select
  using (
    public.portal_is_staff()
    or exists (select 1 from public.portal_articles a where a.id = article_id and a.author_id = auth.uid())
  );

drop policy if exists "portal_revisions_insert_staff" on public.portal_article_revisions;
create policy "portal_revisions_insert_staff" on public.portal_article_revisions for insert
  with check (public.portal_is_staff());

drop policy if exists "portal_notes_select" on public.portal_editor_notes;
create policy "portal_notes_select" on public.portal_editor_notes for select
  using (
    public.portal_is_staff()
    or exists (select 1 from public.portal_articles a where a.id = article_id and a.author_id = auth.uid())
  );

drop policy if exists "portal_notes_insert_staff" on public.portal_editor_notes;
create policy "portal_notes_insert_staff" on public.portal_editor_notes for insert
  with check (public.portal_is_staff());

comment on table public.portal_profiles is 'One row per Writer Portal user (writer/editor/admin), 1:1 with auth.users. Not the same auth system as the site''s shared admin password (lib/admin_auth.mjs).';
comment on table public.portal_articles is 'Blog/article content written by intern writers, moving through the review workflow. Stage 1: accounts and profiles only, no article-writing UI yet.';

commit;
