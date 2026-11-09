// Typeable short links (WO-34): podiumwatch.org/state -> the State hub.
// Schema: install/84_SHORT_LINKS.sql. Public route: api/s/[path].js
// (vercel.json rewrites one-segment paths that aren't real pages there).
// Admin: /admin/short-links/ via api/admin/short-links.js.

export const SHORT_PATH_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;
// Never usable as a short path, whatever the site serves.
const ALWAYS_RESERVED = new Set(["api", "admin", "s", "go", "state", "regionals", "districts", "scripts", "styles", "images", "fonts", "data", "dist", "sitemap", "robots", "rss"]);

function error(message, status = 400) {
  const value = new Error(message);
  value.status = status;
  return value;
}

async function db() {
  const { supabaseAdmin } = await import("./supabase-admin.mjs");
  return supabaseAdmin;
}

export function cleanShortPath(value) {
  return String(value ?? "").trim().toLowerCase().replace(/^\/+|\/+$/g, "");
}

// Pure. Relative site paths or https links only.
export function cleanDestination(value) {
  const text = String(value ?? "").trim();
  if (/^\/[^\s]*$/.test(text) && !text.startsWith("//")) return text;
  if (/^https:\/\/[^\s]+$/i.test(text)) return text;
  return null;
}

// Pure. phone, tablet, desktop, bot or unknown, from the user agent.
export function deviceClass(userAgent) {
  const ua = String(userAgent || "");
  if (!ua) return "unknown";
  if (/bot|crawl|spider|slurp|facebookexternalhit|preview|curl|wget|python|node-fetch/i.test(ua)) return "bot";
  if (/ipad|tablet|kindle|silk/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) return "tablet";
  if (/mobi|iphone|ipod|android/i.test(ua)) return "phone";
  return "desktop";
}

// Pure. Host name only, never the full referring URL.
export function referrerHost(referer) {
  try {
    return new URL(String(referer || "")).hostname.slice(0, 120) || null;
  } catch {
    return null;
  }
}

export async function resolveShortLink(path) {
  const clean = cleanShortPath(path);
  if (!SHORT_PATH_PATTERN.test(clean)) return null;
  const supabase = await db();
  const { data, error: readError } = await supabase.from("short_links").select("path, destination, active").eq("path", clean).maybeSingle();
  if (readError) throw readError;
  return data && data.active ? data : null;
}

export async function recordShortLinkHit({ path, referer, userAgent }) {
  const supabase = await db();
  const { error: insertError } = await supabase.from("short_link_hits").insert({ path: cleanShortPath(path), referrer_host: referrerHost(referer), device_class: deviceClass(userAgent) });
  if (insertError) console.error("Short link hit not recorded:", insertError);
}

// A path is free only if the site doesn't already serve a page there.
async function assertPathIsFree(path, siteUrl) {
  if (ALWAYS_RESERVED.has(path)) throw error(`"/${path}/" is reserved by the site. Pick another path.`, 409);
  try {
    const response = await fetch(`${siteUrl}/${path}/`, { method: "HEAD", redirect: "manual" });
    if (response.status === 200 && !response.headers.get("x-podium-short-link")) {
      throw error(`"/${path}/" is already a page on the site. Pick another path.`, 409);
    }
  } catch (checkError) {
    if (checkError.status) throw checkError;
  }
}

export async function saveShortLink({ path, destination, label, campaign, active = true, siteUrl }) {
  const cleanPath = cleanShortPath(path);
  if (!SHORT_PATH_PATTERN.test(cleanPath)) throw error("Use 1 to 40 lowercase letters, numbers or dashes, starting with a letter or number.");
  const cleanDest = cleanDestination(destination);
  if (!cleanDest) throw error("The destination must start with / (a page on the site) or https://.");
  const supabase = await db();
  const { data: existing, error: readError } = await supabase.from("short_links").select("id").eq("path", cleanPath).maybeSingle();
  if (readError) throw readError;
  if (!existing) await assertPathIsFree(cleanPath, siteUrl);
  const row = {
    path: cleanPath,
    destination: cleanDest,
    label: String(label ?? "").trim().slice(0, 120) || null,
    campaign: String(campaign ?? "").trim().slice(0, 80) || null,
    active: Boolean(active),
    updated_at: new Date().toISOString()
  };
  const query = existing
    ? supabase.from("short_links").update(row).eq("id", existing.id)
    : supabase.from("short_links").insert(row);
  const { data, error: saveError } = await query.select("*").single();
  if (saveError) throw saveError;
  return { link: data };
}

export async function setShortLinkActive({ path, active }) {
  const supabase = await db();
  const { data, error: updateError } = await supabase.from("short_links").update({ active: Boolean(active), updated_at: new Date().toISOString() }).eq("path", cleanShortPath(path)).select("*").maybeSingle();
  if (updateError) throw updateError;
  if (!data) throw error("That short link doesn't exist.", 404);
  return { link: data };
}

// Admin list: every link with hits per day for the last 14 days.
export async function listShortLinks({ days = 14, now = new Date() } = {}) {
  const supabase = await db();
  const { selectAll } = await import("./supabase_paging.mjs");
  const since = new Date(now.getTime() - days * 86400000).toISOString();
  const [linksResult, hitsResult] = await Promise.all([
    supabase.from("short_links").select("*").order("path"),
    selectAll(() => supabase.from("short_link_hits").select("id, path, hit_at, device_class").gte("hit_at", since), { maxRows: 200000 })
  ]);
  if (linksResult.error) throw linksResult.error;
  if (hitsResult.error) throw hitsResult.error;
  const dayKeys = Array.from({ length: days }, (_, index) => new Date(now.getTime() - (days - 1 - index) * 86400000).toISOString().slice(0, 10));
  const byPath = new Map();
  for (const hit of hitsResult.data || []) {
    if (hit.device_class === "bot") continue;
    const day = String(hit.hit_at).slice(0, 10);
    if (!byPath.has(hit.path)) byPath.set(hit.path, new Map());
    const counts = byPath.get(hit.path);
    counts.set(day, (counts.get(day) || 0) + 1);
  }
  return {
    days: dayKeys,
    links: (linksResult.data || []).map((link) => {
      const counts = byPath.get(link.path) || new Map();
      const perDay = dayKeys.map((day) => counts.get(day) || 0);
      return { ...link, hits_per_day: perDay, hits_total: perDay.reduce((sum, value) => sum + value, 0) };
    })
  };
}
