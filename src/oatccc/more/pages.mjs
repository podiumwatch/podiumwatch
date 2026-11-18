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

// Current leaders come from Matt Schock's 2026 list (src/oatccc/more/leaders.json,
// made by scripts/oatccc-leaders-import.mjs; Zachary, 2026-11-18). Each person
// has one Email button that writes to all of their addresses at once. The
// addresses are stored encoded and only turned into a mailto link when tapped
// (scripts/oatccc-email.js). Without JavaScript the button jumps to the
// Indoor State Meet Chair contact line, which only shows in that case.
const LEADERS_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "leaders.json");
const LEADER_FALLBACK = `<noscript><p class="ox-lead-contact" id="ox-lead-fallback">To reach a district rep or officer, email the Indoor State Meet Chair at <a href="mailto:${LINKS.chairEmail}">${LINKS.chairEmail}</a>.</p></noscript>`;
const OFFICER_ORDER = ["President", "Vice President", "Secretary", "Treasurer", "Past President"];
const LIAISON_ORDER = ["OHSAA Liaison", "College Liaison"];

function leaderCard(person) {
  const open = !person.name;
  const photo = person.photo ? `<img class="ox-leader-photo" src="${escapeHtml(person.photo)}" alt="" width="72" height="72" loading="lazy">` : "";
  const email = person.e && person.e.length
    ? `<a class="btn2 ox-leader-email" href="#ox-lead-fallback" data-ox-e="${person.e.map(escapeHtml).join(" ")}" aria-label="Email ${escapeHtml(person.name)}">Email</a>`
    : "";
  return `<li class="ox-leader${open ? " ox-leader-open" : ""}">${photo}<div class="ox-leader-text"><span class="ox-leader-role">${escapeHtml(person.role)}</span><strong>${open ? "Open" : escapeHtml(person.name)}</strong>${person.affiliation ? `<span class="ox-leader-aff">${escapeHtml(person.affiliation)}</span>` : ""}</div>${email}</li>`;
}

export function currentLeadersHtml() {
  if (!fs.existsSync(LEADERS_FILE)) return null;
  const { leaders } = JSON.parse(fs.readFileSync(LEADERS_FILE, "utf8"));
  const officers = OFFICER_ORDER.flatMap((role) => leaders.filter((p) => p.role === role));
  const liaisons = LIAISON_ORDER.flatMap((role) => leaders.filter((p) => p.role === role));
  const districts = new Map();
  for (const p of leaders) {
    const m = p.role.match(/^(Alternate )?District (\d+)$/);
    if (!m) continue;
    const seat = districts.get(+m[2]) || [];
    seat[m[1] ? 1 : 0] = p;
    districts.set(+m[2], seat);
  }
  const placed = new Set([...officers, ...liaisons, ...[...districts.values()].flat()]);
  const chairs = leaders.filter((p) => !placed.has(p));
  const list = (people) => `<ul class="ox-lead-list">\n${people.map(leaderCard).join("\n")}\n</ul>`;
  const districtHtml = [...districts.keys()].sort((a, b) => a - b).map((n) =>
    `<div class="ox-district"><h4>District ${n}</h4>\n<ul class="ox-lead-list ox-lead-pair">\n${districts.get(n).filter(Boolean).map(leaderCard).join("\n")}\n</ul></div>`).join("\n");
  return `${LEADER_FALLBACK}
<div class="ox-lead-groups">
<h3 class="ox-lead-group">Officers</h3>
${list(officers)}
<h3 class="ox-lead-group">District representatives</h3>
<div class="ox-districts">
${districtHtml}
</div>
<h3 class="ox-lead-group">Chairs and committees</h3>
${list(chairs)}
<h3 class="ox-lead-group">Liaisons</h3>
${list(liaisons)}
</div>`;
}

const LEAD_GROUPS = /<div class="ox-lead-groups">[\s\S]*?\n<\/div>/;

// Page-specific touches. Words are never changed.
const TOUCHES = {
  // Rows with no file or link yet (Zachary's handoff).
  forms: (html) => html.replace(/<td>(\s*)<\/td>(\s*<\/tr>)/g, '<td><span class="ox-soon">Link coming soon</span></td>$2'),
  // Sponsors as text links, no logos (Zachary, 2026-11-16 and 11-17).
  sponsors: (html) => html.replace(/<img [^>]*>\s*/g, ""),
  // oatccc.com shows the same placeholder photo for every officer.
  leadership: (html) => html
    .replace(/<img src="[^"]*Ohio-Association-of-Track-Cross-Country-Coaches-Team\.jpg"[^>]*>\s*/g, "")
    .replace(LEAD_GROUPS, (old) => currentLeadersHtml() || old),
  // Current officers and district reps first, then past leaders by role
  // (Anjanette, 2026-11-17). The current list comes from the Leadership
  // page so the two never disagree.
  "history-of-leadership": (html) => {
    const past = collapsePastTables(html);
    const current = currentLeadersHtml();
    return current ? `<h2>Current officers and district representatives</h2>\n${current}\n${past}` : past;
  }
};

// Past-leader tables, layout only (Zachary, 2026-11-17): each role becomes a
// section the reader taps open, and every cell gets its column name so phones
// can show each row as a stacked block. Rows, names, years and spellings are
// left exactly as oatccc.com has them, in the same order.
function collapsePastTables(html) {
  return html.replace(/<h3>([^<]+)<\/h3>\s*(<table class="ox-past">[\s\S]*?<\/table>)/g, (all, role, table) => {
    const heads = [...table.matchAll(/<th scope="col">([^<]*)<\/th>/g)].map((m) => m[1]);
    const labelled = table.replace(/<tr>((?:<td>[\s\S]*?<\/td>)+)<\/tr>/g, (row, cells) => {
      let i = 0;
      return `<tr>${cells.replace(/<td>/g, () => `<td data-l="${heads[i++] || ""}">`)}</tr>`;
    });
    return `<details class="ox-past-sec">\n<summary>${role}</summary>\n${labelled}\n</details>`;
  });
}

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
  const scripts = /data-ox-e="/.test(body) ? ["/scripts/oatccc-email.js"] : [];
  return oatcccLayout({ site, flags, pathname: page.path, title: page.title, description: page.description, tab: page.tab, content, scripts });
}

// Returns [{ pathname, html }] for every switched-on section.
export function oatcccMorePages(site, flags) {
  if (!flags.more) return [];
  return MORE_PAGES
    .filter((page) => flags.sections?.[page.section])
    .map((page) => ({ pathname: page.path, html: morePageHtml(site, flags, page) }))
    .filter((page) => page.html);
}
