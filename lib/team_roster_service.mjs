import { supabaseAdmin } from "./supabase-admin.mjs";
import { writeTeamChange } from "./team_audit.mjs";
import { syncRosterAthleteProfile } from "./athlete_foundation_service.mjs";

const MAX_IMPORT_ROWS = 1500;
const MAX_SOCIAL_LINKS = 12;

const TEAM_FIELDS = `
  id,
  school_name,
  slug,
  mascot,
  city,
  state,
  program_level,
  program_scope,
  published,
  verified,
  suspended,
  editing_locked,
  archived_at,
  merged_into_team_id
`;

function fail(message, status = 400, code = "") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  throw error;
}

export function parseRosterBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      fail("The submitted roster request is invalid.");
    }
  }

  return request.body || {};
}

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

function cleanUuid(value, label = "ID") {
  const cleaned = cleanText(value, 100);

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      cleaned
    )
  ) {
    fail(`${label} is invalid.`);
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

function cleanInteger(value, {
  label,
  min,
  max,
  nullable = false,
  fallback = null
}) {
  const cleaned = cleanText(value, 30);

  if (!cleaned) {
    if (nullable) {
      return null;
    }

    if (fallback !== null) {
      return fallback;
    }

    fail(`${label} is required.`);
  }

  const number = Number(cleaned);

  if (!Number.isInteger(number) || number < min || number > max) {
    fail(`${label} must be between ${min} and ${max}.`);
  }

  return number;
}

function cleanDate(value, label) {
  const cleaned = cleanText(value, 30);

  if (!cleaned) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    fail(`${label} must use the format YYYY-MM-DD.`);
  }

  const date = new Date(`${cleaned}T12:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    fail(`${label} is invalid.`);
  }

  return cleaned;
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
    fail(`${label} must be a valid website address.`);
  }
}

function slugPart(value) {
  return cleanText(value, 300)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeSport(value) {
  const cleaned = cleanText(value, 100)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  if (["cross country", "xc"].includes(cleaned)) {
    return "Cross Country";
  }

  if (["indoor track", "indoor track and field", "indoor"].includes(cleaned)) {
    return "Indoor Track";
  }

  if (["outdoor track", "outdoor track and field", "track", "track and field"].includes(cleaned)) {
    return "Outdoor Track";
  }

  fail("Choose Cross Country, Indoor Track, or Outdoor Track.");
}

function normalizeProgramScope(value) {
  const cleaned = cleanText(value, 50).toLowerCase();

  if (["boys", "boy", "male"].includes(cleaned)) {
    return "boys";
  }

  if (["girls", "girl", "female"].includes(cleaned)) {
    return "girls";
  }

  return "combined";
}

function normalizeSeasonStatus(value) {
  const cleaned = cleanText(value, 50).toLowerCase();

  if (["draft", "published", "archived"].includes(cleaned)) {
    return cleaned;
  }

  return "draft";
}

function normalizeGender(value) {
  const cleaned = cleanText(value, 50)
    .toLowerCase()
    .replace(/[^a-z]/g, "");

  if (["boy", "boys", "male", "m"].includes(cleaned)) {
    return "boys";
  }

  if (["girl", "girls", "female", "f"].includes(cleaned)) {
    return "girls";
  }

  return "unspecified";
}

function normalizeRosterStatus(value) {
  const cleaned = cleanText(value, 50)
    .toLowerCase()
    .replace(/[^a-z]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const allowed = new Set([
    "active",
    "inactive",
    "injured",
    "graduated",
    "transferred",
    "other"
  ]);

  return allowed.has(cleaned) ? cleaned : "active";
}

function cleanEvents(value) {
  const values = Array.isArray(value)
    ? value
    : cleanText(value, 2000).split(/[;,|]/);

  return [...new Set(
    values
      .map((item) => cleanText(item, 100))
      .filter(Boolean)
  )].slice(0, 30);
}

function cleanPersonalBests(value) {
  if (!value) {
    return {};
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    const result = {};

    Object.entries(value)
      .slice(0, 40)
      .forEach(([key, mark]) => {
        const cleanKey = cleanText(key, 100);
        const cleanMark = cleanText(mark, 200);

        if (cleanKey && cleanMark) {
          result[cleanKey] = cleanMark;
        }
      });

    return result;
  }

  const result = {};

  String(value)
    .split(/[\n;|]/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const separator = line.includes(":") ? ":" : line.includes("=") ? "=" : "";

      if (!separator) {
        result.Summary = cleanText(line, 500);
        return;
      }

      const [event, ...markParts] = line.split(separator);
      const key = cleanText(event, 100);
      const mark = cleanText(markParts.join(separator), 200);

      if (key && mark) {
        result[key] = mark;
      }
    });

  return result;
}

function buildProfileKey({ firstName, lastName, graduationYear, gender }) {
  return [
    slugPart(firstName),
    slugPart(lastName),
    graduationYear || "unknown",
    gender || "unspecified"
  ].join("|");
}

function buildSeasonKey({ seasonYear, sport, programScope }) {
  return [
    seasonYear,
    slugPart(sport),
    programScope
  ].join("|");
}

function deriveGraduationYear(grade, academicYearStart) {
  if (!grade || !academicYearStart) {
    return null;
  }

  return academicYearStart + (12 - grade) + 1;
}

function parseName(row) {
  const firstName = cleanText(
    row.first_name ?? row["First Name"] ?? row.first ?? row.First,
    120
  );
  const lastName = cleanText(
    row.last_name ?? row["Last Name"] ?? row.last ?? row.Last,
    120
  );

  if (firstName && lastName) {
    return { firstName, lastName };
  }

  const fullName = cleanText(
    row.athlete_name ?? row["Athlete Name"] ?? row.name ?? row.Name ?? row.Athlete,
    250
  );

  if (!fullName) {
    return { firstName: "", lastName: "" };
  }

  const parts = fullName.split(/\s+/).filter(Boolean);

  if (parts.length < 2) {
    return { firstName: parts[0] || "", lastName: "" };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1)
  };
}

function getRowValue(row, names) {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(row, name)) {
      const value = row[name];

      if (value !== null && value !== undefined && String(value).trim() !== "") {
        return value;
      }
    }
  }

  const normalized = new Map(
    Object.entries(row || {}).map(([key, value]) => [
      String(key).trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
      value
    ])
  );

  for (const name of names) {
    const key = String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

    if (normalized.has(key)) {
      const value = normalized.get(key);

      if (value !== null && value !== undefined && String(value).trim() !== "") {
        return value;
      }
    }
  }

  return "";
}

async function loadTeam(teamId) {
  const { data: team, error } = await supabaseAdmin
    .from("team_pages")
    .select(TEAM_FIELDS)
    .eq("id", teamId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!team) {
    fail("Team page not found.", 404);
  }

  return team;
}

function assertTeamAvailable(team, actor) {
  if (team.merged_into_team_id) {
    fail("This team page was merged into another profile and cannot be edited.", 403);
  }

  if (team.archived_at && actor.type !== "admin") {
    fail("This team page is archived and cannot be edited.", 403);
  }

  if (team.suspended && actor.type !== "admin") {
    fail("This team page has been suspended.", 403);
  }

  if (team.editing_locked && actor.type !== "admin") {
    fail("Podium Watch has temporarily locked editing for this team.", 403);
  }
}

async function loadSeason(teamId, seasonId) {
  const { data: season, error } = await supabaseAdmin
    .from("team_seasons")
    .select("*")
    .eq("id", seasonId)
    .eq("team_id", teamId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!season) {
    fail("Roster season not found.", 404);
  }

  return season;
}

async function loadRosterContext(teamId, selectedSeasonId = "") {
  const [teamResult, seasonResult] = await Promise.all([
    supabaseAdmin
      .from("team_pages")
      .select(TEAM_FIELDS)
      .eq("id", teamId)
      .maybeSingle(),
    supabaseAdmin
      .from("team_seasons")
      .select("*")
      .eq("team_id", teamId)
      .order("is_current", { ascending: false })
      .order("season_year", { ascending: false })
      .order("created_at", { ascending: false })
  ]);

  if (teamResult.error) {
    throw teamResult.error;
  }

  if (seasonResult.error) {
    throw seasonResult.error;
  }

  if (!teamResult.data) {
    fail("Team page not found.", 404);
  }

  const seasons = seasonResult.data || [];
  let selectedSeason = null;

  if (selectedSeasonId) {
    selectedSeason = seasons.find((season) => season.id === selectedSeasonId) || null;
  }

  if (!selectedSeason) {
    selectedSeason = seasons.find((season) => season.is_current) || seasons[0] || null;
  }

  if (!selectedSeason) {
    return {
      team: teamResult.data,
      seasons,
      selected_season: null,
      entries: [],
      completion: {
        score: 0,
        total: 0,
        missing_grade: 0,
        missing_gender: 0,
        missing_events: 0,
        missing_graduation_year: 0
      }
    };
  }

  const { data: entries, error: entryError } = await supabaseAdmin
    .from("team_roster_entries")
    .select("*")
    .eq("team_id", teamId)
    .eq("season_id", selectedSeason.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (entryError) {
    throw entryError;
  }

  const rows = entries || [];
  const athleteIds = [...new Set(rows.map((entry) => entry.athlete_id).filter(Boolean))];
  let athletes = [];
  let socialLinks = [];

  if (athleteIds.length > 0) {
    const [athleteResult, socialResult] = await Promise.all([
      supabaseAdmin
        .from("team_athletes")
        .select("*")
        .eq("team_id", teamId)
        .in("id", athleteIds),
      supabaseAdmin
        .from("athlete_social_links")
        .select("*")
        .eq("team_id", teamId)
        .in("athlete_id", athleteIds)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
    ]);

    if (athleteResult.error) {
      throw athleteResult.error;
    }

    if (socialResult.error) {
      throw socialResult.error;
    }

    athletes = athleteResult.data || [];
    socialLinks = socialResult.data || [];
  }

  const athleteMap = new Map(athletes.map((athlete) => [athlete.id, athlete]));
  const linksByAthlete = new Map();

  socialLinks.forEach((link) => {
    const list = linksByAthlete.get(link.athlete_id) || [];
    list.push(link);
    linksByAthlete.set(link.athlete_id, list);
  });

  const combinedEntries = rows
    .map((entry) => ({
      ...entry,
      athlete: athleteMap.get(entry.athlete_id) || null,
      social_links: linksByAthlete.get(entry.athlete_id) || []
    }))
    .filter((entry) => entry.athlete)
    .sort((a, b) => {
      const sortCompare = Number(a.sort_order || 0) - Number(b.sort_order || 0);

      if (sortCompare !== 0) {
        return sortCompare;
      }

      return String(a.athlete.last_name || "").localeCompare(String(b.athlete.last_name || "")) ||
        String(a.athlete.first_name || "").localeCompare(String(b.athlete.first_name || ""));
    });

  const total = combinedEntries.length;
  const missingGrade = combinedEntries.filter((entry) => !entry.grade).length;
  const missingGender = combinedEntries.filter((entry) => entry.athlete.gender === "unspecified").length;
  const missingEvents = combinedEntries.filter((entry) => !Array.isArray(entry.events) || entry.events.length === 0).length;
  const missingGraduationYear = combinedEntries.filter((entry) => !entry.athlete.graduation_year).length;
  const requiredFieldCount = total * 4;
  const missingFieldCount = missingGrade + missingGender + missingEvents + missingGraduationYear;
  const score = requiredFieldCount > 0
    ? Math.max(0, Math.min(100, Math.round(((requiredFieldCount - missingFieldCount) / requiredFieldCount) * 100)))
    : 0;

  return {
    team: teamResult.data,
    seasons,
    selected_season: selectedSeason,
    entries: combinedEntries,
    completion: {
      score,
      total,
      missing_grade: missingGrade,
      missing_gender: missingGender,
      missing_events: missingEvents,
      missing_graduation_year: missingGraduationYear
    }
  };
}

function normalizeImportRow(row, index, season) {
  const source = row && typeof row === "object" ? row : {};
  const { firstName, lastName } = parseName(source);
  const preferredName = cleanText(getRowValue(source, ["preferred_name", "Preferred Name", "Preferred"]), 120);
  const gender = normalizeGender(getRowValue(source, ["gender", "Gender", "Program", "Sex"]));
  const gradeValue = getRowValue(source, ["grade", "Grade", "Class"]);
  const graduationValue = getRowValue(source, ["graduation_year", "Graduation Year", "Grad Year", "Class Year"]);
  const errors = [];

  let grade = null;
  let graduationYear = null;

  if (cleanText(gradeValue, 30)) {
    const number = Number(cleanText(gradeValue, 30).replace(/[^0-9]/g, ""));

    if (!Number.isInteger(number) || number < 6 || number > 12) {
      errors.push("Grade must be between 6 and 12.");
    } else {
      grade = number;
    }
  }

  if (cleanText(graduationValue, 30)) {
    const number = Number(cleanText(graduationValue, 30).replace(/[^0-9]/g, ""));

    if (!Number.isInteger(number) || number < 2000 || number > 2100) {
      errors.push("Graduation year must be a four digit year.");
    } else {
      graduationYear = number;
    }
  }

  if (!graduationYear && grade) {
    graduationYear = deriveGraduationYear(grade, season.academic_year_start || season.season_year);
  }

  if (!firstName) {
    errors.push("First name is required.");
  }

  if (!lastName) {
    errors.push("Last name is required.");
  }

  if (gender === "unspecified") {
    errors.push("Gender must identify boys or girls.");
  }

  const events = cleanEvents(getRowValue(source, ["events", "Events", "Primary Events"]));
  const personalBests = cleanPersonalBests(getRowValue(source, ["personal_bests", "Personal Bests", "PRs", "Best Marks"]));

  [
    ["5K", ["5K", "5k", "XC 5K"]],
    ["3200", ["3200", "3200m", "3200 Time"]],
    ["1600", ["1600", "1600m", "1600 Time"]],
    ["800", ["800", "800m", "800 Time"]],
    ["400", ["400", "400m", "400 Time"]]
  ].forEach(([label, names]) => {
    const value = cleanText(getRowValue(source, names), 200);

    if (value) {
      personalBests[label] = value;
    }
  });

  const profileKey = buildProfileKey({
    firstName,
    lastName,
    graduationYear,
    gender
  });

  return {
    row_number: index + 2,
    first_name: firstName,
    last_name: lastName,
    preferred_name: preferredName || null,
    display_name: preferredName ? `${preferredName} ${lastName}` : `${firstName} ${lastName}`.trim(),
    gender,
    grade,
    graduation_year: graduationYear,
    athlete_status: normalizeRosterStatus(getRowValue(source, ["athlete_status", "Athlete Status"])),
    roster_status: normalizeRosterStatus(getRowValue(source, ["roster_status", "Roster Status", "Status"])),
    captain: cleanBoolean(getRowValue(source, ["captain", "Captain"])),
    events,
    personal_bests: personalBests,
    athlete_public_visible: getRowValue(source, ["athlete_public_visible", "Athlete Public", "Public Athlete"]) === ""
      ? true
      : cleanBoolean(getRowValue(source, ["athlete_public_visible", "Athlete Public", "Public Athlete"])),
    entry_public_visible: getRowValue(source, ["public_visible", "Public", "Show Publicly"]) === ""
      ? true
      : cleanBoolean(getRowValue(source, ["public_visible", "Public", "Show Publicly"])),
    sort_order: Number(cleanText(getRowValue(source, ["sort_order", "Sort Order"]), 20)) || 0,
    notes: cleanNullableText(getRowValue(source, ["notes", "Notes"]), 1000),
    bio: cleanNullableText(getRowValue(source, ["bio", "Bio"]), 3000),
    photo_url: cleanText(getRowValue(source, ["photo_url", "Photo URL"]), 2000),
    hometown: cleanNullableText(getRowValue(source, ["hometown", "Hometown"]), 200),
    college_commitment: cleanNullableText(getRowValue(source, ["college_commitment", "College Commitment", "College"]), 300),
    profile_key: profileKey,
    errors
  };
}

async function buildImportPlan(teamId, season, rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    fail("The roster import does not contain any athlete rows.");
  }

  if (rows.length > MAX_IMPORT_ROWS) {
    fail(`The roster import can contain no more than ${MAX_IMPORT_ROWS} athletes.`);
  }

  const normalizedRows = rows.map((row, index) => normalizeImportRow(row, index, season));
  const profileKeys = [...new Set(normalizedRows.map((row) => row.profile_key).filter(Boolean))];
  let athletes = [];

  if (profileKeys.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("team_athletes")
      .select("id, profile_key, first_name, last_name, graduation_year, gender")
      .eq("team_id", teamId)
      .in("profile_key", profileKeys);

    if (error) {
      throw error;
    }

    athletes = data || [];
  }

  const athleteByKey = new Map(athletes.map((athlete) => [athlete.profile_key, athlete]));
  const athleteIds = athletes.map((athlete) => athlete.id);
  let existingEntries = [];

  if (athleteIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("team_roster_entries")
      .select("id, athlete_id")
      .eq("season_id", season.id)
      .in("athlete_id", athleteIds);

    if (error) {
      throw error;
    }

    existingEntries = data || [];
  }

  const entryByAthlete = new Map(existingEntries.map((entry) => [entry.athlete_id, entry]));
  const seenKeys = new Set();

  const plan = normalizedRows.map((row) => {
    const errors = [...row.errors];

    if (seenKeys.has(row.profile_key)) {
      errors.push("This athlete appears more than once in the upload.");
    }

    seenKeys.add(row.profile_key);

    if (row.photo_url) {
      try {
        row.photo_url = cleanUrl(row.photo_url, "Photo URL");
      } catch (error) {
        errors.push(error.message);
      }
    }

    const athlete = athleteByKey.get(row.profile_key) || null;
    const entry = athlete ? entryByAthlete.get(athlete.id) || null : null;

    return {
      ...row,
      athlete_id: athlete?.id || null,
      entry_id: entry?.id || null,
      status: errors.length > 0
        ? "error"
        : entry
          ? "update"
          : athlete
            ? "add"
            : "insert",
      errors
    };
  });

  const summary = {
    total: plan.length,
    insert: plan.filter((row) => row.status === "insert").length,
    add: plan.filter((row) => row.status === "add").length,
    update: plan.filter((row) => row.status === "update").length,
    error: plan.filter((row) => row.status === "error").length
  };

  return { plan, summary };
}

async function createSeason(teamId, body, actor) {
  const seasonYear = cleanInteger(body.season_year, {
    label: "Season year",
    min: 2000,
    max: 2100
  });
  const academicYearStart = cleanInteger(body.academic_year_start || seasonYear, {
    label: "Academic year start",
    min: 2000,
    max: 2100
  });
  const sport = normalizeSport(body.sport);
  const programScope = normalizeProgramScope(body.program_scope);
  const name = cleanText(body.name, 200) || `${seasonYear} ${sport}`;
  const seasonKey = buildSeasonKey({ seasonYear, sport, programScope });

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("team_seasons")
    .select("id")
    .eq("team_id", teamId)
    .eq("season_key", seasonKey)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    fail("That roster season already exists for this team.", 409);
  }

  const requestedCurrent = cleanBoolean(body.is_current);

  const payload = {
    team_id: teamId,
    season_key: seasonKey,
    // team_seasons has a separate, real, not-null "year" column distinct
    // from season_year (confirmed live -- both exist as their own
    // columns). This code path never populated it, which meant every
    // real attempt to create a season failed outright -- confirmed live:
    // team_seasons has zero rows in production, so this had never
    // actually succeeded for a real coach. Found and fixed while
    // building Athlete Access, which needs a real roster season/athlete
    // to test against. See docs/DECISIONS.md, 2026-08-13.
    year: seasonYear,
    season_year: seasonYear,
    academic_year_start: academicYearStart,
    sport,
    name,
    program_scope: programScope,
    status: "draft",
    is_current: false,
    start_date: cleanDate(body.start_date, "Start date"),
    end_date: cleanDate(body.end_date, "End date"),
    notes: cleanNullableText(body.notes, 3000),
    source: actor.type === "admin" ? "admin" : "team_user",
    created_by_user_id: actor.type === "team_user" ? actor.userId : null,
    created_by_admin: actor.type === "admin" ? actor.label : null
  };

  const { data: season, error } = await supabaseAdmin
    .from("team_seasons")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  if (requestedCurrent) {
    const { error: clearCurrentError } = await supabaseAdmin
      .from("team_seasons")
      .update({ is_current: false })
      .eq("team_id", teamId)
      .eq("sport", sport)
      .eq("program_scope", programScope)
      .neq("id", season.id);

    if (clearCurrentError) {
      throw clearCurrentError;
    }

    const { data: currentSeason, error: setCurrentError } = await supabaseAdmin
      .from("team_seasons")
      .update({ is_current: true })
      .eq("id", season.id)
      .eq("team_id", teamId)
      .select("*")
      .single();

    if (setCurrentError) {
      throw setCurrentError;
    }

    Object.assign(season, currentSeason);
  }

  await writeTeamChange({
    teamId,
    actorType: actor.type,
    actorId: actor.id,
    action: "roster_season_created",
    summary: `${name} roster season was created.`,
    changedFields: ["team_seasons"],
    afterData: season
  });

  return season;
}

async function saveSeason(teamId, body, actor) {
  const seasonId = cleanUuid(body.season_id, "Season ID");
  const current = await loadSeason(teamId, seasonId);
  const seasonYear = cleanInteger(body.season_year ?? current.season_year, {
    label: "Season year",
    min: 2000,
    max: 2100
  });
  const academicYearStart = cleanInteger(
    body.academic_year_start ?? current.academic_year_start ?? seasonYear,
    { label: "Academic year start", min: 2000, max: 2100 }
  );
  const sport = normalizeSport(body.sport ?? current.sport);
  const programScope = normalizeProgramScope(body.program_scope ?? current.program_scope);
  const status = normalizeSeasonStatus(body.status ?? current.status);
  const isCurrent = cleanBoolean(body.is_current);
  const name = cleanText(body.name ?? current.name, 200) || `${seasonYear} ${sport}`;
  const seasonKey = buildSeasonKey({ seasonYear, sport, programScope });

  const updates = {
    season_key: seasonKey,
    // See createSeason()'s matching note -- "year" is a separate,
    // real, not-null column from season_year.
    year: seasonYear,
    season_year: seasonYear,
    academic_year_start: academicYearStart,
    sport,
    name,
    program_scope: programScope,
    status,
    is_current: false,
    start_date: cleanDate(body.start_date, "Start date"),
    end_date: cleanDate(body.end_date, "End date"),
    notes: cleanNullableText(body.notes, 3000),
    published_at: status === "published"
      ? current.published_at || new Date().toISOString()
      : current.published_at,
    archived_at: status === "archived"
      ? current.archived_at || new Date().toISOString()
      : null
  };

  const { data: savedSeason, error } = await supabaseAdmin
    .from("team_seasons")
    .update(updates)
    .eq("id", seasonId)
    .eq("team_id", teamId)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      fail("That roster season already exists for this team.", 409);
    }

    throw error;
  }

  let season = savedSeason;

  if (isCurrent) {
    const { error: clearCurrentError } = await supabaseAdmin
      .from("team_seasons")
      .update({ is_current: false })
      .eq("team_id", teamId)
      .eq("sport", sport)
      .eq("program_scope", programScope)
      .neq("id", seasonId);

    if (clearCurrentError) {
      throw clearCurrentError;
    }

    const { data: currentSeason, error: setCurrentError } = await supabaseAdmin
      .from("team_seasons")
      .update({ is_current: true })
      .eq("id", seasonId)
      .eq("team_id", teamId)
      .select("*")
      .single();

    if (setCurrentError) {
      throw setCurrentError;
    }

    season = currentSeason;
  }

  await writeTeamChange({
    teamId,
    actorType: actor.type,
    actorId: actor.id,
    action: "roster_season_updated",
    summary: `${season.name} roster season was updated.`,
    changedFields: ["team_seasons"],
    beforeData: current,
    afterData: season
  });

  return season;
}

async function saveAthlete(teamId, body, actor) {
  const seasonId = cleanUuid(body.season_id, "Season ID");
  const season = await loadSeason(teamId, seasonId);
  const entryId = cleanText(body.entry_id, 100)
    ? cleanUuid(body.entry_id, "Roster entry ID")
    : "";
  const requestedAthleteId = cleanText(body.athlete_id, 100)
    ? cleanUuid(body.athlete_id, "Athlete ID")
    : "";
  const firstName = cleanText(body.first_name, 120);
  const lastName = cleanText(body.last_name, 120);

  if (!firstName || !lastName) {
    fail("First name and last name are required.");
  }

  const gender = normalizeGender(body.gender);
  const grade = cleanInteger(body.grade, {
    label: "Grade",
    min: 6,
    max: 12,
    nullable: true
  });
  let graduationYear = cleanInteger(body.graduation_year, {
    label: "Graduation year",
    min: 2000,
    max: 2100,
    nullable: true
  });

  if (!graduationYear && grade) {
    graduationYear = deriveGraduationYear(
      grade,
      season.academic_year_start || season.season_year
    );
  }

  const profileKey = buildProfileKey({ firstName, lastName, graduationYear, gender });
  let athlete = null;
  let beforeAthlete = null;

  if (requestedAthleteId) {
    const { data, error } = await supabaseAdmin
      .from("team_athletes")
      .select("*")
      .eq("id", requestedAthleteId)
      .eq("team_id", teamId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      fail("Athlete record not found.", 404);
    }

    athlete = data;
    beforeAthlete = data;
  } else {
    const { data, error } = await supabaseAdmin
      .from("team_athletes")
      .select("*")
      .eq("team_id", teamId)
      .eq("profile_key", profileKey)
      .maybeSingle();

    if (error) {
      throw error;
    }

    athlete = data || null;
    beforeAthlete = data || null;
  }

  if (athlete && requestedAthleteId && athlete.profile_key !== profileKey) {
    const { data: duplicate, error: duplicateError } = await supabaseAdmin
      .from("team_athletes")
      .select("id")
      .eq("team_id", teamId)
      .eq("profile_key", profileKey)
      .neq("id", athlete.id)
      .maybeSingle();

    if (duplicateError) {
      throw duplicateError;
    }

    if (duplicate) {
      fail("Another athlete with the same name, graduation year, and program already exists.", 409);
    }
  }

  const athletePayload = {
    team_id: teamId,
    profile_key: profileKey,
    first_name: firstName,
    last_name: lastName,
    preferred_name: cleanNullableText(body.preferred_name, 120),
    display_name: cleanNullableText(body.display_name, 250) ||
      `${cleanText(body.preferred_name, 120) || firstName} ${lastName}`,
    gender,
    graduation_year: graduationYear,
    status: body.athlete_status !== undefined
      ? normalizeRosterStatus(body.athlete_status)
      : athlete?.status || "active",
    bio: cleanNullableText(body.bio, 3000),
    photo_url: cleanUrl(body.photo_url, "Photo URL"),
    hometown: cleanNullableText(body.hometown, 200),
    college_commitment: cleanNullableText(body.college_commitment, 300),
    public_visible: cleanBoolean(body.athlete_public_visible),
    updated_by_user_id: actor.type === "team_user" ? actor.userId : null
  };

  if (athlete) {
    const { data, error } = await supabaseAdmin
      .from("team_athletes")
      .update(athletePayload)
      .eq("id", athlete.id)
      .eq("team_id", teamId)
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        fail("Another athlete with the same name, graduation year, and program already exists.", 409);
      }

      throw error;
    }

    athlete = data;
  } else {
    const { data, error } = await supabaseAdmin
      .from("team_athletes")
      .insert({
        ...athletePayload,
        created_by_user_id: actor.type === "team_user" ? actor.userId : null
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        fail("This athlete already exists for the team.", 409);
      }

      throw error;
    }

    athlete = data;
  }

  let beforeEntry = null;

  if (entryId) {
    const { data, error } = await supabaseAdmin
      .from("team_roster_entries")
      .select("*")
      .eq("id", entryId)
      .eq("team_id", teamId)
      .eq("season_id", seasonId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      fail("Roster entry not found.", 404);
    }

    beforeEntry = data;
  } else {
    const { data, error } = await supabaseAdmin
      .from("team_roster_entries")
      .select("*")
      .eq("season_id", seasonId)
      .eq("athlete_id", athlete.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    beforeEntry = data || null;
  }

  const entryPayload = {
    team_id: teamId,
    season_id: seasonId,
    athlete_id: athlete.id,
    // A separate, real, not-null denormalized snapshot column on
    // team_roster_entries (team_athletes carries the real name; this
    // table has no first_name/last_name of its own) -- never populated
    // by this code path before. Same previously-undiscovered-bug class
    // as team_seasons.year (see the note above createSeason()):
    // team_roster_entries also had zero real rows in production before
    // this was found while building Athlete Access. See
    // docs/DECISIONS.md, 2026-08-13.
    athlete_name: athlete.display_name,
    grade,
    captain: cleanBoolean(body.captain),
    events: cleanEvents(body.events),
    personal_bests: cleanPersonalBests(body.personal_bests),
    roster_status: normalizeRosterStatus(body.roster_status),
    public_visible: cleanBoolean(body.entry_public_visible),
    sort_order: cleanInteger(body.sort_order, {
      label: "Sort order",
      min: -9999,
      max: 9999,
      fallback: 0
    }),
    notes: cleanNullableText(body.notes, 2000),
    updated_by_user_id: actor.type === "team_user" ? actor.userId : null
  };

  let entry;

  if (beforeEntry) {
    const { data, error } = await supabaseAdmin
      .from("team_roster_entries")
      .update(entryPayload)
      .eq("id", beforeEntry.id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    entry = data;
  } else {
    const { data, error } = await supabaseAdmin
      .from("team_roster_entries")
      .insert({
        ...entryPayload,
        created_by_user_id: actor.type === "team_user" ? actor.userId : null
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        fail("This athlete is already on the selected roster.", 409);
      }

      throw error;
    }

    entry = data;
  }

  const athleteProfile = await syncRosterAthleteProfile({
    teamId,
    athlete,
    actor: actor.label || actor.type || "Team roster"
  });

  if (athleteProfile?.id) {
    athlete = {
      ...athlete,
      athlete_profile_id: athleteProfile.id,
      athlete_profile_slug: athleteProfile.slug
    };
  }

  await writeTeamChange({
    teamId,
    actorType: actor.type,
    actorId: actor.id,
    action: beforeEntry ? "roster_athlete_updated" : "roster_athlete_added",
    summary: `${athlete.display_name || `${athlete.first_name} ${athlete.last_name}`} was ${beforeEntry ? "updated on" : "added to"} ${season.name}.`,
    changedFields: ["team_athletes", "team_roster_entries"],
    beforeData: {
      athlete: beforeAthlete,
      entry: beforeEntry
    },
    afterData: {
      athlete,
      entry
    },
    metadata: {
      season_id: season.id,
      season_name: season.name
    }
  });

  return { athlete, entry };
}

async function removeEntry(teamId, body, actor) {
  const entryId = cleanUuid(body.entry_id, "Roster entry ID");
  const { data: entry, error: loadError } = await supabaseAdmin
    .from("team_roster_entries")
    .select("*")
    .eq("id", entryId)
    .eq("team_id", teamId)
    .maybeSingle();

  if (loadError) {
    throw loadError;
  }

  if (!entry) {
    fail("Roster entry not found.", 404);
  }

  const { data: athlete } = await supabaseAdmin
    .from("team_athletes")
    .select("first_name, last_name, display_name")
    .eq("id", entry.athlete_id)
    .maybeSingle();

  const { error } = await supabaseAdmin
    .from("team_roster_entries")
    .delete()
    .eq("id", entryId)
    .eq("team_id", teamId);

  if (error) {
    throw error;
  }

  await writeTeamChange({
    teamId,
    actorType: actor.type,
    actorId: actor.id,
    action: "roster_athlete_removed",
    summary: `${athlete?.display_name || [athlete?.first_name, athlete?.last_name].filter(Boolean).join(" ") || "An athlete"} was removed from a roster season.`,
    changedFields: ["team_roster_entries"],
    beforeData: entry
  });

  return { removed: true };
}

async function saveSocialLink(teamId, body, actor) {
  const athleteId = cleanUuid(body.athlete_id, "Athlete ID");
  const rosterEntryId = cleanUuid(body.roster_entry_id, "Roster entry ID");
  const linkId = cleanText(body.link_id, 100)
    ? cleanUuid(body.link_id, "Social link ID")
    : "";

  const { data: athlete, error: athleteError } = await supabaseAdmin
    .from("team_athletes")
    .select("id, first_name, last_name, display_name")
    .eq("id", athleteId)
    .eq("team_id", teamId)
    .maybeSingle();

  if (athleteError) {
    throw athleteError;
  }

  if (!athlete) {
    fail("Athlete record not found.", 404);
  }

  const { data: entry, error: entryError } = await supabaseAdmin
    .from("team_roster_entries")
    .select("id")
    .eq("id", rosterEntryId)
    .eq("team_id", teamId)
    .eq("athlete_id", athleteId)
    .maybeSingle();

  if (entryError) {
    throw entryError;
  }

  if (!entry) {
    fail("Roster entry not found.", 404);
  }

  if (!linkId) {
    const { count, error: countError } = await supabaseAdmin
      .from("athlete_social_links")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .eq("athlete_id", athleteId);

    if (countError) {
      throw countError;
    }

    if (Number(count) >= MAX_SOCIAL_LINKS) {
      fail(`An athlete can have no more than ${MAX_SOCIAL_LINKS} public links.`);
    }
  }

  const platform = cleanText(body.platform, 80);
  const url = cleanUrl(body.url, "Social link");

  if (!platform || !url) {
    fail("Social platform and website address are required.");
  }

  const athleteConsent = cleanBoolean(body.athlete_consent_confirmed);
  const guardianConsent = cleanBoolean(body.guardian_consent_confirmed);
  const approvedByTeam = cleanBoolean(body.approved_by_team);
  const published = cleanBoolean(body.published);

  if (published && !(athleteConsent && guardianConsent && approvedByTeam)) {
    fail("Athlete consent, guardian consent, and team approval are required before publishing an athlete social link.");
  }

  const payload = {
    team_id: teamId,
    athlete_id: athleteId,
    roster_entry_id: rosterEntryId,
    platform,
    label: cleanNullableText(body.label, 150),
    url,
    published,
    verified: cleanBoolean(body.verified),
    athlete_consent_confirmed: athleteConsent,
    guardian_consent_confirmed: guardianConsent,
    approved_by_team: approvedByTeam,
    consent_recorded_by: athleteConsent && guardianConsent && approvedByTeam
      ? actor.label
      : null,
    sort_order: cleanInteger(body.sort_order, {
      label: "Sort order",
      min: -9999,
      max: 9999,
      fallback: 0
    })
  };

  let link;

  if (linkId) {
    const { data, error } = await supabaseAdmin
      .from("athlete_social_links")
      .update(payload)
      .eq("id", linkId)
      .eq("team_id", teamId)
      .eq("athlete_id", athleteId)
      .select("*")
      .single();

    if (error) {
      if (String(error.message || "").includes("ATHLETE_SOCIAL_CONSENT_REQUIRED")) {
        fail("All consent boxes must be confirmed before publishing an athlete social link.");
      }

      throw error;
    }

    link = data;
  } else {
    const { data, error } = await supabaseAdmin
      .from("athlete_social_links")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      if (String(error.message || "").includes("ATHLETE_SOCIAL_CONSENT_REQUIRED")) {
        fail("All consent boxes must be confirmed before publishing an athlete social link.");
      }

      throw error;
    }

    link = data;
  }

  await writeTeamChange({
    teamId,
    actorType: actor.type,
    actorId: actor.id,
    action: linkId ? "athlete_social_updated" : "athlete_social_added",
    summary: `${platform} link was ${linkId ? "updated for" : "added for"} ${athlete.display_name || `${athlete.first_name} ${athlete.last_name}`}.`,
    changedFields: ["athlete_social_links"],
    afterData: link,
    metadata: { athlete_id: athleteId }
  });

  return link;
}

async function deleteSocialLink(teamId, body, actor) {
  const linkId = cleanUuid(body.link_id, "Social link ID");
  const { data: link, error: loadError } = await supabaseAdmin
    .from("athlete_social_links")
    .select("*")
    .eq("id", linkId)
    .eq("team_id", teamId)
    .maybeSingle();

  if (loadError) {
    throw loadError;
  }

  if (!link) {
    fail("Athlete social link not found.", 404);
  }

  const { error } = await supabaseAdmin
    .from("athlete_social_links")
    .delete()
    .eq("id", linkId)
    .eq("team_id", teamId);

  if (error) {
    throw error;
  }

  await writeTeamChange({
    teamId,
    actorType: actor.type,
    actorId: actor.id,
    action: "athlete_social_deleted",
    summary: `${link.platform || "Athlete social"} link was deleted.`,
    changedFields: ["athlete_social_links"],
    beforeData: link
  });

  return { deleted: true };
}

async function commitImport(teamId, body, actor) {
  const seasonId = cleanUuid(body.season_id, "Season ID");
  const season = await loadSeason(teamId, seasonId);
  const { plan, summary } = await buildImportPlan(teamId, season, body.rows);
  const validRows = plan.filter((row) => row.status !== "error");

  if (body.confirm !== true) {
    fail("Confirm the roster import before saving it.");
  }

  if (validRows.length === 0) {
    fail("No valid athlete rows are ready to import.");
  }

  const { data: result, error } = await supabaseAdmin.rpc(
    "team_commit_roster_import_v1",
    {
      p_team_id: teamId,
      p_season_id: seasonId,
      p_rows: validRows,
      p_actor_id: actor.type === "team_user" ? actor.userId : null
    }
  );

  if (error) {
    throw error;
  }

  // team_commit_roster_import_v1 never sets team_roster_entries.athlete_name
  // (a real, denormalized, not-null-by-default column) -- confirmed
  // directly against production; see install/20_ROSTER_IMPORT_ATHLETE_NAME_FIX.sql
  // for the full story. This backfills it immediately from
  // team_athletes.display_name for every row the import just touched, so
  // the column is never actually left wrong/blank in practice even though
  // the RPC itself doesn't set it. Best-effort: a failure here shouldn't
  // undo an otherwise-successful import.
  const { error: backfillError } = await supabaseAdmin.rpc(
    "team_backfill_roster_entry_names_v1",
    { p_season_id: seasonId }
  );
  if (backfillError) {
    console.error("Roster entry name backfill failed:", backfillError);
  }

  const insertedCount = Number(result?.inserted_count || 0);
  const updatedCount = Number(result?.updated_count || 0);

  const { error: batchError } = await supabaseAdmin
    .from("team_roster_import_batches")
    .insert({
      team_id: teamId,
      season_id: seasonId,
      actor_type: actor.type,
      actor_id: actor.id,
      file_name: cleanNullableText(body.file_name, 300),
      status: "committed",
      row_count: summary.total,
      inserted_count: insertedCount,
      updated_count: updatedCount,
      error_count: summary.error,
      summary: {
        ...summary,
        inserted_count: insertedCount,
        updated_count: updatedCount
      }
    });

  if (batchError) {
    console.error("Unable to save roster import batch:", batchError);
  }

  await writeTeamChange({
    teamId,
    actorType: actor.type,
    actorId: actor.id,
    action: "roster_import_committed",
    summary: `${validRows.length} roster rows were imported into ${season.name}.`,
    changedFields: ["team_athletes", "team_roster_entries"],
    metadata: {
      season_id: seasonId,
      file_name: cleanNullableText(body.file_name, 300),
      summary,
      result
    }
  });

  return {
    summary: {
      ...summary,
      inserted_count: insertedCount,
      updated_count: updatedCount
    }
  };
}

async function rolloverSeason(teamId, body, actor) {
  const sourceSeasonId = cleanUuid(body.source_season_id, "Source season ID");
  const targetSeasonId = cleanUuid(body.target_season_id, "Target season ID");
  const sourceSeason = await loadSeason(teamId, sourceSeasonId);
  const targetSeason = await loadSeason(teamId, targetSeasonId);

  const { data: result, error } = await supabaseAdmin.rpc(
    "team_rollover_season_v1",
    {
      p_team_id: teamId,
      p_source_season_id: sourceSeasonId,
      p_target_season_id: targetSeasonId,
      p_actor_id: actor.type === "team_user" ? actor.userId : null
    }
  );

  if (error) {
    const message = String(error.message || "");

    if (message.includes("ROSTER_TARGET_MUST_DIFFER")) {
      fail("Choose a different target season.");
    }

    throw error;
  }

  if (cleanBoolean(body.archive_source)) {
    await supabaseAdmin
      .from("team_seasons")
      .update({
        status: sourceSeason.status === "published" || sourceSeason.status === "archived"
          ? "archived"
          : "draft",
        is_current: false,
        archived_at: new Date().toISOString()
      })
      .eq("id", sourceSeasonId)
      .eq("team_id", teamId);
  }

  if (cleanBoolean(body.make_target_current)) {
    await supabaseAdmin
      .from("team_seasons")
      .update({ is_current: false })
      .eq("team_id", teamId)
      .eq("sport", targetSeason.sport)
      .eq("program_scope", targetSeason.program_scope);

    await supabaseAdmin
      .from("team_seasons")
      .update({ is_current: true })
      .eq("id", targetSeasonId)
      .eq("team_id", teamId);
  }

  await writeTeamChange({
    teamId,
    actorType: actor.type,
    actorId: actor.id,
    action: "roster_season_rolled_over",
    summary: `${sourceSeason.name} roster was moved into ${targetSeason.name}.`,
    changedFields: ["team_roster_entries", "team_seasons"],
    metadata: {
      source_season_id: sourceSeasonId,
      target_season_id: targetSeasonId,
      result,
      archived_source: cleanBoolean(body.archive_source)
    }
  });

  return result || {};
}

export async function handleTeamRosterAction({
  teamId,
  body,
  actor
}) {
  const cleanTeamId = cleanUuid(teamId, "Team ID");
  const team = await loadTeam(cleanTeamId);
  assertTeamAvailable(team, actor);
  const action = cleanText(body.action, 80).toLowerCase() || "get";

  if (action === "get") {
    return loadRosterContext(cleanTeamId, cleanText(body.season_id, 100));
  }

  if (action === "create_season") {
    const season = await createSeason(cleanTeamId, body, actor);
    return loadRosterContext(cleanTeamId, season.id);
  }

  if (action === "save_season") {
    const season = await saveSeason(cleanTeamId, body, actor);
    return loadRosterContext(cleanTeamId, season.id);
  }

  if (action === "save_athlete") {
    await saveAthlete(cleanTeamId, body, actor);
    return loadRosterContext(cleanTeamId, cleanUuid(body.season_id, "Season ID"));
  }

  if (action === "remove_entry") {
    const { data: entry } = await supabaseAdmin
      .from("team_roster_entries")
      .select("season_id")
      .eq("id", cleanUuid(body.entry_id, "Roster entry ID"))
      .eq("team_id", cleanTeamId)
      .maybeSingle();

    await removeEntry(cleanTeamId, body, actor);
    return loadRosterContext(cleanTeamId, entry?.season_id || "");
  }

  if (action === "save_social") {
    await saveSocialLink(cleanTeamId, body, actor);
    return loadRosterContext(cleanTeamId, cleanUuid(body.season_id, "Season ID"));
  }

  if (action === "delete_social") {
    await deleteSocialLink(cleanTeamId, body, actor);
    return loadRosterContext(cleanTeamId, cleanUuid(body.season_id, "Season ID"));
  }

  if (action === "preview_import") {
    const season = await loadSeason(cleanTeamId, cleanUuid(body.season_id, "Season ID"));
    return buildImportPlan(cleanTeamId, season, body.rows);
  }

  if (action === "commit_import") {
    const result = await commitImport(cleanTeamId, body, actor);
    return {
      ...result,
      context: await loadRosterContext(cleanTeamId, cleanUuid(body.season_id, "Season ID"))
    };
  }

  if (action === "rollover") {
    const result = await rolloverSeason(cleanTeamId, body, actor);
    return {
      result,
      context: await loadRosterContext(cleanTeamId, cleanUuid(body.target_season_id, "Target season ID"))
    };
  }

  fail("Unsupported roster action.");
}
