import fs from "node:fs/promises";
import { supabaseAdmin } from "./supabase-admin.mjs";
import {
  normalizeLookup,
  isMissingFoundationError
} from "./ohio_foundation_service.mjs";

const seedDataUrl = new URL(
  "../public/data/athlete-foundation-seed-2026.json",
  import.meta.url
);

let seedPromise = null;

export function cleanAthleteText(value, maxLength = 1000) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

export function normalizeAthleteGender(value) {
  const cleaned = cleanAthleteText(value, 50)
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

export function normalizeAthleteName(value) {
  return normalizeLookup(value);
}

export function athleteIdentityKey({
  displayName,
  schoolName,
  gender,
  graduationYear
}) {
  return [
    normalizeAthleteName(displayName),
    normalizeLookup(schoolName),
    normalizeAthleteGender(gender),
    graduationYear || "unknown"
  ].join("|");
}

export function athleteMatchKey({
  displayName,
  gender,
  graduationYear
}) {
  return [
    normalizeAthleteName(displayName),
    normalizeAthleteGender(gender),
    graduationYear || "unknown"
  ].join("|");
}

export function slugifyAthlete(value) {
  return cleanAthleteText(value, 500)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "ohio-athlete";
}

export function isMissingAthleteFoundationError(error) {
  return isMissingFoundationError(error) || [
    "42P01",
    "42703",
    "PGRST202",
    "PGRST205"
  ].includes(String(error?.code || ""));
}

export async function loadAthleteSeed() {
  if (!seedPromise) {
    seedPromise = fs
      .readFile(seedDataUrl, "utf8")
      .then((text) => JSON.parse(text));
  }

  return seedPromise;
}

export function summarizeAthleteSeed(dataset) {
  const athletes = Array.isArray(dataset?.athletes)
    ? dataset.athletes
    : [];
  const genders = {};
  const graduationYears = {};
  const divisions = {};
  const schools = new Set();

  athletes.forEach((athlete) => {
    const gender = athlete.gender || "unspecified";
    const graduationYear = athlete.graduation_year || "Unknown";
    const division = athlete.division || "Unknown";

    genders[gender] = (genders[gender] || 0) + 1;
    graduationYears[graduationYear] =
      (graduationYears[graduationYear] || 0) + 1;
    divisions[division] = (divisions[division] || 0) + 1;
    schools.add(athlete.school_name);
  });

  return {
    athlete_count: athletes.length,
    school_count: schools.size,
    official_school_matches: Number(
      dataset?.official_school_match_count || 0
    ),
    genders,
    graduation_years: graduationYears,
    divisions
  };
}

async function loadPreviewData() {
  const installedResult = await supabaseAdmin
    .from("athlete_profiles")
    .select("id", { count: "exact", head: true });

  if (installedResult.error) {
    if (isMissingAthleteFoundationError(installedResult.error)) {
      return {
        installed: false,
        profile_count: 0,
        profiles: [],
        schools: [],
        teams: [],
        roster_athletes: [],
        ranking_entries: []
      };
    }

    throw installedResult.error;
  }

  const [
    profilesResult,
    schoolsResult,
    teamsResult,
    rosterResult,
    rankingsResult
  ] = await Promise.all([
    supabaseAdmin
      .from("athlete_profiles")
      .select(`
        id,
        source_identity_key,
        slug,
        display_name,
        normalized_name,
        gender,
        graduation_year,
        current_school_id,
        current_team_id,
        merged_into_profile_id,
        archived_at
      `)
      .is("merged_into_profile_id", null)
      .limit(10000),
    supabaseAdmin
      .from("ohio_schools")
      .select("id, ohsaa_school_id, school_name, normalized_name, normalized_city, city")
      .eq("status", "active")
      .limit(3000),
    supabaseAdmin
      .from("team_pages")
      .select("id, school_name, slug, ohio_school_id, published, archived_at, merged_into_team_id")
      .is("merged_into_team_id", null)
      .limit(5000),
    supabaseAdmin
      .from("team_athletes")
      .select(`
        id,
        team_id,
        athlete_profile_id,
        first_name,
        last_name,
        display_name,
        gender,
        graduation_year,
        public_visible
      `)
      .limit(20000),
    supabaseAdmin
      .from("athlete_ranking_entries")
      .select("id, ranking_entry_key, profile_id")
      .limit(10000)
  ]);

  for (const result of [
    profilesResult,
    schoolsResult,
    teamsResult,
    rosterResult,
    rankingsResult
  ]) {
    if (result.error) {
      throw result.error;
    }
  }

  return {
    installed: true,
    profile_count: Number(installedResult.count || 0),
    profiles: profilesResult.data || [],
    schools: schoolsResult.data || [],
    teams: teamsResult.data || [],
    roster_athletes: rosterResult.data || [],
    ranking_entries: rankingsResult.data || []
  };
}

export async function buildAthleteSeedPreview() {
  const dataset = await loadAthleteSeed();
  const seedSummary = summarizeAthleteSeed(dataset);
  const current = await loadPreviewData();

  if (!current.installed) {
    return {
      installed: false,
      dataset: {
        key: dataset.dataset_key,
        title: dataset.title,
        notes: dataset.notes,
        summary: seedSummary
      },
      summary: {
        profile_inserts: seedSummary.athlete_count,
        profile_updates: 0,
        ranking_inserts: seedSummary.athlete_count,
        ranking_updates: 0,
        official_school_links: seedSummary.official_school_matches,
        team_links: 0,
        roster_links: 0,
        duplicate_conflicts: 0,
        unmatched_official_schools:
          seedSummary.athlete_count -
          seedSummary.official_school_matches
      },
      rows: []
    };
  }

  const schoolByOhsaaId = new Map(
    current.schools.map((school) => [
      Number(school.ohsaa_school_id),
      school
    ])
  );
  const teamBySchoolId = new Map();
  const teamsByName = new Map();

  current.teams.forEach((team) => {
    if (team.ohio_school_id) {
      teamBySchoolId.set(team.ohio_school_id, team);
    }

    const key = normalizeLookup(team.school_name);
    const list = teamsByName.get(key) || [];
    list.push(team);
    teamsByName.set(key, list);
  });

  const profileBySourceKey = new Map(
    current.profiles
      .filter((profile) => profile.source_identity_key)
      .map((profile) => [profile.source_identity_key, profile])
  );
  const profilesByMatchKey = new Map();
  const profileBySlug = new Map(
    current.profiles
      .filter(
        (profile) =>
          profile.slug &&
          !profile.merged_into_profile_id &&
          !profile.archived_at
      )
      .map((profile) => [profile.slug, profile])
  );

  current.profiles.forEach((profile) => {
    const key = athleteMatchKey({
      displayName: profile.display_name,
      gender: profile.gender,
      graduationYear: profile.graduation_year
    });
    const list = profilesByMatchKey.get(key) || [];
    list.push(profile);
    profilesByMatchKey.set(key, list);
  });

  const rosterByTeamAndKey = new Map();

  current.roster_athletes.forEach((athlete) => {
    const displayName = athlete.display_name ||
      [athlete.first_name, athlete.last_name]
        .filter(Boolean)
        .join(" ");
    const key = `${athlete.team_id}|${athleteMatchKey({
      displayName,
      gender: athlete.gender,
      graduationYear: athlete.graduation_year
    })}`;
    const list = rosterByTeamAndKey.get(key) || [];
    list.push(athlete);
    rosterByTeamAndKey.set(key, list);
  });

  const rankingKeys = new Set(
    current.ranking_entries.map((entry) => entry.ranking_entry_key)
  );

  const rows = dataset.athletes.map((seed) => {
    const school = seed.ohsaa_school_id
      ? schoolByOhsaaId.get(Number(seed.ohsaa_school_id)) || null
      : null;
    const team = school
      ? teamBySchoolId.get(school.id) || null
      : (teamsByName.get(seed.normalized_school_name) || [])[0] || null;
    const sourceMatch = profileBySourceKey.get(
      seed.source_identity_key
    ) || null;
    const profileMatches = profilesByMatchKey.get(
      athleteMatchKey(seed)
    ) || [];
    const nonMergedMatches = profileMatches.filter(
      (profile) => !profile.merged_into_profile_id && !profile.archived_at
    );
    const existingProfile = sourceMatch ||
      (nonMergedMatches.length === 1 ? nonMergedMatches[0] : null);
    const slugMatch = profileBySlug.get(seed.profile_slug) || null;
    const slugConflict = Boolean(
      slugMatch &&
      slugMatch.id !== existingProfile?.id
    );
    const duplicateConflict =
      (!sourceMatch && nonMergedMatches.length > 1) ||
      slugConflict;
    const conflictCandidates = [
      ...nonMergedMatches,
      ...(slugConflict ? [slugMatch] : [])
    ].filter(
      (profile, index, list) =>
        profile &&
        list.findIndex(
          (candidate) => candidate.id === profile.id
        ) === index
    );
    const rosterKey = team
      ? `${team.id}|${athleteMatchKey(seed)}`
      : "";
    const rosterMatches = rosterKey
      ? rosterByTeamAndKey.get(rosterKey) || []
      : [];
    const safeRosterMatches = rosterMatches.filter(
      (athlete) =>
        !athlete.athlete_profile_id ||
        athlete.athlete_profile_id === existingProfile?.id
    );

    return {
      ...seed,
      school_id: school?.id || null,
      team_id: team?.id || null,
      team_slug: team?.slug || null,
      existing_profile_id: existingProfile?.id || null,
      existing_profile_slug: existingProfile?.slug || null,
      roster_athlete_ids: safeRosterMatches.map((athlete) => athlete.id),
      profile_action: duplicateConflict
        ? "conflict"
        : existingProfile
          ? "update"
          : "insert",
      ranking_action: rankingKeys.has(
        seed.ranking.ranking_entry_key
      )
        ? "update"
        : "insert",
      duplicate_candidates: duplicateConflict
        ? conflictCandidates.map((profile) => ({
            id: profile.id,
            slug: profile.slug,
            display_name: profile.display_name,
            current_team_id: profile.current_team_id
          }))
        : []
    };
  });

  return {
    installed: true,
    dataset: {
      key: dataset.dataset_key,
      title: dataset.title,
      notes: dataset.notes,
      summary: seedSummary
    },
    current: {
      profile_count: current.profile_count,
      ranking_count: current.ranking_entries.length,
      roster_athlete_count: current.roster_athletes.length
    },
    summary: {
      profile_inserts: rows.filter((row) => row.profile_action === "insert").length,
      profile_updates: rows.filter((row) => row.profile_action === "update").length,
      ranking_inserts: rows.filter((row) => row.ranking_action === "insert").length,
      ranking_updates: rows.filter((row) => row.ranking_action === "update").length,
      official_school_links: rows.filter((row) => row.school_id).length,
      team_links: rows.filter((row) => row.team_id).length,
      roster_links: rows.reduce(
        (total, row) => total + row.roster_athlete_ids.length,
        0
      ),
      duplicate_conflicts: rows.filter((row) => row.profile_action === "conflict").length,
      unmatched_official_schools: rows.filter((row) => !row.school_id).length
    },
    rows
  };
}

export async function commitAthleteSeedImport({
  actor = "Podium Watch Admin",
  publishProfiles = true,
  linkRosters = true
} = {}) {
  const preview = await buildAthleteSeedPreview();

  if (!preview.installed) {
    const error = new Error(
      "Run the Athlete Profile Foundation database migration before importing."
    );
    error.status = 409;
    throw error;
  }

  if (preview.summary.duplicate_conflicts > 0) {
    const error = new Error(
      "Resolve the possible duplicate athlete profiles before committing the seed import."
    );
    error.status = 409;
    throw error;
  }

  const { data: source, error: sourceError } = await supabaseAdmin
    .from("athlete_data_sources")
    .select("id")
    .eq("source_key", preview.dataset.key)
    .maybeSingle();

  if (sourceError) {
    throw sourceError;
  }

  if (!source) {
    const error = new Error(
      "The athlete data source record is missing. Run the migration again."
    );
    error.status = 409;
    throw error;
  }

  const { data: batch, error: batchError } = await supabaseAdmin
    .from("athlete_import_batches")
    .insert({
      import_key: `${preview.dataset.key}:${new Date().toISOString()}`,
      status: "started",
      source_id: source.id,
      requested_by: actor,
      options: {
        publish_profiles: Boolean(publishProfiles),
        link_rosters: Boolean(linkRosters)
      },
      summary: preview.summary
    })
    .select("id")
    .single();

  if (batchError) {
    throw batchError;
  }

  try {
    const importRows = preview.rows.map((row) => ({
      source_identity_key: row.source_identity_key,
      profile_slug: row.existing_profile_slug || row.profile_slug,
      first_name: row.first_name,
      last_name: row.last_name,
      display_name: row.display_name,
      normalized_name: row.normalized_name,
      gender: row.gender,
      graduation_year: row.graduation_year,
      graduation_year_source: row.graduation_year_source,
      school_name: row.school_name,
      school_id: row.school_id,
      team_id: row.team_id,
      grade_label: row.grade_label,
      season_year: row.season_year,
      sport: row.sport,
      event: row.event,
      division: row.division,
      division_number: row.division_number,
      existing_profile_id: row.existing_profile_id,
      roster_athlete_ids: row.roster_athlete_ids,
      ranking: row.ranking
    }));

    const { data: result, error: importError } = await supabaseAdmin.rpc(
      "athlete_commit_seed_import_v1",
      {
        p_rows: importRows,
        p_source_id: source.id,
        p_actor: actor,
        p_publish: Boolean(publishProfiles),
        p_link_rosters: Boolean(linkRosters)
      }
    );

    if (importError) {
      throw importError;
    }

    const finalSummary = {
      ...preview.summary,
      ...(result || {})
    };

    await supabaseAdmin
      .from("athlete_import_batches")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        summary: finalSummary
      })
      .eq("id", batch.id);

    return {
      batch_id: batch.id,
      summary: finalSummary
    };
  } catch (error) {
    await supabaseAdmin
      .from("athlete_import_batches")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: cleanAthleteText(error.message, 1000)
      })
      .eq("id", batch.id);

    throw error;
  }
}

