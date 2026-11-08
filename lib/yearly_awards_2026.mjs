import fs from "node:fs/promises";

// 2026 Athlete of the Year / Team of the Year: the parts with no database
// access, shared by the build (static pages) and the API routes. Pool:
// public/data/yearly-awards-2026-pool.json (real 2026 state qualifiers,
// built by scripts/build-yearly-awards-2026-pool.mjs). Schema:
// install/76_YEARLY_AWARDS_2026.sql. Database work lives in
// lib/yearly_awards_2026_service.mjs.
const poolUrl = new URL("../public/data/yearly-awards-2026-pool.json", import.meta.url);

// Same values the migration seeds. The database row is the source of
// truth on the server; static pages use these for their first paint.
export const YEARLY_AWARDS_SCHEDULE = {
  nominations_open_at: "2026-11-08T00:00:00Z",
  nominations_close_at: "2026-11-10T02:00:00Z",
  voting_open_at: "2026-11-10T05:00:00Z",
  voting_close_at: "2026-11-14T02:00:00Z"
};

let poolPromise = null;

export async function loadYearlyAwardsPool() {
  if (!poolPromise) poolPromise = fs.readFile(poolUrl, "utf8").then((text) => JSON.parse(text));
  return poolPromise;
}

// Every nominee for one category, in one shape: { id, name, school, ... }.
export function categoryPool(pool, slug) {
  const category = pool.categories.find((item) => item.slug === slug);
  if (!category) return null;
  return category.award === "athlete" ? pool.athletes[slug] || [] : pool.teams[slug] || [];
}

export function findNominee(pool, slug, nomineeId) {
  const list = categoryPool(pool, slug);
  if (!list) return null;
  return list.find((item) => item.id === String(nomineeId ?? "").trim()) || null;
}

// Status from the clock, every time. Statuses:
//   upcoming, nominations_open, selecting_finalists, voting_open,
//   finalists_coming_soon (voting window but no finalists yet),
//   voting_closed, published.
export function categoryStatus(category, { finalistCount = 0, now = new Date() } = {}) {
  const t = now.getTime();
  const at = (value) => (value ? new Date(value).getTime() : null);
  if (category.results_published_at && at(category.results_published_at) <= t) return "published";
  if (t < at(category.nominations_open_at)) return "upcoming";
  if (t < at(category.nominations_close_at)) return "nominations_open";
  if (t < at(category.voting_open_at)) return "selecting_finalists";
  const votingEnd = Math.min(at(category.voting_close_at), at(category.voting_closed_early_at) ?? Infinity);
  if (t < votingEnd) return finalistCount > 0 ? "voting_open" : "finalists_coming_soon";
  return "voting_closed";
}

export function ordinal(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  const mod100 = n % 100;
  const suffix = mod100 >= 11 && mod100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" })[n % 10] || "th";
  return `${n}${suffix}`;
}

// "Mon, Nov 9 at 9:00 PM ET"
export function formatEt(iso) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).formatToParts(new Date(iso));
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${get("weekday")}, ${get("month")} ${get("day")} at ${get("hour")}:${get("minute")} ${get("dayPeriod")} ET`;
}
