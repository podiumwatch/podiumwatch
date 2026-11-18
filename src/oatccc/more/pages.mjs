import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { oatcccLayout } from "../layout.mjs";
import { escapeHtml } from "../../lib/content.mjs";
import { MORE_PAGES } from "./registry.mjs";
import { resolveLinks } from "./links.mjs";
import { LINKS } from "../config.mjs";

// The OATCCC full site move: the simple pages (src/oatccc/more/registry.mjs).
// Each is built only when OATCCC_LIVE, OATCCC_MORE_LIVE and its section's
// switch are all on (config.mjs). The words come from content/<key>.html,
// copied from oatccc.com by scripts/oatccc-port-pages.mjs.

const CONTENT = path.join(path.dirname(fileURLToPath(import.meta.url)), "content");

const SECTION_LABELS = {
  about: "About the OATCCC",
  join: "Membership",
  scholarships: "Scholarships & Grants",
  forms: "Forms & Resources",
  clinics: "Clinics",
  meets: "Meets",
  academic: "Academic All-Ohio",
  polls: "Coaches' Polls",
  ms: "Middle School"
};

export function loadContent(key) {
  const file = path.join(CONTENT, `${key}.html`);
  if (!fs.existsSync(file)) return null;
  // Drop the provenance comments; keep the copied markup as is.
  return fs.readFileSync(file, "utf8").replace(/<!--[\s\S]*?-->\n?/g, "").trim();
}

// Until there is a contact form, every question for an officer or district
// rep goes to the Indoor State Meet Chair (Zachary, 2026-11-17).
const LEADER_CONTACT = `<p class="ox-lead-contact">To reach a district rep or officer, email the Indoor State Meet Chair at <a href="mailto:${LINKS.chairEmail}">${LINKS.chairEmail}</a>.</p>`;

// Page-specific touches. Words are never changed.
const TOUCHES = {
  // Rows with no file or link yet (Zachary's handoff).
  forms: (html) => html.replace(/<td>(\s*)<\/td>(\s*<\/tr>)/g, '<td><span class="ox-soon">Link coming soon</span></td>$2'),
  // Sponsors as text links, no logos (Zachary, 2026-11-16 and 11-17).
  sponsors: (html) => html.replace(/<img [^>]*>\s*/g, ""),
  // oatccc.com shows the same placeholder photo for every officer.
  leadership: (html) => html
    .replace(/<img src="[^"]*Ohio-Association-of-Track-Cross-Country-Coaches-Team\.jpg"[^>]*>\s*/g, "")
    .replace('<div class="ox-lead-groups">', `${LEADER_CONTACT}\n<div class="ox-lead-groups">`),
  // Current officers and district reps first, then past leaders by role
  // (Anjanette, 2026-11-17). The current list comes from the Leadership
  // page so the two never disagree.
  "history-of-leadership": (html) => {
    const current = (loadContent("leadership") || "").match(/<div class="ox-lead-groups">[\s\S]*?\n<\/div>/);
    return current ? `<h2>Current officers and district representatives</h2>\n${LEADER_CONTACT}\n${current[0]}\n${html}` : html;
  }
};

function sectionNav(page, flags) {
  const siblings = MORE_PAGES.filter((p) => p.section === page.section);
  if (siblings.length < 2) return "";
  const items = siblings.map((p) => `<li><a href="${p.path}"${p.key === page.key ? ' aria-current="page"' : ""}>${escapeHtml(p.title)}</a></li>`).join("");
  return `<nav class="ox-morenav" aria-label="${escapeHtml(SECTION_LABELS[page.section] || "OATCCC")}"><ul>${items}</ul></nav>`;
}

// Pages whose words come from somewhere other than oatccc.com (Zachary, 2026-11-17).
const SOURCE_LINES = {
  "middle-school": "Information from the OATCCC&rsquo;s 2027 Junior High State Meet sheet and the OATCCC&rsquo;s Middle School verification terms."
};

export function morePageHtml(site, flags, page) {
  const raw = loadContent(page.key);
  if (raw === null) return null;
  const touched = TOUCHES[page.key] ? TOUCHES[page.key](raw) : raw;
  const body = resolveLinks(touched, flags);
  const content = `<div class="ox-wrap ox-more">
  <div class="page-head"><p class="ox-kicker">${escapeHtml(SECTION_LABELS[page.section] || "OATCCC")}</p><h1>${escapeHtml(page.title)}</h1></div>
  ${sectionNav(page, flags)}
  <div class="ox-prose">${body}</div>
  <p class="ox-source">${SOURCE_LINES[page.key] || "This page is shared from oatccc.com with the OATCCC&rsquo;s permission."}</p>
</div>`;
  return oatcccLayout({ site, flags, pathname: page.path, title: page.title, description: page.description, tab: page.tab, content });
}

// Returns [{ pathname, html }] for every switched-on section.
export function oatcccMorePages(site, flags) {
  if (!flags.more) return [];
  return MORE_PAGES
    .filter((page) => flags.sections?.[page.section])
    .map((page) => ({ pathname: page.path, html: morePageHtml(site, flags, page) }))
    .filter((page) => page.html);
}
