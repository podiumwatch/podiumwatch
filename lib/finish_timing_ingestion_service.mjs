// Orchestration for the automatic Finish Timing results pipeline. This is
// the one place that ties the pure lib/finish_timing_provider.mjs (fetch +
// parse) together with the existing, shared results-ingestion database
// tables (result_ingestion_jobs / result_source_documents /
// result_staging_rows / result_ingestion_audit) that every other provider
// (Baumspage, MileSplit) already uses -- nothing here is a competing
// performance system.

import crypto from "node:crypto";
import { supabaseAdmin } from "./supabase-admin.mjs";
import {
  FINISH_TIMING_PROVIDER_KEY,
  FINISH_TIMING_PARSER_VERSION,
  discoverMeets,
  fetchMeet,
  discoverEvents,
  fetchEventResults,
  parseAthleteRows,
  parseTeamScores,
  normalizeResult,
  parseMeetDateToIso,
  classifyMeetSport,
  looksLikeJuniorHighTeamName
} from "./finish_timing_provider.mjs";
import {
  storeSourceDocument,
  importFinishTimingApprovedRows,
  matchAthleteCandidate,
  matchSchoolCandidate
} from "./result_ingestion_engine.mjs";
import {
  cleanAthleteText,
  normalizeAthleteName,
  deriveSeasonYearFromMeetDate,
  deriveGraduationYearFromGrade,
  createOrLinkFinishTimingAthleteProfile
} from "./athlete_foundation_service.mjs";

// A stale lock from a crashed invocation is recovered after this long --
// generous relative to the 15-minute cron interval so a normally-slow
// scan is never mistaken for a crash, but short enough that a genuine
// crash does not block scanning for more than about two ticks.
const OVERLAP_TIMEOUT_MINUTES = 25;
// Capped so one scan can never fetch unbounded history the first time a
// large backlog of unseen meets exists -- a deliberate, small, per-scan
// budget; the rest are picked up on later scans.
const MAX_NEW_MEETS_PER_SCAN = 25;
// Respect reasonable request limits: never more than this many concurrent
// outbound requests to Finish Timing at once.
const FETCH_CONCURRENCY = 3;
// resolveAndApproveRows talks only to our own Supabase project, not a
// third-party site, so there's no politeness reason to keep this as low as
// FETCH_CONCURRENCY -- it's kept separate from that constant deliberately,
// since the two bound very different things. Real incident (2026-09-04):
// resolving 290 athlete rows fully serially (one row's several database
// round trips at a time) took 221 seconds for a single meet, dangerously
// close to this route's 300s function budget -- any scan batch touching
// more than one real meet would very plausibly time out mid-run. Running
// rows concurrently instead cuts wall-clock time roughly by this factor.
const ROW_RESOLUTION_CONCURRENCY = 8;

function hashBytes(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function runNext() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runNext));
  return results;
}

async function audit(jobId, action, details = {}) {
  await supabaseAdmin.from("result_ingestion_audit").insert({ job_id: jobId, action, details, actor: "Finish Timing automation" });
}

// Pure -- unit-testable with no Supabase connection. Checks the safety
// rules a Finish Timing row must pass before it can be auto-approved.
// Provider-level gates (is the provider active? is auto-publish turned
// on?) are checked once per scan/import, not per row, and are
// deliberately NOT part of this function.
export function evaluateFinishTimingEligibility(row) {
  const reasons = [];

  if (row.competition_level !== "high_school") {
    reasons.push("NOT_CONFIDENTLY_HIGH_SCHOOL");
  }

  if (!row.matched_athlete_id) {
    reasons.push("ATHLETE_NOT_CONFIDENTLY_MATCHED");
  }

  if (!row.matched_school_id) {
    reasons.push("SCHOOL_NOT_CONFIDENTLY_MATCHED");
  }

  if (row.gender !== "boys" && row.gender !== "girls") {
    reasons.push("GENDER_UNKNOWN");
  }

  if (!row.event_code) {
    reasons.push("EVENT_UNRESOLVED");
  }

  const hasValidMark = row.result_status === "OFFICIAL"
    ? Number.isFinite(Number(row.mark_value)) && Number(row.mark_value) > 0
    : ["DNF", "DNS"].includes(String(row.result_status || "").toUpperCase());

  if (!hasValidMark) {
    reasons.push("INVALID_MARK");
  }

  if (row.place !== null && row.place !== undefined && (!Number.isInteger(row.place) || row.place < 1)) {
    reasons.push("INVALID_PLACE");
  }

  if (!row.meet_date || Number.isNaN(new Date(row.meet_date).getTime())) {
    reasons.push("INVALID_MEET_DATE");
  }

  if (!row.season_year) {
    reasons.push("SEASON_YEAR_UNRESOLVED");
  }

  if (row.sport !== "cross_country") {
    reasons.push("SPORT_NOT_YET_SUPPORTED");
  }

  const warningCodes = new Set(row.warning_codes || []);
  const blockingWarnings = [
    "INCONSISTENT_LEVEL_SIGNAL",
    "TRACK_EVENT_NAME_UNVERIFIED",
    "NON_OHIO_ATHLETE",
    "STATE_UNCONFIRMED",
    "AMBIGUOUS_IDENTITY",
    "IDENTITY_UNMATCHED",
    "UNKNOWN_COMPETITION_LEVEL",
    "MISSING_GENDER"
  ];

  for (const code of blockingWarnings) {
    if (warningCodes.has(code)) {
      reasons.push(code);
    }
  }

  return { eligible: reasons.length === 0, reasons: [...new Set(reasons)] };
}

