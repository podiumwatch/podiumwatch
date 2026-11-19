// Crawls oatccc.com for the OATCCC full-site move (the OATCCC gave written
// permission to copy its content, photos and files; Zachary, 2026-11-17).
//
// Everything it writes goes to _private/oatccc-crawl/, which git ignores:
// the repository is public and the crawled text, file lists and Hall of
// Fame bios must never be committed.
//
//   node scripts/oatccc-crawl.mjs            crawl pages, then size files
//   node scripts/oatccc-crawl.mjs --files    only re-check file sizes
//
// Polite: one request at a time, about one per second, a generic user
// agent. Starts from https://www.oatccc.com/Site-Map/ and also follows
// oatccc.com page links found on those pages (not logins or admin pages).
//
// Output:
//   pages/<slug>.json  { url, status, title, h1, mainHtml, text, links, images, flags }
//   index.json         every page: url, status, title, counts, flags
//   files.json         every file and content image: url, type, bytes, found on
//   failures.json      pages or files that could not be read
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "_private", "oatccc-crawl");
const PAGES = path.join(OUT, "pages");
const ORIGIN = "https://www.oatccc.com";
const UA = "Mozilla/5.0 (compatible; site-move-crawler/1.0)";
const DELAY_MS = 1000;
const MAX_PAGES = 1500;
const FILE_EXT = /\.(pdf|jpe?g|png|gif|webp|bmp|svg|docx?|xlsx?|pptx?|txt|csv|zip|mp4|mov|mp3)$/i;
const SKIP_PATH = /^\/(Portal\/(?!Admin\/[^/]+\/Images\/)|css\/|js\/|fonts\/)|\/(Login|Logout|Sign-?In|Admin)(\/|$)/i;

fs.mkdirSync(PAGES, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, { method = "GET" } = {}) {
  let last;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { method, redirect: "follow", headers: { "User-Agent": UA, Accept: method === "HEAD" ? "*/*" : "text/html,application/xhtml+xml,*/*" } });
      return res;
    } catch (error) {
      last = error;
      await sleep(2000 * attempt);
    }
  }
  throw last;
}

// Normalizes an oatccc.com link to a path ("/About-Us/"), or null when it
// points elsewhere.
function internalPath(href, base) {
  try {
    const u = new URL(href, base);
    if (!/^(www\.)?oatccc\.com$/i.test(u.hostname)) return null;
    return decodeURI(u.pathname);
  } catch { return null; }
}

