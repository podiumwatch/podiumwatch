// Loads the OATCCC Hall of Fame and award recipients from the crawl
// (_private/oatccc-crawl/, made by scripts/oatccc-crawl.mjs) into the tables
// of install/103_OATCCC_HALL_OF_FAME.sql.
//
// NOT RUN. Zachary runs it after migration 103:
//   node scripts/import-oatccc-hall-of-fame.mjs            dry run (default)
//   node --env-file=.env.local scripts/import-oatccc-hall-of-fame.mjs --apply
//
// The dry run writes _private/oatccc-crawl/hof-import-preview.json (every
// row) and prints every problem found. --apply upserts with the server
// secret key: inductees by old_url, awards by key, recipients by
// (award, position). It never deletes rows.
//
// Award recipients are linked to an inductee when the award page links to
// that inductee's bio (Ed Barker), or when exactly one inductee has the
// very same name (listed in the preview as "linked by name" so the OATCCC
// can check them).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildInductees, awardIntro, parseAwardRecipients } from "../lib/oatccc_hof.mjs";
import { AWARD_PAGES } from "../src/oatccc/more/registry.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CRAWL = path.join(ROOT, "_private", "oatccc-crawl");
const PAGES = path.join(CRAWL, "pages");
const apply = process.argv.includes("--apply");

const KIND = { "ed-barker": "tiles", "coaches-of-the-year": "cards", "fred-dafler": "table", sei: "table", "middle-school-state": "cards" };
const slugFor = (p) => p.replace(/^\/+|\/+$/g, "").replace(/[^A-Za-z0-9._-]+/g, "__");
const read = (p) => { const f = path.join(PAGES, `${slugFor(p)}.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null; };

const listPage = read("/HOF/");
if (!listPage) { console.error("No crawl of /HOF/ found. Run scripts/oatccc-crawl.mjs first."); process.exit(1); }
const bioPages = fs.readdirSync(PAGES).filter((f) => /^HOF__View-Bio__.+\.json$/.test(f)).map((f) => JSON.parse(fs.readFileSync(path.join(PAGES, f), "utf8")));
const { rows: inductees, problems } = buildInductees(listPage, bioPages);

const byUrl = new Map(inductees.map((r) => [r.old_url.toLowerCase(), r]));
const byName = new Map();
for (const r of inductees) byName.set(r.name.toLowerCase(), [...(byName.get(r.name.toLowerCase()) || []), r]);

const awards = [];
const recipients = [];
const linkedByName = [];
AWARD_PAGES.forEach((award, i) => {
  const page = read(award.old);
  if (!page) { problems.push(`Award page not crawled: ${award.old}`); return; }
  awards.push({ key: award.key, slug: award.slug, title: award.title, intro_html: awardIntro(page, KIND[award.key]), old_url: page.url, sort: i + 1 });
  for (const r of parseAwardRecipients(page, KIND[award.key])) {
    let inductee = r.old_url ? byUrl.get(r.old_url.toLowerCase()) : null;
    if (!inductee) {
      const same = byName.get(r.name.toLowerCase()) || [];
      if (same.length === 1) { inductee = same[0]; linkedByName.push(`${award.title}: ${r.name} (${r.year_label || ""}) -> ${same[0].slug}`); }
    }
    recipients.push({ award_key: award.key, ...r, inductee_slug: inductee?.slug || null });
  }
});

const preview = { generatedAt: new Date().toISOString(), counts: { inductees: inductees.length, edBarker: inductees.filter((r) => r.ed_barker_recipient).length, withPhoto: inductees.filter((r) => r.photo_path).length, emptyBio: inductees.filter((r) => !r.bio).length, awards: awards.length, recipients: recipients.length }, problems, linkedByName, inductees, awards, recipients };
fs.writeFileSync(path.join(CRAWL, "hof-import-preview.json"), JSON.stringify(preview, null, 1));
console.log(JSON.stringify(preview.counts));
console.log(`Problems (${problems.length}):`);
for (const p of problems) console.log(`  ${p}`);
console.log(`Linked to an inductee by exact name (${linkedByName.length}); check these.`);

if (!apply) {
  console.log("Dry run: nothing written. Preview: _private/oatccc-crawl/hof-import-preview.json. Add --apply after migration 103 (Zachary's OK).");
  process.exit(0);
}

const { supabaseAdmin } = await import("../lib/supabase-admin.mjs");
const chunks = (items, n) => Array.from({ length: Math.ceil(items.length / n) }, (_, i) => items.slice(i * n, i * n + n));
for (const batch of chunks(inductees, 200)) {
  const { error } = await supabaseAdmin.from("oatccc_hof_inductees").upsert(batch.map((r) => ({ ...r, updated_at: new Date().toISOString() })), { onConflict: "old_url" });
  if (error) throw new Error(`Inductees: ${error.message}`);
}
const { data: ids, error: idError } = await supabaseAdmin.from("oatccc_hof_inductees").select("id, slug").range(0, 4999);
if (idError) throw new Error(`Inductee ids: ${idError.message}`);
const idBySlug = new Map(ids.map((r) => [r.slug, r.id]));
const { error: awardError } = await supabaseAdmin.from("oatccc_awards").upsert(awards.map((a) => ({ ...a, updated_at: new Date().toISOString() })), { onConflict: "key" });
if (awardError) throw new Error(`Awards: ${awardError.message}`);
for (const batch of chunks(recipients, 200)) {
  const rows = batch.map(({ inductee_slug, ...r }) => ({ ...r, inductee_id: inductee_slug ? idBySlug.get(inductee_slug) || null : null, updated_at: new Date().toISOString() }));
  const { error } = await supabaseAdmin.from("oatccc_award_recipients").upsert(rows, { onConflict: "award_key,position" });
  if (error) throw new Error(`Recipients: ${error.message}`);
}
console.log(`Loaded ${inductees.length} inductees, ${awards.length} awards, ${recipients.length} recipients.`);
