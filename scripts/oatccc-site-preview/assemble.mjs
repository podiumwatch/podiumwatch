// Builds the OATCCC site preview copy (served at <review link>/site-preview/).
// Input: a dist/ built from oatccc-full-site with the preview settings, the
// static 2027 division list, and the TEST-data screenshots. Output: a
// self-contained folder whose links are all relative and stay inside it.
// Usage: node scripts/oatccc-site-preview/assemble.mjs <dist> <divisions.json> <shots dir> <out dir>
import fs from "node:fs";
import path from "node:path";

const [, , DIST, DIVISIONS, SHOTS, OUT] = process.argv;
if (fs.existsSync(OUT)) throw new Error("output folder already exists: " + OUT);
const posix = path.posix;
const report = { pages: 0, generated: [], assets: 0, notInPreviewLinks: 0, removedScripts: 0, bytes: 0, largest: null };

// ---------- pages in the copy ----------
const pageDirs = new Set(); // "oatccc/about/" style, relative to the copy root
const walk = (dir, rel = "") => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) walk(path.join(dir, e.name), rel + e.name + "/");
    else if (e.name === "index.html") pageDirs.add(rel);
  }
};
walk(path.join(DIST, "oatccc"), "oatccc/");
const sourcePages = [...pageDirs];
const GENERATED = {
  "": "landing",
  "not-in-preview/": "not-in-preview",
  "oatccc/preview-screenshots/ad-form/": "ad-form",
  "oatccc/preview-screenshots/admin-queue/": "admin-queue"
};
for (const dir of Object.keys(GENERATED)) pageDirs.add(dir);

// ---------- helpers ----------
const assets = new Map(); // copy path -> source file (or Buffer)
const addAsset = (rel) => {
  if (assets.has(rel)) return true;
  const src = path.join(DIST, rel);
  if (!fs.existsSync(src) || !fs.statSync(src).isFile()) return false;
  assets.set(rel, src);
  return true;
};
const relFrom = (fromDir, target) => {
  // fromDir: "oatccc/about/" ; target: "styles/main.css" or "oatccc/" or ""
  let r = posix.relative("/" + fromDir, "/" + target);
  if (target === "" || target.endsWith("/")) r = (r ? r + "/" : "./");
  if (r === "") r = "./";
  return r;
};
const PW = /^https?:\/\/(www\.)?podiumwatch\.org(?=\/|$)/i;

