import { createHmac } from "node:crypto";
import { submitTimingResults } from "../../lib/timing_submissions_service.mjs";
import { cleanAthleteText } from "../../lib/athlete_foundation_service.mjs";

// Public, unauthenticated endpoint, step 2 of 2: records a submission
// AFTER the browser already uploaded the file directly to Supabase Storage
// via request-upload.js's signed URL. No file bytes in this request either
// -- just plain metadata (meet info, contact, and the storage key the
// direct upload used) -- so this stays far under Vercel's 4.5 MB request
// body cap regardless of how large the actual file was. This never
// parses, matches, or imports anything -- see submitTimingResults for the
// full safety story (always lands hidden, for an admin to review and
// import by hand).

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
    "podium-watch-timing-submissions";

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
    const result = await submitTimingResults({
      meetName: body.meet_name,
      meetDate: body.meet_date,
      divisionLevel: body.division_level,
      timingCompanyName: body.timing_company_name,
      submitterEmail: body.submitter_email,
      storageKey: body.storage_key,
      fileName: body.file_name,
      contentType: body.content_type,
      fileSizeBytes: body.file_size_bytes,
      website: body.website,
      ipHash: addressHash(request)
    });

    return response.status(201).json({
      submitted: true,
      message: "Thank you. Podium Watch will review this results file before it's processed."
    });
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Timing submission error:", error);
    }

    return response.status(status).json({
      error: status < 500
        ? error.message
        : "This submission could not be completed. Please try again, or contact Podium Watch directly."
    });
  }
}
