import { supabaseAdmin } from "./supabase-admin.mjs";
import { selectAll } from "./supabase_paging.mjs";
import { normalizeLookup } from "./ohio_foundation_service.mjs";
import { labelSchool } from "../src/lib/school_labels.mjs";
import { handleFromUrl, INSTAGRAM_LABELS, isInstagramLink, normalizeInstagramHandle, normalizeInstagramLabel, submitTeamInstagramHandle } from "./team_instagram_service.mjs";

// Team Instagram directory (WO-44): every team page with its division,
// approved accounts (team_social_links, labeled) and pending submissions,
// coverage, bulk add, export, and an optional Instagram Graph API lookup.

async function all(build) {
  const { data, error } = await selectAll(build, { maxRows: 20000 });
  if (error) throw error;
  return data;
}

const labelOf = (link) => (INSTAGRAM_LABELS.includes(link.label) ? link.label : "Instagram");

export async function instagramDirectory() {
  const [teams, links, pending, divisions, stateTeams] = await Promise.all([
    all(() => supabaseAdmin.from("team_pages").select("id, slug, school_name, city, ohio_school_id, published, cross_country_boys_division, cross_country_girls_division").is("merged_into_team_id", null).is("archived_at", null)),
    all(() => supabaseAdmin.from("team_social_links").select("id, team_id, platform, label, url, published")),
    all(() => supabaseAdmin.from("team_instagram_requests").select("id, team_id, handle, label, source, created_at").eq("status", "pending")),
    all(() => supabaseAdmin.from("ohio_school_divisions").select("school_id, gender, division").eq("sport", "cross_country").eq("current", true)),
    stateMeetTeamIds()
  ]);
  const divisionBySchool = new Map();
  for (const d of divisions) divisionBySchool.set(`${d.school_id}|${d.gender}`, d.division);
  const roman = (text) => String(text || "").replace(/^Division\s+/i, "D");
  const linksByTeam = new Map();
  for (const link of links) if (link.published !== false && isInstagramLink(link)) {
    const handle = handleFromUrl(link.url);
    if (!handle) continue;
    if (!linksByTeam.has(link.team_id)) linksByTeam.set(link.team_id, []);
    linksByTeam.get(link.team_id).push({ id: link.id, label: labelOf(link), handle, url: `https://www.instagram.com/${handle}/` });
  }
  const pendingByTeam = new Map();
  for (const request of pending) {
    if (!pendingByTeam.has(request.team_id)) pendingByTeam.set(request.team_id, []);
    pendingByTeam.get(request.team_id).push({ id: request.id, label: request.label || null, handle: request.handle, url: `https://www.instagram.com/${request.handle}/`, source: request.source || "public", created_at: request.created_at });
  }
  const rows = teams.map((team) => {
    const boys = team.cross_country_boys_division || divisionBySchool.get(`${team.ohio_school_id}|boys`) || null;
    const girls = team.cross_country_girls_division || divisionBySchool.get(`${team.ohio_school_id}|girls`) || null;
    const accounts = (linksByTeam.get(team.id) || []).sort((a, b) => INSTAGRAM_LABELS.indexOf(a.label) - INSTAGRAM_LABELS.indexOf(b.label));
    return {
      team_id: team.id,
      slug: team.slug,
      school: labelSchool(team.school_name, team.city),
      city: team.city,
      published: team.published !== false,
      division: [boys ? `Boys ${roman(boys)}` : null, girls ? `Girls ${roman(girls)}` : null].filter(Boolean).join(", ") || null,
      state_2026: stateTeams.has(team.id),
      accounts,
      pending: pendingByTeam.get(team.id) || []
    };
  }).sort((a, b) => a.school.localeCompare(b.school));
  const pct = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);
  const covered = rows.filter((row) => row.accounts.length);
  const state = rows.filter((row) => row.state_2026);
  return {
    labels: INSTAGRAM_LABELS,
    coverage: {
      teams: rows.length,
      with_account: covered.length,
      percent: pct(covered.length, rows.length),
      state_teams: state.length,
      state_with_account: state.filter((row) => row.accounts.length).length,
      state_percent: pct(state.filter((row) => row.accounts.length).length, state.length),
      accounts: rows.reduce((sum, row) => sum + row.accounts.length, 0),
      pending: pending.length
    },
    rows,
    graph_api_connected: graphApiConnected()
  };
}

// Team pages that ran as a team at the 2026 state meet (team scores).
async function stateMeetTeamIds() {
  const { data: meet } = await supabaseAdmin.from("meets").select("id").eq("slug", "2026-ohsaa-state-championships").maybeSingle();
  if (!meet) return new Set();
  const { data, error } = await supabaseAdmin.from("result_team_scores").select("matched_team_id").eq("meet_id", meet.id).not("matched_team_id", "is", null);
  if (error) throw error;
  return new Set((data || []).map((row) => row.matched_team_id));
}

