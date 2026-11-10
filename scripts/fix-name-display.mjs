// Name display fixes (Zachary, 2026-11-09). Rules: src/lib/display_names.mjs.
//
//   node --env-file=.env.local scripts/fix-name-display.mjs           (plan only)
//   node --env-file=.env.local scripts/fix-name-display.mjs --write   (applies)
//
// 1. Athlete profiles: display name (and first/last name) fixed for
//    lowercase Mc surnames, O' names, ALL CAPS and parenthetical
//    nicknames. The old spelling and the nickname ("Lily Kiser") are kept
//    as name aliases so search and imports still find the runner.
// 2. Team pages: school_name in the one style (no "High School"/"School").
//    The official record in ohio_schools is not changed.
// 3. Writes src/data/ambiguous-school-names.json: school names shared by
//    more than one Ohio school, so pages add the city ("Highland (Medina)").
// Safe to rerun. Test profiles (name contains "TEST" and "DELETE ME") are
// skipped and listed.
import fs from "node:fs";
import path from "node:path";

const WRITE = process.argv.includes("--write");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const { supabaseAdmin: db } = await import("../lib/supabase-admin.mjs");
const { selectAll } = await import("../lib/supabase_paging.mjs");
const { normalizeLookup } = await import("../lib/ohio_foundation_service.mjs");
const { personDisplayName, nicknameAlias, schoolBaseName, schoolKey } = await import("../src/lib/display_names.mjs");
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data; };
const all = async (build) => { const { data, error } = await selectAll(build, { maxRows: 50000 }); if (error) throw error; return data; };

// 1. Profiles
const profiles = await all(() => db.from("athlete_profiles").select("id, slug, display_name, first_name, last_name").is("merged_into_profile_id", null).is("archived_at", null));
const aliases = await all(() => db.from("athlete_profile_aliases").select("profile_id, normalized_alias"));
const hasAlias = new Set(aliases.map((a) => `${a.profile_id}|${a.normalized_alias}`));
const changes = [];
const skipped = [];
for (const p of profiles) {
  if (/TEST/.test(p.display_name) && /DELETE ME/i.test(p.display_name)) { skipped.push(`${p.slug}: ${p.display_name}`); continue; }
  const next = personDisplayName(p.display_name);
  if (next === p.display_name) continue;
  const parts = next.split(" ");
  const newAliases = [p.display_name, nicknameAlias(p.display_name)].filter(Boolean).filter((a) => normalizeLookup(a) !== normalizeLookup(next));
  changes.push({ p, next, first: parts[0], last: parts.slice(1).join(" ") || parts[0], newAliases });
}
console.log(`Profiles: ${changes.length} to fix; ${skipped.length} test profiles skipped`);
for (const c of changes) console.log(`  ${c.p.display_name} -> ${c.next}${c.newAliases.length ? `  (aliases: ${c.newAliases.join(", ")})` : ""}`);
if (WRITE) for (const c of changes) {
  must(await db.from("athlete_profiles").update({ display_name: c.next, normalized_name: normalizeLookup(c.next), first_name: c.first, last_name: c.last, updated_by: "Podium Watch (name display fix, 2026-11-09)" }).eq("id", c.p.id), `profile ${c.p.slug}`);
  for (const alias of c.newAliases) {
    const n = normalizeLookup(alias);
    if (hasAlias.has(`${c.p.id}|${n}`)) continue;
    must(await db.from("athlete_profile_aliases").insert({ profile_id: c.p.id, alias, normalized_alias: n, alias_type: "name", notes: "Earlier display spelling or nickname, kept when the display name was fixed (2026-11-09)" }), `alias ${alias}`);
    hasAlias.add(`${c.p.id}|${n}`);
  }
}

// 2. Team pages
const teams = await all(() => db.from("team_pages").select("id, slug, school_name").is("merged_into_team_id", null));
const teamChanges = teams.map((t) => ({ t, next: schoolBaseName(t.school_name) })).filter((x) => x.next !== x.t.school_name);
console.log(`Team pages: ${teamChanges.length} to fix`);
for (const x of teamChanges) console.log(`  ${x.t.school_name} -> ${x.next}`);
if (WRITE) for (const x of teamChanges) must(await db.from("team_pages").update({ school_name: x.next }).eq("id", x.t.id), `team ${x.t.slug}`);

// 3. Shared school names
const schools = await all(() => db.from("ohio_schools").select("id, school_name, city, status").neq("status", "merged"));
// Shared only when the cities differ: two records in one city are a
// duplicate record, and a city would not tell them apart.
const cities = new Map();
for (const s of schools) { const k = schoolKey(s.school_name); if (!cities.has(k)) cities.set(k, new Set()); cities.get(k).add(normalizeLookup(s.city)); }
const ambiguous = [...cities].filter(([, set]) => set.size > 1).map(([k]) => k).sort();
const sameCityDuplicates = schools.filter((s, i) => schools.findIndex((o) => schoolKey(o.school_name) === schoolKey(s.school_name) && normalizeLookup(o.city) === normalizeLookup(s.city)) !== i).map((s) => `${s.school_name} (${s.city})`);
if (sameCityDuplicates.length) console.log(`Possible duplicate school records (same name and city): ${sameCityDuplicates.join("; ")}`);
console.log(`Shared school names: ${ambiguous.length} (${ambiguous.slice(0, 12).join(", ")}${ambiguous.length > 12 ? ", ..." : ""})`);
if (WRITE) fs.writeFileSync(path.join(root, "src/data/ambiguous-school-names.json"), JSON.stringify({ note: "School names shared by more than one Ohio school; pages add the city. Written by scripts/fix-name-display.mjs.", generated_at: new Date().toISOString(), names: ambiguous }, null, 2) + "\n");
