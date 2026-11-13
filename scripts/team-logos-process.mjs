// WO-11 logos, step 2: process the matched logos (scripts/team-logos-match.mjs
// writes dataimports/team_logos_match.json first).
//
//   node --env-file=.env.local scripts/team-logos-process.mjs           (images + manifest, no database writes)
//   node --env-file=.env.local scripts/team-logos-process.mjs --write   (also fills team_pages.logo_url)
//   add --force to re-encode every logo from its source file
//
// Each source: trim empty edges, keep transparency, fit in a square at
// 512, 256 and 96 px as WebP, plus one 256 px PNG (share cards, fallback).
// Settings keep all processed logos under 30 MB in the repo.
//   matched team:   public/images/teams/{team slug}-{512,256,96}.webp + -256.png
//   everything else readable (review, schools without a team page, files
//   no map entry uses): public/images/teams/pool/{file key}-{size}.{ext},
//   so Admin > Logo Review can assign one in a click.
// The logo's main color (most common saturated color; the darkest strong
// color for black-and-white logos) is saved for team page headers.
// Manifest: src/data/team-logos.json. A logo a coach uploaded is never
// replaced. Never pulls from the web.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const WRITE = process.argv.includes("--write");
const FORCE = process.argv.includes("--force");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(root, "dataimports/pw_logos/schools");
const OUT = path.join(root, "public/images/teams");
const POOL = path.join(OUT, "pool");
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };
const WEBP = { 512: { quality: 56, alphaQuality: 70, effort: 6 }, 256: { quality: 68, alphaQuality: 78, effort: 6 }, 96: { quality: 80, alphaQuality: 90, effort: 6 } };
const match = JSON.parse(fs.readFileSync(path.join(root, "dataimports/team_logos_match.json"), "utf8"));
const fileKey = (name) => String(name).toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[\s_.]+/g, "");
fs.mkdirSync(POOL, { recursive: true });

const hex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
// Main color: bucket opaque pixels; ignore near-white and near-gray, weight
// by saturation. Grayscale logos fall back to their darkest strong color.
async function mainColor(buffer) {
  const { data, info } = await sharp(buffer).resize(64, 64, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const buckets = new Map();
  let dark = null;
  for (let i = 0; i < data.length; i += info.channels) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a < 200) continue;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    if (max > 235 && sat < 0.12) continue; // white
    if (sat < 0.18) { if (max < 90) dark = dark || [r, g, b]; continue; } // gray/black
    const key = `${r >> 5}|${g >> 5}|${b >> 5}`;
    const entry = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0, w: 0 };
    entry.n += 1; entry.r += r; entry.g += g; entry.b += b; entry.w += sat;
    buckets.set(key, entry);
  }
  const best = [...buckets.values()].sort((x, y) => y.n * (0.5 + y.w / y.n) - x.n * (0.5 + x.w / x.n))[0];
  if (best && best.n >= 8) return hex(best.r / best.n, best.g / best.n, best.b / best.n);
  return dark ? hex(...dark) : "#111111";
}

async function processFile(file, base) {
  const input = path.join(SRC, file);
  // Already processed from the same source: reuse the files, just read the color.
  if (!FORCE && fs.existsSync(`${base}-96.webp`) && fs.existsSync(`${base}-256.png`) && fs.statSync(`${base}-256.png`).mtimeMs >= fs.statSync(input).mtimeMs) return mainColor(fs.readFileSync(`${base}-512.webp`));
  const trimmed = await sharp(input, { animated: false }).ensureAlpha().trim({ threshold: 12 }).toBuffer();
  for (const size of [512, 256, 96]) {
    await sharp(trimmed).resize(size, size, { fit: "contain", background: CLEAR }).webp(WEBP[size]).toFile(`${base}-${size}.webp`);
  }
  await sharp(trimmed).resize(256, 256, { fit: "contain", background: CLEAR }).png({ palette: true, colours: 48, quality: 65, compressionLevel: 9, effort: 10 }).toFile(`${base}-256.png`);
  // Sizes from before (512 and 96 px PNGs) are no longer made.
  for (const old of [`${base}-512.png`, `${base}-96.png`]) if (fs.existsSync(old)) fs.unlinkSync(old);
  return mainColor(trimmed);
}

