import { isAdminRequest } from "../../lib/admin_auth.mjs";
import { cleanAthleteText } from "../../lib/athlete_foundation_service.mjs";
import {
  listStateMeetCorrespondentApplications,
  reviewStateMeetCorrespondentApplication
} from "../../lib/state_meet_correspondent_service.mjs";
import { getPageViewCount } from "../../lib/engagement_service.mjs";

// The applicant-facing page's own path -- kept as one constant here
// rather than accepting an arbitrary path from the request body, since
// this admin endpoint has exactly one page it needs a count for.
const APPLICATION_PAGE_PATH = "/apply/state-meet-correspondent/";

// Admin-only management for State Meet Media Correspondent applications
// (see install/70, lib/state_meet_correspondent_service.mjs). Lists what's
// pending and records a review decision -- contacting an applicant and
// submitting the selected person through OHSAA's own media credential
// process both stay manual steps outside this system, using the contact
// info visible in the review queue.

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
      data = { applications: await listStateMeetCorrespondentApplications({ status: body.status }) };
    } else if (action === "view_count") {
      data = { view_count: await getPageViewCount(APPLICATION_PAGE_PATH) };
    } else if (action === "review") {
      data = { application: await reviewStateMeetCorrespondentApplication({
        applicationId: body.application_id,
        status: body.status,
        note: body.review_note
      }) };
    } else {
      fail("Unsupported state meet correspondent action.");
    }

    return response.status(200).json(data);
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("State meet correspondent admin error:", error);
    }

    return response.status(status).json({
      error: status < 500
        ? error.message
        : "The state meet correspondent request could not be completed."
    });
  }
}
