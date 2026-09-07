-- Podium Watch Writer Portal -- image uploads
-- Purpose:
--   The article editor's Image toolbar button, and the Featured Image
--   field, previously only accepted an already-hosted URL -- real
--   friction for a student writer with nowhere to host a photo. This adds
--   a place for an uploaded file to live.
--
-- Storage:
--   Public bucket (article images are meant to be publicly visible the
--   instant a piece is published), matching install/08 (team-media) and
--   install/36 (award-media)'s exact pattern for that part.
--
--   Deliberately NOT those two migrations' upload mechanism, though: both
--   upload through a server-side function using the service-role client,
--   meaning a file's bytes pass through a Vercel Function -- which caps
--   request bodies at 4.5 MB (confirmed against Vercel's own docs,
--   2026-09), already dangerously close to team-media/award-media's own
--   5 MB stated cap once base64 inflation is counted, a real,
--   pre-existing, still-unfixed issue flagged separately. This bucket
--   uses the same direct-to-Supabase-Storage signed-upload-URL pattern
--   install/45 (timing-submissions) already established instead -- the
--   file's bytes never pass through any serverless function at all, so
--   the real cap below is Storage's own, not Vercel's.
--
-- Safety:
--   Purely additive -- only creates a new storage bucket.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'writer-portal-images',
  'writer-portal-images',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
