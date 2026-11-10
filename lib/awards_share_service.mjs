import fs from "node:fs";
import path from "node:path";
import pool from "../public/data/yearly-awards-2026-pool.json" with { type: "json" };
import manifest from "../src/data/team-logos.json" with { type: "json" };
import aliases from "../src/data/awards-2026-school-aliases.json" with { type: "json" };
import { CATEGORY_SLUG, shareState } from "./awards_share.mjs";

// Data for the awards share previews (api/pages/awards-2026.js and
// api/og/awards-2026.js): one category and its finalists from Supabase,
// cached a minute per server instance. Never reads Redis (no vote counts
// on a share card).

const CATEGORY_COLUMNS = "id, slug, award, gender, division, label, nominations_open_at, nominations_close_at, voting_open_at, voting_close_at, voting_closed_early_at, finalists_published_at, results_published_at";
const FINALIST_COLUMNS = "nominee_key, school_id, display_name, school, sort_order, winner";
const CACHE_MS = 60_000;
const cache = new Map();

export async function loadShareCategory(slug, { now = new Date() } = {}) {
  const clean = String(slug || "").toLowerCase();
  if (!CATEGORY_SLUG.test(clean)) return null;
  const hit = cache.get(clean);
  let rows = hit && Date.now() - hit.at < CACHE_MS ? hit.value : null;
  if (!rows) {
    const { supabaseAdmin } = await import("./supabase-admin.mjs");
    const { data: category, error } = await supabaseAdmin.from("yearly_award_categories").select(CATEGORY_COLUMNS).eq("slug", clean).eq("season", 2026).maybeSingle();
    if (error) throw error;
    if (!category) return null;
    const { data: finalists, error: finalistError } = await supabaseAdmin.from("yearly_award_finalists").select(FINALIST_COLUMNS).eq("category_id", category.id).order("sort_order").order("display_name");
    if (finalistError) throw finalistError;
    rows = { category, finalists: finalists || [] };
    cache.set(clean, { at: Date.now(), value: rows });
  }
  return { ...rows, share: shareState(rows.category, rows.finalists, { now }) };
}

// School name -> school ID, from every school in the awards pool (as
// "Name" and "City Name", the way athlete rows label schools), plus the
// checked aliases in src/data/awards-2026-school-aliases.json. A name that
// could be two schools is left out (no logo rather than a wrong one).
let schoolIndex = null;
function schoolIdByName(name) {
  if (!schoolIndex) {
    const found = new Map();
    for (const list of Object.values(pool.coaches || {})) for (const school of list) {
      for (const label of [school.name, `${school.city} ${school.name}`]) {
        if (!found.has(label)) found.set(label, new Set());
        found.get(label).add(school.schoolId);
      }
    }
    schoolIndex = new Map([...found].filter(([, ids]) => ids.size === 1).map(([label, ids]) => [label, [...ids][0]]));
    for (const [label, entry] of Object.entries(aliases.aliases || {})) schoolIndex.set(label, entry.school_id);
  }
  return schoolIndex.get(String(name || "").trim()) || null;
}

// { base, color } for a finalist's school, or null.
export function finalistLogo(finalist, award) {
  const id = finalist.school_id || schoolIdByName(award === "team" ? finalist.name : finalist.school);
  const entry = id ? manifest.schools?.[id] : null;
  return entry?.base ? { base: entry.base, color: entry.color || null } : null;
}

// The 256 px PNG as a data URL (@vercel/og doesn't take webp): from disk
// when the file is there, otherwise from the site. Cached per instance.
// Any problem leaves the initials in place of the logo.
const logoCache = new Map();
export async function logoDataUrl(base, siteUrl) {
  if (!base) return null;
  if (logoCache.has(base)) return logoCache.get(base);
  let value = null;
  try {
    const local = path.join(process.cwd(), "public", `${base}-256.png`);
    let bytes = fs.existsSync(local) ? fs.readFileSync(local) : null;
    if (!bytes) {
      const res = await fetch(`${siteUrl}${base}-256.png`, { signal: AbortSignal.timeout(6000) });
      if (res.ok && String(res.headers.get("content-type") || "").includes("image/png")) bytes = Buffer.from(await res.arrayBuffer());
    }
    if (bytes) value = `data:image/png;base64,${bytes.toString("base64")}`;
  } catch {
    value = null;
  }
  logoCache.set(base, value);
  return value;
}
