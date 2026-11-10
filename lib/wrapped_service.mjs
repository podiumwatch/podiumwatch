import { supabaseAdmin } from "./supabase-admin.mjs";
import { selectAll } from "./supabase_paging.mjs";
import { displayAthleteName, getLeaders } from "./athlete_leaders_service.mjs";
import { buildWrapped, WRAPPED_SEASON } from "../src/lib/wrapped.mjs";
import { labelSchool } from "../src/lib/school_labels.mjs";

// Podium Watch Wrapped data (WO-36). Same visibility rule as athlete
// pages: only public, unsuspended, unarchived profiles; a merged profile
// points to the one it was merged into. Ranks come from the leaders
// function (the State Leaders page): division rank among the runner's
// division, class rank statewide among the same grade. A runner outside
// the 500 a leaders list returns gets no rank shown (never estimated).

const LAUNCH_KEY = "pw:wrapped:launch_at";
const DIVISION_NUMBER = { "Division I": 1, "Division II": 2, "Division III": 3, "Division IV": 4 };
const RANK_LIMIT = 500;
const leadersCache = new Map(); // key -> { at, value }
const CACHE_MS = 10 * 60 * 1000;

async function redis() {
  const { redisAdmin } = await import("./redis-admin.mjs");
  return redisAdmin;
}

// --- Launch switch ---------------------------------------------------------
export async function wrappedLaunch() {
  try {
    const value = await (await redis()).get(LAUNCH_KEY);
    return value ? String(value) : null;
  } catch {
    return null;
  }
}
export async function wrappedIsLive(now = new Date()) {
  const at = await wrappedLaunch();
  return Boolean(at) && new Date(at).getTime() <= new Date(now).getTime();
}
export async function setWrappedLaunch(launchAt) {
  const client = await redis();
  if (!launchAt) { await client.del(LAUNCH_KEY); return { launch_at: null }; }
  const at = new Date(launchAt);
  if (Number.isNaN(at.getTime())) { const e = new Error("Pick a real date and time."); e.status = 400; throw e; }
  await client.set(LAUNCH_KEY, at.toISOString());
  return { launch_at: at.toISOString() };
}

// --- Ranks -----------------------------------------------------------------
async function cachedLeaders(args) {
  const key = JSON.stringify(args);
  const hit = leadersCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = await getLeaders({ ...args, seasonYear: WRAPPED_SEASON, limit: RANK_LIMIT });
  leadersCache.set(key, { at: Date.now(), value });
  return value;
}

async function ranksFor(profile, bestRow, schoolId) {
  const ranks = { division: null, grade: null };
  if (!bestRow) return ranks;
  const tasks = [];
  if (schoolId) {
    tasks.push((async () => {
      const { data } = await supabaseAdmin.from("ohio_school_divisions").select("division, season_start_year, season_end_year").eq("school_id", schoolId).eq("sport", "cross_country").eq("gender", profile.gender);
      const row = (data || []).find((d) => d.season_start_year <= WRAPPED_SEASON && WRAPPED_SEASON <= d.season_end_year);
      const number = DIVISION_NUMBER[row?.division];
      if (!number) return;
      const list = await cachedLeaders({ gender: profile.gender, divisionNumber: number });
      const index = list.entries.findIndex((e) => e.athlete_slug === profile.slug);
      if (index >= 0) ranks.division = { rank: list.entries[index].rank, of: list.total_before_limit, division: row.division };
    })());
  }
  if (Number.isInteger(bestRow.grade) && bestRow.grade >= 9 && bestRow.grade <= 12) {
    tasks.push((async () => {
      const list = await cachedLeaders({ gender: profile.gender, grade: bestRow.grade });
      const index = list.entries.findIndex((e) => e.athlete_slug === profile.slug);
      if (index >= 0) ranks.grade = { rank: list.entries[index].rank, of: list.total_before_limit, grade: bestRow.grade };
    })());
  }
  await Promise.all(tasks);
  return ranks;
}

// --- One runner --------------------------------------------------------------
export async function loadWrapped(slug) {
  const clean = String(slug || "").toLowerCase();
  if (!/^[a-z0-9-]{1,200}$/.test(clean)) return null;
  const { data: profile, error } = await supabaseAdmin.from("athlete_profiles").select("id, slug, display_name, gender, graduation_year, current_school_id, current_team_id, public_visible, suspended, archived_at, merged_into_profile_id").eq("slug", clean).maybeSingle();
  if (error) throw error;
  if (!profile) return null;
  if (profile.merged_into_profile_id) {
    const { data: target } = await supabaseAdmin.from("athlete_profiles").select("slug").eq("id", profile.merged_into_profile_id).maybeSingle();
    return { merged: true, redirect_slug: target?.slug || null };
  }
  if (!profile.public_visible || profile.suspended || profile.archived_at) return { private: true };
  if (!["boys", "girls"].includes(profile.gender)) return { private: true };

  const { data: rows, error: rowsError } = await selectAll(() => supabaseAdmin.from("athlete_performances")
    .select("id, season_year, event_key, meet_name, meet_date, mark_text, mark_value, mark_unit, place, grade, school_id, honor_label, result_status, metadata")
    .eq("profile_id", profile.id).eq("sport", "cross_country").eq("season_year", WRAPPED_SEASON)
    .eq("public_visible", true).is("archived_at", null).order("id"), { maxRows: 500 });
  if (rowsError) throw rowsError;

  const timed = (rows || []).filter((r) => r.event_key === "xc_5k" && r.mark_unit === "seconds" && Number.isFinite(Number(r.mark_value)));
  const bestRow = timed.reduce((m, r) => (!m || Number(r.mark_value) < Number(m.mark_value) ? r : m), null);
  const schoolId = bestRow?.school_id || profile.current_school_id || null;
  const [{ data: school }, ranks] = await Promise.all([
    schoolId ? supabaseAdmin.from("ohio_schools").select("school_name, city").eq("id", schoolId).maybeSingle() : Promise.resolve({ data: null }),
    (rows || []).length >= 3 ? ranksFor(profile, bestRow, schoolId) : Promise.resolve({})
  ]);
  return buildWrapped({ profile: { ...profile, display_name: displayAthleteName(profile.display_name) }, school: school ? labelSchool(school.school_name, school.city) : null, rows: rows || [], ranks });
}
