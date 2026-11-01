// Adds the 16 school logos Zachary supplied on 2026-11-01 to the Mock
// Postseason logo manifest, the same way the Oct 21 batch was added:
// each source is contain-fit into a 96x96 PNG (aspect kept, transparent
// letterbox, no trimming, white JPG backgrounds kept) and written to
// public/images/mock-postseason-logos/schools/<slug>.png, then a
// { sourceFile, slug } entry is added under the school's site key.
//
// The files arrived as pasted images (28.png ... 43.png), not named after
// site keys, so the key for each was matched from what the image shows
// (school name or initials where printed, otherwise school colors and
// mark), with the last ones by elimination. Copies of the sources are
// saved under dataimports/site_logos_2026-11-01/ named by slug; like
// dataimports/pw_logos/, those sources are not committed.
//
// Calvert, Pandora-Gilboa, Van Buren and Grand Valley stay on the
// initials circle (Zachary's call). Never pulls from the web.
//
// Rendering uses the installed Chrome via playwright-core (already in
// node_modules) because no image library is installed and two sources
// are WebP.
//
// Run: node dataimports/add-site-logos-2026-11-01.mjs <folder with 28.png ... 43.png>

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = process.argv[2];
if (!srcDir) throw new Error("Pass the folder that holds the pasted images");
const require = createRequire(path.join(root, "package.json"));
const { chromium } = require("playwright-core");

const MAPPING = [
  { file: "28.png", key: "Buckeye Central", why: "school name printed on the logo" },
  { file: "29.png", key: "Cle. St. Joseph Acad.", why: "school mark, matched by elimination with colors" },
  { file: "30.jpg", key: "Col. West", why: "school mark" },
  { file: "31.png", key: "Fairfield", why: "school mark" },
  { file: "32.jpg", key: "Groveport-Madison", why: "GM initials" },
  { file: "33.jpg", key: "Harrison", why: "H initial, green" },
  { file: "34.png", key: "Lake Center Chr.", why: "school mark, blue and gold" },
  { file: "35.webp", key: "Laurel", why: "school mark" },
  { file: "36.webp", key: "Leipsic", why: "school mark" },
  { file: "37.jpg", key: "Madeira", why: "M mark carrying both team marks" },
  { file: "38.jpg", key: "Magnificat", why: "M mark" },
  { file: "39.png", key: "Old Fort", why: "OF initials" },
  { file: "40.png", key: "Paine. Riverside", why: "XC mark, school mark" },
  { file: "41.png", key: "Roosevelt", why: "R initial" },
  { file: "42.png", key: "Scott", why: "Toledo Scott printed on the logo" },
  { file: "43.png", key: "Springfield", why: "remaining school, by elimination" },
];

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

const manifestPath = path.join(root, "src/data/mock-postseason-logo-manifest-2026.json");
const manifestRaw = fs.readFileSync(manifestPath, "utf8");
const manifest = JSON.parse(manifestRaw);
const outDir = path.join(root, "public/images/mock-postseason-logos/schools");
const keepDir = path.join(root, "dataimports/site_logos_2026-11-01");
fs.mkdirSync(keepDir, { recursive: true });

const keys = new Set(MAPPING.map((m) => m.key));
if (keys.size !== MAPPING.length) throw new Error("Duplicate site key in mapping");

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
await page.setContent("<html><body></body></html>");

for (const m of MAPPING) {
  if (manifest[m.key]) throw new Error(`${m.key} already has a logo (${manifest[m.key].slug}); refusing to overwrite`);
  const ext = path.extname(m.file).toLowerCase();
  const src = path.join(srcDir, m.file);
  const slug = slugify(m.key);
  const outFile = path.join(outDir, `${slug}.png`);
  if (fs.existsSync(outFile)) throw new Error(`${outFile} already exists`);
  const keepName = `${slug}${ext}`;
  fs.copyFileSync(src, path.join(keepDir, keepName));

  const dataUrl = `data:${MIME[ext]};base64,${fs.readFileSync(src).toString("base64")}`;
  const pngB64 = await page.evaluate(async (url) => {
    const img = new Image(); img.src = url; await img.decode();
    const size = 96;
    const scale = Math.min(size / img.naturalWidth, size / img.naturalHeight);
    const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
    const c = document.createElement("canvas"); c.width = size; c.height = size;
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, Math.round((size - w) / 2), Math.round((size - h) / 2), w, h);
    return c.toDataURL("image/png").split(",")[1];
  }, dataUrl);
  fs.writeFileSync(outFile, Buffer.from(pngB64, "base64"));
  manifest[m.key] = { sourceFile: keepName, slug };
  console.log(`${m.file} -> ${m.key} -> ${slug}.png (${m.why})`);
}
await browser.close();

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + (manifestRaw.endsWith("\n") ? "\n" : ""));
console.log(`Manifest entries: ${Object.keys(manifest).length}`);
