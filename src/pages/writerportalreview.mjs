import { adminShell } from "../lib/adminshell.mjs";

const styles = `
    .writer-review-shell { display:grid; gap:20px; }
    .writer-review-filters { display:flex; flex-wrap:wrap; gap:10px; }
    .writer-review-filters select { padding:8px 10px; border:1px solid rgba(var(--black-rgb),.22); border-radius:8px; font:inherit; }
    .admin-table tr[data-review-row] { cursor:pointer; }
    .admin-table tr[data-review-row]:hover { background: rgba(var(--green-rgb),.06); }
    .writer-review-status-pill { display:inline-flex; padding:4px 9px; border-radius:999px; background:rgba(var(--green-rgb),.14); font-size:.72rem; font-weight:900; text-transform:uppercase; }
    .writer-review-detail-header { display:flex; flex-wrap:wrap; justify-content:space-between; gap:14px; align-items:flex-start; }
    .writer-review-meta { color: var(--muted); font-weight:700; }
    .writer-review-body { margin-top:16px; padding:18px; border:1px solid rgba(var(--black-rgb),.12); border-radius:10px; background:var(--white); line-height:1.65; }
    .writer-review-body img { max-width:100%; border-radius:8px; }
    .writer-review-body blockquote { border-left:3px solid var(--green); margin:0; padding-left:14px; color:var(--muted); }
    .writer-review-actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:18px; }
    .writer-review-notes { margin-top:22px; display:grid; gap:12px; }
    .writer-review-note { padding:12px 14px; border:1px solid rgba(var(--black-rgb),.12); border-radius:9px; }
    .writer-review-note-meta { color: var(--muted); font-size:.82rem; font-weight:700; margin-bottom:4px; }
    .writer-review-note-form { display:grid; gap:10px; }
    .writer-review-note-form textarea { width:100%; min-height:90px; padding:10px 12px; border:1px solid rgba(var(--black-rgb),.22); border-radius:9px; font:inherit; }
    .writer-review-message { padding:12px 14px; border-radius:9px; font-weight:700; }
    .writer-review-message[data-tone="error"] { background:rgba(220,38,38,.12); color:#7a1414; }
    .writer-review-message[data-tone="success"] { background:rgba(var(--green-rgb),.13); color:var(--green-ink); }
    .writer-review-stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:12px; }
    .writer-review-stat { padding:14px; border:1px solid rgba(var(--black-rgb),.12); border-radius:10px; background:var(--white); text-align:center; }
    .writer-review-stat strong { display:block; font-size:1.5rem; font-family:Impact,Haettenschweiler,"Arial Narrow Bold",sans-serif; }
    .writer-review-stat span { font-size:.72rem; font-weight:800; text-transform:uppercase; color:var(--muted); }
    .writer-review-oldest { padding:12px 16px; border-radius:9px; background:rgba(230,167,0,.14); font-weight:700; }
    .writer-review-comment-bar { display:flex; align-items:center; gap:10px; margin-top:10px; }
    .writer-review-body[data-selectable="true"] { cursor:text; user-select:text; }
    .writer-review-body mark[data-note-id] { background:rgba(230,167,0,.4); border-radius:2px; cursor:pointer; }
`;

// Staff-only (portal role editor/admin -- see lib/portal_auth.mjs), same
// shared shell as every other Podium Watch admin tool now (sidebar,
// pins, badges, quick-jump search) instead of the public site's chrome.
// This page's own auth check (window.PodiumWriterAuth,
// writer-portal-review.js) is untouched -- only the surrounding
// navigation changed. See docs/DECISIONS.md.
export function writerPortalReviewPage(site) {
  const content = `<div class="writer-review-shell" data-writer-review-loading>
    <div class="info-card"><h2>Checking your Writer Portal access</h2><p>Please wait.</p></div>
  </div>

  <div class="writer-review-shell" data-writer-review-denied hidden>
    <div class="info-card"><h2>Writer Portal staff access required</h2><p>This page is only available to editors and admins.</p></div>
  </div>

  <div class="writer-review-shell" data-writer-review-list-root hidden>
    <div class="writer-review-stats" data-writer-review-stats></div>
    <p class="writer-review-oldest" data-writer-review-oldest hidden></p>

    <div class="writer-review-filters">
      <select data-writer-review-status-filter>
        <option value="">Needs attention (default)</option>
        <option value="draft">Draft (in progress, not yet submitted)</option>
        <option value="submitted">Submitted</option>
        <option value="needs_revision">Needs revision</option>
        <option value="approved">Approved</option>
        <option value="published">Published</option>
        <option value="archived">Archived</option>
      </select>
      <select data-writer-review-category-filter>
        <option value="">All categories</option>
        <option value="race_recap">Race Recap</option>
        <option value="feature">Feature</option>
        <option value="rankings_polls">Rankings &amp; Polls</option>
        <option value="recruiting">Recruiting</option>
        <option value="other">Other</option>
      </select>
    </div>

    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr><th>Title</th><th>Writer</th><th>Category</th><th>Status</th><th>Updated</th></tr></thead>
        <tbody data-writer-review-rows></tbody>
      </table>
    </div>
  </div>

  <div class="writer-review-shell" data-writer-review-detail-root hidden>
    <a class="button button-outline" href="/writer-portal/admin/review/" style="width:fit-content;">Back to the queue</a>

    <section class="info-card">
      <div class="writer-review-detail-header">
        <div>
          <p class="eyebrow" data-writer-review-detail-category></p>
          <h2 data-writer-review-detail-title></h2>
          <p class="writer-review-meta" data-writer-review-detail-meta></p>
        </div>
        <span class="writer-review-status-pill" data-writer-review-detail-status></span>
      </div>

      <div class="writer-review-comment-bar">
        <button class="button button-outline" type="button" data-writer-review-comment-selection disabled>Comment on selected text</button>
        <span style="font-size:.8rem;color:var(--muted);">Select a passage in the piece below, then click here.</span>
      </div>
      <div class="writer-review-body" data-selectable="true" data-writer-review-detail-body></div>

      <p class="writer-review-message" data-writer-review-message role="status" hidden></p>

      <div class="writer-review-actions" data-writer-review-actions></div>

      <div class="writer-review-notes">
        <h3>Notes</h3>
        <div data-writer-review-notes-list></div>
        <form class="writer-review-note-form" data-writer-review-note-form>
          <textarea name="note" placeholder="Leave a note for the writer or for the record" maxlength="4000"></textarea>
          <button class="button button-outline" type="submit" style="width:fit-content;">Add note</button>
        </form>
      </div>
    </section>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0" defer></script>
  <script src="/scripts/writer-auth-client.js" defer></script>
  <script src="/scripts/writer-portal-render.js" defer></script>
  <script src="/scripts/writer-portal-review.js" defer></script>`;

  return adminShell({
    site,
    pathname: "/writer-portal/admin/review/",
    title: "Review Queue",
    description: "Podium Watch Writer Portal review queue.",
    eyebrow: "Podium Watch Writer Portal",
    heading: "Review queue.",
    intro: "Submitted articles awaiting review, and everything already moving through approval and publishing.",
    styles,
    content
  });
}
