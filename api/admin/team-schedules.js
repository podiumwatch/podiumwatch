import { supabaseAdmin } from "../../lib/supabase-admin.mjs";
import { isAdminRequest } from "../../lib/admin_auth.mjs";
import { writeTeamChange } from "../../lib/team_audit.mjs";

const MAX_TEAM_RESULTS = 150;
const MAX_MEET_RESULTS = 150;
const MAX_BULK_TEAMS = 150;

const MEET_FIELDS = `
  id,
  name,
  slug,
  sport,
  meet_date,
  start_time,
  end_date,
  venue_name,
  address,
  city,
  state,
  zip_code,
  host_school,
  meet_type,
  division,
  results_url,
  athleticnet_url,
  milesplit_url,
  registration_url,
  official_website_url,
  google_maps_url,
  published,
  featured
`;

function cleanText(value, maxLength = 3000) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function cleanNullableText(value, maxLength = 3000) {
  const cleaned = cleanText(value, maxLength);
  return cleaned || null;
}

function cleanId(value, label = "ID") {
  const cleaned = cleanText(value, 100);

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      cleaned
    )
  ) {
    const error = new Error(`${label} is invalid.`);
    error.status = 400;
    throw error;
  }

  return cleaned;
}

function cleanIds(value, label = "teams") {
  if (!Array.isArray(value)) {
    const error = new Error(`Select at least one ${label}.`);
    error.status = 400;
    throw error;
  }

  const ids = [...new Set(value.map((item) => cleanId(item, "Team ID")))];

  if (ids.length === 0) {
    const error = new Error(`Select at least one ${label}.`);
    error.status = 400;
    throw error;
  }

  if (ids.length > MAX_BULK_TEAMS) {
    const error = new Error(
      `No more than ${MAX_BULK_TEAMS} teams can be connected at once.`
    );
    error.status = 400;
    throw error;
  }

  return ids;
}

function cleanBoolean(value) {
  if (value === true || value === 1) {
    return true;
  }

  return ["true", "1", "yes", "on"].includes(
    cleanText(value, 20).toLowerCase()
  );
}

function cleanUrl(value, label) {
  const cleaned = cleanText(value, 2000);

  if (!cleaned) {
    return null;
  }

  const prepared = /^[a-z][a-z0-9+.-]*:\/\//i.test(cleaned)
    ? cleaned
    : `https://${cleaned}`;

  try {
    const url = new URL(prepared);

    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error();
    }

    return url.href;
  } catch {
    const error = new Error(`${label} must be a valid website address.`);
    error.status = 400;
    throw error;
  }
}

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The submitted schedule request is invalid.");
      error.status = 400;
      throw error;
    }
  }

  return request.body || {};
}

