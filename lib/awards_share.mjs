// 2026 Athlete, Team and Coach of the Year: share previews (link cards on
// Facebook, Instagram, texts). Pure helpers shared by the page function
// (api/pages/awards-2026.js), the image (api/og/awards-2026.js) and the
// tests. Real finalist rows only (yearly_award_finalists); nothing here
// invents a name, school or result.
//
// State: "vote" until voting closes, "closed" until winners are
// published, then "winner". The image URL carries the state, so a link
// card fetched after Saturday's announcement gets the WINNER card.

import { categoryStatus } from "./yearly_awards_2026.mjs";

const ROMAN = { 1: "I", 2: "II", 3: "III", 4: "IV" };
export const AWARD_NAMES = { athlete: "Athlete of the Year", team: "Team of the Year", coach: "Coach of the Year" };
export const AWARD_KIND = { athlete: "ATHLETE", team: "TEAM", coach: "COACH" };
export const CATEGORY_SLUG = /^(athlete|team|coach)-(boys|girls)-d[1-4]$/;

export const divisionLabel = (category) => `${category.gender === "boys" ? "Boys" : "Girls"} Division ${ROMAN[category.division]}`;
export const shortDivision = (category) => `${category.gender === "boys" ? "Boys" : "Girls"} D${category.division}`;
export const fullTitle = (category) => `2026 ${divisionLabel(category)} ${AWARD_NAMES[category.award]}`;
export const shortTitle = (category) => `2026 ${shortDivision(category)} ${AWARD_NAMES[category.award]}`;

// Same clean-up the page uses (public/scripts/awards-2026.js displayName):
// drops "(...)", fixes ALL CAPS names.
export function displayName(value) {
  let t = String(value == null ? "" : value).replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  if (/[A-Z]{2}/.test(t) && t === t.toUpperCase()) t = t.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (m, s, c) => s + c.toUpperCase());
  return t.split(" ").map((w, i) => { w = w.replace(/^(O['’])([a-z])/, (m, p, c) => p + c.toUpperCase()); return i > 0 ? w.replace(/^Mc([a-z])/, (m, c) => "Mc" + c.toUpperCase()) : w; }).join(" ");
}

export const slugifyName = (value) => displayName(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

// Each finalist's link name: their name ("paxson-bixler"); if two
// finalists in a category share it, both use their nominee key instead.
// public/scripts/awards-2026.js does the same.
export function finalistSlugs(finalists) {
  const counts = new Map();
  for (const item of finalists) { const s = slugifyName(item.display_name); counts.set(s, (counts.get(s) || 0) + 1); }
  return new Map(finalists.map((item) => { const s = slugifyName(item.display_name); return [item.nominee_key, s && counts.get(s) === 1 ? s : String(item.nominee_key).toLowerCase().replace(/[^a-z0-9-]/g, "")]; }));
}

export function findFinalist(finalists, slug) {
  const wanted = String(slug || "").toLowerCase();
  const slugs = finalistSlugs(finalists);
  return finalists.find((item) => slugs.get(item.nominee_key) === wanted) || null;
}

export const categoryPath = (slug) => `/awards/2026/${slug}/`;
export const finalistPath = (slug, finalistSlug) => `/awards/2026/${slug}/${finalistSlug}/`;

const effectiveClose = (category) => (category.voting_closed_early_at && category.voting_closed_early_at < category.voting_close_at ? category.voting_closed_early_at : category.voting_close_at);

// "Fri Nov 13, 9 PM" (ET).
export function closesLabel(category) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).formatToParts(new Date(effectiveClose(category)));
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  const minute = get("minute");
  return `${get("weekday")} ${get("month")} ${get("day")}, ${get("hour")}${minute && minute !== "00" ? `:${minute}` : ""} ${get("dayPeriod")}`;
}

// Announced finalists only (none before finalists_published_at), and the
// winner flag only once results are published.
export function shareState(category, finalists, { now = new Date() } = {}) {
  const announced = category.finalists_published_at ? finalists : [];
  const status = categoryStatus(category, { finalistCount: announced.length, now });
  const state = status === "published" ? "winner" : status === "voting_closed" ? "closed" : "vote";
  const list = announced.map((item) => ({ key: item.nominee_key, name: displayName(item.display_name), school: item.school || null, school_id: item.school_id || null, winner: state === "winner" && Boolean(item.winner) }));
  return { status, state, finalists: list, winners: list.filter((item) => item.winner) };
}

// Title and description for the page's share tags.
export function shareMeta(category, share, finalist = null) {
  const title = fullTitle(category);
  const closes = `Voting closes ${closesLabel(category)} ET.`;
  if (finalist) {
    const who = category.award === "coach" && finalist.school ? `${finalist.name} (${finalist.school})` : finalist.name;
    if (share.state === "winner") {
      return finalist.winner
        ? { title: `${who}, ${shortTitle(category)} winner`, description: `${who} is the ${title}. Congratulations to every finalist. See the winners at podiumwatch.org.` }
        : { title: `${who}, ${shortTitle(category)} finalist`, description: `${who} was a finalist for the ${title}. See the winner at podiumwatch.org.` };
    }
    if (share.state === "closed") return { title: `${who}, ${shortTitle(category)} finalist`, description: `Voting for the ${title} is closed. Winners are announced Saturday morning, Nov. 14, at podiumwatch.org.` };
    return { title: `Vote for ${who}, ${shortTitle(category)} finalist`, description: `Vote for ${who} for the ${title}. You can vote once an hour. ${closes}` };
  }
  const names = share.finalists.map((item) => item.name);
  const list = names.length > 6 ? `${names.slice(0, 6).join(", ")} and ${names.length - 6} more` : names.join(", ");
  if (share.state === "winner") {
    const winner = share.winners.map((item) => item.name).join(" and ");
    return { title: winner ? `Winner: ${title}` : title, description: winner ? `${winner} ${share.winners.length > 1 ? "are" : "is"} the ${title}. See every 2026 Podium Watch award winner at podiumwatch.org.` : `See the ${title} at podiumwatch.org.` };
  }
  if (share.state === "closed") return { title: `${title}: voting closed`, description: `Voting is closed. Winners are announced Saturday morning, Nov. 14.${list ? ` Finalists: ${list}.` : ""}` };
  return { title: `Vote: ${title}`, description: `Vote for the ${title} in Ohio cross country.${list ? ` Finalists: ${list}.` : ""} ${closes}` };
}

// The share image URL (absolute). "v" changes with the state and the
// finalist list, so a cached card is never reused after either changes.
export function shareImageUrl(siteUrl, category, share, finalist = null) {
  const signature = `${share.state}-${share.finalists.map((item) => `${item.key}${item.winner ? "w" : ""}`).join(".")}`;
  let hash = 0;
  for (const ch of signature) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const params = new URLSearchParams({ category: category.slug, ...(finalist ? { finalist: finalist.key } : {}), v: `${share.state}${hash.toString(36)}` });
  return `${siteUrl}/api/og/awards-2026/?${params.toString()}`;
}