export async function getFinishTimingHealth() {
  const { data: provider, error: providerError } = await supabaseAdmin
    .from("results_source_providers")
    .select("*")
    .eq("provider_key", FINISH_TIMING_PROVIDER_KEY)
    .maybeSingle();
  if (providerError) throw providerError;

  const { data: recentRuns, error: runsError } = await supabaseAdmin
    .from("results_discovery_runs")
    .select("*")
    .eq("provider_key", FINISH_TIMING_PROVIDER_KEY)
    .order("started_at", { ascending: false })
    .limit(10);
  if (runsError) throw runsError;

  const [meetsResult, exceptionCountResult, exceptionSampleResult, teamScoreResult] = await Promise.all([
    supabaseAdmin.from("discovered_meets").select("id", { count: "exact", head: true }).like("meet_key", "finish_timing:%"),
    // Filtered server-side by provider (not just "pending" across every
    // provider) so both the count and the sample below are scoped
    // correctly -- an earlier draft filtered a small unscoped page in JS,
    // which would silently undercount whenever another provider also had
    // pending rows.
    supabaseAdmin.from("result_staging_rows").select("id", { count: "exact", head: true }).eq("review_status", "pending").eq("raw_row->>providerKey", FINISH_TIMING_PROVIDER_KEY),
    supabaseAdmin.from("result_staging_rows").select("id, raw_row, review_note, athlete_name, school_name, meet_name").eq("review_status", "pending").eq("raw_row->>providerKey", FINISH_TIMING_PROVIDER_KEY).order("created_at", { ascending: false }).limit(20),
    supabaseAdmin.from("result_team_scores").select("id", { count: "exact", head: true }).eq("provider_key", FINISH_TIMING_PROVIDER_KEY)
  ]);
  if (meetsResult.error) throw meetsResult.error;
  if (exceptionCountResult.error) throw exceptionCountResult.error;
  if (exceptionSampleResult.error) throw exceptionSampleResult.error;
  if (teamScoreResult.error) throw teamScoreResult.error;

  return {
    provider: provider || null,
    recent_runs: recentRuns || [],
    totals: {
      meets_discovered: meetsResult.count || 0,
      open_exceptions: exceptionCountResult.count || 0,
      team_score_rows: teamScoreResult.count || 0
    },
    open_exception_sample: exceptionSampleResult.data || [],
    parser_version: FINISH_TIMING_PARSER_VERSION
  };
}

export async function setFinishTimingSettings({ active, auto_publish_enabled, lookback_days, pause_reason, actor = "Podium Watch Admin" } = {}) {
  const update = { paused_by: actor };

  if (typeof active === "boolean") {
    update.active = active;
    update.pause_reason = active ? null : cleanAthleteText(pause_reason, 500) || "Paused by an admin.";
    update.paused_at = active ? null : new Date().toISOString();
  }

  if (typeof auto_publish_enabled === "boolean") {
    update.auto_publish_enabled = auto_publish_enabled;
  }

  if (Number.isInteger(lookback_days) && lookback_days >= 0 && lookback_days <= 365) {
    update.lookback_days = lookback_days;
  }

  const { data, error } = await supabaseAdmin
    .from("results_source_providers")
    .update(update)
    .eq("provider_key", FINISH_TIMING_PROVIDER_KEY)
    .select("*")
    .single();
  if (error) throw error;

  return { provider: data };
}

async function findOrCreateDailyJob() {
  const today = new Date().toISOString().slice(0, 10);

  const { data: existing, error: findError } = await supabaseAdmin
    .from("result_ingestion_jobs")
    .select("*")
    .eq("provider_key", FINISH_TIMING_PROVIDER_KEY)
    .eq("job_type", "provider")
    .eq("options->>automation_day", today)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return existing;

  const { data: created, error: createError } = await supabaseAdmin
    .from("result_ingestion_jobs")
    .insert({
      job_type: "provider",
      provider_key: FINISH_TIMING_PROVIDER_KEY,
      status: "running",
      parser_version: FINISH_TIMING_PARSER_VERSION,
      created_by: "Finish Timing automation",
      options: { automation_day: today },
      started_at: new Date().toISOString()
    })
    .select("*")
    .single();
  if (createError) throw createError;

  return created;
}

