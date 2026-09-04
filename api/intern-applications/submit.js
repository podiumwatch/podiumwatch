import { createHmac } from "node:crypto";
import { submitInternApplication } from "../../lib/intern_applications_service.mjs";
import { cleanAthleteText } from "../../lib/athlete_foundation_service.mjs";

// Public, unauthenticated endpoint: any high school student can apply to
// write for Podium Watch here without an account. This never accepts an
// applicant automatically -- see submitInternApplication for the full
// safety story (always lands in the same hidden admin review queue,
// reviewed by hand in the Operations Center).

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
    "podium-watch-intern-applications";

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
    const result = await submitInternApplication({
      fullName: body.full_name,
      email: body.email,
      phone: body.phone,
      school: body.school,
      grade: body.grade,
      parentName: body.parent_name,
      parentEmail: body.parent_email,
      parentConsent: body.parent_consent === true || body.parent_consent === "on" || body.parent_consent === "true",
      coverageInterests: body.coverage_interests,
      availability: body.availability,
      whyInterested: body.why_interested,
      writingSample: body.writing_sample,
      portfolioLink: body.portfolio_link,
      website: body.website,
      ipHash: addressHash(request)
    });

    return response.status(201).json({
      submitted: true,
      message: "Thanks for applying. Podium Watch will review this with a parent/guardian in the loop and follow up by email."
    });
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Intern application submission error:", error);
    }

    return response.status(status).json({
      error: status < 500
        ? error.message
        : "This application could not be submitted. Please try again, or contact Podium Watch directly."
    });
  }
}
