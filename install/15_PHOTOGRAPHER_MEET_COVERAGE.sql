-- Podium Watch Photographer Network -- Phase Three
-- Purpose:
--   Connects photographers to the real meets they cover: "who is
--   photographing this meet" before it happens, "where's the gallery"
--   after. Two new tables, both referencing the real `meets` table
--   (not created by any file in this repo -- see install/13's own note
--   on team_pages/team_athletes for the same situation. `meets` genuinely
--   exists in production Supabase; the `references public.meets(id)`
--   constraint below resolves against the live table regardless of
--   which migration originally created it).
--
-- Design notes:
--   - photographer_meet_coverage is deliberately lighter-weight than
--     photographer_galleries: self-published immediately by the
--     photographer (public_visible defaults true, no approval status),
--     since "I plan to be at this meet" carries essentially no risk.
--     unique(photographer_id, meet_id) -- one coverage row per meet,
--     updated in place rather than duplicated.
--   - photographer_galleries carries a real approval workflow
--     (status: pending_review/published/rejected, defaulting to
--     pending_review) -- an external URL posted under a real meet's
--     name is a meaningfully different risk than a coverage flag, so
--     it gets the more conservative, reversible choice: nothing is
--     public until an admin looks at it, matching this project's
--     existing photographer-listing approval pattern rather than
--     auto-publishing external links.
--   - Podium Watch never hosts or resells the photos themselves --
--     gallery_url always points to the photographer's own platform.
--
-- Safety:
--   Purely additive. Creates two new tables, alters nothing existing.

begin;

create extension if not exists pgcrypto;

create table if not exists public.photographer_meet_coverage (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  photographer_id uuid not null references public.photographers(id) on delete cascade,
  meet_id uuid not null references public.meets(id) on delete cascade,
  coverage_status text not null default 'planned' check (
    coverage_status in ('planned', 'confirmed', 'completed', 'cancelled')
  ),
  public_notes text,
  public_visible boolean not null default true,
  unique (photographer_id, meet_id)
);

create table if not exists public.photographer_galleries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  photographer_id uuid not null references public.photographers(id) on delete cascade,
  -- Nullable -- a photographer may want to post a gallery that isn't
  -- tied to one specific Podium Watch meet (a season highlight reel,
  -- for example).
  meet_id uuid references public.meets(id) on delete set null,
  title text not null,
  gallery_url text not null,
  status text not null default 'pending_review' check (
    status in ('pending_review', 'published', 'rejected')
  ),
  published_at timestamptz,
  public_visible boolean not null default true,
  admin_notes text
);

create index if not exists photographer_meet_coverage_photographer_index
  on public.photographer_meet_coverage (photographer_id);

create index if not exists photographer_meet_coverage_meet_index
  on public.photographer_meet_coverage (meet_id) where public_visible = true;

create index if not exists photographer_galleries_photographer_index
  on public.photographer_galleries (photographer_id);

create index if not exists photographer_galleries_meet_index
  on public.photographer_galleries (meet_id) where status = 'published';

create index if not exists photographer_galleries_status_index
  on public.photographer_galleries (status);

create or replace function public.set_photographer_coverage_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists photographer_meet_coverage_updated_at_trigger
  on public.photographer_meet_coverage;
create trigger photographer_meet_coverage_updated_at_trigger
before update on public.photographer_meet_coverage
for each row execute function public.set_photographer_coverage_updated_at();

drop trigger if exists photographer_galleries_updated_at_trigger
  on public.photographer_galleries;
create trigger photographer_galleries_updated_at_trigger
before update on public.photographer_galleries
for each row execute function public.set_photographer_coverage_updated_at();

alter table public.photographer_meet_coverage enable row level security;
alter table public.photographer_galleries enable row level security;

revoke all on table public.photographer_meet_coverage from anon, authenticated;
revoke all on table public.photographer_galleries from anon, authenticated;

grant all on table public.photographer_meet_coverage to service_role;
grant all on table public.photographer_galleries to service_role;

commit;