// Discovers new meets (diffed against the already-known catalog, so a
// scan only ever fetches metadata for genuinely new meet ids) and
// requeues already-discovered meets whose meet_date falls within the
// provider's lookback window -- the correction-recheck mechanism.
async function discoverAndSelectMeets(lookbackDays) {
  const allMeetIds = await discoverMeets();

  const { data: knownMeets, error: knownError } = await supabaseAdmin
    .from("discovered_meets")
    .select("id, meet_key, meet_date, discovery_status, sport, season_year")
    .like("meet_key", "finish_timing:%")
    .limit(5000);
  if (knownError) throw knownError;

  const knownByKey = new Map((knownMeets || []).map((meet) => [meet.meet_key, meet]));
  // Real incident (2026-08-31): discoverMeets()'s own ids are NOT
  // chronologically sortable in general (see that function's header
  // comment), but confirmed live that JS's own iteration order for
  // integer-like keys is ascending numeric, and Finish Timing's real
  // meet ids trend strongly upward over time (every real 2026 meet
  // found today has an 8-11 digit id; ancient meets have 1-4 digits).
  // Slicing MAX_NEW_MEETS_PER_SCAN off the front of an unsorted/
  // ascending list meant every scan spent its entire budget on
  // thousands of years-old meets nobody cares about anymore, in
  // ascending order, with no way to ever reach a real current meet in
  // any practical timeframe -- confirmed live: 3,505 unseen meets, the
  // largest of the first 25 (in the order the old code used) was a
  // 5-digit id from years ago. Sorting numeric-descending before
  // slicing means each scan's limited budget is spent on the newest
  // (most likely current-season) unseen meets first.
  const unseenMeetIds = allMeetIds
    .filter((id) => !knownByKey.has(`finish_timing:${id}`))
    .sort((a, b) => Number(b) - Number(a))
    .slice(0, MAX_NEW_MEETS_PER_SCAN);

  const newlyDiscovered = [];

  await mapWithConcurrency(unseenMeetIds, FETCH_CONCURRENCY, async (meetId) => {
    const meetDoc = await fetchMeet(meetId);
    if (!meetDoc) {
      return;
    }

    const sport = classifyMeetSport(meetDoc);
    const meetDateIso = parseMeetDateToIso(meetDoc.date);
    const seasonYear = sport ? deriveSeasonYearFromMeetDate(meetDateIso, sport) : null;
    const confidentlySupported = Boolean(sport && meetDateIso && seasonYear);

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("discovered_meets")
      .upsert(
        {
          meet_key: `finish_timing:${meetId}`,
          meet_name: cleanAthleteText(meetDoc.name, 300) || `Finish Timing meet ${meetId}`,
          normalized_name: normalizeAthleteName(meetDoc.name || ""),
          meet_date: meetDateIso,
          season_year: seasonYear || new Date().getUTCFullYear(),
          // Only cross country is confidently auto-processed today (see
          // the sport deferral in lib/finish_timing_provider.mjs). A meet
          // whose type could not be confidently classified as "xc" is
          // still recorded here (so it is never re-fetched every scan
          // forever) but always as "ignored" with an explicit note --
          // the sport column's own value is bookkeeping only for an
          // ignored row and is never trusted on its own without checking
          // discovery_status first.
          sport: sport || "outdoor_track",
          discovery_status: confidentlySupported ? "ready" : "ignored",
          confidence: confidentlySupported ? 70 : 20,
          review_note: confidentlySupported
            ? null
            : "Finish Timing meet type could not be confidently classified as cross country -- automatic processing of other sports is not supported yet.",
          last_discovered_at: new Date().toISOString()
        },
        { onConflict: "meet_key" }
      )
      .select("*")
      .single();

    if (insertError) {
      throw insertError;
    }

    await supabaseAdmin.from("discovered_meet_sources").upsert(
      {
        meet_id: inserted.id,
        source_url: `https://finishtiming.trackscoreboard.com/meets/${meetId}/events`,
        canonical_url: `https://finishtiming.trackscoreboard.com/meets/${meetId}/events`,
        source_role: "original",
        file_format: "live_results",
        permission_status: "review_required",
        is_preferred: true
      },
      { onConflict: "meet_id,canonical_url" }
    );

    if (confidentlySupported) {
      newlyDiscovered.push({ ...inserted, meetId });
    }
  });

  const lookbackCutoff = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: recheckMeets, error: recheckError } = await supabaseAdmin
    .from("discovered_meets")
    .select("*")
    .like("meet_key", "finish_timing:%")
    .eq("discovery_status", "ready")
    .gte("meet_date", lookbackCutoff)
    .limit(200);
  if (recheckError) throw recheckError;

  const alreadyQueued = new Set(newlyDiscovered.map((meet) => meet.meet_key));
  const requeued = (recheckMeets || [])
    .filter((meet) => !alreadyQueued.has(meet.meet_key))
    .map((meet) => ({ ...meet, meetId: meet.meet_key.replace("finish_timing:", "") }));

  return { newlyDiscovered, requeued };
}

