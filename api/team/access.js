import { supabaseAdmin } from "../../lib/supabase-admin.mjs";
import {
  requireTeamUser,
  teamApiError
} from "../../lib/team_auth.mjs";
import { writeTeamChange } from "../../lib/team_audit.mjs";

function cleanText(value, maxLength = 2000) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error(
        "The submitted team access request is invalid."
      );
      error.status = 400;
      throw error;
    }
  }

  return request.body || {};
}

function requireId(body, field, message) {
  const value = cleanText(body[field], 100);

  if (!value) {
    const error = new Error(message);
    error.status = 400;
    throw error;
  }

  return value;
}

async function requireOwner(userId, teamId) {
  const { data: membership, error } = await supabaseAdmin
    .from("team_members")
    .select("id, team_id, user_id, role, status, display_name")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .eq("role", "owner")
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!membership) {
    const permissionError = new Error(
      "Only an active team owner can manage team access."
    );
    permissionError.status = 403;
    throw permissionError;
  }

  const { data: team, error: teamError } = await supabaseAdmin
    .from("team_pages")
    .select("id, school_name, archived_at, suspended, merged_into_team_id")
    .eq("id", teamId)
    .maybeSingle();

  if (teamError) {
    throw teamError;
  }

  if (!team) {
    const notFound = new Error("Team profile not found.");
    notFound.status = 404;
    throw notFound;
  }

  if (team.archived_at || team.merged_into_team_id || team.suspended) {
    const unavailable = new Error(
      "Suspended, archived, or merged team profiles cannot change access."
    );
    unavailable.status = 409;
    throw unavailable;
  }

  return {
    membership,
    team
  };
}

async function getCounts(teamId) {
  const [memberResult, ownerResult] = await Promise.all([
    supabaseAdmin
      .from("team_members")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .eq("status", "active"),
    supabaseAdmin
      .from("team_members")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .eq("status", "active")
      .eq("role", "owner")
  ]);

  if (memberResult.error) {
    throw memberResult.error;
  }

  if (ownerResult.error) {
    throw ownerResult.error;
  }

  return {
    activeMembers: Number(memberResult.count) || 0,
    activeOwners: Number(ownerResult.count) || 0
  };
}

async function recalculateClaimedAt(teamId) {
  const counts = await getCounts(teamId);

  const { error } = await supabaseAdmin
    .from("team_pages")
    .update({
      claimed_at:
        counts.activeMembers > 0
          ? new Date().toISOString()
          : null
    })
    .eq("id", teamId);

  if (error) {
    throw error;
  }
}

async function approveClaim(user, body) {
  const teamId = requireId(
    body,
    "team_id",
    "Choose a team profile."
  );
  const claimId = requireId(
    body,
    "claim_id",
    "Choose an access request."
  );
  const role = cleanText(body.role, 40).toLowerCase();

  if (!["owner", "editor"].includes(role)) {
    const error = new Error("Choose owner or editor access.");
    error.status = 400;
    throw error;
  }

  const { team } = await requireOwner(user.id, teamId);

  const { data: claim, error: claimError } = await supabaseAdmin
    .from("team_claim_requests")
    .select("*")
    .eq("id", claimId)
    .eq("team_id", teamId)
    .eq("status", "pending")
    .maybeSingle();

  if (claimError) {
    throw claimError;
  }

  if (!claim) {
    const error = new Error(
      "This team access request is no longer pending."
    );
    error.status = 404;
    throw error;
  }

  const reviewNotes = cleanText(body.review_notes, 2000) ||
    "Approved by a team owner.";

  const { error: approvalError } = await supabaseAdmin.rpc(
    "team_approve_claim_v1",
    {
      p_claim_id: claimId,
      p_role: role,
      p_reviewer: user.email || user.id,
      p_review_notes: reviewNotes
    }
  );

  if (approvalError) {
    if (String(approvalError.message || "").includes("TEAM_CLAIM_NOT_PENDING")) {
      const error = new Error(
        "This team access request is no longer pending."
      );
      error.status = 409;
      throw error;
    }

    if (String(approvalError.message || "").includes("TEAM_PAGE_UNAVAILABLE")) {
      const error = new Error(
        "Archived or merged team profiles cannot receive new managers."
      );
      error.status = 409;
      throw error;
    }

    throw approvalError;
  }
  await writeTeamChange({
    teamId,
    actorType: "team_user",
    actorId: user.id,
    action: "owner_approve_team_claim",
    summary: `${claim.requester_name || claim.requester_email || "A user"} received ${role} access.`,
    changedFields: ["team_members", "claim_status"],
    metadata: {
      claim_id: claimId,
      user_id: claim.user_id,
      role,
      school_name: team.school_name
    }
  });

  return {
    approved: true,
    claim_id: claimId,
    role
  };
}

