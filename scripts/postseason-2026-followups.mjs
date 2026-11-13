// WO-05 follow-ups approved by Zachary on 2026-11-09 (second fixes list).
//
//   node --env-file=.env.local scripts/postseason-2026-followups.mjs           (plan only)
//   node --env-file=.env.local scripts/postseason-2026-followups.mjs --write   (applies)
//
// Then rerun scripts/postseason-2026-import.mjs --write to import the
// runners these unblock. Safe to rerun.
//
// 1. Middletown Christian is in ohio_schools twice: keep the official
//    record (OHSAA 1027, team page, division) and fold the duplicate into
//    it, moving every reference, like Manchester.
// 2. "Ak. Garfield" = Garfield (Akron), already in the table as Garfield
//    Community Learning Center. Both spellings saved as aliases.
// 3. "F.F. Green" = Green (Franklin Furnace): searched by city first; added
//    only if missing, with the girls division it ran in. Both spellings
//    saved as aliases.
// 4. Perry (Perry), Lake County: girls Division III row (the import maps
//    "Perry" in girls D3 at the Madison district and Boardman regional to it).
// 5. 23 similar-name pairs: same runner. Safety checks first: not when both
//    names are in the same race, and not when the official row's
//    Athletic.net id differs from the profile's. Display name: Zachary's
//    overrides win, otherwise the official postseason spelling; the other
//    spelling stays as an alias. Parenthetical nicknames come out of the
//    display name and stay as an alias.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WRITE = process.argv.includes("--write");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { supabaseAdmin: db } = await import("../lib/supabase-admin.mjs");
const { normalizeLookup } = await import("../lib/ohio_foundation_service.mjs");
const { default: readXlsx } = await import("read-excel-file/node");
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data; };
const report = { wrote: WRITE, schools: [], pairs: { attached: [], sent_back: [] } };
const say = (line) => console.log(line);
const ACTOR = "Podium Watch (approved by Zachary, 2026-11-09)";

async function schoolBy(name, city) {
  const rows = must(await db.from("ohio_schools").select("id, school_name, city, status, metadata").ilike("school_name", name).ilike("city", city).neq("status", "merged"), `find ${name}`);
  if (rows.length > 1) throw new Error(`${name} (${city}) matches ${rows.length} schools`);
  return rows[0] || null;
}
async function addSchoolAlias(schoolId, alias, note) {
  const normalized = normalizeLookup(alias);
  const has = must(await db.from("ohio_school_aliases").select("id").eq("school_id", schoolId).eq("normalized_alias", normalized), "alias check");
  if (has.length) return false;
  if (WRITE) must(await db.from("ohio_school_aliases").insert({ school_id: schoolId, alias, normalized_alias: normalized, notes: note }), `alias ${alias}`);
  return true;
}

// ---------- 1. Middletown Christian ----------
{
  const all = must(await db.from("ohio_schools").select("id, ohsaa_school_id, school_name, city, status, metadata").ilike("school_name", "Middletown Christian"), "mc");
  const keep = all.find((s) => String(s.ohsaa_school_id) === "1027" && s.status !== "merged");
  const dups = all.filter((s) => s !== keep && s.status !== "merged");
  if (!keep) throw new Error("Official Middletown Christian (OHSAA 1027) not found");
  for (const dup of dups) {
    const moves = [
      ["athlete_profiles", "current_school_id"], ["athlete_performances", "school_id"], ["athlete_school_history", "school_id"],
      ["finish_timing_team_links", "matched_school_id"], ["ohio_data_conflicts", "school_id"], ["result_staging_row_school_resolutions", "resolved_school_id"],
      ["result_team_scores", "matched_school_id"], ["team_pages", "ohio_school_id"], ["yearly_award_finalists", "school_id"], ["yearly_award_nominations", "school_id"]
    ];
    const moved = {};
    for (const [table, column] of moves) {
      const { count, error } = await db.from(table).select("id", { count: "exact", head: true }).eq(column, dup.id);
      if (error) throw new Error(`${table}: ${error.message}`);
      moved[`${table}.${column}`] = count;
      if (WRITE && count) must(await db.from(table).update({ [column]: keep.id }).eq(column, dup.id), `move ${table}`);
    }
    // Aliases and divisions: move unless the kept school already has the same one.
    const keepAliases = new Set(must(await db.from("ohio_school_aliases").select("normalized_alias").eq("school_id", keep.id), "ka").map((a) => a.normalized_alias));
    for (const a of must(await db.from("ohio_school_aliases").select("id, normalized_alias").eq("school_id", dup.id), "da")) {
      if (!WRITE) continue;
      if (keepAliases.has(a.normalized_alias)) must(await db.from("ohio_school_aliases").delete().eq("id", a.id), "dup alias");
      else must(await db.from("ohio_school_aliases").update({ school_id: keep.id }).eq("id", a.id), "move alias");
    }
    const keepDivs = new Set(must(await db.from("ohio_school_divisions").select("sport, gender, season_start_year").eq("school_id", keep.id), "kd").map((d) => `${d.sport}|${d.gender}|${d.season_start_year}`));
    for (const d of must(await db.from("ohio_school_divisions").select("id, sport, gender, season_start_year").eq("school_id", dup.id), "dd")) {
      if (WRITE && !keepDivs.has(`${d.sport}|${d.gender}|${d.season_start_year}`)) must(await db.from("ohio_school_divisions").update({ school_id: keep.id }).eq("id", d.id), "move div");
    }
    // Keep the duplicate's spelling and city findable.
    await addSchoolAlias(keep.id, `${dup.school_name} ${dup.city}`, "From a merged duplicate school record (2026-11-09)");
    if (WRITE) must(await db.from("ohio_schools").update({ status: "merged", metadata: { ...dup.metadata, duplicate_of: keep.id, note: `Same school as Middletown Christian (OHSAA ${keep.ohsaa_school_id}); merged 2026-11-09.` } }).eq("id", dup.id), "mark merged");
    report.schools.push({ middletown_christian: { kept: `${keep.school_name} (${keep.city}), OHSAA ${keep.ohsaa_school_id}, id ${keep.id}`, merged: `${dup.school_name} (${dup.city}), id ${dup.ohsaa_school_id}, id ${dup.id}`, moved } });
    say(`Middletown Christian: keep OHSAA ${keep.ohsaa_school_id} (${keep.id.slice(0, 8)}), merge ${dup.ohsaa_school_id} (${dup.id.slice(0, 8)}): ${JSON.stringify(moved)}`);
  }
  if (!dups.length) say("Middletown Christian: already one record");
}