// Resolves matched_school_id via the remembered finish_timing_team_links
// cache first (instant short-circuit, including a cached confident
// non-match for junior-high/club teams), falling back to the same
// exact-match ohio_schools/alias resolution the generic engine uses, and
// caching the outcome either way so future scans never re-run fuzzy
// matching for a team already seen.
async function resolveSchoolLink(providerTeamId, providerTeamName) {
  const { data: cached, error: cacheError } = await supabaseAdmin
    .from("finish_timing_team_links")
    .select("*")
    .eq("provider_team_id", providerTeamId)
    .maybeSingle();
  if (cacheError) throw cacheError;

  if (cached) {
    await supabaseAdmin.from("finish_timing_team_links").update({ last_seen_at: new Date().toISOString() }).eq("id", cached.id);
    return cached;
  }

  if (looksLikeJuniorHighTeamName(providerTeamName)) {
    // upsert, not insert: the same team can appear in more than one event
    // within a single scan (e.g. concurrent event fetches both resolving
    // "Russia MS" at once) -- a plain insert would throw a unique
    // violation on the second, concurrent, still-uncached call.
    const { data: created, error: createError } = await supabaseAdmin
      .from("finish_timing_team_links")
      .upsert(
        {
          provider_team_id: providerTeamId,
          provider_team_name: providerTeamName,
          normalized_team_name: normalizeAthleteName(providerTeamName),
          matched_school_id: null,
          competition_level_hint: "middle_school",
          confidence: 90,
          confirmed_by: "team_name_suffix_heuristic",
          last_seen_at: new Date().toISOString()
        },
        { onConflict: "provider_team_id" }
      )
      .select("*")
      .single();
    if (createError) throw createError;
    return created;
  }

  const normalizedName = normalizeAthleteName(providerTeamName);
  const [schoolsResult, aliasesResult] = await Promise.all([
    supabaseAdmin.from("ohio_schools").select("id, normalized_name").eq("normalized_name", normalizedName),
    supabaseAdmin.from("ohio_school_aliases").select("school_id").eq("normalized_alias", normalizedName)
  ]);
  if (schoolsResult.error) throw schoolsResult.error;
  if (aliasesResult.error) throw aliasesResult.error;

  const schoolMap = new Map();
  for (const school of schoolsResult.data || []) schoolMap.set(normalizedName, [school]);
  for (const alias of aliasesResult.data || []) schoolMap.set(normalizedName, [...(schoolMap.get(normalizedName) || []), { id: alias.school_id }]);

  const { school } = matchSchoolCandidate(normalizedName, schoolMap);

  const { data: created, error: createError } = await supabaseAdmin
    .from("finish_timing_team_links")
    .upsert(
      {
        provider_team_id: providerTeamId,
        provider_team_name: providerTeamName,
        normalized_team_name: normalizedName,
        matched_school_id: school?.id || null,
        confidence: school ? 100 : 0,
        confirmed_by: school ? "automatic_exact_match" : "no_confident_match",
        last_seen_at: new Date().toISOString()
      },
      { onConflict: "provider_team_id" }
    )
    .select("*")
    .single();
  if (createError) throw createError;

  return created;
}

