// Story photo crop points (2026-11-10). Story photos are shown cropped to
// a wide 16:9 frame on the front page, story cards and story headers. A
// center crop cuts off faces in tall photos, so every story photo gets a
// crop point: sharp's "attention" crop finds the subject (faces, skin
// tones, contrast) and that becomes the CSS object-position.
//   - A story's own featuredImagePosition always wins (set it by hand when
//     the automatic one isn't right).
//   - Results are cached in src/data/image-focus.json by the photo's
//     content hash, so a build only works out new or changed photos.
//   - If sharp isn't available the build still works; uncached photos keep
//     the center crop and a warning is printed.
//
//   node scripts/image-focus.mjs        report every story photo's crop point
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = path.join(root, "src/data/image-focus.json");
const FRAME = { width: 1600, height: 900 };

let sharpModule;
async function getSharp() {
  if (sharpModule === undefined) {
    try { sharpModule = (await import("sharp")).default; } catch { sharpModule = null; }
  }
  return sharpModule;
}

const readCache = () => { try { return JSON.parse(fs.readFileSync(CACHE, "utf8")); } catch { return { note: "", images: {} }; } };

// Where sharp's attention crop lands in a 16:9 frame, as "x% y%".
export async function attentionPosition(file) {
  const sharp = await getSharp();
  if (!sharp) return null;
  const meta = await sharp(file).metadata();
  const { info } = await sharp(file).resize(FRAME.width, FRAME.height, { fit: "cover", position: sharp.strategy.attention }).toBuffer({ resolveWithObject: true });
  const scale = Math.max(FRAME.width / meta.width, FRAME.height / meta.height);
  const extraX = meta.width * scale - FRAME.width;
  const extraY = meta.height * scale - FRAME.height;
  const pct = (offset, extra) => (extra > 1 ? Math.round(Math.min(100, Math.max(0, (Math.abs(offset || 0) / extra) * 100))) : 50);
  return `${pct(info.cropOffsetLeft, extraX)}% ${pct(info.cropOffsetTop, extraY)}%`;
}

const isPhoto = (src) => /^\/images\/.+\.(jpe?g|png|webp)$/i.test(String(src || "")) && !/story_fallback/.test(src);

// Gives every story with a photo a featuredImagePosition (unless it has
// one) and records where each came from. Returns { computed, cached, missing }.
export async function applyImageFocus(stories, { write = true } = {}) {
  const cache = readCache();
  cache.note = "Written by scripts/image-focus.mjs: automatic crop points (sharp attention) for story photos in a 16:9 frame. A story's own featuredImagePosition wins.";
  cache.images ||= {};
  const stats = { computed: 0, cached: 0, missing: [] };
  // final: the crop each story photo actually gets (hand-set, automatic or
  // "contain"). The server reads it for front page leads and picks, their
  // share cards and the /front-page/ archive (lib/story_image_focus.mjs).
  const final = {};
  for (const story of stories) {
    const src = story.featuredImage || story.heroImage;
    if (!isPhoto(src)) continue;
    if (story.featuredImageFit === "contain") { final[src] = { fit: "contain" }; continue; }
    const file = path.join(root, "public", src);
    if (!fs.existsSync(file)) continue;
    // Keyed by content, not file time: a fresh checkout (Vercel) has new
    // file times but the same photos. Width and height are kept so share
    // cards (@vercel/og ignores object-position) can crop by hand.
    const hash = crypto.createHash("sha1").update(fs.readFileSync(file)).digest("hex").slice(0, 16);
    let entry = cache.images[src]?.hash === hash ? cache.images[src] : null;
    if (!entry || !entry.width || (!story.featuredImagePosition && !entry.position)) {
      const sharp = await getSharp();
      const meta = sharp ? await sharp(file).metadata().catch(() => null) : null;
      const position = story.featuredImagePosition ? entry?.position || null : await attentionPosition(file).catch(() => null);
      if (!meta || (!story.featuredImagePosition && !position)) { stats.missing.push(src); if (story.featuredImagePosition) final[src] = { position: story.featuredImagePosition }; continue; }
      entry = { hash, width: meta.width, height: meta.height, ...(position ? { position } : {}) };
      cache.images[src] = entry;
      stats.computed += 1;
    } else stats.cached += 1;
    if (story.featuredImagePosition) story.imagePositionSource = "story";
    else { story.featuredImagePosition = entry.position; story.imagePositionSource = "auto"; }
    final[src] = { position: story.featuredImagePosition, width: entry.width, height: entry.height };
  }
  const changed = stats.computed > 0 || JSON.stringify(cache.final || {}) !== JSON.stringify(final);
  cache.final = final;
  if (write && changed) fs.writeFileSync(CACHE, JSON.stringify(cache, null, 2) + "\n");
  return stats;
}
