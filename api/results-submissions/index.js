import { createHmac } from "node:crypto";
import { createPublicResultsSubmission } from "../../lib/result_ingestion_engine.mjs";
import { cleanAthleteText } from "../../lib/athlete_foundation_service.mjs";

// Public, unauthenticated endpoint: any coach, timer, or meet host can
// submit raw results here without an admin account. This never imports or
// publishes anything directly -- see createPublicResultsSubmission for the
// full safety story (always a dry run, always lands in the same hidden
// admin review queue as every other import, tagged community trust rather
// than official-source trust).

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The results submission is invalid.");
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
    "podium-watch-results-submissions";

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
    const result = await createPublicResultsSubmission({
      meetName: body.meet_name,
      meetDate: body.meet_date,
      meetLocation: body.meet_location,
      sport: body.sport,
      seasonYear: Number(body.season_year),
      gender: body.gender,
      text: body.text,
      encoding: body.encoding,
      fileName: body.file_name,
      contentType: body.content_type,
      submitterName: body.submitter_name,
      submitterEmail: body.submitter_email,
      submitterOrganization: body.submitter_organization,
      note: body.note,
      website: body.website,
      ipHash: addressHash(request)
    });

    return response.status(201).json({
      submitted: true,
      rows_found: result.rows_found,
      message: result.rows_found
        ? `Thank you. Podium Watch found ${result.rows_found} result row${result.rows_found === 1 ? "" : "s"} and will review them before anything is published.`
        : "Thank you. Podium Watch received this submission, but could not automatically find result rows in it yet -- it will still be reviewed by hand."
    });
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Public results submission error:", error);
    }

    return response.status(status).json({
      error: status < 500
        ? error.message
        : "The results submission could not be completed. Please try again, or contact Podium Watch directly."
    });
  }
}
