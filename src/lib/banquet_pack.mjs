import { personDisplayName, schoolKey } from "./display_names.mjs";

// Banquet Pack (WO-35): a team's season summary for coaches to print,
// project and share. Pure: built from loadTeamPage(slug, { rows: true })
// plus the coach's settings and award rows. Real records only. The derived
// numbers (season bests, first race to best, top-7 averages by meet) are
// arithmetic on stored marks and are labeled as such where shown.

export const BANQUET_MIN_MEETS = 3;
export const NOTE_MAX = 280;
const MOST_IMPROVED_MIN_RACES = 3;

const meetKey = (name, date) => `${String(name || "").trim().toLowerCase()}|${date || ""}`;
const byDate = (a, b) => String(a.date || "").localeCompare(String(b.date || "")) || String(a.meet || "").localeCompare(String(b.meet || ""));

// "15:32.9" style time from seconds (only for derived numbers; stored marks
// are always shown as stored).
export function formatSeconds(value) {
  if (!Number.isFinite(value)) return "";
  const tenths = Math.round(value * 10);
  const minutes = Math.floor(tenths / 600);
  const rest = (tenths - minutes * 600) / 10;
  return `${minutes}:${rest < 10 ? "0" : ""}${rest.toFixed(1)}`;
}

// Distinct meets (name + date) the team has results from this season,
// boys and girls together.
export function seasonMeetCount(data) {
  const keys = new Set();
  for (const g of ["boys", "girls"]) for (const r of data.genders[g].results) keys.add(meetKey(r.meet, r.date));
  return keys.size;
}

const norm = (text) => schoolKey(String(text || "").replace(/\s*\([^)]*\)\s*$/, "")) + (/\(([^)]*)\)\s*$/.test(String(text || "")) ? `|${String(text).match(/\(([^)]*)\)\s*$/)[1].toLowerCase().trim()}` : "");

// Does an award row's school text name this team? A row with a school_id
// matches only on the id. A shared school name ("Madison") must carry the
// city ("Madison (Mansfield)").
export function awardSchoolMatches(row, team, isShared) {
  if (row.school_id) return Boolean(team.ohio_school_id) && row.school_id === team.ohio_school_id;
  const text = String(row.school || "").trim();
  if (!text) return false;
  const base = schoolKey(team.school_name);
  const withCity = `${base}|${String(team.city || "").toLowerCase().trim()}`;
  const key = norm(text);
  if (key === withCity) return true;
  return !isShared(base) && key === base;
}

const nameKey = (name) => String(name || "").toLowerCase().replace(/[^a-z]+/g, " ").trim();

