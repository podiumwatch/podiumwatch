import { supabaseAdmin } from "../../lib/supabase-admin.mjs";
import { isAdminRequest } from "../../lib/admin_auth.mjs";
import {
  cleanAthleteText,
  normalizeAthleteGender
} from "../../lib/athlete_foundation_service.mjs";
import {
  CONTENT_ITEM_STATUSES,
  CONTENT_ITEM_TYPES,
  EVENT_GROUPS,
  RECRUIT_ACTIVITY_STATUSES,
  RECRUIT_ACTIVITY_TYPES,
  RATING_STATUSES,
  commitPerformanceImport,
  eventDefinitions,
  isMissingRecruitingFoundationError,
  loadLatestRankSnapshots,
  parseOfficialResultsText,
  PERFORMANCE_SOURCE_TYPES,
  previewPerformanceImport,
  recordRecruitRatingRankSnapshots,
  starLabel,
  starRatingForScore
} from "../../lib/recruiting_service.mjs";
import { loadOfficialResultsLink } from "../../lib/results_source_service.mjs";

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The recruiting admin request is invalid.");
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

function cleanBoolean(value) {
  if (typeof value === "boolean") return value;

  return ["1", "true", "yes", "on"].includes(
    cleanAthleteText(value, 20).toLowerCase()
  );
}

function cleanInteger(value, label, min, max, nullable = false) {
  const cleaned = cleanAthleteText(value, 50);

  if (!cleaned && nullable) return null;

  const number = Number(cleaned);

  if (!Number.isInteger(number) || number < min || number > max) {
    fail(`${label} must be between ${min} and ${max}.`);
  }

  return number;
}

function cleanNumber(value, label, min, max, nullable = false) {
  const cleaned = cleanAthleteText(value, 50);

  if (!cleaned && nullable) return null;

  const number = Number(cleaned);

  if (!Number.isFinite(number) || number < min || number > max) {
    fail(`${label} must be between ${min} and ${max}.`);
  }

  return number;
}

function cleanUrl(value, label) {
  const cleaned = cleanAthleteText(value, 2000);

  if (!cleaned) return null;

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

function cleanStringArray(value, maxItems = 20) {
  const values = Array.isArray(value)
    ? value
    : cleanAthleteText(value, 3000).split(/[;,|\n]/);

  return [...new Set(
    values
      .map((item) => cleanAthleteText(item, 100))
      .filter(Boolean)
  )].slice(0, maxItems);
}

async function requireInstalled() {
  // Look up whichever methodology is currently active rather than a
  // hardcoded key. A hardcoded key silently breaks the moment a new
  // methodology version is activated and the old one is retired (as
  // happened when 2026.2 replaced 2026.1) -- every action gated by this
  // function would keep operating under the retired version instead of
  // failing loudly.
  const { data, error } = await supabaseAdmin
    .from("athlete_recruit_rating_methodologies")
    .select("id")
    .eq("status", "active")
    .order("effective_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingRecruitingFoundationError(error)) {
      fail(
        "Run install/03_RECRUIT_RATINGS_AND_PERFORMANCE_HISTORY.sql before using the Recruiting Center.",
        409
      );
    }

    throw error;
  }

  if (!data) {
    fail(
      "The Podium Watch Recruit Ratings methodology is missing.",
      409
    );
  }

  return data.id;
}

