// Checks the assembled OATCCC site preview folder. Prints counts only (never
// names or emails from the private directory).
// Usage: node --env-file=<.env.local> scripts/oatccc-site-preview/check.mjs <out dir> <repo with node_modules>
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const [, , OUT, REPO] = process.argv;
const files = [];
const walk = (d, rel = "") => { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? walk(path.join(d, e.name), rel + e.name + "/") : files.push(rel + e.name); };
walk(OUT);
const has = new Set(files);
const problems = [];
const bad = (msg) => { if (problems.length < 40) problems.push(msg); else problems.length === 40 && problems.push("..."); };
const pages = files.filter((f) => f.endsWith(".html"));
let links = 0, external = 0, notInPreview = 0;
const externalHosts = new Map();
for (const f of pages) {
  const h = fs.readFileSync(path.join(OUT, f), "utf8");
  const dir = (path.posix.dirname("/" + f) + "/").replace(/\/+$/, "/");
  if ((h.match(/<meta name="robots" content="noindex, nofollow, noarchive">/g) || []).length !== 1) bad(f + ": robots meta");
  if (/<meta name="robots"(?! content="noindex, nofollow, noarchive")/.test(h)) bad(f + ": other robots meta");
  if (!h.includes('<div class="pw-preview-banner" role="note">Preview for the OATCCC. Not live yet.')) bad(f + ": banner");
  if (/podiumwatch\.org/i.test(h.replace(/<[^>]*>/g, (t) => t).match(/(?:href|src|action|content|srcset)="[^"]*"/g)?.join(" ") || "")) bad(f + ": podiumwatch.org in an attribute");
  if (/googletagmanager|_vercel\/insights|page-view\.js|ohio-today\.js|"\/api\//.test(h)) bad(f + ": live-site script or API");
  if (/<link rel="canonical"/.test(h)) bad(f + ": canonical");
  for (const m of h.matchAll(/\s(href|src|action|poster|srcset)="([^"]*)"/g)) {
    const vals = m[1] === "srcset" ? m[2].split(",").map((s) => s.trim().split(/\s+/)[0]) : [m[2]];
    for (const v of vals) {
      if (!v || v.startsWith("#") || /^(mailto|tel|data|javascript):/i.test(v)) continue;
      if (/^https?:\/\//i.test(v) || v.startsWith("//")) { external += 1; const host = new URL(v, "https://x").host; externalHosts.set(host, (externalHosts.get(host) || 0) + 1); if (/podiumwatch\.org$/i.test(host)) bad(f + ": live link " + v); continue; }
      if (v.startsWith("/")) { bad(f + ": root-relative " + v); continue; }
      links += 1;
      const target = new URL(v, "http://x" + dir).pathname;
      if (target.endsWith("/not-in-preview/")) notInPreview += 1;
      let file = decodeURIComponent(target.slice(1));
      if (file === "" || file.endsWith("/")) file += "index.html";
      if (!has.has(file)) bad(f + ": broken " + v);
      if (file.startsWith("..")) bad(f + ": escapes the copy " + v);
    }
  }
}
// Scripts: what they still mention.
const jsNotes = {};
for (const f of files.filter((x) => x.endsWith(".js"))) {
  const js = fs.readFileSync(path.join(OUT, f), "utf8");
  const apis = [...new Set(js.match(/["'`]\/api\/[^"'`]*/g) || [])];
  if (apis.length) jsNotes[f] = apis.map((s) => s.slice(1));
}
// Private directory: no AD (or coach) name or email anywhere in the copy.
const require = createRequire(path.join(REPO, "package.json"));
const { createClient } = require("@supabase/supabase-js");
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const rows = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from("oatccc_directory_schools").select("ad_name, ad_emails, boys_xc_emails, girls_xc_emails, boys_tf_emails, girls_tf_emails").order("ohsaa_id").range(from, from + 999);
  if (error) throw error;
  rows.push(...data);
  if (data.length < 1000) break;
}
const adEmails = new Set(rows.flatMap((r) => r.ad_emails));
const coachEmails = new Set(rows.flatMap((r) => [...r.boys_xc_emails, ...r.girls_xc_emails, ...r.boys_tf_emails, ...r.girls_tf_emails]));
const adNames = new Set(rows.map((r) => (r.ad_name || "").trim().toLowerCase()).filter((n) => n.split(/\s+/).length >= 2));
const text = files.filter((f) => /\.(html|js|json|css)$/.test(f)).map((f) => [f, fs.readFileSync(path.join(OUT, f), "utf8").toLowerCase()]);
const emailHits = { ad: new Set(), coach: new Set() }, adNameHits = new Map();
const foundEmails = new Set();
for (const [f, t] of text) for (const m of t.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g)) { foundEmails.add(m[0]); if (adEmails.has(m[0])) emailHits.ad.add(f); if (coachEmails.has(m[0])) emailHits.coach.add(f); }
const plain = text.map(([f, t]) => [f, t.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")]);
for (const name of adNames) for (const [f, t] of plain) {
  const i = t.indexOf(name);
  if (i >= 0 && !/[a-z]/.test(t[i - 1] || " ") && !/[a-z]/.test(t[i + name.length] || " ")) { adNameHits.set(f, (adNameHits.get(f) || 0) + 1); }
}
console.log(JSON.stringify({
  files: files.length, pages: pages.length, relativeLinksChecked: links, toNotInPreview: notInPreview, externalLinks: external,
  externalHosts: Object.fromEntries([...externalHosts].sort((a, b) => b[1] - a[1])),
  problems,
  scriptsMentioningApi: jsNotes,
  directory: { rows: rows.length, adEmails: adEmails.size, coachEmails: coachEmails.size, adNames: adNames.size },
  emailsInCopy: foundEmails.size,
  pagesWithDirectoryAdEmail: [...emailHits.ad], pagesWithDirectoryCoachEmail: [...emailHits.coach],
  pagesWithDirectoryAdNameCount: Object.fromEntries(adNameHits)
}, null, 1));