// Resolves matched_athlete_id via the athlete_profile_aliases
// alias_type='external_id' cache first (the first real use of that
// previously-inert column pair, added in a prior session specifically
// for this purpose) -- a hit skips straight to that profile, no
// re-matching. A miss runs the same safe name+gender+grade+school
// matching the generic engine uses (never name alone); a confident match
// writes the alias row so future scans skip straight to it next time.
async function resolveAthleteLink({ row, schoolId, publish }) {
  const providerAthleteId = row.raw_row?.providerAthleteId;

  if (providerAthleteId) {
    const { data: cachedAlias, error: aliasLookupError } = await supabaseAdmin
      .from("athlete_profile_aliases")
      .select("profile_id")
      .eq("alias_type", "external_id")
      .eq("external_source", FINISH_TIMING_PROVIDER_KEY)
      .eq("normalized_alias", providerAthleteId)
      .maybeSingle();
    if (aliasLookupError && !isMissingColumnError(aliasLookupError)) throw aliasLookupError;

    if (cachedAlias) {
      return { profileId: cachedAlias.profile_id, ambiguous: false };
    }
  }

  const normalizedName = normalizeAthleteName(row.athlete_name);
  const expectedGraduation = deriveGraduationYearFromGrade(row.athlete_grade, row.season_year, row.sport);

  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from("athlete_profiles")
    .select("id,normalized_name,gender,graduation_year,current_school_id")
    .eq("normalized_name", normalizedName);
  if (profilesError) throw profilesError;

  const profileMap = new Map();
  for (const profile of profiles || []) {
    profileMap.set(profile.normalized_name, [...(profileMap.get(profile.normalized_name) || []), profile]);
  }

  const { candidates, matched } = matchAthleteCandidate({
    athleteName: row.athlete_name,
    gender: row.gender,
    grade: row.athlete_grade,
    seasonYear: row.season_year,
    sport: row.sport,
    school: schoolId ? { id: schoolId } : null,
    profileMap
  });

  if (candidates.length === 1 && matched) {
    if (providerAthleteId) {
      await supabaseAdmin.from("athlete_profile_aliases").upsert(
        {
          profile_id: matched.id,
          alias: row.athlete_name,
          normalized_alias: providerAthleteId,
          alias_type: "external_id",
          external_source: FINISH_TIMING_PROVIDER_KEY,
          notes: `Finish Timing athlete id ${providerAthleteId}, linked automatically.`
        },
        { onConflict: "profile_id,normalized_alias" }
      );
    }

    return { profileId: matched.id, ambiguous: false };
  }

  if (candidates.length > 1) {
    return { profileId: null, ambiguous: true };
  }

  // No existing profile at all -- create one only when every other safety
  // rule the row needs (school resolved, gender known, a real graduation
  // year) already holds; otherwise leave it unmatched for the exception
  // queue rather than creating a profile from incomplete information.
  if (schoolId && row.gender && expectedGraduation) {
    const created = await createOrLinkFinishTimingAthleteProfile({
      athleteName: row.athlete_name,
      gender: row.gender,
      graduationYear: expectedGraduation,
      resolvedSchoolId: schoolId,
      publish,
      actor: "Finish Timing automation"
    });

    if (providerAthleteId) {
      await supabaseAdmin.from("athlete_profile_aliases").upsert(
        {
          profile_id: created.id,
          alias: row.athlete_name,
          normalized_alias: providerAthleteId,
          alias_type: "external_id",
          external_source: FINISH_TIMING_PROVIDER_KEY,
          notes: `Finish Timing athlete id ${providerAthleteId}, linked automatically.`
        },
        { onConflict: "profile_id,normalized_alias" }
      );
    }

    return { profileId: created.id, ambiguous: false };
  }

  return { profileId: null, ambiguous: false };
}

function isMissingColumnError(error) {
  return ["42703", "42P01", "PGRST202", "PGRST205"].includes(String(error?.code || ""));
}

export async function runFinishTimingScan({ trigger = "cron", actor = "Podium Watch Admin" } = {}) {
  const { data: provider, error: providerError } = await supabaseAdmin
    .from("results_source_providers")
    .select("*")
    .eq("provider_key", FINISH_TIMING_PROVIDER_KEY)
    .single();
  if (providerError) throw providerError;

  if (!provider.active) {
    return { status: "paused" };
  }

  if (provider.currently_scanning_since) {
    const ageMinutes = (Date.now() - new Date(provider.currently_scanning_since).getTime()) / 60000;

    if (ageMinutes < OVERLAP_TIMEOUT_MINUTES) {
      return { status: "skipped_overlap" };
    }
    // Older than the timeout -- a prior invocation crashed without
    // clearing its own lock. Recovered below by simply overwriting it
    // with a fresh timestamp before proceeding.
  }

  await supabaseAdmin
    .from("results_source_providers")
    .update({ currently_scanning_since: new Date().toISOString(), last_scan_started_at: new Date().toISOString() })
    .eq("provider_key", FINISH_TIMING_PROVIDER_KEY);

  const summary = {
    trigger,
    meets_discovered: 0,
    meets_requeued: 0,
    events_processed: 0,
    athlete_rows_found: 0,
    team_rows_found: 0,
    published: 0,
    updated: 0,
    republished: 0,
    excluded_by_level: 0,
    exceptions: 0,
    errors: []
  };
  let status = "ok";
  let jobId = null;

  try {
    const job = await findOrCreateDailyJob();
    jobId = job.id;

    const { newlyDiscovered, requeued } = await discoverAndSelectMeets(provider.lookback_days);
    summary.meets_discovered = newlyDiscovered.length;
    summary.meets_requeued = requeued.length;

    const meetsToProcess = [...newlyDiscovered, ...requeued];

    for (const meet of meetsToProcess) {
      try {
        await processOneMeet({ job, meet, provider, summary });
      } catch (meetError) {
        summary.errors.push(`Meet ${meet.meetId}: ${cleanAthleteText(meetError.message, 300)}`);
        await audit(job.id, "finish_timing_meet_failed", { meet_id: meet.meetId, error: cleanAthleteText(meetError.message, 500) });
        // A failed meet never stops the rest of the scan.
      }
    }

    const importResult = await importFinishTimingApprovedRows(job.id, { publish: Boolean(provider.auto_publish_enabled) });
    summary.published += importResult.published;
    summary.updated += importResult.updated;
    summary.republished += importResult.republished;

    await supabaseAdmin
      .from("result_ingestion_jobs")
      .update({
        status: "running",
        progress: {
          queued: 0,
          visited: summary.events_processed,
          documents: summary.events_processed,
          rows: summary.athlete_rows_found,
          errors: summary.errors.length
        },
        updated_at: new Date().toISOString()
      })
      .eq("id", job.id);

    await audit(job.id, "finish_timing_scan_completed", summary);
  } catch (error) {
    status = "failed";
    summary.errors.push(cleanAthleteText(error.message, 500));
    if (jobId) {
      await audit(jobId, "finish_timing_scan_failed", { error: cleanAthleteText(error.message, 500) });
    }
  } finally {
    await supabaseAdmin
      .from("results_source_providers")
      .update({
        currently_scanning_since: null,
        last_scan_completed_at: new Date().toISOString(),
        last_scan_status: status,
        last_scan_summary: summary
      })
      .eq("provider_key", FINISH_TIMING_PROVIDER_KEY);
  }

  return { status, ...summary };
}

