import { supabaseAdmin } from "../../lib/supabase-admin.mjs";
import { isAdminRequest } from "../../lib/admin_auth.mjs";
import {
  calculateTeamCompletion,
  getPublishedContentSignals,
  getChangedFields,
  pickTeamFields,
  writeTeamChange
} from "../../lib/team_audit.mjs";

const MAX_RESULTS = 2000;
const ADMIN_ID = "Podium Watch Admin";
const TEAM_STATUS_FIELDS = new Set([
  "published",
  "verified",
  "suspended",
  "editing_locked"
]);

const STATUS_AUDIT_FIELDS = [
  "published",
  "verified",
  "suspended",
  "editing_locked",
  "editing_locked_at",
  "editing_locked_by",
  "editing_lock_reason",
  "archived_at",
  "archived_by",
  "archived_reason",
  "merged_into_team_id"
];

function cleanText(value, maxLength = 1000) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function cleanSearch(value) {
  return cleanText(value, 120)
    .replace(/[^a-z0-9'&\s-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanEmail(value) {
  const email = cleanText(value, 320).toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const error = new Error("Enter a valid team account email address.");
    error.status = 400;
    throw error;
  }

  return email;
}

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The submitted Team Manager request is invalid.");
      error.status = 400;
      throw error;
    }
  }

  return request.body || {};
}

function requireTeamId(body, field = "team_id") {
  const teamId = cleanText(body[field], 100);

  if (!teamId) {
    const error = new Error("Choose a team profile.");
    error.status = 400;
    throw error;
  }

  return teamId;
}

async function writeAudit({
  action,
  teamId = null,
  details = {}
}) {
  try {
    const { error } = await supabaseAdmin
      .from("team_admin_audit_log")
      .insert({
        admin_identifier: ADMIN_ID,
        action,
        team_id: teamId,
        details
      });

    if (error) {
      console.error("Unable to write team admin audit record:", error);
    }
  } catch (error) {
    console.error("Unable to write team admin audit record:", error);
  }
}

async function loadTeam(teamId) {
  const { data, error } = await supabaseAdmin
    .from("team_pages")
    .select("*")
    .eq("id", teamId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    const notFound = new Error("Team profile not found.");
    notFound.status = 404;
    throw notFound;
  }

  return data;
}

async function loadActiveCounts(teamIds) {
  const memberCounts = new Map();
  const ownerCounts = new Map();
  const reportCounts = new Map();
  const claimCounts = new Map();
  // Same bulk existence check as api/teams/index.js's public directory
  // -- whether calculateTeamCompletion()'s roster/schedule signals are
  // present, without a query per team.
  const scheduledTeamIds = new Set();
  const rosteredTeamIds = new Set();

  if (teamIds.length === 0) {
    return {
      memberCounts,
      ownerCounts,
      reportCounts,
      claimCounts,
      scheduledTeamIds,
      rosteredTeamIds
    };
  }

  const chunks = [];

  for (let index = 0; index < teamIds.length; index += 200) {
    chunks.push(teamIds.slice(index, index + 200));
  }

  for (const chunk of chunks) {
    const [memberResult, reportResult, claimResult, scheduleResult, rosterResult] = await Promise.all([
      supabaseAdmin
        .from("team_members")
        .select("team_id, role")
        .in("team_id", chunk)
        .eq("status", "active"),
      supabaseAdmin
        .from("team_reports")
        .select("team_id, status")
        .in("team_id", chunk)
        .in("status", ["open", "reviewing"]),
      supabaseAdmin
        .from("team_claim_requests")
        .select("team_id, status")
        .in("team_id", chunk)
        .eq("status", "pending"),
      supabaseAdmin
        .from("team_meet_connections")
        .select("team_id")
        .in("team_id", chunk)
        .eq("published", true),
      supabaseAdmin
        .from("team_seasons")
        .select("team_id")
        .in("team_id", chunk)
        .in("status", ["published", "archived"])
    ]);

    if (memberResult.error) {
      throw memberResult.error;
    }

    if (reportResult.error) {
      throw reportResult.error;
    }

    if (claimResult.error) {
      throw claimResult.error;
    }

    if (scheduleResult.error) {
      throw scheduleResult.error;
    }

    if (rosterResult.error) {
      throw rosterResult.error;
    }

    (memberResult.data || []).forEach((member) => {
      memberCounts.set(
        member.team_id,
        (memberCounts.get(member.team_id) || 0) + 1
      );

      if (member.role === "owner") {
        ownerCounts.set(
          member.team_id,
          (ownerCounts.get(member.team_id) || 0) + 1
        );
      }
    });

    (reportResult.data || []).forEach((report) => {
      reportCounts.set(
        report.team_id,
        (reportCounts.get(report.team_id) || 0) + 1
      );
    });

    (claimResult.data || []).forEach((claim) => {
      claimCounts.set(
        claim.team_id,
        (claimCounts.get(claim.team_id) || 0) + 1
      );
    });

    (scheduleResult.data || []).forEach((row) => scheduledTeamIds.add(row.team_id));
    (rosterResult.data || []).forEach((row) => rosteredTeamIds.add(row.team_id));
  }

  return {
    memberCounts,
    ownerCounts,
    reportCounts,
    scheduledTeamIds,
    rosteredTeamIds,
    claimCounts
  };
}

