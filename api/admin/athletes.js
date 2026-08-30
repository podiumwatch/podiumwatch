import { supabaseAdmin } from "../../lib/supabase-admin.mjs";
import { isAdminRequest } from "../../lib/admin_auth.mjs";
import {
  buildAthleteSeedPreview,
  cleanAthleteText,
  commitAthleteSeedImport,
  isMissingAthleteFoundationError,
  normalizeAthleteGender,
  normalizeAthleteName,
  slugifyAthlete
} from "../../lib/athlete_foundation_service.mjs";

const ALIAS_TYPES = new Set(["name", "external_id"]);

const PROFILE_STATUSES = new Set([
  "active",
  "inactive",
  "graduated",
  "transferred",
  "other"
]);
const VERIFICATION_STATUSES = new Set([
  "unverified",
  "community_submitted",
  "team_roster_linked",
  "editorial_source_linked",
  "source_verified",
  "admin_verified",
  "disputed"
]);
const PERFORMANCE_SPORTS = new Set([
  "cross_country",
  "indoor_track",
  "outdoor_track"
]);
const PERFORMANCE_RECORD_TYPES = new Set([
  "race_result",
  "personal_best",
  "season_best",
  "split",
  "other"
]);
const PERFORMANCE_SOURCE_TYPES = new Set([
  "official",
  "supplied_reference",
  "editorial",
  "community",
  "team_roster"
]);
const PERFORMANCE_VERIFICATION = new Set([
  "unverified",
  "source_linked",
  "verified",
  "disputed"
]);
const CORRECTION_STATUSES = new Set([
  "open",
  "reviewing",
  "resolved",
  "rejected"
]);

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The athlete admin request is invalid.");
      error.status = 400;
      throw error;
    }
  }

  return request.body || {};
}

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function cleanUuid(value, label) {
  const cleaned = cleanAthleteText(value, 100);

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleaned)) {
    fail(`${label} is invalid.`);
  }

  return cleaned;
}

function cleanInteger(value, {
  label,
  min,
  max,
  nullable = false
}) {
  const cleaned = cleanAthleteText(value, 40);

  if (!cleaned && nullable) {
    return null;
  }

  const number = Number(cleaned);

  if (!Number.isInteger(number) || number < min || number > max) {
    fail(`${label} must be between ${min} and ${max}.`);
  }

  return number;
}

function cleanBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  return ["1", "true", "yes", "on"].includes(
    cleanAthleteText(value, 20).toLowerCase()
  );
}

function cleanUrl(value, label) {
  const cleaned = cleanAthleteText(value, 2000);

  if (!cleaned) {
    return null;
  }

  try {
    const prepared = /^[a-z][a-z0-9+.-]*:\/\//i.test(cleaned)
      ? cleaned
      : `https://${cleaned}`;
    const url = new URL(prepared);

    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error();
    }

    return url.href;
  } catch {
    fail(`${label} must be a valid website address.`);
  }
}

function cleanStringArray(value, maxItems = 30) {
  const values = Array.isArray(value)
    ? value
    : cleanAthleteText(value, 3000).split(/[;,|\n]/);

  return [...new Set(
    values
      .map((item) => cleanAthleteText(item, 100))
      .filter(Boolean)
  )].slice(0, maxItems);
}

function normalizeSport(value) {
  const cleaned = cleanAthleteText(value, 100)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (["cross_country", "xc"].includes(cleaned)) {
    return "cross_country";
  }

  if (["indoor_track", "indoor_track_and_field", "indoor"].includes(cleaned)) {
    return "indoor_track";
  }

  if (["outdoor_track", "track_and_field", "track", "outdoor"].includes(cleaned)) {
    return "outdoor_track";
  }

  fail("Choose Cross Country, Indoor Track, or Outdoor Track.");
}

