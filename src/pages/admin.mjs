import { adminShell } from "../lib/adminshell.mjs";

// /admin/ -- the real dashboard landing page (see docs/DECISIONS.md,
// 2026-08-16). Used to BE the Meet Manager tool with a 15-button nav
// grid stapled to the top of it; Meet Manager now has its own route
// (/admin/meets/, src/pages/adminmeets.mjs) and every tool link lives in
// the persistent sidebar every admin page shares (src/lib/adminshell.mjs)
// instead. This page keeps only what genuinely belongs on a landing
// page: sign in, an at-a-glance stat strip, and a needs-attention panel
// -- both populated client-side by public/scripts/admin-dashboard.js
// from the same api/admin/dashboard-summary/ data the sidebar's badges
// already use, so the numbers here and the badge counts can never
// disagree.
//
// Like every admin page, this is a build-time static file with no
// server-side per-request auth check -- that's unchanged from before
// this redesign. Sign-in/session state is entirely client-side, gated
// by API endpoints that each independently call isAdminRequest().
export function adminPage(site) {
  const content = `<div class="info-card" data-admin-loading>
    <h2>Checking your session</h2>
    <p>Please wait while the admin area loads.</p>
  </div>

  <form class="info-card" data-admin-login hidden style="max-width: 620px; margin: 0 auto;">
    <p class="eyebrow">Private access</p>
    <h2>Admin sign in</h2>

    <label style="display:block; margin-top:20px;">
      <strong>Password</strong>
      <input type="password" name="password" autocomplete="current-password" required style="display:block;width:100%;margin-top:8px;padding:14px;font:inherit;">
    </label>

    <p data-admin-message aria-live="polite" style="margin-top:14px;"></p>

    <button class="button button-primary" type="submit" style="margin-top:16px;">Sign in</button>
  </form>

  <div data-admin-dashboard hidden>
    <div style="display:flex;justify-content:flex-end;margin-bottom:20px;">
      <button class="button button-outline" type="button" data-admin-logout>Sign out</button>
    </div>

    <div class="admin-stats" data-admin-stats></div>

    <div class="section-heading">
      <div>
        <p class="eyebrow">Needs attention</p>
        <h2>What to do next</h2>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;">
        <button class="button button-outline" type="button" data-admin-refresh>Refresh</button>
        <a class="button button-outline" href="/admin/operations/">View all in Operations Center</a>
      </div>
    </div>

    <div class="admin-tasks" data-admin-tasks></div>
    <p data-admin-tasks-empty hidden>Nothing urgent or important needs attention right now.</p>
    <p data-admin-tasks-error hidden>The needs-attention list could not be loaded. Try Operations Center directly.</p>
  </div>`;

  return adminShell({
    site,
    pathname: "/admin/",
    title: "Admin",
    description: "Private Podium Watch website management area.",
    heading: "Admin dashboard",
    intro: "Sign in, see what needs attention, and jump to any tool.",
    content,
    scripts: ["/scripts/admin-dashboard.js"]
  });
}
