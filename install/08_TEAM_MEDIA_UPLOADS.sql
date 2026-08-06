-- Podium Watch Team Media Uploads
-- Purpose:
--   Let a signed-in coach of a claimed team upload an actual image file for their
--   team's logo or banner, instead of only being able to paste a URL to an image
--   already hosted somewhere else. The URL field stays too -- a coach who already
--   has a hosted image can still paste its address -- this migration just adds a
--   place for an uploaded file to live so its resulting address can be written
--   into the same existing public.team_pages.logo_url / banner_image_url columns
--   the rest of the site already reads from. No new columns are needed for that
--   reason: the existing "save" action in api/team/detail.js already persists
--   whatever URL ends up in those two fields, uploaded or pasted.
--
-- Storage:
--   Creates a public Supabase Storage bucket, "team-media", following the exact
--   pattern install/05_RESULTS_INGESTION_ENGINE.sql already used to create the
--   "result-source-documents" bucket. That bucket is private, because it holds
--   internal audit copies of results documents nobody outside Podium Watch should
--   read directly. This one is the opposite case on purpose: it only ever holds
--   images meant to be shown on public team pages, so it is created with
--   public = true, which lets Supabase serve each uploaded file at a public URL
--   with no authentication -- matching how logo_url / banner_image_url are
--   already just plain public image addresses today. Nothing about upload access
--   depends on this flag: every upload still goes through
--   api/team/upload-media.js using the service-role client, which bypasses
--   Storage RLS entirely, so no bucket policies are added here.
--
--   file_size_limit is 5 MB (5 * 1024 * 1024 = 5242880 bytes), smaller than the
--   12 MB allowed for results documents, since this bucket only ever holds a
--   single logo or banner image, never a multi-page source document.
--   allowed_mime_types is a defense-in-depth belt-and-suspenders check on top of
--   the real validation, which happens server-side in
--   lib/team_media_service.mjs by reading each file's own magic bytes rather
--   than trusting whatever content type the browser happened to send.
--
-- Safety:
--   This migration is additive. It only creates a new storage bucket; it does not
--   create, alter, or drop any table, column, or row. Run this after every
--   earlier install/ migration that has already been run.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'team-media',
  'team-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