async function listTeams(body) {
  const search = cleanSearch(body.search);
  const status = cleanText(
    body.status,
    40
  ).toLowerCase();
  const origin = cleanText(
    body.origin,
    40
  ).toLowerCase();
  const claimStatus = cleanText(
    body.claim_status,
    40
  ).toLowerCase();
  const pageSize = 1000;
  const teams = [];
  let totalCount = null;

  const selectFields = `
    id,
    created_at,
    updated_at,
    school_name,
    slug,
    mascot,
    city,
    state,
    conference,
    region,
    program_level,
    program_scope,
    profile_origin,
    source_name,
    source_school_id,
    published,
    verified,
    suspended,
    editing_locked,
    editing_lock_reason,
    archived_at,
    archived_reason,
    merged_into_team_id,
    claimed_at,
    imported_at,
    logo_url,
    banner_image_url,
    description,
    athletics_url,
    website_url,
    public_contact_email,
    head_coach,
    head_boys_coach,
    head_girls_coach
  `;

  function buildQuery(start, end, includeCount) {
    let query = supabaseAdmin
      .from("team_pages")
      .select(
        selectFields,
        includeCount
          ? { count: "exact" }
          : undefined
      )
      .order("school_name", {
        ascending: true
      })
      .range(start, end);

    if (search) {
      const pattern = `%${search}%`;

      query = query.or(
        [
          `school_name.ilike.${pattern}`,
          `city.ilike.${pattern}`,
          `mascot.ilike.${pattern}`,
          `conference.ilike.${pattern}`,
          `slug.ilike.${pattern}`
        ].join(",")
      );
    }

    if (status === "published") {
      query = query
        .eq("published", true)
        .eq("suspended", false)
        .is("archived_at", null)
        .is("merged_into_team_id", null);
    } else if (status === "draft") {
      query = query
        .eq("published", false)
        .eq("suspended", false)
        .is("archived_at", null)
        .is("merged_into_team_id", null);
    } else if (status === "suspended") {
      query = query
        .eq("suspended", true)
        .is("archived_at", null)
        .is("merged_into_team_id", null);
    } else if (status === "locked") {
      query = query
        .eq("editing_locked", true)
        .is("archived_at", null)
        .is("merged_into_team_id", null);
    } else if (status === "archived") {
      query = query
        .not("archived_at", "is", null)
        .is("merged_into_team_id", null);
    } else if (status === "merged") {
      query = query.not(
        "merged_into_team_id",
        "is",
        null
      );
    }

    if (
      [
        "coach_created",
        "admin_created",
        "admin_import"
      ].includes(origin)
    ) {
      query = query.eq(
        "profile_origin",
        origin
      );
    }

    if (claimStatus === "claimed") {
      query = query.not(
        "claimed_at",
        "is",
        null
      );
    } else if (
      claimStatus === "unclaimed"
    ) {
      query = query.is(
        "claimed_at",
        null
      );
    }

    return query;
  }

  for (
    let start = 0;
    start < MAX_RESULTS;
    start += pageSize
  ) {
    const end = Math.min(
      start + pageSize - 1,
      MAX_RESULTS - 1
    );
    const {
      data,
      error,
      count
    } = await buildQuery(
      start,
      end,
      start === 0
    );

    if (error) {
      throw error;
    }

    if (start === 0) {
      totalCount = Number.isFinite(
        Number(count)
      )
        ? Number(count)
        : null;
    }

    const page = Array.isArray(data)
      ? data
      : [];
    teams.push(...page);

    if (page.length < pageSize) {
      break;
    }
  }

  const ids = teams.map(
    (team) => team.id
  );
  const counts = await loadActiveCounts(ids);

  return {
    teams: teams.map((team) => ({
      ...team,
      active_member_count:
        counts.memberCounts.get(
          team.id
        ) || 0,
      owner_count:
        counts.ownerCounts.get(
          team.id
        ) || 0,
      open_report_count:
        counts.reportCounts.get(
          team.id
        ) || 0,
      pending_claim_count:
        counts.claimCounts.get(
          team.id
        ) || 0,
      completion_score:
        calculateTeamCompletion(team, [], {
          hasPublishedSchedule: counts.scheduledTeamIds.has(team.id),
          hasPublishedRoster: counts.rosteredTeamIds.has(team.id)
        })
    })),
    count: totalCount ?? teams.length,
    limited:
      totalCount !== null &&
      totalCount > MAX_RESULTS
  };
}

