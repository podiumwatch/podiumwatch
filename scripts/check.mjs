import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const dist = path.join(root, "dist");
const build = spawnSync(process.execPath, ["scripts/build.mjs"], { cwd: root, encoding: "utf8" });
process.stdout.write(build.stdout || "");
process.stderr.write(build.stderr || "");
if (build.status !== 0) process.exit(build.status || 1);

async function walk(directory, extension) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full, extension));
    else if (entry.name.endsWith(extension)) files.push(full);
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

const htmlFiles = await walk(dist, ".html");
const errors = [];
let checkedLinks = 0;
let checkedImages = 0;

for (const file of htmlFiles) {
  const relative = path.relative(dist, file);
  const html = await fs.readFile(file, "utf8");
  const requireText = [
    [/<title>[^<]+<\/title>/, "missing title"],
    [/<meta name="description" content="[^"]+">/, "missing description"],
    [/<meta name="viewport"/, "missing viewport"],
    [/<link rel="canonical" href="[^"]+">/, "missing canonical"],
    [/<h1[\s>]/, "missing h1"]
  ];
  for (const [pattern, message] of requireText) if (!pattern.test(html)) errors.push(`${relative}: ${message}`);
  if (/href="#"/.test(html)) errors.push(`${relative}: placeholder href found`);

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

for (const required of ["sitemap.xml", "robots.txt", "rss.xml", "404.html", "site-data.json"]) {
  try { await fs.access(path.join(dist, required)); } catch { errors.push(`Missing generated file: ${required}`); }
}

if (errors.length) {
  console.error(`\nCheck failed with ${errors.length} problem${errors.length === 1 ? "" : "s"}:`);
  errors.forEach((error) => console.error(`  ${error}`));
  process.exit(1);
}
console.log(`Checked ${htmlFiles.length} HTML files, ${checkedLinks} internal links, and ${checkedImages} local images. No problems found.`);
