// Builds the redirect map for the OATCCC full site move: every oatccc.com
// page and file the crawl found, and its new podiumwatch.org address (or
// why it has none yet). No redirect is switched on anywhere; this only
// writes a list.
//
//   node scripts/oatccc-redirect-map.mjs
//
// Reads _private/oatccc-crawl/ (index.json, files.json, upload-manifest.json
// if the files were copied, hof-import-preview.json) and writes
// _private/oatccc-crawl/redirect-map.csv and redirect-map.json. Those stay
// in the ignored folder: they are the crawl's page and file list.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { oatcccFlags, MORE_SECTIONS } from "../src/oatccc/config.mjs";
import { resolveHref, storageKey, STORAGE_BUCKET, OATCCC_ORIGIN } from "../src/oatccc/more/links.mjs";
import { HOF_PATHS } from "../src/oatccc/more/registry.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CRAWL = path.join(ROOT, "_private", "oatccc-crawl");
const SITE = "https://www.podiumwatch.org";
const read = (name, fallback) => { const f = path.join(CRAWL, name); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : fallback; };

const index = read("index.json", null);
if (!index) { console.error("Run scripts/oatccc-crawl.mjs first."); process.exit(1); }
const files = read("files.json", []);
const manifest = read("upload-manifest.json", null);
const hof = read("hof-import-preview.json", { inductees: [] });

// Everything on, so the map shows where each page will live.
const allOn = oatcccFlags({ OATCCC_LIVE: "1", OATCCC_MORE_LIVE: "1", OATCCC_INDOOR_FULL_LIVE: "1", ...Object.fromEntries(Object.values(MORE_SECTIONS).map((v) => [v, "1"])) });
const bioSlug = new Map(hof.inductees.map((r) => [new URL(r.old_url).pathname.toLowerCase(), r.slug]));

// Indoor pages already on Podium Watch (oatccc-section).
const INDOOR = {
  "/indoor-track-field/high-school-state-meet/": "/oatccc/indoor/high-school/"
};
// Pages with no new home yet, and why (the "can't move yet" list).
const STAYS = [
  [/^\/$/, "oatccc.com home page: the hub /oatccc/ replaces it", "/oatccc/"],
  [/^\/site-map\/$/, "site map of oatccc.com", null],
  [/^\/contact-us\/contact-form/i, "contact form (can't move yet)", null],
  [/^\/mailing-list\//i, "mailing list sign-up (can't move yet)", null],
  [/^\/donate\//i, "donation form (can't move yet)", null],
  [/^\/about-us\/sponsors\/lend-your-support\//i, "sponsor inquiry form (can't move yet); the page text is on /oatccc/sponsors/", "/oatccc/sponsors/"],
  [/^\/awards\/coaching-longevity-form\//i, "coaching longevity page (not in the handoff's list; linked from Forms)", null],
  [/^\/privacy-policy\/$/i, "oatccc.com's own privacy policy", null],
  [/^\/website-accessibility-statement\/$/i, "oatccc.com's own accessibility statement", null],
  [/^\/news\//i, "oatccc.com news page (not in the handoff's list)", null],
  [/^\/clinics\/track-and-field\/archive\//i, "clinic archive by year (not in the handoff's list)", null],
  [/^\/indoor-track-field\/high-school-state-meet\/.+/i, "indoor sub-page (the indoor pages on Podium Watch replace it)", "/oatccc/indoor/high-school/"]
];

const rows = [];
for (const page of index.pages) {
  const oldUrl = `${OATCCC_ORIGIN}${page.path}`;
  const lower = page.path.toLowerCase();
  let to = null;
  let note = "";
  const slug = bioSlug.get(lower);
  if (slug) to = `${HOF_PATHS.hof}${slug}/`;
  else if (INDOOR[lower]) to = INDOOR[lower];
  else {
    const resolved = resolveHref(oldUrl, allOn, {});
    if (resolved !== oldUrl) to = resolved;
  }
  // Section index addresses (/Awards/, /Clinics/, /Media/...) and old
  // archive pages just send people to the oatccc.com home page today.
  const toHome = page.finalUrl && new URL(page.finalUrl).pathname === "/" && page.path !== "/";
  if (!to && toHome) { to = "/oatccc/"; note = "oatccc.com sends this address to its home page today"; }
  if (!to && /\/Register\/$/i.test(page.path)) note = "clinic registration and payment (can't move yet; stays on oatccc.com)";
  if (!to) {
    const stay = STAYS.find(([re]) => re.test(page.path));
    if (stay) { note = note || stay[1]; to = stay[2]; }
    else note = note || "no page for it in the handoff's list";
  }
  if (/^\/HOF\/View-Bio\//i.test(page.path) && !slug) note = "Hall of Fame bio not in the inductee list (see the import preview)";
  rows.push({ type: "page", old: oldUrl, new: to ? `${SITE}${to}` : "", note: note || (page.flags?.forms ? "page has a form on oatccc.com; the form itself does not move" : "") });
}
const uploaded = new Map((manifest?.files || []).map((f) => [f.oldUrl, f]));
for (const f of files) {
  const key = storageKey(f.path);
  const up = uploaded.get(f.url);
  rows.push({
    type: "file",
    old: f.url,
    new: up?.publicUrl || `{SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${encodeURI(key)}`,
    note: up ? "" : (f.status && f.status >= 400 ? `broken on oatccc.com (${f.status}); not copied` : (manifest ? "not copied" : "address once the files are copied"))
  });
}

const csv = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
fs.writeFileSync(path.join(CRAWL, "redirect-map.csv"), ["type,old_url,new_url,note", ...rows.map((r) => [r.type, r.old, r.new, r.note].map(csv).join(","))].join("\n") + "\n");
fs.writeFileSync(path.join(CRAWL, "redirect-map.json"), JSON.stringify(rows, null, 1));
const summary = {
  pages: rows.filter((r) => r.type === "page").length,
  pagesWithNewHome: rows.filter((r) => r.type === "page" && r.new).length,
  pagesWithout: rows.filter((r) => r.type === "page" && !r.new).map((r) => `${r.old}  (${r.note})`),
  files: rows.filter((r) => r.type === "file").length
};
fs.writeFileSync(path.join(CRAWL, "redirect-map-summary.json"), JSON.stringify(summary, null, 1));
console.log(JSON.stringify({ ...summary, pagesWithout: summary.pagesWithout.length }, null, 1));
for (const line of summary.pagesWithout) console.log(`  ${line}`);
