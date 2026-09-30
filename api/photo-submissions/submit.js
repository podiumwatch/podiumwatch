import { createHmac } from "node:crypto";
import { createPhotoSubmission } from "../../lib/photo_submissions_service.mjs";
import { cleanAthleteText } from "../../lib/athlete_foundation_service.mjs";

// Public, unauthenticated endpoint, final step: records a submission AFTER
// the browser already uploaded every photo's preview + pending-original
// directly to Supabase Storage. No image bytes in this request -- just
// plain metadata and the storage keys the direct uploads used -- so this
// stays far under Vercel's 4.5 MB request body cap regardless of how many
// photos were submitted.

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The submission is invalid.");
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
    const result = await createPhotoSubmission({
      sourceType: body.source_type,
      submitterName: body.submitter_name,
      submitterEmail: body.submitter_email,
      submitterRole: body.submitter_role,
      creditName: body.credit_name,
      permissionConfirmed: body.permission_confirmed,
      permissionNote: body.permission_note,
      meetName: body.meet_name,
      meetDate: body.meet_date,
      schoolName: body.school_name,
      albumUrl: body.album_url,
      items: body.items,
      website: body.website,
      ipHash: addressHash(request)
    });

    return response.status(201).json({
      submitted: true,
      message: "Thank you. Podium Watch will review your submission."
    });
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Photo submission error:", error);
    }

    return response.status(status).json({
      error: status < 500
        ? error.message
        : "This submission could not be completed. Please try again, or contact Podium Watch directly."
    });
  }
}
