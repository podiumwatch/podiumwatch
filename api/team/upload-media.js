import {
  requireTeamUser,
  teamApiError
} from "../../lib/team_auth.mjs";
import {
  isAdminRequest
} from "../../lib/admin_auth.mjs";
import {
  submitTeamMediaUpload
} from "../../lib/team_media_service.mjs";
import {
  supabaseAdmin
} from "../../lib/supabase-admin.mjs";

// Lets a signed-in coach of a claimed team (or an admin) upload an actual
// image file for their team's logo or banner. This endpoint only validates,
// stores the file in the public "team-media" Supabase Storage bucket (see
// install/08_TEAM_MEDIA_UPLOADS.sql), and returns the resulting public URL --
// it never writes to public.team_pages itself. The team editor fills that
// URL into the same logo_url / banner_image_url text field a coach could
// otherwise paste a URL into by hand, and the existing "save" action in
// api/team/detail.js is what actually persists it, the same as any other
// profile edit. See docs/DECISIONS.md, 2026-08-06.

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The upload is invalid.");
      error.status = 400;
      throw error;
    }
  }

  return request.body || {};
}

async function requireMembership(userId, teamId) {
  const {
    data: membership,
    error
  } = await supabaseAdmin
    .from("team_members")
    .select("id, team_id, user_id, status")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!membership) {
    const permissionError = new Error(
      "You do not have permission to manage this team."
    );

    permissionError.status = 403;
    throw permissionError;
  }

  return membership;
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");

    return response.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    const adminMode = isAdminRequest(request);
    const user = adminMode ? null : await requireTeamUser(request);
    const body = parseBody(request);
    const teamId = String(body.team_id || "").trim();

    if (!teamId) {
      const error = new Error("Choose a team.");
      error.status = 400;
      throw error;
    }

    if (!adminMode) {
      await requireMembership(user.id, teamId);
    }

    const result = await submitTeamMediaUpload({
      teamId,
      field: String(body.field || "").trim(),
      content: body.content,
      encoding: body.encoding,
      fileName: body.file_name
    });

    return response.status(200).json({
      uploaded: true,
      url: result.url,
      field: result.field
    });
  } catch (error) {
    return teamApiError(
      response,
      error,
      "The image could not be uploaded."
    );
  }
}
