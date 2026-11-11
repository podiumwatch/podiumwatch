import { colorSlug, merchConfig } from "../src/lib/merch_card.mjs";

// Podium Watch Store card: the admin on/off switch (Redis key below; a
// missing key means "use src/data/merch.json") and where a click goes.

const KEY = "pw:merch:enabled";

async function redis() {
  const { redisAdmin } = await import("./redis-admin.mjs");
  return redisAdmin;
}

// The admin switch is read at most once a minute per server instance
// (2026-11-10), not on every request; the public endpoint is also cached
// a minute at the edge. A switch flip can take about a minute to show.
let switchCache = null;
const SWITCH_CACHE_MS = 60_000;

// On only when the settings file says on and the admin hasn't switched it off.
export async function merchStatus({ fresh = false } = {}) {
  if (!merchConfig.enabled) return { enabled: false, file_enabled: false, admin_enabled: null };
  let admin = null;
  if (!fresh && switchCache && Date.now() - switchCache.at < SWITCH_CACHE_MS) admin = switchCache.value;
  else {
    try {
      const value = await (await redis()).get(KEY);
      admin = value === null || value === undefined ? null : String(value) === "1";
      switchCache = { at: Date.now(), value: admin };
    } catch {
      admin = null; // Redis down: follow the file
    }
  }
  return { enabled: admin !== false, file_enabled: true, admin_enabled: admin };
}

export async function setMerchEnabled(enabled) {
  await (await redis()).set(KEY, enabled ? "1" : "0");
  switchCache = null;
  return merchStatus({ fresh: true });
}

// Where a card click goes (2026-11-11): the chosen color's own store link
// (the store opens with that color selected), else the product, else the
// store home; with UTM tags. Awards placements keep the awards campaign;
// everywhere else uses the site merch campaign. utm_content is
// "{placement}-{product}-{color}" ("nav" alone for the menu link).
export function merchDestination(productId, colorSlugValue = "", placement = "") {
  const product = merchConfig.products.find((p) => p.id === productId);
  const color = product?.colors.find((c) => colorSlug(c.name) === String(colorSlugValue || "").toLowerCase());
  const url = new URL(color?.url || product?.url || merchConfig.store_url);
  const awards = (merchConfig.awards_placements || []).includes(placement);
  for (const [key, value] of Object.entries((awards ? merchConfig.utm?.awards : merchConfig.utm?.site) || {})) url.searchParams.set(key, value);
  const content = [placement, product?.id, color ? colorSlug(color.name) : ""].filter(Boolean).join("-");
  if (content) url.searchParams.set("utm_content", content.slice(0, 120));
  return url.toString();
}
