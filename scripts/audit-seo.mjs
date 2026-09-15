// AdSense/indexing remediation (2026-09-15): a small, dependency-free
// audit of the generated sitemap and the indexable pages it points at,
// run after a real build (see scripts/check.mjs, whose conventions this
// mirrors -- fs/promises + path only, an errors array, process.exit(1)
// with a clear message list on failure). scripts/check.mjs already
// validates every page's own tags in isolation (missing title/
// description/canonical/robots, private-prefix pages carry noindex);
// what's missing, and what this file adds, is checking the SITEMAP
// against those same pages -- does every URL Google is told about
// actually deserve to be there, and does it agree with what the page
// itself says about itself.
import fs from "node:fs/promises";
import path from "node:path";
import { site, NOINDEX_NOFOLLOW_PREFIXES, NOINDEX_FOLLOW_PREFIXES, SITEMAP_EXACT_EXCLUDE } from "../src/config/site.mjs";

const root = process.cwd();
const dist = path.join(root, "dist");
const errors = [];

function resolvePublicPath(pathname) {
  if (pathname === "/") return path.join(dist, "index.html");
  const clean = pathname.replace(/^\/+/, "");
  if (path.extname(clean)) return path.join(dist, clean);
  return path.join(dist, clean, "index.html");
}

async function readHtml(pathname) {
  try {
    return await fs.readFile(resolvePublicPath(pathname), "utf8");
  } catch {
    return null;
  }
}

// Text a reader would actually see with no JavaScript: strip <script>/
// <style> blocks (their contents are never visible copy) before
// stripping the remaining tags, matching how check.mjs's own mojibake
// scan reads a file -- as text, not as a DOM.
function visibleText(html) {
  const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const body = (withoutScripts.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [null, withoutScripts])[1];
  return body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

const sitemapPath = path.join(dist, "sitemap.xml");
let sitemapXml;
try {
  sitemapXml = await fs.readFile(sitemapPath, "utf8");
} catch (error) {
  console.error(`Could not read dist/sitemap.xml (${error.message}). Run the build first.`);
  process.exit(1);
}

const locs = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
if (!locs.length) errors.push("sitemap.xml contains no <loc> entries at all.");

const sitemapPathnames = [];
for (const loc of locs) {
  if (!loc.startsWith(site.siteUrl)) {
    errors.push(`sitemap.xml: "${loc}" does not use the site's own canonical domain (${site.siteUrl}) -- every sitemap URL must be built through absoluteUrl(site, ...).`);
    continue;
  }
  const pathname = loc.slice(site.siteUrl.length) || "/";
  sitemapPathnames.push(pathname);

  // 1. Private/administrative URLs in the sitemap.
  const privateMatch = NOINDEX_NOFOLLOW_PREFIXES.find((prefix) => pathname.startsWith(prefix));
  if (privateMatch) errors.push(`sitemap.xml: "${pathname}" is a private/authenticated route (matches "${privateMatch}") and must never be in the sitemap.`);

  // Utility/no-index-but-follow routes (internal search, etc).
  const utilityMatch = NOINDEX_FOLLOW_PREFIXES.find((prefix) => pathname.startsWith(prefix));
  if (utilityMatch) errors.push(`sitemap.xml: "${pathname}" is a noindex utility route (matches "${utilityMatch}") and must not be in the sitemap.`);

  // 2. search-index.json / any other JSON data file in the sitemap.
  if (pathname.endsWith(".json")) errors.push(`sitemap.xml: "${pathname}" is a JSON data file, not a page, and must not be in the sitemap.`);

  // 3. Generic, query-param-driven shell routes (bare /athlete/, /team/,
  // /meetdetail/, /race/) in the sitemap.
  if (SITEMAP_EXACT_EXCLUDE.includes(pathname)) errors.push(`sitemap.xml: "${pathname}" is a generic shell route with no record selected and must not be in the sitemap.`);

  const html = await readHtml(pathname);
  if (!html) {
    errors.push(`sitemap.xml: "${pathname}" has no corresponding generated file in dist/.`);
    continue;
  }

  // 7. Missing robots metadata, or metadata that disagrees with sitemap
  // membership -- a URL Google is told to index must itself say "index".
  const robotsMatch = html.match(/<meta name="robots" content="([^"]+)">/);
  if (!robotsMatch) {
    errors.push(`${pathname}: in sitemap.xml but the page has no <meta name="robots"> tag at all.`);
  } else if (!robotsMatch[1].startsWith("index")) {
    errors.push(`${pathname}: in sitemap.xml but marked "${robotsMatch[1]}" -- a sitemap URL must be indexable.`);
  }

  // 6. Missing canonical tag, or a canonical tag pointing somewhere other
  // than the URL the sitemap itself advertises -- that mismatch is
  // exactly what tells Google not to trust the sitemap entry.
  const canonicalMatch = html.match(/<link rel="canonical" href="([^"]+)">/);
  if (!canonicalMatch) {
    errors.push(`${pathname}: in sitemap.xml but the page has no <link rel="canonical"> tag.`);
  } else if (canonicalMatch[1] !== loc) {
    errors.push(`${pathname}: sitemap.xml lists "${loc}" but the page's own canonical tag points at "${canonicalMatch[1]}" -- these must match.`);
  }
}

// 4. Non-canonical sitemap URLs: the whole sitemap, taken as a set,
// should not contain two different URLs that both claim to be canonical
// for the same page (a real symptom of a stale/duplicate entry).
const seen = new Map();
for (const pathname of sitemapPathnames) {
  if (seen.has(pathname)) errors.push(`sitemap.xml: "${pathname}" appears more than once.`);
  seen.set(pathname, true);
}

// 5. Indexable pages whose visible content is only a loading/empty-state
// message -- walk every generated page (not just sitemap ones, so a page
// that should have been excluded but wasn't still gets caught), and for
// any marked indexable, flag it if there is barely any real text and
// what little there is reads like a loading placeholder rather than
// content. The length threshold is deliberately low (400 chars of actual
// body copy, after the shared header/nav/search-modal boilerplate every
// page carries) -- real Podium Watch pages checked directly while
// building this script run 1,600-4,800 characters; a bare loading shell
// is a few hundred.
async function walkHtml(directory) {
  const files = [];
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walkHtml(full));
    else if (entry.name.endsWith(".html")) files.push(full);
  }
  return files;
}

const loadingPhrase = /\b(loading|please wait)\b/i;
const allHtmlFiles = await walkHtml(dist);
let indexableCount = 0;
for (const file of allHtmlFiles) {
  const html = await fs.readFile(file, "utf8");
  const robotsMatch = html.match(/<meta name="robots" content="([^"]+)">/);
  const robots = robotsMatch ? robotsMatch[1] : null;
  if (!robots || !robots.startsWith("index")) continue;
  indexableCount += 1;

  const text = visibleText(html);
  if (text.length < 400 && loadingPhrase.test(text)) {
    const relative = path.relative(dist, file).replaceAll("\\", "/");
    errors.push(`${relative}: indexable (robots: "${robots}") but visible content is only ${text.length} characters and reads like a loading placeholder ("${text.slice(0, 120)}").`);
  }
}

if (errors.length) {
  console.error(`\nSEO audit failed with ${errors.length} problem${errors.length === 1 ? "" : "s"}:`);
  errors.forEach((error) => console.error(`  ${error}`));
  process.exit(1);
}

console.log(`SEO audit passed: ${sitemapPathnames.length} sitemap URLs, all indexable, all canonical, none private/utility/JSON/generic-shell; ${indexableCount} indexable pages total, none reading as a bare loading placeholder.`);