const manifest = { generated_at: new Date().toISOString(), note: "Written by scripts/team-logos-process.mjs. Paths are bases: add -512/-256/-96.webp, or -256.png.", teams: {}, schools: {}, pool: {}, failed: [] };
const done = new Map(); // file -> { base, color } for pool reuse
async function run(file, base, publicBase) {
  if (done.has(`${file}|${publicBase}`)) return done.get(`${file}|${publicBase}`);
  try {
    const color = await processFile(file, base);
    const value = { base: publicBase, color, source: file };
    done.set(`${file}|${publicBase}`, value);
    return value;
  } catch (error) {
    manifest.failed.push({ file, error: String(error.message || error).slice(0, 160) });
    return null;
  }
}

for (const m of match.matched) {
  const value = await run(m.file, path.join(OUT, m.team_slug), `/images/teams/${m.team_slug}`);
  if (value) { manifest.teams[m.team_slug] = { ...value, team_id: m.team_id, school_id: m.school_id, map_name: m.name }; manifest.schools[m.school_id] = manifest.teams[m.team_slug]; }
}
// Schools without a team page still get small logos in results tables.
for (const m of match.no_team_page) {
  const key = fileKey(m.file);
  const value = await run(m.file, path.join(POOL, key), `/images/teams/pool/${key}`);
  if (value) { manifest.pool[key] = value; manifest.schools[m.school_id] = { ...value, map_name: m.name }; }
}
const poolFiles = new Set([...match.review.map((r) => r.file), ...match.unused_files]);
for (const file of poolFiles) {
  if (/\.eps$/i.test(file)) { manifest.failed.push({ file, error: "format not supported" }); continue; }
  const key = fileKey(file);
  if (manifest.pool[key]) continue;
  const value = await run(file, path.join(POOL, key), `/images/teams/pool/${key}`);
  if (value) manifest.pool[key] = value;
}
// For Admin > Logo Review (the match report itself is not deployed).
manifest.review = match.review.map((r) => ({ name: r.name, file: r.file, pool_key: fileKey(r.file), reason: r.reason, candidates: r.candidates }));
manifest.missing_files = match.missing_files;
manifest.unconvertible = [...match.unconvertible, ...manifest.failed.map((f) => ({ name: null, file: f.file }))];
manifest.unused_pool_keys = match.unused_files.map(fileKey).filter((key) => manifest.pool[key]);
fs.writeFileSync(path.join(root, "src/data/team-logos.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`Teams with a logo: ${Object.keys(manifest.teams).length}; schools with a logo: ${Object.keys(manifest.schools).length}; pool files: ${Object.keys(manifest.pool).length}; failed: ${manifest.failed.length}`);
if (manifest.failed.length) console.log(manifest.failed.map((f) => `${f.file}: ${f.error}`).join("\n"));

if (WRITE) {
  const { supabaseAdmin: db } = await import("../lib/supabase-admin.mjs");
  let filled = 0, kept = 0;
  for (const [slug, logo] of Object.entries(manifest.teams)) {
    const { data: team } = await db.from("team_pages").select("id, logo_url").eq("id", logo.team_id).single();
    // A coach-uploaded logo (any URL not ours) is never replaced.
    if (team.logo_url && !team.logo_url.startsWith("/images/teams/")) { kept += 1; continue; }
    const url = `${logo.base}-256.png`;
    if (team.logo_url === url) continue;
    const { error } = await db.from("team_pages").update({ logo_url: url }).eq("id", logo.team_id);
    if (error) throw error;
    filled += 1;
  }
  console.log(`logo_url filled: ${filled}; coach-uploaded logos kept: ${kept}`);
}