// ---------- 2. Garfield (Akron) ----------
{
  const s = await schoolBy("Garfield Community Learning Center", "Akron");
  if (!s) throw new Error("Garfield (Akron) not found");
  const added = [await addSchoolAlias(s.id, "Ak. Garfield", "2026 postseason results spelling (approved 2026-11-09)"), await addSchoolAlias(s.id, "Garfield (Akron)", "Approved 2026-11-09")];
  report.schools.push({ garfield: `${s.school_name} (${s.city}) existing; aliases added: ${added.filter(Boolean).length}` });
  say(`Garfield: existing ${s.school_name} (${s.city}); ${added.filter(Boolean).length} aliases`);
}

// ---------- 3. Green (Franklin Furnace) ----------
{
  let s = await schoolBy("Green", "Franklin Furnace");
  const found = Boolean(s);
  if (!s) {
    const record = { school_name: "Green", normalized_name: normalizeLookup("Green"), city: "Franklin Furnace", normalized_city: normalizeLookup("Franklin Furnace"), status: "active", program_level: "high_school", metadata: { added_from: "2026 OHSAA cross country postseason results", approved_by: "Zachary Bell", approved_on: "2026-11-09" } };
    s = WRITE ? must(await db.from("ohio_schools").insert(record).select("id, school_name, city").single(), "add Green") : { ...record, id: "new" };
    // The division it ran in: girls Division IV (Rio Grande district, F.F. Green).
    if (WRITE) must(await db.from("ohio_school_divisions").insert({ school_id: s.id, sport: "cross_country", gender: "girls", season_start_year: 2026, season_end_year: 2027, season_label: "2026-27", division: "Division IV", official: true, current: true, metadata: { source: "2026 OHSAA cross country postseason results (division the team ran in)" } }), "Green division");
  }
  if (s.id !== "new") { await addSchoolAlias(s.id, "F.F. Green", "2026 postseason results spelling (approved 2026-11-09)"); await addSchoolAlias(s.id, "Green (Franklin Furnace)", "Approved 2026-11-09"); }
  report.schools.push({ green: `${found ? "existing" : "added"} Green (Franklin Furnace)` });
  say(`Green (Franklin Furnace): ${found ? "already in the table" : "added, girls Division IV"}`);
}

// ---------- 4. Perry (Perry) girls Division III ----------
{
  const s = await schoolBy("Perry", "Perry");
  const has = must(await db.from("ohio_school_divisions").select("id, division").eq("school_id", s.id).eq("sport", "cross_country").eq("gender", "girls"), "perry div");
  if (!has.length && WRITE) must(await db.from("ohio_school_divisions").insert({ school_id: s.id, sport: "cross_country", gender: "girls", season_start_year: 2026, season_end_year: 2027, season_label: "2026-27", division: "Division III", official: true, current: true, metadata: { source: "2026 OHSAA postseason results: Perry girls ran Division III at the Madison district and Boardman regional (confirmed by Zachary 2026-11-09)" } }), "perry girls div");
  report.schools.push({ perry: has.length ? `girls division already ${has[0].division}` : "girls Division III added" });
  say(`Perry (Perry): ${has.length ? `girls already ${has[0].division}` : "girls Division III added"}`);
}