// Rewrites one URL found in a page or stylesheet at copy folder fromDir.
function rewriteUrl(value, fromDir, { asset = false } = {}) {
  let v = value.trim();
  if (PW.test(v)) v = v.replace(PW, "") || "/";
  if (!v.startsWith("/") || v.startsWith("//")) return value; // relative, external, mailto:, #, data:
  const m = /^([^?#]*)([?#].*)?$/.exec(v);
  let p = m[1];
  const tail = m[2] || "";
  const rel = p.replace(/^\/+/, "");
  if (/\.[A-Za-z0-9]{2,5}$/.test(rel)) {
    if (addAsset(decodeURIComponent(rel))) return relFrom(fromDir, rel) + tail;
    if (!asset) report.notInPreviewLinks += 1;
    return relFrom(fromDir, "not-in-preview/");
  }
  const dir = rel === "" ? "" : rel.endsWith("/") ? rel : rel + "/";
  if (pageDirs.has(dir)) return relFrom(fromDir, dir) + tail;
  report.notInPreviewLinks += 1;
  return relFrom(fromDir, "not-in-preview/");
}

const ATTR = /(\s(?:href|src|action|poster))=("([^"]*)"|'([^']*)')/g;
function rewriteHtml(html, fromDir) {
  const root = relFrom(fromDir, "");
  // Scripts that report to or read from the live site: removed.
  const dropScript = /<script\b[^>]*\bsrc="(?:https:\/\/www\.googletagmanager\.com\/[^"]*|\/_vercel\/[^"]*|\/scripts\/(?:page-view|ohio-today)\.js[^"]*)"[^>]*>\s*<\/script>\s*/g;
  html = html.replace(dropScript, () => { report.removedScripts += 1; return ""; });
  html = html.replace(/<script>\s*window\.dataLayer[\s\S]*?<\/script>\s*/g, () => { report.removedScripts += 1; return ""; });
  html = html.replace(/<script>\s*window\.va = [\s\S]*?<\/script>\s*/g, () => { report.removedScripts += 1; return ""; });
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/g, "");
  // Canonical, feeds, social cards: they name live addresses. Removed.
  html = html.replace(/<link rel="(?:canonical|alternate|manifest)"[^>]*>\s*/g, "");
  html = html.replace(/<meta (?:property|name)="(?:og|twitter):[^"]*"[^>]*>\s*/g, "");
  // Always noindex.
  html = html.replace(/<meta name="robots"[^>]*>\s*/g, "");
  html = html.replace(/<meta name="googlebot"[^>]*>\s*/g, "");
  // Links and files.
  html = html.replace(ATTR, (all, attr, q, d, s) => {
    const val = d ?? s;
    return `${attr}="${rewriteUrl(val, fromDir, { asset: /src|poster/.test(attr) })}"`;
  });
  html = html.replace(/\ssrcset="([^"]*)"/g, (all, set) => ` srcset="${set.split(",").map((part) => { const [u, ...rest] = part.trim().split(/\s+/); return [rewriteUrl(u, fromDir, { asset: true }), ...rest].join(" "); }).join(", ")}"`);
  html = html.replace(/url\((['"]?)(\/[^'")]+)\1\)/g, (all, q, u) => `url(${q}${rewriteUrl(u, fromDir, { asset: true })}${q})`);
  // Head: noindex, the guard. Body: the banner.
  const guard = `<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="referrer" content="no-referrer">
<script>(function(){var R=${JSON.stringify(root)};window.__PW_PREVIEW_ROOT=R;var B=new URL(R,location.href).pathname;var F=window.fetch;
function outside(u){try{var x=new URL(u,location.href);if(!/^https?:$/.test(x.protocol))return false;if(x.origin!==location.origin)return /(^|\\.)podiumwatch\\.org$/i.test(x.hostname);return x.pathname.indexOf(B)!==0}catch(e){return false}}
window.fetch=function(u){var s=typeof u==="string"?u:(u&&u.url)||String(u);if(outside(s))return Promise.reject(new TypeError("Not available in the OATCCC preview"));return F.apply(this,arguments)};
try{navigator.sendBeacon=function(){return true}}catch(e){}
document.addEventListener("click",function(e){var a=e.target&&e.target.closest&&e.target.closest("a[href]");if(a&&outside(a.href)){e.preventDefault();location.href=R+"not-in-preview/"}},true);
document.addEventListener("submit",function(e){var f=e.target;if(f&&f.tagName==="FORM"&&outside(f.action||location.href)){e.preventDefault();location.href=R+"not-in-preview/"}},true);
})();</script>
<style>.pw-preview-banner{background:#fff4d6;color:#5a3d00;border-bottom:1px solid #e6cf8c;padding:8px 16px;font:600 14px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;text-align:center}.pw-preview-banner a{color:inherit;font-weight:500;margin-left:10px;white-space:nowrap}</style>`;
  if (!/<head>/.test(html)) throw new Error("no <head> in " + fromDir);
  html = html.replace(/<head>/, `<head>\n${guard}`);
  const banner = `<div class="pw-preview-banner" role="note">Preview for the OATCCC. Not live yet.<a href="${root}">Preview contents</a></div>`;
  if (!/<body[^>]*>/.test(html)) throw new Error("no <body> in " + fromDir);
  html = html.replace(/(<body[^>]*>)/, `$1\n${banner}`);
  return html;
}

// ---------- generated pages (built on a real page's shell) ----------
const shellSource = fs.readFileSync(path.join(DIST, "oatccc/about/index.html"), "utf8");
function shell(title, body, activeTab) {
  let h = shellSource.replace(/<title>[\s\S]*?<\/title>/, `<title>${title} | OATCCC preview</title>`);
  h = h.replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${title}">`);
  const mainStart = h.indexOf('<main id="main-content">');
  const tabsEnd = h.indexOf("</nav>", h.indexOf('class="ox-tabs"')) + "</nav>".length;
  const mainEnd = h.lastIndexOf("</main>");
  if (mainStart < 0 || tabsEnd < mainStart || mainEnd < tabsEnd) throw new Error("shell structure changed");
  let tabs = h.slice(mainStart, tabsEnd).replace(/ aria-current="page"/g, "");
  if (activeTab) tabs = tabs.replace(`<a href="${activeTab}">`, `<a href="${activeTab}" aria-current="page">`);
  return h.slice(0, mainStart) + tabs + `<div class="ox-wrap ox-more">${body}</div></div>` + h.slice(mainEnd);
}
const testNote = `<p class="ox-preview-test"><strong>TEST data only.</strong> Every school, name, phone number, email and signature in these screenshots is made up for the preview. No real athletic director's details appear here. The form is not switched on in this preview.</p>`;
const figure = (file, caption, phone) => `<figure class="ox-shot${phone ? " phone" : ""}"><img src="/oatccc/preview-screenshots/img/${file}" alt="${caption}" loading="lazy"><figcaption>${caption}</figcaption></figure>`;
const shotStyle = `<style>.ox-shot{margin:28px 0;max-width:100%}.ox-shot img{display:block;max-width:100%;height:auto;border:1px solid #d9dce5;border-radius:10px;background:#fff}.ox-shot.phone img{max-width:390px;width:100%}.ox-shot figcaption{margin-top:8px;font-size:.95rem;color:#4a4f6a}.ox-preview-test{background:#eef3ff;border:1px solid #c9d6f5;border-radius:10px;padding:12px 14px}.ox-preview-list li{margin:6px 0}</style>`;

const pagesOut = new Map(); // copy dir -> html
const shotFiles = fs.readdirSync(SHOTS).filter((f) => f.endsWith(".png"));
for (const f of shotFiles) assets.set("oatccc/preview-screenshots/img/" + f, path.join(SHOTS, f));

const GEN_HTML = {
  "": shell("OATCCC site preview", `${shotStyle}
  <div class="page-head"><p class="ox-kicker">Preview for the OATCCC</p><h1>The OATCCC section on Podium Watch</h1></div>
  <div class="ox-prose">
  <p>This is a private preview of the OATCCC section before it goes live. Every page below works and links to the others; links to the rest of Podium Watch, which is not part of this preview, go to a short note instead.</p>
  <h2>Pages</h2>
  <ul class="ox-preview-list">
    <li><a href="/oatccc/">OATCCC home</a></li>
    <li><a href="/oatccc/indoor/high-school/abcs/">Indoor State Meet</a> (including <a href="/oatccc/indoor/high-school/eligibility-and-verification/">Eligibility and verification</a> and <a href="/oatccc/indoor/high-school/divisions/">Divisions</a>, with the 2027 division list)</li>
    <li><a href="/oatccc/indoor/middle-school/">Middle School Indoor State Meet</a></li>
    <li><a href="/oatccc/polls/">Coaches' Polls</a></li>
    <li><a href="/oatccc/hall-of-fame/">Hall of Fame</a> and <a href="/oatccc/awards/">Awards</a></li>
    <li><a href="/oatccc/clinics/track-and-field/">Clinics</a></li>
    <li><a href="/oatccc/join/">Membership</a></li>
    <li><a href="/oatccc/about/">About</a></li>
  </ul>
  <h2>Screenshots (TEST data)</h2>
  <p>Team verification is not switched on in this preview. These two pages show it with made-up TEST schools and people:</p>
  <ul class="ox-preview-list">
    <li><a href="/oatccc/preview-screenshots/ad-form/">The athletic director's verification form</a></li>
    <li><a href="/oatccc/preview-screenshots/admin-queue/">The Chair's verification queue</a></li>
  </ul>
  </div>`),
  "not-in-preview/": shell("Not in this preview", `
  <div class="page-head"><p class="ox-kicker">Preview for the OATCCC</p><h1>Not part of this preview</h1></div>
  <div class="ox-prose"><p>That link goes to the main Podium Watch site, which is not part of this OATCCC preview.</p>
  <p><a href="/">Back to the preview contents</a> or <a href="/oatccc/">the OATCCC home page</a>.</p></div>`),
  "oatccc/preview-screenshots/ad-form/": shell("Athletic director verification form (TEST data)", `${shotStyle}
  <div class="page-head"><p class="ox-kicker">Screenshots</p><h1>Athletic director verification form</h1></div>
  <div class="ox-prose">${testNote}
  <p>Athletic directors sign in with a link sent to their school email, fill in one form per school for both teams, sign it, and can see its status and the Chair's comments. Screens are shown on a phone.</p></div>
  ${figure("ad-1-sign-in.png", "1. Sign in: the athletic director gets a sign-in link by email.", true)}
  ${figure("ad-2-school-locked.png", "2. The email is the school's AD email in the OHSAA directory, so the school is filled in and locked.", true)}
  ${figure("ad-5-not-in-directory.png", "3. The email is not in the directory: the AD picks the school, and the Chair is told.", true)}
  ${figure("ad-3-filled-and-signed.png", "4. The whole form, filled in and signed (TEST data).", true)}
  ${figure("ad-4-submitted.png", "5. After submitting: the answers, the signature and the history.", true)}
  ${figure("ad-6-returned.png", "6. A form the Chair returned with a comment, ready to fix and resubmit.", true)}
  <p><a href="/oatccc/preview-screenshots/admin-queue/">Next: the Chair's verification queue</a></p>`, "/oatccc/indoor/high-school/abcs/"),
  "oatccc/preview-screenshots/admin-queue/": shell("Verification queue for the Chair (TEST data)", `${shotStyle}
  <div class="page-head"><p class="ox-kicker">Screenshots</p><h1>The Chair's verification queue</h1></div>
  <div class="ox-prose">${testNote}
  <p>The Indoor State Meet Chair sees every form, filters by status, opens one to read the answers and signature, and approves it or returns it with a comment. Forms whose AD email is not in the OHSAA directory are marked.</p></div>
  ${figure("admin-1-queue.png", "1. The queue on a computer, with counts by status.")}
  ${figure("admin-2-submission.png", "2. An open form: answers, signature, comment box, Approve or Return with comment.")}
  ${figure("admin-3-not-in-directory.png", "3. A late form whose AD email is not in the OHSAA directory.")}
  ${figure("admin-4-queue-phone.png", "4. The same queue on a phone.", true)}
  <p><a href="/oatccc/preview-screenshots/ad-form/">Back: the athletic director's form</a></p>`, "/oatccc/indoor/high-school/abcs/")
};

for (const dir of sourcePages) pagesOut.set(dir, rewriteHtml(fs.readFileSync(path.join(DIST, dir, "index.html"), "utf8"), dir));
for (const [dir, html] of Object.entries(GEN_HTML)) { pagesOut.set(dir, rewriteHtml(html, dir)); report.generated.push(dir || "(root)"); }
report.pages = pagesOut.size;

// ---------- stylesheets: their url()s, relative to the stylesheet ----------
const textOut = new Map();
for (const rel of [...assets.keys()]) {
  if (!rel.endsWith(".css")) continue;
  const dir = posix.dirname(rel) + "/";
  textOut.set(rel, fs.readFileSync(assets.get(rel), "utf8").replace(/url\((['"]?)(\/[^'")]+)\1\)/g, (all, q, u) => `url(${q}${rewriteUrl(u, dir, { asset: true })}${q})`));
}
// ---------- scripts ----------
for (const rel of [...assets.keys()]) {
  if (!rel.endsWith(".js")) continue;
  let js = fs.readFileSync(assets.get(rel), "utf8");
  if (rel === "scripts/oatccc-divisions.js") {
    const a = 'fetch("/api/oatccc/divisions"';
    if (!js.includes(a)) throw new Error("divisions fetch changed");
    js = js.replace(a, 'fetch(window.__PW_PREVIEW_ROOT + "data/oatccc-divisions-2027.json"');
  }
  if (rel === "scripts/site.js") {
    js = js.replace(/window\.location\.href = "\/[^"]*"(?: \+ [^;]+)?;/g, 'window.location.href = window.__PW_PREVIEW_ROOT + "not-in-preview/";');
  }
  textOut.set(rel, js);
}
// ---------- the static division list ----------
const divisions = JSON.parse(fs.readFileSync(DIVISIONS, "utf8"));
if (!Array.isArray(divisions.schools) || divisions.year !== 2027) throw new Error("division list shape");
textOut.set("data/oatccc-divisions-2027.json", JSON.stringify(divisions));

// ---------- write ----------
const write = (rel, data) => {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
  const size = Buffer.byteLength(data);
  report.bytes += size;
  if (!report.largest || size > report.largest.size) report.largest = { rel, size };
};
for (const [dir, html] of pagesOut) write(dir + "index.html", html);
for (const [rel, src] of assets) if (!textOut.has(rel)) write(rel, fs.readFileSync(src));
for (const [rel, text] of textOut) write(rel, text);
report.assets = assets.size + 1;
console.log(JSON.stringify(report, null, 1));
