import { isAdminRequest } from "../../lib/admin_auth.mjs";
import { cleanAthleteText } from "../../lib/athlete_foundation_service.mjs";
import {
  getTimingSubmissionDownloadUrl,
  listTimingSubmissions,
  reviewTimingSubmission
} from "../../lib/timing_submissions_service.mjs";

// Admin-only management for timing-company results submissions (see
// install/45, lib/timing_submissions_service.mjs). This never imports or
// publishes anything -- it only lists what's pending, hands back a
// short-lived signed download link for the admin to review the file
// themselves, and records a reviewed/rejected decision. Running an
// approved submission through the actual import pipeline stays a fully
// separate, manual step using the existing tools (e.g. /admin/meets/,
// /admin/recruiting/) -- exactly as asked for, not automated here.

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

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
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
    const action = cleanAthleteText(body.action, 80).toLowerCase() || "list";
    let data;

    if (action === "list") {
      data = { submissions: await listTimingSubmissions({ status: body.status }) };
    } else if (action === "get_download_url") {
      data = await getTimingSubmissionDownloadUrl(body.submission_id);
    } else if (action === "review") {
      data = { submission: await reviewTimingSubmission({
        submissionId: body.submission_id,
        status: body.status,
        note: body.review_note
      }) };
    } else {
      fail("Unsupported timing submissions action.");
    }

    return response.status(200).json(data);
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Timing submissions admin error:", error);
    }

    return response.status(status).json({
      error: status < 500
        ? error.message
        : "The timing submissions request could not be completed."
    });
  }
}
