// Podium Watch Store card (awards voting pages): pull the store's products,
// every color each one is sold in, and a photo per color, from the store's
// own product pages. Photos are saved into the site (never hotlinked) at
// public/images/merch/{product}/{color}.webp, 480 px, transparent.
// Writes src/data/merch.json, keeping the card text and on/off settings.
//
//   node scripts/merch-sync.mjs
//
// Card background per color: the garment color moved lighter (dark
// garments) or darker (light garments) so the product never disappears
// into it; text is near-black or white, whichever reads better.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const CONFIG = path.join(root, "src/data/merch.json");
const STORE = "https://app.amazecommerce.com/shop/podiumwatch";
// Card order and names (Zachary, 2026-11-10). page = the store's product path.
const PRODUCTS = [
  { id: "white-logo-hoodie", name: "White Logo Hoodie", page: "white-logo-hoodie" },
  { id: "black-logo-hoodie", name: "Black Logo Hoodie", page: "podium-watch-hoodie-black-logo" },
  { id: "white-logo-shirt", name: "White Logo Shirt", page: "white-logo-podium-watch-shirt" },
  { id: "black-logo-t-shirt", name: "Black Logo T-Shirt", page: "pw-black-logo-t-shirt" },
  { id: "ball-cap", name: "Ball Cap", page: "podium-watch-ball-cap" },
  { id: "white-mug", name: "White Mug", page: "untitled-product" }
];

const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const hexToRgb = (hex) => { const h = String(hex || "#888888").replace("#", ""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const rgbToHex = (rgb) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const lum = (rgb) => { const [r, g, b] = rgb.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
export function cardColors(hex) {
  const rgb = hexToRgb(hex);
  const l = lum(rgb);
  const bg = l > 0.45 ? mix(rgb, [20, 24, 22], 0.62) : l < 0.12 ? mix(rgb, [255, 255, 255], 0.5) : mix(rgb, [255, 255, 255], 0.32);
  const bg2 = mix(bg, l > 0.45 ? [0, 0, 0] : [255, 255, 255], 0.18);
  const fg = contrast(bg, [11, 11, 11]) >= contrast(bg, [255, 255, 255]) ? "#0b0b0b" : "#ffffff";
  return { bg: rgbToHex(bg), bg2: rgbToHex(bg2), fg };
}

async function variantsFor(page) {
  const res = await fetch(`${STORE}/${page}`, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`${page}: ${res.status}`);
  const html = (await res.text()).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  const colors = new Map();
  for (const m of html.matchAll(/\{[^{}]*"variant_id"[^{}]*\}/g)) {
    let v; try { v = JSON.parse(m[0]); } catch { continue; }
    const name = v.color || "White";
    const entry = colors.get(name) || { name, hex: v.color_hex || null, image: null, available: false };
    if (!entry.image && v.image_url) entry.image = v.image_url;
    if (v.available && !v.discontinued && !v.out_of_stock) entry.available = true;
    colors.set(name, entry);
  }
  return [...colors.values()];
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("merch-sync.mjs")) {
  const old = fs.existsSync(CONFIG) ? JSON.parse(fs.readFileSync(CONFIG, "utf8")) : {};
  const products = [];
  const missing = [];
  for (const product of PRODUCTS) {
    const dir = path.join(root, "public/images/merch", product.id);
    fs.mkdirSync(dir, { recursive: true });
    const colors = [];
    for (const color of (await variantsFor(product.page)).filter((c) => c.available)) {
      if (!color.image) { missing.push(`${product.name}: ${color.name}`); continue; }
      const file = `${slugify(color.name)}.webp`;
      const res = await fetch(color.image, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) { missing.push(`${product.name}: ${color.name} (${res.status})`); continue; }
      await sharp(Buffer.from(await res.arrayBuffer())).trim({ threshold: 2 }).resize(480, 480, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 78, alphaQuality: 85, effort: 6 }).toFile(path.join(dir, file));
      colors.push({ name: color.name, hex: color.hex || "#cccccc", image: `/images/merch/${product.id}/${file}`, ...cardColors(color.hex) });
    }
    products.push({ id: product.id, name: product.name, url: `${STORE}/${product.page}`, colors });
    console.log(`${product.name}: ${colors.length} colors`);
  }
  const config = {
    _note: "Podium Watch Store card on the 2026 awards voting pages. Card text, link and on/off live here; products and colors come from scripts/merch-sync.mjs. The admin switch (Admin > Awards 2026) can also turn the card off.",
    enabled: old.enabled ?? true,
    label: old.label || "Podium Watch Store",
    headline: old.headline || "Rep the sport.",
    subline: old.subline || "Podium Watch hoodies, tees and caps.",
    button: old.button || "Shop the store",
    after_vote_headline: old.after_vote_headline || "Thanks for voting! Rep Podium Watch.",
    store_url: STORE,
    utm: old.utm || { utm_source: "podiumwatch", utm_medium: "awards", utm_campaign: "awards2026" },
    cycle_ms: old.cycle_ms || 4000,
    synced_at: new Date().toISOString(),
    products
  };
  fs.writeFileSync(CONFIG, JSON.stringify(config, null, 2) + "\n");
  console.log(`Wrote src/data/merch.json. Missing photos: ${missing.length ? missing.join("; ") : "none"}`);
}
