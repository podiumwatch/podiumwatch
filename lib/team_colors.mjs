import seeded from "../src/data/team-colors.json" with { type: "json" };

// One primary color per school (site redesign, 2026-11-13). A color set on
// the team itself (team_pages.primary_color, by a signed-in coach or
// Zachary) wins; "#00bf63" is the old default every team was created
// with, so it does not count as a choice. Otherwise the color seeded from
// the team's logo (src/data/team-colors.json, scripts/team-colors.mjs).
// null = no color: the page uses Podium Watch black.
export const DEFAULT_TEAM_COLOR = "#00bf63";
const SEEDED = seeded.colors || {};

export function teamColor(team) {
  const own = String(team?.primary_color || "").trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(own) && own !== DEFAULT_TEAM_COLOR) return own;
  return SEEDED[team?.slug] || null;
}
