// Podium Watch Shop card: save every product photo in src/data/merch.json
// into the site (never hotlinked; the store's image links can change).
// Each color's image_src (the store's 1000x1000 mockup) is downloaded,
// checked to be a real image, re-encoded and written to its "image" path
// under public/ (for example /images/merch/podium-varsity-crewneck-black.webp).
//
//   node scripts/merch-images.mjs            only photos not saved yet
//   node scripts/merch-images.mjs --force    download every photo again
//   node scripts/merch-images.mjs --all      every product, not only the card's four
//
// Replaces scripts/merch-sync.mjs (2026-11-11): products, colors and links
// now come from merch.json itself, collected from the live store.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FORCE = process.argv.includes("--force");
const merch = JSON.parse(fs.readFileSync(path.join(root, "src/data/merch.json"), "utf8"));

let saved = 0;
let kept = 0;
// Only the products the card shows (merch.card_products); --all for every product.
const ALL = process.argv.includes("--all");
const shown = new Set(merch.card_products || merch.products.map((p) => p.id));
for (const product of merch.products.filter((p) => ALL || shown.has(p.id))) {
  for (const color of product.colors) {
    if (!/^\/images\/merch\/[a-z0-9-]+\.webp$/.test(color.image)) throw new Error(`Bad image path for ${product.id} ${color.name}: ${color.image}`);
    const target = path.join(root, "public", color.image);
    if (!FORCE && fs.existsSync(target)) { kept += 1; continue; }
    const res = await fetch(color.image_src, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`${product.id} ${color.name}: download failed (${res.status})`);
    const input = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(input).metadata();
    if (!meta.width || !meta.height) throw new Error(`${product.id} ${color.name}: not an image`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    await sharp(input).resize(1000, 1000, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82, alphaQuality: 90 }).toFile(target);
    saved += 1;
    console.log(`Saved ${color.image} (${meta.width}x${meta.height})`);
  }
}
console.log(`${saved} saved, ${kept} already there.`);
