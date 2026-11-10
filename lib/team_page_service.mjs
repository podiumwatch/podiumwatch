import { supabaseAdmin } from "./supabase-admin.mjs";
import { selectAll } from "./supabase_paging.mjs";
import { featuredRunsFor } from "./front_page_service.mjs";
import { isInstagramLink, handleFromUrl, INSTAGRAM_LABELS } from "./team_instagram_service.mjs";
import { teamAccentColor, teamLogo, textOn } from "./team_logo_service.mjs";
import { labelSchool } from "../src/lib/school_labels.mjs";
import { personDisplayName } from "../src/lib/display_names.mjs";

// Server-rendered team page data (WO-11). Real records only: results,
// team scores and honors exactly as stored. The only derived numbers are
// each runner's season best (their fastest stored 5K that season) and the
// top-7 average of those bests, both labeled as such on the page.

export const TEAM_SEASON = 2026;
const TEAM_FIELDS = "id, slug, school_name, ohio_school_id, city, state, cross_country_boys_division, cross_country_girls_division, primary_color, secondary_color, logo_url, website_url, athletics_url, published, suspended, archived_at, merged_into_team_id, claimed_at, updated_at";
const STAGES = [["district", /^OHSAA Cross Country District\b/i], ["regional", /^OHSAA Cross Country Regional\b/i], ["state", /^OHSAA Cross Country State Championships?\b/i]];
const stageOf = (meetName) => (STAGES.find(([, re]) => re.test(String(meetName || ""))) || [])[0] || null;

async function all(build) {
  const { data, error } = await selectAll(build, { maxRows: 20000 });
  if (error) throw error;
  return data;
}

const ordinal = (n) => { const t = n % 100; return `${n}${t >= 11 && t <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" })[n % 10] || "th"}`; };
const divisionShort = (text) => String(text || "").replace(/^Division\s+/i, "");

// "State Runner-up, Division IV Boys" style label from a real state place.
export function stateFinishLabel(place, division, gender) {
  const who = `${division ? `${division} ` : ""}${gender === "girls" ? "Girls" : "Boys"}`;
  if (place === 1) return `State Champion, ${who}`;
  if (place === 2) return `State Runner-up, ${who}`;
  return `${ordinal(place)} at State, ${who}`;
}