function cleanSearch(value) {
  return cleanText(value, 200)
    .replace(/[,%()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return cleanText(value, 300)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "meet";
}

async function getTeamsByIds(ids) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  if (uniqueIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabaseAdmin
    .from("team_pages")
    .select(
      "id, school_name, slug, mascot, city, state, published, suspended, archived_at, merged_into_team_id"
    )
    .in("id", uniqueIds);

  if (error) {
    throw error;
  }

  return new Map((data || []).map((team) => [team.id, team]));
}

async function getMeetsByIds(ids) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  if (uniqueIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabaseAdmin
    .from("meets")
    .select(MEET_FIELDS)
    .in("id", uniqueIds);

  if (error) {
    throw error;
  }

  return new Map((data || []).map((meet) => [meet.id, meet]));
}

async function listOverview(body) {
  const status = cleanText(body.status, 50).toLowerCase();
  const requestLimit = Math.max(1, Math.min(300, Number(body.request_limit) || 150));
  const connectionLimit = Math.max(1, Math.min(300, Number(body.connection_limit) || 150));

  let requestQuery = supabaseAdmin
    .from("team_meet_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(requestLimit);

  if (["pending", "reviewing", "approved", "rejected", "duplicate", "cancelled"].includes(status)) {
    requestQuery = requestQuery.eq("status", status);
  } else if (!status || status === "active") {
    requestQuery = requestQuery.in("status", ["pending", "reviewing"]);
  }

  const [requestResult, connectionResult] = await Promise.all([
    requestQuery,
    supabaseAdmin
      .from("team_meet_connections")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(connectionLimit)
  ]);

  if (requestResult.error) {
    throw requestResult.error;
  }

  if (connectionResult.error) {
    throw connectionResult.error;
  }

  const requests = requestResult.data || [];
  const connections = connectionResult.data || [];
  const teamMap = await getTeamsByIds([
    ...requests.map((item) => item.team_id),
    ...connections.map((item) => item.team_id)
  ]);
  const meetMap = await getMeetsByIds([
    ...requests.map((item) => item.matched_meet_id),
    ...connections.map((item) => item.meet_id)
  ]);

  return {
    requests: requests.map((item) => ({
      ...item,
      team: teamMap.get(item.team_id) || null,
      matched_meet: item.matched_meet_id
        ? meetMap.get(item.matched_meet_id) || null
        : null
    })),
    connections: connections.map((item) => ({
      ...item,
      team: teamMap.get(item.team_id) || null,
      meet: meetMap.get(item.meet_id) || null
    })).filter((item) => item.team && item.meet)
  };
}

async function getTeamSchedule(body) {
  const teamId = cleanId(
    body.team_id,
    "Team ID"
  );

  const {
    data: team,
    error: teamError
  } = await supabaseAdmin
    .from("team_pages")
    .select(
      "id, school_name, slug, mascot, city, state, published, suspended, archived_at, merged_into_team_id"
    )
    .eq("id", teamId)
    .maybeSingle();

  if (teamError) {
    throw teamError;
  }

  if (!team) {
    const error = new Error(
      "Team profile not found."
    );
    error.status = 404;
    throw error;
  }

  const {
    data: connections,
    error: connectionError
  } = await supabaseAdmin
    .from("team_meet_connections")
    .select("*")
    .eq("team_id", teamId)
    .order("sort_order", {
      ascending: true
    })
    .order("created_at", {
      ascending: true
    });

  if (connectionError) {
    throw connectionError;
  }

  const rows = connections || [];
  const meetMap = await getMeetsByIds(
    rows.map((item) => item.meet_id)
  );

  return {
    team,
    connections: rows
      .map((item) => ({
        ...item,
        team,
        meet:
          meetMap.get(item.meet_id) ||
          null
      }))
      .filter((item) => item.meet)
  };
}

async function searchTeams(body) {
  const search = cleanSearch(body.query);

  let query = supabaseAdmin
    .from("team_pages")
    .select(
      "id, school_name, slug, mascot, city, state, program_level, program_scope, published, verified, claimed_at"
    )
    .is("archived_at", null)
    .is("merged_into_team_id", null)
    .eq("suspended", false)
    .order("school_name", { ascending: true })
    .limit(MAX_TEAM_RESULTS);

  if (search) {
    const pattern = `%${search}%`;
    query = query.or(
      [
        `school_name.ilike.${pattern}`,
        `city.ilike.${pattern}`,
        `mascot.ilike.${pattern}`,
        `slug.ilike.${pattern}`
      ].join(",")
    );
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data || [];
}

async function searchMeets(body) {
  const search = cleanSearch(body.query);
  const date = cleanText(body.meet_date, 20);
  const includeDrafts = body.include_drafts !== false;

  let query = supabaseAdmin
    .from("meets")
    .select(MEET_FIELDS)
    .order("meet_date", { ascending: true })
    .order("name", { ascending: true })
    .limit(MAX_MEET_RESULTS);

  if (!includeDrafts) {
    query = query.eq("published", true);
  }

  if (search) {
    const pattern = `%${search}%`;
    query = query.or(
      [
        `name.ilike.${pattern}`,
        `venue_name.ilike.${pattern}`,
        `city.ilike.${pattern}`,
        `host_school.ilike.${pattern}`
      ].join(",")
    );
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    query = query.eq("meet_date", date);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data || [];
}

async function loadMeet(meetId) {
  const { data, error } = await supabaseAdmin
    .from("meets")
    .select(MEET_FIELDS)
    .eq("id", meetId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    const notFound = new Error("Meet not found.");
    notFound.status = 404;
    throw notFound;
  }

  return data;
}

async function loadRequest(requestId) {
  const { data, error } = await supabaseAdmin
    .from("team_meet_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    const notFound = new Error("Meet request not found.");
    notFound.status = 404;
    throw notFound;
  }

  return data;
}

function buildConnectionRecord(body, teamId, meetId) {
  const sportScopes = new Set(["All", "Cross Country", "Track and Field"]);
  const programScopes = new Set(["combined", "boys", "girls"]);
  let sortOrder = Number(body.sort_order);

  if (!Number.isInteger(sortOrder)) {
    sortOrder = 0;
  }

  return {
    team_id: teamId,
    meet_id: meetId,
    sport_scope: sportScopes.has(body.sport_scope)
      ? body.sport_scope
      : "All",
    program_scope: programScopes.has(body.program_scope)
      ? body.program_scope
      : "combined",
    schedule_note: cleanNullableText(body.schedule_note, 2000),
    results_url_override: cleanUrl(body.results_url_override, "Results link"),
    source: "admin",
    created_by_user_id: null,
    created_by_admin: "Podium Watch Admin",
    published: body.published === undefined
      ? true
      : cleanBoolean(body.published),
    sort_order: Math.max(-999, Math.min(999, sortOrder))
  };
}

async function connectTeams(body) {
  const teamIds = cleanIds(body.team_ids);
  const meetId = cleanId(body.meet_id, "Meet ID");
  const meet = await loadMeet(meetId);

  const { data: teams, error: teamError } = await supabaseAdmin
    .from("team_pages")
    .select("id, school_name, archived_at, merged_into_team_id")
    .in("id", teamIds);

  if (teamError) {
    throw teamError;
  }

  const availableTeams = (teams || []).filter(
    (team) => !team.archived_at && !team.merged_into_team_id
  );

  if (availableTeams.length === 0) {
    const error = new Error("No active team profiles were selected.");
    error.status = 409;
    throw error;
  }

  const records = availableTeams.map((team) =>
    buildConnectionRecord(body, team.id, meetId)
  );

  const { data, error } = await supabaseAdmin
    .from("team_meet_connections")
    .upsert(records, { onConflict: "team_id,meet_id" })
    .select("*");

  if (error) {
    throw error;
  }

  await Promise.all(
    availableTeams.map((team) =>
      writeTeamChange({
        teamId: team.id,
        actorType: "admin",
        actorId: "Podium Watch Admin",
        action: "admin_schedule_connect_meet",
        summary: `${meet.name} was added to the team schedule by Podium Watch.`,
        changedFields: ["team_schedule"],
        afterData: {
          meet_id: meet.id,
          meet_name: meet.name,
          meet_date: meet.meet_date
        }
      })
    )
  );

  return {
    meet,
    connected_count: data?.length || 0,
    connections: data || []
  };
}

async function updateConnection(body) {
  const connectionId = cleanId(body.connection_id, "Schedule connection ID");

  const { data: current, error: currentError } = await supabaseAdmin
    .from("team_meet_connections")
    .select("*")
    .eq("id", connectionId)
    .maybeSingle();

  if (currentError) {
    throw currentError;
  }

  if (!current) {
    const error = new Error("Schedule connection not found.");
    error.status = 404;
    throw error;
  }

  const record = buildConnectionRecord(body, current.team_id, current.meet_id);
  const updates = {
    sport_scope: record.sport_scope,
    program_scope: record.program_scope,
    schedule_note: record.schedule_note,
    results_url_override: record.results_url_override,
    published: record.published,
    sort_order: record.sort_order,
    source: "admin",
    created_by_admin: "Podium Watch Admin"
  };

  const { data, error } = await supabaseAdmin
    .from("team_meet_connections")
    .update(updates)
    .eq("id", connectionId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await writeTeamChange({
    teamId: current.team_id,
    actorType: "admin",
    actorId: "Podium Watch Admin",
    action: "admin_schedule_update_connection",
    summary: "Podium Watch updated a team schedule connection.",
    changedFields: ["team_schedule"],
    beforeData: current,
    afterData: data
  });

  return data;
}

async function disconnect(body) {
  const connectionId = cleanId(body.connection_id, "Schedule connection ID");

  const { data: current, error: currentError } = await supabaseAdmin
    .from("team_meet_connections")
    .select("*")
    .eq("id", connectionId)
    .maybeSingle();

  if (currentError) {
    throw currentError;
  }

  if (!current) {
    const error = new Error("Schedule connection not found.");
    error.status = 404;
    throw error;
  }

  const meet = await loadMeet(current.meet_id);

  const { error } = await supabaseAdmin
    .from("team_meet_connections")
    .delete()
    .eq("id", connectionId);

  if (error) {
    throw error;
  }

  await writeTeamChange({
    teamId: current.team_id,
    actorType: "admin",
    actorId: "Podium Watch Admin",
    action: "admin_schedule_disconnect_meet",
    summary: `${meet.name} was removed from the team schedule by Podium Watch.`,
    changedFields: ["team_schedule"],
    beforeData: current
  });

  return {
    removed: true,
    connection_id: connectionId
  };
}

async function uniqueMeetSlug(baseValue) {
  const base = slugify(baseValue);
  let candidate = base;
  let suffix = 2;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from("meets")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return candidate;
    }

    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

async function connectRequestToMeet(request, meet, body) {
  const record = buildConnectionRecord(body, request.team_id, meet.id);

  const { data: connection, error: connectionError } = await supabaseAdmin
    .from("team_meet_connections")
    .upsert(record, { onConflict: "team_id,meet_id" })
    .select("*")
    .single();

  if (connectionError) {
    throw connectionError;
  }

  const { data: updatedRequest, error: requestError } = await supabaseAdmin
    .from("team_meet_requests")
    .update({
      status: "approved",
      matched_meet_id: meet.id,
      reviewed_at: new Date().toISOString(),
      reviewed_by: "Podium Watch Admin",
      admin_notes: cleanNullableText(body.admin_notes, 3000) ||
        "Connected to a Meet Center page."
    })
    .eq("id", request.id)
    .select("*")
    .single();

  if (requestError) {
    throw requestError;
  }

  await writeTeamChange({
    teamId: request.team_id,
    actorType: "admin",
    actorId: "Podium Watch Admin",
    action: "admin_schedule_approve_request",
    summary: `${request.meet_name} was approved and connected to Meet Center.`,
    changedFields: ["team_schedule", "team_schedule_requests"],
    afterData: {
      request_id: request.id,
      connection_id: connection.id,
      meet_id: meet.id,
      meet_name: meet.name
    }
  });

  return {
    request: updatedRequest,
    connection,
    meet
  };
}

async function createMeetFromRequest(request, body) {
  const publishMeet = cleanBoolean(body.publish_meet);
  const slug = await uniqueMeetSlug(
    `${request.meet_name}-${request.meet_date}`
  );
  const year = new Date(`${request.meet_date}T12:00:00`).getFullYear();

  const meetRecord = {
    name: request.meet_name,
    slug,
    year,
    sport: request.sport || "Cross Country",
    meet_date: request.meet_date,
    start_time: request.start_time,
    venue_name: request.venue_name,
    address: request.address,
    city: request.city,
    state: request.state || "Ohio",
    official_website_url: request.website_url,
    results_url: request.results_url,
    description: cleanNullableText(body.description, 5000) || request.notes,
    host_school: cleanNullableText(body.host_school, 300),
    meet_type: cleanNullableText(body.meet_type, 200),
    division: cleanNullableText(body.division, 200),
    featured: false,
    published: publishMeet,
    updated_at: new Date().toISOString()
  };

  const { data: meet, error } = await supabaseAdmin
    .from("meets")
    .insert(meetRecord)
    .select(MEET_FIELDS)
    .single();

  if (error) {
    throw error;
  }

  return meet;
}

async function reviewRequest(body) {
  const requestId = cleanId(body.request_id, "Meet request ID");
  const decision = cleanText(body.decision, 50).toLowerCase();
  const request = await loadRequest(requestId);

  if (!["pending", "reviewing"].includes(request.status)) {
    const error = new Error("This meet request is no longer awaiting review.");
    error.status = 409;
    throw error;
  }

  if (decision === "reviewing") {
    const { data, error } = await supabaseAdmin
      .from("team_meet_requests")
      .update({
        status: "reviewing",
        reviewed_at: new Date().toISOString(),
        reviewed_by: "Podium Watch Admin",
        admin_notes: cleanNullableText(body.admin_notes, 3000)
      })
      .eq("id", requestId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return { request: data };
  }

  if (["rejected", "duplicate"].includes(decision)) {
    const { data, error } = await supabaseAdmin
      .from("team_meet_requests")
      .update({
        status: decision,
        matched_meet_id: decision === "duplicate" && body.meet_id
          ? cleanId(body.meet_id, "Meet ID")
          : null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: "Podium Watch Admin",
        admin_notes: cleanNullableText(body.admin_notes, 3000) ||
          (decision === "duplicate"
            ? "This request duplicates an existing Meet Center page."
            : "This request was not approved.")
      })
      .eq("id", requestId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    await writeTeamChange({
      teamId: request.team_id,
      actorType: "admin",
      actorId: "Podium Watch Admin",
      action: `admin_schedule_request_${decision}`,
      summary: `${request.meet_name} was marked ${decision}.`,
      changedFields: ["team_schedule_requests"],
      beforeData: request,
      afterData: data
    });

    return { request: data };
  }

  if (decision === "approve_existing") {
    const meetId = cleanId(body.meet_id, "Meet ID");
    const meet = await loadMeet(meetId);
    return connectRequestToMeet(request, meet, body);
  }

  if (decision === "create_meet") {
    const meet = await createMeetFromRequest(request, body);
    return connectRequestToMeet(request, meet, body);
  }

  const error = new Error("Choose a valid review decision.");
  error.status = 400;
  throw error;
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
    const action = cleanText(body.action, 100).toLowerCase() || "list";

    if (action === "list") {
      return response.status(200).json(await listOverview(body));
    }

    if (action === "search_teams") {
      return response.status(200).json({ teams: await searchTeams(body) });
    }

    if (action === "get_team_schedule") {
      return response.status(200).json(
        await getTeamSchedule(body)
      );
    }

    if (action === "search_meets") {
      return response.status(200).json({ meets: await searchMeets(body) });
    }

    if (action === "connect") {
      return response.status(200).json(await connectTeams(body));
    }

    if (action === "update_connection") {
      return response.status(200).json({
        connection: await updateConnection(body)
      });
    }

    if (action === "disconnect") {
      return response.status(200).json(await disconnect(body));
    }

    if (action === "review_request") {
      return response.status(200).json(await reviewRequest(body));
    }

    const error = new Error("Unsupported schedule manager action.");
    error.status = 400;
    throw error;
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Admin team schedule error:", error);
    }

    return response.status(status).json({
      error: status < 500
        ? error.message
        : "The Team Schedule Manager request could not be completed."
    });
  }
}
