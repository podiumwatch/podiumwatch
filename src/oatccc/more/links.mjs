import { MORE_PAGES, HOF_PATHS, AWARD_PAGES } from "./registry.mjs";
import { INDOOR_PAGES, indoorPath } from "../config.mjs";

// Where an oatccc.com address goes on Podium Watch, decided at build time:
//   - a page we moved, when its section is switched on -> our page
//   - a file, when OATCCC_FILES_HOSTED=1 and the build knows SUPABASE_URL
//     -> the oatccc-public Storage bucket, same path as on oatccc.com
//   - anything else -> unchanged (oatccc.com, Google, other sites)
// The same table drives the redirect map (scripts/oatccc-redirect-map.mjs).

export const OATCCC_ORIGIN = "https://www.oatccc.com";
export const STORAGE_BUCKET = "oatccc-public";
export const FILE_EXT = /\.(pdf|jpe?g|png|gif|webp|bmp|svg|docx?|xlsx?|pptx?|txt|csv|zip|mp4|mov|mp3)$/i;

const norm = (p) => {
  let path = decodeURI(String(p || "/"));
  if (!path.startsWith("/")) path = `/${path}`;
  if (!FILE_EXT.test(path) && !path.endsWith("/")) path += "/";
  return path.toLowerCase();
};

// Inductee page slug from an oatccc.com bio path:
// /HOF/View-Bio/A-W-Hendricks-1973/ -> a-w-hendricks-1973
export function inducteeSlug(oldPath) {
  const m = String(oldPath).match(/\/HOF\/View-Bio\/([^/]+)\/?$/i);
  return m ? m[1].toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") : null;
}

// Old path -> { path, section } for every page that moves.
export function pageTable() {
  const table = new Map();
  for (const page of MORE_PAGES) for (const old of page.old) table.set(norm(old), { path: page.path, section: page.section });
  table.set(norm("/HOF/"), { path: HOF_PATHS.hof, section: "hof" });
  table.set(norm("/HOF/View-Bio/"), { path: HOF_PATHS.hof, section: "hof" });
  for (const award of AWARD_PAGES) table.set(norm(award.old), { path: `${HOF_PATHS.awards}${award.slug}/`, section: "hof" });
  table.set(norm("/Indoor-Track-Field/High-School-State-Meet/"), { path: indoorPath("overview"), section: "indoorFull" });
  return table;
}

function sectionOn(section, flags) {
  if (section === "indoorFull") return Boolean(flags.indoorFull);
  return Boolean(flags.sections?.[section]);
}

export function storageBase(env = process.env) {
  const url = String(env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  return url ? `${url}/storage/v1/object/public/${STORAGE_BUCKET}` : null;
}

// Storage key for an oatccc.com file path: the same path without the
// leading slash ("Media/Longevity-Form.pdf").
export function storageKey(oldPath) {
  return decodeURI(String(oldPath)).replace(/^\/+/, "");
}

let TABLE = null;
export function resolveHref(href, flags, env = process.env) {
  let u;
  try { u = new URL(href, OATCCC_ORIGIN); } catch { return href; }
  if (!/^(www\.)?oatccc\.com$/i.test(u.hostname)) return href;
  if (FILE_EXT.test(u.pathname)) {
    const base = flags.filesHosted ? storageBase(env) : null;
    return base ? `${base}/${encodeURI(storageKey(u.pathname))}` : href;
  }
  TABLE = TABLE || pageTable();
  const hit = TABLE.get(norm(u.pathname));
  if (hit && sectionOn(hit.section, flags)) return hit.path + (u.hash || "");
  const slug = inducteeSlug(u.pathname);
  if (slug && flags.sections?.hof) return `${HOF_PATHS.hof}${slug}/`;
  return href;
}

// Rewrites every href and src in a page body; external links open in a
// new tab.
export function resolveLinks(html, flags, env = process.env) {
  return String(html)
    .replace(/<a href="([^"]*)"/g, (_, href) => {
      const to = resolveHref(href.replace(/&amp;/g, "&"), flags, env).replace(/&/g, "&amp;");
      return /^https?:\/\//i.test(to) ? `<a href="${to}" target="_blank" rel="noopener noreferrer"` : `<a href="${to}"`;
    })
    .replace(/<img src="([^"]*)"/g, (_, src) => `<img src="${resolveHref(src.replace(/&amp;/g, "&"), flags, env).replace(/&/g, "&amp;")}"`);
}

// The tab bar and hub cards: our page when its section is on.
export function sectionHref(section, ourPath, oatcccUrl, flags) {
  return sectionOn(section, flags) ? ourPath : oatcccUrl;
}

export { INDOOR_PAGES };
