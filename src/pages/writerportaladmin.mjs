import { adminShell } from "../lib/adminshell.mjs";

const styles = `
    .writer-admin-shell { display:grid; gap:24px; }
    .writer-admin-role-badge { display:inline-flex; padding:4px 9px; border-radius:999px; background:rgba(var(--green-rgb),.14); font-size:.72rem; font-weight:900; text-transform:uppercase; }
    .writer-admin-role-select { padding:6px 8px; border:1px solid rgba(var(--black-rgb),.22); border-radius:7px; font:inherit; }
    .writer-admin-invite-form { display:flex; flex-wrap:wrap; gap:10px; align-items:flex-end; }
    .writer-admin-invite-form label { display:grid; gap:5px; font-weight:800; font-size:.85rem; }
    .writer-admin-invite-form input { padding:9px 10px; border:1px solid rgba(var(--black-rgb),.22); border-radius:8px; font:inherit; min-width:220px; }
    .writer-admin-broadcast-form { display:grid; gap:10px; max-width:520px; }
    .writer-admin-broadcast-form label { display:grid; gap:5px; font-weight:800; font-size:.85rem; }
    .writer-admin-broadcast-form input, .writer-admin-broadcast-form textarea { padding:9px 10px; border:1px solid rgba(var(--black-rgb),.22); border-radius:8px; font:inherit; }
    .writer-admin-broadcast-form textarea { min-height:120px; resize:vertical; }
    .writer-admin-broadcast-recipients { display:grid; gap:6px; }
    .writer-admin-broadcast-recipients-label { font-weight:800; font-size:.85rem; }
    .writer-admin-broadcast-checklist { display:flex; flex-wrap:wrap; gap:8px 18px; padding:12px 14px; border:1px solid rgba(var(--black-rgb),.14); border-radius:8px; }
    .writer-admin-broadcast-checklist label { display:flex; align-items:center; gap:6px; font-weight:600; font-size:.9rem; }
    .writer-admin-broadcast-checklist-empty { color:var(--muted); font-size:.88rem; }
    .writer-admin-message { padding:10px 14px; border-radius:9px; font-weight:700; }
    .writer-admin-message[data-tone="error"] { background:rgba(220,38,38,.12); color:#7a1414; }
    .writer-admin-message[data-tone="success"] { background:rgba(var(--green-rgb),.13); color:var(--green-ink); }
`;

// Staff-only (portal role editor/admin, NOT the site's shared admin
// password -- see lib/portal_auth.mjs). Every writer with an account, and
// the ability to change roles. Rendered through the same adminShell() as
// every other Podium Watch admin tool (sidebar, pins, badges, quick-jump
// search) instead of the site's public chrome -- this page's own auth
// check (window.PodiumWriterAuth, writer-portal-admin.js) is untouched;
// only the surrounding navigation changed. See docs/DECISIONS.md.
export function writerPortalAdminPage(site) {
  const content = `<div class="writer-admin-shell" data-writer-admin-loading>
    <div class="info-card"><h2>Checking your Writer Portal access</h2><p>Please wait.</p></div>
  </div>

  <div class="writer-admin-shell" data-writer-admin-root hidden>
    <div style="display:flex;gap:10px;flex-wrap:wrap;">
      <a class="button button-outline" href="/writer-portal/">Back to your articles</a>
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

    <section class="info-card">
      <p class="eyebrow">Reach the whole team</p>
      <h2>Message all writers</h2>
      <p>Sends one email to every current writer (not other staff). Each writer only sees their own copy -- no one's address is shared with anyone else.</p>
      <form class="writer-admin-broadcast-form" data-writer-broadcast-form>
        <label>Subject<input type="text" name="subject" required maxlength="200"></label>
        <label>Message<textarea name="message" required maxlength="4000"></textarea></label>
        <div class="writer-admin-broadcast-recipients">
          <span class="writer-admin-broadcast-recipients-label">Send to</span>
          <div class="writer-admin-broadcast-checklist" data-writer-broadcast-checklist>
            <span class="writer-admin-broadcast-checklist-empty">Loading writers...</span>
          </div>
        </div>
        <button class="button button-primary" type="submit">Send</button>
      </form>
      <p class="writer-admin-message" data-writer-broadcast-message role="status" hidden style="margin-top:10px;"></p>
    </section>

    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr><th>Name</th><th>Role</th><th>School</th><th>Grade</th><th>Joined</th><th>Last active</th><th>Account</th></tr></thead>
        <tbody data-writer-admin-rows></tbody>
      </table>
    </div>
  </div>

  <div class="writer-admin-shell" data-writer-admin-denied hidden>
    <div class="info-card"><h2>Writer Portal staff access required</h2><p>This page is only available to editors and admins.</p></div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0" defer></script>
  <script src="/scripts/writer-auth-client.js" defer></script>
  <script src="/scripts/writer-portal-admin.js" defer></script>`;

  return adminShell({
    site,
    pathname: "/writer-portal/admin/",
    title: "Writers",
    description: "Manage Podium Watch Writer Portal accounts.",
    eyebrow: "Podium Watch Writer Portal",
    heading: "Writers.",
    intro: "Everyone with a Podium Watch Writer Portal account.",
    styles,
    content
  });
}
