// The shared shell every /admin/* page renders through instead of calling
// layout() directly. Adds one persistent thing every admin page was
// missing: a real sidebar listing all 16 tools, so getting from one tool
// to another doesn't depend on whichever 2-3 hand-picked "related tool"
// links that specific page happened to include (see docs/DECISIONS.md,
// 2026-08-16, for the full reasoning).
//
// Everything here is static, server-rendered HTML -- this is a
// build-time static site generator, there is no per-request server
// rendering to lean on. Badges, pins, recent-tools, and quick-jump
// filtering are all added client-side by public/scripts/admin-shell.js
// on top of this markup, never required for the sidebar to work.
import { layout, pageHero } from "./html.mjs";
import { escapeHtml } from "./content.mjs";
import { ADMIN_NAV_GROUPS, findAdminNavItem, adminNavClientPayload } from "./adminnav.mjs";

function safeJson(value) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}

function renderNavItem(item, activeHref) {
  const active = item.href === activeHref;
  // .admin-nav-row is the positioning context for the pin button below
  // -- it must wrap exactly this one item, not the whole group, or
  // every pin button in a group ends up positioned relative to the
  // group's full height instead of its own row (found live: every pin
  // button in a group visually stacked at the same point, so clicking
  // one actually hit a different tool's button).
  return `<div class="admin-nav-row">
  <a class="admin-nav-item" href="${item.href}" data-admin-nav-item="${item.href}"${active ? ' aria-current="page"' : ""}>
    <span class="admin-nav-mark" aria-hidden="true">${escapeHtml(item.mark)}</span>
    <span class="admin-nav-label">${escapeHtml(item.label)}</span>
    <span class="admin-badge" data-admin-badge="${item.href}" hidden></span>
  </a>
  <button class="admin-pin" type="button" data-admin-pin="${item.href}" data-admin-pin-label="${escapeHtml(item.label)}" aria-pressed="false">
    <span class="visually-hidden">Pin ${escapeHtml(item.label)}</span>
    <span class="admin-pin-glyph" aria-hidden="true">+</span>
  </button>
  </div>`;
}

function renderGroups(activeHref) {
  return ADMIN_NAV_GROUPS.map((group) => `
    <p class="admin-nav-group">${escapeHtml(group.label)}</p>
    <div class="admin-nav-group-items">
      ${group.items.map((item) => renderNavItem(item, activeHref)).join("")}
    </div>
  `).join("");
}

function renderSidebar(pathname) {
  const active = findAdminNavItem(pathname);
  const activeHref = active ? active.href : pathname;

  return `<nav class="admin-sidebar" aria-label="Podium Watch admin sections" data-admin-sidebar>
    <button class="admin-jump-trigger" type="button" data-admin-jump-open>
      <span>Jump to tool</span><kbd>Ctrl K</kbd>
    </button>
    <div class="admin-sidebar-pinned" data-admin-pinned hidden>
      <p class="admin-nav-group">Pinned</p>
      <div class="admin-nav-group-items" data-admin-pinned-items></div>
    </div>
    <div class="admin-sidebar-recent" data-admin-recent hidden>
      <p class="admin-nav-group">Recent</p>
      <div class="admin-nav-group-items" data-admin-recent-items></div>
    </div>
    <details class="admin-sidebar-groups" data-admin-groups open>
      <summary>All tools</summary>
      ${renderGroups(activeHref)}
    </details>
    <div class="admin-sidebar-foot">
      <span data-admin-session-state></span>
      <button class="admin-sidebar-collapse" type="button" data-admin-sidebar-collapse aria-pressed="false">Collapse</button>
    </div>
  </nav>`;
}

function renderJumpDialog() {
  return `<dialog class="admin-jump" data-admin-jump aria-labelledby="admin-jump-title">
    <div class="admin-jump-inner">
      <div class="admin-jump-heading">
        <h2 id="admin-jump-title" class="visually-hidden">Jump to an admin tool</h2>
        <input type="search" data-admin-jump-input placeholder="Type a tool name" autocomplete="off">
        <button class="admin-jump-close" type="button" aria-label="Close jump menu" data-admin-jump-close>Close</button>
      </div>
      <ul data-admin-jump-results></ul>
      <p class="admin-jump-hint">Arrow keys to move, Enter to open, Esc to close.</p>
    </div>
  </dialog>`;
}

export function adminShell({
  site,
  pathname,
  title,
  description,
  eyebrow = "Podium Watch Admin",
  heading,
  intro,
  styles = "",
  content,
  scripts = []
}) {
  const shellContent = `${pageHero({ eyebrow, title: heading, description: intro, compact: true })}
${styles ? `<style>${styles}</style>` : ""}
<div class="admin-layout" data-admin-shell data-session="pending">
  ${renderSidebar(pathname)}
  <div class="admin-main" id="admin-content">${content}</div>
</div>
${renderJumpDialog()}
<script>window.PODIUM_ADMIN_NAV = ${safeJson(adminNavClientPayload())};</script>
${scripts.map((src) => `<script src="${src}" defer></script>`).join("\n")}`;

  return layout({
    site,
    title,
    description,
    pathname,
    content: shellContent,
    bodyClass: "admin-shell"
  });
}
