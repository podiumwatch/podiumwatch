// Admin management for Athlete of the Week (aotw_*) and Team of the Week
// (totw_*) -- both currently have a full public nominate/vote/archive
// flow (api/aotw/*.js, api/totw/*.js) but NO admin tool at all. Every
// week's status transition and every nomination-to-finalist promotion
// has been done by hand directly in the Supabase SQL editor (confirmed:
// no code anywhere writes aotw_weeks.status or totw_weeks.status, and
// aotw_nominations/totw_nominations already carry `reviewed`/`selected`
// boolean columns from that earlier hand-built design that nothing has
// ever read or written). This file is the first real admin surface for
// either award.
//
// These 6 tables (weeks/nominations/finalists x2) predate this
// project's migration system -- there is no CREATE TABLE for any of
// them anywhere in install/. install/35_WEEKLY_AWARDS_ADMIN.sql adds
// two purely additive link columns (promoted_finalist_id on
// nominations, source_nomination_id on finalists) on top of that
// existing, unmigrated schema; nothing else here assumes a column that
// wasn't directly confirmed live against production Supabase first.
//
// AOTW and TOTW are handled by one shared implementation parameterized
// by `type` ('aotw' | 'totw') rather than two near-duplicate files --
// their schemas differ only in a handful of fields (TOTW has
// boys/girls categories and two winners per week; AOTW has neither).

import { supabaseAdmin } from "./supabase-admin.mjs";
import { getAwardPhase } from "./operations_service.mjs";

function error(message, status = 400, code = "AWARDS_ERROR") {
  const value = new Error(message);
  value.status = status;
  value.code = code;
  return value;
}