async function listClaims(body) {
  const requestedStatus = cleanText(body.status, 40).toLowerCase();
  const statuses = new Set(["pending", "approved", "rejected"]);
  const status = statuses.has(requestedStatus) ? requestedStatus : "pending";

  const { data: claims, error: claimError } = await supabaseAdmin
    .from("team_claim_requests")
    .select(
      `
        id,
        team_id,
        user_id,
        requested_school_name,
        requested_city,
        requester_name,
        requester_email,
        requester_role,
        message,
        status,
        created_at,
        reviewed_at,
        reviewed_by,
        review_notes
      `
    )
    .eq("status", status)
    .order("created_at", { ascending: status === "pending" })
    .limit(500);

  if (claimError) {
    throw claimError;
  }

  const teamIds = [
    ...new Set((claims || []).map((claim) => claim.team_id).filter(Boolean))
  ];
  const teamById = new Map();

  if (teamIds.length > 0) {
    const { data: teams, error: teamError } = await supabaseAdmin
      .from("team_pages")
      .select("id, school_name, city, state, slug, suspended, archived_at")
      .in("id", teamIds);

    if (teamError) {
      throw teamError;
    }

    (teams || []).forEach((team) => teamById.set(team.id, team));
  }

  return (claims || []).map((claim) => ({
    ...claim,
    team: teamById.get(claim.team_id) || null
  }));
}

async function listReports(body) {
  const requestedStatus = cleanText(body.status, 40).toLowerCase();
  const allowed = new Set(["open", "reviewing", "resolved", "dismissed", "active"]);
  const status = allowed.has(requestedStatus) ? requestedStatus : "active";

  let query = supabaseAdmin
    .from("team_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (status === "active") {
    query = query.in("status", ["open", "reviewing"]);
  } else {
    query = query.eq("status", status);
  }

  const { data: reports, error } = await query;

  if (error) {
    throw error;
  }

  const teamIds = [
    ...new Set((reports || []).map((report) => report.team_id).filter(Boolean))
  ];
  const teamById = new Map();

  if (teamIds.length > 0) {
    const { data: teams, error: teamError } = await supabaseAdmin
      .from("team_pages")
      .select("id, school_name, city, state, slug, archived_at")
      .in("id", teamIds);

    if (teamError) {
      throw teamError;
    }

    (teams || []).forEach((team) => teamById.set(team.id, team));
  }

  return (reports || []).map((report) => ({
    ...report,
    team: teamById.get(report.team_id) || null
  }));
}