async function processOneMeet({ job, meet, provider, summary }) {
  const eventIds = await discoverEvents(meet.meetId);

  if (!eventIds || !eventIds.length) {
    return;
  }

  await mapWithConcurrency(eventIds, FETCH_CONCURRENCY, async (eventId) => {
    try {
      await processOneEvent({ job, meet, provider, summary, eventId });
    } catch (eventError) {
      // A hard failure in one event (a real thrown error, not the
      // ordinary "not found yet" null) must never take down its sibling
      // events -- mapWithConcurrency's Promise.all would otherwise
      // reject as soon as any one worker throws, abandoning whatever
      // the other concurrent events were mid-way through. Catching here
      // means every other event for this meet still gets fetched,
      // staged, and (once the whole loop below finishes) resolved and
      // approved normally.
      summary.errors.push(`Meet ${meet.meetId} event ${eventId}: ${cleanAthleteText(eventError.message, 300)}`);
      await audit(job.id, "finish_timing_event_failed", { meet_id: meet.meetId, event_id: eventId, error: cleanAthleteText(eventError.message, 500) });
    }
  });

  // Runs once, after every event for this meet has finished staging (see
  // the comment above) -- reliably sees every row this meet just staged,
  // no race against a still-in-flight sibling event's insert. Runs even
  // if one or more individual events failed above, so the events that
  // DID succeed are still resolved and approved in this same scan.
  await resolveAndApproveRows({ jobId: job.id, provider });
}

