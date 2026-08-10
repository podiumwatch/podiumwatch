import { escapeHtml } from "./content.mjs";

// The registry of Podium Watch's free public math tools (docs/FEATURE_ROADMAP.md
// Phase 1). Each page renders a link to the others via toolsCrosslink()
// rather than every page hand-writing pairwise links to every other page
// -- with 2 tools that's one link each way, but by the 3rd tool that
// becomes 6 hand-maintained links across 3 files, and a 4th tool would
// mean going back to edit all 3 existing pages. Adding a tool here
// updates every existing page's crosslink box automatically.
export const PODIUM_TOOLS = [
  { href: "/pace-calculator/", label: "Race pace calculator", blurb: "the 6 standard track and cross country race distances" },
  { href: "/splits-calculator/", label: "Splits calculator", blurb: "any goal time and distance, including a marathon or half marathon" },
  { href: "/scoring-calculator/", label: "Meet scoring calculator", blurb: "dual and invitational team scoring from a finish order" }
];

// pageHero()'s own description field is HTML-escaped (see src/lib/html.mjs),
// so it can't hold a real <a> -- this renders as a small standalone
// callout instead, meant to be placed inside a tool page's own content
// container (see src/pages/pacecalculator.mjs, splitscalculator.mjs,
// scoringcalculator.mjs for the .tool-crosslink CSS and placement, which
// deliberately sits inside the paper-section tool container rather than
// in a bare strip between the hero and the section -- an earlier version
// of this crosslink did that and looked visually broken).
export function toolsCrosslink(currentPathname) {
  const others = PODIUM_TOOLS.filter((tool) => tool.href !== currentPathname);
  if (others.length === 0) return "";

  const items = others
    .map((tool) => `<a href="${tool.href}">${escapeHtml(tool.label)}</a> &ndash; ${escapeHtml(tool.blurb)}`)
    .join("<br>");

  return `<p class="tool-crosslink">More free tools:<br>${items}</p>`;
}
