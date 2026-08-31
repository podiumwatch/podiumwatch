-- Podium Watch Weekly Awards Media Uploads
-- Purpose:
--   Athlete of the Week / Team of the Week nominations already carry a
--   photo_url a nominator can fill in, and finalists carry their own
--   image_url an admin can override before/after promoting -- but most
--   nominators never submit a photo, and pasting a URL to an already-hosted
--   image (e.g. a school logo) is real friction for an admin who doesn't
--   have one hosted anywhere yet. This migration adds a place for an
--   uploaded file to live so its resulting address can be written into the
--   very same photo_url / image_url text field, the same relationship
--   install/08_TEAM_MEDIA_UPLOADS.sql already established for team logos.
--   No new columns are needed for that reason: the existing
--   create_nomination / promote_nomination / update_finalist actions in
--   lib/awards_service.mjs already persist whatever URL ends up in those
--   fields, uploaded or pasted.
--
-- Storage:
--   Creates a public Supabase Storage bucket, "award-media", following the
--   exact pattern install/08 already used for "team-media". Public, because
--   it only ever holds images meant to be shown on public finalist/winner
--   cards -- matching how photo_url / image_url are already just plain
--   public image addresses today. Every upload goes through
--   api/admin/awards-upload-media.js using the service-role client, which
--   bypasses Storage RLS entirely, so no bucket policies are added here.
--
--   file_size_limit is 5 MB, same ceiling as team-media. allowed_mime_types
--   is a defense-in-depth belt-and-suspenders check on top of the real
--   validation, which happens server-side in lib/award_media_service.mjs by
--   reading each file's own magic bytes rather than trusting whatever
--   content type the browser happened to send.
--
-- Safety:
--   This migration is additive. It only creates a new storage bucket; it
--   does not create, alter, or drop any table, column, or row.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'award-media',
  'award-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
