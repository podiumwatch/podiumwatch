import { supabaseAdmin } from "./supabase-admin.mjs";
import { calculateTeamCompletion } from "./team_audit.mjs";

// Operations Center's dashboard/task-building logic, extracted verbatim
// out of api/admin/operations.js (see docs/DECISIONS.md, 2026-08-16) so
// the admin redesign's badge counts and needs-attention panel can reuse
// the exact same, already-correct task list instead of a second
// implementation that could drift out of sync with it. api/admin/
// operations.js itself is now a thin handler that imports getDashboard()
// from here -- this move is not a rewrite, and Operations Center's own
// behavior is unchanged.
//
// Follows the lib/*_service.mjs pattern already used by every other
// admin feature (lib/team_audit.mjs, lib/recruiting_service.mjs, etc.)
// -- this file just never had that split until now.

const OHIO_TIME_ZONE = "America/New_York";

function cleanText(value, maxLength = 500) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function ohioDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: OHIO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(dateText, days) {
  const date = new Date(`${dateText}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isMissing(value) {
  return !cleanText(value, 4000);
}

function hasResults(meet) {
  return Boolean(
    cleanText(meet?.results_url, 2000) ||
    cleanText(meet?.athleticnet_url, 2000) ||
    cleanText(meet?.milesplit_url, 2000)
  );
}

function meetCompleteness(meet) {
  const checks = [
    ["location", Boolean(meet?.venue_name || meet?.address || meet?.city)],
    ["schedule", Boolean(meet?.schedule_text || meet?.start_time)],
    ["teams", Boolean(meet?.teams_text)],
    ["description", Boolean(meet?.description)],
    ["registration", Boolean(meet?.registration_url || meet?.official_website_url)]
  ];

  const complete = checks.filter(([, value]) => value).length;

  return {
    score: Math.round((complete / checks.length) * 100),
    missing: checks.filter(([, value]) => !value).map(([label]) => label)
  };
}

function normalizeSubsystemError(error) {
  const code = cleanText(error?.code, 80);
  const message = cleanText(error?.message, 500);

  if (
    code === "42P01" ||
    code === "PGRST205" ||
    /relation .* does not exist/i.test(message) ||
    /could not find the table/i.test(message)
  ) {
    return "This optional database feature has not been installed yet.";
  }

  return "This part of the dashboard could not be loaded.";
}

async function runSubsystem({
  key,
  label,
  fallback = [],
  query,
  issues
}) {
  try {
    const result = await query();

    if (result?.error) {
      throw result.error;
    }

    return {
      available: true,
      data: result?.data ?? fallback,
      count: Number.isFinite(Number(result?.count))
        ? Number(result.count)
        : null
    };
  } catch (error) {
    console.error(`Operations Center ${key} error:`, error);

    issues.push({
      key,
      label,
      message: normalizeSubsystemError(error)
    });

    return {
      available: false,
      data: fallback,
      count: null
    };
  }
}

function groupByTeam(rows = []) {
  const map = new Map();

  rows.forEach((row) => {
    if (!row?.team_id) {
      return;
    }

    const current = map.get(row.team_id) || [];
    current.push(row);
    map.set(row.team_id, current);
  });

  return map;
}

export function getAwardPhase(week, now = new Date()) {
  if (!week) {
    return "not_scheduled";
  }

  if (week.status === "winner_announced") {
    return "winner_announced";
  }

  const time = now.getTime();
  const nominationOpens = new Date(week.nomination_opens || 0).getTime();
  const nominationCloses = new Date(week.nomination_closes || 0).getTime();
  const votingOpens = new Date(week.voting_opens || 0).getTime();
  const votingCloses = new Date(week.voting_closes || 0).getTime();

  if (Number.isFinite(votingCloses) && time > votingCloses) {
    return "voting_closed";
  }

  if (
    Number.isFinite(votingOpens) &&
    Number.isFinite(votingCloses) &&
    time >= votingOpens &&
    time <= votingCloses
  ) {
    return "voting_open";
  }

  if (
    Number.isFinite(nominationOpens) &&
    Number.isFinite(nominationCloses) &&
    time >= nominationOpens &&
    time <= nominationCloses
  ) {
    return "nominations_open";
  }

  if (Number.isFinite(nominationOpens) && time < nominationOpens) {
    return "scheduled";
  }

  return cleanText(week.status, 80) || "scheduled";
}

export function chooseAwardWeek(weeks = [], now = new Date()) {
  if (!weeks.length) {
    return null;
  }

  const current = weeks.find((week) => {
    const opens = new Date(week.nomination_opens || 0).getTime();
    const closes = new Date(week.voting_closes || week.nomination_closes || 0).getTime();
    const time = now.getTime();

    return Number.isFinite(opens) && Number.isFinite(closes) && time >= opens && time <= closes;
  });

  if (current) {
    return current;
  }

  const next = weeks.find((week) => {
    const opens = new Date(week.nomination_opens || 0).getTime();
    return Number.isFinite(opens) && opens > now.getTime();
  });

  if (next) {
    return next;
  }

  return [...weeks]
    .sort(
      (first, second) =>
        new Date(second.nomination_opens || 0) -
        new Date(first.nomination_opens || 0)
    )[0];
}

function summarizeAward({
  type,
  week,
  nominations,
  finalists
}) {
  if (!week) {
    return {
      type,
      week: null,
      phase: "not_scheduled",
      nomination_count: 0,
      finalist_count: 0,
      winner_count: 0
    };
  }

  const weekNominations = nominations.filter(
    (row) => row.week_id === week.id
  );

  const weekFinalists = finalists.filter(
    (row) => row.week_id === week.id
  );

  return {
    type,
    week,
    phase: getAwardPhase(week),
    nomination_count: weekNominations.length,
    finalist_count: weekFinalists.length,
    winner_count: weekFinalists.filter((row) => row.winner === true).length
  };
}

function addTask(tasks, task) {
  tasks.push({
    priority: task.priority || "routine",
    title: cleanText(task.title, 180),
    detail: cleanText(task.detail, 500),
    href: cleanText(task.href, 1000),
    label: cleanText(task.label, 100) || "Open",
    count: Number(task.count) || 0,
    category: cleanText(task.category, 80) || "general"
  });
}

function priorityRank(priority) {
  return {
    urgent: 0,
    important: 1,
    routine: 2
  }[priority] ?? 3;
}

export async function getDashboard(days = 30) {
  const now = new Date();
  const today = ohioDateString(now);
  const rangeStart = addDays(today, -45);
  const rangeEnd = addDays(today, 90);
  const analyticsSince = new Date(
    Date.now() - days * 24 * 60 * 60 * 1000
  ).toISOString();
  const awardWindowStart = new Date(
    Date.now() - 45 * 24 * 60 * 60 * 1000
  ).toISOString();
  const awardWindowEnd = new Date(
    Date.now() + 120 * 24 * 60 * 60 * 1000
  ).toISOString();
  const issues = [];

  const [
    meetsResult,
    teamsResult,
    ohioSchoolsResult,
    ohioDivisionsResult,
    ohioConflictsResult,
    socialResult,
    claimsResult,
    reportsResult,
    meetRequestsResult,
    contentResult,
    notificationEventsResult,
    notificationDeliveriesResult,
    settingsResult,
    sponsorsResult,
    placementsResult,
    analyticsViewsResult,
    analyticsClicksResult,
    sponsorClicksResult,
    aotwWeeksResult,
    totwWeeksResult
  ] = await Promise.all([
    runSubsystem({
      key: "meets",
      label: "Meet Center",
      issues,
      query: () =>
        supabaseAdmin
          .from("meets")
          .select(`
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
            host_school,
            meet_type,
            division,
            description,
            schedule_text,
            teams_text,
            results_url,
            athleticnet_url,
            milesplit_url,
            registration_url,
            official_website_url,
            recap_article_url,
            preview_article_url,
            published,
            featured,
            created_at,
            updated_at
          `)
          .gte("meet_date", rangeStart)
          .lte("meet_date", rangeEnd)
          .order("meet_date", { ascending: true })
          .limit(1000)
    }),
    runSubsystem({
      key: "teams",
      label: "Team profiles",
      issues,
      query: () =>
        supabaseAdmin
          .from("team_pages")
          .select(`
            id,
            school_name,
            slug,
            mascot,
            city,
            state,
            conference,
            region,
            head_coach,
            head_boys_coach,
            head_girls_coach,
            description,
            logo_url,
            banner_image_url,
            website_url,
            athletics_url,
            public_contact_email,
            cross_country_boys_division,
            cross_country_girls_division,
            track_boys_division,
            track_girls_division,
            published,
            verified,
            suspended,
            editing_locked,
            claimed_at,
            archived_at,
            merged_into_team_id,
            updated_at
          `)
          .is("merged_into_team_id", null)
          .order("school_name", { ascending: true })
          .limit(3000)
    }),
    runSubsystem({
      key: "ohio_schools",
      label: "Statewide school foundation",
      issues,
      fallback: null,
      query: () =>
        supabaseAdmin
          .from("ohio_schools")
          .select("id", { count: "exact", head: true })
          .eq("status", "active")
    }),
    runSubsystem({
      key: "ohio_school_divisions",
      label: "Official division assignments",
      issues,
      fallback: null,
      query: () =>
        supabaseAdmin
          .from("ohio_school_divisions")
          .select("id", { count: "exact", head: true })
          .eq("current", true)
    }),
    runSubsystem({
      key: "ohio_data_conflicts",
      label: "Statewide data conflicts",
      issues,
      fallback: null,
      query: () =>
        supabaseAdmin
          .from("ohio_data_conflicts")
          .select("id", { count: "exact", head: true })
          .eq("status", "open")
    }),
    runSubsystem({
      key: "team_social_links",
      label: "Team social links",
      issues,
      query: () =>
        supabaseAdmin
          .from("team_social_links")
          .select("team_id, url, published")
          .eq("published", true)
          .limit(10000)
    }),
    runSubsystem({
      key: "claims",
      label: "Team claims",
      issues,
      query: () =>
        supabaseAdmin
          .from("team_claim_requests")
          .select(`
            id,
            team_id,
            requested_school_name,
            requested_city,
            requester_name,
            requester_email,
            requester_role,
            message,
            status,
            created_at
          `)
          .eq("status", "pending")
          .order("created_at", { ascending: true })
          .limit(200)
    }),
    runSubsystem({
      key: "reports",
      label: "Team reports",
      issues,
      query: () =>
        supabaseAdmin
          .from("team_reports")
          .select("*")
          .in("status", ["open", "reviewing"])
          .order("created_at", { ascending: true })
          .limit(200)
    }),
    runSubsystem({
      key: "meet_requests",
      label: "Team schedule requests",
      issues,
      query: () =>
        supabaseAdmin
          .from("team_meet_requests")
          .select("*")
          .in("status", ["pending", "reviewing"])
          .order("created_at", { ascending: true })
          .limit(200)
    }),
    runSubsystem({
      key: "team_content",
      label: "Team content",
      issues,
      query: () =>
        supabaseAdmin
          .from("team_content_items")
          .select(`
            id,
            team_id,
            content_type,
            title,
            status,
            featured,
            suspended,
            event_date,
            published_at,
            created_at,
            updated_at
          `)
          .in("status", ["draft", "published"])
          .order("updated_at", { ascending: false })
          .limit(1000)
    }),
    runSubsystem({
      key: "notification_events",
      label: "Notification queue",
      issues,
      query: () =>
        supabaseAdmin
          .from("team_notification_events")
          .select(`
            id,
            team_id,
            category,
            title,
            status,
            created_at,
            processed_at,
            last_error
          `)
          .in("status", ["pending", "processing", "failed"])
          .order("created_at", { ascending: true })
          .limit(300)
    }),
    runSubsystem({
      key: "notification_deliveries",
      label: "Email deliveries",
      issues,
      query: () =>
        supabaseAdmin
          .from("team_notification_deliveries")
          .select(`
            id,
            team_id,
            delivery_type,
            status,
            created_at,
            sent_at,
            error_message
          `)
          .eq("status", "failed")
          .order("created_at", { ascending: false })
          .limit(200)
    }),
    runSubsystem({
      key: "engagement_settings",
      label: "Engagement settings",
      issues,
      fallback: null,
      query: () =>
        supabaseAdmin
          .from("engagement_settings")
          .select("*")
          .eq("id", true)
          .maybeSingle()
    }),
    runSubsystem({
      key: "sponsors",
      label: "Sponsors",
      issues,
      query: () =>
        supabaseAdmin
          .from("team_sponsors")
          .select("id, name, status, starts_at, ends_at, website_url")
          .order("created_at", { ascending: false })
          .limit(500)
    }),
    runSubsystem({
      key: "sponsor_placements",
      label: "Sponsor placements",
      issues,
      query: () =>
        supabaseAdmin
          .from("team_sponsor_placements")
          .select("id, sponsor_id, team_id, placement_type, active, starts_at, ends_at")
          .limit(2000)
    }),
    runSubsystem({
      key: "analytics_views",
      label: "Team analytics",
      issues,
      fallback: null,
      query: () =>
        supabaseAdmin
          .from("team_analytics_events")
          .select("id", { count: "exact", head: true })
          .gte("created_at", analyticsSince)
          .eq("event_type", "profile_view")
    }),
    runSubsystem({
      key: "analytics_clicks",
      label: "Link analytics",
      issues,
      fallback: null,
      query: () =>
        supabaseAdmin
          .from("team_analytics_events")
          .select("id", { count: "exact", head: true })
          .gte("created_at", analyticsSince)
          .eq("event_type", "link_click")
    }),
    runSubsystem({
      key: "sponsor_clicks",
      label: "Sponsor analytics",
      issues,
      fallback: null,
      query: () =>
        supabaseAdmin
          .from("team_analytics_events")
          .select("id", { count: "exact", head: true })
          .gte("created_at", analyticsSince)
          .eq("event_type", "sponsor_click")
    }),
    runSubsystem({
      key: "aotw_weeks",
      label: "Athlete of the Week",
      issues,
      query: () =>
        supabaseAdmin
          .from("aotw_weeks")
          .select(`
            id,
            week_slug,
            title,
            nomination_opens,
            nomination_closes,
            voting_opens,
            voting_closes,
            status
          `)
          .gte("nomination_opens", awardWindowStart)
          .lte("nomination_opens", awardWindowEnd)
          .order("nomination_opens", { ascending: true })
          .limit(100)
    }),
    runSubsystem({
      key: "totw_weeks",
      label: "Team of the Week",
      issues,
      query: () =>
        supabaseAdmin
          .from("totw_weeks")
          .select(`
            id,
            week_slug,
            title,
            nomination_opens,
            nomination_closes,
            voting_opens,
            voting_closes,
            status
          `)
          .gte("nomination_opens", awardWindowStart)
          .lte("nomination_opens", awardWindowEnd)
          .order("nomination_opens", { ascending: true })
          .limit(100)
    })
  ]);

  const aotwWeeks = aotwWeeksResult.data || [];
  const totwWeeks = totwWeeksResult.data || [];
  const aotwWeekIds = aotwWeeks.map((week) => week.id);
  const totwWeekIds = totwWeeks.map((week) => week.id);

  const [
    aotwNominationsResult,
    aotwFinalistsResult,
    totwNominationsResult,
    totwFinalistsResult
  ] = await Promise.all([
    aotwWeekIds.length
      ? runSubsystem({
          key: "aotw_nominations",
          label: "Athlete nominations",
          issues,
          query: () =>
            supabaseAdmin
              .from("aotw_nominations")
              .select("id, week_id")
              .in("week_id", aotwWeekIds)
              .limit(10000)
        })
      : { available: aotwWeeksResult.available, data: [], count: 0 },
    aotwWeekIds.length
      ? runSubsystem({
          key: "aotw_finalists",
          label: "Athlete finalists",
          issues,
          query: () =>
            supabaseAdmin
              .from("aotw_finalists")
              .select("id, week_id, winner")
              .in("week_id", aotwWeekIds)
              .limit(5000)
        })
      : { available: aotwWeeksResult.available, data: [], count: 0 },
    totwWeekIds.length
      ? runSubsystem({
          key: "totw_nominations",
          label: "Team nominations",
          issues,
          query: () =>
            supabaseAdmin
              .from("totw_nominations")
              .select("id, week_id")
              .in("week_id", totwWeekIds)
              .limit(10000)
        })
      : { available: totwWeeksResult.available, data: [], count: 0 },
    totwWeekIds.length
      ? runSubsystem({
          key: "totw_finalists",
          label: "Team finalists",
          issues,
          query: () =>
            supabaseAdmin
              .from("totw_finalists")
              .select("id, week_id, winner")
              .in("week_id", totwWeekIds)
              .limit(5000)
        })
      : { available: totwWeeksResult.available, data: [], count: 0 }
  ]);

  const [
    athleteProfilesResult,
    publicAthleteProfilesResult,
    athleteCorrectionsResult,
    unlinkedRosterAthletesResult,
    recruitPerformancesResult,
    publishedRecruitRatingsResult,
    draftRecruitRatingsResult,
    failedPerformanceImportsResult
  ] = await Promise.all([
    runSubsystem({
      key: "athlete_profiles",
      label: "Athlete profiles",
      issues,
      fallback: null,
      query: () =>
        supabaseAdmin
          .from("athlete_profiles")
          .select("id", { count: "exact", head: true })
          .is("merged_into_profile_id", null)
          .is("archived_at", null)
    }),
    runSubsystem({
      key: "public_athlete_profiles",
      label: "Public athlete profiles",
      issues,
      fallback: null,
      query: () =>
        supabaseAdmin
          .from("athlete_profiles")
          .select("id", { count: "exact", head: true })
          .is("merged_into_profile_id", null)
          .is("archived_at", null)
          .eq("public_visible", true)
          .eq("suspended", false)
    }),
    runSubsystem({
      key: "athlete_corrections",
      label: "Athlete corrections",
      issues,
      fallback: null,
      query: () =>
        supabaseAdmin
          .from("athlete_profile_corrections")
          .select("id", { count: "exact", head: true })
          .in("status", ["open", "reviewing"])
    }),
    runSubsystem({
      key: "athlete_roster_links",
      label: "Athlete roster links",
      issues,
      fallback: null,
      query: () =>
        supabaseAdmin
          .from("team_athletes")
          .select("id", { count: "exact", head: true })
          .is("athlete_profile_id", null)
    }),
    runSubsystem({
      key: "athlete_recruit_performances",
      label: "Sourced athlete performances",
      issues,
      fallback: null,
      query: () =>
        supabaseAdmin
          .from("athlete_performances")
          .select("id", { count: "exact", head: true })
          .in("verification_status", ["source_linked", "verified"])
          .or(
            "source_type.in.(official,supplied_reference),and(source_type.eq.community,verification_status.eq.verified)"
          )
          .is("archived_at", null)
    }),
    runSubsystem({
      key: "athlete_recruit_ratings_published",
      label: "Published recruit ratings",
      issues,
      fallback: null,
      query: () =>
        supabaseAdmin
          .from("athlete_recruit_ratings")
          .select("id", { count: "exact", head: true })
          .eq("status", "published")
          .is("archived_at", null)
    }),
    runSubsystem({
      key: "athlete_recruit_ratings_draft",
      label: "Draft recruit ratings",
      issues,
      fallback: null,
      query: () =>
        supabaseAdmin
          .from("athlete_recruit_ratings")
          .select("id", { count: "exact", head: true })
          .eq("status", "draft")
          .is("archived_at", null)
    }),
    runSubsystem({
      key: "athlete_performance_import_failures",
      label: "Athlete performance imports",
      issues,
      fallback: null,
      query: () =>
        supabaseAdmin
          .from("athlete_performance_import_batches")
          .select("id", { count: "exact", head: true })
          .eq("status", "failed")
    })
  ]);

  const teams = teamsResult.data || [];
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const socialByTeam = groupByTeam(socialResult.data || []);

  const activeTeams = teams.filter(
    (team) => !team.archived_at && !team.merged_into_team_id
  );

  const completedTeams = activeTeams.map((team) => ({
    ...team,
    completion_score: calculateTeamCompletion(
      team,
      socialByTeam.get(team.id) || []
    )
  }));

  const incompleteTeams = completedTeams
    .filter((team) => team.completion_score < 65)
    .sort(
      (first, second) =>
        first.completion_score - second.completion_score ||
        first.school_name.localeCompare(second.school_name)
    );

  const meets = meetsResult.data || [];
  const upcomingMeets = meets.filter(
    (meet) => meet.meet_date >= today
  );
  const upcomingSevenDays = upcomingMeets.filter(
    (meet) => meet.meet_date <= addDays(today, 7)
  );
  const upcomingThirtyDays = upcomingMeets.filter(
    (meet) => meet.meet_date <= addDays(today, 30)
  );
  const pastMeets = meets.filter(
    (meet) => meet.meet_date < today
  );
  const missingResults = pastMeets
    .filter((meet) => meet.published && !hasResults(meet))
    .sort(
      (first, second) =>
        second.meet_date.localeCompare(first.meet_date)
    );
  const incompleteUpcoming = upcomingMeets
    .map((meet) => ({
      ...meet,
      completeness: meetCompleteness(meet)
    }))
    .filter((meet) => meet.completeness.score < 80)
    .sort(
      (first, second) =>
        first.meet_date.localeCompare(second.meet_date) ||
        first.completeness.score - second.completeness.score
    );
  const draftMeets = meets
    .filter((meet) => !meet.published)
    .sort(
      (first, second) =>
        first.meet_date.localeCompare(second.meet_date)
    );

  const claims = (claimsResult.data || []).map((claim) => ({
    ...claim,
    team: teamById.get(claim.team_id) || null
  }));
  const reports = (reportsResult.data || []).map((report) => ({
    ...report,
    team: teamById.get(report.team_id) || null
  }));
  const meetRequests = (meetRequestsResult.data || []).map((request) => ({
    ...request,
    team: teamById.get(request.team_id) || null
  }));
  const contentItems = (contentResult.data || []).map((item) => ({
    ...item,
    team: teamById.get(item.team_id) || null
  }));
  const draftContent = contentItems.filter(
    (item) => item.status === "draft"
  );
  const suspendedContent = contentItems.filter(
    (item) => item.suspended === true
  );
  const notificationEvents = notificationEventsResult.data || [];
  const failedEvents = notificationEvents.filter(
    (event) => event.status === "failed"
  );
  const pendingEvents = notificationEvents.filter(
    (event) => ["pending", "processing"].includes(event.status)
  );
  const failedDeliveries = notificationDeliveriesResult.data || [];

  const activeSponsors = (sponsorsResult.data || []).filter(
    (sponsor) => sponsor.status === "active"
  );
  const activePlacements = (placementsResult.data || []).filter(
    (placement) => placement.active === true
  );

  const aotw = summarizeAward({
    type: "athlete",
    week: chooseAwardWeek(aotwWeeks, now),
    nominations: aotwNominationsResult.data || [],
    finalists: aotwFinalistsResult.data || []
  });
  const totw = summarizeAward({
    type: "team",
    week: chooseAwardWeek(totwWeeks, now),
    nominations: totwNominationsResult.data || [],
    finalists: totwFinalistsResult.data || []
  });

  const tasks = [];

  if (
    ohioSchoolsResult.available &&
    Number(ohioSchoolsResult.count || 0) < 556
  ) {
    const missingSchoolCount = Math.max(
      0,
      556 - Number(ohioSchoolsResult.count || 0)
    );

    addTask(tasks, {
      priority: "important",
      title: "Import official statewide school data",
      detail: `${missingSchoolCount} official boys cross country school record${missingSchoolCount === 1 ? " is" : "s are"} not yet loaded into the statewide foundation.`,
      href: "/admin/statewide-data/",
      label: "Open Statewide Data",
      count: missingSchoolCount,
      category: "statewide_data"
    });
  }

  if (
    ohioConflictsResult.available &&
    Number(ohioConflictsResult.count || 0) > 0
  ) {
    const conflictCount = Number(ohioConflictsResult.count || 0);

    addTask(tasks, {
      priority: "important",
      title: "Review official division conflicts",
      detail: `${conflictCount} statewide data conflict${conflictCount === 1 ? " is" : "s are"} waiting for an admin decision.`,
      href: "/admin/statewide-data/",
      label: "Open Statewide Data",
      count: conflictCount,
      category: "statewide_data"
    });
  }

  if (reports.length) {
    addTask(tasks, {
      priority: "urgent",
      title: "Review team reports",
      detail: `${reports.length} team report${reports.length === 1 ? " needs" : "s need"} attention.`,
      href: "/admin/team-manager/",
      label: "Open Team Manager",
      count: reports.length,
      category: "teams"
    });
  }

  if (failedDeliveries.length || failedEvents.length) {
    const totalFailures = failedDeliveries.length + failedEvents.length;

    addTask(tasks, {
      priority: "urgent",
      title: "Resolve notification failures",
      detail: `${totalFailures} failed notification record${totalFailures === 1 ? " needs" : "s need"} review.`,
      href: "/admin/engagement/",
      label: "Open Engagement Center",
      count: totalFailures,
      category: "notifications"
    });
  }

  if (missingResults.length) {
    addTask(tasks, {
      priority: "important",
      title: "Add recent meet results",
      detail: `${missingResults.length} published meet${missingResults.length === 1 ? " is" : "s are"} missing a results link.`,
      href: "/admin/meets/",
      label: "Open Meet Manager",
      count: missingResults.length,
      category: "meets"
    });
  }

  if (claims.length) {
    addTask(tasks, {
      priority: "important",
      title: "Review team claim requests",
      detail: `${claims.length} coach or team representative request${claims.length === 1 ? " is" : "s are"} waiting.`,
      href: "/admin/team-manager/",
      label: "Open Team Manager",
      count: claims.length,
      category: "teams"
    });
  }

  if (meetRequests.length) {
    addTask(tasks, {
      priority: "important",
      title: "Review schedule requests",
      detail: `${meetRequests.length} team schedule request${meetRequests.length === 1 ? " is" : "s are"} waiting.`,
      href: "/admin/team-schedules/",
      label: "Open Team Schedules",
      count: meetRequests.length,
      category: "meets"
    });
  }

  if (incompleteUpcoming.length) {
    const soonCount = incompleteUpcoming.filter(
      (meet) => meet.meet_date <= addDays(today, 14)
    ).length;

    addTask(tasks, {
      priority: soonCount ? "important" : "routine",
      title: "Complete upcoming meet pages",
      detail: `${incompleteUpcoming.length} upcoming meet page${incompleteUpcoming.length === 1 ? " is" : "s are"} missing useful visitor information.`,
      href: "/admin/meets/",
      label: "Open Meet Manager",
      count: incompleteUpcoming.length,
      category: "meets"
    });
  }

  if (draftContent.length) {
    addTask(tasks, {
      priority: "routine",
      title: "Review team content drafts",
      detail: `${draftContent.length} team content draft${draftContent.length === 1 ? " is" : "s are"} waiting for review or publication.`,
      href: "/admin/team-content/",
      label: "Open Team Content",
      count: draftContent.length,
      category: "content"
    });
  }

  if (incompleteTeams.length) {
    addTask(tasks, {
      priority: "routine",
      title: "Improve incomplete team profiles",
      detail: `${incompleteTeams.length} active team profile${incompleteTeams.length === 1 ? " is" : "s are"} below 65 percent completion.`,
      href: "/admin/team-manager/",
      label: "Open Team Manager",
      count: incompleteTeams.length,
      category: "teams"
    });
  }

  if (aotw.phase === "not_scheduled") {
    addTask(tasks, {
      priority: "routine",
      title: "Schedule Athlete of the Week",
      detail: "No Athlete of the Week cycle was found in the current scheduling window.",
      // There is no dedicated admin award-management tool (found while
      // building the admin redesign, docs/DECISIONS.md 2026-08-16) --
      // Operations Center's own awards section is the closest real page
      // that shows AOTW/TOTW phase, so that's what this honestly points
      // to rather than a route that doesn't exist.
      href: "/admin/operations/",
      label: "Review award status",
      count: 0,
      category: "awards"
    });
  }

  if (totw.phase === "not_scheduled") {
    addTask(tasks, {
      priority: "routine",
      title: "Schedule Team of the Week",
      detail: "No Team of the Week cycle was found in the current scheduling window.",
      href: "/admin/operations/",
      label: "Review award status",
      count: 0,
      category: "awards"
    });
  }

  if (aotw.phase === "voting_closed" && aotw.winner_count === 0) {
    addTask(tasks, {
      priority: "important",
      title: "Announce the Athlete of the Week winner",
      detail: "Voting has closed and no winner is marked for the current Athlete of the Week cycle.",
      href: "/admin/operations/",
      label: "Review award status",
      count: 1,
      category: "awards"
    });
  }

  if (totw.phase === "voting_closed" && totw.winner_count === 0) {
    addTask(tasks, {
      priority: "important",
      title: "Announce Team of the Week winners",
      detail: "Voting has closed and no winners are marked for the current Team of the Week cycle.",
      href: "/admin/operations/",
      label: "Review award status",
      count: 1,
      category: "awards"
    });
  }

  if (!athleteProfilesResult.available) {
    addTask(tasks, {
      priority: "important",
      title: "Install the athlete profile foundation",
      detail: "The athlete database migration has not been installed or could not be read.",
      href: "/admin/athletes/",
      label: "Open Athlete Data",
      count: 1,
      category: "athletes"
    });
  } else if (Number(athleteProfilesResult.count || 0) < 200) {
    const missingAthletes = Math.max(
      0,
      200 - Number(athleteProfilesResult.count || 0)
    );

    addTask(tasks, {
      priority: "important",
      title: "Import the athlete ranking foundation",
      detail: `${missingAthletes} athlete profile${missingAthletes === 1 ? " is" : "s are"} still needed to complete the bundled 2026 ranking seed.`,
      href: "/admin/athletes/",
      label: "Open Athlete Data",
      count: missingAthletes,
      category: "athletes"
    });
  }

  if (
    athleteCorrectionsResult.available &&
    Number(athleteCorrectionsResult.count || 0) > 0
  ) {
    const correctionCount = Number(
      athleteCorrectionsResult.count || 0
    );

    addTask(tasks, {
      priority: "important",
      title: "Review athlete corrections",
      detail: `${correctionCount} athlete correction${correctionCount === 1 ? " is" : "s are"} waiting for review.`,
      href: "/admin/athletes/",
      label: "Open Athlete Data",
      count: correctionCount,
      category: "athletes"
    });
  }

  if (!recruitPerformancesResult.available) {
    addTask(tasks, {
      priority: "important",
      title: "Install Recruit Ratings and performance history",
      detail: "The recruiting performance migration has not been installed or could not be read.",
      href: "/admin/recruiting/",
      label: "Open Recruiting Center",
      count: 1,
      category: "athletes"
    });
  } else {
    const draftRatingCount = Number(draftRecruitRatingsResult.count || 0);
    const failedImportCount = Number(failedPerformanceImportsResult.count || 0);
    const sourcedPerformanceCount = Number(recruitPerformancesResult.count || 0);
    const publishedRatingCount = Number(publishedRecruitRatingsResult.count || 0);

    if (failedImportCount > 0) {
      addTask(tasks, {
        priority: "urgent",
        title: "Review failed performance imports",
        detail: `${failedImportCount} athlete performance import${failedImportCount === 1 ? " needs" : "s need"} review.`,
        href: "/admin/recruiting/",
        label: "Open Recruiting Center",
        count: failedImportCount,
        category: "athletes"
      });
    }

    if (draftRatingCount > 0) {
      addTask(tasks, {
        priority: "important",
        title: "Review draft recruit ratings",
        detail: `${draftRatingCount} recruit rating draft${draftRatingCount === 1 ? " is" : "s are"} waiting for review or publication.`,
        href: "/admin/recruiting/",
        label: "Open Recruiting Center",
        count: draftRatingCount,
        category: "athletes"
      });
    }

    if (sourcedPerformanceCount > 0 && publishedRatingCount === 0) {
      addTask(tasks, {
        priority: "routine",
        title: "Publish the first Recruit Rating",
        detail: "Sourced performances are available, but no Recruit Ratings are published yet.",
        href: "/admin/recruiting/",
        label: "Open Recruiting Center",
        count: 0,
        category: "athletes"
      });
    }
  }

  if (
    unlinkedRosterAthletesResult.available &&
    Number(unlinkedRosterAthletesResult.count || 0) > 0
  ) {
    const unlinkedCount = Number(
      unlinkedRosterAthletesResult.count || 0
    );

    addTask(tasks, {
      priority: "routine",
      title: "Connect roster athletes to statewide profiles",
      detail: `${unlinkedCount} team roster athlete${unlinkedCount === 1 ? " is" : "s are"} not connected to a permanent athlete profile.`,
      href: "/admin/athletes/",
      label: "Review athlete links",
      count: unlinkedCount,
      category: "athletes"
    });
  }

  tasks.sort(
    (first, second) =>
      priorityRank(first.priority) - priorityRank(second.priority) ||
      second.count - first.count ||
      first.title.localeCompare(second.title)
  );

  return {
    generated_at: now.toISOString(),
    ohio_date: today,
    days,
    summary: {
      task_count: tasks.length,
      urgent_tasks: tasks.filter((task) => task.priority === "urgent").length,
      upcoming_meets_7: upcomingSevenDays.length,
      upcoming_meets_30: upcomingThirtyDays.length,
      missing_results: missingResults.length,
      pending_claims: claims.length,
      active_reports: reports.length,
      schedule_requests: meetRequests.length,
      incomplete_teams: incompleteTeams.length,
      draft_content: draftContent.length,
      notification_failures: failedEvents.length + failedDeliveries.length,
      profile_views: analyticsViewsResult.count || 0,
      link_clicks: analyticsClicksResult.count || 0,
      sponsor_clicks: sponsorClicksResult.count || 0,
      statewide_schools: ohioSchoolsResult.count || 0,
      statewide_divisions: ohioDivisionsResult.count || 0,
      statewide_conflicts: ohioConflictsResult.count || 0,
      athlete_profiles: athleteProfilesResult.count || 0,
      public_athlete_profiles: publicAthleteProfilesResult.count || 0,
      athlete_corrections: athleteCorrectionsResult.count || 0,
      unlinked_roster_athletes: unlinkedRosterAthletesResult.count || 0,
      sourced_athlete_performances: recruitPerformancesResult.count || 0,
      published_recruit_ratings: publishedRecruitRatingsResult.count || 0,
      draft_recruit_ratings: draftRecruitRatingsResult.count || 0,
      failed_performance_imports: failedPerformanceImportsResult.count || 0
    },
    tasks: tasks.slice(0, 30),
    meets: {
      upcoming: upcomingMeets.slice(0, 30),
      upcoming_seven_days: upcomingSevenDays.slice(0, 20),
      missing_results: missingResults.slice(0, 30),
      incomplete_upcoming: incompleteUpcoming.slice(0, 30),
      drafts: draftMeets.slice(0, 30)
    },
    teams: {
      total: activeTeams.length,
      published: activeTeams.filter((team) => team.published).length,
      verified: activeTeams.filter((team) => team.verified).length,
      suspended: activeTeams.filter((team) => team.suspended).length,
      claimed: activeTeams.filter((team) => team.claimed_at).length,
      unclaimed: activeTeams.filter((team) => !team.claimed_at).length,
      incomplete: incompleteTeams.slice(0, 30),
      claims: claims.slice(0, 30),
      reports: reports.slice(0, 30),
      schedule_requests: meetRequests.slice(0, 30)
    },
    content: {
      drafts: draftContent.slice(0, 30),
      suspended: suspendedContent.slice(0, 30),
      published_count: contentItems.filter((item) => item.status === "published").length
    },
    athletes: {
      installed: athleteProfilesResult.available,
      profiles: athleteProfilesResult.count || 0,
      public_profiles: publicAthleteProfilesResult.count || 0,
      open_corrections: athleteCorrectionsResult.count || 0,
      unlinked_roster_athletes: unlinkedRosterAthletesResult.count || 0,
      recruiting_installed:
        recruitPerformancesResult.available &&
        publishedRecruitRatingsResult.available &&
        draftRecruitRatingsResult.available &&
        failedPerformanceImportsResult.available,
      sourced_performances: recruitPerformancesResult.count || 0,
      published_recruit_ratings: publishedRecruitRatingsResult.count || 0,
      draft_recruit_ratings: draftRecruitRatingsResult.count || 0,
      failed_performance_imports: failedPerformanceImportsResult.count || 0
    },
    awards: {
      athlete: aotw,
      team: totw
    },
    engagement: {
      settings: settingsResult.data || null,
      pending_events: pendingEvents.slice(0, 30),
      failed_events: failedEvents.slice(0, 30),
      failed_deliveries: failedDeliveries.slice(0, 30),
      profile_views: analyticsViewsResult.count || 0,
      link_clicks: analyticsClicksResult.count || 0,
      sponsor_clicks: sponsorClicksResult.count || 0
    },
    sponsors: {
      total: (sponsorsResult.data || []).length,
      active: activeSponsors.length,
      active_placements: activePlacements.length,
      records: (sponsorsResult.data || []).slice(0, 30)
    },
    configuration: {
      supabase_url: Boolean(process.env.SUPABASE_URL),
      supabase_secret_key: Boolean(process.env.SUPABASE_SECRET_KEY),
      admin_password: Boolean(process.env.PODIUM_ADMIN_PASSWORD),
      admin_session_secret: Boolean(process.env.PODIUM_ADMIN_SESSION_SECRET),
      vote_hash_secret: Boolean(process.env.VOTE_HASH_SECRET),
      resend_api_key: Boolean(process.env.RESEND_API_KEY),
      resend_from_email: Boolean(process.env.RESEND_FROM_EMAIL),
      cron_secret: Boolean(process.env.CRON_SECRET),
      site_url: Boolean(
        process.env.SITE_URL ||
        process.env.VERCEL_PROJECT_PRODUCTION_URL
      )
    },
    subsystems: {
      meets: meetsResult.available,
      teams: teamsResult.available,
      statewide_data:
        ohioSchoolsResult.available &&
        ohioDivisionsResult.available &&
        ohioConflictsResult.available,
      athlete_profiles:
        athleteProfilesResult.available &&
        publicAthleteProfilesResult.available,
      athlete_corrections:
        athleteCorrectionsResult.available,
      athlete_roster_links:
        unlinkedRosterAthletesResult.available,
      recruit_ratings:
        recruitPerformancesResult.available &&
        publishedRecruitRatingsResult.available &&
        draftRecruitRatingsResult.available &&
        failedPerformanceImportsResult.available,
      claims: claimsResult.available,
      reports: reportsResult.available,
      meet_requests: meetRequestsResult.available,
      team_content: contentResult.available,
      notifications:
        notificationEventsResult.available &&
        notificationDeliveriesResult.available,
      analytics:
        analyticsViewsResult.available &&
        analyticsClicksResult.available,
      sponsors:
        sponsorsResult.available &&
        placementsResult.available,
      athlete_of_the_week:
        aotwWeeksResult.available &&
        aotwNominationsResult.available &&
        aotwFinalistsResult.available,
      team_of_the_week:
        totwWeeksResult.available &&
        totwNominationsResult.available &&
        totwFinalistsResult.available
    },
    issues
  };
}

// The lightweight projection api/admin/dashboard-summary.js serves to
// the admin sidebar's badges and the dashboard's needs-attention panel
// -- {tasks, summary} only (~8KB), not the full response above (which
// carries meets/teams/content/athletes/awards/engagement/sponsors/
// config, hundreds of KB across 16 pages' worth of sidebars). Query
// cost is unchanged from getDashboard() itself in this pass -- this is
// a payload projection, not a cheaper query set. See docs/DECISIONS.md,
// 2026-08-16.
export function summarizeDashboard(dashboard) {
  return {
    generated_at: dashboard.generated_at,
    ohio_date: dashboard.ohio_date,
    days: dashboard.days,
    summary: dashboard.summary,
    tasks: dashboard.tasks
  };
}
