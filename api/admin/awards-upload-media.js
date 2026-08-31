import crypto from "node:crypto";
import { isAdminRequest } from "../../lib/admin_auth.mjs";
import { submitAwardImageUpload } from "../../lib/award_media_service.mjs";

// Lets a signed-in admin upload an actual image file (most often a school
// logo) for an Athlete of the Week / Team of the Week nomination or
// finalist photo, instead of only being able to paste a URL in by hand.
// Shaped like api/team/upload-media.js: this endpoint only validates and
// stores the file in the public "award-media" Supabase Storage bucket (see
// install/36_AWARD_MEDIA_UPLOADS.sql) and returns the resulting public
// URL -- it never writes to aotw_finalists/totw_finalists/nominations
// itself. The admin awards UI fills that URL into the same Photo URL text
// field an admin could otherwise paste a URL into, and the existing
// promote_nomination / update_finalist / create_nomination actions in
// api/admin/awards.js are what actually persist it.

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

  if (!isAdminRequest(request)) {
    return response.status(401).json({ error: "Podium Watch admin sign in required." });
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const body = parseBody(request);

    const result = await submitAwardImageUpload({
      type: body.type,
      recordId: body.record_id,
      content: body.content,
      encoding: body.encoding,
      fileName: body.file_name
    });

    return response.status(200).json({
      uploaded: true,
      url: result.url
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    const requestId = crypto.randomUUID();
    if (status >= 500) console.error("Award media upload error", { requestId, code: error?.code || null, message: error?.message || String(error) });

    return response.status(status).json({
      error: status < 500 ? error.message : `The image could not be uploaded. Request ${requestId}.`,
      request_id: requestId,
      code: error?.code || null
    });
  }
}
