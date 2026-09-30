import { createHmac } from "node:crypto";
import { requestPhotoUploadSlot } from "../../lib/photo_submissions_service.mjs";
import { cleanAthleteText } from "../../lib/athlete_foundation_service.mjs";

// Public, unauthenticated endpoint, step 1 of the upload path: hands the
// browser a short-lived signed URL to upload a client-compressed image
// (a preview or a pending-original -- the caller decides which, this
// endpoint just issues a slot) DIRECTLY to Supabase Storage. Called twice
// per photo. See public/scripts/submit-photos.js.

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The request is invalid.");
      error.status = 400;
      throw error;
    }
  }

  return request.body || {};
}

function clientAddress(request) {
  return cleanAthleteText(
    request.headers["x-forwarded-for"] ||
    request.socket?.remoteAddress ||
    "unknown",
    500
  ).split(",")[0].trim();
}

function addressHash(request) {
  const secret = process.env.VOTE_HASH_SECRET ||
    process.env.PODIUM_ADMIN_SESSION_SECRET ||
    "podium-watch-photo-submissions";

  return createHmac("sha256", secret)
    .update(clientAddress(request))
    .digest("hex");
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const body = parseBody(request);
    const result = await requestPhotoUploadSlot({
      fileName: body.file_name,
      ipHash: addressHash(request)
    });

    return response.status(200).json(result);
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Photo submission upload-slot error:", error);
    }

    return response.status(status).json({
      error: status < 500
        ? error.message
        : "An upload location could not be prepared. Please try again."
    });
  }
}
