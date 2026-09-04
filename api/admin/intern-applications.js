import { isAdminRequest } from "../../lib/admin_auth.mjs";
import { cleanAthleteText } from "../../lib/athlete_foundation_service.mjs";
import {
  listInternApplications,
  reviewInternApplication
} from "../../lib/intern_applications_service.mjs";

// Admin-only management for intern writer applications (see install/46,
// lib/intern_applications_service.mjs). Lists what's pending and records a
// reviewed/accepted/rejected decision -- following up with an applicant
// (and their parent/guardian) stays a manual step outside this system,
// using the contact info visible in the review queue.

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
      data = { applications: await listInternApplications({ status: body.status }) };
    } else if (action === "review") {
      data = { application: await reviewInternApplication({
        applicationId: body.application_id,
        status: body.status,
        note: body.review_note
      }) };
    } else {
      fail("Unsupported intern applications action.");
    }

    return response.status(200).json(data);
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Intern applications admin error:", error);
    }

    return response.status(status).json({
      error: status < 500
        ? error.message
        : "The intern applications request could not be completed."
    });
  }
}
