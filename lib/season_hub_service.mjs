import { supabaseAdmin } from "./supabase-admin.mjs";
import { selectAll } from "./supabase_paging.mjs";
import { displaySchoolName } from "./ohio_foundation_service.mjs";
import { publicUrl as photoUrl } from "./photo_submissions_service.mjs";
import { HUB_STAGES, HUB_STORIES } from "../src/config/season_hubs.mjs";
import { buildRaces, fastestTimes } from "../src/lib/season_hub_races.mjs";

export { buildRaces, fastestTimes };

// Season results hubs (WO-37). Reads only what the official-results import
// wrote: athlete_performances (official results, linked by meet_id) and
// result_team_scores. Places, times, scores and honors are shown exactly
// as stored; nothing is computed except grouping and sorting.

const chunk = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

async function all(build) {
  const { data, error } = await selectAll(build, { maxRows: 50000 });
  if (error) throw error;
  return data;
}
async function byIds(table, columns, ids) {
  const parts = await Promise.all(chunk([...new Set(ids.filter(Boolean))], 200).map(async (part) => {
    const { data, error } = await supabaseAdmin.from(table).select(columns).in("id", part);
    if (error) throw error;
    return data;
  }));
  return parts.flat();
}

export async function loadSeasonHub({ stageKey, year }) {
  const stage = HUB_STAGES[stageKey];
  if (!stage) return null;
  const { data: meets, error } = await supabaseAdmin
    .from("meets")
    .select("id, name, slug, meet_date, venue_name, city, results_url, athleticnet_url")
    .like("slug", stage.slugPattern(year))
    .order("name");
  if (error) throw error;
  if (!meets?.length) return null;
  const meetIds = meets.map((m) => m.id);

  const [performances, teamScores] = await Promise.all([all(() => supabaseAdmin
    .from("athlete_performances")
    .select("id, profile_id, school_id, team_id, meet_id, place, grade, mark_text, mark_value, mark_unit, honor_label, result_status, metadata")
    .in("meet_id", meetIds)
    .eq("public_visible", true)
    .eq("result_status", "official_result")
    .is("archived_at", null)
    .order("id")), all(() => supabaseAdmin
    .from("result_team_scores")
    .select("id, meet_id, provider_event_id, gender, division, team_name, matched_school_id, matched_team_id, place_text, place_numeric, score, scoring_breakdown")
    .in("meet_id", meetIds)
    .eq("public_visible", true)
    .not("matched_school_id", "is", null)
    .order("id"))]);

  const [profiles, schools, teams, photos] = await Promise.all([
    byIds("athlete_profiles", "id, slug, display_name, public_visible, merged_into_profile_id", performances.map((p) => p.profile_id)),
    byIds("ohio_schools", "id, school_name, city", [...performances.map((p) => p.school_id), ...teamScores.map((t) => t.matched_school_id)]),
    byIds("team_pages", "id, slug, school_name, published", [...performances.map((p) => p.team_id), ...teamScores.map((t) => t.matched_team_id)]),
    loadHubPhotos(meets)
  ]);
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const schoolById = new Map(schools.map((s) => [s.id, s]));
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const schoolLabel = (schoolId, teamId) => displaySchoolName(teamById.get(teamId)?.school_name || schoolById.get(schoolId)?.school_name || "");
  const teamHref = (teamId) => { const t = teamById.get(teamId); return t?.slug && t.published !== false ? `/team/?slug=${encodeURIComponent(t.slug)}` : null; };

  const shapedPerformances = performances.map((p) => {
    const profile = profileById.get(p.profile_id);
    const linkable = profile && profile.public_visible && !profile.merged_into_profile_id;
    return {
      ...p,
      name: profile?.display_name || "",
      href: linkable ? `/athletes/${profile.slug}/` : null,
      school: schoolLabel(p.school_id, p.team_id),
      team_href: teamHref(p.team_id)
    };
  });
  const shapedTeams = teamScores.map((t) => ({ ...t, school: schoolLabel(t.matched_school_id, t.matched_team_id) || t.team_name, href: teamHref(t.matched_team_id) }));

  const races = buildRaces({ meets, performances: shapedPerformances, teamScores: shapedTeams, year });
  return {
    stageKey,
    stage,
    year,
    meets,
    races,
    fastest: stageKey === "state" ? { girls: fastestTimes(races, "girls"), boys: fastestTimes(races, "boys") } : null,
    stories: HUB_STORIES[`${stage.path}/${year}`] || [],
    photos
  };
}

// Selected (admin-approved) fan photos from these meet dates, with credit.
async function loadHubPhotos(meets) {
  const dates = [...new Set(meets.map((m) => m.meet_date).filter(Boolean))];
  const { data: submissions, error } = await supabaseAdmin
    .from("photo_submissions")
    .select("id, credit_name, meet_name, meet_date")
    .in("meet_date", dates);
  if (error || !submissions?.length) return [];
  const { data: items } = await supabaseAdmin
    .from("photo_submission_items")
    .select("id, kept_storage_key, submission_id")
    .eq("item_status", "selected")
    .not("kept_storage_key", "is", null)
    .in("submission_id", submissions.map((s) => s.id))
    .limit(12);
  const byId = new Map(submissions.map((s) => [s.id, s]));
  return (items || []).map((item) => ({ url: photoUrl(item.kept_storage_key), credit: byId.get(item.submission_id)?.credit_name || null, meet: byId.get(item.submission_id)?.meet_name || null })).filter((p) => p.url && p.credit);
}