async function getTeamRosterSource() {
  const payload = {
    source_key: "podium-watch-team-roster-athletes",
    source_name: "Podium Watch Team Roster Athletes",
    source_organization: "Podium Watch community team pages",
    source_type: "team_roster",
    season_label: "Multiple seasons",
    last_reviewed_at: new Date().toISOString(),
    notes:
      "Athlete identity information entered by an approved team manager or Podium Watch administrator."
  };

  const { data, error } = await supabaseAdmin
    .from("athlete_data_sources")
    .upsert(payload, { onConflict: "source_key" })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function syncRosterAthleteProfile({
  teamId,
  athlete,
  actor = "Team roster"
}) {
  if (!athlete?.id || !teamId) {
    return null;
  }

  try {
    const { data: team, error: teamError } = await supabaseAdmin
      .from("team_pages")
      .select("id, school_name, slug, ohio_school_id, published")
      .eq("id", teamId)
      .maybeSingle();

    if (teamError) {
      throw teamError;
    }

    if (!team) {
      return null;
    }

    if (athlete.athlete_profile_id) {
      const { data: linked, error: linkedError } = await supabaseAdmin
        .from("athlete_profiles")
        .select("id, slug")
        .eq("id", athlete.athlete_profile_id)
        .maybeSingle();

      if (linkedError) {
        throw linkedError;
      }

      if (linked) {
        return linked;
      }
    }

    const displayName = athlete.display_name ||
      [athlete.first_name, athlete.last_name]
        .filter(Boolean)
        .join(" ");
    const normalizedName = normalizeAthleteName(displayName);
    const sourceIdentityKey = [
      "team-roster",
      teamId,
      athlete.profile_key || athleteMatchKey({
        displayName,
        gender: athlete.gender,
        graduationYear: athlete.graduation_year
      })
    ].join("|");

    const { data: existingBySource, error: sourceMatchError } = await supabaseAdmin
      .from("athlete_profiles")
      .select("id, slug")
      .eq("source_identity_key", sourceIdentityKey)
      .maybeSingle();

    if (sourceMatchError) {
      throw sourceMatchError;
    }

    let existing = existingBySource || null;

    if (!existing) {
      const { data: exactMatches, error: exactError } = await supabaseAdmin
        .from("athlete_profiles")
        .select("id, slug, source_identity_key, current_school_id, current_team_id, verification_status, source_id")
        .eq("normalized_name", normalizedName)
        .eq("gender", normalizeAthleteGender(athlete.gender))
        .eq("graduation_year", athlete.graduation_year)
        .is("merged_into_profile_id", null)
        .limit(3);

      if (exactError) {
        throw exactError;
      }

      const safeExactMatches = (exactMatches || []).filter(
        (profile) =>
          profile.current_team_id === team.id ||
          (
            team.ohio_school_id &&
            profile.current_school_id === team.ohio_school_id
          )
      );

      if (safeExactMatches.length === 1) {
        existing = safeExactMatches[0];
      }
    }

    const source = await getTeamRosterSource();
    const slug = existing?.slug || slugifyAthlete(
      `${displayName} ${team.school_name} ${athlete.graduation_year || "unknown"}`
    );
    const payload = {
      source_identity_key: sourceIdentityKey,
      slug,
      first_name: cleanAthleteText(athlete.first_name, 120),
      last_name: cleanAthleteText(athlete.last_name, 120),
      preferred_name: cleanAthleteText(athlete.preferred_name, 120) || null,
      display_name: cleanAthleteText(displayName, 250),
      normalized_name: normalizedName,
      gender: normalizeAthleteGender(athlete.gender),
      graduation_year: athlete.graduation_year || null,
      graduation_year_source: "Team roster entry",
      current_school_id: team.ohio_school_id || null,
      current_team_id: team.id,
      athlete_status: athlete.status || "active",
      bio: athlete.bio || null,
      photo_url: athlete.photo_url || null,
      hometown: athlete.hometown || null,
      college_commitment: athlete.college_commitment || null,
      public_visible: Boolean(athlete.public_visible && team.published),
      published_at: athlete.public_visible && team.published
        ? new Date().toISOString()
        : null,
      verification_status: "team_roster_linked",
      source_id: source.id,
      last_source_reviewed_at: new Date().toISOString(),
      updated_by: actor,
      metadata: {
        team_roster_athlete_id: athlete.id,
        team_id: team.id
      }
    };

    let profile;

    if (existing?.id) {
      const updatePayload = {
        ...payload,
        source_identity_key:
          existing.source_identity_key || payload.source_identity_key,
        source_id: existing.source_id || payload.source_id,
        verification_status: [
          "source_verified",
          "admin_verified"
        ].includes(existing.verification_status)
          ? existing.verification_status
          : payload.verification_status
      };

      const { data, error } = await supabaseAdmin
        .from("athlete_profiles")
        .update(updatePayload)
        .eq("id", existing.id)
        .select("id, slug")
        .single();

      if (error) {
        throw error;
      }

      profile = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from("athlete_profiles")
        .insert({
          ...payload,
          created_by: actor
        })
        .select("id, slug")
        .single();

      if (error) {
        if (error.code === "23505") {
          const { data: retry, error: retryError } = await supabaseAdmin
            .from("athlete_profiles")
            .select("id, slug")
            .eq("source_identity_key", sourceIdentityKey)
            .maybeSingle();

          if (retryError) {
            throw retryError;
          }

          profile = retry;
        } else {
          throw error;
        }
      } else {
        profile = data;
      }
    }

    if (!profile) {
      return null;
    }

    await supabaseAdmin
      .from("team_athletes")
      .update({ athlete_profile_id: profile.id })
      .eq("id", athlete.id)
      .eq("team_id", team.id);

    const historyQuery = supabaseAdmin
      .from("athlete_school_history")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("school_name_snapshot", team.school_name)
      .eq("current", true)
      .limit(1);
    const { data: historyRows, error: historyError } = await historyQuery;

    if (historyError) {
      throw historyError;
    }

    const historyPayload = {
      profile_id: profile.id,
      school_id: team.ohio_school_id || null,
      team_id: team.id,
      school_name_snapshot: team.school_name,
      current: true,
      verified: false,
      source_id: source.id,
      notes: "Current school connection from a team roster."
    };

    if ((historyRows || []).length) {
      await supabaseAdmin
        .from("athlete_school_history")
        .update(historyPayload)
        .eq("id", historyRows[0].id);
    } else {
      await supabaseAdmin
        .from("athlete_school_history")
        .insert(historyPayload);
    }

    return profile;
  } catch (error) {
    if (isMissingAthleteFoundationError(error)) {
      return null;
    }

    console.error("Athlete roster profile sync error:", error);
    return null;
  }
}

export async function syncTeamRosterProfiles({
  teamId,
  actor = "Team roster import"
}) {
  try {
    const { data: athletes, error } = await supabaseAdmin
      .from("team_athletes")
      .select("*")
      .eq("team_id", teamId)
      .limit(3000);

    if (error) {
      throw error;
    }

    let linked = 0;

    for (const athlete of athletes || []) {
      const profile = await syncRosterAthleteProfile({
        teamId,
        athlete,
        actor
      });

      if (profile) {
        linked += 1;
      }
    }

    return { linked };
  } catch (error) {
    if (isMissingAthleteFoundationError(error)) {
      return { linked: 0, installed: false };
    }

    console.error("Team roster athlete sync error:", error);
    return { linked: 0, error: true };
  }
}
