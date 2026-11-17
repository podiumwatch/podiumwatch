// Checks every link on the OATCCC full-site pages (src/oatccc/more/content/
// and the award intros in the Hall of Fame import preview) and writes
// _private/oatccc-crawl/link-check.json. oatccc.com addresses are checked
// against the crawl (index.json / files.json) instead of fetched again;
// everything else is fetched once (HEAD, then GET if HEAD is refused).
//
//   node scripts/oatccc-check-links.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CRAWL = path.join(ROOT, "_private", "oatccc-crawl");
const CONTENT = path.join(ROOT, "src", "oatccc", "more", "content");
const UA = "Mozilla/5.0 (compatible; link-check/1.0)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const read = (name, fallback) => { const f = path.join(CRAWL, name); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : fallback; };

const links = new Map();
const add = (href, where) => {
  if (!/^https?:/i.test(href)) { if (/^mailto:/i.test(href)) return; }
  const list = links.get(href) || [];
  if (!list.includes(where)) list.push(where);
  links.set(href, list);
};
for (const file of fs.readdirSync(CONTENT).filter((f) => f.endsWith(".html"))) {
  const html = fs.readFileSync(path.join(CONTENT, file), "utf8");
  for (const m of html.matchAll(/<(?:a|img|iframe) (?:href|src)="([^"]+)"/g)) add(m[1].replace(/&amp;/g, "&"), file.replace(/\.html$/, ""));
}
const hof = read("hof-import-preview.json", { awards: [] });
for (const award of hof.awards) for (const m of award.intro_html.matchAll(/<a href="([^"]+)"/g)) add(m[1].replace(/&amp;/g, "&"), `award:${award.key}`);

const index = read("index.json", { pages: [] });
const files = read("files.json", []);
const crawlPages = new Map(index.pages.map((p) => [p.path.toLowerCase(), p.status]));
const crawlFiles = new Map(files.map((f) => [f.url.toLowerCase(), f.status]));

const results = [];
for (const [href, where] of links) {
  let u;
  try { u = new URL(href); } catch { results.push({ href, where, status: "invalid address" }); continue; }
  if (/^(www\.)?oatccc\.com$/i.test(u.hostname)) {
    const p = decodeURI(u.pathname);
    const known = /\.[a-z0-9]{2,4}$/i.test(p) ? crawlFiles.get(`https://www.oatccc.com${encodeURI(p)}`.toLowerCase()) : crawlPages.get((p.endsWith("/") ? p : `${p}/`).toLowerCase());
    results.push({ href, where, status: known ?? "not in the crawl", via: "crawl" });
    continue;
  }
  if (/^mailto:/i.test(href)) continue;
  let status;
  try {
    let res = await fetch(href, { method: "HEAD", redirect: "follow", headers: { "User-Agent": UA } });
    if ([403, 405, 400, 501].includes(res.status)) res = await fetch(href, { method: "GET", redirect: "follow", headers: { "User-Agent": UA } });
    status = res.status;
    if (res.body) { try { await res.body.cancel(); } catch {} }
  } catch (error) {
    status = `error: ${error?.cause?.code || error?.message || error}`;
  }
  results.push({ href, where, status });
  await sleep(300);
}
const broken = results.filter((r) => !(typeof r.status === "number" && r.status < 400));
fs.writeFileSync(path.join(CRAWL, "link-check.json"), JSON.stringify({ checkedAt: new Date().toISOString(), total: results.length, broken }, null, 1));
console.log(`Links checked: ${results.length}. Not working: ${broken.length}.`);
for (const b of broken) console.log(`  ${b.status}  ${b.href}  (on ${b.where.join(", ")})`);
