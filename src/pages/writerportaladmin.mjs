import { layout, pageHero } from "../lib/html.mjs";

const styles = `
    .writer-admin-shell { display:grid; gap:24px; }
    .writer-admin-table-wrap { overflow:auto; border:1px solid rgba(var(--black-rgb),.12); border-radius:13px; background:var(--white); }
    .writer-admin-table { width:100%; min-width:720px; border-collapse:collapse; }
    .writer-admin-table th { padding:12px; background:var(--black); color:var(--white); font-size:.74rem; letter-spacing:.05em; text-align:left; text-transform:uppercase; }
    .writer-admin-table td { padding:12px; border-bottom:1px solid rgba(var(--black-rgb),.1); vertical-align:middle; }
    .writer-admin-role-badge { display:inline-flex; padding:4px 9px; border-radius:999px; background:rgba(var(--green-rgb),.14); font-size:.72rem; font-weight:900; text-transform:uppercase; }
    .writer-admin-role-select { padding:6px 8px; border:1px solid rgba(var(--black-rgb),.22); border-radius:7px; font:inherit; }
`;

// Staff-only (portal role editor/admin, NOT the site's shared admin
// password -- see lib/portal_auth.mjs). Stage 1 stub: every writer with
// an account, and the ability to change roles. This becomes the review
// queue in Stage 3 (submitted articles instead of/alongside this list).
export function writerPortalAdminPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Writer Portal",
    title: "Writers.",
    description: "Everyone with a Podium Watch Writer Portal account. The review queue for submitted articles lands here in a later stage."
  })}

  <style>${styles}</style>

  <section class="section section-paper">
    <div class="container writer-admin-shell" data-writer-admin-loading>
      <div class="info-card"><h2>Checking your Writer Portal access</h2><p>Please wait.</p></div>
    </div>

    <div class="container writer-admin-shell" data-writer-admin-root hidden>
      <a class="button button-outline" href="/writer-portal/" style="width:fit-content;">Back to your articles</a>

      <div class="writer-admin-table-wrap">
        <table class="writer-admin-table">
          <thead><tr><th>Name</th><th>Role</th><th>School</th><th>Grade</th><th>Joined</th></tr></thead>
          <tbody data-writer-admin-rows></tbody>
        </table>
      </div>
    </div>

    <div class="container writer-admin-shell" data-writer-admin-denied hidden>
      <div class="info-card"><h2>Writer Portal staff access required</h2><p>This page is only available to editors and admins.</p></div>
    </div>
  </section>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0" defer></script>
  <script src="/scripts/writer-auth-client.js" defer></script>
  <script src="/scripts/writer-portal-admin.js" defer></script>`;

  return layout({
    site,
    title: "Writers",
    description: "Manage Podium Watch Writer Portal accounts.",
    pathname: "/writer-portal/admin/",
    content
  });
}
