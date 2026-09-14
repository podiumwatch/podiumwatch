import { requirePortalUser, getOrCreatePortalProfile, portalApiError } from "../../lib/portal_auth.mjs";
import { cleanAthleteText } from "../../lib/athlete_foundation_service.mjs";
import { isStaffRole } from "../../lib/writer_portal_service.mjs";
import { listBoardPosts, createBoardPost, createBoardReply, deleteBoardPost, deleteBoardReply } from "../../lib/writer_board_service.mjs";

// Team Board: any signed-in Writer Portal account (writer or staff) can
// read, post, and reply -- only delete is restricted (a post/reply's own
// author, or staff). Mixed-permissions in one file, same reasoning as
// api/portal/calendar.js: most actions here genuinely need no staff gate.

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
    const profile = await getOrCreatePortalProfile(user.id);
    const isStaff = isStaffRole(profile.role);
    const body = parseBody(request);
    const action = cleanAthleteText(body.action, 80).toLowerCase() || "list";
    let data;

    if (action === "list") {
      data = { posts: await listBoardPosts() };
    } else if (action === "create_post") {
      data = { post: await createBoardPost({ authorId: user.id, authorRole: profile.role, body: body.body }) };
    } else if (action === "create_reply") {
      data = { reply: await createBoardReply({ postId: body.post_id, authorId: user.id, authorRole: profile.role, body: body.body }) };
    } else if (action === "delete_post") {
      await deleteBoardPost({ postId: body.post_id, actorId: user.id, actorIsStaff: isStaff });
      data = { deleted: true };
    } else if (action === "delete_reply") {
      await deleteBoardReply({ replyId: body.reply_id, actorId: user.id, actorIsStaff: isStaff });
      data = { deleted: true };
    } else {
      const error = new Error("Unsupported Team Board action.");
      error.status = 400;
      throw error;
    }

    return response.status(200).json(data);
  } catch (error) {
    return portalApiError(response, error, "The Team Board request could not be completed.");
  }
}
