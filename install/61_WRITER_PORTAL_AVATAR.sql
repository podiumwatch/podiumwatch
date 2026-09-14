begin;

-- A writer's own uploaded profile picture -- shown on Team Board next to
-- their posts/replies (staff post as "Podium Watch" with a fixed brand
-- logo instead, never a personal avatar -- see lib/writer_board_service.mjs).
-- Nullable: every existing profile has none yet and falls back to an
-- initial-letter circle client-side.
alter table public.portal_profiles
  add column if not exists avatar_url text;

commit;