async function getTeamDetails(body) {
  const teamId = requireTeamId(body);
  const team = await loadTeam(teamId);

  const [memberResult, claimResult, reportResult, historyResult, socialResult] = await Promise.all([
    supabaseAdmin
      .from("team_members")
      .select("id, team_id, user_id, role, status, display_name, created_at, updated_at")
      .eq("team_id", teamId)
      .order("role", { ascending: true })
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("team_claim_requests")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("team_reports")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("team_change_log")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(150),
    supabaseAdmin
      .from("team_social_links")
      .select("id, platform, label, url, published, verified")
      .eq("team_id", teamId)
      .order("sort_order", { ascending: true })
  ]);

  for (const result of [memberResult, claimResult, reportResult, historyResult, socialResult]) {
    if (result.error) {
      throw result.error;
    }
  }

  const members = await Promise.all(
    (memberResult.data || []).map(async (member) => {
      try {
        const { data, error } = await supabaseAdmin.auth.admin.getUserById(
          member.user_id
        );

        if (error) {
          throw error;
        }

        return {
          ...member,
          email: data.user?.email || "",
          confirmed: Boolean(
            data.user?.email_confirmed_at || data.user?.confirmed_at
          ),
          account_display_name:
            data.user?.user_metadata?.display_name ||
            data.user?.user_metadata?.full_name ||
            ""
        };
      } catch {
        return {
          ...member,
          email: "",
          confirmed: false,
          account_display_name: ""
        };
      }
    })
  );

  const contentSignals = await getPublishedContentSignals(teamId);

  return {
    team: {
      ...team,
      completion_score: calculateTeamCompletion(team, socialResult.data || [], contentSignals)
    },
    members,
    claims: claimResult.data || [],
    reports: reportResult.data || [],
    history: historyResult.data || [],
    social_links: socialResult.data || []
  };
}