function normalizeEventKey(value) {
  return cleanAthleteText(value, 150)
    .toLowerCase()
    .replace(/meters?|metres?/g, "m")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function requireInstalled() {
  const { count, error } = await supabaseAdmin
    .from("athlete_profiles")
    .select("id", { count: "exact", head: true });

  if (error) {
    if (isMissingAthleteFoundationError(error)) {
      fail(
        "Run install/02_ATHLETE_PROFILE_FOUNDATION_DATABASE.sql before using the Athlete Data Center.",
        409
      );
    }

    throw error;
  }

  return Number(count || 0);
}

function duplicateGroups(profiles) {
  const groups = new Map();

  profiles.forEach((profile) => {
    if (profile.merged_into_profile_id || profile.archived_at) {
      return;
    }

    const key = [
      profile.normalized_name,
      profile.gender,
      profile.graduation_year || "unknown"
    ].join("|");
    const list = groups.get(key) || [];
    list.push(profile);
    groups.set(key, list);
  });

  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({
      key: [
        group[0].normalized_name,
        group[0].gender,
        group[0].graduation_year || "unknown"
      ].join("|"),
      profiles: group
    }))
    .sort((first, second) =>
      String(first.profiles[0]?.display_name || "").localeCompare(
        String(second.profiles[0]?.display_name || "")
      )
    );
}

