-- Podium Watch Photographer Network -- Media Uploads
-- Purpose:
--   Let a signed-in photographer upload an actual image file for their
--   profile image or logo, instead of only being able to paste a URL to
--   an image already hosted somewhere else. The URL fields stay too --
--   a photographer who already has a hosted image can still paste its
--   address -- this migration just adds a place for an uploaded file to
--   live so its resulting address can be written into the same existing
--   public.photographers.profile_image_url / logo_url columns the rest
--   of the site already reads from. Exact same pattern as
--   install/08_TEAM_MEDIA_UPLOADS.sql for team logos/banners, applied to
--   photographers instead of teams -- see lib/photographer_media_service.mjs.
--
-- Storage:
--   Creates a public Supabase Storage bucket, "photographer-media",
--   public = true (these are public profile images, same reasoning as
--   the team-media bucket). Every upload still goes through
--   api/photographer/upload-media.js using the service-role client,
--   which bypasses Storage RLS entirely and enforces real ownership
--   (requirePhotographerOwnership) before ever touching Storage, so no
--   bucket policies are added here.
--
--   file_size_limit is 5 MB, matching team-media. allowed_mime_types is
--   a defense-in-depth check on top of the real validation, which
--   happens server-side by reading each file's own magic bytes rather
--   than trusting whatever content type the browser sent.
--
-- Safety:
--   Additive only. Creates a new storage bucket; does not create, alter,
--   or drop any table, column, or row.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photographer-media',
  'photographer-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