async function approveClaim(body) {
  const claimId = cleanText(body.claim_id, 100);
  const role = cleanText(body.role, 40).toLowerCase();

  if (!claimId) {
    const error = new Error("Choose a claim request.");
    error.status = 400;
    throw error;
  }

  if (!["owner", "editor"].includes(role)) {
    const error = new Error("Choose owner or editor access.");
    error.status = 400;
    throw error;
  }

  const { data: claim, error: claimError } = await supabaseAdmin
    .from("team_claim_requests")
    .select("*")
    .eq("id", claimId)
    .eq("status", "pending")
    .maybeSingle();

  if (claimError) {
    throw claimError;
  }

  if (!claim) {
    const error = new Error("This claim request is no longer pending.");
    error.status = 404;
    throw error;
  }

  const team = await loadTeam(claim.team_id);

  if (team.archived_at || team.merged_into_team_id) {
    const error = new Error("Archived or merged team profiles cannot receive new managers.");
    error.status = 409;
    throw error;
  }

  const claimMemberCounts = await getTeamMemberCounts(claim.team_id);

  if (role === "editor" && claimMemberCounts.activeOwners === 0) {
    const error = new Error(
      "This team does not have an owner. Approve this request as an owner first."
    );
    error.status = 409;
    throw error;
  }

  const reviewNotes = cleanText(body.review_notes, 2000) || "Approved by Podium Watch admin.";

  const { error: approvalError } = await supabaseAdmin.rpc(
    "team_approve_claim_v1",
    {
      p_claim_id: claim.id,
      p_role: role,
      p_reviewer: ADMIN_ID,
      p_review_notes: reviewNotes
    }
  );

  if (approvalError) {
    if (String(approvalError.message || "").includes("TEAM_CLAIM_NOT_PENDING")) {
      const error = new Error("This claim request is no longer pending.");
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

  await writeAudit({
    action: "approve_team_claim",
    teamId: claim.team_id,
    details: { claim_id: claim.id, user_id: claim.user_id, role }
  });

  await writeTeamChange({
    teamId: claim.team_id,
    actorType: "admin",
    actorId: ADMIN_ID,
    action: "approve_team_claim",
    summary: `${claim.requester_name || claim.requester_email || "A user"} received ${role} access.`,
    changedFields: ["team_members", "claim_status"],
    metadata: { claim_id: claim.id, user_id: claim.user_id, role }
  });

  return { approved: true, claim_id: claim.id, team_id: claim.team_id, role };
}

async function rejectClaim(body) {
  const claimId = cleanText(body.claim_id, 100);

  if (!claimId) {
    const error = new Error("Choose a claim request.");
    error.status = 400;
    throw error;
  }

  const { data: claim, error: claimError } = await supabaseAdmin
    .from("team_claim_requests")
    .select("id, team_id, user_id, requester_name, requester_email, status")
    .eq("id", claimId)
    .maybeSingle();

  if (claimError) {
    throw claimError;
  }

  if (!claim || claim.status !== "pending") {
    const error = new Error("This claim request is no longer pending.");
    error.status = 404;
    throw error;
  }

  const reviewNotes = cleanText(body.review_notes, 2000) || "Rejected by Podium Watch admin.";

  const { error } = await supabaseAdmin
    .from("team_claim_requests")
    .update({
      status: "rejected",
      review_notes: reviewNotes,
      reviewed_at: new Date().toISOString(),
      reviewed_by: ADMIN_ID
    })
    .eq("id", claim.id);

  if (error) {
    throw error;
  }

  await writeAudit({
    action: "reject_team_claim",
    teamId: claim.team_id,
    details: { claim_id: claim.id, user_id: claim.user_id }
  });

  await writeTeamChange({
    teamId: claim.team_id,
    actorType: "admin",
    actorId: ADMIN_ID,
    action: "reject_team_claim",
    summary: `${claim.requester_name || claim.requester_email || "A user"}'s access request was rejected.`,
    changedFields: ["claim_status"],
    metadata: { claim_id: claim.id, user_id: claim.user_id, review_notes: reviewNotes }
  });

  return { rejected: true, claim_id: claim.id };
}

async function setTeamStatus(body) {
  const teamId = requireTeamId(body);
  const field = cleanText(body.field, 60).toLowerCase();
  const value = body.value === true;
  const reason = cleanText(body.reason, 1000);

  if (!TEAM_STATUS_FIELDS.has(field)) {
    const error = new Error("Choose a valid team status.");
    error.status = 400;
    throw error;
  }

  const before = await loadTeam(teamId);

  if (before.archived_at || before.merged_into_team_id) {
    const error = new Error("Restore the archived profile before changing its status.");
    error.status = 409;
    throw error;
  }

  if (field === "published" && value && before.suspended) {
    const error = new Error("Restore the suspended page before publishing it.");
    error.status = 409;
    throw error;
  }

  const now = new Date().toISOString();
  const updates = {
    [field]: value,
    last_admin_action_at: now
  };

  if (field === "suspended" && value) {
    updates.published = false;
    updates.editing_locked = true;
    updates.editing_locked_at = now;
    updates.editing_locked_by = ADMIN_ID;
    updates.editing_lock_reason = reason || "This page is suspended while Podium Watch reviews it.";
  }

  if (field === "editing_locked") {
    updates.editing_locked_at = value ? now : null;
    updates.editing_locked_by = value ? ADMIN_ID : null;
    updates.editing_lock_reason = value
      ? reason || "Team editing was locked by Podium Watch."
      : null;
  }

  const { data: team, error } = await supabaseAdmin
    .from("team_pages")
    .update(updates)
    .eq("id", teamId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const changedFields = getChangedFields(before, team, STATUS_AUDIT_FIELDS);

  await writeAudit({
    action: `set_team_${field}`,
    teamId,
    details: { value, reason }
  });

  await writeTeamChange({
    teamId,
    actorType: "admin",
    actorId: ADMIN_ID,
    action: `set_team_${field}`,
    summary: `${field.replaceAll("_", " ")} was ${value ? "enabled" : "disabled"}.`,
    changedFields,
    beforeData: pickTeamFields(before, changedFields),
    afterData: pickTeamFields(team, changedFields),
    metadata: { reason }
  });

  return { team };
}

async function archiveTeam(body) {
  const teamId = requireTeamId(body);
  const reason = cleanText(body.reason, 2000) || "Archived by Podium Watch admin.";
  const before = await loadTeam(teamId);

  if (before.merged_into_team_id) {
    const error = new Error("Merged profiles are already archived and cannot be archived again.");
    error.status = 409;
    throw error;
  }

  if (before.archived_at) {
    return { team: before };
  }

  const now = new Date().toISOString();
  const { data: team, error } = await supabaseAdmin
    .from("team_pages")
    .update({
      published: false,
      archived_at: now,
      archived_by: ADMIN_ID,
      archived_reason: reason,
      editing_locked: true,
      editing_locked_at: now,
      editing_locked_by: ADMIN_ID,
      editing_lock_reason: "This team profile is archived.",
      last_admin_action_at: now
    })
    .eq("id", teamId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await writeAudit({ action: "archive_team", teamId, details: { reason } });
  await writeTeamChange({
    teamId,
    actorType: "admin",
    actorId: ADMIN_ID,
    action: "archive_team",
    summary: "The team profile was archived.",
    changedFields: ["published", "archived_at", "editing_locked"],
    beforeData: pickTeamFields(before, ["published", "archived_at", "editing_locked"]),
    afterData: pickTeamFields(team, ["published", "archived_at", "editing_locked"]),
    metadata: { reason }
  });

  return { team };
}

async function restoreTeam(body) {
  const teamId = requireTeamId(body);
  const before = await loadTeam(teamId);

  if (before.merged_into_team_id) {
    const error = new Error("A merged duplicate cannot be restored. The primary profile should be used instead.");
    error.status = 409;
    throw error;
  }

  const { data: team, error } = await supabaseAdmin
    .from("team_pages")
    .update({
      archived_at: null,
      archived_by: null,
      archived_reason: null,
      editing_locked: false,
      editing_locked_at: null,
      editing_locked_by: null,
      editing_lock_reason: null,
      last_admin_action_at: new Date().toISOString()
    })
    .eq("id", teamId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await writeAudit({ action: "restore_team", teamId });
  await writeTeamChange({
    teamId,
    actorType: "admin",
    actorId: ADMIN_ID,
    action: "restore_team",
    summary: "The archived team profile was restored as a private draft.",
    changedFields: ["archived_at", "editing_locked"],
    beforeData: pickTeamFields(before, ["archived_at", "editing_locked"]),
    afterData: pickTeamFields(team, ["archived_at", "editing_locked"])
  });

  return { team };
}

async function getTeamMemberCounts(teamId) {
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
  const { count, error } = await supabaseAdmin
    .from("team_members")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId)
    .eq("status", "active");

  if (error) {
    throw error;
  }

  const updates = Number(count) > 0
    ? { claimed_at: new Date().toISOString() }
    : { claimed_at: null };

  const { error: teamError } = await supabaseAdmin
    .from("team_pages")
    .update(updates)
    .eq("id", teamId);

  if (teamError) {
    throw teamError;
  }
}

async function addMember(body) {
  const teamId = requireTeamId(body);
  const email = cleanEmail(body.email);
  const role = cleanText(body.role, 40).toLowerCase();
  const displayName = cleanText(body.display_name, 200) || null;

  if (!["owner", "editor"].includes(role)) {
    const error = new Error("Choose owner or editor access.");
    error.status = 400;
    throw error;
  }

  const team = await loadTeam(teamId);

  if (team.archived_at || team.merged_into_team_id) {
    const error = new Error("Archived or merged profiles cannot receive new managers.");
    error.status = 409;
    throw error;
  }

  const addMemberCounts = await getTeamMemberCounts(teamId);

  if (role === "editor" && addMemberCounts.activeOwners === 0) {
    const error = new Error(
      "This team does not have an owner. Add the first manager as an owner."
    );
    error.status = 409;
    throw error;
  }

  const { data: users, error: userError } = await supabaseAdmin.rpc(
    "team_find_user_by_email_v1",
    { p_email: email }
  );

  if (userError) {
    throw userError;
  }

  const account = Array.isArray(users) ? users[0] : users;

  if (!account?.user_id) {
    const error = new Error("No confirmed team account uses that email. The person must create and confirm an account first.");
    error.status = 404;
    throw error;
  }

  if (!account.confirmed) {
    const error = new Error("That team account has not confirmed its email yet.");
    error.status = 409;
    throw error;
  }

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("team_members")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", account.user_id)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  let member;

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from("team_members")
      .update({
        role,
        status: "active",
        display_name: displayName || account.display_name || null
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    member = data;
  } else {
    const { data, error } = await supabaseAdmin
      .from("team_members")
      .insert({
        team_id: teamId,
        user_id: account.user_id,
        role,
        status: "active",
        display_name: displayName || account.display_name || null
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    member = data;
  }

  await recalculateClaimedAt(teamId);
  await writeAudit({
    action: "add_team_member",
    teamId,
    details: { user_id: account.user_id, email, role }
  });
  await writeTeamChange({
    teamId,
    actorType: "admin",
    actorId: ADMIN_ID,
    action: "add_team_member",
    summary: `${email} received ${role} access.`,
    changedFields: ["team_members"],
    metadata: { user_id: account.user_id, email, role }
  });

  return {
    member: {
      ...member,
      email,
      confirmed: true,
      account_display_name: account.display_name || ""
    }
  };
}

async function updateMember(body) {
  const teamId = requireTeamId(body);
  const memberId = cleanText(body.member_id, 100);
  const role = cleanText(body.role, 40).toLowerCase();

  if (!memberId) {
    const error = new Error("Choose a team manager.");
    error.status = 400;
    throw error;
  }

  if (!["owner", "editor"].includes(role)) {
    const error = new Error("Choose owner or editor access.");
    error.status = 400;
    throw error;
  }

  const { data: before, error: lookupError } = await supabaseAdmin
    .from("team_members")
    .select("*")
    .eq("id", memberId)
    .eq("team_id", teamId)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  if (!before) {
    const error = new Error("Team manager not found.");
    error.status = 404;
    throw error;
  }

  if (before.status === "active" && before.role === "owner" && role !== "owner") {
    const memberCounts = await getTeamMemberCounts(teamId);

    if (memberCounts.activeOwners <= 1) {
      const error = new Error(
        "Promote another manager to owner before changing the final owner's role."
      );
      error.status = 409;
      throw error;
    }
  }

  const { data: member, error } = await supabaseAdmin
    .from("team_members")
    .update({ role, status: "active" })
    .eq("id", memberId)
    .eq("team_id", teamId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await recalculateClaimedAt(teamId);
  await writeAudit({
    action: "update_team_member",
    teamId,
    details: { member_id: memberId, user_id: member.user_id, role }
  });
  await writeTeamChange({
    teamId,
    actorType: "admin",
    actorId: ADMIN_ID,
    action: "update_team_member",
    summary: `A team manager's access changed from ${before.role} to ${role}.`,
    changedFields: ["team_members"],
    beforeData: { role: before.role, status: before.status },
    afterData: { role: member.role, status: member.status },
    metadata: { member_id: memberId, user_id: member.user_id }
  });

  return { member };
}

async function removeMember(body) {
  const teamId = requireTeamId(body);
  const memberId = cleanText(body.member_id, 100);

  if (!memberId) {
    const error = new Error("Choose a team manager.");
    error.status = 400;
    throw error;
  }

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

  if (member.status === "active" && member.role === "owner") {
    const memberCounts = await getTeamMemberCounts(teamId);

    if (
      memberCounts.activeOwners <= 1 &&
      memberCounts.activeMembers > 1
    ) {
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
  await writeAudit({
    action: "remove_team_member",
    teamId,
    details: { member_id: memberId, user_id: member.user_id, role: member.role }
  });
  await writeTeamChange({
    teamId,
    actorType: "admin",
    actorId: ADMIN_ID,
    action: "remove_team_member",
    summary: "A team manager was removed.",
    changedFields: ["team_members"],
    beforeData: { role: member.role, status: member.status },
    afterData: { deleted: true },
    metadata: { member_id: memberId, user_id: member.user_id }
  });

  return { removed: true, member_id: memberId };
}

async function mergeTeams(body) {
  const sourceTeamId = requireTeamId(body, "source_team_id");
  const targetTeamId = requireTeamId(body, "target_team_id");
  const reason = cleanText(body.reason, 2000) || "Merged as a duplicate team profile.";

  if (sourceTeamId === targetTeamId) {
    const error = new Error("Choose a different primary team profile.");
    error.status = 400;
    throw error;
  }

  const { data, error } = await supabaseAdmin.rpc("merge_team_pages_v1", {
    p_source_team_id: sourceTeamId,
    p_target_team_id: targetTeamId,
    p_admin_identifier: ADMIN_ID,
    p_reason: reason
  });

  if (error) {
    if (
      String(error.message || "")
        .includes("MERGE_CONFLICT")
    ) {
      const conflict = new Error(
        "These profiles contain overlapping records. Nothing was changed. Resolve the duplicate roster, season, claim, or schedule records before merging again."
      );
      conflict.status = 409;
      throw conflict;
    }

    throw error;
  }

  await writeAudit({
    action: "merge_team_profiles",
    teamId: targetTeamId,
    details: { source_team_id: sourceTeamId, target_team_id: targetTeamId, reason }
  });

  return { merged: true, result: data };
}

async function updateReport(body) {
  const reportId = cleanText(body.report_id, 100);
  const status = cleanText(body.status, 40).toLowerCase();
  const adminNotes = cleanText(body.admin_notes, 4000) || null;
  const allowed = new Set(["open", "reviewing", "resolved", "dismissed"]);

  if (!reportId) {
    const error = new Error("Choose a team report.");
    error.status = 400;
    throw error;
  }

  if (!allowed.has(status)) {
    const error = new Error("Choose a valid report status.");
    error.status = 400;
    throw error;
  }

  const { data: before, error: lookupError } = await supabaseAdmin
    .from("team_reports")
    .select("*")
    .eq("id", reportId)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  if (!before) {
    const error = new Error("Team report not found.");
    error.status = 404;
    throw error;
  }

  const completed = ["resolved", "dismissed"].includes(status);
  const { data: report, error } = await supabaseAdmin
    .from("team_reports")
    .update({
      status,
      admin_notes: adminNotes,
      reviewed_at: completed ? new Date().toISOString() : null,
      reviewed_by: completed ? ADMIN_ID : null
    })
    .eq("id", reportId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await writeAudit({
    action: "update_team_report",
    teamId: report.team_id,
    details: { report_id: reportId, status }
  });
  await writeTeamChange({
    teamId: report.team_id,
    actorType: "admin",
    actorId: ADMIN_ID,
    action: "update_team_report",
    summary: `A team report changed from ${before.status} to ${status}.`,
    changedFields: ["report_status"],
    beforeData: { status: before.status },
    afterData: { status: report.status },
    metadata: { report_id: reportId, admin_notes: adminNotes }
  });

  return { report };
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (!isAdminRequest(request)) {
    return response.status(401).json({
      error: "Podium Watch admin sign in required."
    });
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const body = parseBody(request);
    const action = cleanText(body.action, 80).toLowerCase();

    if (action === "list") {
      return response.status(200).json(await listTeams(body));
    }

    if (action === "claims") {
      return response.status(200).json({ claims: await listClaims(body) });
    }

    if (action === "reports") {
      return response.status(200).json({ reports: await listReports(body) });
    }

    if (action === "team_details") {
      return response.status(200).json(await getTeamDetails(body));
    }

    if (action === "approve_claim") {
      return response.status(200).json(await approveClaim(body));
    }

    if (action === "reject_claim") {
      return response.status(200).json(await rejectClaim(body));
    }

    if (action === "set_status") {
      return response.status(200).json(await setTeamStatus(body));
    }

    if (action === "archive_team") {
      return response.status(200).json(await archiveTeam(body));
    }

    if (action === "restore_team") {
      return response.status(200).json(await restoreTeam(body));
    }

    if (action === "add_member") {
      return response.status(200).json(await addMember(body));
    }

    if (action === "update_member") {
      return response.status(200).json(await updateMember(body));
    }

    if (action === "remove_member") {
      return response.status(200).json(await removeMember(body));
    }

    if (action === "merge_teams") {
      return response.status(200).json(await mergeTeams(body));
    }

    if (action === "update_report") {
      return response.status(200).json(await updateReport(body));
    }

    return response.status(400).json({
      error: "Choose a valid Team Manager action."
    });
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Admin Team Manager error:", error);
    }

    return response.status(status).json({
      error: status < 500
        ? error.message
        : "The Team Manager request could not be completed."
    });
  }
}
