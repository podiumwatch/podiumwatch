import { createHmac } from "node:crypto";
import { requestTimingSubmissionUploadSlot } from "../../lib/timing_submissions_service.mjs";
import { cleanAthleteText } from "../../lib/athlete_foundation_service.mjs";

// Public, unauthenticated endpoint, step 1 of 2: hands the browser a
// short-lived signed URL to upload a results file DIRECTLY to Supabase
// Storage. Deliberately tiny request/response (no file bytes here) --
// Vercel Functions cap request bodies at 4.5 MB, well under this feature's
// real 25 MB file cap, so the file itself is never sent through this or
// any other serverless function. See submit.js (step 2) for what actually
// records the submission once the direct upload succeeds.

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
    const result = await requestTimingSubmissionUploadSlot({
      fileName: body.file_name,
      ipHash: addressHash(request)
    });

    return response.status(200).json(result);
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Timing submission upload-slot error:", error);
    }

    return response.status(status).json({
      error: status < 500
        ? error.message
        : "An upload location could not be prepared. Please try again."
    });
  }
}
