import { adminShell } from "../lib/adminshell.mjs";

// Private admin gallery for the photo submission system (install/69_
// PHOTO_SUBMISSIONS.sql). Browses submitted photos by their compressed
// preview only -- selecting one is the single trigger that ever promotes
// a photo to a permanently-kept compressed copy. See
// public/scripts/admin-photo-submissions.js and
// lib/photo_submissions_service.mjs for the full storage-discipline story.
const styles = `
    .photo-admin-filters { display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end; margin-bottom:18px; }
    .photo-admin-filters label { display:grid; gap:6px; font-weight:800; font-size:.85rem; }
    .photo-admin-filters input, .photo-admin-filters select { padding:8px 10px; border:1px solid rgba(var(--black-rgb),.22); border-radius:8px; font:inherit; }
    .photo-admin-submission { border:1px solid rgba(var(--black-rgb),.15); border-radius:12px; padding:16px; margin-bottom:16px; background:var(--white); }
    .photo-admin-submission-head { display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:10px; }
    .photo-admin-submission-head h3 { margin:0 0 4px; }
    .photo-admin-meta { color:var(--muted); font-size:.88rem; margin:0; }
    .photo-admin-credit { font-weight:800; }
    .photo-admin-badge { display:inline-block; padding:3px 9px; border-radius:999px; font-size:.75rem; font-weight:800; background:rgba(var(--black-rgb),.08); }
    .photo-admin-badge[data-tone="link"] { background:rgba(var(--green-rgb),.15); color:var(--green-ink); }
    .photo-admin-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:10px; }
    .photo-admin-item { border:1px solid rgba(var(--black-rgb),.15); border-radius:9px; overflow:hidden; background:var(--paper); }
    .photo-admin-item img { width:100%; aspect-ratio:1; object-fit:cover; display:block; }
    .photo-admin-item-actions { display:flex; gap:4px; padding:6px; }
    .photo-admin-item-actions button { flex:1; padding:6px 4px; font-size:.75rem; border-radius:6px; border:1px solid rgba(var(--black-rgb),.2); background:var(--white); cursor:pointer; font-weight:800; }
    .photo-admin-item-actions button[data-photo-select] { background:var(--green); border-color:var(--green); }
    .photo-admin-item[data-item-status="selected"] { outline:2px solid var(--green); }
    .photo-admin-item[data-item-status="archived"] { opacity:.45; }
    .photo-admin-link-row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; padding:12px; border:1px dashed rgba(var(--black-rgb),.25); border-radius:10px; }
    .photo-admin-empty { color:var(--muted); padding:30px 0; text-align:center; }
    .photo-admin-message { padding:10px 14px; border-radius:9px; font-weight:700; margin-bottom:14px; }
    .photo-admin-message[data-tone="success"] { background:rgba(var(--green-rgb),.13); color:var(--green-ink); }
    .photo-admin-message[data-tone="error"] { background:rgba(220,38,38,.12); color:#7a1414; }
`;

export function adminPhotoSubmissionsPage(site) {
  const content = `<style>${styles}</style>
    <div data-photo-admin>
      <p class="photo-admin-message" data-photo-admin-message role="status" hidden></p>

      <div class="photo-admin-filters">
        <label>Status<select data-photo-filter-status><option value="pending" selected>Pending review</option><option value="reviewed">Reviewed</option><option value="all">All</option></select></label>
        <label>Photo status<select data-photo-filter-item-status><option value="pending" selected>Pending</option><option value="selected">Selected</option><option value="archived">Archived</option><option value="all">All</option></select></label>
        <label>Meet<input type="text" data-photo-filter-meet placeholder="Meet name"></label>
        <label>School<input type="text" data-photo-filter-school placeholder="School name"></label>
        <button class="button button-outline" type="button" data-photo-refresh>Refresh</button>
      </div>

      <div data-photo-admin-list></div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0" defer></script>`;

  return adminShell({
    site,
    pathname: "/admin/photo-submissions/",
    title: "Photo Submissions",
    description: "Browse and select submitted meet photos for articles and Instagram.",
    heading: "Photo Submissions.",
    intro: "Browse submitted photos by school, meet, date, and photographer. Selecting a photo is what keeps a permanent copy -- everything else stays a small preview until you do.",
    styles: "",
    content,
    scripts: ["/scripts/admin-photo-submissions.js"]
  });
}
