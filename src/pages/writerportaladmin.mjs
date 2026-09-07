import { layout, pageHero } from "../lib/html.mjs";

const styles = `
    .writer-admin-shell { display:grid; gap:24px; }
    .writer-admin-table-wrap { overflow:auto; border:1px solid rgba(var(--black-rgb),.12); border-radius:13px; background:var(--white); }
    .writer-admin-table { width:100%; min-width:720px; border-collapse:collapse; }
    .writer-admin-table th { padding:12px; background:var(--black); color:var(--white); font-size:.74rem; letter-spacing:.05em; text-align:left; text-transform:uppercase; }
    .writer-admin-table td { padding:12px; border-bottom:1px solid rgba(var(--black-rgb),.1); vertical-align:middle; }
    .writer-admin-role-badge { display:inline-flex; padding:4px 9px; border-radius:999px; background:rgba(var(--green-rgb),.14); font-size:.72rem; font-weight:900; text-transform:uppercase; }
    .writer-admin-role-select { padding:6px 8px; border:1px solid rgba(var(--black-rgb),.22); border-radius:7px; font:inherit; }
    .writer-admin-invite-form { display:flex; flex-wrap:wrap; gap:10px; align-items:flex-end; }
    .writer-admin-invite-form label { display:grid; gap:5px; font-weight:800; font-size:.85rem; }
    .writer-admin-invite-form input { padding:9px 10px; border:1px solid rgba(var(--black-rgb),.22); border-radius:8px; font:inherit; min-width:220px; }
    .writer-admin-message { padding:10px 14px; border-radius:9px; font-weight:700; }
    .writer-admin-message[data-tone="error"] { background:rgba(220,38,38,.12); color:#7a1414; }
    .writer-admin-message[data-tone="success"] { background:rgba(var(--green-rgb),.13); color:var(--green-ink); }
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
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <a class="button button-outline" href="/writer-portal/">Back to your articles</a>
        <a class="button button-outline" href="/writer-portal/admin/review/">Review queue</a>
      </div>

      <section class="info-card">
        <p class="eyebrow">Add a writer</p>
        <h2>Invite a writer</h2>
        <form class="writer-admin-invite-form" data-writer-invite-form>
          <label>Email<input type="email" name="email" required maxlength="320"></label>
          <label>Name (optional)<input type="text" name="full_name" maxlength="200"></label>
          <button class="button button-primary" type="submit">Send invite</button>
        </form>
        <p class="writer-admin-message" data-writer-invite-message role="status" hidden style="margin-top:10px;"></p>
      </section>

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
