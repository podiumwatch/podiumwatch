import manifest from "../src/data/team-logos.json" with { type: "json" };
import overrides from "../src/data/team-color-overrides.json" with { type: "json" };
import { supabaseAdmin } from "./supabase-admin.mjs";
import { selectAll } from "./supabase_paging.mjs";
import { writeTeamChange } from "./team_audit.mjs";
import { labelSchool } from "../src/lib/school_labels.mjs";

// School logos (WO-11). Processed files live under /images/teams/ (see
// scripts/team-logos-process.mjs); src/data/team-logos.json holds each
// logo's base path and main color. team_pages.logo_url is the source of
// truth for a team page; a coach-uploaded logo (any other URL) is kept.

const DEFAULT_TEAM_COLOR = "#00bf63";
const poolByBase = new Map(Object.values(manifest.pool || {}).map((p) => [p.base, p]));
const teamByBase = new Map(Object.values(manifest.teams || {}).map((t) => [t.base, t]));

// "/images/teams/russia-russia-256.png" -> "/images/teams/russia-russia"
const baseOf = (url) => (String(url || "").match(/^(\/images\/teams\/(?:pool\/)?[a-z0-9-]+?)-(?:512|256|96)\.(?:png|webp)$/) || [])[1] || null;

// Logo for a team page: { base, color, external } or null. external is a
// coach-uploaded image URL with no processed sizes.
export function teamLogo(team) {
  if (!team) return null;
  const base = baseOf(team.logo_url);
  if (base) { const entry = teamByBase.get(base) || poolByBase.get(base); return { base, color: entry?.color || null, external: null }; }
  if (team.logo_url) return { base: null, color: null, external: team.logo_url };
  return null;
}

// Logo for any school (also schools without a team page), for small logos
// in results tables.
export function schoolLogoBase(schoolId) {
  return manifest.schools?.[schoolId]?.base || null;
}

// Header accent color: a color the coach set (not the default green) wins,
// then a manual override (src/data/team-color-overrides.json), then the
// logo's main color.
export function teamAccentColor(team) {
  const coach = String(team?.primary_color || "").toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(coach) && coach !== DEFAULT_TEAM_COLOR) return coach;
  const override = overrides[team?.slug];
  if (override && /^#[0-9a-f]{6}$/i.test(override)) return override.toLowerCase();
  return teamLogo(team)?.color || "#0f2a1f";
}

// Readable text on a background color (WCAG relative luminance).
export function textOn(hex) {
  const c = String(hex || "#000000").replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (1.05 / (lum + 0.05)) >= ((lum + 0.05) / 0.05) ? "#ffffff" : "#0b0b0b";
}

// Small logo <img> (96 px file) for lists and tables, or "" when none.
export function smallLogoHtml(base, size = 24) {
  if (!base) return "";
  return `<img class="pw-team-logo" src="${base}-96.webp" alt="" aria-hidden="true" width="${size}" height="${size}" loading="lazy" decoding="async">`;
}

// --- Admin: Logo Review ---------------------------------------------------
async function stateMeetTeamIds() {
  const { data: meet } = await supabaseAdmin.from("meets").select("id").eq("slug", "2026-ohsaa-state-championships").maybeSingle();
  if (!meet) return new Set();
  const { data } = await supabaseAdmin.from("result_team_scores").select("matched_team_id").eq("meet_id", meet.id).not("matched_team_id", "is", null);
  return new Set((data || []).map((row) => row.matched_team_id));
}

export async function adminLogoState() {
  const { data: teams, error } = await selectAll(() => supabaseAdmin.from("team_pages").select("id, slug, school_name, city, logo_url, published").is("merged_into_team_id", null).is("archived_at", null), { maxRows: 5000 });
  if (error) throw error;
  const state = await stateMeetTeamIds();
  const withLogo = teams.filter((t) => t.logo_url);
  const pct = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);
  const stateTeams = teams.filter((t) => state.has(t.id));
  const assignedPool = new Set(teams.map((t) => baseOf(t.logo_url)).filter(Boolean));
  const poolItem = (key) => { const p = manifest.pool?.[key]; return p ? { key, thumb: `${p.base}-96.webp`, source: p.source, assigned: assignedPool.has(p.base) } : null; };
  return {
    coverage: { teams: teams.length, with_logo: withLogo.length, percent: pct(withLogo.length, teams.length), state_teams: stateTeams.length, state_with_logo: stateTeams.filter((t) => t.logo_url).length, state_percent: pct(stateTeams.filter((t) => t.logo_url).length, stateTeams.length) },
    without_logo: teams.filter((t) => !t.logo_url).map((t) => ({ team_id: t.id, slug: t.slug, school: labelSchool(t.school_name, t.city), state_2026: state.has(t.id) })).sort((a, b) => Number(b.state_2026) - Number(a.state_2026) || a.school.localeCompare(b.school)),
    review: (manifest.review || []).map((r) => ({ ...r, image: poolItem(r.pool_key) })),
    unused: (manifest.unused_pool_keys || []).map(poolItem).filter(Boolean),
    missing_files: manifest.missing_files || [],
    unconvertible: manifest.unconvertible || []
  };
}

export async function assignPoolLogo({ teamId, poolKey, actor = "Podium Watch Admin" }) {
  const pool = manifest.pool?.[String(poolKey || "")];
  if (!pool) { const e = new Error("That logo file isn't in the pool."); e.status = 400; throw e; }
  const { data: team, error } = await supabaseAdmin.from("team_pages").select("id, slug, school_name, logo_url").eq("id", String(teamId || "")).maybeSingle();
  if (error) throw error;
  if (!team) { const e = new Error("Team not found."); e.status = 404; throw e; }
  const url = `${pool.base}-256.png`;
  const { error: updateError } = await supabaseAdmin.from("team_pages").update({ logo_url: url }).eq("id", team.id);
  if (updateError) throw updateError;
  await writeTeamChange({ teamId: team.id, actorType: "admin", actorId: actor, action: "admin_logo_assigned", summary: `Logo set from ${pool.source} (Logo Review).`, changedFields: ["logo_url"], beforeData: { logo_url: team.logo_url }, afterData: { logo_url: url }, metadata: { pool_key: poolKey } });
  return { team_id: team.id, slug: team.slug, logo_url: url };
}

// Team search for the assign picker.
export async function searchTeamsForLogo(query) {
  const q = String(query || "").trim();
  if (q.length < 2) return [];
  const { data, error } = await supabaseAdmin.from("team_pages").select("id, slug, school_name, city, logo_url").ilike("school_name", `%${q}%`).is("merged_into_team_id", null).limit(12);
  if (error) throw error;
  return (data || []).map((t) => ({ team_id: t.id, slug: t.slug, school: labelSchool(t.school_name, t.city), has_logo: Boolean(t.logo_url) }));
}
