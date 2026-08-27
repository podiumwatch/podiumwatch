// Reusable "what race matters right now" logic (race day spec, Section
// 9 -- "Current Race Awareness"). A team's race_sessions on any given
// day can be: currently live, the next one prepared for later today,
// already finished today, or something else entirely (a different day,
// or a draft nobody has planned yet). Coach Home, the helper-code
// landing flow, and Team Meet Center all need the SAME answer to "what
// should this screen show right now" -- computed once here, rather than
// each caller inventing its own status/date filtering that quietly
// drifts from the others (this is exactly how helpers ended up looking
// at historical meets instead of today's race -- there was no shared
// concept of "today" to route by at all).
import { supabaseAdmin } from "./supabase-admin.mjs";

// Podium Watch is Ohio-only, so "today" means the coach's own Eastern
// calendar date, not whatever timezone the server process happens to be
// running in (Vercel functions run in UTC) -- a race_date is always a
// plain YYYY-MM-DD string a coach picked for a meet (see
// lib/split_watch_service.mjs's cleanDate()), and comparing it against
// a UTC "today" would silently roll over to the wrong day for several
// hours every evening.
const PODIUM_TIMEZONE = "America/New_York";

// Race Day Command Center (Project 2): "If no race remains today, select
// the nearest upcoming incomplete race within the approved upcoming
// window." No exact window is specified anywhere in the build plan --
// 14 days is the safest reasonable choice for a sport that runs weekly
// or twice-weekly meets: long enough to actually find "next Saturday's
// meet" from a quiet Monday, short enough that a coach is never handed
// a race a month away and told it's what needs attention right now.
export const UPCOMING_WINDOW_DAYS = 14;

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function todayDateString(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PODIUM_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

// Sorts "what's next" races: a prepared (scheduled) race before a
// still-being-built (draft) one, then by scheduled start time if set,
// then by creation order -- matches how a coach would actually expect
// today's races to queue up.
function compareUpcoming(a, b) {
  if (a.status !== b.status) return a.status === "scheduled" ? -1 : 1;
  const at = a.scheduled_start_time ? Date.parse(a.scheduled_start_time) : Infinity;
  const bt = b.scheduled_start_time ? Date.parse(b.scheduled_start_time) : Infinity;
  if (at !== bt) return at - bt;
  return Date.parse(a.created_at) - Date.parse(b.created_at);
}

function compareFinished(a, b) {
  return Date.parse(b.race_ended_at || b.updated_at) - Date.parse(a.race_ended_at || a.updated_at);
}

// Pure classification -- given a flat list of race_sessions rows and
// today's date string, decide what's live, what's next today, what's
// finished today, and (critically) whether there is a single obviously
// relevant race to go straight to or a genuine choice to show. Kept
// separate from the database read below so it's directly unit-testable
// (see scripts/test-split-watch.mjs) without a live Supabase connection.
export function classifyRaceDay(sessions, today) {
  // Rehearsal Mode (install/25): a rehearsal is a genuinely separate
  // race_sessions row and must never become "the" selected race for a
  // coach's Today's Split Watch card or a helper's smart auto-route --
  // filtered here too, in addition to the query that feeds this
  // function, so a caller that forgets its own filter still can't
  // surface practice data as if it were today's real race.
  const relevant = (sessions || []).filter((s) => s.status !== "cancelled" && !s.is_rehearsal);

  // A live race is "the current live race" regardless of its own
  // race_date -- confirmed necessary directly against production: a
  // real race from 2026-08-25 was still sitting in status "live" the
  // next calendar day. There can legitimately be more than one at once
  // (an HS and a JH race running in the same window).
  const liveRaces = relevant.filter((s) => s.status === "live");

  // Everything else is scoped to today specifically -- a draft or
  // finished race from a different day is never "next" or "recent" for
  // right now.
  const todaySessions = relevant.filter((s) => s.race_date === today);
  const upcomingToday = todaySessions
    .filter((s) => s.status === "draft" || s.status === "scheduled")
    .sort(compareUpcoming);
  const finishedToday = todaySessions
    .filter((s) => s.status === "finished" || s.status === "reviewed")
    .sort(compareFinished);

  // Race Day Command Center (Project 2): when nothing is live or
  // scheduled today, look a bit further ahead before ever falling back
  // to "the most recently finished race today" -- an upcoming race,
  // even a few days out, is always more useful to a coach signing in
  // than a race that's already over. Scoped to the same window used by
  // singleRelevantRace below (see UPCOMING_WINDOW_DAYS's own comment for
  // why 14 days).
  const windowEnd = addDays(today, UPCOMING_WINDOW_DAYS);
  const nearestUpcoming = relevant
    .filter((s) => (s.status === "draft" || s.status === "scheduled") && s.race_date > today && s.race_date <= windowEnd)
    .sort(compareUpcoming);

  // The one race a helper (or a coach's "today" card) should be taken
  // straight to with zero picking required. Priority: the one live race
  // > the next race today > the nearest upcoming race within the window
  // > the most recently finished race today. Multiple simultaneously-live
  // races is the one case that's a genuine choice, never auto-resolved --
  // singleRelevantRace stays null and the caller shows just those live
  // races, nothing historical alongside them.
  let singleRelevantRace = null;
  if (liveRaces.length === 1) {
    singleRelevantRace = liveRaces[0];
  } else if (liveRaces.length === 0 && upcomingToday.length > 0) {
    singleRelevantRace = upcomingToday[0];
  } else if (liveRaces.length === 0 && upcomingToday.length === 0 && nearestUpcoming.length > 0) {
    singleRelevantRace = nearestUpcoming[0];
  } else if (liveRaces.length === 0 && upcomingToday.length === 0 && nearestUpcoming.length === 0 && finishedToday.length > 0) {
    singleRelevantRace = finishedToday[0];
  }

  return {
    today,
    liveRaces,
    upcomingToday,
    finishedToday,
    nearestUpcoming,
    singleRelevantRace,
    // True only in the one case that needs an actual choice shown --
    // more than one race currently live at once.
    needsChoice: liveRaces.length > 1
  };
}

export async function getRaceDayContext(teamId, { now = new Date() } = {}) {
  const { data, error } = await supabaseAdmin
    .from("race_sessions")
    .select("*")
    .eq("team_id", teamId)
    .eq("is_rehearsal", false)
    .neq("status", "cancelled");
  if (error) throw error;

  return classifyRaceDay(data || [], todayDateString(now));
}