// Bulk add: one "School, Label, @handle" per line. Each valid line becomes
// a pending request (source "bulk") for review; nothing goes live here.
// A school name shared by two team pages needs its city: "Perry (Massillon)".
export async function bulkAddInstagram(text) {
  const teams = await all(() => supabaseAdmin.from("team_pages").select("id, school_name, city").is("merged_into_team_id", null).is("archived_at", null));
  const byKey = new Map();
  const add = (key, team) => { const k = normalizeLookup(key); if (!k) return; if (!byKey.has(k)) byKey.set(k, []); if (!byKey.get(k).includes(team)) byKey.get(k).push(team); };
  for (const team of teams) {
    add(team.school_name, team);
    add(`${team.school_name} ${team.city || ""}`, team);
    add(labelSchool(team.school_name, team.city).replace(/[()]/g, " "), team);
  }
  const results = [];
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 500);
  for (const line of lines) {
    const parts = line.split(",").map((part) => part.trim());
    if (parts.length < 3) { results.push({ line, ok: false, message: "Use: School, Label, @handle" }); continue; }
    const handleRaw = parts.pop();
    const labelRaw = parts.pop();
    const schoolRaw = parts.join(", ");
    const matches = byKey.get(normalizeLookup(schoolRaw.replace(/[()]/g, " "))) || [];
    if (matches.length !== 1) { results.push({ line, ok: false, message: matches.length ? `${matches.length} schools share that name; add the city, like "${schoolRaw} (City)".` : "No team page matches that school." }); continue; }
    const label = normalizeInstagramLabel(labelRaw);
    if (!label) { results.push({ line, ok: false, message: `Label must be one of: ${INSTAGRAM_LABELS.join(", ")}.` }); continue; }
    try {
      const result = await submitTeamInstagramHandle({ teamId: matches[0].id, handleInput: handleRaw, label, source: "bulk" });
      results.push({ line, ok: true, message: result.status === "already_listed" ? "Already listed on that team." : result.status === "pending" ? "Added as pending." : result.status, school: labelSchool(matches[0].school_name, matches[0].city), handle: normalizeInstagramHandle(handleRaw), label });
    } catch (error) {
      results.push({ line, ok: false, message: error.message });
    }
  }
  return { results, added: results.filter((r) => r.ok && r.message === "Added as pending.").length, failed: results.filter((r) => !r.ok).length };
}

// Export of approved accounts for caption tagging. Never includes the
// private submitter email.
export async function instagramExportRows() {
  const directory = await instagramDirectory();
  return directory.rows.flatMap((row) => row.accounts.map((account) => ({ school: row.school, label: account.label, handle: `@${account.handle}`, url: account.url, team_slug: row.slug })));
}

export function instagramExportCsv(rows) {
  const q = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [["school", "label", "handle", "url", "team_slug"].join(","), ...rows.map((r) => [q(r.school), q(r.label), q(r.handle), q(r.url), q(r.team_slug)].join(","))].join("\n") + "\n";
}

// Optional: Instagram Graph API Business Discovery (account name and
// follower count) for admin review. Only when both variables are set;
// never used to reject, and instagram.com itself is never fetched.
//   INSTAGRAM_GRAPH_ACCESS_TOKEN, INSTAGRAM_BUSINESS_ACCOUNT_ID
export function graphApiConnected() {
  return Boolean(process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN && process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID);
}
const discoveryCache = new Map();
export async function businessDiscovery(handleInput) {
  if (!graphApiConnected()) return { connected: false };
  const handle = normalizeInstagramHandle(handleInput);
  if (!handle) return { connected: true, found: false };
  const hit = discoveryCache.get(handle);
  if (hit && Date.now() - hit.at < 6 * 60 * 60 * 1000) return hit.value;
  const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID)}?fields=${encodeURIComponent(`business_discovery.username(${handle}){name,username,followers_count}`)}&access_token=${encodeURIComponent(process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN)}`;
  let value;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const body = await response.json().catch(() => ({}));
    const found = body?.business_discovery;
    // A personal (non-business) account or a typo both come back as an
    // error here; that is "not found by the API", never a rejection.
    value = found ? { connected: true, found: true, name: found.name || null, username: found.username, followers: found.followers_count ?? null } : { connected: true, found: false };
  } catch {
    value = { connected: true, found: false, error: "Lookup failed" };
  }
  discoveryCache.set(handle, { at: Date.now(), value });
  return value;
}