async function processOneEvent({ job, meet, provider, summary, eventId }) {
  const eventDoc = await fetchEventResults(meet.meetId, eventId);

  if (!eventDoc) {
    return;
  }

  const meetContext = {
    meetId: meet.meetId,
    meetName: meet.meet_name,
    meetLocation: meet.location_name || null,
    meetDateIso: meet.meet_date,
    sport: meet.sport === "cross_country" ? "cross_country" : null,
    seasonYear: meet.season_year
  };

  const bytes = Buffer.from(JSON.stringify(eventDoc), "utf8");
  const storageKey = await storeSourceDocument(job.id, bytes, "json", "application/json");
  const { data: document, error: documentError } = await supabaseAdmin
    .from("result_source_documents")
    .upsert(
      {
        job_id: job.id,
        provider_key: FINISH_TIMING_PROVIDER_KEY,
        source_url: `https://finishtiming.trackscoreboard.com/meets/${meet.meetId}/events/${eventId}`,
        document_type: "json",
        storage_key: storageKey,
        content_sha256: hashBytes(bytes),
        parser_version: FINISH_TIMING_PARSER_VERSION,
        verification_score: 100,
        verification_evidence: ["FINISH_TIMING_STRUCTURED_API"],
        raw_excerpt: cleanAthleteText(JSON.stringify(eventDoc), 12000),
        status: "verified"
      },
      { onConflict: "job_id,content_sha256" }
    )
    .select("*")
    .single();
  if (documentError) throw documentError;

  const athleteRows = parseAthleteRows(meetContext, eventId, eventDoc).map(normalizeResult);
  const teamRows = parseTeamScores(meetContext, eventId, eventDoc, athleteRows);

  summary.events_processed += 1;
  summary.athlete_rows_found += athleteRows.length;
  summary.team_rows_found += teamRows.length;

  if (athleteRows.length) {
    const stagingValues = athleteRows.map((row) => ({
      job_id: job.id,
      document_id: document.id,
      row_number: row.rowNumber,
      meet_name: row.meetName,
      meet_date: row.meetDate,
      meet_location: row.meetLocation,
      sport: row.sport,
      season_year: row.seasonYear,
      competition_level: row.competitionLevel,
      gender: row.gender,
      division: row.division,
      event_name: row.eventName,
      event_code: row.eventCode,
      athlete_name: row.athleteName,
      athlete_grade: row.athleteGrade,
      school_name: row.schoolName,
      place: row.place,
      mark_text: row.markText,
      mark_value: row.markValue,
      points: row.points,
      result_status: row.resultStatus,
      parser_confidence: row.parserConfidence,
      match_confidence: 0,
      warning_codes: row.warningCodes,
      raw_row: row.rawRow,
      source_fingerprint: row.sourceFingerprint,
      result_fingerprint: row.resultFingerprint
    }));

    const { error: rowsError } = await supabaseAdmin
      .from("result_staging_rows")
      .upsert(stagingValues, { onConflict: "job_id,result_fingerprint", ignoreDuplicates: true });
    if (rowsError) throw rowsError;
    // Identity resolution runs once per MEET, after every one of its
    // events has finished staging (see processOneMeet, after the
    // mapWithConcurrency call) -- not here, per event. Since up to
    // FETCH_CONCURRENCY events are staged concurrently, resolving here
    // could race a sibling event's still-in-flight insert and miss its
    // rows until the next scan; waiting for the whole meet to finish
    // avoids that entirely.
  }

  if (teamRows.length) {
    await Promise.all(
      teamRows.map(async (row) => {
        const link = row.providerTeamId ? await resolveSchoolLink(row.providerTeamId, row.teamName) : null;

        return supabaseAdmin.from("result_team_scores").upsert(
          {
            provider_key: FINISH_TIMING_PROVIDER_KEY,
            discovered_meet_id: meet.id,
            provider_meet_id: row.providerMeetId,
            provider_event_id: row.providerEventId,
            job_id: job.id,
            meet_name: row.meetName,
            meet_date: row.meetDate,
            sport: row.sport,
            season_year: row.seasonYear,
            competition_level: row.competitionLevel || "high_school",
            gender: row.gender || "boys",
            division: row.division,
            event_name: row.eventName,
            team_name: row.teamName,
            normalized_team_name: normalizeAthleteName(row.teamName),
            matched_school_id: link?.matched_school_id || null,
            matched_team_id: link?.matched_team_id || null,
            provider_team_id: row.providerTeamId,
            place_text: row.placeText,
            place_numeric: row.placeNumeric,
            did_not_place: row.didNotPlace,
            score: row.score,
            num_runners: row.numRunners,
            scoring_breakdown: row.scoringBreakdown,
            source_url: `https://finishtiming.trackscoreboard.com/meets/${meet.meetId}/events/${row.providerEventId}`,
            public_visible: Boolean(provider.auto_publish_enabled) && row.competitionLevel === "high_school",
            updated_at: new Date().toISOString()
          },
          { onConflict: "provider_key,provider_meet_id,provider_event_id,normalized_team_name" }
        );
      })
    );
  }
}

