import { supabaseAdmin } from "../../lib/supabase-admin.mjs";
import {
  requireTeamUser,
  teamApiError
} from "../../lib/team_auth.mjs";
import { writeTeamChange } from "../../lib/team_audit.mjs";
import { queueTeamNotification } from "../../lib/engagement_service.mjs";

const MAX_SEARCH_RESULTS = 100;
const MAX_IMPORT_ROWS = 200;

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

function cleanDate(value, label = "Meet date") {
  const cleaned = cleanText(value, 20);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    const error = new Error(`${label} is required in YYYY-MM-DD format.`);
    error.status = 400;
    throw error;
  }

  const date = new Date(`${cleaned}T12:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    const error = new Error(`${label} is invalid.`);
    error.status = 400;
    throw error;
  }

  return cleaned;
}

function cleanTime(value) {
  const cleaned = cleanText(value, 20);

  if (!cleaned) {
    return null;
  }

  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(cleaned)) {
    const error = new Error("Start time is invalid.");
    error.status = 400;
    throw error;
  }

  return cleaned;
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

function normalizeMeetName(value) {
  return cleanText(value, 300)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(invite|inv|invitational)\b/g, " invitational ")
    .replace(/\bchampionships\b/g, " championship ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizePlace(value) {
  return cleanText(value, 300)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function getFirstValue(row, names) {
  const direct = row && typeof row === "object" ? row : {};

  for (const name of names) {
    if (
      Object.prototype.hasOwnProperty.call(direct, name) &&
      cleanText(direct[name])
    ) {
      return direct[name];
    }
  }

  const normalized = new Map(
    Object.entries(direct).map(([key, value]) => [
      cleanText(key, 200)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim(),
      value
    ])
  );

  for (const name of names) {
    const key = cleanText(name, 200)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

    if (normalized.has(key) && cleanText(normalized.get(key))) {
      return normalized.get(key);
    }
  }

  return "";
}

function normalizeImportRow(row, index) {
  const name = cleanText(
    getFirstValue(row, [
      "meet_name",
      "Meet Name",
      "Meet",
      "Event",
      "Event Name"
    ]),
    300
  );

  const dateValue = cleanText(
    getFirstValue(row, [
      "meet_date",
      "Meet Date",
      "Date"
    ]),
    30
  );

  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
    ? dateValue
    : "";

  const sport = cleanText(
    getFirstValue(row, [
      "sport",
      "Sport",
      "Season"
    ]),
    100
  ) || "Cross Country";

  const errors = [];

  if (!name) {
    errors.push("Meet name is required.");
  }

  if (!date) {
    errors.push("Meet date must use YYYY-MM-DD format.");
  }

  return {
    row_number: index + 2,
    meet_name: name,
    meet_date: date,
    sport,
    start_time: cleanText(
      getFirstValue(row, ["start_time", "Start Time", "Time"]),
      20
    ) || null,
    venue_name: cleanNullableText(
      getFirstValue(row, ["venue_name", "Venue Name", "Venue", "Location"]),
      300
    ),
    address: cleanNullableText(
      getFirstValue(row, ["address", "Address"]),
      500
    ),
    city: cleanNullableText(
      getFirstValue(row, ["city", "City"]),
      200
    ),
    state: cleanText(
      getFirstValue(row, ["state", "State"]),
      100
    ) || "Ohio",
    website_url: cleanText(
      getFirstValue(row, ["website_url", "Website URL", "Website", "Meet Website"]),
      2000
    ) || null,
    results_url: cleanText(
      getFirstValue(row, ["results_url", "Results URL", "Results"]),
      2000
    ) || null,
    notes: cleanNullableText(
      getFirstValue(row, ["notes", "Notes"]),
      3000
    ),
    errors
  };
}

function getMatchScore(row, meet) {
  if (!row.meet_date || row.meet_date !== meet.meet_date) {
    return 0;
  }

  const rowName = normalizeMeetName(row.meet_name);
  const meetName = normalizeMeetName(meet.name);

  if (!rowName || !meetName) {
    return 0;
  }

  let score = 0;

  if (rowName === meetName) {
    score += 100;
  } else if (
    rowName.includes(meetName) ||
    meetName.includes(rowName)
  ) {
    score += 78;
  } else {
    const rowWords = new Set(rowName.split(" "));
    const meetWords = new Set(meetName.split(" "));
    const overlap = [...rowWords].filter((word) => meetWords.has(word)).length;
    const denominator = Math.max(rowWords.size, meetWords.size, 1);
    score += Math.round((overlap / denominator) * 70);
  }

  const rowCity = normalizePlace(row.city);
  const meetCity = normalizePlace(meet.city);

  if (rowCity && meetCity && rowCity === meetCity) {
    score += 10;
  }

  const rowVenue = normalizePlace(row.venue_name);
  const meetVenue = normalizePlace(meet.venue_name);

  if (
    rowVenue &&
    meetVenue &&
    (
      rowVenue === meetVenue ||
      rowVenue.includes(meetVenue) ||
      meetVenue.includes(rowVenue)
    )
  ) {
    score += 10;
  }

  const rowSport = normalizePlace(row.sport);
  const meetSport = normalizePlace(meet.sport);

  if (rowSport && meetSport && rowSport === meetSport) {
    score += 5;
  }

  return score;
}

function publicImportRow(row) {
  return {
    row_number: row.row_number,
    status: row.status,
    meet_name: row.meet_name,
    meet_date: row.meet_date,
    sport: row.sport,
    venue_name: row.venue_name,
    city: row.city,
    matched_meet_id: row.matched_meet_id || null,
    matched_meet_name: row.matched_meet_name || null,
    matched_meet_slug: row.matched_meet_slug || null,
    match_score: row.match_score || 0,
    candidate_count: row.candidate_count || 0,
    errors: row.errors || []
  };
}

async function requireMembership(userId, teamId, { write = false } = {}) {
  const [membershipResult, teamResult] = await Promise.all([
    supabaseAdmin
      .from("team_members")
      .select("id, team_id, user_id, role, status, display_name")
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle(),
    supabaseAdmin
      .from("team_pages")
      .select(
        "id, school_name, slug, published, suspended, archived_at, merged_into_team_id, editing_locked, editing_lock_reason"
      )
      .eq("id", teamId)
      .maybeSingle()
  ]);

  if (membershipResult.error) {
    throw membershipResult.error;
  }

  if (teamResult.error) {
    throw teamResult.error;
  }

  if (!membershipResult.data) {
    const error = new Error("You do not have permission to manage this team schedule.");
    error.status = 403;
    throw error;
  }

  if (!teamResult.data) {
    const error = new Error("Team profile not found.");
    error.status = 404;
    throw error;
  }

  const team = teamResult.data;

  if (team.merged_into_team_id || team.archived_at || team.suspended) {
    const error = new Error(
      "Merged, archived, or suspended team profiles cannot manage schedules."
    );
    error.status = 409;
    throw error;
  }

  if (write && team.editing_locked) {
    const error = new Error(
      team.editing_lock_reason ||
      "Podium Watch has temporarily locked editing for this team."
    );
    error.status = 423;
    throw error;
  }

  return {
    membership: membershipResult.data,
    team
  };
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

async function getSchedule(teamId) {
  const [connectionResult, requestResult] = await Promise.all([
    supabaseAdmin
      .from("team_meet_connections")
      .select("*")
      .eq("team_id", teamId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("team_meet_requests")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
  ]);

  if (connectionResult.error) {
    throw connectionResult.error;
  }

  if (requestResult.error) {
    throw requestResult.error;
  }

  const connections = connectionResult.data || [];
  const meetMap = await getMeetsByIds(
    connections.map((connection) => connection.meet_id)
  );

  return {
    connections: connections
      .map((connection) => ({
        ...connection,
        meet: meetMap.get(connection.meet_id) || null
      }))
      .filter((connection) => connection.meet),
    requests: requestResult.data || []
  };
}

async function searchMeets(body) {
  const queryText = cleanText(body.query, 200)
    .replace(/[,%()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const date = cleanText(body.meet_date, 20);
  const sport = cleanText(body.sport, 100);

  let query = supabaseAdmin
    .from("meets")
    .select(MEET_FIELDS)
    .eq("published", true)
    .order("meet_date", { ascending: true })
    .order("name", { ascending: true })
    .limit(MAX_SEARCH_RESULTS);

  if (queryText) {
    const pattern = `%${queryText}%`;
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

  if (sport) {
    query = query.ilike("sport", sport);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data || [];
}

async function loadMeet(meetId, { publishedOnly = true } = {}) {
  let query = supabaseAdmin
    .from("meets")
    .select(MEET_FIELDS)
    .eq("id", meetId);

  if (publishedOnly) {
    query = query.eq("published", true);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    const notFound = new Error(
      publishedOnly
        ? "That Meet Center page is not currently published."
        : "Meet not found."
    );
    notFound.status = 404;
    throw notFound;
  }

  return data;
}

function buildConnectionRecord(body, teamId, meetId, userId, source = "team_user") {
  const sportScopes = new Set(["All", "Cross Country", "Track and Field"]);
  const programScopes = new Set(["combined", "boys", "girls"]);

  const sportScope = sportScopes.has(body.sport_scope)
    ? body.sport_scope
    : "All";
  const programScope = programScopes.has(body.program_scope)
    ? body.program_scope
    : "combined";
  let sortOrder = Number(body.sort_order);

  if (!Number.isInteger(sortOrder)) {
    sortOrder = 0;
  }

  return {
    team_id: teamId,
    meet_id: meetId,
    sport_scope: sportScope,
    program_scope: programScope,
    schedule_note: cleanNullableText(body.schedule_note, 2000),
    results_url_override: cleanUrl(
      body.results_url_override,
      "Results link"
    ),
    source,
    created_by_user_id: userId || null,
    created_by_admin: null,
    published: body.published === undefined
      ? true
      : cleanBoolean(body.published),
    sort_order: Math.max(-999, Math.min(999, sortOrder))
  };
}

async function connectMeet(user, team, body, source = "team_user") {
  const meetId = cleanId(body.meet_id, "Meet ID");
  const meet = await loadMeet(meetId, { publishedOnly: true });
  const record = buildConnectionRecord(body, team.id, meetId, user.id, source);

  const { data, error } = await supabaseAdmin
    .from("team_meet_connections")
    .upsert(record, { onConflict: "team_id,meet_id" })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await writeTeamChange({
    teamId: team.id,
    actorType: source === "import" ? "import" : "team_user",
    actorId: user.id,
    action: source === "import" ? "schedule_import_connect" : "schedule_connect_meet",
    summary: `${meet.name} was added to the team schedule.`,
    changedFields: ["team_schedule"],
    afterData: {
      connection_id: data.id,
      meet_id: meet.id,
      meet_name: meet.name,
      meet_date: meet.meet_date
    }
  });

  return {
    ...data,
    meet
  };
}

async function updateConnection(user, team, body) {
  const connectionId = cleanId(body.connection_id, "Schedule connection ID");

  const { data: current, error: currentError } = await supabaseAdmin
    .from("team_meet_connections")
    .select("*")
    .eq("id", connectionId)
    .eq("team_id", team.id)
    .maybeSingle();

  if (currentError) {
    throw currentError;
  }

  if (!current) {
    const error = new Error("Schedule connection not found.");
    error.status = 404;
    throw error;
  }

  const record = buildConnectionRecord(
    body,
    team.id,
    current.meet_id,
    current.created_by_user_id || user.id,
    current.source || "team_user"
  );

  const updates = {
    sport_scope: record.sport_scope,
    program_scope: record.program_scope,
    schedule_note: record.schedule_note,
    results_url_override: record.results_url_override,
    published: record.published,
    sort_order: record.sort_order
  };

  const { data, error } = await supabaseAdmin
    .from("team_meet_connections")
    .update(updates)
    .eq("id", connectionId)
    .eq("team_id", team.id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await writeTeamChange({
    teamId: team.id,
    actorType: "team_user",
    actorId: user.id,
    action: "schedule_update_connection",
    summary: "A team schedule connection was updated.",
    changedFields: ["team_schedule"],
    beforeData: current,
    afterData: data
  });

  return data;
}

async function disconnectMeet(user, team, body) {
  const connectionId = cleanId(body.connection_id, "Schedule connection ID");

  const { data: current, error: currentError } = await supabaseAdmin
    .from("team_meet_connections")
    .select("*")
    .eq("id", connectionId)
    .eq("team_id", team.id)
    .maybeSingle();

  if (currentError) {
    throw currentError;
  }

  if (!current) {
    const error = new Error("Schedule connection not found.");
    error.status = 404;
    throw error;
  }

  const meet = await loadMeet(current.meet_id, { publishedOnly: false });

  const { error } = await supabaseAdmin
    .from("team_meet_connections")
    .delete()
    .eq("id", connectionId)
    .eq("team_id", team.id);

  if (error) {
    throw error;
  }

  await writeTeamChange({
    teamId: team.id,
    actorType: "team_user",
    actorId: user.id,
    action: "schedule_disconnect_meet",
    summary: `${meet.name} was removed from the team schedule.`,
    changedFields: ["team_schedule"],
    beforeData: {
      connection_id: current.id,
      meet_id: meet.id,
      meet_name: meet.name,
      meet_date: meet.meet_date
    }
  });

  return {
    removed: true,
    connection_id: connectionId
  };
}

function buildMeetRequest(body, user, teamId, importBatchKey = null) {
  const meetName = cleanText(body.meet_name, 300);

  if (!meetName) {
    const error = new Error("Meet name is required.");
    error.status = 400;
    throw error;
  }

  const sport = cleanText(body.sport, 100) || "Cross Country";

  return {
    team_id: teamId,
    submitted_by_user_id: user.id,
    submitted_by_name: cleanNullableText(
      body.submitted_by_name || user.user_metadata?.display_name || user.user_metadata?.full_name,
      200
    ),
    submitted_by_email: cleanNullableText(user.email, 320),
    meet_name: meetName,
    meet_date: cleanDate(body.meet_date),
    start_time: cleanTime(body.start_time),
    sport,
    venue_name: cleanNullableText(body.venue_name, 300),
    address: cleanNullableText(body.address, 500),
    city: cleanNullableText(body.city, 200),
    state: cleanText(body.state, 100) || "Ohio",
    website_url: cleanUrl(body.website_url, "Meet website"),
    results_url: cleanUrl(body.results_url, "Results link"),
    notes: cleanNullableText(body.notes, 5000),
    status: "pending",
    matched_meet_id: null,
    import_batch_key: importBatchKey
  };
}

async function requestMeet(user, team, body, importBatchKey = null) {
  const record = buildMeetRequest(body, user, team.id, importBatchKey);

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("team_meet_requests")
    .select("id, status")
    .eq("team_id", team.id)
    .eq("meet_date", record.meet_date)
    .ilike("meet_name", record.meet_name)
    .in("status", ["pending", "reviewing"])
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return {
      request: existing,
      duplicate: true
    };
  }

  const { data, error } = await supabaseAdmin
    .from("team_meet_requests")
    .insert(record)
    .select("*")
    .single();

  if (error) {
    if (String(error.code) === "23505") {
      return {
        request: null,
        duplicate: true
      };
    }

    throw error;
  }

  await writeTeamChange({
    teamId: team.id,
    actorType: importBatchKey ? "import" : "team_user",
    actorId: user.id,
    action: importBatchKey ? "schedule_import_request" : "schedule_request_meet",
    summary: `${record.meet_name} was submitted for Meet Center review.`,
    changedFields: ["team_schedule_requests"],
    afterData: {
      request_id: data.id,
      meet_name: data.meet_name,
      meet_date: data.meet_date,
      sport: data.sport
    },
    metadata: {
      import_batch_key: importBatchKey
    }
  });

  return {
    request: data,
    duplicate: false
  };
}

async function cancelRequest(user, team, body) {
  const requestId = cleanId(body.request_id, "Meet request ID");

  const { data: current, error: currentError } = await supabaseAdmin
    .from("team_meet_requests")
    .select("*")
    .eq("id", requestId)
    .eq("team_id", team.id)
    .maybeSingle();

  if (currentError) {
    throw currentError;
  }

  if (!current) {
    const error = new Error("Meet request not found.");
    error.status = 404;
    throw error;
  }

  if (!["pending", "reviewing"].includes(current.status)) {
    const error = new Error("This meet request can no longer be cancelled.");
    error.status = 409;
    throw error;
  }

  const { data, error } = await supabaseAdmin
    .from("team_meet_requests")
    .update({
      status: "cancelled",
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.email || user.id,
      admin_notes: "Cancelled by the submitting team."
    })
    .eq("id", requestId)
    .eq("team_id", team.id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await writeTeamChange({
    teamId: team.id,
    actorType: "team_user",
    actorId: user.id,
    action: "schedule_cancel_request",
    summary: `${current.meet_name} was removed from Meet Center review.`,
    changedFields: ["team_schedule_requests"],
    beforeData: current,
    afterData: data
  });

  return data;
}

async function buildImportPlan(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    const error = new Error("The schedule import does not contain any rows.");
    error.status = 400;
    throw error;
  }

  if (rows.length > MAX_IMPORT_ROWS) {
    const error = new Error(
      `A schedule import can contain no more than ${MAX_IMPORT_ROWS} rows.`
    );
    error.status = 400;
    throw error;
  }

  const normalizedRows = rows.map(normalizeImportRow);
  const validDates = normalizedRows
    .map((row) => row.meet_date)
    .filter(Boolean)
    .sort();

  let meets = [];

  if (validDates.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("meets")
      .select(MEET_FIELDS)
      .eq("published", true)
      .gte("meet_date", validDates[0])
      .lte("meet_date", validDates[validDates.length - 1])
      .order("meet_date", { ascending: true })
      .limit(2500);

    if (error) {
      throw error;
    }

    meets = data || [];
  }

  const plan = normalizedRows.map((row) => {
    if (row.errors.length > 0) {
      return {
        ...row,
        status: "error"
      };
    }

    const candidates = meets
      .map((meet) => ({
        meet,
        score: getMatchScore(row, meet)
      }))
      .filter((item) => item.score >= 55)
      .sort((a, b) => b.score - a.score);

    const best = candidates[0];
    const second = candidates[1];
    const confident = best &&
      best.score >= 88 &&
      (!second || best.score - second.score >= 8);

    if (confident) {
      return {
        ...row,
        status: "matched",
        matched_meet_id: best.meet.id,
        matched_meet_name: best.meet.name,
        matched_meet_slug: best.meet.slug,
        match_score: best.score,
        candidate_count: candidates.length
      };
    }

    if (best) {
      return {
        ...row,
        status: "review",
        matched_meet_id: null,
        matched_meet_name: best.meet.name,
        matched_meet_slug: best.meet.slug,
        match_score: best.score,
        candidate_count: candidates.length
      };
    }

    return {
      ...row,
      status: "request",
      matched_meet_id: null,
      matched_meet_name: null,
      matched_meet_slug: null,
      match_score: 0,
      candidate_count: 0
    };
  });

  return {
    plan,
    summary: {
      total: plan.length,
      matched: plan.filter((row) => row.status === "matched").length,
      review: plan.filter((row) => row.status === "review").length,
      request: plan.filter((row) => row.status === "request").length,
      error: plan.filter((row) => row.status === "error").length
    }
  };
}

async function commitImport(user, team, rows) {
  const { plan, summary } = await buildImportPlan(rows);
  const importBatchKey = `team-${team.id}-${Date.now()}`;
  let connected = 0;
  let requested = 0;
  let duplicates = 0;

  for (const row of plan) {
    if (row.status === "matched" && row.matched_meet_id) {
      await connectMeet(
        user,
        team,
        {
          meet_id: row.matched_meet_id,
          schedule_note: row.notes,
          sport_scope: row.sport === "Track and Field"
            ? "Track and Field"
            : row.sport === "Cross Country"
              ? "Cross Country"
              : "All",
          program_scope: "combined",
          published: true
        },
        "import"
      );
      connected += 1;
      continue;
    }

    if (["review", "request"].includes(row.status)) {
      const result = await requestMeet(
        user,
        team,
        row,
        importBatchKey
      );

      if (result.duplicate) {
        duplicates += 1;
      } else {
        requested += 1;
      }
    }
  }

  return {
    summary: {
      ...summary,
      connected,
      requested,
      duplicates
    },
    rows: plan.map(publicImportRow)
  };
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const user = await requireTeamUser(request);
    const body = parseBody(request);
    const action = cleanText(body.action, 100).toLowerCase() || "get";
    const teamId = cleanId(body.team_id, "Team ID");
    const writeActions = new Set([
      "connect",
      "update_connection",
      "disconnect",
      "request_meet",
      "cancel_request",
      "import_commit"
    ]);
    const { membership, team } = await requireMembership(
      user.id,
      teamId,
      { write: writeActions.has(action) }
    );

    if (action === "get") {
      const schedule = await getSchedule(team.id);
      return response.status(200).json({
        team,
        membership,
        ...schedule
      });
    }

    if (action === "search_meets") {
      const meets = await searchMeets(body);
      return response.status(200).json({ meets });
    }

    if (action === "connect") {
      const connection = await connectMeet(user, team, body);

      if (connection.published !== false && connection.meet) {
        await queueTeamNotification({
          teamId: team.id,
          category: "schedule",
          title: `${connection.meet.name} was added to the schedule`,
          summary: [connection.meet.meet_date, connection.meet.venue_name, connection.meet.city]
            .filter(Boolean)
            .join(" · "),
          destinationUrl: `/meetdetail/?slug=${encodeURIComponent(connection.meet.slug || "")}`,
          sourceType: "team_schedule",
          sourceId: connection.id,
          dedupeKey: `schedule:${connection.id}:${connection.updated_at || connection.created_at}`,
          createdBy: user.email || "Team manager"
        });
      }

      return response.status(200).json({ connection });
    }

    if (action === "update_connection") {
      const connection = await updateConnection(user, team, body);

      if (connection.published !== false) {
        const meet = await loadMeet(connection.meet_id, { publishedOnly: false });
        await queueTeamNotification({
          teamId: team.id,
          category: "schedule",
          title: `${meet.name} schedule details were updated`,
          summary: connection.schedule_note || [meet.meet_date, meet.venue_name, meet.city].filter(Boolean).join(" · "),
          destinationUrl: `/meetdetail/?slug=${encodeURIComponent(meet.slug || "")}`,
          sourceType: "team_schedule",
          sourceId: connection.id,
          dedupeKey: `schedule-update:${connection.id}:${new Date().toISOString().slice(0, 10)}`,
          createdBy: user.email || "Team manager"
        });
      }

      return response.status(200).json({ connection });
    }

    if (action === "disconnect") {
      const result = await disconnectMeet(user, team, body);
      return response.status(200).json(result);
    }

    if (action === "request_meet") {
      const result = await requestMeet(user, team, body);
      return response.status(result.duplicate ? 200 : 201).json(result);
    }

    if (action === "cancel_request") {
      const meetRequest = await cancelRequest(user, team, body);
      return response.status(200).json({ request: meetRequest });
    }

    if (action === "import_preview") {
      const result = await buildImportPlan(body.rows);
      return response.status(200).json({
        summary: result.summary,
        rows: result.plan.map(publicImportRow)
      });
    }

    if (action === "import_commit") {
      if (body.confirm !== true) {
        const error = new Error("Confirm the schedule import before saving it.");
        error.status = 400;
        throw error;
      }

      const result = await commitImport(user, team, body.rows);

      if (Number(result.summary?.connected || 0) > 0) {
        await queueTeamNotification({
          teamId: team.id,
          category: "schedule",
          title: "The team schedule was updated",
          summary: `${result.summary.connected} meet${result.summary.connected === 1 ? "" : "s"} connected to the Meet Center.`,
          destinationUrl: `/team/?slug=${encodeURIComponent(team.slug || "")}`,
          sourceType: "schedule_import",
          sourceId: `${team.id}-${new Date().toISOString().slice(0, 10)}`,
          dedupeKey: `schedule-import:${team.id}:${new Date().toISOString().slice(0, 10)}`,
          createdBy: user.email || "Team manager"
        });
      }

      return response.status(200).json(result);
    }

    const error = new Error("Unsupported team schedule action.");
    error.status = 400;
    throw error;
  } catch (error) {
    return teamApiError(
      response,
      error,
      "The team schedule request could not be completed."
    );
  }
}
