import { requirePortalUser, getOrCreatePortalProfile, portalApiError } from "../../lib/portal_auth.mjs";
import { cleanAthleteText } from "../../lib/athlete_foundation_service.mjs";
import {
  isStaffRole,
  listStoryIdeas,
  createStoryIdea,
  updateStoryIdea,
  deleteStoryIdea,
  claimStoryIdea,
  startArticleFromIdea
} from "../../lib/writer_portal_service.mjs";

// Editorial calendar: mixed permissions in one file rather than a
// staff-only gate at the top, since a plain writer genuinely needs read
// access (to find ideas to claim) even though create/update/delete stay
// staff-only. Each action below enforces its own real requirement.

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

function requireStaff(profile) {
  if (!isStaffRole(profile.role)) {
    const error = new Error("Writer Portal staff access required.");
    error.status = 403;
    throw error;
  }
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const user = await requirePortalUser(request);
    const profile = await getOrCreatePortalProfile(user.id);
    const body = parseBody(request);
    const action = cleanAthleteText(body.action, 80).toLowerCase() || "list";
    let data;

    if (action === "list") {
      data = { ideas: await listStoryIdeas({
        from: body.from,
        to: body.to,
        viewerId: user.id,
        viewerIsStaff: isStaffRole(profile.role)
      }) };
    } else if (action === "create") {
      requireStaff(profile);
      data = { idea: await createStoryIdea({
        title: body.title,
        description: body.description,
        category: body.category,
        targetDate: body.target_date,
        assignedTo: body.assigned_to,
        createdBy: user.id
      }) };
    } else if (action === "update") {
      requireStaff(profile);
      data = { idea: await updateStoryIdea(body.idea_id, {
        title: body.title,
        description: body.description,
        category: body.category,
        targetDate: body.target_date,
        assignedTo: body.assigned_to
      }) };
    } else if (action === "delete") {
      requireStaff(profile);
      await deleteStoryIdea(body.idea_id);
      data = { deleted: true };
    } else if (action === "claim") {
      data = { idea: await claimStoryIdea({ ideaId: body.idea_id, writerId: user.id }) };
    } else if (action === "start_article") {
      data = { article: await startArticleFromIdea({ ideaId: body.idea_id, writerId: user.id }) };
    } else {
      const error = new Error("Unsupported Writer Portal calendar action.");
      error.status = 400;
      throw error;
    }

    return response.status(200).json(data);
  } catch (error) {
    return portalApiError(response, error, "The Writer Portal calendar request could not be completed.");
  }
}