// ---------- 5. Similar-name pairs ----------
const PAIRS = [
  ["Andy Husk", "Carrollton", "andrew-husk-2028"],
  ["Kaleigh Herring", "Martins Ferry", "kayleigh-herring-2029"],
  ["Joshua Johnson", "Bellbrook", "josh-johnson-bellbrook-2027"],
  ["Micah DeMarco", "Bluffton", "micah-dimarco-2029"],
  ["Travis Hamass", "Danbury", "travis-hamas-2029"],
  ["Blake Hamons", "Monroeville", "blake-hammons-2029"],
  ["Frank Sisson", "Norton", "franklin-sisson-2028"],
  ["Elisa (Ellie) Quernemoen", null, "elisa-quernemoen-2029"],
  ["Maddie Sellers", "Akron SVSM", "madelyn-sellers-2029"],
  ["Maya Carreno", "Girard", "maya-cerreno-2029"],
  ["Kaylee O'Neill", "Whetstone", "kaylee-o-neil-whetstone-2029"],
  ["Luke Nofziger", null, "luke-nofzinger-2029"],
  ["Elise Marullo", "Smithville", "elisa-marullo-2030"],
  ["Alexander Franklin", "Hicksville", "alex-franklin-hicksville-2027"],
  ["Elliot Vincek", "Cardinal", "eliot-vincek-2029"],
  ["Gio Noascono", "Riverdale", "giovanni-noascono-riverdale-2029"],
  ["Gabriella Jones", "Calvert", "gabbi-jones-2029"],
  ["Tristen Bales", "West Union", "tristan-bales-2027"],
  ["Zach Mocadlo", "Euclid", "zachary-mocadlo-2028"],
  ["Payton Matheny", "Stebbins", "payton-matheney-2028"],
  ["Braylee Coffey", null, "braylee-coffee-madison-senior-2030"],
  ["Izabella Ayres", "Bethel", "izabella-ayers-bethel-2028"],
  ["Timothy Horner", "Mohawk", "timmy-horner-2029"]
].filter(Boolean);
if (PAIRS.length !== 23) throw new Error(`expected 23 pairs, have ${PAIRS.length}`);

