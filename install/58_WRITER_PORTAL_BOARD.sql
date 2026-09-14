begin;

-- Team Board: a shared post-and-reply board for the whole Writer Portal
-- team (writers and staff alike) -- built as the in-house alternative to
-- a group chat, after the user chose "build it into the Writer Portal"
-- over an external app. Anyone signed in can start a post or reply to
-- one; app-layer checks (lib/writer_board_service.mjs) enforce that only
-- a post/reply's own author (or staff) can delete it, matching this
-- project's established pattern of enforcing permissions in application
-- code through the service-role client rather than RLS policies (see
-- install/56, install/57 -- the same lighter pattern already used for
-- every other Writer Portal table added this same arc).
create table if not exists public.portal_board_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.portal_profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portal_board_posts_created_at_idx
  on public.portal_board_posts (created_at desc);

create table if not exists public.portal_board_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.portal_board_posts(id) on delete cascade,
  author_id uuid not null references public.portal_profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists portal_board_replies_post_id_idx
  on public.portal_board_replies (post_id, created_at);

commit;