async function loadStatus() {
  let installed = true;
  let profileCount = 0;

  try {
    profileCount = await requireInstalled();
  } catch (error) {
    if (Number(error.status) === 409) {
      installed = false;
    } else {
      throw error;
    }
  }

  const preview = await buildAthleteSeedPreview();

  if (!installed) {
    return {
      installed: false,
      migration_path: "install/02_ATHLETE_PROFILE_FOUNDATION_DATABASE.sql",
      seed: preview.dataset,
      preview_summary: preview.summary,
      counts: {
        profiles: 0,
        public_profiles: 0,
        verified_profiles: 0,
        performances: 0,
        ranking_entries: 0,
        open_corrections: 0,
        unlinked_roster_athletes: 0,
        duplicate_groups: 0
      },
      corrections: [],
      duplicates: [],
      recent_batches: [],
      recent_merges: []
    };
  }

  const [
    profilesResult,
    publicResult,
    verifiedResult,
    performancesResult,
    rankingsResult,
    correctionsResult,
    rosterResult,
    batchesResult,
    mergesResult
  ] = await Promise.all([
    supabaseAdmin
      .from("athlete_profiles")
      .select(`
        id,
        slug,
        display_name,
        normalized_name,
        gender,
        graduation_year,
        current_school_id,
        current_team_id,
        public_visible,
        verified,
        verification_status,
        archived_at,
        merged_into_profile_id,
        updated_at
      `)
      .limit(10000),
    supabaseAdmin
      .from("athlete_profiles")
      .select("id", { count: "exact", head: true })
      .eq("public_visible", true)
      .eq("suspended", false)
      .is("archived_at", null)
      .is("merged_into_profile_id", null),
    supabaseAdmin
      .from("athlete_profiles")
      .select("id", { count: "exact", head: true })
      .eq("verified", true)
      .is("archived_at", null)
      .is("merged_into_profile_id", null),
    supabaseAdmin
      .from("athlete_performances")
      .select("id", { count: "exact", head: true })
      .is("archived_at", null),
    supabaseAdmin
      .from("athlete_ranking_entries")
      .select("id", { count: "exact", head: true })
      .eq("current", true),
    supabaseAdmin
      .from("athlete_profile_corrections")
      .select("*")
      .in("status", ["open", "reviewing"])
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("team_athletes")
      .select("id", { count: "exact", head: true })
      .is("athlete_profile_id", null),
    supabaseAdmin
      .from("athlete_import_batches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
    supabaseAdmin
      .from("athlete_profile_merges")
      .select("id, created_at, source_profile_id, target_profile_id, merged_by, reason, summary, reversed_at, reversed_by, source_snapshot")
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  for (const result of [
    profilesResult,
    publicResult,
    verifiedResult,
    performancesResult,
    rankingsResult,
    correctionsResult,
    rosterResult,
    batchesResult
  ]) {
    if (result.error) {
      throw result.error;
    }
  }

  // source_snapshot only exists once install/33 has been run -- until
  // then this degrades to an empty recent-merges list rather than
  // breaking the whole admin dashboard load.
  if (mergesResult.error && !isMissingAthleteFoundationError(mergesResult.error)) {
    throw mergesResult.error;
  }

  const profiles = profilesResult.data || [];
  const duplicates = duplicateGroups(profiles);
  const merges = mergesResult.error ? [] : (mergesResult.data || []);
  const mergeProfileIds = [...new Set(
    merges.flatMap((merge) => [merge.source_profile_id, merge.target_profile_id]).filter(Boolean)
  )];
  const { data: mergeProfileRows, error: mergeProfileError } = mergeProfileIds.length
    ? await supabaseAdmin
        .from("athlete_profiles")
        .select("id, display_name, slug")
        .in("id", mergeProfileIds)
    : { data: [], error: null };

  if (mergeProfileError) {
    throw mergeProfileError;
  }

  const mergeProfileMap = new Map((mergeProfileRows || []).map((profile) => [profile.id, profile]));
  const recentMerges = merges.map((merge) => ({
    id: merge.id,
    created_at: merge.created_at,
    merged_by: merge.merged_by,
    reason: merge.reason,
    summary: merge.summary,
    reversed_at: merge.reversed_at,
    reversed_by: merge.reversed_by,
    can_unmerge: Boolean(merge.source_snapshot) && !merge.reversed_at,
    source: mergeProfileMap.get(merge.source_profile_id) || { id: merge.source_profile_id, display_name: "Unknown profile" },
    target: mergeProfileMap.get(merge.target_profile_id) || { id: merge.target_profile_id, display_name: "Unknown profile" }
  }));

  return {
    installed: true,
    migration_path: "install/02_ATHLETE_PROFILE_FOUNDATION_DATABASE.sql",
    seed: preview.dataset,
    preview_summary: preview.summary,
    counts: {
      profiles: profileCount,
      public_profiles: Number(publicResult.count || 0),
      verified_profiles: Number(verifiedResult.count || 0),
      performances: Number(performancesResult.count || 0),
      ranking_entries: Number(rankingsResult.count || 0),
      open_corrections: (correctionsResult.data || []).length,
      unlinked_roster_athletes: Number(rosterResult.count || 0),
      duplicate_groups: duplicates.length
    },
    corrections: correctionsResult.data || [],
    duplicates: duplicates.slice(0, 50),
    recent_batches: batchesResult.data || [],
    recent_merges: recentMerges
  };
}

const SEARCH_PROFILE_FIELDS = `
      id,
      slug,
      display_name,
      gender,
      graduation_year,
      current_school_id,
      current_team_id,
      public_visible,
      verified,
      verification_status,
      recruiting_enabled,
      suspended,
      archived_at,
      merged_into_profile_id,
      updated_at
    `;

async function searchProfiles(body) {
  await requireInstalled();
  const search = cleanAthleteText(body.search, 200);
  const limit = Math.max(1, Math.min(250, Number(body.limit) || 100));
  let query = supabaseAdmin
    .from("athlete_profiles")
    .select(SEARCH_PROFILE_FIELDS)
    .is("merged_into_profile_id", null)
    .order("display_name", { ascending: true })
    .limit(limit);

  if (search) {
    const safe = search.replace(/[,%()]/g, " ");
    const pattern = `%${safe}%`;
    query = query.or([
      `display_name.ilike.${pattern}`,
      `slug.ilike.${pattern}`
    ].join(","));
  }

  const { data: profiles, error } = await query;

  if (error) {
    throw error;
  }

  let rows = profiles || [];

  // A name search that only matches display_name/slug never finds a
  // profile searched for by a known alias (a corrected/alternate spelling,
  // e.g. "Phlipot" for a canonical "Philpot") -- this is the admin-search
  // half of the alias wiring described in the plan. Only alias_type=name
  // rows are ever considered a match; external provider ids are never
  // treated as a searchable name. Tolerates install/32 not yet being run
  // (a missing alias_type column just means no alias matches, not a
  // failed search).
  if (search) {
    const safe = search.replace(/[,%()]/g, " ");
    const aliasPattern = `%${normalizeAthleteName(safe)}%`;
    const { data: aliasMatches, error: aliasError } = await supabaseAdmin
      .from("athlete_profile_aliases")
      .select("profile_id")
      .eq("alias_type", "name")
      .ilike("normalized_alias", aliasPattern)
      .limit(limit);

    if (aliasError && !isMissingAthleteFoundationError(aliasError)) {
      throw aliasError;
    }

    const knownIds = new Set(rows.map((row) => row.id));
    const aliasProfileIds = [...new Set((aliasMatches || []).map((row) => row.profile_id))]
      .filter((id) => !knownIds.has(id));

    if (aliasProfileIds.length) {
      const { data: aliasProfiles, error: aliasProfileError } = await supabaseAdmin
        .from("athlete_profiles")
        .select(SEARCH_PROFILE_FIELDS)
        .in("id", aliasProfileIds)
        .is("merged_into_profile_id", null);

      if (aliasProfileError) {
        throw aliasProfileError;
      }

      rows = [...rows, ...(aliasProfiles || [])]
        .sort((first, second) => String(first.display_name || "").localeCompare(String(second.display_name || "")))
        .slice(0, limit);
    }
  }

  const schoolIds = [...new Set(rows.map((row) => row.current_school_id).filter(Boolean))];
  const teamIds = [...new Set(rows.map((row) => row.current_team_id).filter(Boolean))];
  const [schoolResult, teamResult] = await Promise.all([
    schoolIds.length
      ? supabaseAdmin
          .from("ohio_schools")
          .select("id, school_name, city")
          .in("id", schoolIds)
      : Promise.resolve({ data: [], error: null }),
    teamIds.length
      ? supabaseAdmin
          .from("team_pages")
          .select("id, school_name, slug")
          .in("id", teamIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (schoolResult.error) {
    throw schoolResult.error;
  }

  if (teamResult.error) {
    throw teamResult.error;
  }

  const schoolMap = new Map((schoolResult.data || []).map((school) => [school.id, school]));
  const teamMap = new Map((teamResult.data || []).map((team) => [team.id, team]));

  return {
    profiles: rows.map((profile) => ({
      ...profile,
      school: schoolMap.get(profile.current_school_id) || null,
      team: teamMap.get(profile.current_team_id) || null
    }))
  };
}

async function loadProfile(profileId) {
  await requireInstalled();
  const id = cleanUuid(profileId, "Athlete profile ID");
  const [
    profileResult,
    historyResult,
    performanceResult,
    rankingResult,
    storyResult,
    correctionResult,
    rosterResult,
    aliasResult
  ] = await Promise.all([
    supabaseAdmin
      .from("athlete_profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle(),
    supabaseAdmin
      .from("athlete_school_history")
      .select("*")
      .eq("profile_id", id)
      .order("current", { ascending: false })
      .order("season_start_year", { ascending: false }),
    supabaseAdmin
      .from("athlete_performances")
      .select("*")
      .eq("profile_id", id)
      .is("archived_at", null)
      .order("season_year", { ascending: false })
      .order("meet_date", { ascending: false }),
    supabaseAdmin
      .from("athlete_ranking_entries")
      .select("*")
      .eq("profile_id", id)
      .order("updated_date", { ascending: false }),
    supabaseAdmin
      .from("athlete_story_links")
      .select("*")
      .eq("profile_id", id)
      .order("story_date", { ascending: false }),
    supabaseAdmin
      .from("athlete_profile_corrections")
      .select("*")
      .eq("profile_id", id)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("team_athletes")
      .select("id, team_id, display_name, gender, graduation_year, public_visible")
      .eq("athlete_profile_id", id)
      .limit(100),
    supabaseAdmin
      .from("athlete_profile_aliases")
      .select("*")
      .eq("profile_id", id)
      .order("created_at", { ascending: false })
  ]);

  for (const result of [
    profileResult,
    historyResult,
    performanceResult,
    rankingResult,
    storyResult,
    correctionResult,
    rosterResult
  ]) {
    if (result.error) {
      throw result.error;
    }
  }

  if (!profileResult.data) {
    fail("Athlete profile not found.", 404);
  }

  // aliasResult is allowed to fail with "missing column" if install/32 has
  // not been run yet -- the alias table itself (install/02) is required
  // foundation, but alias_type/external_source are this project's own
  // additive extension, and the rest of the profile editor should not go
  // dark just because that one small migration is still pending.
  if (aliasResult.error && !isMissingAthleteFoundationError(aliasResult.error)) {
    throw aliasResult.error;
  }

  return {
    profile: profileResult.data,
    school_history: historyResult.data || [],
    performances: performanceResult.data || [],
    rankings: rankingResult.data || [],
    stories: storyResult.data || [],
    corrections: correctionResult.data || [],
    roster_links: rosterResult.data || [],
    aliases: aliasResult.error ? [] : (aliasResult.data || [])
  };
}

async function saveAlias(body) {
  await requireInstalled();
  const profileId = cleanUuid(body.profile_id, "Athlete profile ID");
  const aliasType = cleanAthleteText(body.alias_type, 20).toLowerCase() || "name";

  if (!ALIAS_TYPES.has(aliasType)) {
    fail("Choose a valid alias type.");
  }

  const alias = cleanAthleteText(body.alias, 200);

  if (!alias) {
    fail("An alias value is required.");
  }

  // Name aliases are normalized exactly like a profile's own display name
  // (accent-folded, lowercased, whitespace-collapsed) so a search or import
  // match on "Phlipot" finds the same normalized value a name match on
  // "Philpot" would produce for the canonical name. External ids are a
  // free-form provider identifier, not a name, so they only get a light
  // trim/lowercase, never the name-specific folding.
  const normalizedAlias = aliasType === "external_id"
    ? alias.trim().toLowerCase()
    : normalizeAthleteName(alias);

  if (!normalizedAlias) {
    fail("The alias could not be normalized to a usable value.");
  }

  const externalSource = aliasType === "external_id"
    ? cleanAthleteText(body.external_source, 100)
    : "";

  if (aliasType === "external_id" && !externalSource) {
    fail('An external source name (for example, "athletic.net") is required for an external id alias.');
  }

  const { data: profileRow, error: profileError } = await supabaseAdmin
    .from("athlete_profiles")
    .select("id")
    .eq("id", profileId)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profileRow) {
    fail("Athlete profile not found.", 404);
  }

  const { data, error } = await supabaseAdmin
    .from("athlete_profile_aliases")
    .upsert(
      {
        profile_id: profileId,
        alias,
        normalized_alias: normalizedAlias,
        alias_type: aliasType,
        external_source: externalSource || null,
        notes: cleanAthleteText(body.notes, 1000) || null
      },
      { onConflict: "profile_id,normalized_alias" }
    )
    .select("*")
    .single();

  if (error) {
    if (isMissingAthleteFoundationError(error)) {
      fail(
        "Run install/32_ATHLETE_PROFILE_ALIASES_EXTEND.sql before adding alias types.",
        409
      );
    }

    throw error;
  }

  return {
    alias: data,
    context: await loadProfile(profileId)
  };
}

async function deleteAlias(body) {
  await requireInstalled();
  const aliasId = cleanUuid(body.alias_id, "Alias ID");
  const profileId = cleanUuid(body.profile_id, "Athlete profile ID");
  const { error } = await supabaseAdmin
    .from("athlete_profile_aliases")
    .delete()
    .eq("id", aliasId)
    .eq("profile_id", profileId);

  if (error) {
    throw error;
  }

  return {
    context: await loadProfile(profileId)
  };
}

async function saveProfile(body) {
  await requireInstalled();
  const profileId = cleanAthleteText(body.profile_id, 100)
    ? cleanUuid(body.profile_id, "Athlete profile ID")
    : "";
  const firstName = cleanAthleteText(body.first_name, 120);
  const lastName = cleanAthleteText(body.last_name, 120);

  if (!firstName || !lastName) {
    fail("First name and last name are required.");
  }

  const preferredName = cleanAthleteText(body.preferred_name, 120) || null;
  const displayName = cleanAthleteText(body.display_name, 250) ||
    `${preferredName || firstName} ${lastName}`;
  const gender = normalizeAthleteGender(body.gender);
  const graduationYear = cleanInteger(body.graduation_year, {
    label: "Graduation year",
    min: 2000,
    max: 2200,
    nullable: true
  });
  const athleteStatus = cleanAthleteText(body.athlete_status, 50).toLowerCase();
  const verificationStatus = cleanAthleteText(body.verification_status, 80).toLowerCase();

  if (!PROFILE_STATUSES.has(athleteStatus)) {
    fail("Choose a valid athlete status.");
  }

  if (!VERIFICATION_STATUSES.has(verificationStatus)) {
    fail("Choose a valid verification status.");
  }

  const recruitingEnabled = cleanBoolean(body.recruiting_enabled);
  const recruitingConsent = cleanBoolean(body.recruiting_consent_confirmed);
  const contactRoute = cleanAthleteText(body.recruiting_contact_route, 50).toLowerCase() || "none";

  if (recruitingEnabled && !recruitingConsent) {
    fail("Recruiting consent must be confirmed before enabling recruiting information.");
  }

  if (recruitingEnabled && !["team", "podium_watch"].includes(contactRoute)) {
    fail("Choose the team or Podium Watch as the recruiting contact route.");
  }

  const payload = {
    first_name: firstName,
    last_name: lastName,
    preferred_name: preferredName,
    display_name: displayName,
    normalized_name: normalizeAthleteName(displayName),
    gender,
    graduation_year: graduationYear,
    graduation_year_source: cleanAthleteText(body.graduation_year_source, 500) || null,
    current_school_id: cleanAthleteText(body.current_school_id, 100)
      ? cleanUuid(body.current_school_id, "Official school ID")
      : null,
    current_team_id: cleanAthleteText(body.current_team_id, 100)
      ? cleanUuid(body.current_team_id, "Team page ID")
      : null,
    athlete_status: athleteStatus,
    bio: cleanAthleteText(body.bio, 5000) || null,
    photo_url: cleanUrl(body.photo_url, "Photo URL"),
    hometown: cleanAthleteText(body.hometown, 200) || null,
    college_commitment: cleanAthleteText(body.college_commitment, 300) || null,
    college_commitment_verified: cleanBoolean(body.college_commitment_verified),
    public_visible: cleanBoolean(body.public_visible),
    published_at: cleanBoolean(body.public_visible)
      ? new Date().toISOString()
      : null,
    verified: cleanBoolean(body.verified),
    verification_status: verificationStatus,
    suspended: cleanBoolean(body.suspended),
    admin_locked: cleanBoolean(body.admin_locked),
    recruiting_enabled: recruitingEnabled,
    recruiting_headline: cleanAthleteText(body.recruiting_headline, 500) || null,
    primary_events: cleanStringArray(body.primary_events),
    college_interests: cleanAthleteText(body.college_interests, 2000) || null,
    recruiting_contact_route: recruitingEnabled ? contactRoute : "none",
    recruiting_consent_confirmed: recruitingEnabled ? recruitingConsent : false,
    recruiting_consent_recorded_at: recruitingEnabled && recruitingConsent
      ? new Date().toISOString()
      : null,
    updated_by: "Podium Watch Admin"
  };

  let profile;

  if (profileId) {
    const { data, error } = await supabaseAdmin
      .from("athlete_profiles")
      .update(payload)
      .eq("id", profileId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    profile = data;
  } else {
    let slug = cleanAthleteText(body.slug, 500)
      ? slugifyAthlete(body.slug)
      : slugifyAthlete(`${displayName} ${graduationYear || "unknown"}`);
    const { data: slugRows, error: slugError } = await supabaseAdmin
      .from("athlete_profiles")
      .select("id")
      .eq("slug", slug)
      .limit(1);

    if (slugError) {
      throw slugError;
    }

    if ((slugRows || []).length) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const { data, error } = await supabaseAdmin
      .from("athlete_profiles")
      .insert({
        ...payload,
        slug,
        created_by: "Podium Watch Admin"
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    profile = data;
  }

  return loadProfile(profile.id);
}

async function savePerformance(body) {
  await requireInstalled();
  const profileId = cleanUuid(body.profile_id, "Athlete profile ID");
  const performanceId = cleanAthleteText(body.performance_id, 100)
    ? cleanUuid(body.performance_id, "Performance ID")
    : "";
  const sport = normalizeSport(body.sport);
  const seasonYear = cleanInteger(body.season_year, {
    label: "Season year",
    min: 2000,
    max: 2200
  });
  const eventName = cleanAthleteText(body.event_name, 150);
  const markText = cleanAthleteText(body.mark_text, 150);
  const recordType = cleanAthleteText(body.record_type, 50).toLowerCase();
  const sourceType = cleanAthleteText(body.source_type, 50).toLowerCase();
  const verificationStatus = cleanAthleteText(body.verification_status, 50).toLowerCase();

  if (!eventName || !markText) {
    fail("Event and mark are required.");
  }

  if (!PERFORMANCE_RECORD_TYPES.has(recordType)) {
    fail("Choose a valid performance record type.");
  }

  if (!PERFORMANCE_SOURCE_TYPES.has(sourceType)) {
    fail("Choose a valid performance source type.");
  }

  if (!PERFORMANCE_VERIFICATION.has(verificationStatus)) {
    fail("Choose a valid performance verification status.");
  }

  const sourceLabel = cleanAthleteText(body.source_label, 300);

  if (!sourceLabel) {
    fail("A source label is required for every performance.");
  }

  const meetDate = cleanAthleteText(body.meet_date, 30);

  if (meetDate && !/^\d{4}-\d{2}-\d{2}$/.test(meetDate)) {
    fail("Meet date must use YYYY-MM-DD.");
  }

  const payload = {
    profile_id: profileId,
    school_id: cleanAthleteText(body.school_id, 100)
      ? cleanUuid(body.school_id, "Official school ID")
      : null,
    team_id: cleanAthleteText(body.team_id, 100)
      ? cleanUuid(body.team_id, "Team page ID")
      : null,
    sport,
    season_year: seasonYear,
    event_name: eventName,
    event_key: normalizeEventKey(eventName),
    mark_text: markText,
    mark_value: cleanAthleteText(body.mark_value, 100)
      ? Number(body.mark_value)
      : null,
    mark_unit: cleanAthleteText(body.mark_unit, 50) || null,
    record_type: recordType,
    meet_name: cleanAthleteText(body.meet_name, 300) || null,
    meet_date: meetDate || null,
    place: cleanAthleteText(body.place, 30)
      ? cleanInteger(body.place, { label: "Place", min: 1, max: 100000 })
      : null,
    grade: cleanAthleteText(body.grade, 30)
      ? cleanInteger(body.grade, { label: "Grade", min: 6, max: 12 })
      : null,
    wind_text: cleanAthleteText(body.wind_text, 80) || null,
    source_key: cleanAthleteText(body.source_key, 500) || null,
    source_label: sourceLabel,
    source_url: cleanUrl(body.source_url, "Source URL"),
    source_type: sourceType,
    verification_status: verificationStatus,
    public_visible: cleanBoolean(body.public_visible),
    verified_at: verificationStatus === "verified"
      ? new Date().toISOString()
      : null,
    verified_by: verificationStatus === "verified"
      ? "Podium Watch Admin"
      : null,
    notes: cleanAthleteText(body.notes, 2000) || null
  };

  if (payload.mark_value !== null && !Number.isFinite(payload.mark_value)) {
    fail("Numeric mark value must be a number or left blank.");
  }

  let saved;

  if (performanceId) {
    const { data, error } = await supabaseAdmin
      .from("athlete_performances")
      .update(payload)
      .eq("id", performanceId)
      .eq("profile_id", profileId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    saved = data;
  } else {
    const { data, error } = await supabaseAdmin
      .from("athlete_performances")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    saved = data;
  }

  return {
    performance: saved,
    context: await loadProfile(profileId)
  };
}

async function archivePerformance(body) {
  await requireInstalled();
  const profileId = cleanUuid(body.profile_id, "Athlete profile ID");
  const performanceId = cleanUuid(body.performance_id, "Performance ID");
  const { data, error } = await supabaseAdmin
    .from("athlete_performances")
    .update({
      archived_at: new Date().toISOString(),
      public_visible: false
    })
    .eq("id", performanceId)
    .eq("profile_id", profileId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    fail("Performance record not found.", 404);
  }

  return loadProfile(profileId);
}

async function resolveCorrection(body) {
  await requireInstalled();
  const correctionId = cleanUuid(body.correction_id, "Correction ID");
  const status = cleanAthleteText(body.status, 50).toLowerCase();

  if (!CORRECTION_STATUSES.has(status)) {
    fail("Choose a valid correction status.");
  }

  const { data, error } = await supabaseAdmin
    .from("athlete_profile_corrections")
    .update({
      status,
      resolution_note: cleanAthleteText(body.resolution_note, 2000) || null,
      resolved_at: ["resolved", "rejected"].includes(status)
        ? new Date().toISOString()
        : null,
      resolved_by: ["resolved", "rejected"].includes(status)
        ? "Podium Watch Admin"
        : null
    })
    .eq("id", correctionId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return { correction: data };
}

async function mergeProfiles(body) {
  await requireInstalled();
  const sourceId = cleanUuid(body.source_profile_id, "Source profile ID");
  const targetId = cleanUuid(body.target_profile_id, "Target profile ID");

  if (sourceId === targetId) {
    fail("Choose two different athlete profiles.");
  }

  if (body.confirm !== true) {
    fail("Confirm the athlete profile merge before saving it.");
  }

  const { data, error } = await supabaseAdmin.rpc(
    "athlete_merge_profiles_v1",
    {
      p_source_profile_id: sourceId,
      p_target_profile_id: targetId,
      p_actor: "Podium Watch Admin",
      p_reason: cleanAthleteText(body.reason, 1000) || null
    }
  );

  if (error) {
    const message = String(error.message || "");

    if (message.includes("ATHLETE_MERGE_TARGET_MUST_DIFFER")) {
      fail("Choose two different athlete profiles.");
    }

    if (message.includes("ATHLETE_MERGE_PROFILE_NOT_FOUND")) {
      fail("One of the athlete profiles could not be found.", 404);
    }

    throw error;
  }

  return {
    result: data,
    target: await loadProfile(targetId)
  };
}

async function unmergeProfile(body) {
  await requireInstalled();
  const mergeId = cleanUuid(body.merge_id, "Merge ID");

  if (body.confirm !== true) {
    fail("Confirm the athlete profile unmerge before saving it.");
  }

  const { data, error } = await supabaseAdmin.rpc(
    "athlete_unmerge_profiles_v1",
    {
      p_merge_id: mergeId,
      p_actor: "Podium Watch Admin"
    }
  );

  if (error) {
    const message = String(error.message || "");

    if (isMissingAthleteFoundationError(error)) {
      fail(
        "Run install/33_ATHLETE_MERGE_REVERSAL.sql before undoing a merge.",
        409
      );
    }

    if (message.includes("ATHLETE_UNMERGE_MERGE_NOT_FOUND")) {
      fail("That merge record could not be found.", 404);
    }

    if (message.includes("ATHLETE_UNMERGE_ALREADY_REVERSED")) {
      fail("This merge has already been undone.");
    }

    if (message.includes("ATHLETE_UNMERGE_NO_SNAPSHOT")) {
      fail("This merge happened before undo support existed and cannot be reversed.");
    }

    if (message.includes("ATHLETE_UNMERGE_SOURCE_STATE_CHANGED")) {
      fail("The source athlete profile has changed since this merge and cannot be safely undone.");
    }

    if (message.includes("ATHLETE_UNMERGE_TARGET_SINCE_MERGED")) {
      fail("The target profile has itself since been merged into another profile and cannot be safely undone from here.");
    }

    throw error;
  }

  return {
    result: data,
    source: await loadProfile(data.source_profile_id)
  };
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
    const action = cleanAthleteText(body.action, 80).toLowerCase() || "status";
    let data;

    if (action === "status") {
      data = await loadStatus();
    } else if (action === "preview_seed") {
      data = await buildAthleteSeedPreview();
    } else if (action === "commit_seed") {
      data = await commitAthleteSeedImport({
        actor: "Podium Watch Admin",
        publishProfiles: body.publish_profiles !== false,
        linkRosters: body.link_rosters !== false
      });
    } else if (action === "search") {
      data = await searchProfiles(body);
    } else if (action === "get") {
      data = await loadProfile(body.profile_id);
    } else if (action === "save_profile") {
      data = await saveProfile(body);
    } else if (action === "save_performance") {
      data = await savePerformance(body);
    } else if (action === "archive_performance") {
      data = await archivePerformance(body);
    } else if (action === "resolve_correction") {
      data = await resolveCorrection(body);
    } else if (action === "merge_profiles") {
      data = await mergeProfiles(body);
    } else if (action === "unmerge_profile") {
      data = await unmergeProfile(body);
    } else if (action === "save_alias") {
      data = await saveAlias(body);
    } else if (action === "delete_alias") {
      data = await deleteAlias(body);
    } else {
      fail("Unsupported athlete admin action.");
    }

    return response.status(200).json(data);
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Athlete admin error:", error);
    }

    return response.status(status).json({
      error: status < 500
        ? error.message
        : "The athlete admin request could not be completed."
    });
  }
}
