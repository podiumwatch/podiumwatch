// School colors seeded from team logos (site redesign, 2026-11-13).
//
// For each team logo the site already serves (public/images/teams/
// <slug>-256.png) this finds the dominant saturated color: transparent,
// near-white and gray pixels are ignored, the rest are grouped into coarse
// color buckets, and the biggest bucket's average color wins. A logo with
// too little color (black and white logos) gets no entry, so the page uses
// Podium Watch black. A color a coach or Zachary sets on the team
// (team_pages.primary_color, anything but the old default) always wins
// over this file (lib/team_colors.mjs).
//
// Run: node scripts/team-colors.mjs   (writes src/data/team-colors.json)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const logoDir = path.join(root, "public/images/teams");
const outFile = path.join(root, "src/data/team-colors.json");

export async function dominantColor(file) {
  const { data, info } = await sharp(file).resize(64, 64, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const buckets = new Map();
  let opaque = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a < 128) continue;
    opaque += 1;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    if (min > 215 || saturation < 0.28 || max < 40) continue;
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const bucket = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    bucket.n += 1; bucket.r += r; bucket.g += g; bucket.b += b;
    buckets.set(key, bucket);
  }
  const best = [...buckets.values()].sort((x, y) => y.n - x.n)[0];
  if (!best || !opaque || best.n / opaque < 0.04) return null;
  return `#${[best.r, best.g, best.b].map((v) => Math.round(v / best.n).toString(16).padStart(2, "0")).join("")}`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = fs.readdirSync(logoDir).filter((name) => name.endsWith("-256.png")).sort();
  const colors = {};
  let none = 0;
  for (const name of files) {
    const slug = name.replace(/-256\.png$/, "");
    const color = await dominantColor(path.join(logoDir, name));
    if (color) colors[slug] = color; else none += 1;
  }
  fs.writeFileSync(outFile, JSON.stringify({
    note: "Seeded from each team's logo (scripts/team-colors.mjs): dominant saturated color. A color set on the team itself wins. No entry = Podium Watch black.",
    generated: new Date().toISOString().slice(0, 10),
    colors
  }, null, 2) + "\n");
  console.log(`logos: ${files.length}, with a color: ${Object.keys(colors).length}, black and white (no entry): ${none}`);
}
