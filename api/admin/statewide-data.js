import { supabaseAdmin } from "../../lib/supabase-admin.mjs";
import { isAdminRequest } from "../../lib/admin_auth.mjs";
import {
  canonicalDivision,
  chunkRows,
  cleanText,
  displaySchoolName,
  isMissingFoundationError,
  loadBundledSchoolDataset,
  loadBundledTrackDataset,
  normalizeLookup,
  normalizeSchoolKey,
  slugifySchool,
  summarizeSchoolDataset
} from "../../lib/ohio_foundation_service.mjs";

const ADMIN_ID = "Podium Watch Admin";
const SCHOOL_SOURCE_KEY = "ohsaa-boys-xc-divisions-2026-27";
const TRACK_SOURCE_KEY = "ohsaa-track-regional-sites-2026";

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The submitted statewide data request is invalid.");
      error.status = 400;
      throw error;
    }
  }

  return request.body || {};
}

function booleanValue(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  const cleaned = String(value ?? "").trim().toLowerCase();

  if (["true", "1", "yes", "on"].includes(cleaned)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(cleaned)) {
    return false;
  }

  return fallback;
}

async function countTable(table, filters = []) {
  let query = supabaseAdmin
    .from(table)
    .select("id", {
      count: "exact",
      head: true
    });

  for (const filter of filters) {
    if (filter.type === "eq") {
      query = query.eq(filter.field, filter.value);
    } else if (filter.type === "in") {
      query = query.in(filter.field, filter.value);
    }
  }

  const { count, error } = await query;

  if (error) {
    throw error;
  }

  return count || 0;
}

async function loadAll(table, select = "*") {
  const rows = [];
  const pageSize = 1000;

  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select(select)
      .range(start, start + pageSize - 1);

    if (error) {
      throw error;
    }

    rows.push(...(data || []));

    if (!data || data.length < pageSize) {
      break;
    }
  }

  return rows;
}