async function loadStatus() {
  let installed = true;
  let methodologyId = null;

  try {
    methodologyId = await requireInstalled();
  } catch (error) {
    if (Number(error.status) === 409) {
      installed = false;
    } else {
      throw error;
    }
  }

  if (!installed) {
    return {
      installed: false,
      migration_path:
        "install/03_RECRUIT_RATINGS_AND_PERFORMANCE_HISTORY.sql",
      counts: {
        events: 0,
        performances: 0,
        verified_performances: 0,
        rated_athletes: 0,
        published_ratings: 0,
        draft_ratings: 0,
        recruiting_activities: 0,
        failed_imports: 0
      },
      events: eventDefinitions(),
      recent_imports: [],
      methodology: null
    };
  }

  const [
    methodologyResult,
    eventResult,
    performanceResult,
    verifiedPerformanceResult,
    ratingResult,
    publishedResult,
    draftResult,
    activityResult,
    failedImportsResult,
    recentImportsResult
  ] = await Promise.all([
    supabaseAdmin
      .from("athlete_recruit_rating_methodologies")
      .select("*")
      .eq("id", methodologyId)
      .single(),
    supabaseAdmin
      .from("athlete_event_catalog")
      .select("*", { count: "exact" })
      .eq("public_visible", true)
      .order("sort_order", { ascending: true }),
    supabaseAdmin
      .from("athlete_performances")
      .select("id", { count: "exact", head: true })
      .is("archived_at", null),
    supabaseAdmin
      .from("athlete_performances")
      .select("id", { count: "exact", head: true })
      .in("verification_status", ["source_linked", "verified"])
      .or(
        "source_type.in.(official,supplied_reference),and(source_type.eq.community,verification_status.eq.verified)"
      )
      .is("archived_at", null),
    supabaseAdmin
      .from("athlete_recruit_ratings")
      .select("profile_id", { count: "exact", head: true })
      .is("archived_at", null),
    supabaseAdmin
      .from("athlete_recruit_ratings")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .is("archived_at", null),
    supabaseAdmin
      .from("athlete_recruit_ratings")
      .select("id", { count: "exact", head: true })
      .eq("status", "draft")
      .is("archived_at", null),
    supabaseAdmin
      .from("athlete_recruiting_activity")
      .select("id", { count: "exact", head: true })
      .is("archived_at", null),
    supabaseAdmin
      .from("athlete_performance_import_batches")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed"),
    supabaseAdmin
      .from("athlete_performance_import_batches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  for (const result of [
    methodologyResult,
    eventResult,
    performanceResult,
    verifiedPerformanceResult,
    ratingResult,
    publishedResult,
    draftResult,
    activityResult,
    failedImportsResult,
    recentImportsResult
  ]) {
    if (result.error) throw result.error;
  }

  return {
    installed: true,
    migration_path:
      "install/03_RECRUIT_RATINGS_AND_PERFORMANCE_HISTORY.sql",
    counts: {
      events: Number(eventResult.count || 0),
      performances: Number(performanceResult.count || 0),
      verified_performances: Number(verifiedPerformanceResult.count || 0),
      rated_athletes: Number(ratingResult.count || 0),
      published_ratings: Number(publishedResult.count || 0),
      draft_ratings: Number(draftResult.count || 0),
      recruiting_activities: Number(activityResult.count || 0),
      failed_imports: Number(failedImportsResult.count || 0)
    },
    methodology: methodologyResult.data,
    events: eventResult.data || [],
    recent_imports: recentImportsResult.data || []
  };
}

async function searchAthletes(body) {
  await requireInstalled();
  const search = cleanAthleteText(body.search, 200);
  const limit = Math.max(1, Math.min(200, Number(body.limit) || 100));
  let query = supabaseAdmin
    .from("athlete_profiles")
    .select(`
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
      college_commitment,
      updated_at
    `)
    .is("archived_at", null)
    .is("merged_into_profile_id", null)
    .order("display_name", { ascending: true })
    .limit(limit);

  if (search) {
    const safe = search.replace(/[,%()]/g, " ");
    query = query.or(
      `display_name.ilike.%${safe}%,slug.ilike.%${safe}%`
    );
  }

  const { data: profiles, error } = await query;

  if (error) throw error;

  const schoolIds = [...new Set((profiles || []).map((row) => row.current_school_id).filter(Boolean))];
  const teamIds = [...new Set((profiles || []).map((row) => row.current_team_id).filter(Boolean))];

  const [schoolsResult, teamsResult] = await Promise.all([
    schoolIds.length
      ? supabaseAdmin
          .from("ohio_schools")
          .select("id, school_name, city")
          .in("id", schoolIds)
      : Promise.resolve({ data: [], error: null }),
    teamIds.length
      ? supabaseAdmin
          .from("team_pages")
          .select("id, school_name, slug, city")
          .in("id", teamIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (schoolsResult.error) throw schoolsResult.error;
  if (teamsResult.error) throw teamsResult.error;

  const schools = new Map((schoolsResult.data || []).map((row) => [row.id, row]));
  const teams = new Map((teamsResult.data || []).map((row) => [row.id, row]));

  return {
    profiles: (profiles || []).map((profile) => ({
      ...profile,
      school: schools.get(profile.current_school_id) || null,
      team: teams.get(profile.current_team_id) || null
    }))
  };
}

async function loadAthleteContext(profileId) {
  const methodologyId = await requireInstalled();
  const id = cleanUuid(profileId, "Athlete profile ID");

  const [
    profileResult,
    ratingResult,
    activitiesResult,
    bestResult,
    performanceResult,
    contentItemResult
  ] = await Promise.all([
    supabaseAdmin
      .from("athlete_profiles")
      .select("*")
      .eq("id", id)
      .single(),
    supabaseAdmin
      .from("athlete_recruit_ratings")
      .select("*")
      .eq("profile_id", id)
      .eq("methodology_id", methodologyId)
      .is("archived_at", null)
      .order("updated_at", { ascending: false }),
    supabaseAdmin
      .from("athlete_recruiting_activity")
      .select("*")
      .eq("profile_id", id)
      .is("archived_at", null)
      .order("activity_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("athlete_best_performances")
      .select("*")
      .eq("profile_id", id)
      .order("event_key", { ascending: true }),
    supabaseAdmin
      .from("athlete_performances")
      .select("*")
      .eq("profile_id", id)
      .is("archived_at", null)
      .order("meet_date", { ascending: false })
      .limit(300),
    supabaseAdmin
      .from("athlete_content_items")
      .select("*")
      .eq("profile_id", id)
      .is("archived_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
  ]);

  for (const result of [
    profileResult,
    ratingResult,
    activitiesResult,
    bestResult,
    performanceResult,
    contentItemResult
  ]) {
    if (result.error) throw result.error;
  }

  const latestSnapshots = await loadLatestRankSnapshots([id]);

  return {
    profile: profileResult.data,
    ratings: (ratingResult.data || []).map((rating) => ({
      ...rating,
      star_label: starLabel(rating.star_rating),
      previous_rank_snapshot:
        latestSnapshots.get(`${id}|${rating.event_group}`) || null
    })),
    activities: activitiesResult.data || [],
    best_performances: bestResult.data || [],
    performances: performanceResult.data || [],
    content_items: contentItemResult.data || []
  };
}

async function saveRating(body) {
  const methodologyId = await requireInstalled();
  const profileId = cleanUuid(body.profile_id, "Athlete profile ID");
  const ratingId = cleanAthleteText(body.rating_id, 100)
    ? cleanUuid(body.rating_id, "Recruit rating ID")
    : null;
  const eventGroup = cleanAthleteText(body.event_group, 80).toLowerCase();
  const status = cleanAthleteText(body.status, 40).toLowerCase() || "draft";
  const score = cleanNumber(body.rating_score, "Rating score", 70, 100, true);
  const primaryEventKey = cleanAthleteText(body.primary_event_key, 100) || null;
  const secondaryEventKeys = cleanStringArray(body.secondary_event_keys);
  const projectionLevel = cleanAthleteText(body.projection_level, 80) || null;
  const confidenceLevel = cleanAthleteText(body.confidence_level, 40).toLowerCase() || "developing";

  if (!EVENT_GROUPS.has(eventGroup)) {
    fail("Choose a valid event group.");
  }

  if (!RATING_STATUSES.has(status)) {
    fail("Choose Draft, Published, or Archived.");
  }

  if (!["limited", "developing", "strong"].includes(confidenceLevel)) {
    fail("Choose a valid confidence level.");
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("athlete_profiles")
    .select("id, display_name, gender, graduation_year")
    .eq("id", profileId)
    .single();

  if (profileError) throw profileError;

  if (!profile.graduation_year) {
    fail("Add the athlete graduation year before creating a rating.");
  }

  const { data: verifiedPerformances, error: performanceError } = await supabaseAdmin
    .from("athlete_performances")
    .select("id, event_key, event_name, event_group, mark_text, source_type, verification_status")
    .eq("profile_id", profileId)
    .in("verification_status", ["source_linked", "verified"])
    .is("archived_at", null);

  if (performanceError) throw performanceError;

  const relevantPerformances = (verifiedPerformances || []).filter(
    (performance) => {
      const acceptableSource =
        ["official", "supplied_reference"].includes(performance.source_type) ||
        (
          performance.source_type === "community" &&
          performance.verification_status === "verified"
        );

      return (
        acceptableSource &&
        (
          performance.event_group === eventGroup ||
          (primaryEventKey && performance.event_key === primaryEventKey)
        )
      );
    }
  );
  const basedOnVerifiedData = cleanBoolean(body.based_on_verified_data);
  const verifiedCount = relevantPerformances.length;
  const evaluation = cleanAthleteText(body.evaluation, 5000) || null;

  if (status === "published") {
    if (!score) fail("A published rating needs a score.");
    if (!basedOnVerifiedData || verifiedCount < 1) {
      fail("A published rating needs at least one source linked or verified performance in the selected event group.");
    }
    if (!evaluation || evaluation.length < 40) {
      fail("A published rating needs an evaluation of at least 40 characters.");
    }
    if (!cleanAthleteText(body.data_cutoff_date, 30)) {
      fail("A published rating needs a data cutoff date.");
    }
  }

  const topVerifiedEventKey = cleanAthleteText(body.top_verified_event_key, 100) || null;
  const topPerformance = relevantPerformances.find(
    (item) => item.event_key === topVerifiedEventKey
  ) || null;

  if (topVerifiedEventKey && !topPerformance) {
    fail("Choose a sourced performance from the selected event group.");
  }

  const payload = {
    profile_id: profileId,
    methodology_id: methodologyId,
    graduation_year: profile.graduation_year,
    gender: normalizeAthleteGender(profile.gender),
    event_group: eventGroup,
    primary_event_key: primaryEventKey,
    secondary_event_keys: secondaryEventKeys,
    rating_score: score,
    star_rating: starRatingForScore(score),
    projection_level: projectionLevel,
    confidence_level: confidenceLevel,
    evaluation,
    strengths: cleanAthleteText(body.strengths, 5000) || null,
    development_notes: cleanAthleteText(body.development_notes, 5000) || null,
    top_verified_mark_text: topPerformance?.mark_text || cleanAthleteText(body.top_verified_mark_text, 100) || null,
    top_verified_event_key: topVerifiedEventKey,
    based_on_verified_data: basedOnVerifiedData,
    verified_performance_count: verifiedCount,
    data_cutoff_date: cleanAthleteText(body.data_cutoff_date, 30) || null,
    status,
    archived_at: status === "archived" ? new Date().toISOString() : null,
    updated_by: "Podium Watch Admin",
    editorial_override_reason: cleanAthleteText(body.editorial_override_reason, 2000) || null,
    metadata: {
      score_is_editorial: true,
      offers_affect_score: false,
      pay_to_play: false
    }
  };

  let result;

  if (ratingId) {
    result = await supabaseAdmin
      .from("athlete_recruit_ratings")
      .update(payload)
      .eq("id", ratingId)
      .eq("profile_id", profileId)
      .select("*")
      .single();
  } else {
    result = await supabaseAdmin
      .from("athlete_recruit_ratings")
      .upsert(payload, {
        onConflict: "profile_id,methodology_id,event_group"
      })
      .select("*")
      .single();
  }

  if (result.error) {
    const message = String(result.error.message || "");

    if (message.includes("RECRUIT_RATING_VERIFIED_PERFORMANCE_REQUIRED")) {
      fail("A published rating needs verified performance evidence.");
    }

    if (message.includes("RECRUIT_RATING_EVALUATION_REQUIRED")) {
      fail("A published rating needs a complete evaluation.");
    }

    if (message.includes("RECRUIT_RATING_TOP_PERFORMANCE_REQUIRED")) {
      fail("The selected top performance is not sourced evidence for this event group.");
    }

    if (message.includes("RECRUIT_RATING_DATA_CUTOFF_REQUIRED")) {
      fail("A published rating needs a data cutoff date.");
    }

    throw result.error;
  }

  // Record where this profile's ranks stand right after the save, so a later
  // read can compare the live computed rank against this stored snapshot to
  // show movement. Safe no-op when the profile has no published rating yet.
  await recordRecruitRatingRankSnapshots(profileId);

  return {
    rating: {
      ...result.data,
      star_label: starLabel(result.data.star_rating)
    },
    context: await loadAthleteContext(profileId)
  };
}

async function saveActivity(body) {
  await requireInstalled();
  const profileId = cleanUuid(body.profile_id, "Athlete profile ID");
  const activityId = cleanAthleteText(body.activity_id, 100)
    ? cleanUuid(body.activity_id, "Recruiting activity ID")
    : null;
  const activityType = cleanAthleteText(body.activity_type, 60).toLowerCase();
  const verificationStatus = cleanAthleteText(body.verification_status, 80).toLowerCase();
  const collegeName = cleanAthleteText(body.college_name, 250);
  const sourceLabel = cleanAthleteText(body.source_label, 300);
  const sourceUrl = cleanUrl(body.source_url, "Source URL");
  const publicVisible = cleanBoolean(body.public_visible);

  if (!RECRUIT_ACTIVITY_TYPES.has(activityType)) {
    fail("Choose a valid recruiting activity type.");
  }

  if (!RECRUIT_ACTIVITY_STATUSES.has(verificationStatus)) {
    fail("Choose a valid recruiting activity verification status.");
  }

  if (!collegeName) fail("College name is required.");
  if (!sourceLabel) fail("Source label is required.");

  if (
    publicVisible &&
    !["confirmed_by_athlete", "confirmed_by_coach", "publicly_announced"].includes(verificationStatus)
  ) {
    fail("Public recruiting activity must be confirmed or publicly announced.");
  }

  if (publicVisible && !sourceUrl) {
    fail("Public recruiting activity needs a source link.");
  }

  const payload = {
    profile_id: profileId,
    activity_type: activityType,
    college_name: collegeName,
    college_division: cleanAthleteText(body.college_division, 100) || null,
    event_group: cleanAthleteText(body.event_group, 80) || null,
    activity_date: cleanAthleteText(body.activity_date, 30) || null,
    verification_status: verificationStatus,
    source_label: sourceLabel,
    source_url: sourceUrl,
    public_visible: publicVisible,
    notes: cleanAthleteText(body.notes, 2000) || null,
    created_by: "Podium Watch Admin",
    updated_by: "Podium Watch Admin"
  };

  let result;

  if (activityId) {
    result = await supabaseAdmin
      .from("athlete_recruiting_activity")
      .update(payload)
      .eq("id", activityId)
      .eq("profile_id", profileId)
      .select("*")
      .single();
  } else {
    result = await supabaseAdmin
      .from("athlete_recruiting_activity")
      .insert(payload)
      .select("*")
      .single();
  }

  if (result.error) throw result.error;

  if (activityType === "commitment" && publicVisible) {
    await supabaseAdmin
      .from("athlete_profiles")
      .update({
        college_commitment: collegeName,
        college_commitment_verified: true,
        updated_by: "Podium Watch Admin"
      })
      .eq("id", profileId);
  }

  return {
    activity: result.data,
    context: await loadAthleteContext(profileId)
  };
}

async function archiveActivity(body) {
  await requireInstalled();
  const profileId = cleanUuid(body.profile_id, "Athlete profile ID");
  const activityId = cleanUuid(body.activity_id, "Recruiting activity ID");
  const { data, error } = await supabaseAdmin
    .from("athlete_recruiting_activity")
    .update({
      archived_at: new Date().toISOString(),
      public_visible: false,
      updated_by: "Podium Watch Admin"
    })
    .eq("id", activityId)
    .eq("profile_id", profileId)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data) fail("Recruiting activity was not found.", 404);

  return loadAthleteContext(profileId);
}

async function saveContentItem(body) {
  await requireInstalled();
  const profileId = cleanUuid(body.profile_id, "Athlete profile ID");
  const contentItemId = cleanAthleteText(body.content_item_id, 100)
    ? cleanUuid(body.content_item_id, "Media item ID")
    : null;
  const contentType = cleanAthleteText(body.content_type, 40).toLowerCase();
  const status = cleanAthleteText(body.status, 40).toLowerCase() || "draft";
  const url = cleanUrl(body.url, "Media URL");
  const sourceType = cleanAthleteText(body.source_type, 50).toLowerCase() || "community";

  if (!CONTENT_ITEM_TYPES.has(contentType)) {
    fail("Choose a valid media type.");
  }

  if (!CONTENT_ITEM_STATUSES.has(status)) {
    fail("Choose Draft, Published, Hidden, or Archived.");
  }

  if (!url) {
    fail("A media URL is required.");
  }

  const payload = {
    profile_id: profileId,
    content_type: contentType,
    title: cleanAthleteText(body.title, 300) || null,
    url,
    caption: cleanAthleteText(body.caption, 1000) || null,
    credit: cleanAthleteText(body.credit, 300) || null,
    source_label: cleanAthleteText(body.source_label, 300) || null,
    source_url: cleanUrl(body.source_url, "Source URL"),
    source_type: PERFORMANCE_SOURCE_TYPES.has(sourceType) ? sourceType : "community",
    status,
    featured: cleanBoolean(body.featured),
    sort_order: cleanInteger(body.sort_order, "Sort order", 0, 100000, true) ?? 100,
    updated_by: "Podium Watch Admin"
  };

  let result;

  if (contentItemId) {
    result = await supabaseAdmin
      .from("athlete_content_items")
      .update(payload)
      .eq("id", contentItemId)
      .eq("profile_id", profileId)
      .select("*")
      .single();
  } else {
    result = await supabaseAdmin
      .from("athlete_content_items")
      .insert({ ...payload, created_by: "Podium Watch Admin" })
      .select("*")
      .single();
  }

  if (result.error) throw result.error;

  return {
    content_item: result.data,
    context: await loadAthleteContext(profileId)
  };
}

async function archiveContentItem(body) {
  await requireInstalled();
  const profileId = cleanUuid(body.profile_id, "Athlete profile ID");
  const contentItemId = cleanUuid(body.content_item_id, "Media item ID");
  const { data, error } = await supabaseAdmin
    .from("athlete_content_items")
    .update({
      archived_at: new Date().toISOString(),
      status: "archived",
      updated_by: "Podium Watch Admin"
    })
    .eq("id", contentItemId)
    .eq("profile_id", profileId)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data) fail("Media item was not found.", 404);

  return loadAthleteContext(profileId);
}

// Shows an admin exactly what the public site would display for this athlete
// if every current draft rating, activity, and media item were published
// right now, without changing anything. Ranks are only shown when a rating
// is already published, since a draft rating is intentionally excluded from
// the ranking view and its eventual rank cannot be known before publication.
async function previewPublicProfile(body) {
  await requireInstalled();
  const profileId = cleanUuid(body.profile_id, "Athlete profile ID");

  const [
    profileResult,
    ratingResult,
    publishedRatingResult,
    activityResult,
    bestResult,
    contentItemResult
  ] = await Promise.all([
    supabaseAdmin
      .from("athlete_profiles")
      .select("id, slug, display_name, gender, graduation_year, college_commitment, recruiting_enabled, recruiting_consent_confirmed")
      .eq("id", profileId)
      .single(),
    supabaseAdmin
      .from("athlete_recruit_ratings")
      .select("*")
      .eq("profile_id", profileId)
      .is("archived_at", null)
      .order("updated_at", { ascending: false }),
    supabaseAdmin
      .from("athlete_published_recruit_ratings")
      .select("*")
      .eq("profile_id", profileId),
    supabaseAdmin
      .from("athlete_recruiting_activity")
      .select("*")
      .eq("profile_id", profileId)
      .is("archived_at", null)
      .order("activity_date", { ascending: false }),
    supabaseAdmin
      .from("athlete_best_performances")
      .select("*")
      .eq("profile_id", profileId),
    supabaseAdmin
      .from("athlete_content_items")
      .select("*")
      .eq("profile_id", profileId)
      .is("archived_at", null)
      .order("sort_order", { ascending: true })
  ]);

  for (const result of [
    profileResult,
    ratingResult,
    publishedRatingResult,
    activityResult,
    bestResult,
    contentItemResult
  ]) {
    if (result.error) throw result.error;
  }

  const publishedByGroup = new Map(
    (publishedRatingResult.data || []).map((row) => [row.event_group, row])
  );

  return {
    profile: profileResult.data,
    would_be_public: Boolean(
      profileResult.data.recruiting_enabled &&
      profileResult.data.recruiting_consent_confirmed
    ),
    ratings: (ratingResult.data || []).map((rating) => {
      const publishedRow = publishedByGroup.get(rating.event_group);

      return {
        ...rating,
        star_label: starLabel(rating.star_rating),
        would_show_on_public_directory: rating.status === "published",
        state_class_rank: rating.status === "published" ? publishedRow?.state_class_rank ?? null : null,
        event_group_rank: rating.status === "published" ? publishedRow?.event_group_rank ?? null : null,
        rank_note: rating.status === "published"
          ? null
          : "This rating is a draft. Its rank cannot be shown until it is published."
      };
    }),
    activities: (activityResult.data || []).map((activity) => ({
      ...activity,
      would_show_on_public_profile: activity.public_visible
    })),
    best_performances: bestResult.data || [],
    content_items: (contentItemResult.data || []).map((item) => ({
      ...item,
      would_show_on_public_profile: item.status === "published"
    }))
  };
}

// Read-only comparison aid, approved as Phase Three decision 5 (2026-08-05).
// Shows an admin the currently published ratings in the same graduation
// year, gender, and event group as the rating they are writing, sorted by
// score, so they have fast side-by-side context. This must never become a
// formula that produces a score -- it only ever returns already-published,
// already-reviewed ratings for a human to look at.
async function loadRatingComparison(body) {
  await requireInstalled();
  const graduationYear = cleanInteger(body.graduation_year, "Graduation year", 2000, 2200);
  const gender = normalizeAthleteGender(body.gender);
  const eventGroup = cleanAthleteText(body.event_group, 80).toLowerCase();
  const excludeProfileId = cleanAthleteText(body.exclude_profile_id, 100)
    ? cleanUuid(body.exclude_profile_id, "Athlete profile ID")
    : null;

  if (!EVENT_GROUPS.has(eventGroup)) {
    fail("Choose a valid event group.");
  }

  if (gender === "unspecified") {
    fail("Choose boys or girls.");
  }

  let query = supabaseAdmin
    .from("athlete_published_recruit_ratings")
    .select(
      "profile_id, rating_score, star_rating, top_verified_mark_text, top_verified_event_key, state_class_rank, event_group_rank"
    )
    .eq("graduation_year", graduationYear)
    .eq("gender", gender)
    .eq("event_group", eventGroup)
    .order("rating_score", { ascending: false })
    .limit(50);

  if (excludeProfileId) {
    query = query.neq("profile_id", excludeProfileId);
  }

  const { data: ratings, error } = await query;

  if (error) throw error;

  const profileIds = [...new Set((ratings || []).map((row) => row.profile_id))];
  const { data: profiles, error: profileError } = profileIds.length
    ? await supabaseAdmin
        .from("athlete_profiles")
        .select("id, display_name")
        .in("id", profileIds)
    : { data: [], error: null };

  if (profileError) throw profileError;

  const nameByProfileId = new Map((profiles || []).map((row) => [row.id, row.display_name]));

  return {
    graduation_year: graduationYear,
    gender,
    event_group: eventGroup,
    comparisons: (ratings || []).map((row) => ({
      profile_id: row.profile_id,
      display_name: nameByProfileId.get(row.profile_id) || "Unknown athlete",
      rating_score: row.rating_score,
      star_rating: row.star_rating,
      star_label: starLabel(row.star_rating),
      mark_text: row.top_verified_mark_text,
      event_key: row.top_verified_event_key,
      state_class_rank: row.state_class_rank,
      event_group_rank: row.event_group_rank
    }))
  };
}

async function previewImport(body) {
  await requireInstalled();
  return previewPerformanceImport(
    body.rows,
    {
      source_label: cleanAthleteText(body.source_label, 300),
      source_url: cleanUrl(body.source_url, "Source URL"),
      source_type: cleanAthleteText(body.source_type, 50).toLowerCase() || "official",
      verification_status:
        cleanAthleteText(body.verification_status, 50).toLowerCase() ||
        "source_linked",
      sport: cleanAthleteText(body.sport, 100),
      season_year: body.season_year,
      gender: cleanAthleteText(body.gender, 50),
      event_name: cleanAthleteText(body.event_name, 150),
      meet_name: cleanAthleteText(body.meet_name, 300),
      meet_date: cleanAthleteText(body.meet_date, 30)
    },
    {
      createProfilesForUnmatchedOfficialRows: cleanBoolean(body.create_profiles_for_unmatched_official_rows)
    }
  );
}

// Converts results copy-pasted from an official results page (MileSplit,
// SEO Timing, and similar sites that only render results with client-side
// JavaScript, so they can never be fetched directly) into rows, then runs
// the exact same preview used for CSV rows. The parsed rows are returned
// alongside the preview so the browser can hold onto them for the later
// commit step, the same way it already does for CSV rows.
async function previewOfficialResultsText(body) {
  await requireInstalled();
  const seasonYear = cleanInteger(body.season_year, "Season year", 2000, 2200);
  const parsedRows = parseOfficialResultsText(
    String(body.official_results_text ?? "").slice(0, 2000000),
    { season_year: seasonYear }
  );

  if (!parsedRows.length) {
    fail("No recognizable result rows were found in that pasted text. Confirm you copied the place, athlete, grade, team, and mark for each row.");
  }

  const preview = await previewPerformanceImport(
    parsedRows,
    {
      source_label: cleanAthleteText(body.source_label, 300),
      source_url: cleanUrl(body.source_url, "Source URL"),
      source_type: cleanAthleteText(body.source_type, 50).toLowerCase() || "official",
      verification_status:
        cleanAthleteText(body.verification_status, 50).toLowerCase() ||
        "source_linked",
      sport: cleanAthleteText(body.sport, 100),
      season_year: seasonYear,
      gender: cleanAthleteText(body.gender, 50),
      event_name: cleanAthleteText(body.event_name, 150),
      meet_name: cleanAthleteText(body.meet_name, 300),
      meet_date: cleanAthleteText(body.meet_date, 30)
    },
    {
      createProfilesForUnmatchedOfficialRows: cleanBoolean(body.create_profiles_for_unmatched_official_rows)
    }
  );

  return { ...preview, submitted_rows: parsedRows };
}

async function commitImport(body) {
  await requireInstalled();

  if (body.confirm !== true) {
    fail("Confirm the reviewed performance import before saving it.");
  }

  return commitPerformanceImport({
    rows: body.rows,
    defaults: {
      source_label: cleanAthleteText(body.source_label, 300),
      source_url: cleanUrl(body.source_url, "Source URL"),
      source_type: cleanAthleteText(body.source_type, 50).toLowerCase() || "official",
      verification_status:
        cleanAthleteText(body.verification_status, 50).toLowerCase() ||
        "source_linked",
      sport: cleanAthleteText(body.sport, 100),
      season_year: body.season_year,
      gender: cleanAthleteText(body.gender, 50),
      event_name: cleanAthleteText(body.event_name, 150),
      meet_name: cleanAthleteText(body.meet_name, 300),
      meet_date: cleanAthleteText(body.meet_date, 30)
    },
    actor: "Podium Watch Admin",
    createProfilesForUnmatchedOfficialRows: cleanBoolean(body.create_profiles_for_unmatched_official_rows)
  });
}

async function loadResultsLink(body) {
  const sourceUrl = cleanAthleteText(body.source_url, 2000);
  if (!sourceUrl) fail("Enter an official results link first.");
  return loadOfficialResultsLink(sourceUrl);
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
    } else if (action === "search") {
      data = await searchAthletes(body);
    } else if (action === "get") {
      data = await loadAthleteContext(body.profile_id);
    } else if (action === "save_rating") {
      data = await saveRating(body);
    } else if (action === "save_activity") {
      data = await saveActivity(body);
    } else if (action === "archive_activity") {
      data = await archiveActivity(body);
    } else if (action === "save_content_item") {
      data = await saveContentItem(body);
    } else if (action === "archive_content_item") {
      data = await archiveContentItem(body);
    } else if (action === "preview_public_profile") {
      data = await previewPublicProfile(body);
    } else if (action === "load_rating_comparison") {
      data = await loadRatingComparison(body);
    } else if (action === "preview_official_results_text") {
      data = await previewOfficialResultsText(body);
    } else if (action === "preview_performance_import") {
      data = await previewImport(body);
    } else if (action === "commit_performance_import") {
      data = await commitImport(body);
    } else if (action === "load_results_link") {
      data = await loadResultsLink(body);
    } else {
      fail("Unsupported recruiting admin action.");
    }

    return response.status(200).json(data);
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Recruiting admin error:", error);
    }

    return response.status(status).json({
      error: status < 500
        ? error.message
        : "The recruiting admin request could not be completed."
    });
  }
}
