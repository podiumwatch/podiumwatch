import { merchConfig } from "../src/lib/merch_card.mjs";

// Podium Watch Store card: the admin on/off switch (Redis key below; a
// missing key means "use src/data/merch.json") and where a click goes.

const KEY = "pw:merch:enabled";

async function redis() {
  const { redisAdmin } = await import("./redis-admin.mjs");
  return redisAdmin;
}

// On only when the settings file says on and the admin hasn't switched it off.
export async function merchStatus() {
  if (!merchConfig.enabled) return { enabled: false, file_enabled: false, admin_enabled: null };
  let admin = null;
  try {
    const value = await (await redis()).get(KEY);
    admin = value === null || value === undefined ? null : String(value) === "1";
  } catch {
    admin = null; // Redis down: follow the file
  }
  return { enabled: admin !== false, file_enabled: true, admin_enabled: admin };
}

export async function setMerchEnabled(enabled) {
  await (await redis()).set(KEY, enabled ? "1" : "0");
  return merchStatus();
}

// The store page for a product (its own page when we have one), with the
// awards campaign tags.
export function merchDestination(productId) {
  const product = merchConfig.products.find((p) => p.id === productId);
  const url = new URL(product?.url || merchConfig.store_url);
  for (const [key, value] of Object.entries(merchConfig.utm || {})) url.searchParams.set(key, value);
  return url.toString();
}