// Every official row for these names, by race.
const parseClock = (t) => { const m = String(t || "").match(/^(\d+):(\d{2}(?:\.\d+)?)$/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const races = [];
const districts = JSON.parse(fs.readFileSync(path.join(root, "dataimports/real_district_results_2026/real_district_results_2026_parsed.json"), "utf8"));
for (const r of districts.races) races.push({ key: `district ${r.siteKey} ${r.gender} D${r.division}`, meetLike: "District", date: "2026-10-24", rows: r.individualResults.map((x) => ({ name: x.name, school: x.school, place: x.place })) });
const regionals = JSON.parse(fs.readFileSync(path.join(root, "dataimports/real_regional_results_2026/real_regional_results_2026_parsed.json"), "utf8"));
for (const r of regionals.races) races.push({ key: `regional ${r.site} ${r.gender} D${r.division}`, meetLike: "Regional", date: "2026-10-31", rows: r.results.map((x) => ({ name: x.name, school: x.schoolFull || x.school, place: x.place, athleticNetId: x.athleticNetId ? String(x.athleticNetId) : null })) });
for (const { sheet, data } of await readXlsx(path.join(root, "dataimports/2026_Ohio_XC_State_Meet_Results_and_Bibs.xlsx"))) {
  const m = sheet.match(/^D([1-4]) (Girls|Boys)$/); if (!m) continue;
  const h = data[0];
  races.push({ key: `state ${m[2].toLowerCase()} D${m[1]}`, meetLike: "State", date: "2026-11-07", rows: data.slice(1).filter((r) => r[h.indexOf("Athlete")]).map((r) => ({ name: r[h.indexOf("Athlete")], school: r[h.indexOf("School")], place: r[h.indexOf("Place")] })) });
}
const overrides = JSON.parse(fs.readFileSync(path.join(root, "src/data/mock-postseason-name-overrides-2026.json"), "utf8"));
const squash = (n) => normalizeLookup(n).replace(/[^a-z]/g, "");

for (const [officialName, schoolHint, slug] of PAIRS) {
  const p = must(await db.from("athlete_profiles").select("id, slug, display_name, first_name, last_name, merged_into_profile_id").eq("slug", slug).single(), slug);
  if (p.merged_into_profile_id) { report.pairs.sent_back.push(`${officialName} -> ${slug}: profile is merged`); continue; }
  const aliases = must(await db.from("athlete_profile_aliases").select("alias, normalized_alias, alias_type").eq("profile_id", p.id), "aliases");
  const profileIds = aliases.filter((a) => a.alias_type === "external_id").map((a) => (a.alias.match(/athlete\/(\d+)/) || [])[1]).filter(Boolean);
  const existingNames = new Set([p.display_name, ...aliases.filter((a) => a.alias_type === "name").map((a) => a.alias)].map(squash));
  const officialRows = [];
  const problems = [];
  for (const race of races) {
    const mine = race.rows.filter((r) => normalizeLookup(r.name) === normalizeLookup(officialName) && (!schoolHint || r.school === schoolHint || normalizeLookup(r.school).includes(normalizeLookup(schoolHint))));
    if (!mine.length) continue;
    officialRows.push(...mine.map((r) => ({ ...r, race: race.key })));
    // Check 1: the other spelling in the same race.
    const other = race.rows.filter((r) => !mine.includes(r) && existingNames.has(squash(r.name)));
    if (other.length) problems.push(`both names in ${race.key} (${other.map((o) => `${o.place} ${o.name}`).join(", ")})`);
  }
  // Check 1b: the existing profile already has a result in a race this runner ran.
  const theirs = must(await db.from("athlete_performances").select("meet_name, meet_date, place").eq("profile_id", p.id).in("meet_date", ["2026-10-24", "2026-10-31", "2026-11-07"]), "theirs");
  for (const t of theirs) if (officialRows.some((r) => race_date(r.race) === t.meet_date)) problems.push(`profile already has ${t.meet_name} place ${t.place}`);
  // Check 2: Athletic.net ids.
  for (const r of officialRows) if (r.athleticNetId && profileIds.length && !profileIds.includes(r.athleticNetId)) problems.push(`Athletic.net id ${r.athleticNetId} in ${r.race}; profile has ${profileIds.join("/")}`);
  if (!officialRows.length) problems.push("no official row found");
  if (problems.length) { report.pairs.sent_back.push(`${officialName} -> ${slug}: ${problems.join("; ")}`); continue; }

  // Display name: override, else official spelling with any (nickname) removed.
  const override = Object.entries(overrides).find(([k]) => normalizeLookup(k.split("|")[0]) === normalizeLookup(officialName))?.[1];
  const nickname = (officialName.match(/\(([^)]+)\)/) || [])[1] || null;
  const display = (override || officialName.replace(/\s*\([^)]*\)\s*/g, " ")).replace(/\s+/g, " ").trim();
  const parts = display.split(" ");
  const newAliases = new Set();
  if (normalizeLookup(p.display_name) !== normalizeLookup(display)) newAliases.add(p.display_name);
  if (normalizeLookup(officialName) !== normalizeLookup(display)) newAliases.add(officialName); // source spelling, so the import matches it
  if (nickname) newAliases.add(`${nickname} ${parts.slice(1).join(" ")}`);
  if (WRITE) {
    for (const alias of newAliases) {
      const n = normalizeLookup(alias);
      if (!aliases.some((a) => a.normalized_alias === n)) must(await db.from("athlete_profile_aliases").insert({ profile_id: p.id, alias, normalized_alias: n, alias_type: "name", notes: "Name spelling kept when attaching 2026 postseason results (approved 2026-11-09)" }), `alias ${alias}`);
    }
    must(await db.from("athlete_profiles").update({ display_name: display, normalized_name: normalizeLookup(display), first_name: parts[0], last_name: parts.slice(1).join(" ") || parts[0], updated_by: ACTOR }).eq("id", p.id), "rename");
  }
  report.pairs.attached.push(`${officialName} -> ${slug}: display "${display}"${newAliases.size ? `, aliases ${[...newAliases].map((a) => `"${a}"`).join(", ")}` : ""} (${officialRows.length} official rows)`);
}
function race_date(key) { return key.startsWith("district") ? "2026-10-24" : key.startsWith("regional") ? "2026-10-31" : "2026-11-07"; }

say(`Pairs: ${report.pairs.attached.length} ${WRITE ? "attached" : "to attach"}, ${report.pairs.sent_back.length} sent back`);
for (const x of report.pairs.attached) say(`  + ${x}`);
for (const x of report.pairs.sent_back) say(`  ! ${x}`);
fs.writeFileSync(path.join(root, "dataimports/postseason_2026_to_results", WRITE ? "followups_result.json" : "followups_plan.json"), JSON.stringify(report, null, 2));