async function rejectClaim(user, body) {
  const teamId = requireId(
    body,
    "team_id",
    "Choose a team profile."
  );
  const claimId = requireId(
    body,
    "claim_id",
    "Choose an access request."
  );

  const { team } = await requireOwner(user.id, teamId);
  const { data: claim, error: claimError } = await supabaseAdmin
    .from("team_claim_requests")
    .select("id, user_id, requester_name, requester_email, status")
    .eq("id", claimId)
    .eq("team_id", teamId)
    .maybeSingle();

  if (claimError) {
    throw claimError;
  }

  if (!claim || claim.status !== "pending") {
    const error = new Error(
      "This team access request is no longer pending."
    );
    error.status = 404;
    throw error;
  }

  const { error } = await supabaseAdmin
    .from("team_claim_requests")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.email || user.id,
      review_notes: cleanText(body.review_notes, 2000) ||
        "Rejected by a team owner."
    })
    .eq("id", claimId);

  if (error) {
    throw error;
  }

  await writeTeamChange({
    teamId,
    actorType: "team_user",
    actorId: user.id,
    action: "owner_reject_team_claim",
    summary: `${claim.requester_name || claim.requester_email || "A user"}'s access request was rejected.`,
    changedFields: ["claim_status"],
    metadata: {
      claim_id: claimId,
      user_id: claim.user_id,
      school_name: team.school_name
    }
  });

  return {
    rejected: true,
    claim_id: claimId
  };
}

async function updateMember(user, body) {
  const teamId = requireId(
    body,
    "team_id",
    "Choose a team profile."
  );
  const memberId = requireId(
    body,
    "member_id",
    "Choose a team manager."
  );
  const role = cleanText(body.role, 40).toLowerCase();

  if (!["owner", "editor"].includes(role)) {
    const error = new Error("Choose owner or editor access.");
    error.status = 400;
    throw error;
  }

  await requireOwner(user.id, teamId);

  const { data: member, error: lookupError } = await supabaseAdmin
    .from("team_members")
    .select("*")
    .eq("id", memberId)
    .eq("team_id", teamId)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  if (!member) {
    const error = new Error("Team manager not found.");
    error.status = 404;
    throw error;
  }

  if (member.user_id === user.id) {
    const error = new Error(
      "Use another team owner or Podium Watch admin to change your own access."
    );
    error.status = 409;
    throw error;
  }

  if (member.status === "active" && member.role === "owner" && role !== "owner") {
    const counts = await getCounts(teamId);

    if (counts.activeOwners <= 1) {
      const error = new Error(
        "Promote another manager to owner before changing the final owner's role."
      );
      error.status = 409;
      throw error;
    }
  }

  const { data: updatedMember, error } = await supabaseAdmin
    .from("team_members")
    .update({
      role,
      status: "active"
    })
    .eq("id", memberId)
    .eq("team_id", teamId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await writeTeamChange({
    teamId,
    actorType: "team_user",
    actorId: user.id,
    action: "owner_update_team_member",
    summary: "A team manager's access role was updated.",
    changedFields: ["team_members"],
    beforeData: {
      role: member.role,
      status: member.status
    },
    afterData: {
      role: updatedMember.role,
      status: updatedMember.status
    },
    metadata: {
      member_id: memberId,
      user_id: member.user_id
    }
  });

  return {
    member: updatedMember
  };
}

async function removeMember(user, body) {
  const teamId = requireId(
    body,
    "team_id",
    "Choose a team profile."
  );
  const memberId = requireId(
    body,
    "member_id",
    "Choose a team manager."
  );

  await requireOwner(user.id, teamId);

  const { data: member, error: lookupError } = await supabaseAdmin
    .from("team_members")
    .select("*")
    .eq("id", memberId)
    .eq("team_id", teamId)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  if (!member) {
    const error = new Error("Team manager not found.");
    error.status = 404;
    throw error;
  }

  if (member.user_id === user.id) {
    const error = new Error(
      "Use another team owner or Podium Watch admin to remove your own access."
    );
    error.status = 409;
    throw error;
  }

  if (member.status === "active" && member.role === "owner") {
    const counts = await getCounts(teamId);

    if (counts.activeOwners <= 1) {
      const error = new Error(
        "Promote another manager to owner before removing the final owner."
      );
      error.status = 409;
      throw error;
    }
  }

  const { error } = await supabaseAdmin
    .from("team_members")
    .delete()
    .eq("id", memberId)
    .eq("team_id", teamId);

  if (error) {
    throw error;
  }

  await recalculateClaimedAt(teamId);
  await writeTeamChange({
    teamId,
    actorType: "team_user",
    actorId: user.id,
    action: "owner_remove_team_member",
    summary: "A team manager was removed by a team owner.",
    changedFields: ["team_members"],
    beforeData: {
      role: member.role,
      status: member.status
    },
    afterData: {
      deleted: true
    },
    metadata: {
      member_id: memberId,
      user_id: member.user_id
    }
  });

  return {
    removed: true,
    member_id: memberId
  };
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
    const user = await requireTeamUser(request);
    const body = parseBody(request);
    const action = cleanText(body.action, 80).toLowerCase();

    if (action === "approve_claim") {
      return response.status(200).json(
        await approveClaim(user, body)
      );
    }

    if (action === "reject_claim") {
      return response.status(200).json(
        await rejectClaim(user, body)
      );
    }

    if (action === "update_member") {
      return response.status(200).json(
        await updateMember(user, body)
      );
    }

    if (action === "remove_member") {
      return response.status(200).json(
        await removeMember(user, body)
      );
    }

    return response.status(400).json({
      error: "Choose a valid team access action."
    });
  } catch (error) {
    return teamApiError(
      response,
      error,
      "Unable to manage team access."
    );
  }
}
