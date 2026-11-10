// Merge a duplicate ohio_schools record into the record to keep (the way
// Manchester and Middletown Christian were handled, 2026-11-09).
//
//   node --env-file=.env.local scripts/merge-duplicate-school.mjs <keep id> <duplicate id> "<reason>"           (plan)
//   node --env-file=.env.local scripts/merge-duplicate-school.mjs <keep id> <duplicate id> "<reason>" --write   (apply)
//
// Every reference to the duplicate moves to the kept school; aliases and
// divisions move unless the kept school already has the same one; the
// duplicate's name and city are kept as an alias; profiles at the kept
// school with no team get its team page; the duplicate is marked
// status = 'merged' with metadata.duplicate_of. Nothing is deleted except
// alias rows the kept school already has.
const [keepId, dupId, reason = "Duplicate school record"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const WRITE = process.argv.includes("--write");
if (!keepId || !dupId || keepId === dupId) { console.log("Usage: merge-duplicate-school.mjs <keep id> <duplicate id> \"<reason>\" [--write]"); process.exit(1); }
const { supabaseAdmin: db } = await import("../lib/supabase-admin.mjs");
const { normalizeLookup } = await import("../lib/ohio_foundation_service.mjs");
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data; };

const keep = must(await db.from("ohio_schools").select("id, ohsaa_school_id, school_name, city, status").eq("id", keepId).single(), "keep");
const dup = must(await db.from("ohio_schools").select("id, ohsaa_school_id, school_name, city, status, metadata").eq("id", dupId).single(), "duplicate");
if (keep.status === "merged") throw new Error("The school to keep is itself marked merged.");
if (dup.status === "merged") { console.log("Already merged."); process.exit(0); }
console.log(`Keep: ${keep.school_name} (${keep.city}), OHSAA ${keep.ohsaa_school_id}\nMerge: ${dup.school_name} (${dup.city}), id ${dup.ohsaa_school_id}`);

const MOVES = [
  ["athlete_profiles", "current_school_id"], ["athlete_performances", "school_id"], ["athlete_school_history", "school_id"],
  ["finish_timing_team_links", "matched_school_id"], ["ohio_data_conflicts", "school_id"], ["result_staging_row_school_resolutions", "resolved_school_id"],
  ["result_team_scores", "matched_school_id"], ["team_pages", "ohio_school_id"], ["yearly_award_finalists", "school_id"], ["yearly_award_nominations", "school_id"]
];
const moved = {};
for (const [table, column] of MOVES) {
  const { count, error } = await db.from(table).select("id", { count: "exact", head: true }).eq(column, dup.id);
  if (error) throw new Error(`${table}: ${error.message}`);
  moved[`${table}.${column}`] = count;
  if (WRITE && count) must(await db.from(table).update({ [column]: keep.id }).eq(column, dup.id), `move ${table}`);
}
console.log("References:", JSON.stringify(moved));
if (WRITE) {
  const keepAliases = new Set(must(await db.from("ohio_school_aliases").select("normalized_alias").eq("school_id", keep.id), "ka").map((a) => a.normalized_alias));
  for (const a of must(await db.from("ohio_school_aliases").select("id, normalized_alias").eq("school_id", dup.id), "da")) {
    if (keepAliases.has(a.normalized_alias)) must(await db.from("ohio_school_aliases").delete().eq("id", a.id), "dup alias");
    else { must(await db.from("ohio_school_aliases").update({ school_id: keep.id }).eq("id", a.id), "move alias"); keepAliases.add(a.normalized_alias); }
  }
  const alias = `${dup.school_name} ${dup.city}`;
  if (!keepAliases.has(normalizeLookup(alias))) must(await db.from("ohio_school_aliases").insert({ school_id: keep.id, alias, normalized_alias: normalizeLookup(alias), notes: `From a merged duplicate school record (${new Date().toISOString().slice(0, 10)})` }), "alias");
  const keepDivs = new Set(must(await db.from("ohio_school_divisions").select("sport, gender, season_start_year").eq("school_id", keep.id), "kd").map((d) => `${d.sport}|${d.gender}|${d.season_start_year}`));
  for (const d of must(await db.from("ohio_school_divisions").select("id, sport, gender, season_start_year").eq("school_id", dup.id), "dd")) {
    if (!keepDivs.has(`${d.sport}|${d.gender}|${d.season_start_year}`)) must(await db.from("ohio_school_divisions").update({ school_id: keep.id }).eq("id", d.id), "move div");
  }
  const teams = must(await db.from("team_pages").select("id").eq("ohio_school_id", keep.id).is("merged_into_team_id", null), "teams");
  if (teams.length === 1) {
    const linked = must(await db.from("athlete_profiles").update({ current_team_id: teams[0].id }).eq("current_school_id", keep.id).is("current_team_id", null).is("merged_into_profile_id", null).select("id"), "link team");
    console.log(`Profiles linked to the team page: ${linked.length}`);
  }
  must(await db.from("ohio_schools").update({ status: "merged", metadata: { ...(dup.metadata || {}), duplicate_of: keep.id, note: `${reason}; merged ${new Date().toISOString().slice(0, 10)}.` } }).eq("id", dup.id), "mark merged");
  console.log("Merged.");
} else console.log("Plan only. Add --write to apply.");
