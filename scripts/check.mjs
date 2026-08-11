import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const dist = path.join(root, "dist");
const ignoredDirectories = new Set([
  ".git",
  ".vercel",
  ".cache",
  "node_modules",
  "dist",
  "coverage"
]);

function shouldIgnoreDirectory(name) {
  const normalized = String(name || "").toLowerCase();
  return ignoredDirectories.has(normalized) || normalized.includes("backup");
}
const sourceTextExtensions = new Set([".js", ".mjs", ".css", ".html", ".md", ".json", ".txt"]);
const errors = [];
const warnings = [];

function run(command, args, label) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8" });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  if (result.status !== 0) {
    errors.push(`${label} failed.`);
    return false;
  }
  return true;
}

async function walk(directory, predicate = () => true) {
  const files = [];
  let entries = [];
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (entry.isDirectory() && shouldIgnoreDirectory(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full, predicate));
    else if (predicate(full)) files.push(full);
  }
  return files;
}

function resolvePublicPath(url) {
  const pathname = url.split(/[?#]/)[0];
  if (!pathname.startsWith("/")) return null;
  if (pathname === "/") return path.join(dist, "index.html");
  const clean = pathname.replace(/^\/+/, "");
  if (path.extname(clean)) return path.join(dist, clean);
  return path.join(dist, clean, "index.html");
}

function findDuplicateIds(html) {
  const counts = new Map();
  for (const match of html.matchAll(/\sid="([^"]+)"/g)) {
    counts.set(match[1], (counts.get(match[1]) || 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
}

function hasMojibake(text) {
  return ["Ãƒ", "Ã‚", "â€™", "â€œ", "â€", "ï»¿", "�"].some((marker) => text.includes(marker));
}

const sourceScripts = await walk(root, (file) => [".js", ".mjs"].includes(path.extname(file)));
for (const file of sourceScripts) {
  const result = spawnSync(process.execPath, ["--check", file], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) {
    errors.push(`${path.relative(root, file)}: JavaScript syntax error`);
    process.stderr.write(result.stderr || "");
  }
}

// vercel.json sets trailingSlash: true, so a request to an API route without a
// trailing slash gets a 308 redirect whose Location header drops the query
// string, silently discarding every filter or slug parameter. This has
// already happened three times (the athlete directory, the athlete profile
// page, and the recruiting directory all called an API path without the
// trailing slash their own query string needed). Flag any browser fetch call
// that builds an /api/ URL with a "?" not immediately preceded by "/".
const browserScripts = sourceScripts.filter((file) =>
  path.relative(root, file).replaceAll("\\", "/").startsWith("public/scripts/")
);
for (const file of browserScripts) {
  const text = await fs.readFile(file, "utf8");
  for (const match of text.matchAll(/\/api\/[a-zA-Z0-9_\-/]*\?/g)) {
    if (!match[0].endsWith("/?")) {
      errors.push(
        `${path.relative(root, file)}: fetch target "${match[0]}" is missing the trailing slash trailingSlash routing requires before its query string, which silently drops the query string after Vercel's redirect`
      );
    }
  }
}

const jsonFiles = await walk(root, (file) => path.extname(file) === ".json");
for (const file of jsonFiles) {
  try {
    JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    errors.push(`${path.relative(root, file)}: invalid JSON (${error.message})`);
  }
}

const sourceTextFiles = await walk(root, (file) => sourceTextExtensions.has(path.extname(file).toLowerCase()));
for (const file of sourceTextFiles) {
  if (path.resolve(file) === path.resolve(root, "scripts", "check.mjs")) continue;
  const text = await fs.readFile(file, "utf8");
  if (hasMojibake(text)) errors.push(`${path.relative(root, file)}: possible text encoding corruption`);
}

if (!errors.length) run(process.execPath, ["scripts/build.mjs"], "Website build");
if (errors.length) {
  console.error(`\nPrebuild checks failed with ${errors.length} problem${errors.length === 1 ? "" : "s"}:`);
  errors.forEach((error) => console.error(`  ${error}`));
  process.exit(1);
}

const htmlFiles = await walk(dist, (file) => file.endsWith(".html"));
let checkedLinks = 0;
let checkedImages = 0;
const privatePrefixes = ["admin/", "team-login/", "team-dashboard/", "team-editor/", "team-schedule/", "team-roster/", "team-content/", "team-insights/", "race-command-center/", "follow/"];

for (const file of htmlFiles) {
  const relative = path.relative(dist, file).replaceAll("\\", "/");
  const html = await fs.readFile(file, "utf8");
  const required = [
    [/<title>[^<]+<\/title>/, "missing title"],
    [/<meta name="description" content="[^"]+">/, "missing description"],
    [/<meta name="viewport"/, "missing viewport"],
    [/<meta name="robots" content="[^"]+">/, "missing robots instruction"],
    [/<link rel="canonical" href="[^"]+">/, "missing canonical"],
    [/<h1[\s>]/, "missing h1"]
  ];
  for (const [pattern, message] of required) if (!pattern.test(html)) errors.push(`${relative}: ${message}`);
  if (/href="#"/.test(html)) errors.push(`${relative}: placeholder href found`);
  if (hasMojibake(html)) errors.push(`${relative}: possible text encoding corruption`);

  const duplicateIds = findDuplicateIds(html);
  duplicateIds.forEach((id) => errors.push(`${relative}: duplicate id ${id}`));

  const shouldBePrivate = privatePrefixes.some((prefix) => relative.startsWith(prefix));
  if (shouldBePrivate && !/<meta name="robots" content="noindex, nofollow">/.test(html)) {
    errors.push(`${relative}: private page is not marked noindex`);
  }

  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const href = match[1];
    if (/^(https?:|mailto:|tel:|#|javascript:)/.test(href)) continue;
    const target = resolvePublicPath(href);
    if (!target) continue;
    checkedLinks += 1;
    try { await fs.access(target); } catch { errors.push(`${relative}: broken link ${href}`); }
  }

  for (const match of html.matchAll(/<img\b([^>]+)>/g)) {
    const attrs = match[1];
    const src = attrs.match(/src="([^"]+)"/)?.[1];
    if (!/alt="[^"]*"/.test(attrs)) errors.push(`${relative}: image missing alt text`);
    if (src && src.startsWith("/")) {
      checkedImages += 1;
      try { await fs.access(path.join(dist, src.replace(/^\/+/, ""))); } catch { errors.push(`${relative}: missing image ${src}`); }
    }
  }
}

for (const required of ["sitemap.xml", "robots.txt", "rss.xml", "404.html", "site-data.json", "search-index.json", "data/boys-xc-divisions-2026-27.json"]) {
  try { await fs.access(path.join(dist, required)); } catch { errors.push(`Missing generated file: ${required}`); }
}

try {
  const searchIndex = JSON.parse(await fs.readFile(path.join(dist, "search-index.json"), "utf8"));
  if (!Array.isArray(searchIndex) || searchIndex.length < 8) errors.push("search-index.json does not contain the expected site entries");
  for (const item of searchIndex) {
    if (!item.title || !item.href || !item.type) errors.push("search-index.json contains an incomplete entry");
  }
} catch (error) {
  errors.push(`search-index.json could not be validated: ${error.message}`);
}

if (warnings.length) {
  console.warn(`\nCheck completed with ${warnings.length} warning${warnings.length === 1 ? "" : "s"}:`);
  warnings.forEach((warning) => console.warn(`  ${warning}`));
}

if (errors.length) {
  console.error(`\nCheck failed with ${errors.length} problem${errors.length === 1 ? "" : "s"}:`);
  errors.forEach((error) => console.error(`  ${error}`));
  process.exit(1);
}

console.log(`Checked ${sourceScripts.length} JavaScript files, ${jsonFiles.length} JSON files, ${htmlFiles.length} HTML files, ${checkedLinks} internal links, and ${checkedImages} local images. No problems found.`);
