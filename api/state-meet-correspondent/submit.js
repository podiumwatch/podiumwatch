import { createHmac } from "node:crypto";
import { submitStateMeetCorrespondentApplication } from "../../lib/state_meet_correspondent_service.mjs";
import { cleanAthleteText } from "../../lib/athlete_foundation_service.mjs";

// Public, unauthenticated endpoint: anyone can apply for the paid Podium
// Watch State Meet Media Correspondent role here without an account. This
// never accepts an applicant automatically and is never an OHSAA media
// credential -- see submitStateMeetCorrespondentApplication for the full
// safety story (always lands in the same hidden admin review queue,
// reviewed by hand in the Operations Center; Podium Watch submits only the
// person it selects through OHSAA's own credential process).

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
    "podium-watch-state-meet-correspondent-applications";

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
    await submitStateMeetCorrespondentApplication({
      firstName: body.first_name,
      lastName: body.last_name,
      email: body.email,
      phone: body.phone,
      college: body.college,
      major: body.major,
      collegeYear: body.college_year,
      is18OrOlder: body.is_18_or_older === true || body.is_18_or_older === "true",
      availableNov7: body.available_nov_7 === true || body.available_nov_7 === "true",
      availableFullDay: body.available_full_day === true || body.available_full_day === "true",
      interestReason: body.interest_reason,
      experience: body.experience,
      comfortableInterviewing: body.comfortable_interviewing === true || body.comfortable_interviewing === "true",
      comfortableVideo: body.comfortable_video === true || body.comfortable_video === "true",
      xcTrackFamiliarity: body.xc_track_familiarity,
      portfolioUrl: body.portfolio_url,
      linkedinUrl: body.linkedin_url,
      socialHandle: body.social_handle,
      videoUrl: body.video_url,
      otherUrl: body.other_url,
      additionalNotes: body.additional_notes,
      credentialAcknowledgement: body.credential_acknowledgement === true || body.credential_acknowledgement === "true",
      website: body.website,
      ipHash: addressHash(request)
    });

    return response.status(201).json({
      submitted: true,
      message: "Thanks for applying. Podium Watch will review your application and contact selected candidates using the email or phone number provided."
    });
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("State meet correspondent application submission error:", error);
    }

    return response.status(status).json({
      error: status < 500
        ? error.message
        : "This application could not be submitted. Please try again, or contact Podium Watch directly."
    });
  }
}