function kindOf(href, base) {
  if (/^mailto:/i.test(href)) return "email";
  if (/^tel:/i.test(href)) return "phone";
  if (/^(javascript:|#)/i.test(href)) return "anchor";
  let u;
  try { u = new URL(href, base); } catch { return "invalid"; }
  if (/docs\.google\.com|drive\.google\.com|sites\.google\.com|forms\.gle/i.test(u.hostname)) return "google";
  if (/paypal|venmo|square|stripe|givebutter|donorbox|gofundme|eventbrite|regfox|runsignup/i.test(u.hostname)) return "payment";
  const p = internalPath(href, base);
  if (p !== null) return FILE_EXT.test(p) ? "file" : "page";
  return "external";
}

function slugFor(p) {
  const s = p.replace(/^\/+|\/+$/g, "").replace(/[^A-Za-z0-9._-]+/g, "__");
  return s || "_home";
}

// Main content as clean HTML and as text with line breaks kept.
function extract(html, url) {
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim();
  const main = $("main.page-content").first().length ? $("main.page-content").first() : $("body");
  main.find("script, style, noscript").remove();
  // The sponsor carousel sits at the end of every page's main area.
  main.find("section").filter((_, el) => /Corporate Sponsors/i.test($(el).find("h4").first().text())).remove();
  const h1 = main.find("h1").first().text().replace(/\s+/g, " ").trim();

  const links = [];
  main.find("a[href]").each((_, a) => {
    const href = $(a).attr("href").trim();
    links.push({ href, abs: (() => { try { return new URL(href, url).href; } catch { return href; } })(), text: $(a).text().replace(/\s+/g, " ").trim(), kind: kindOf(href, url) });
  });
  const images = [];
  main.find("img[src]").each((_, img) => {
    const src = $(img).attr("src").trim();
    images.push({ src, abs: (() => { try { return new URL(src, url).href; } catch { return src; } })(), alt: ($(img).attr("alt") || "").trim() });
  });
  // Background images in inline styles (e.g. the page banner).
  main.find("[style*='url(']").each((_, el) => {
    for (const m of String($(el).attr("style")).matchAll(/url\(([^)]+)\)/g)) {
      const src = m[1].replace(/["']/g, "").trim();
      images.push({ src, abs: (() => { try { return new URL(src, url).href; } catch { return src; } })(), alt: "", background: true });
    }
  });
  const flags = {
    forms: main.find("form").length,
    iframes: main.find("iframe").map((_, f) => $(f).attr("src") || "").get(),
    passwordField: main.find("input[type=password]").length > 0,
    payment: links.some((l) => l.kind === "payment") || /paypal|donat|checkout|credit card/i.test(main.text()),
    phones: [...new Set((main.text().match(/\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g) || []))],
    emails: [...new Set([...(main.text().match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []), ...links.filter((l) => l.kind === "email").map((l) => l.href.replace(/^mailto:/i, "").split("?")[0])])]
  };
  const mainHtml = main.html() || "";

  // Text: block elements on their own lines.
  const t = cheerio.load(`<div id="x">${mainHtml}</div>`);
  t("br").replaceWith("\n");
  t("p, div, li, tr, h1, h2, h3, h4, h5, h6, section, table, ul, ol, dt, dd, hr").each((_, el) => { t(el).append("\n"); });
  t("td, th").each((_, el) => { t(el).append("\t"); });
  const text = t("#x").text().split("\n").map((line) => line.replace(/[  ]+/g, " ").replace(/\t /g, "\t").trim()).filter((line, i, all) => line || (i > 0 && all[i - 1])).join("\n").trim();
  return { title, h1, mainHtml, text, links, images, flags };
}

async function crawlPages() {
  const siteMapRes = await get(`${ORIGIN}/Site-Map/`);
  const siteMapHtml = await siteMapRes.text();
  fs.writeFileSync(path.join(OUT, "site-map.html"), siteMapHtml);
  const $ = cheerio.load(siteMapHtml);
  const queue = [];
  const seen = new Set();
  const add = (p, from) => {
    if (!p || FILE_EXT.test(p) || SKIP_PATH.test(p)) return;
    const key = p.endsWith("/") ? p : `${p}/`;
    if (seen.has(key)) return;
    seen.add(key);
    queue.push({ path: key, from });
  };
  $("a[href]").each((_, a) => add(internalPath($(a).attr("href"), `${ORIGIN}/Site-Map/`), "Site-Map"));
  const siteMapCount = queue.length;

  const index = [];
  const failures = [];
  const fileRefs = new Map();
  const noteFile = (abs, foundOn, type) => {
    const p = internalPath(abs, ORIGIN);
    if (p === null) return;
    const key = `${ORIGIN}${encodeURI(p)}`;
    const ref = fileRefs.get(key) || { url: key, path: p, type, foundOn: [] };
    if (!ref.foundOn.includes(foundOn)) ref.foundOn.push(foundOn);
    fileRefs.set(key, ref);
  };
  $("a[href]").each((_, a) => { const h = $(a).attr("href"); if (kindOf(h, `${ORIGIN}/Site-Map/`) === "file") noteFile(new URL(h, ORIGIN).href, "/Site-Map/", "linked"); });

  for (let i = 0; i < queue.length && i < MAX_PAGES; i++) {
    const { path: p, from } = queue[i];
    const url = `${ORIGIN}${encodeURI(p)}`;
    process.stdout.write(`[${i + 1}/${queue.length}] ${p} `);
    try {
      const res = await get(url);
      const type = res.headers.get("content-type") || "";
      const finalUrl = res.url;
      if (!res.ok || !/text\/html/i.test(type)) {
        failures.push({ url, status: res.status, type, finalUrl, from });
        console.log(res.status);
      } else {
        const html = await res.text();
        const page = { url, finalUrl, status: res.status, from, ...extract(html, finalUrl) };
        const loginRedirect = /login|sign-?in/i.test(new URL(finalUrl).pathname) && !/login|sign-?in/i.test(p);
        page.flags.loginRedirect = loginRedirect;
        fs.writeFileSync(path.join(PAGES, `${slugFor(p)}.json`), JSON.stringify(page, null, 1));
        index.push({ path: p, url, finalUrl, status: res.status, title: page.title, h1: page.h1, chars: page.text.length, links: page.links.length, images: page.images.length, flags: page.flags, from });
        for (const l of page.links) {
          if (l.kind === "page") add(internalPath(l.abs, finalUrl), p);
          if (l.kind === "file") noteFile(l.abs, p, "linked");
        }
        for (const img of page.images) noteFile(img.abs, p, img.background ? "background" : "image");
        console.log(`ok ${page.text.length} chars`);
      }
    } catch (error) {
      failures.push({ url, error: String(error?.message || error), from });
      console.log("ERROR", error?.message);
    }
    await sleep(DELAY_MS);
  }
  fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify({ crawledAt: new Date().toISOString(), siteMapPages: siteMapCount, pagesQueued: queue.length, pages: index }, null, 1));
  fs.writeFileSync(path.join(OUT, "failures.json"), JSON.stringify(failures, null, 1));
  fs.writeFileSync(path.join(OUT, "files.json"), JSON.stringify([...fileRefs.values()], null, 1));
  console.log(`\nPages read: ${index.length}. Failed: ${failures.length}. Site-Map pages: ${siteMapCount}. Files and images found: ${fileRefs.size}.`);
}

async function sizeFiles() {
  const files = JSON.parse(fs.readFileSync(path.join(OUT, "files.json"), "utf8"));
  const failures = [];
  let total = 0;
  for (const [i, f] of files.entries()) {
    try {
      let res = await get(f.url, { method: "HEAD" });
      if (res.status === 405 || !res.headers.get("content-length")) res = await get(f.url);
      f.status = res.status;
      f.contentType = res.headers.get("content-type") || "";
      f.bytes = Number(res.headers.get("content-length") || 0) || null;
      if (res.body && res.bodyUsed === false) { try { await res.body.cancel(); } catch {} }
      if (!res.ok) failures.push({ url: f.url, status: res.status, foundOn: f.foundOn });
      total += f.bytes || 0;
    } catch (error) {
      f.status = null;
      failures.push({ url: f.url, error: String(error?.message || error), foundOn: f.foundOn });
    }
    if ((i + 1) % 50 === 0) console.log(`sized ${i + 1}/${files.length}`);
    await sleep(300);
  }
  fs.writeFileSync(path.join(OUT, "files.json"), JSON.stringify(files, null, 1));
  fs.writeFileSync(path.join(OUT, "file-failures.json"), JSON.stringify(failures, null, 1));
  const byExt = {};
  for (const f of files) {
    const ext = (f.path.match(/\.([a-z0-9]+)$/i)?.[1] || "?").toLowerCase();
    byExt[ext] = byExt[ext] || { count: 0, bytes: 0 };
    byExt[ext].count++;
    byExt[ext].bytes += f.bytes || 0;
  }
  const summary = { files: files.length, ok: files.filter((f) => f.status >= 200 && f.status < 300).length, failed: failures.length, totalBytes: total, byExt };
  fs.writeFileSync(path.join(OUT, "files-summary.json"), JSON.stringify(summary, null, 1));
  console.log(JSON.stringify(summary, null, 1));
}

if (!process.argv.includes("--files")) await crawlPages();
await sizeFiles();
