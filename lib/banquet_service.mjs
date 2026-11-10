import { supabaseAdmin } from "./supabase-admin.mjs";
import { loadTeamPage } from "./team_page_service.mjs";
import { buildBanquetPack, NOTE_MAX } from "../src/lib/banquet_pack.mjs";
import { isSharedSchoolName } from "../src/lib/school_labels.mjs";

// Banquet Pack data (WO-35). Coach settings live in team_banquet_settings
// (install/91); until that migration runs the pack works with no hidden
// athletes and no note.

const missingTable = (error) => ["42P01", "PGRST205", "42703"].includes(String(error?.code || ""));

export async function loadBanquetSettings(teamId, season) {
  const { data, error } = await supabaseAdmin.from("team_banquet_settings").select("hidden_profile_ids, note, updated_at").eq("team_id", teamId).eq("season_year", season).maybeSingle();
  if (error) {
    if (missingTable(error)) return { hidden_profile_ids: [], note: null, available: false };
    throw error;
  }
  return { hidden_profile_ids: data?.hidden_profile_ids || [], note: data?.note || null, updated_at: data?.updated_at || null, available: true };
}

const WEEKLY = [
  { award: "Athlete of the Week", finalists: "aotw_finalists", weeks: "aotw_weeks", fields: "athlete_name, school, winner, week_id" },
  { award: "Team of the Week", finalists: "totw_finalists", weeks: "totw_weeks", fields: "team_name, school, winner, week_id" }
];

// Award rows for one season (small tables: a few hundred rows in all).
async function loadAwardRows(season) {
  const weekly = [];
  for (const kind of WEEKLY) {
    const [{ data: rows, error }, { data: weeks, error: weekError }] = await Promise.all([
      supabaseAdmin.from(kind.finalists).select(kind.fields),
      supabaseAdmin.from(kind.weeks).select("id, week_slug, status")
    ]);
    if (error) throw error;
    if (weekError) throw weekError;
    const weekById = new Map((weeks || []).map((w) => [w.id, w]));
    for (const row of rows || []) {
      const week = weekById.get(row.week_id);
      if (!week || !String(week.week_slug || "").startsWith(String(season))) continue;
      weekly.push({ ...row, award: kind.award, week: week.week_slug, decided: ["voting_closed", "winner_announced"].includes(week.status) });
    }
  }
  const { data: yearlyRows, error: yearlyError } = await supabaseAdmin.from("yearly_award_finalists").select("display_name, school, school_id, winner, yearly_award_categories!inner(label, award, season, finalists_published_at, results_published_at)").eq("yearly_award_categories.season", season);
  if (yearlyError) throw yearlyError;
  const yearly = (yearlyRows || []).map((row) => ({ display_name: row.display_name, school: row.school, school_id: row.school_id, winner: row.winner, ...row.yearly_award_categories }));
  return { weekly, yearly };
}

// The pack for /teams/{slug}/season/{season}/banquet/, or the same
// merged/private/null shapes loadTeamPage returns.
export async function loadBanquetPack(slug, season) {
  const data = await loadTeamPage(slug, { rows: true });
  if (!data || data.merged || data.private) return data;
  if (season !== data.season) return null;
  const [settings, awards] = await Promise.all([loadBanquetSettings(data.team.id, season), loadAwardRows(season)]);
  const pack = buildBanquetPack(data, { settings, awards, isShared: isSharedSchoolName });
  pack.claimed = data.claimed;
  pack.settings_available = settings.available;
  return pack;
}

// --- Coach settings (claimed teams; owners and editors) -----------------
async function requireTeamMember(teamId, userId) {
  const { data, error } = await supabaseAdmin.from("team_members").select("id, role").eq("team_id", teamId).eq("user_id", userId).eq("status", "active").maybeSingle();
  if (error) throw error;
  if (!data) {
    const denied = new Error("Only a coach on this team's account can change the Banquet Pack.");
    denied.status = 403;
    throw denied;
  }
  return data;
}

// Roster for the coach panel: every 2026 runner, hidden or not.
export async function coachBanquetState({ teamId, userId, season }) {
  await requireTeamMember(teamId, userId);
  const { data: team } = await supabaseAdmin.from("team_pages").select("slug").eq("id", teamId).maybeSingle();
  if (!team) { const e = new Error("Team not found."); e.status = 404; throw e; }
  const data = await loadTeamPage(team.slug, { rows: true });
  if (!data?.rows) { const e = new Error("Team not found."); e.status = 404; throw e; }
  const settings = await loadBanquetSettings(teamId, season);
  const hidden = new Set(settings.hidden_profile_ids);
  const ran = new Set(data.rows.perfs.filter((p) => p.season_year === season).map((p) => p.profile_id));
  const athletes = data.rows.profiles.filter((p) => ran.has(p.id)).map((p) => ({ id: p.id, name: p.display_name, gender: p.gender, class_year: p.graduation_year, hidden: hidden.has(p.id) })).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return { available: settings.available, note: settings.note, athletes };
}

export async function saveBanquetSettings({ teamId, userId, season, hiddenProfileIds, note }) {
  await requireTeamMember(teamId, userId);
  const state = await coachBanquetState({ teamId, userId, season });
  if (!state.available) { const e = new Error("Banquet settings aren't switched on yet. Try again soon."); e.status = 503; throw e; }
  // Only this team's own 2026 runners can be hidden.
  const allowed = new Set(state.athletes.map((a) => a.id));
  const hidden = [...new Set((Array.isArray(hiddenProfileIds) ? hiddenProfileIds : []).map(String))].filter((id) => allowed.has(id));
  const cleanNote = String(note ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/\s+/g, " ").trim().slice(0, NOTE_MAX) || null;
  const { error } = await supabaseAdmin.from("team_banquet_settings").upsert({ team_id: teamId, season_year: season, hidden_profile_ids: hidden, note: cleanNote, updated_by: userId, updated_at: new Date().toISOString() }, { onConflict: "team_id,season_year" });
  if (error) throw error;
  return { hidden_profile_ids: hidden, note: cleanNote };
}