export function buildBanquetPack(data, { settings = {}, awards = { weekly: [], yearly: [] }, isShared = () => false } = {}) {
  const season = data.season;
  const meetCount = seasonMeetCount(data);
  const base = {
    team: data.team,
    logo: data.logo,
    accent: data.accent,
    accent_text: data.accent_text,
    season,
    meet_count: meetCount,
    eligible: meetCount >= BANQUET_MIN_MEETS,
    note: String(settings.note || "").trim().slice(0, NOTE_MAX) || null,
    hidden_count: 0
  };
  if (!base.eligible) return base;

  const hidden = new Set(settings.hidden_profile_ids || []);
  const { profiles, perfs } = data.rows;
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const hiddenNames = new Set([...hidden].map((id) => profileById.get(id)).filter(Boolean).map((p) => nameKey(personDisplayName(p.display_name))));
  const genders = {};
  const seniorsOut = [];
  for (const gender of ["boys", "girls"]) {
    const g = data.genders[gender];
    const season2026 = perfs.filter((p) => p.season_year === season && profileById.get(p.profile_id)?.gender === gender);
    // Every race per runner, oldest first.
    const races = new Map();
    for (const p of season2026) {
      if (!races.has(p.profile_id)) races.set(p.profile_id, []);
      races.get(p.profile_id).push({ meet: p.meet_name, date: p.meet_date, mark: p.mark_text, value: Number(p.mark_value), place: p.place ?? null, stage: null });
    }
    const honorBySlug = new Map(g.roster.map((r) => [r.slug, r.honor]));
    const athletes = [];
    for (const [profileId, list] of races) {
      list.sort(byDate);
      const profile = profileById.get(profileId);
      const best = list.reduce((m, r) => (r.value < m.value ? r : m), list[0]);
      const first = list[0];
      const athlete = {
        profile_id: profileId,
        slug: profile.slug,
        name: personDisplayName(profile.display_name),
        class_year: profile.graduation_year || null,
        races: list.length,
        best: { mark: best.mark, value: best.value, meet: best.meet, date: best.date },
        first: { mark: first.mark, value: first.value, meet: first.meet, date: first.date },
        // First race on Podium Watch to season best; different courses.
        drop: list.length > 1 && best !== first && first.value > best.value ? first.value - best.value : null,
        honor: honorBySlug.get(profile.slug) || null,
        hidden: hidden.has(profileId),
        list
      };
      athletes.push(athlete);
    }
    athletes.sort((a, b) => a.best.value - b.best.value);
    const shown = athletes.filter((a) => !a.hidden);
    base.hidden_count += athletes.length - shown.length;

    // Top-7 average by meet: meets where 7 or more of the team's runners
    // have a stored time (every runner counts, shown or hidden).
    const byMeet = new Map();
    for (const a of athletes) for (const r of a.list) {
      const k = meetKey(r.meet, r.date);
      if (!byMeet.has(k)) byMeet.set(k, { meet: r.meet, date: r.date, values: [] });
      byMeet.get(k).values.push(r.value);
    }
    const top7ByMeet = [...byMeet.values()].filter((m) => m.values.length >= 7).map((m) => {
      const top = [...m.values].sort((x, y) => x - y).slice(0, 7);
      return { meet: m.meet, date: m.date, runners: m.values.length, average: top.reduce((s, v) => s + v, 0) / 7 };
    }).sort(byDate);

    const improved = shown.filter((a) => a.races >= MOST_IMPROVED_MIN_RACES && a.drop).sort((a, b) => b.drop - a.drop).slice(0, 5);
    const allOhio = shown.filter((a) => a.honor);
    const seniorYear = season + 1;
    for (const a of shown.filter((x) => x.class_year === seniorYear)) seniorsOut.push({ ...a, gender });

    genders[gender] = {
      division: g.division,
      results: [...g.results].sort(byDate),
      athletes: shown.map(({ list, hidden: _h, ...rest }) => rest),
      improved: improved.map(({ list, hidden: _h, ...rest }) => rest),
      top7_by_meet: top7ByMeet,
      path: g.path,
      state: g.state,
      all_ohio: allOhio.map(({ list, hidden: _h, ...rest }) => rest),
      has_data: athletes.length > 0 || g.results.length > 0
    };
  }

  // Podium Watch awards: weekly finalists and winners, Athlete/Team/Coach of
  // the Year finalists once announced (winners once results are published).
  const awardList = [];
  for (const row of awards.weekly || []) {
    if (!awardSchoolMatches(row, data.team, isShared)) continue;
    if (row.athlete_name && hiddenNames.has(nameKey(row.athlete_name))) continue;
    awardList.push({ award: row.award, week: row.week || null, name: row.athlete_name || row.team_name || data.team.display_name, result: row.winner && row.decided ? "Winner" : "Finalist" });
  }
  for (const row of awards.yearly || []) {
    if (!row.finalists_published_at || !awardSchoolMatches(row, data.team, isShared)) continue;
    if (row.award === "athlete" && hiddenNames.has(nameKey(row.display_name))) continue;
    awardList.push({ award: row.label, week: null, name: row.award === "team" ? data.team.display_name : personDisplayName(row.display_name), result: row.winner && row.results_published_at ? "Winner" : "Finalist" });
  }
  awardList.sort((a, b) => (a.result === "Winner" ? 0 : 1) - (b.result === "Winner" ? 0 : 1) || String(a.week || "9").localeCompare(String(b.week || "9")));

  seniorsOut.sort((a, b) => a.name.localeCompare(b.name));
  return {
    ...base,
    genders,
    seniors: seniorsOut.map(({ list, hidden: _h, ...rest }) => ({ ...rest, races_list: list })),
    awards: awardList
  };
}
