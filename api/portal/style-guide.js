import { requirePortalUser, getOrCreatePortalProfile, portalApiError } from "../../lib/portal_auth.mjs";
import { cleanAthleteText } from "../../lib/athlete_foundation_service.mjs";
import { isStaffRole, getStyleGuide, updateStyleGuide } from "../../lib/writer_portal_service.mjs";

// Mixed permissions, matching api/portal/calendar.js's approach: any
// signed-in portal user can read the style guide; only staff can edit it.

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

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const user = await requirePortalUser(request);
    const body = parseBody(request);
    const action = cleanAthleteText(body.action, 80).toLowerCase() || "get";
    let data;

    if (action === "get") {
      data = { style_guide: await getStyleGuide() };
    } else if (action === "update") {
      const profile = await getOrCreatePortalProfile(user.id);
      if (!isStaffRole(profile.role)) {
        const error = new Error("Writer Portal staff access required.");
        error.status = 403;
        throw error;
      }
      data = { style_guide: await updateStyleGuide({ body: body.body, updatedBy: user.id }) };
    } else {
      const error = new Error("Unsupported request.");
      error.status = 400;
      throw error;
    }

    return response.status(200).json(data);
  } catch (error) {
    return portalApiError(response, error, "The style guide request could not be completed.");
  }
}
