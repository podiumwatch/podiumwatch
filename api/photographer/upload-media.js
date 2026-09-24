import {
  requirePhotographerUser,
  requirePhotographerOwnership,
  photographerApiError
} from "../../lib/photographer_auth.mjs";
import { submitPhotographerMediaUpload } from "../../lib/photographer_media_service.mjs";

// Lets a signed-in photographer upload an actual image file for their own
// listing's profile image or logo. This endpoint only validates, stores
// the file in the public "photographer-media" Supabase Storage bucket
// (see install/64_PHOTOGRAPHER_MEDIA_UPLOADS.sql), and returns the
// resulting public URL -- it never writes to public.photographers itself.
// The dashboard fills that URL into the same text field a photographer
// could otherwise paste a URL into by hand; the existing create/update
// actions in api/photographer/create.js / profile.js are what actually
// persist it. Mirrors api/team/upload-media.js exactly.

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The upload is invalid.");
      error.status = 400;
      throw error;
    }
  }

  return request.body || {};
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const user = await requirePhotographerUser(request);
    const body = parseBody(request);
    const photographerId = String(body.photographer_id || "").trim();

    if (!photographerId) {
      const error = new Error("Choose a photographer listing.");
      error.status = 400;
      throw error;
    }

    await requirePhotographerOwnership(user.id, photographerId);

    const result = await submitPhotographerMediaUpload({
      photographerId,
      field: String(body.field || "").trim(),
      content: body.content,
      encoding: body.encoding,
      fileName: body.file_name
    });

    return response.status(200).json({
      uploaded: true,
      url: result.url,
      field: result.field
    });
  } catch (error) {
    return photographerApiError(response, error, "The image could not be uploaded.");
  }
}