async function loadFoundationState() {
  const [sources, schools, divisions, sites, batches, conflicts] = await Promise.all([
    loadAll("ohio_data_sources"),
    loadAll("ohio_schools"),
    loadAll("ohio_school_divisions"),
    loadAll("ohio_tournament_sites"),
    supabaseAdmin
      .from("ohio_import_batches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
    supabaseAdmin
      .from("ohio_data_conflicts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300)
  ]);

  if (batches.error) {
    throw batches.error;
  }

  if (conflicts.error) {
    throw conflicts.error;
  }

  return {
    sources,
    schools,
    divisions,
    sites,
    batches: batches.data || [],
    conflicts: conflicts.data || []
  };
}

function buildOfficialSchoolRows(dataset) {
  return (dataset.schools || []).map((school) => ({
    ohsaa_school_id: Number(school.school_id),
    school_name: displaySchoolName(school.school_name),
    normalized_name: normalizeLookup(school.school_name),
    city: cleanText(school.city, 160),
    normalized_city: normalizeLookup(school.city),
    athletic_district: cleanText(school.athletic_district, 40),
    program_level: "high_school",
    status: "active",
    last_verified_at: `${dataset.lastVerifiedDate}T12:00:00.000Z`,
    metadata: {
      official_school_name: school.school_name,
      source_dataset_key: dataset.datasetKey
    },
    assignment: {
      sport: "cross_country",
      gender: "boys",
      season_start_year: 2026,
      season_end_year: 2027,
      season_label: dataset.seasonLabel,
      division: canonicalDivision(
        school.division_2026_27_2027_28
      ),
      previous_division: canonicalDivision(
        school.division_2025_26
      ),
      base_enrollment:
        Number(school.boys_base_enrollment) || null,
      official: true,
      current: true,
      last_verified_at: `${dataset.lastVerifiedDate}T12:00:00.000Z`,
      metadata: {
        source_dataset_key: dataset.datasetKey
      }
    }
  }));
}

function buildOfficialSiteRows(track) {
  return (track.regions || []).map((site) => ({
    sport: "track_and_field",
    season_year: 2026,
    division: Number(site.division),
    region: Number(site.region),
    site_city: site.siteCity || null,
    site_name: site.siteName,
    address: site.address || null,
    prelim_date: site.prelimDate || null,
    prelim_time: site.prelimTime || null,
    semifinal_date: site.semifinalDate || null,
    semifinal_field_time: site.semifinalFieldTime || null,
    semifinal_running_time: site.semifinalRunningTime || null,
    final_date: site.finalDate || null,
    final_field_time: site.finalFieldTime || null,
    final_running_time: site.finalRunningTime || null,
    meet_manager: site.meetManager || null,
    meet_manager_email: site.meetManagerEmail || null,
    athletic_director: site.athleticDirector || null,
    athletic_director_email: site.athleticDirectorEmail || null,
    site_manager: site.siteManager || null,
    site_manager_email: site.siteManagerEmail || null,
    boys_representation: site.boysRepresentation || null,
    girls_representation: site.girlsRepresentation || null,
    source_note: site.sourceNote || null,
    subject_to_change: Boolean(track.subjectToChange),
    current: true,
    last_verified_at: `${track.lastVerifiedDate}T12:00:00.000Z`
  }));
}

function sameText(first, second) {
  return cleanText(first, 500) === cleanText(second, 500);
}

function isOfficialOhsaaTeamSource(team) {
  const source = normalizeLookup(team?.source_name);

  return (
    source.includes("ohsaa") ||
    source.includes("ohio high school athletic association")
  );
}

function previewChanges({ officialSchools, officialSites, state, teams }) {
  const schoolsByOhsaaId = new Map(
    state.schools.map((school) => [
      Number(school.ohsaa_school_id),
      school
    ])
  );
  const divisionsByKey = new Map(
    state.divisions.map((assignment) => [
      [
        assignment.school_id,
        assignment.sport,
        assignment.gender,
        assignment.season_start_year,
        assignment.season_end_year
      ].join("|"),
      assignment
    ])
  );
  const sitesByKey = new Map(
    state.sites.map((site) => [
      [site.sport, site.season_year, site.division, site.region].join("|"),
      site
    ])
  );

  const teamsBySourceId = new Map();
  const teamsBySchoolKey = new Map();

  teams
    .filter((team) => !team.archived_at && !team.merged_into_team_id)
    .forEach((team) => {
      if (
        team.source_school_id &&
        isOfficialOhsaaTeamSource(team)
      ) {
        teamsBySourceId.set(
          String(team.source_school_id),
          team
        );
      }

      teamsBySchoolKey.set(
        normalizeSchoolKey(team.school_name, team.city),
        team
      );
    });

  const summary = {
    bundled_school_count: officialSchools.length,
    bundled_track_site_count: officialSites.length,
    school_inserts: 0,
    school_updates: 0,
    school_unchanged: 0,
    division_inserts: 0,
    division_updates: 0,
    division_unchanged: 0,
    track_site_inserts: 0,
    track_site_updates: 0,
    track_site_unchanged: 0,
    team_links: 0,
    missing_team_pages: 0,
    division_conflicts: 0,
    changed_division_schools: 0
  };
  const samples = {
    school_updates: [],
    division_conflicts: [],
    missing_team_pages: []
  };

  officialSchools.forEach((official) => {
    const existing = schoolsByOhsaaId.get(official.ohsaa_school_id);

    if (!existing) {
      summary.school_inserts += 1;
    } else {
      const changed =
        !sameText(existing.school_name, official.school_name) ||
        !sameText(existing.city, official.city) ||
        !sameText(existing.athletic_district, official.athletic_district);

      if (changed) {
        summary.school_updates += 1;

        if (samples.school_updates.length < 20) {
          samples.school_updates.push({
            ohsaa_school_id: official.ohsaa_school_id,
            current_name: existing.school_name,
            official_name: official.school_name,
            current_city: existing.city,
            official_city: official.city
          });
        }
      } else {
        summary.school_unchanged += 1;
      }
    }

    const existingSchoolId = existing?.id;
    const assignmentKey = existingSchoolId
      ? [
          existingSchoolId,
          "cross_country",
          "boys",
          2026,
          2027
        ].join("|")
      : "";
    const existingAssignment = assignmentKey
      ? divisionsByKey.get(assignmentKey)
      : null;

    if (!existingAssignment) {
      summary.division_inserts += 1;
    } else {
      const changed =
        canonicalDivision(existingAssignment.division) !== official.assignment.division ||
        canonicalDivision(existingAssignment.previous_division) !== official.assignment.previous_division ||
        Number(existingAssignment.base_enrollment || 0) !== Number(official.assignment.base_enrollment || 0);

      if (changed) {
        summary.division_updates += 1;
      } else {
        summary.division_unchanged += 1;
      }
    }

    if (
      official.assignment.division !==
      official.assignment.previous_division
    ) {
      summary.changed_division_schools += 1;
    }

    const team =
      teamsBySourceId.get(String(official.ohsaa_school_id)) ||
      teamsBySchoolKey.get(
        normalizeSchoolKey(official.school_name, official.city)
      );

    if (team) {
      summary.team_links += 1;

      if (
        team.cross_country_boys_division &&
        canonicalDivision(team.cross_country_boys_division) !==
          official.assignment.division
      ) {
        summary.division_conflicts += 1;

        if (samples.division_conflicts.length < 40) {
          samples.division_conflicts.push({
            team_id: team.id,
            school_name: team.school_name,
            city: team.city,
            current_value: team.cross_country_boys_division,
            official_value: official.assignment.division,
            ohsaa_school_id: official.ohsaa_school_id
          });
        }
      }
    } else {
      summary.missing_team_pages += 1;

      if (samples.missing_team_pages.length < 40) {
        samples.missing_team_pages.push({
          school_name: official.school_name,
          city: official.city,
          division: official.assignment.division,
          ohsaa_school_id: official.ohsaa_school_id
        });
      }
    }
  });

  officialSites.forEach((official) => {
    const key = [
      official.sport,
      official.season_year,
      official.division,
      official.region
    ].join("|");
    const existing = sitesByKey.get(key);

    if (!existing) {
      summary.track_site_inserts += 1;
      return;
    }

    const changed = [
      "site_name",
      "address",
      "prelim_date",
      "semifinal_date",
      "final_date",
      "boys_representation",
      "girls_representation"
    ].some((field) => !sameText(existing[field], official[field]));

    if (changed) {
      summary.track_site_updates += 1;
    } else {
      summary.track_site_unchanged += 1;
    }
  });

  return {
    summary,
    samples
  };
}

async function loadTeams() {
  return loadAll(
    "team_pages",
    `
      id,
      school_name,
      slug,
      city,
      state,
      region,
      program_level,
      program_scope,
      cross_country_boys_division,
      source_name,
      source_school_id,
      ohio_school_id,
      published,
      verified,
      suspended,
      archived_at,
      merged_into_team_id
    `
  );
}

async function getStatus() {
  const dataset = await loadBundledSchoolDataset();
  const track = await loadBundledTrackDataset();
  const bundledSummary = summarizeSchoolDataset(dataset);

  try {
    const state = await loadFoundationState();
    const openConflictCount = state.conflicts.filter(
      (conflict) => conflict.status === "open"
    ).length;

    return {
      installed: true,
      bundled: {
        ...bundledSummary,
        trackSiteCount: (track.regions || []).length,
        schoolSourceTitle: dataset.title,
        trackSourceTitle: track.title,
        schoolLastVerifiedDate: dataset.lastVerifiedDate,
        trackUpdatedDate: track.updatedDate,
        trackLastVerifiedDate: track.lastVerifiedDate
      },
      database: {
        source_count: state.sources.length,
        school_count: state.schools.length,
        division_assignment_count: state.divisions.length,
        tournament_site_count: state.sites.length,
        open_conflict_count: openConflictCount,
        latest_batch: state.batches[0] || null
      },
      sources: state.sources,
      recent_batches: state.batches,
      conflicts: state.conflicts
    };
  } catch (error) {
    if (!isMissingFoundationError(error)) {
      throw error;
    }

    return {
      installed: false,
      bundled: {
        ...bundledSummary,
        trackSiteCount: (track.regions || []).length,
        schoolSourceTitle: dataset.title,
        trackSourceTitle: track.title,
        schoolLastVerifiedDate: dataset.lastVerifiedDate,
        trackUpdatedDate: track.updatedDate,
        trackLastVerifiedDate: track.lastVerifiedDate
      },
      database: null,
      sources: [],
      recent_batches: [],
      conflicts: [],
      migration: "install/01_STATEWIDE_FOUNDATION_DATABASE.sql"
    };
  }
}

async function previewImport() {
  const dataset = await loadBundledSchoolDataset();
  const track = await loadBundledTrackDataset();
  const officialSchools = buildOfficialSchoolRows(dataset);
  const officialSites = buildOfficialSiteRows(track);
  const [state, teams] = await Promise.all([
    loadFoundationState(),
    loadTeams()
  ]);

  return {
    source: {
      school: dataset.title,
      track: track.title
    },
    ...previewChanges({
      officialSchools,
      officialSites,
      state,
      teams
    })
  };
}

async function upsertSource(source) {
  const { data, error } = await supabaseAdmin
    .from("ohio_data_sources")
    .upsert(source, {
      onConflict: "source_key"
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function upsertInChunks(table, rows, onConflict, select = "*") {
  const returned = [];

  for (const chunk of chunkRows(rows, 100)) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .upsert(chunk, {
        onConflict
      })
      .select(select);

    if (error) {
      throw error;
    }

    returned.push(...(data || []));
  }

  return returned;
}

function buildSchoolKey(name, city) {
  const cleanPart = (value) =>
    normalizeLookup(value)
      .replace(/\s+/g, "-");

  return [
    cleanPart(name),
    cleanPart(city),
    "high-school"
  ].join("|");
}

function uniqueSlug(base, used) {
  let candidate = base;
  let suffix = 2;

  while (used.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  used.add(candidate);
  return candidate;
}

async function syncTeamPages({
  officialSchools,
  schoolsByOhsaaId,
  assignmentsBySchoolId,
  sourceId,
  batchId,
  createMissingTeams,
  publishNewTeams,
  overwriteOfficialDivision
}) {
  const teams = await loadTeams();
  const teamsByOhioSchoolId = new Map();
  const teamsBySourceId = new Map();
  const teamsBySchoolKey = new Map();
  const usedSlugs = new Set(teams.map((team) => team.slug).filter(Boolean));

  teams
    .filter((team) => !team.archived_at && !team.merged_into_team_id)
    .forEach((team) => {
      if (team.ohio_school_id) {
        teamsByOhioSchoolId.set(team.ohio_school_id, team);
      }

      if (
        team.source_school_id &&
        isOfficialOhsaaTeamSource(team)
      ) {
        teamsBySourceId.set(
          String(team.source_school_id),
          team
        );
      }

      teamsBySchoolKey.set(
        normalizeSchoolKey(team.school_name, team.city),
        team
      );
    });

  const updates = [];
  const inserts = [];
  const conflicts = [];

  for (const official of officialSchools) {
    const school = schoolsByOhsaaId.get(official.ohsaa_school_id);

    if (!school) {
      continue;
    }

    const assignment = assignmentsBySchoolId.get(school.id);
    const team =
      teamsByOhioSchoolId.get(school.id) ||
      teamsBySourceId.get(String(official.ohsaa_school_id)) ||
      teamsBySchoolKey.get(
        normalizeSchoolKey(official.school_name, official.city)
      );

    if (team) {
      const update = {
        id: team.id,
        ohio_school_id: school.id
      };

      if (!team.source_name) {
        update.source_name = "OHSAA Boys Cross Country Division Assignments";
      }

      if (!team.source_school_id) {
        update.source_school_id = String(official.ohsaa_school_id);
      }

      if (!team.region && official.athletic_district) {
        update.region = official.athletic_district;
      }

      if (!team.cross_country_boys_division) {
        update.cross_country_boys_division = official.assignment.division;
      } else if (
        canonicalDivision(team.cross_country_boys_division) !==
        official.assignment.division
      ) {
        const conflictKey = [
          team.id,
          school.id,
          "cross_country_boys_division",
          2026,
          2027
        ].join("|");

        conflicts.push({
          conflict_key: conflictKey,
          team_id: team.id,
          school_id: school.id,
          assignment_id: assignment?.id || null,
          field_name: "cross_country_boys_division",
          current_value: team.cross_country_boys_division,
          official_value: official.assignment.division,
          source_id: sourceId,
          status:
            overwriteOfficialDivision
              ? "accepted_official"
              : "open",
          resolved_at:
            overwriteOfficialDivision
              ? new Date().toISOString()
              : null,
          resolution_note:
            overwriteOfficialDivision
              ? "Updated from the bundled official OHSAA assignment during statewide import."
              : null,
          resolved_by:
            overwriteOfficialDivision
              ? ADMIN_ID
              : null
        });

        if (overwriteOfficialDivision) {
          update.cross_country_boys_division = official.assignment.division;
        }
      }

      if (Object.keys(update).length > 2 || team.ohio_school_id !== school.id) {
        updates.push(update);
      }

      continue;
    }

    if (!createMissingTeams) {
      continue;
    }

    const baseSlug = slugifySchool(
      official.school_name,
      official.city,
      official.ohsaa_school_id
    );

    inserts.push({
      school_name: official.school_name,
      slug: uniqueSlug(baseSlug, usedSlugs),
      school_key: buildSchoolKey(
        official.school_name,
        official.city
      ),
      source_name: "OHSAA Boys Cross Country Division Assignments",
      source_school_id: String(official.ohsaa_school_id),
      ohio_school_id: school.id,
      profile_origin: "admin_import",
      imported_at: new Date().toISOString(),
      city: official.city,
      state: "Ohio",
      region: official.athletic_district,
      program_level: "high_school",
      program_scope: "combined",
      cross_country_boys_division: official.assignment.division,
      published: publishNewTeams,
      verified: false,
      suspended: false
    });
  }

  for (const chunk of chunkRows(updates, 100)) {
    for (const update of chunk) {
      const id = update.id;
      const payload = { ...update };
      delete payload.id;

      const { error } = await supabaseAdmin
        .from("team_pages")
        .update(payload)
        .eq("id", id);

      if (error) {
        throw error;
      }
    }
  }

  for (const chunk of chunkRows(inserts, 100)) {
    const { error } = await supabaseAdmin
      .from("team_pages")
      .insert(chunk);

    if (error) {
      throw error;
    }
  }

  if (conflicts.length > 0) {
    await upsertInChunks(
      "ohio_data_conflicts",
      conflicts,
      "conflict_key",
      "id, conflict_key"
    );
  }

  try {
    const auditRows = [
      ...updates.map((update) => ({
        team_id: update.id,
        actor_type: "import",
        actor_id: ADMIN_ID,
        action: "statewide_school_linked",
        summary: "Team page was linked to the official Ohio school foundation.",
        changed_fields: Object.keys(update).filter((field) => field !== "id"),
        metadata: {
          ohio_import_batch_id: batchId
        }
      }))
    ];

    for (const chunk of chunkRows(auditRows, 100)) {
      const { error } = await supabaseAdmin
        .from("team_change_log")
        .insert(chunk);

      if (error && !isMissingFoundationError(error)) {
        console.error("Unable to write statewide team audit rows:", error);
      }
    }
  } catch (error) {
    console.error("Unable to write statewide team audit rows:", error);
  }

  return {
    linked_or_updated: updates.length,
    created: inserts.length,
    conflicts_recorded: conflicts.length
  };
}

async function commitImport(body) {
  const dataset = await loadBundledSchoolDataset();
  const track = await loadBundledTrackDataset();
  const officialSchools = buildOfficialSchoolRows(dataset);
  const officialSites = buildOfficialSiteRows(track);
  const options = {
    create_missing_teams: booleanValue(body.create_missing_teams, true),
    publish_new_teams: booleanValue(body.publish_new_teams, true),
    overwrite_official_division: booleanValue(
      body.overwrite_official_division,
      false
    )
  };

  const { data: batch, error: batchError } = await supabaseAdmin
    .from("ohio_import_batches")
    .insert({
      import_key: `statewide-foundation-${new Date().toISOString()}`,
      status: "started",
      requested_by: ADMIN_ID,
      options
    })
    .select("*")
    .single();

  if (batchError) {
    throw batchError;
  }

  try {
    const schoolSource = await upsertSource({
      source_key: SCHOOL_SOURCE_KEY,
      source_name: dataset.sourceName,
      source_organization: dataset.sourceOrganization,
      source_type: "official",
      document_title: dataset.title,
      source_url: dataset.sourceUrl,
      source_file: dataset.sourceFile,
      season_label: dataset.seasonLabel,
      last_verified_at: `${dataset.lastVerifiedDate}T12:00:00.000Z`,
      subject_to_change: false,
      notes: dataset.notes
    });

    const trackSource = await upsertSource({
      source_key: TRACK_SOURCE_KEY,
      source_name: "OHSAA Track Regional Sites and Representation",
      source_organization: track.sourceOrganization,
      source_type: "official",
      document_title: track.title,
      source_url: track.officialSourceUrl,
      source_file: track.sourceFile,
      season_label: "2026",
      published_date: track.updatedDate,
      last_verified_at: `${track.lastVerifiedDate}T12:00:00.000Z`,
      subject_to_change: Boolean(track.subjectToChange),
      notes: track.notes
    });

    await supabaseAdmin
      .from("ohio_import_batches")
      .update({ source_id: schoolSource.id })
      .eq("id", batch.id);

    const schoolPayloads = officialSchools.map((school) => ({
      ohsaa_school_id: school.ohsaa_school_id,
      school_name: school.school_name,
      normalized_name: school.normalized_name,
      city: school.city,
      normalized_city: school.normalized_city,
      athletic_district: school.athletic_district,
      program_level: school.program_level,
      status: school.status,
      source_id: schoolSource.id,
      last_verified_at: school.last_verified_at,
      metadata: school.metadata
    }));

    const savedSchools = await upsertInChunks(
      "ohio_schools",
      schoolPayloads,
      "ohsaa_school_id",
      "id, ohsaa_school_id, school_name, city"
    );
    const schoolsByOhsaaId = new Map(
      savedSchools.map((school) => [
        Number(school.ohsaa_school_id),
        school
      ])
    );

    const aliasRowsByKey = new Map();

    officialSchools.forEach((official) => {
      const school = schoolsByOhsaaId.get(official.ohsaa_school_id);

      if (!school) {
        return;
      }

      const aliases = new Set([
        official.school_name,
        official.metadata.official_school_name
      ]);

      aliases.forEach((alias) => {
        const cleaned = cleanText(alias, 200);
        const normalizedAlias = normalizeLookup(cleaned);

        if (!cleaned || !normalizedAlias) {
          return;
        }

        const aliasKey = `${school.id}|${normalizedAlias}`;

        if (!aliasRowsByKey.has(aliasKey)) {
          aliasRowsByKey.set(aliasKey, {
            school_id: school.id,
            alias: cleaned,
            normalized_alias: normalizedAlias,
            source_id: schoolSource.id
          });
        }
      });
    });

    const aliasRows = Array.from(aliasRowsByKey.values());

    await upsertInChunks(
      "ohio_school_aliases",
      aliasRows,
      "school_id,normalized_alias",
      "id"
    );

    const divisionPayloads = officialSchools.map((official) => {
      const school = schoolsByOhsaaId.get(official.ohsaa_school_id);

      return {
        school_id: school.id,
        ...official.assignment,
        source_id: schoolSource.id
      };
    });

    const savedAssignments = await upsertInChunks(
      "ohio_school_divisions",
      divisionPayloads,
      "school_id,sport,gender,season_start_year,season_end_year",
      "id, school_id, division"
    );
    const assignmentsBySchoolId = new Map(
      savedAssignments.map((assignment) => [
        assignment.school_id,
        assignment
      ])
    );

    const sitePayloads = officialSites.map((site) => ({
      ...site,
      source_id: trackSource.id
    }));

    await upsertInChunks(
      "ohio_tournament_sites",
      sitePayloads,
      "sport,season_year,division,region",
      "id, division, region"
    );

    const teamSummary = await syncTeamPages({
      officialSchools,
      schoolsByOhsaaId,
      assignmentsBySchoolId,
      sourceId: schoolSource.id,
      batchId: batch.id,
      createMissingTeams: options.create_missing_teams,
      publishNewTeams: options.publish_new_teams,
      overwriteOfficialDivision: options.overwrite_official_division
    });

    const summary = {
      official_schools_imported: savedSchools.length,
      official_divisions_imported: savedAssignments.length,
      official_track_sites_imported: sitePayloads.length,
      team_pages: teamSummary,
      options
    };

    const { error: completeError } = await supabaseAdmin
      .from("ohio_import_batches")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        summary
      })
      .eq("id", batch.id);

    if (completeError) {
      throw completeError;
    }

    return {
      batch_id: batch.id,
      summary
    };
  } catch (error) {
    await supabaseAdmin
      .from("ohio_import_batches")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: cleanText(error.message, 2000)
      })
      .eq("id", batch.id);

    throw error;
  }
}

async function resolveConflict(body) {
  const conflictId = cleanText(body.conflict_id, 100);
  const status = cleanText(body.status, 40);
  const allowed = new Set([
    "accepted_official",
    "kept_existing",
    "resolved"
  ]);

  if (!conflictId) {
    const error = new Error("Choose a conflict record.");
    error.status = 400;
    throw error;
  }

  if (!allowed.has(status)) {
    const error = new Error("Choose a valid conflict resolution.");
    error.status = 400;
    throw error;
  }

  const { data: conflict, error: loadError } = await supabaseAdmin
    .from("ohio_data_conflicts")
    .select("*")
    .eq("id", conflictId)
    .single();

  if (loadError) {
    throw loadError;
  }

  if (
    status === "accepted_official" &&
    conflict.team_id &&
    conflict.field_name === "cross_country_boys_division"
  ) {
    const { error: updateError } = await supabaseAdmin
      .from("team_pages")
      .update({
        cross_country_boys_division: conflict.official_value
      })
      .eq("id", conflict.team_id);

    if (updateError) {
      throw updateError;
    }
  }

  const { data, error } = await supabaseAdmin
    .from("ohio_data_conflicts")
    .update({
      status,
      resolved_at: new Date().toISOString(),
      resolution_note: cleanText(body.resolution_note, 1200) || null,
      resolved_by: ADMIN_ID
    })
    .eq("id", conflictId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (!(await isAdminRequest(request))) {
    return response.status(401).json({
      error: "Admin sign in required."
    });
  }

  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    const body =
      request.method === "POST"
        ? parseBody(request)
        : request.query || {};
    const action = cleanText(body.action, 40).toLowerCase() || "status";

    if (action === "status") {
      return response.status(200).json(
        await getStatus()
      );
    }

    if (action === "preview") {
      return response.status(200).json(
        await previewImport()
      );
    }

    if (action === "commit") {
      return response.status(200).json(
        await commitImport(body)
      );
    }

    if (action === "resolve_conflict") {
      return response.status(200).json({
        conflict: await resolveConflict(body)
      });
    }

    const error = new Error("Choose a valid statewide data action.");
    error.status = 400;
    throw error;
  } catch (error) {
    console.error("Statewide data admin request failed:", error);

    if (isMissingFoundationError(error)) {
      return response.status(409).json({
        error:
          "Run install/01_STATEWIDE_FOUNDATION_DATABASE.sql in Supabase before using the statewide importer.",
        migration:
          "install/01_STATEWIDE_FOUNDATION_DATABASE.sql"
      });
    }

    return response.status(error.status || 500).json({
      error:
        error.status
          ? error.message
          : "The statewide data request could not be completed."
    });
  }
}
