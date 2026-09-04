import { createHmac } from "node:crypto";
import { submitRecruitingActivityTip } from "../../lib/recruiting_tips_service.mjs";
import { cleanAthleteText } from "../../lib/athlete_foundation_service.mjs";

// Public, unauthenticated endpoint: any athlete, coach, family member, or
// fan can report recruiting activity here without an account. This never
// creates or publishes a real athlete_recruiting_activity row directly --
// see submitRecruitingActivityTip for the full safety story (always lands
// in the same hidden admin review queue, matched to a real profile and
// promoted only by hand).

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
    "podium-watch-recruiting-activity-tips";

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
    const result = await submitRecruitingActivityTip({
      athleteName: body.athlete_name,
      schoolName: body.school_name,
      graduationYear: body.graduation_year,
      gender: body.gender,
      activityType: body.activity_type,
      collegeName: body.college_name,
      collegeDivision: body.college_division,
      activityDate: body.activity_date,
      notes: body.notes,
      sourceUrl: body.source_url,
      submitterName: body.submitter_name,
      submitterEmail: body.submitter_email,
      submitterRole: body.submitter_role,
      website: body.website,
      ipHash: addressHash(request)
    });

    return response.status(201).json({
      submitted: true,
      message: "Thank you. Podium Watch will review this before anything appears publicly."
    });
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Recruiting activity tip submission error:", error);
    }

    return response.status(status).json({
      error: status < 500
        ? error.message
        : "This submission could not be completed. Please try again, or contact Podium Watch directly."
    });
  }
}
