// Site redesign shared parts (step 1, 2026-11-13). Built once here and
// used by every redesigned page type (SITE_REDESIGN_MASTER_HANDOFF.md):
// the page header band, tabs, filter chips, data table with "Show more",
// stat cards and podium cards. Styles: src/styles/main.css, section
// "Redesign shared parts". Behavior (tabs scrolled into view, Show more):
// public/scripts/site.js.
//
// Layout only. Every value shown comes from the caller's real data; a
// module with no data renders nothing.
import { escapeHtml } from "./content.mjs";

const e = escapeHtml;
const hasValue = (value) => value !== null && value !== undefined && String(value).trim() !== "";
const genderClass = (gender) => (gender === "girls" ? " pw-girls" : gender === "boys" ? " pw-boys" : "");

// ---- School color (team and athlete pages) --------------------------------
// White text on the band must pass WCAG AA (4.5:1). A school color that
// fails is darkened until it passes; anything unusable falls back to
// Podium Watch black.
const PW_BLACK = "#090909";
function channel(v) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
export function contrastWithWhite(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const lum = 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  return 1.05 / (lum + 0.05);
}
export function bandColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return PW_BLACK;
  let [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  for (let step = 0; step < 40; step += 1) {
    const candidate = `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
    if (contrastWithWhite(candidate) >= 4.5) return candidate;
    [r, g, b] = [r * 0.92, g * 0.92, b * 0.92];
  }
  return PW_BLACK;
}

// "Springboro" -> "S", "Little Miami" -> "LM": the plain tile for a school
// with no logo.
export function schoolInitials(name) {
  return String(name || "").split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

export function logoTile({ src = null, name = "", size = "lg" } = {}) {
  const cls = `pw-logo pw-logo-${size}`;
  if (src) return `<span class="${cls}"><img src="${e(src)}" alt="${e(name ? `${name} logo` : "School logo")}" loading="lazy" decoding="async"></span>`;
  return `<span class="${cls} pw-logo-initials" aria-hidden="true">${e(schoolInitials(name))}</span>`;
}

// ---- Breadcrumb, tabs, page band -------------------------------------------
export function bandCrumbs(items = []) {
  if (!items.length) return "";
  return `<nav class="pw-crumbs" aria-label="Breadcrumb"><ol>${items.map((item, i) => `<li>${item.href && i < items.length - 1 ? `<a href="${e(item.href)}">${e(item.label)}</a>` : `<span aria-current="page">${e(item.label)}</span>`}</li>`).join("")}</ol></nav>`;
}

// tabs: [{ label, href, active, gender }]. A horizontal row attached to the
// bottom of the band; scrolls sideways on a phone (site.js scrolls the
// active tab into view on load).
export function tabsRow(tabs = [], { label = "Sections" } = {}) {
  if (!tabs.length) return "";
  return `<nav class="pw-tabs" aria-label="${e(label)}" data-pw-tabs>${tabs.map((tab) => `<a class="pw-tab${genderClass(tab.gender)}" href="${e(tab.href)}"${tab.active ? ' aria-current="page"' : ""}>${e(tab.label)}</a>`).join("")}</nav>`;
}

// The black (or school-color) band: breadcrumb, large title, one line of
// context, optional logo tile and honor tags, then tabs.
// extra: optional HTML placed under the context line (e.g. a search box).
// contextHtml: the context line as trusted HTML (e.g. with a school link),
// used instead of context.
export function pageBand({ crumbs = [], title, context = "", contextHtml = "", tabs = [], tabsLabel, color = null, logo = null, honors = [], credit = "", extra = "" } = {}) {
  const bg = color ? bandColor(color) : null;
  const honorList = honors.filter((h) => hasValue(h.label));
  return `<section class="pw-band${bg ? " pw-band-school" : ""}"${bg ? ` style="--pw-band:${bg}"` : ""}>
  <div class="container pw-band-inner">
    ${bandCrumbs(crumbs)}
    <div class="pw-band-id">
      ${logo ? logoTile(logo) : ""}
      <div>
        <h1>${e(title)}</h1>
        ${contextHtml ? `<p class="pw-band-context">${contextHtml}</p>` : hasValue(context) ? `<p class="pw-band-context">${e(context)}</p>` : ""}
        ${credit || ""}
      </div>
    </div>
    ${extra || ""}
    ${honorList.length ? `<ul class="pw-honors">${honorList.map((h) => `<li${h.featured ? ' class="pw-honor-featured"' : ""}>${e(h.label)}${hasValue(h.note) ? `<small>${e(h.note)}</small>` : ""}</li>`).join("")}</ul>` : ""}
    ${tabsRow(tabs, { label: tabsLabel || "Sections" })}
  </div>
</section>`;
}

// ---- Filter chips -----------------------------------------------------------
// rows: [{ label, options: [{ label, href, active, gender }] }]. Chips are
// links, so a filtered view is a real, shareable URL (and works without
// JavaScript). One choice per row. Boys chip green, girls chip pink; the
// text always says Boys or Girls.
export function filterChips(rows = [], { label = "Filters" } = {}) {
  const shown = rows.filter((row) => (row.options || []).length > 1);
  if (!shown.length) return "";
  return `<div class="pw-filters" role="group" aria-label="${e(label)}"><div class="container pw-filters-inner">${shown.map((row) => `<div class="pw-chip-row"><span class="pw-chip-label">${e(row.label)}</span><div class="pw-chip-set">${row.options.map((opt) => `<a class="pw-chip${genderClass(opt.gender)}" href="${e(opt.href)}"${opt.active ? ' aria-current="true"' : ""}>${e(opt.label)}</a>`).join("")}</div></div>`).join("")}</div></div>`;
}

// ---- Data table ---------------------------------------------------------------
// columns: [{ key, label, kind: "rank"|"name"|"time"|"text"|"tag", phone: false }]
// rows: [{ <key>: value }]; a "name" value is { text, href, sub, tags }.
// The first `first` rows show; the rest are in the HTML, hidden, behind
// "Show N more" (expands in place). Low-value columns (phone: false) drop
// on a phone; the table never scrolls sideways.
export function dataTable({ id, caption = "", columns = [], rows = [], first = rows.length, moreLabel = (n) => `Show ${n} more`, gender = null } = {}) {
  if (!rows.length) return "";
  const head = columns.map((col) => `<th scope="col" class="pw-col-${e(col.kind || "text")}${col.phone === false ? " pw-phone-hide" : ""}">${e(col.label || "")}</th>`).join("");
  const cell = (col, value) => {
    const cls = `pw-col-${col.kind || "text"}${col.phone === false ? " pw-phone-hide" : ""}`;
    if (!hasValue(value) && !(value && typeof value === "object")) return `<td class="${cls}"></td>`;
    if (col.kind === "name") {
      const v = typeof value === "object" ? value : { text: value };
      const name = v.href ? `<a href="${e(v.href)}">${e(v.text)}</a>` : e(v.text);
      const tags = (v.tags || []).filter(hasValue).map((t) => `<em class="pw-tag">${e(t)}</em>`).join("");
      return `<td class="${cls}"><b>${name}</b>${tags}${hasValue(v.sub) ? `<span class="pw-sub">${e(v.sub)}</span>` : ""}</td>`;
    }
    if (col.kind === "time") {
      const v = typeof value === "object" ? value : { text: value };
      return `<td class="${cls}">${e(v.text)}${hasValue(v.sub) ? `<span class="pw-sub">${e(v.sub)}</span>` : ""}</td>`;
    }
    if (col.kind === "tag") return `<td class="${cls}"><span class="pw-pill">${e(value)}</span></td>`;
    return `<td class="${cls}">${e(value)}</td>`;
  };
  const body = rows.map((row, i) => `<tr${i >= first ? " hidden data-pw-more-row" : ""}>${columns.map((col) => cell(col, row[col.key])).join("")}</tr>`).join("");
  const hiddenCount = Math.max(0, rows.length - first);
  return `<div class="pw-table-wrap${genderClass(gender)}">
  <table class="pw-table" id="${e(id)}">${hasValue(caption) ? `<caption class="visually-hidden">${e(caption)}</caption>` : ""}<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
  ${hiddenCount ? `<button class="pw-more" type="button" data-pw-more aria-controls="${e(id)}" aria-expanded="false">${e(moreLabel(hiddenCount))}</button>` : ""}
</div>`;
}

// ---- Stat cards -----------------------------------------------------------------
// cards: [{ label, value, note }]. Four across on desktop, two on a phone.
// A card with no value is left out; with none, nothing renders.
export function statCards(cards = []) {
  const shown = cards.filter((card) => hasValue(card.value));
  if (!shown.length) return "";
  return `<div class="pw-stats">${shown.map((card) => `<div class="pw-stat"><small>${e(card.label)}</small><b>${e(card.value)}</b>${hasValue(card.note) ? `<span>${e(card.note)}</span>` : ""}</div>`).join("")}</div>`;
}

// ---- Podium cards -----------------------------------------------------------------
// items: [{ place, name, href, sub, mark }], first place dark and wider.
export function podiumCards(items = [], { gender = null } = {}) {
  const shown = items.filter((item) => hasValue(item.name)).slice(0, 3);
  if (!shown.length) return "";
  return `<div class="pw-podium${genderClass(gender)}">${shown.map((item, i) => `<div class="pw-pod${i === 0 ? " pw-pod-first" : ""}"><small>No. ${e(item.place ?? i + 1)}</small><b>${item.href ? `<a href="${e(item.href)}">${e(item.name)}</a>` : e(item.name)}</b>${hasValue(item.sub) ? `<span>${e(item.sub)}</span>` : ""}${hasValue(item.mark) ? `<span class="pw-pod-mark">${e(item.mark)}</span>` : ""}</div>`).join("")}</div>`;
}

// ---- Panel ------------------------------------------------------------------------
// A white panel with a display-font heading and a heavy rule under it.
export function panel({ title, sub = "", body = "", id = null } = {}) {
  if (!hasValue(body)) return "";
  return `<section class="pw-panel"${id ? ` id="${e(id)}"` : ""}><div class="pw-panel-h"><h2>${e(title)}</h2>${hasValue(sub) ? `<p>${e(sub)}</p>` : ""}</div>${body}</section>`;
}