export async function loadTeamPage(slug) {
  const { data: team, error } = await supabaseAdmin.from("team_pages").select(TEAM_FIELDS).ilike("slug", String(slug || "")).maybeSingle();
  if (error) throw error;
  if (!team) return null;
  if (team.merged_into_team_id) {
    const { data: target } = await supabaseAdmin.from("team_pages").select("slug").eq("id", team.merged_into_team_id).maybeSingle();
    return { merged: true, redirect_slug: target?.slug || null };
  }
  if (!team.published || team.suspended || team.archived_at) return { private: true };

  const schoolId = team.ohio_school_id;
  const [school, members, links, profiles, perfRows, teamScores, divisions, featured] = await Promise.all([
    schoolId ? supabaseAdmin.from("ohio_schools").select("id, school_name, city").eq("id", schoolId).maybeSingle().then((r) => r.data) : null,
    supabaseAdmin.from("team_members").select("id", { count: "exact", head: true }).eq("team_id", team.id).eq("status", "active").then((r) => r.count || 0),
    supabaseAdmin.from("team_social_links").select("platform, label, url, published, sort_order").eq("team_id", team.id).then((r) => r.data || []),
    all(() => {
      let q = supabaseAdmin.from("athlete_profiles").select("id, slug, display_name, gender, graduation_year, current_team_id, current_school_id").is("merged_into_profile_id", null).is("archived_at", null).eq("public_visible", true);
      q = schoolId ? q.or(`current_team_id.eq.${team.id},current_school_id.eq.${schoolId}`) : q.eq("current_team_id", team.id);
      return q.order("id");
    }),
    all(() => {
      let q = supabaseAdmin.from("athlete_performances").select("id, profile_id, season_year, meet_name, meet_date, meet_id, mark_text, mark_value, mark_unit, place, honor_label, result_status").eq("sport", "cross_country").eq("event_key", "xc_5k").eq("public_visible", true).is("archived_at", null);
      q = schoolId ? q.or(`school_id.eq.${schoolId},team_id.eq.${team.id}`) : q.eq("team_id", team.id);
      return q.order("id");
    }),
    all(() => {
      let q = supabaseAdmin.from("result_team_scores").select("meet_name, meet_date, meet_id, gender, division, place_numeric, place_text, score, season_year, provider_event_id").eq("sport", "cross_country").eq("public_visible", true);
      q = schoolId ? q.or(`matched_team_id.eq.${team.id},matched_school_id.eq.${schoolId}`) : q.eq("matched_team_id", team.id);
      return q.order("meet_date");
    }),
    schoolId ? supabaseAdmin.from("ohio_school_divisions").select("gender, division").eq("school_id", schoolId).eq("sport", "cross_country").eq("current", true).then((r) => r.data || []) : [],
    featuredRunsFor({ teamId: team.id }).catch(() => [])
  ]);

  const profileById = new Map(profiles.map((p) => [p.id, p]));
  // Performances by profiles we can name and link (public, not merged).
  const perfs = perfRows.filter((p) => profileById.has(p.profile_id) && Number.isFinite(Number(p.mark_value)) && p.mark_unit === "seconds");
  const instagram = [];
  for (const link of links) {
    if (link.published === false || !isInstagramLink(link)) continue;
    const handle = handleFromUrl(link.url);
    if (handle && !instagram.some((i) => i.handle === handle)) instagram.push({ handle, label: INSTAGRAM_LABELS.includes(link.label) ? link.label : "Instagram", url: `https://www.instagram.com/${handle}/` });
  }
  instagram.sort((a, b) => (INSTAGRAM_LABELS.indexOf(a.label) + 100) % 100 - (INSTAGRAM_LABELS.indexOf(b.label) + 100) % 100);

  const division = (gender) => team[`cross_country_${gender}_division`] || divisions.find((d) => d.gender === gender)?.division || null;
  const genders = {};
  for (const gender of ["boys", "girls"]) {
    const gp = perfs.filter((p) => profileById.get(p.profile_id).gender === gender);
    const season = gp.filter((p) => p.season_year === TEAM_SEASON);
    // Season best per runner.
    const best = new Map();
    for (const p of season) if (!best.has(p.profile_id) || Number(p.mark_value) < Number(best.get(p.profile_id).mark_value)) best.set(p.profile_id, p);
    const honors = new Map();
    for (const p of season) if (p.honor_label && stageOf(p.meet_name) === "state" && p.result_status !== "reviewed_result") honors.set(p.profile_id, p.honor_label);
    const roster = [...best.values()].sort((a, b) => Number(a.mark_value) - Number(b.mark_value)).map((p) => {
      const profile = profileById.get(p.profile_id);
      return { slug: profile.slug, name: personDisplayName(profile.display_name), class_year: profile.graduation_year, best: p.mark_text, best_value: Number(p.mark_value), best_meet: p.meet_name, best_date: p.meet_date, honor: honors.get(p.profile_id) || null };
    });
    const top7 = roster.slice(0, 7);
    const top7Average = top7.length === 7 ? top7.reduce((sum, r) => sum + r.best_value, 0) / 7 : null;

    // Season results: every meet the team ran, team place and score where posted.
    const scores = teamScores.filter((t) => t.gender === gender && t.season_year === TEAM_SEASON);
    const meets = new Map();
    const key = (name, date) => `${String(name || "").trim().toLowerCase()}|${date || ""}`;
    for (const p of season) if (!meets.has(key(p.meet_name, p.meet_date))) meets.set(key(p.meet_name, p.meet_date), { meet: p.meet_name, date: p.meet_date, runners: 0, place: null, score: null, field: null });
    for (const p of season) meets.get(key(p.meet_name, p.meet_date)).runners += 1;
    for (const t of scores) {
      const k = key(t.meet_name, t.meet_date);
      const entry = meets.get(k) || { meet: t.meet_name, date: t.meet_date, runners: 0 };
      entry.place = t.place_numeric ?? null;
      entry.score = t.score ?? null;
      meets.set(k, entry);
    }
    const results = [...meets.values()].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

    // Postseason path: real team place and points at each OHSAA round.
    const path = STAGES.map(([stage]) => {
      const row = scores.find((t) => stageOf(t.meet_name) === stage);
      const runners = season.filter((p) => stageOf(p.meet_name) === stage).length;
      if (!row && !runners) return null;
      return { stage, meet: row?.meet_name || season.find((p) => stageOf(p.meet_name) === stage)?.meet_name || null, place: row?.place_numeric ?? null, score: row?.score ?? null, individuals_only: !row && runners > 0, runners };
    }).filter(Boolean);
    const stateRow = scores.find((t) => stageOf(t.meet_name) === "state");
    const stateQualifiers = new Set(season.filter((p) => stageOf(p.meet_name) === "state").map((p) => p.profile_id)).size;

    // Best on Podium Watch: each runner's fastest 5K for this school, top 10.
    const allTime = new Map();
    for (const p of gp) if (!allTime.has(p.profile_id) || Number(p.mark_value) < Number(allTime.get(p.profile_id).mark_value)) allTime.set(p.profile_id, p);
    const bestEver = [...allTime.values()].sort((a, b) => Number(a.mark_value) - Number(b.mark_value)).slice(0, 10).map((p) => { const profile = profileById.get(p.profile_id); return { slug: profile.slug, name: personDisplayName(profile.display_name), class_year: profile.graduation_year, mark: p.mark_text, meet: p.meet_name, date: p.meet_date, season: p.season_year }; });

    genders[gender] = {
      division: division(gender),
      roster,
      top7_average: top7Average,
      results,
      path,
      state: stateRow ? { place: stateRow.place_numeric, score: stateRow.score, label: stateRow.place_numeric ? stateFinishLabel(stateRow.place_numeric, stateRow.division || division(gender), gender) : null } : null,
      state_qualifiers: stateQualifiers,
      all_ohio: [...honors.values()].length,
      best_ever: bestEver
    };
  }
  const firstYear = perfs.length ? Math.min(...perfs.map((p) => p.season_year).filter(Boolean)) : null;
  const accent = teamAccentColor(team);
  return {
    team: { ...team, display_name: labelSchool(team.school_name, team.city), city: team.city || school?.city || null },
    claimed: Boolean(team.claimed_at) || members > 0,
    logo: teamLogo(team),
    accent,
    accent_text: textOn(accent),
    instagram,
    genders,
    first_year: firstYear,
    featured,
    season: TEAM_SEASON
  };
}

export const divisionLabelShort = divisionShort;
