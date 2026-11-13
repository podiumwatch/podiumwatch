import manifest from "../src/data/team-logos.json" with { type: "json" };
import overrides from "../src/data/team-color-overrides.json" with { type: "json" };

// One primary color per school (site redesign). The same order as the
// existing teamAccentColor() in lib/team_logo_service.mjs, without its
// database import so pages and tests can use it anywhere:
//   1. a color set on the team (team_pages.primary_color, by a signed-in
//      coach or Zachary); "#00bf63" is the old default every team was
//      created with, so it does not count as a choice;
//   2. a hand override (src/data/team-color-overrides.json);
//   3. the color sampled from the team's logo (src/data/team-logos.json).
// null = no color: the page uses Podium Watch black.
export const DEFAULT_TEAM_COLOR = "#00bf63";
const hex = /^#[0-9a-f]{6}$/i;
const byBase = new Map(Object.values(manifest.teams || {}).concat(Object.values(manifest.pool || {})).map((entry) => [entry.base, entry]));
const baseOf = (url) => (String(url || "").match(/^(\/images\/teams\/(?:pool\/)?[a-z0-9-]+?)-(?:512|256|96)\.(?:png|webp)$/) || [])[1] || null;

export function teamColor(team) {
  const own = String(team?.primary_color || "").trim().toLowerCase();
  if (hex.test(own) && own !== DEFAULT_TEAM_COLOR) return own;
  const override = overrides[team?.slug];
  if (override && hex.test(override)) return override.toLowerCase();
  const sampled = byBase.get(baseOf(team?.logo_url))?.color;
  return sampled && hex.test(sampled) ? sampled.toLowerCase() : null;
}

// The team page slug for an Ohio school id, from the logo manifest (the
// same team-to-school link the team page uses to list a school's
// runners), or null.
const slugBySchool = new Map(Object.entries(manifest.teams || {}).filter(([, t]) => t.school_id).map(([slug, t]) => [t.school_id, slug]));
export function teamSlugForSchool(schoolId) {
  return slugBySchool.get(schoolId) || null;
}

// Every logo-sampled and override color (for the contrast test).
export function allSchoolColors() {
  return [...new Set([...[...byBase.values()].map((e) => e.color), ...Object.values(overrides)].filter((c) => hex.test(String(c || ""))).map((c) => c.toLowerCase()))];
}
