import { supabaseAdmin } from "../../lib/supabase-admin.mjs";
import {
  canonicalDivision,
  cleanText,
  displaySchoolName,
  isMissingFoundationError,
  loadBundledSchoolDataset,
  loadBundledTrackDataset,
  normalizeLookup,
  summarizeSchoolDataset
} from "../../lib/ohio_foundation_service.mjs";

function parseRequest(request) {
  const query = request.query || {};
  let body = {};

  if (request.method === "POST") {
    if (typeof request.body === "string") {
      try {
        body = JSON.parse(request.body);
      } catch {
        const error = new Error("The submitted directory request is invalid.");
        error.status = 400;
        throw error;
      }
    } else {
      body = request.body || {};
    }
  }

  return {
    ...query,
    ...body
  };
}

function numberValue(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(minimum, Math.min(maximum, parsed));
}

function matchesFilters(school, filters) {
  const search = normalizeLookup(filters.search);
  const division = canonicalDivision(filters.division);
  const district = cleanText(filters.athletic_district, 40).toLowerCase();
  const changedOnly = String(filters.changed_only || "").toLowerCase() === "true";

  if (search) {
    const haystack = normalizeLookup([
      school.school_name,
      school.city,
      school.athletic_district,
      school.ohsaa_school_id
    ].join(" "));

    if (!search.split(/\s+/).every((term) => haystack.includes(term))) {
      return false;
    }
  }

  if (
    division &&
    canonicalDivision(school.division) !== division
  ) {
    return false;
  }

  if (
    district &&
    cleanText(school.athletic_district, 40).toLowerCase() !== district
  ) {
    return false;
  }

  if (
    changedOnly &&
    canonicalDivision(school.division) ===
      canonicalDivision(school.previous_division)
  ) {
    return false;
  }

  return true;
}

function staticRows(dataset) {
  return (dataset.schools || []).map((school) => ({
    id: null,
    ohsaa_school_id: Number(school.school_id),
    school_name: displaySchoolName(school.school_name),
    official_school_name: school.school_name,
    city: school.city,
    athletic_district: school.athletic_district,
    division: canonicalDivision(
      school.division_2026_27_2027_28
    ),
    previous_division: canonicalDivision(
      school.division_2025_26
    ),
    base_enrollment: Number(school.boys_base_enrollment) || null,
    team_slug: null,
    team_published: false,
    team_claimed: false,
    source: "bundled_official"
  }));
}

