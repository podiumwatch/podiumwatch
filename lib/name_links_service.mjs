import { buildLinkIndex, resolveLinks } from "./name_links.mjs";
import { selectAll } from "./supabase_paging.mjs";
import aliasFile from "../src/data/awards-2026-school-aliases.json" with { type: "json" };
import nameAliasFile from "../src/data/school-name-aliases.json" with { type: "json" };

// Loads the name -> page index (lib/name_links.mjs) for /api/links/.
// Rebuilt at most every 15 minutes per server instance, through the
// connection-capped client; if a rebuild fails the previous index keeps
// answering, and with no index at all nothing is linked (pages still work).
// The endpoint is CDN cached, so most page views never reach this.

const INDEX_MS = 15 * 60_000;
let cached = null; // { at, index }
let loading = null;

async function loadIndex() {
  const { supabasePublicPages: db } = await import("./supabase-admin.mjs");
  const [teams, schools, athletes] = await Promise.all([
    selectAll(() => db.from("team_pages").select("id, slug, ohio_school_id").eq("published", true).not("suspended", "is", true).is("archived_at", null).is("merged_into_team_id", null)),
    selectAll(() => db.from("ohio_schools").select("id, school_name, city")),
    selectAll(() => db.from("athlete_profiles").select("id, slug, display_name, current_school_id").eq("public_visible", true).not("suspended", "is", true).is("archived_at", null).is("merged_into_profile_id", null), { maxRows: 100000 })
  ]);
  for (const result of [teams, schools, athletes]) if (result.error) throw result.error;
  const toMap = (file) => Object.entries(file.aliases || {}).map(([label, value]) => [label, value.school_id]).filter(([, id]) => id);
  const aliases = Object.fromEntries([...toMap(aliasFile), ...toMap(nameAliasFile)]);
  return buildLinkIndex({ teams: teams.data, schools: schools.data, athletes: athletes.data, aliases, divisionAliases: nameAliasFile.division_aliases || [] });
}

export async function linkIndex() {
  if (cached && Date.now() - cached.at < INDEX_MS) return cached.index;
  if (!loading) {
    loading = loadIndex()
      .then((index) => { cached = { at: Date.now(), index }; return index; })
      .catch((error) => {
        console.error("Name link index error:", error?.message || error);
        if (cached) { cached.at = Date.now() - INDEX_MS + 60_000; return cached.index; } // retry in a minute
        throw error;
      })
      .finally(() => { loading = null; });
  }
  return loading;
}

export async function resolveNames(request) {
  return resolveLinks(await linkIndex(), request);
}