// Runs identity resolution + eligibility for every still-pending Finish
// Timing row in this job, approving the ones that pass every safety rule.
// Safe to call repeatedly (idempotent) -- re-running only ever recomputes
// the same fields from the same underlying data.
async function resolveAndApproveRows({ jobId, provider }) {
  const { data: rows, error: rowsError } = await supabaseAdmin
    .from("result_staging_rows")
    .select("*")
    .eq("job_id", jobId)
    .eq("review_status", "pending")
    .not("raw_row->>providerKey", "is", null)
    .limit(2000);
  if (rowsError) throw rowsError;

  const finishTimingRows = (rows || []).filter((row) => row.raw_row?.providerKey === FINISH_TIMING_PROVIDER_KEY);

  // Each row's own database round trips (team-link cache, athlete-alias
  // cache, sometimes a full profile search, then its own update) used to
  // run one row fully at a time -- see ROW_RESOLUTION_CONCURRENCY's own
  // comment for why that was a real problem. resolveSchoolLink and the
  // athlete-alias writes already use upsert (not insert) specifically
  // because the original author anticipated concurrent races from
  // parallel event-fetching, so running rows concurrently here introduces
  // no new write-race risk. Each row is wrapped in its own try/catch so
  // one bad row is recorded as an exception and skipped rather than
  // aborting every other row still in flight -- a plain for-loop would
  // previously have let one thrown row abort the whole meet outright.
  const outcomes = await mapWithConcurrency(finishTimingRows, ROW_RESOLUTION_CONCURRENCY, async (row) => {
    try {
      const providerTeamId = row.raw_row?.providerTeamId;
      const link = providerTeamId ? await resolveSchoolLink(providerTeamId, row.school_name) : null;
      const schoolId = link?.matched_school_id || null;

      const { profileId, ambiguous } = await resolveAthleteLink({
        row,
        schoolId,
        publish: Boolean(provider.auto_publish_enabled)
      });

      const warningCodes = new Set(row.warning_codes || []);
      warningCodes.delete("AMBIGUOUS_IDENTITY");
      warningCodes.delete("IDENTITY_UNMATCHED");

      if (ambiguous) {
        warningCodes.add("AMBIGUOUS_IDENTITY");
      } else if (!profileId) {
        warningCodes.add("IDENTITY_UNMATCHED");
      }

      if (!schoolId) {
        warningCodes.add("SCHOOL_UNMATCHED");
      } else {
        warningCodes.delete("SCHOOL_UNMATCHED");
      }

      const candidateRow = {
        ...row,
        matched_school_id: schoolId,
        matched_athlete_id: profileId,
        warning_codes: [...warningCodes]
      };

      const { eligible, reasons } = evaluateFinishTimingEligibility(candidateRow);
      const reviewStatus = eligible ? "approved" : "pending";

      await supabaseAdmin
        .from("result_staging_rows")
        .update({
          matched_school_id: schoolId,
          matched_athlete_id: profileId,
          match_confidence: profileId && schoolId ? 100 : 0,
          warning_codes: [...warningCodes, ...(eligible ? [] : reasons.filter((reason) => !warningCodes.has(reason)))],
          review_status: reviewStatus,
          review_note: eligible ? null : `Held automatically: ${reasons.join(", ")}`,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", row.id);

      return { eligible };
    } catch (rowError) {
      await audit(jobId, "finish_timing_row_resolution_failed", { staging_row_id: row.id, error: cleanAthleteText(rowError.message, 500) });
      return { eligible: false };
    }
  });

  const exceptions = outcomes.filter((outcome) => !outcome.eligible).length;

  return { exceptions };
}

export async function rescanFinishTimingMeet(meetId, { actor = "Podium Watch Admin" } = {}) {
  const { data: provider, error: providerError } = await supabaseAdmin
    .from("results_source_providers")
    .select("*")
    .eq("provider_key", FINISH_TIMING_PROVIDER_KEY)
    .single();
  if (providerError) throw providerError;

  const { data: meet, error: meetError } = await supabaseAdmin
    .from("discovered_meets")
    .select("*")
    .eq("meet_key", `finish_timing:${meetId}`)
    .maybeSingle();
  if (meetError) throw meetError;

  if (!meet) {
    const error = new Error("This meet has not been discovered yet.");
    error.status = 404;
    throw error;
  }

  const job = await findOrCreateDailyJob();
  const summary = { meets_discovered: 0, meets_requeued: 1, events_processed: 0, athlete_rows_found: 0, team_rows_found: 0, published: 0, updated: 0, republished: 0, errors: [] };

  await processOneMeet({ job, meet: { ...meet, meetId }, provider, summary });
  const importResult = await importFinishTimingApprovedRows(job.id, { publish: Boolean(provider.auto_publish_enabled) });
  summary.published += importResult.published;
  summary.updated += importResult.updated;
  summary.republished += importResult.republished;

  await audit(job.id, "finish_timing_meet_rescanned", { meet_id: meetId, actor, summary });

  return summary;
}

export async function requestFinishTimingBackfill({ fromDate, toDate, actor = "Podium Watch Admin" } = {}) {
  const from = cleanAthleteText(fromDate, 10);
  const to = cleanAthleteText(toDate, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    const error = new Error("Provide a valid from and to date (YYYY-MM-DD).");
    error.status = 400;
    throw error;
  }

  const { data: provider, error: providerError } = await supabaseAdmin
    .from("results_source_providers")
    .select("*")
    .eq("provider_key", FINISH_TIMING_PROVIDER_KEY)
    .single();
  if (providerError) throw providerError;

  const { data: meets, error: meetsError } = await supabaseAdmin
    .from("discovered_meets")
    .select("*")
    .like("meet_key", "finish_timing:%")
    .eq("discovery_status", "ready")
    .gte("meet_date", from)
    .lte("meet_date", to)
    .limit(200);
  if (meetsError) throw meetsError;

  const job = await findOrCreateDailyJob();
  const summary = { meets_discovered: 0, meets_requeued: (meets || []).length, events_processed: 0, athlete_rows_found: 0, team_rows_found: 0, published: 0, updated: 0, republished: 0, errors: [] };

  for (const meet of meets || []) {
    try {
      await processOneMeet({ job, meet: { ...meet, meetId: meet.meet_key.replace("finish_timing:", "") }, provider, summary });
    } catch (error) {
      summary.errors.push(`Meet ${meet.meet_key}: ${cleanAthleteText(error.message, 300)}`);
    }
  }

  const importResult = await importFinishTimingApprovedRows(job.id, { publish: Boolean(provider.auto_publish_enabled) });
  summary.published += importResult.published;
  summary.updated += importResult.updated;
  summary.republished += importResult.republished;

  await audit(job.id, "finish_timing_backfill_requested", { from, to, actor, summary });

  return summary;
}