function cleanText(value, maxLength = 500) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function cleanOptionalUrl(value, maxLength = 1000) {
  const cleaned = cleanText(value, maxLength);
  if (!cleaned) return null;
  try {
    const url = new URL(cleaned);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

const TYPES = {
  aotw: {
    label: "Athlete of the Week",
    weeksTable: "aotw_weeks",
    nominationsTable: "aotw_nominations",
    finalistsTable: "aotw_finalists",
    votesTable: "aotw_votes",
    hasCategory: false,
    nominationColumns: "id, week_id, athlete_name, school, grade, gender, event_name, performance, meet_name, performance_date, reason, result_url, photo_url, nominator_name, nominator_email, reviewed, selected, promoted_finalist_id, created_at",
    finalistColumns: "id, week_id, athlete_name, school, grade, image_url, achievement, description, sort_order, winner, source_nomination_id",
    // Sensible, editable DEFAULTS for the promote form -- never silently
    // final, the admin sees and can change every one of these before
    // the finalist row is actually created.
    defaultsFromNomination(nomination) {
      const performanceLine = [nomination.performance, nomination.event_name].filter(Boolean).join(" in the ");
      return {
        identity_fields: { athlete_name: nomination.athlete_name, school: nomination.school, grade: nomination.grade },
        image_url: nomination.photo_url || "",
        achievement: cleanText(`${performanceLine}${nomination.meet_name ? ` at ${nomination.meet_name}` : ""}`, 500),
        description: nomination.reason || ""
      };
    }
  },
  totw: {
    label: "Team of the Week",
    weeksTable: "totw_weeks",
    nominationsTable: "totw_nominations",
    finalistsTable: "totw_finalists",
    votesTable: "totw_votes",
    hasCategory: true,
    nominationColumns: "id, week_id, category, team_name, school, sport, division, achievement, meet_name, performance_date, reason, result_url, photo_url, nominator_name, nominator_email, reviewed, selected, promoted_finalist_id, created_at",
    finalistColumns: "id, week_id, category, team_name, school, sport, division, image_url, achievement, description, sort_order, winner, source_nomination_id",
    defaultsFromNomination(nomination) {
      return {
        identity_fields: { team_name: nomination.team_name, school: nomination.school, sport: nomination.sport, division: nomination.division, category: nomination.category },
        image_url: nomination.photo_url || "",
        achievement: nomination.achievement || "",
        description: nomination.reason || ""
      };
    }
  }
};

function config(type) {
  const found = TYPES[String(type || "").toLowerCase()];
  if (!found) throw error("Choose athlete or team of the week.", 400, "INVALID_AWARD_TYPE");
  return found;
}

const WEEK_COLUMNS = "id, week_slug, title, nomination_opens, nomination_closes, voting_opens, voting_closes, status, created_at";

export async function listWeeks({ type, limit = 30 } = {}) {
  const cfg = config(type);

  const { data: weeks, error: weeksError } = await supabaseAdmin
    .from(cfg.weeksTable)
    .select(WEEK_COLUMNS)
    .order("nomination_opens", { ascending: false })
    .limit(limit);
  if (weeksError) throw weeksError;

  const weekIds = (weeks || []).map((week) => week.id);
  if (!weekIds.length) return [];

  const [nominationsResult, finalistsResult] = await Promise.all([
    supabaseAdmin.from(cfg.nominationsTable).select("id, week_id, reviewed, selected").in("week_id", weekIds).limit(20000),
    supabaseAdmin.from(cfg.finalistsTable).select("id, week_id, winner").in("week_id", weekIds).limit(2000)
  ]);
  if (nominationsResult.error) throw nominationsResult.error;
  if (finalistsResult.error) throw finalistsResult.error;

  const nominations = nominationsResult.data || [];
  const finalists = finalistsResult.data || [];

  return weeks.map((week) => {
    const weekNominations = nominations.filter((row) => row.week_id === week.id);
    const weekFinalists = finalists.filter((row) => row.week_id === week.id);

    return {
      ...week,
      phase: getAwardPhase(week),
      nomination_count: weekNominations.length,
      unreviewed_count: weekNominations.filter((row) => !row.reviewed).length,
      selected_count: weekNominations.filter((row) => row.selected).length,
      finalist_count: weekFinalists.length,
      winner_count: weekFinalists.filter((row) => row.winner === true).length
    };
  });
}

export async function getWeekDetail({ type, weekId }) {
  const cfg = config(type);
  const cleanWeekId = cleanText(weekId, 100);
  if (!cleanWeekId) throw error("Choose a week.", 400, "MISSING_WEEK");

  const { data: week, error: weekError } = await supabaseAdmin
    .from(cfg.weeksTable)
    .select(WEEK_COLUMNS)
    .eq("id", cleanWeekId)
    .maybeSingle();
  if (weekError) throw weekError;
  if (!week) throw error("That week could not be found.", 404, "WEEK_NOT_FOUND");

  const [nominationsResult, finalistsResult, votesResult] = await Promise.all([
    supabaseAdmin.from(cfg.nominationsTable).select(cfg.nominationColumns).eq("week_id", cleanWeekId).order("created_at", { ascending: false }).limit(2000),
    supabaseAdmin.from(cfg.finalistsTable).select(cfg.finalistColumns).eq("week_id", cleanWeekId).order("sort_order", { ascending: true }).limit(500),
    supabaseAdmin.from(cfg.votesTable).select("finalist_id").limit(50000)
  ]);
  if (nominationsResult.error) throw nominationsResult.error;
  if (finalistsResult.error) throw finalistsResult.error;
  if (votesResult.error) throw votesResult.error;

  const finalistIds = new Set((finalistsResult.data || []).map((finalist) => finalist.id));
  const voteCounts = new Map();
  for (const row of votesResult.data || []) {
    if (!finalistIds.has(row.finalist_id)) continue; // votes table has no week_id -- scope to this week's own finalists
    voteCounts.set(row.finalist_id, (voteCounts.get(row.finalist_id) || 0) + 1);
  }

  const finalists = (finalistsResult.data || []).map((finalist) => ({ ...finalist, vote_count: voteCounts.get(finalist.id) || 0 }));

  return {
    week: { ...week, phase: getAwardPhase(week) },
    nominations: nominationsResult.data || [],
    finalists,
    label: cfg.label,
    has_category: cfg.hasCategory
  };
}

function parseIsoOrThrow(value, label) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw error(`Enter a valid ${label}.`, 400, "INVALID_DATE");
  return date;
}

export async function createWeek({ type, nominationOpens, nominationCloses, votingOpens, votingCloses, actor = "Podium Watch Admin" } = {}) {
  const cfg = config(type);

  const opens = parseIsoOrThrow(nominationOpens, "nomination open time");
  const nomCloses = parseIsoOrThrow(nominationCloses, "nomination close time");
  const voteOpens = parseIsoOrThrow(votingOpens, "voting open time");
  const voteCloses = parseIsoOrThrow(votingCloses, "voting close time");

  if (nomCloses <= opens) throw error("Nominations must open before they close.", 400, "INVALID_WINDOW");
  if (voteOpens < nomCloses) throw error("Voting should open on or after nominations close.", 400, "INVALID_WINDOW");
  if (voteCloses <= voteOpens) throw error("Voting must open before it closes.", 400, "INVALID_WINDOW");

  const weekSlug = opens.toISOString().slice(0, 10);
  const title = `Podium Watch ${cfg.label}`;

  const { data, error: insertError } = await supabaseAdmin
    .from(cfg.weeksTable)
    .insert({
      week_slug: weekSlug,
      title,
      nomination_opens: opens.toISOString(),
      nomination_closes: nomCloses.toISOString(),
      voting_opens: voteOpens.toISOString(),
      voting_closes: voteCloses.toISOString(),
      // Not "scheduled" -- confirmed live against production that the
      // real check constraint on this column only allows
      // nominations_closed/nominations_open/voting_open/voting_closed/
      // winner_announced. Every one of the ~20 real weeks already in
      // this table (bulk-created 2026-07-31) sits at
      // "nominations_closed" from the moment it's created, which is
      // also why every one of them has been silently rejecting public
      // nominations this whole time -- see openNominations() below.
      status: "nominations_closed"
    })
    .select(WEEK_COLUMNS)
    .single();

  if (insertError) {
    if (insertError.code === "23505") throw error("A week with that slug already exists.", 409, "WEEK_SLUG_TAKEN");
    throw insertError;
  }

  return data;
}

async function setWeekStatus({ type, weekId, fromStatuses, toStatus }) {
  const cfg = config(type);
  const cleanWeekId = cleanText(weekId, 100);
  if (!cleanWeekId) throw error("Choose a week.", 400, "MISSING_WEEK");

  const { data: week, error: fetchError } = await supabaseAdmin.from(cfg.weeksTable).select(WEEK_COLUMNS).eq("id", cleanWeekId).maybeSingle();
  if (fetchError) throw fetchError;
  if (!week) throw error("That week could not be found.", 404, "WEEK_NOT_FOUND");

  if (!fromStatuses.includes(week.status)) {
    throw error(`This week is currently "${week.status}" and can't move to "${toStatus}" from there.`, 409, "INVALID_STATUS_TRANSITION");
  }

  const { data, error: updateError } = await supabaseAdmin.from(cfg.weeksTable).update({ status: toStatus }).eq("id", cleanWeekId).select(WEEK_COLUMNS).single();
  if (updateError) throw updateError;

  return data;
}

export async function openNominations({ type, weekId }) {
  // "nominations_closed" is the one raw status a brand new week starts
  // at AND the one it returns to after a nomination window closes --
  // there is no separate "not opened yet" value in the real schema.
  // Opening nominations a second time (re-extending them) is allowed
  // from here too, which is a reasonable admin want, not a bug.
  return setWeekStatus({ type, weekId, fromStatuses: ["nominations_closed"], toStatus: "nominations_open" });
}

export async function closeNominations({ type, weekId }) {
  return setWeekStatus({ type, weekId, fromStatuses: ["nominations_open"], toStatus: "nominations_closed" });
}

export async function openVoting({ type, weekId }) {
  const cfg = config(type);
  const cleanWeekId = cleanText(weekId, 100);
  if (!cleanWeekId) throw error("Choose a week.", 400, "MISSING_WEEK");

  // "nominations_closed" also covers "never opened yet" (see above), so
  // that alone can't tell a week that's genuinely ready for voting
  // apart from one nobody has touched. Requiring at least one real
  // finalist is what actually distinguishes them -- and is a sensible
  // rule on its own merits regardless: voting with nothing to vote on
  // doesn't make sense.
  const { count, error: countError } = await supabaseAdmin.from(cfg.finalistsTable).select("id", { count: "exact", head: true }).eq("week_id", cleanWeekId);
  if (countError) throw countError;
  if (!count) throw error("Promote at least one nomination to a finalist before opening voting.", 409, "NO_FINALISTS");

  return setWeekStatus({ type, weekId, fromStatuses: ["nominations_closed"], toStatus: "voting_open" });
}

export async function closeVoting({ type, weekId }) {
  return setWeekStatus({ type, weekId, fromStatuses: ["voting_open"], toStatus: "voting_closed" });
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPerformanceDate(value) {
  if (!value) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime());
}

// Pure -- unit-testable with no Supabase connection. Same required
// fields the PUBLIC nominate endpoints enforce (api/aotw/nominate.js,
// api/totw/nominate.js), reused here rather than re-invented, since an
// admin-added nomination lands in the exact same table and needs the
// exact same non-null columns filled in. Deliberately does NOT check
// the week's nomination window or status -- unlike the public form,
// an admin adding one directly is the whole point of bypassing that
// gate (e.g. nominations already closed, or a great performance an
// admin wants featured even though nobody happened to submit it).
export function buildNominationInsert({ type, weekId, fields = {} }) {
  const cfg = config(type);
  const cleanWeekId = cleanText(weekId, 100);
  if (!cleanWeekId) throw error("Choose a week.", 400, "MISSING_WEEK");

  const nominatorName = cleanText(fields.nominator_name, 150) || "Podium Watch Admin";
  const nominatorEmail = cleanText(fields.nominator_email, 254).toLowerCase();
  if (!isValidEmail(nominatorEmail)) throw error("Enter a valid nominator email address.", 400, "INVALID_EMAIL");

  const school = cleanText(fields.school, 150);
  if (!school) throw error("Enter the school.", 400, "MISSING_SCHOOL");

  const reason = cleanText(fields.reason, 2500);
  if (!reason) throw error("Explain why this nomination should be recognized.", 400, "MISSING_REASON");

  const resultUrl = cleanOptionalUrl(fields.result_url);
  const photoUrl = cleanOptionalUrl(fields.photo_url);
  const meetName = cleanText(fields.meet_name, 200) || null;
  const performanceDate = fields.performance_date && isValidPerformanceDate(fields.performance_date) ? cleanText(fields.performance_date, 20) : null;

  if (fields.performance_date && !performanceDate) throw error("Enter a valid performance date.", 400, "INVALID_DATE");

  const base = {
    week_id: cleanWeekId,
    meet_name: meetName,
    performance_date: performanceDate,
    reason,
    result_url: resultUrl,
    photo_url: photoUrl,
    nominator_name: nominatorName,
    nominator_email: nominatorEmail,
    reviewed: true,
    selected: false
  };

  if (type === "totw") {
    const category = cleanText(fields.category, 20).toLowerCase();
    if (category !== "boys" && category !== "girls") throw error("Choose either the boys or girls category.", 400, "INVALID_CATEGORY");

    const teamName = cleanText(fields.team_name, 150);
    if (!teamName) throw error("Enter the team name.", 400, "MISSING_TEAM_NAME");

    const sport = cleanText(fields.sport, 100);
    if (!sport) throw error("Enter the sport.", 400, "MISSING_SPORT");

    const achievement = cleanText(fields.achievement, 500);
    if (!achievement) throw error("Describe the team performance or achievement.", 400, "MISSING_ACHIEVEMENT");

    return { ...base, category, team_name: teamName, school, sport, division: cleanText(fields.division, 50) || null, achievement };
  }

  const athleteName = cleanText(fields.athlete_name, 120);
  if (!athleteName) throw error("Enter the athlete's name.", 400, "MISSING_ATHLETE_NAME");

  const grade = cleanText(fields.grade, 30);
  if (!grade) throw error("Enter the athlete's grade.", 400, "MISSING_GRADE");

  const gender = cleanText(fields.gender, 30);
  if (!gender) throw error("Choose the athlete's gender.", 400, "MISSING_GENDER");

  const eventName = cleanText(fields.event_name, 120);
  if (!eventName) throw error("Enter the event.", 400, "MISSING_EVENT");

  const performance = cleanText(fields.performance, 120);
  if (!performance) throw error("Enter the performance.", 400, "MISSING_PERFORMANCE");

  return { ...base, athlete_name: athleteName, school, grade, gender, event_name: eventName, performance };
}

export async function createNomination({ type, weekId, fields = {} }) {
  const cfg = config(type);
  const row = buildNominationInsert({ type, weekId, fields });

  const { data, error: insertError } = await supabaseAdmin.from(cfg.nominationsTable).insert(row).select(cfg.nominationColumns).single();
  if (insertError) throw insertError;

  return data;
}

export async function reviewNomination({ type, nominationId, reviewed }) {
  const cfg = config(type);
  const cleanId = cleanText(nominationId, 100);
  if (!cleanId) throw error("Choose a nomination.", 400, "MISSING_NOMINATION");

  const { data, error: updateError } = await supabaseAdmin
    .from(cfg.nominationsTable)
    .update({ reviewed: Boolean(reviewed) })
    .eq("id", cleanId)
    .select(cfg.nominationColumns)
    .single();
  if (updateError) throw updateError;

  return data;
}

export async function setNominationSelected({ type, nominationId, selected }) {
  const cfg = config(type);
  const cleanId = cleanText(nominationId, 100);
  if (!cleanId) throw error("Choose a nomination.", 400, "MISSING_NOMINATION");

  const { data, error: updateError } = await supabaseAdmin
    .from(cfg.nominationsTable)
    .update({ selected: Boolean(selected) })
    .eq("id", cleanId)
    .select(cfg.nominationColumns)
    .single();
  if (updateError) throw updateError;

  return data;
}

// Pure -- unit-testable with no Supabase connection. Builds the exact
// finalist row promoteNomination() will insert, so the admin form's
// preview and the real write can never silently drift apart.
export function buildFinalistFromNomination({ type, nomination, overrides = {} }) {
  const cfg = config(type);
  const defaults = cfg.defaultsFromNomination(nomination);

  return {
    week_id: nomination.week_id,
    ...defaults.identity_fields,
    image_url: cleanOptionalUrl(overrides.image_url ?? defaults.image_url) || null,
    achievement: cleanText(overrides.achievement ?? defaults.achievement, 500),
    description: cleanText(overrides.description ?? defaults.description, 3000),
    sort_order: Number.isInteger(Number(overrides.sort_order)) ? Number(overrides.sort_order) : 0,
    winner: false,
    source_nomination_id: nomination.id
  };
}

export async function promoteNomination({ type, nominationId, overrides = {} }) {
  const cfg = config(type);
  const cleanId = cleanText(nominationId, 100);
  if (!cleanId) throw error("Choose a nomination.", 400, "MISSING_NOMINATION");

  const { data: nomination, error: nominationError } = await supabaseAdmin
    .from(cfg.nominationsTable)
    .select(cfg.nominationColumns)
    .eq("id", cleanId)
    .maybeSingle();
  if (nominationError) throw nominationError;
  if (!nomination) throw error("That nomination could not be found.", 404, "NOMINATION_NOT_FOUND");

  if (nomination.promoted_finalist_id) {
    throw error("This nomination has already been promoted to a finalist.", 409, "ALREADY_PROMOTED");
  }

  const finalistRow = buildFinalistFromNomination({ type, nomination, overrides });

  if (!finalistRow.achievement) {
    throw error("Enter what this nomination is being recognized for.", 400, "MISSING_ACHIEVEMENT");
  }

  const { data: finalist, error: insertError } = await supabaseAdmin
    .from(cfg.finalistsTable)
    .insert(finalistRow)
    .select(cfg.finalistColumns)
    .single();
  if (insertError) throw insertError;

  const { error: linkError } = await supabaseAdmin
    .from(cfg.nominationsTable)
    .update({ promoted_finalist_id: finalist.id, selected: true })
    .eq("id", cleanId);
  if (linkError) throw linkError;

  return finalist;
}

export async function updateFinalist({ type, finalistId, fields = {} }) {
  const cfg = config(type);
  const cleanId = cleanText(finalistId, 100);
  if (!cleanId) throw error("Choose a finalist.", 400, "MISSING_FINALIST");

  const update = {};
  if (fields.image_url !== undefined) update.image_url = cleanOptionalUrl(fields.image_url);
  if (fields.achievement !== undefined) update.achievement = cleanText(fields.achievement, 500);
  if (fields.description !== undefined) update.description = cleanText(fields.description, 3000);
  if (fields.sort_order !== undefined && Number.isInteger(Number(fields.sort_order))) update.sort_order = Number(fields.sort_order);

  const { data, error: updateError } = await supabaseAdmin
    .from(cfg.finalistsTable)
    .update(update)
    .eq("id", cleanId)
    .select(cfg.finalistColumns)
    .single();
  if (updateError) throw updateError;

  return data;
}

export async function removeFinalist({ type, finalistId }) {
  const cfg = config(type);
  const cleanId = cleanText(finalistId, 100);
  if (!cleanId) throw error("Choose a finalist.", 400, "MISSING_FINALIST");

  const { data: finalist, error: fetchError } = await supabaseAdmin.from(cfg.finalistsTable).select("id, source_nomination_id").eq("id", cleanId).maybeSingle();
  if (fetchError) throw fetchError;
  if (!finalist) throw error("That finalist could not be found.", 404, "FINALIST_NOT_FOUND");

  const { error: deleteError } = await supabaseAdmin.from(cfg.finalistsTable).delete().eq("id", cleanId);
  if (deleteError) throw deleteError;

  if (finalist.source_nomination_id) {
    await supabaseAdmin.from(cfg.nominationsTable).update({ promoted_finalist_id: null }).eq("id", finalist.source_nomination_id);
  }

  return { removed: true };
}

// Sets winner=true on exactly the given finalist(s) and false on every
// other finalist in the week, then announces the week. AOTW takes
// exactly one finalist id; TOTW takes up to two (one per category) --
// validated against each finalist's own category so a boys id can never
// be recorded as the girls winner or vice versa.
export async function announceWinner({ type, weekId, finalistIds }) {
  const cfg = config(type);
  const cleanWeekId = cleanText(weekId, 100);
  if (!cleanWeekId) throw error("Choose a week.", 400, "MISSING_WEEK");

  const ids = (Array.isArray(finalistIds) ? finalistIds : [finalistIds]).map((id) => cleanText(id, 100)).filter(Boolean);
  if (!ids.length) throw error("Choose at least one winner.", 400, "MISSING_WINNER");

  const { data: week, error: weekError } = await supabaseAdmin.from(cfg.weeksTable).select(WEEK_COLUMNS).eq("id", cleanWeekId).maybeSingle();
  if (weekError) throw weekError;
  if (!week) throw error("That week could not be found.", 404, "WEEK_NOT_FOUND");
  if (week.status !== "voting_closed") {
    throw error(`This week is currently "${week.status}" -- close voting before announcing a winner.`, 409, "INVALID_STATUS_TRANSITION");
  }

  const { data: finalists, error: finalistsError } = await supabaseAdmin.from(cfg.finalistsTable).select(cfg.finalistColumns).eq("week_id", cleanWeekId);
  if (finalistsError) throw finalistsError;

  const chosen = (finalists || []).filter((finalist) => ids.includes(finalist.id));
  if (chosen.length !== ids.length) throw error("One or more chosen finalists could not be found in this week.", 404, "FINALIST_NOT_FOUND");

  if (cfg.hasCategory) {
    const categories = new Set(chosen.map((finalist) => finalist.category));
    if (categories.size !== chosen.length) throw error("Choose at most one winner per category.", 400, "DUPLICATE_CATEGORY_WINNER");
  } else if (chosen.length > 1) {
    throw error("Choose exactly one winner.", 400, "TOO_MANY_WINNERS");
  }

  const { error: clearError } = await supabaseAdmin.from(cfg.finalistsTable).update({ winner: false }).eq("week_id", cleanWeekId);
  if (clearError) throw clearError;

  const { error: setError } = await supabaseAdmin.from(cfg.finalistsTable).update({ winner: true }).in("id", ids);
  if (setError) throw setError;

  const { data: updatedWeek, error: announceError } = await supabaseAdmin.from(cfg.weeksTable).update({ status: "winner_announced" }).eq("id", cleanWeekId).select(WEEK_COLUMNS).single();
  if (announceError) throw announceError;

  return { week: updatedWeek };
}
