import { requirePortalStaff, portalApiError } from "../../lib/portal_auth.mjs";
import { cleanAthleteText } from "../../lib/athlete_foundation_service.mjs";
import { listPortalWriters, setPortalRole, inviteWriter } from "../../lib/writer_portal_service.mjs";

// Staff-only (portal role editor/admin -- NOT the site's shared admin
// password): lists every Writer Portal account and lets staff change
// roles. Stage 1 stub for the future review queue -- see
// pw-portal/PLAN.md Stage 3.

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
    const { user } = await requirePortalStaff(request);
    const body = parseBody(request);
    const action = cleanAthleteText(body.action, 80).toLowerCase() || "list";
    let data;

    if (action === "list") {
      data = { writers: await listPortalWriters() };
    } else if (action === "invite") {
      data = await inviteWriter({ email: body.email, fullName: body.full_name, invitedBy: user.id });
    } else if (action === "set_role") {
      data = { writer: await setPortalRole({
        profileId: body.profile_id,
        role: cleanAthleteText(body.role, 20).toLowerCase(),
        actorId: user.id
      }) };
    } else {
      const error = new Error("Unsupported Writer Portal admin action.");
      error.status = 400;
      throw error;
    }

    return response.status(200).json(data);
  } catch (error) {
    return portalApiError(response, error, "The Writer Portal admin request could not be completed.");
  }
}
