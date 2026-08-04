import { supabaseAdmin } from "../../lib/supabase-admin.mjs";
import {
  requireTeamUser,
  teamApiError
} from "../../lib/team_auth.mjs";

function cleanText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error(
        "The submitted access request is invalid."
      );

      error.status = 400;
      throw error;
    }
  }

  return request.body || {};
}

function mapClaimError(error) {
  const message = String(
    error?.message || ""
  );

  if (
    message.includes(
      "TEAM_PAGE_UNAVAILABLE"
    )
  ) {
    const mapped = new Error(
      "This team page is unavailable."
    );

    mapped.status = 404;
    return mapped;
  }

  if (
    message.includes(
      "TEAM_ACCESS_ALREADY_ACTIVE"
    )
  ) {
    const mapped = new Error(
      "You already have access to this team."
    );

    mapped.status = 409;
    return mapped;
  }

  if (
    message.includes(
      "TEAM_CLAIM_ALREADY_PENDING"
    )
  ) {
    const mapped = new Error(
      "You already have a pending request for this team."
    );

    mapped.status = 409;
    return mapped;
  }

  return error;
}

export default async function handler(
  request,
  response
) {
  response.setHeader(
    "Cache-Control",
    "no-store"
  );

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");

    return response.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    const user =
      await requireTeamUser(request);

    const body = parseBody(request);

    const teamId = cleanText(
      body.team_id
    );

    const requesterRole = cleanText(
      body.requester_role
    );

    const requesterName =
      cleanText(body.requester_name) ||
      cleanText(
        user.user_metadata
          ?.display_name
      );

    if (!teamId) {
      const error = new Error(
        "Choose a team first."
      );

      error.status = 400;
      throw error;
    }

    if (!requesterName) {
      const error = new Error(
        "Your name is required."
      );

      error.status = 400;
      throw error;
    }

    if (!requesterRole) {
      const error = new Error(
        "Your relationship to the team is required."
      );

      error.status = 400;
      throw error;
    }

    const {
      data,
      error
    } = await supabaseAdmin.rpc(
      "claim_team_page_v3",
      {
        p_team_id: teamId,
        p_user_id: user.id,
        p_user_email:
          user.email || "",
        p_requester_name:
          requesterName,
        p_requester_role:
          requesterRole,
        p_message:
          cleanText(body.message) ||
          null
      }
    );

    if (error) {
      throw mapClaimError(error);
    }

    const accessGranted =
      data?.mode === "auto_approved";

    return response.status(
      accessGranted ? 201 : 202
    ).json({
      access_granted:
        accessGranted,
      status:
        accessGranted
          ? "approved"
          : "pending",
      claim_id:
        data?.claim_id || null,
      team_id:
        data?.team_id || teamId
    });
  } catch (error) {
    return teamApiError(
      response,
      error,
      "Unable to connect this team to your account."
    );
  }
}