async function databaseRows() {
  const schoolRows = [];
  const pageSize = 1000;

  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabaseAdmin
      .from("ohio_schools")
      .select(`
        id,
        ohsaa_school_id,
        school_name,
        city,
        athletic_district,
        status,
        last_verified_at
      `)
      .eq("status", "active")
      .order("school_name", { ascending: true })
      .range(start, start + pageSize - 1);

    if (error) {
      throw error;
    }

    schoolRows.push(...(data || []));

    if (!data || data.length < pageSize) {
      break;
    }
  }

  const schoolIds = schoolRows.map((row) => row.id);
  const divisionsBySchool = new Map();
  const teamsBySchool = new Map();
  const memberTeamIds = new Set();

  for (let index = 0; index < schoolIds.length; index += 200) {
    const chunk = schoolIds.slice(index, index + 200);
    const [divisionResult, teamResult] = await Promise.all([
      supabaseAdmin
        .from("ohio_school_divisions")
        .select(`
          id,
          school_id,
          division,
          previous_division,
          base_enrollment,
          last_verified_at
        `)
        .in("school_id", chunk)
        .eq("sport", "cross_country")
        .eq("gender", "boys")
        .eq("season_start_year", 2026)
        .eq("season_end_year", 2027)
        .eq("current", true),
      supabaseAdmin
        .from("team_pages")
        .select(`
          id,
          ohio_school_id,
          slug,
          published,
          suspended,
          archived_at,
          merged_into_team_id
        `)
        .in("ohio_school_id", chunk)
        .is("archived_at", null)
        .is("merged_into_team_id", null)
    ]);

    if (divisionResult.error) {
      throw divisionResult.error;
    }

    if (teamResult.error) {
      throw teamResult.error;
    }

    (divisionResult.data || []).forEach((row) => {
      divisionsBySchool.set(row.school_id, row);
    });

    const activeTeams = (teamResult.data || []).filter(
      (team) => !team.suspended
    );

    activeTeams.forEach((team) => {
      teamsBySchool.set(team.ohio_school_id, team);
    });

    const teamIds = activeTeams.map((team) => team.id);

    if (teamIds.length > 0) {
      const { data: members, error: memberError } = await supabaseAdmin
        .from("team_members")
        .select("team_id")
        .in("team_id", teamIds)
        .eq("status", "active");

      if (memberError) {
        throw memberError;
      }

      (members || []).forEach((member) => {
        memberTeamIds.add(member.team_id);
      });
    }
  }

  return schoolRows
    .map((school) => {
      const assignment = divisionsBySchool.get(school.id);
      const team = teamsBySchool.get(school.id);

      if (!assignment) {
        return null;
      }

      return {
        id: school.id,
        ohsaa_school_id: school.ohsaa_school_id,
        school_name: school.school_name,
        official_school_name: school.school_name,
        city: school.city,
        athletic_district: school.athletic_district,
        division: canonicalDivision(assignment.division),
        previous_division: canonicalDivision(
          assignment.previous_division
        ),
        base_enrollment: assignment.base_enrollment,
        team_slug:
          team?.published
            ? team.slug
            : null,
        team_published: Boolean(team?.published),
        team_claimed: Boolean(team && memberTeamIds.has(team.id)),
        last_verified_at:
          assignment.last_verified_at ||
          school.last_verified_at ||
          null,
        source: "database"
      };
    })
    .filter(Boolean);
}

export default async function handler(request, response) {
  response.setHeader(
    "Cache-Control",
    "public, max-age=60, s-maxage=300, stale-while-revalidate=1800"
  );

  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    const input = parseRequest(request);
    const view = cleanText(input.view, 30).toLowerCase() || "schools";

    if (view === "sites") {
      const track = await loadBundledTrackDataset();
      return response.status(200).json({
        source: {
          title: track.title,
          updated_date: track.updatedDate,
          last_verified_date: track.lastVerifiedDate,
          official_source_url: track.officialSourceUrl,
          subject_to_change: track.subjectToChange,
          notes: track.notes
        },
        sites: track.regions || []
      });
    }

    const dataset = await loadBundledSchoolDataset();
    let rows;
    let databaseAvailable = true;

    try {
      rows = await databaseRows();

      if (rows.length === 0) {
        rows = staticRows(dataset);
        databaseAvailable = false;
      }
    } catch (error) {
      if (!isMissingFoundationError(error)) {
        console.error("Ohio school database lookup failed:", error);
      }

      rows = staticRows(dataset);
      databaseAvailable = false;
    }

    const filtered = rows.filter((school) =>
      matchesFilters(school, input)
    );
    const limit = numberValue(input.limit, 100, 1, 600);
    const totalPages = Math.max(
      1,
      Math.ceil(filtered.length / limit)
    );
    const page = Math.min(
      numberValue(input.page, 1, 1, 1000),
      totalPages
    );
    const start = (page - 1) * limit;
    const paged = filtered.slice(start, start + limit);

    return response.status(200).json({
      source: {
        dataset_key: dataset.datasetKey,
        title: dataset.title,
        season_label: dataset.seasonLabel,
        previous_season_label: dataset.previousSeasonLabel,
        source_type: dataset.sourceType,
        source_organization: dataset.sourceOrganization,
        source_url: dataset.sourceUrl,
        last_verified_date: dataset.lastVerifiedDate,
        notes: dataset.notes
      },
      database_available: databaseAvailable,
      summary: summarizeSchoolDataset(dataset),
      total: filtered.length,
      page,
      limit,
      schools: paged
    });
  } catch (error) {
    console.error("Ohio school directory failed:", error);
    return response.status(error.status || 500).json({
      error:
        error.status
          ? error.message
          : "The Ohio school directory could not be loaded."
    });
  }
}
